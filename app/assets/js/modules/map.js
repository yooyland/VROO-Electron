import {emit} from "../core/events.js";
import {carInfo, makeDemoUsers, updateDemoUserPositions, MY_USER_ID} from "./data.js";
import {
  placesForZoomDetail,
  normalizePlaceName,
  normalizePlaceMeta,
  categorySvg,
  categoryLabel,
  kindLabel,
  PLACE_CATEGORY_SVG,
  defaultMapLayerPrefs,
  sanitizeMapLayerPrefs
} from "./places.js";
import {
  getGridCellFromLatLng,
  getVisibleGridCells,
  levelForMapZoom,
  getGridBounds,
  ACTIVE_GRID_LEVEL,
  isSpatialGridId,
  localGridIdFromLatLng,
  cellCoversGridId,
  DEBUG_SPATIAL_GRID
} from "./spatial-grid.js";
import {showSystemMessage} from "../core/ui.js";
import {
  getVehicleConversationStatus,
  getActiveSpatialOverlays,
  pruneSpatialOverlays,
  openConversationInChat,
  ensureConversationUi
} from "./conversation-store.js";

let map;
let allMap;
let markerLayer;
let allLayer;
let placeLabelLayer;
let allPlaceLabelLayer;
/** 공간 메시지 오버레이 레이어 */
let spatialOverlayLayerNear = null;
let spatialOverlayLayerAll = null;
let selectedPreviewUserId = null;
let selectedPreviewPlaceId = null;
/** 단일 데모 사용자 목록 — near/all/road가 동일 배열 참조 */
let users = [];
let stateRef;
let labelsVisible = true;
let mapReady = false;
let awaitingFirstGpsCenter = true;
let userMovedMap = false;
let programmaticMoveDepth = 0;
/** setMapView와 GPS 갱신이 공유하는 마커 표시 모드 */
let markerMode = "near";
/** 직전 DRIVE 뷰 — all↔near 중심/줌 동기화용 */
let lastMapViewMode = "near";
let legendOpen = false;
let legendOutsideBound = false;
let spatialBubbleExpiryTimer = 0;

let markersNear = new Map();
const markersAll = new Map();
let meMarkerNear = null;
let meMarkerAll = null;
let gridOverlayLayer = null;
let gridOverlayId = null;

/** viewport Spatial GRID 레이어 (map별) */
const visibleGridLayersNear = new Map();
const visibleGridLayersAll = new Map();
let spatialGridBound = false;
/** 상단 메인 메뉴 “그리드”에서만 true — near/all/road 탭과 무관 */
let spatialGridVisible = false;
/** road 뷰일 때 일시 중지 (메뉴 상태는 유지) */
let spatialGridPaused = false;
let spatialRefreshTimer = 0;
let countBadgeNear = new Map();
let countBadgeAll = new Map();
/** map 인스턴스 → 마지막 표시 level (hysteresis) */
const lastDisplayLevelByMap = new WeakMap();
let debugHudEl = null;

let lastRenderAt = 0;
let lastRenderLoc = null;
const GPS_THROTTLE_MS = 1500;
const GPS_MIN_MOVE_M = 8;

let lastWarnKey = "";
let lastWarnAt = 0;

const BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";

const BASEMAP_OPTIONS = {
  maxZoom: 20,
  subdomains: "abcd",
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
};

function warnRare(tag, err) {
  const key = `${tag}:${err?.message || err}`;
  const now = Date.now();
  if (key === lastWarnKey && now - lastWarnAt < 5000) return;
  lastWarnKey = key;
  lastWarnAt = now;
  console.warn(tag, err);
}

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function shouldRenderMarkers(location, options) {
  if (options.forceCenter === true || options.forceRender === true) return true;
  if (awaitingFirstGpsCenter && !userMovedMap) return true;
  if (!lastRenderLoc) return true;
  const now = Date.now();
  if (now - lastRenderAt >= GPS_THROTTLE_MS) return true;
  if (distanceMeters(lastRenderLoc, location) >= GPS_MIN_MOVE_M) return true;
  return false;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureMapLayerPrefs(state = stateRef) {
  if (!state) return defaultMapLayerPrefs();
  state.mapLayerPrefs = sanitizeMapLayerPrefs(state.mapLayerPrefs);
  labelsVisible = state.mapLayerPrefs.labelsVisible !== false;
  return state.mapLayerPrefs;
}

function saveMapPrefs() {
  if (!stateRef) return;
  ensureMapLayerPrefs(stateRef);
  emit("state:save");
}

function zoomDetailLevel(zoom) {
  if (zoom < 14) return "low";
  if (zoom < 16) return "mid";
  return "high";
}

function zOffsetForKind(kind, selected = false) {
  if (selected) return 1200;
  const table = {
    my_location: 1000,
    spatial_message: 850,
    vehicle: 700,
    landmark: 450,
    place: 400,
    road_label: 200,
    area_label: 180
  };
  return table[kind] || 300;
}

function headingArrow(deg) {
  if (!Number.isFinite(Number(deg))) return "";
  const d = ((Number(deg) % 360) + 360) % 360;
  return `<span class="vroo-marker-heading" style="transform:rotate(${d}deg)" aria-hidden="true">▲</span>`;
}

function sameDirectionAsMe(user) {
  const meH = Number(stateRef?.location?.heading ?? stateRef?.heading);
  const uh = Number(user?.heading);
  if (!Number.isFinite(meH) || !Number.isFinite(uh)) return false;
  let diff = Math.abs(meH - uh) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff <= 45;
}

function vehiclePassesFilter(user, prefs) {
  if (!prefs.showVehicles) return false;
  if (prefs.filterMode === "place" || prefs.filterMode === "spatial") return false;
  const vf = prefs.vehicleFilter || "all";
  if (vf === "online" && user.online === false) return false;
  if (vf === "same_direction" && !sameDirectionAsMe(user)) return false;
  if (vf === "friends") {
    const friends = stateRef?.connections || [];
    if (!friends.includes(user.id) && !friends.some((c) => c?.id === user.id || c === user.id)) return false;
  }
  if (vf === "chatting" && stateRef) {
    const st = getVehicleConversationStatus(stateRef, user.id);
    if (!st || st.status === "no_conversation" || st.status === "muted") return false;
  }
  return true;
}

function placePassesFilter(place, prefs) {
  if (!prefs.labelsVisible) return false;
  const kind = place.kind;
  if (prefs.filterMode === "vehicle" || prefs.filterMode === "spatial") return false;
  if (kind === "landmark" && !prefs.showLandmarks) return false;
  if (kind === "place" && !prefs.showPlaces) return false;
  if (kind === "road_label" && !prefs.showRoadLabels) return false;
  if (kind === "area_label" && !prefs.showAreaLabels) return false;
  const catF = prefs.placeCategoryFilter || "all";
  if (catF !== "all" && place.category !== catF && kind !== "road_label" && kind !== "area_label") {
    return false;
  }
  return true;
}

function iconFor(user, me = false) {
  if (me) return myLocationIcon();
  const zoom = map?.getZoom?.() ?? 16;
  const detail = zoomDetailLevel(zoom);
  const statusInfo = !stateRef ? null : getVehicleConversationStatus(stateRef, user.id);
  const selected = selectedPreviewUserId === user.id;
  const online = user.online !== false;
  const nick = escapeHtml(user.nickname || "차량");
  const level = Number(user.level) || 1;
  const dir = bearingLabel(user.heading);
  const same = sameDirectionAsMe(user);
  const carEmoji = carInfo(user.car).emoji;
  const unreadBadge = convoIndicatorHtml(statusInfo);
  const preview =
    selected && statusInfo?.lastMessage
      ? `<div class="map-convo-preview">${escapeHtml(String(statusInfo.lastMessage).slice(0, 36))}</div>`
      : "";
  const meta =
    detail === "low"
      ? ""
      : detail === "mid"
        ? `<span class="vroo-marker-meta">Lv.${level}</span>`
        : `<span class="vroo-marker-meta">Lv.${level} · ${escapeHtml(same ? "같은 방향" : dir)}</span>`;
  const aria = `차량, ${user.nickname || "차량"}, 레벨 ${level}`;
  return L.divIcon({
    className: "vroo-marker-wrap",
    html: `<div class="vroo-marker vroo-marker--vehicle ${selected ? "is-selected" : ""} ${online ? "is-online" : "is-offline"}" role="img" aria-label="${escapeHtml(aria)}" aria-selected="${selected}">
      <div class="vroo-marker-vehicle-icon" aria-hidden="true">
        ${PLACE_CATEGORY_SVG.vehicle}
        <span class="vroo-marker-car-emoji">${carEmoji}</span>
        ${headingArrow(user.heading)}
        ${unreadBadge}
        <span class="vroo-marker-online-dot" title="${online ? "온라인" : "오프라인"}"></span>
      </div>
      <div class="vroo-marker-vehicle-card">
        <b>${nick}</b>
        ${meta}
      </div>
      ${preview}
    </div>`,
    iconSize: [detail === "low" ? 56 : 132, preview ? 88 : detail === "low" ? 56 : 58],
    iconAnchor: [detail === "low" ? 28 : 40, preview ? 44 : detail === "low" ? 28 : 48]
  });
}

function myLocationIcon() {
  const nick = escapeHtml(stateRef?.profile?.nickname || "나");
  return L.divIcon({
    className: "vroo-marker-wrap",
    html: `<div class="vroo-marker vroo-marker--me" role="img" aria-label="내 위치, ${nick}">
      <span class="vroo-me-pulse" aria-hidden="true"></span>
      <span class="vroo-me-core" aria-hidden="true"></span>
      <span class="vroo-me-label">내 위치</span>
    </div>`,
    iconSize: [72, 56],
    iconAnchor: [36, 28]
  });
}

function bearingLabel(deg) {
  if (!Number.isFinite(Number(deg))) return "방향 확인 중";
  const d = ((Number(deg) % 360) + 360) % 360;
  if (d >= 315 || d < 45) return "북쪽";
  if (d < 135) return "동쪽";
  if (d < 225) return "남쪽";
  return "서쪽";
}

function showVehiclePreviewCard(user) {
  if (!stateRef || !user) return;
  selectedPreviewUserId = user.id;
  selectedPreviewPlaceId = null;
  hidePlacePreviewCard();
  drawUsers(markerMode);
  refreshLabels();
  const status = getVehicleConversationStatus(stateRef, user.id);
  const me = stateRef.location;
  const dist = me ? Math.round(L.latLng(me.lat, me.lng).distanceTo([user.lat, user.lng])) : null;
  const host = document.body.dataset.mapView === "all"
    ? document.querySelector("#allMapPane")
    : document.querySelector("#mapView");
  if (!host) return;
  let el = host.querySelector("#mapVehiclePreview");
  if (!el) {
    el = document.createElement("div");
    el.id = "mapVehiclePreview";
    el.className = "map-vehicle-preview";
    host.appendChild(el);
  }
  const unread = Math.max(0, Number(status.unread) || 0);
  const srcLabel = status.source === "road" ? "도로 대화" : status.source === "nearby" ? "주변 대화" : status.source === "direct" ? "1:1" : "대화 없음";
  el.hidden = false;
  el.innerHTML = `
    <button type="button" class="map-preview-close" aria-label="닫기">✕</button>
    <div class="map-preview-kind">차량</div>
    <b>${escapeHtml(user.nickname || "차량")}</b>
    <div class="muted">Lv.${Number(user.level) || 1} · ${dist != null ? `${dist}m` : "거리 —"} · ${escapeHtml(bearingLabel(user.heading))} · ${user.online === false ? "오프라인" : "온라인"}</div>
    <div class="muted">${escapeHtml(srcLabel)}${unread ? ` · 읽지 않음 ${unread}` : ""}</div>
    <div class="map-preview-msg">${status.lastMessage ? `“${escapeHtml(String(status.lastMessage).slice(0, 80))}”` : "최근 공간 메시지 없음"}</div>
    <div class="convo-actions">
      <button type="button" class="primary" data-act="chat">대화방에서 열기</button>
      <button type="button" class="secondary" data-act="direct">1:1 대화</button>
      <button type="button" class="secondary" data-act="horn">빵빵</button>
      <button type="button" class="secondary" data-act="gift">선물</button>
      <button type="button" class="secondary" data-act="report">신고</button>
      <button type="button" class="secondary" data-act="block">차단</button>
    </div>`;
  el.querySelector(".map-preview-close").onclick = () => {
    selectedPreviewUserId = null;
    el.hidden = true;
    drawUsers(markerMode);
  };
  el.querySelectorAll("[data-act]").forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.act;
      if (act === "chat") {
        const cid =
          status.source === "road"
            ? stateRef.roadChat?.session?.conversationId || "road-session-current"
            : status.source === "nearby"
              ? stateRef.nearbyChat?.session?.conversationId || "nearby-session-current"
              : user.id;
        const ui = ensureConversationUi(stateRef);
        ui.activeConversationId = cid;
        ui.returnView = document.body.dataset.mapView || "near";
        emit("state:save");
        openConversationInChat(cid, { returnView: ui.returnView });
      } else if (act === "direct") {
        emit("chat:open", user);
      } else if (act === "horn") {
        emit("user:horn", { id: user.id });
      } else if (act === "gift") {
        emit("shop:openGift", { id: user.id, nickname: user.nickname || user.id });
      } else if (act === "report") {
        showSystemMessage("신고는 서버 연동 후 처리됩니다. (긴급신고 서비스가 아닙니다)");
      } else if (act === "block") {
        if (!Array.isArray(stateRef.blockedUserIds)) stateRef.blockedUserIds = [];
        if (!stateRef.blockedUserIds.includes(user.id)) stateRef.blockedUserIds.push(user.id);
        emit("state:save");
        showSystemMessage("차단 목록에 추가했습니다.");
        selectedPreviewUserId = null;
        el.hidden = true;
        drawUsers(markerMode);
      }
    };
  });
}

function hidePlacePreviewCard() {
  document.querySelectorAll("#mapPlacePreview").forEach((el) => {
    el.hidden = true;
  });
}

function showPlacePreviewCard(place) {
  if (!place) return;
  selectedPreviewPlaceId = place.id;
  selectedPreviewUserId = null;
  document.querySelectorAll("#mapVehiclePreview").forEach((el) => {
    el.hidden = true;
  });
  drawUsers(markerMode);
  refreshLabels();
  const host = document.body.dataset.mapView === "all"
    ? document.querySelector("#allMapPane")
    : document.querySelector("#mapView");
  if (!host) return;
  let el = host.querySelector("#mapPlacePreview");
  if (!el) {
    el = document.createElement("div");
    el.id = "mapPlacePreview";
    el.className = "map-place-preview";
    host.appendChild(el);
  }
  const meta = normalizePlaceMeta(place);
  const cat = categoryLabel(meta.category);
  const kind = kindLabel(meta.kind);
  el.hidden = false;
  el.innerHTML = `
    <button type="button" class="map-preview-close" aria-label="닫기">✕</button>
    <div class="map-preview-kind">${escapeHtml(kind)} · ${escapeHtml(cat)}</div>
    <div class="map-place-preview-icon">${categorySvg(meta.category)}</div>
    <b>${escapeHtml(normalizePlaceName(meta.name))}</b>
    <div class="muted">${escapeHtml(meta.subtitle || "등록 장소")}</div>
    <div class="muted">위도 ${Number(meta.lat).toFixed(5)} · 경도 ${Number(meta.lng).toFixed(5)}</div>
    <div class="convo-actions">
      <button type="button" class="primary" data-place-act="route">길찾기</button>
      <button type="button" class="secondary" data-place-act="favorite">즐겨찾기</button>
      <button type="button" class="secondary" data-place-act="share">공유</button>
      <button type="button" class="secondary" data-place-act="detail">상세</button>
    </div>`;
  el.querySelector(".map-preview-close").onclick = () => {
    selectedPreviewPlaceId = null;
    el.hidden = true;
    refreshLabels();
  };
  el.querySelectorAll("[data-place-act]").forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.placeAct;
      if (act === "route") {
        showSystemMessage("길찾기는 경로 API 연동 후 이용할 수 있습니다.");
      } else if (act === "favorite") {
        showSystemMessage("즐겨찾기는 로컬 저장 연동 준비 중입니다.");
      } else if (act === "share") {
        showSystemMessage("공유 기능은 서버 연동 후 이용할 수 있습니다.");
      } else if (act === "detail") {
        emit("place:open", { ...meta, name: normalizePlaceName(meta.name) });
      }
    };
  });
}

function placeMarkerHtml(place, zoom) {
  const meta = normalizePlaceMeta(place);
  const detail = zoomDetailLevel(zoom);
  const selected = selectedPreviewPlaceId === meta.id;
  const title = escapeHtml(normalizePlaceName(meta.name));
  const cat = categoryLabel(meta.category);
  const kind = meta.kind;
  const svg =
    kind === "road_label"
      ? PLACE_CATEGORY_SVG.road
      : kind === "area_label"
        ? PLACE_CATEGORY_SVG.area
        : categorySvg(meta.category);

  if (kind === "road_label") {
    return {
      className: "vroo-marker-wrap",
      html: `<div class="vroo-marker vroo-marker--road ${selected ? "is-selected" : ""}" role="img" aria-label="도로 정보, ${title}">
        <b>${title}</b>
      </div>`,
      size: [110, 28],
      anchor: [55, 14],
      interactive: false
    };
  }
  if (kind === "area_label") {
    return {
      className: "vroo-marker-wrap",
      html: `<div class="vroo-marker vroo-marker--area ${selected ? "is-selected" : ""}" role="img" aria-label="지역 정보, ${title}">
        <b>${title}</b>
      </div>`,
      size: [88, 28],
      anchor: [44, 14],
      interactive: false
    };
  }

  const isLandmark = kind === "landmark";
  const mod = isLandmark ? "landmark" : "place";
  const showSub = detail === "high" && meta.subtitle;
  const showCat = detail !== "low";
  return {
    className: "vroo-marker-wrap",
    html: `<div class="vroo-marker vroo-marker--${mod} cat-${escapeHtml(meta.category)} ${selected ? "is-selected" : ""}" role="button" tabindex="0" aria-label="${escapeHtml(cat)}, ${title}" aria-selected="${selected}">
      <div class="vroo-marker-pin" aria-hidden="true">${svg}</div>
      <div class="vroo-marker-sign">
        ${showCat ? `<span class="vroo-marker-kind">${escapeHtml(isLandmark ? "이정표" : cat)}</span>` : ""}
        <b>${title}</b>
        ${showSub ? `<span class="vroo-marker-sub">${escapeHtml(meta.subtitle)}</span>` : ""}
      </div>
    </div>`,
    size: [detail === "low" ? 44 : 168, detail === "high" ? 64 : detail === "low" ? 44 : 52],
    anchor: [detail === "low" ? 22 : 28, detail === "low" ? 40 : 48],
    interactive: true
  };
}

function collisionOffset(index) {
  const ring = Math.floor(index / 4) + 1;
  const corner = index % 4;
  const step = 0.00012 * ring;
  const dx = corner === 1 || corner === 2 ? step : corner === 3 ? -step : 0;
  const dy = corner === 0 || corner === 1 ? step : corner === 2 ? -step : -step * 0.5;
  return { lat: dy, lng: dx };
}

function drawPlaceLabels(targetMap, targetLayer) {
  targetLayer.clearLayers();
  const prefs = ensureMapLayerPrefs();
  if (!prefs.labelsVisible && prefs.filterMode !== "place") return;
  const zoom = targetMap.getZoom();
  const bounds = targetMap.getBounds().pad(0.3);
  let idx = 0;
  for (const raw of placesForZoomDetail(zoom)) {
    const place = normalizePlaceMeta(raw);
    if (!placePassesFilter(place, prefs)) continue;
    let lat = place.lat;
    let lng = place.lng;
    const off = collisionOffset(idx);
    lat += off.lat;
    lng += off.lng;
    const latlng = L.latLng(lat, lng);
    if (!bounds.contains(latlng)) continue;
    const pack = placeMarkerHtml(place, zoom);
    const selected = selectedPreviewPlaceId === place.id;
    const marker = L.marker(latlng, {
      icon: L.divIcon({
        className: pack.className,
        html: pack.html,
        iconSize: pack.size,
        iconAnchor: pack.anchor
      }),
      interactive: pack.interactive,
      keyboard: pack.interactive,
      zIndexOffset: zOffsetForKind(place.kind, selected),
      opacity: place.kind === "road_label" || place.kind === "area_label" ? 0.92 : 1
    });
    if (pack.interactive) {
      marker.on("click", () => {
        if (place.kind === "road_label" || place.kind === "area_label") return;
        showPlacePreviewCard(place);
      });
    }
    marker.addTo(targetLayer);
    idx += 1;
  }
}

function refreshLabels() {
  try {
    if (map && placeLabelLayer) drawPlaceLabels(map, placeLabelLayer);
  } catch (e) {
    warnRare("[VROO map] labels near", e);
  }
  try {
    if (allMap && allPlaceLabelLayer) drawPlaceLabels(allMap, allPlaceLabelLayer);
  } catch (e) {
    warnRare("[VROO map] labels all", e);
  }
}

function ensureMapLegendUi() {
  const host = document.querySelector("#mapView");
  if (!host || host.querySelector("#mapLegend")) return;
  const wrap = document.createElement("div");
  wrap.id = "mapLegend";
  wrap.className = "map-legend";
  wrap.innerHTML = `
    <button type="button" class="map-legend-toggle" id="mapLegendToggle" aria-expanded="false" aria-controls="mapLegendPanel">지도 표시</button>
    <div id="mapLegendPanel" class="map-legend-panel" hidden>
      <div class="map-legend-title">표시 필터</div>
      <div class="map-legend-filters" role="group" aria-label="객체 유형 필터">
        <button type="button" class="secondary" data-map-filter="all" aria-pressed="true">전체</button>
        <button type="button" class="secondary" data-map-filter="vehicle" aria-pressed="false">차량</button>
        <button type="button" class="secondary" data-map-filter="place" aria-pressed="false">등록지점</button>
        <button type="button" class="secondary" data-map-filter="spatial" aria-pressed="false">공간 메시지</button>
      </div>
      <div class="map-legend-title">레이어</div>
      <div class="map-legend-layers">
        <label><input type="checkbox" data-layer="showVehicles" checked /> 차량</label>
        <label><input type="checkbox" data-layer="showPlaces" checked /> 등록지점</label>
        <label><input type="checkbox" data-layer="showLandmarks" checked /> 주요 이정표</label>
        <label><input type="checkbox" data-layer="showSpatial" checked /> 공간 메시지</label>
        <label><input type="checkbox" data-layer="showRoadLabels" checked /> 도로 정보</label>
        <label><input type="checkbox" data-layer="showAreaLabels" checked /> 지역 정보</label>
      </div>
      <div class="map-legend-swatches" aria-hidden="true">
        <span class="sw sw-vehicle">차량</span>
        <span class="sw sw-place">등록지점</span>
        <span class="sw sw-landmark">이정표</span>
        <span class="sw sw-spatial">공간</span>
        <span class="sw sw-road">도로</span>
      </div>
    </div>`;
  host.appendChild(wrap);
  const toggle = wrap.querySelector("#mapLegendToggle");
  const panel = wrap.querySelector("#mapLegendPanel");
  toggle.onclick = () => {
    legendOpen = !legendOpen;
    panel.hidden = !legendOpen;
    toggle.setAttribute("aria-expanded", String(legendOpen));
  };
  wrap.querySelectorAll("[data-map-filter]").forEach((b) => {
    b.onclick = () => {
      const prefs = ensureMapLayerPrefs();
      prefs.filterMode = b.dataset.mapFilter;
      saveMapPrefs();
      syncLegendUi();
      drawUsers(markerMode);
      refreshLabels();
      refreshSpatialOverlays();
    };
  });
  wrap.querySelectorAll("[data-layer]").forEach((inp) => {
    inp.onchange = () => {
      const prefs = ensureMapLayerPrefs();
      prefs[inp.dataset.layer] = inp.checked;
      if (inp.dataset.layer === "showRoadLabels" || inp.dataset.layer === "showAreaLabels" || inp.dataset.layer === "showPlaces" || inp.dataset.layer === "showLandmarks") {
        prefs.labelsVisible = prefs.showPlaces || prefs.showLandmarks || prefs.showRoadLabels || prefs.showAreaLabels;
        labelsVisible = prefs.labelsVisible;
        const labelButton = document.querySelector("#labelToggleButton");
        if (labelButton) {
          labelButton.classList.toggle("active", labelsVisible);
          labelButton.textContent = labelsVisible ? "지명 ON" : "지명 OFF";
        }
      }
      saveMapPrefs();
      drawUsers(markerMode);
      refreshLabels();
      refreshSpatialOverlays();
    };
  });
  if (!legendOutsideBound) {
    legendOutsideBound = true;
    document.addEventListener("pointerdown", (e) => {
      if (!legendOpen) return;
      const box = document.querySelector("#mapLegend");
      if (box && !box.contains(e.target)) {
        legendOpen = false;
        const p = box.querySelector("#mapLegendPanel");
        const t = box.querySelector("#mapLegendToggle");
        if (p) p.hidden = true;
        if (t) t.setAttribute("aria-expanded", "false");
      }
    });
  }
  syncLegendUi();
}

function syncLegendUi() {
  const prefs = ensureMapLayerPrefs();
  const wrap = document.querySelector("#mapLegend");
  if (!wrap) return;
  wrap.querySelectorAll("[data-map-filter]").forEach((b) => {
    const on = b.dataset.mapFilter === prefs.filterMode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  wrap.querySelectorAll("[data-layer]").forEach((inp) => {
    inp.checked = prefs[inp.dataset.layer] !== false;
  });
}

function syncSpatialOverlays(targetMap, layer) {
  if (!targetMap || !layer || !stateRef) return;
  layer.clearLayers();
  const prefs = ensureMapLayerPrefs();
  if (!prefs.showSpatial || prefs.filterMode === "vehicle" || prefs.filterMode === "place") return;
  pruneSpatialOverlays(stateRef);
  const zoom = targetMap.getZoom();
  const pack = getActiveSpatialOverlays(stateRef, zoom);
  const me = stateRef.location;
  if (pack.mode === "situation_cluster" || pack.mode === "cluster") {
    const clusters = Array.isArray(pack.situationClusters) ? pack.situationClusters : [];
    if (clusters.length && me) {
      let offset = 0;
      for (const c of clusters.slice(0, 6)) {
        const ago = c.lastReportedAt
          ? Math.max(0, Math.round((Date.now() - Number(c.lastReportedAt)) / 60000))
          : null;
        const agoLabel = ago == null ? "" : ago < 1 ? "방금" : `${ago}분 전`;
        const sev = c.severity || "warning";
        L.marker([me.lat + offset * 0.00018, me.lng + offset * 0.00012], {
          icon: L.divIcon({
            className: `vroo-marker-wrap spatial-overlay-cluster sev-${sev}`,
            html: `<div class="vroo-marker vroo-marker--spatial-message spatial-cluster-badge" aria-label="공간 메시지, ${escapeHtml(c.label || c.category)} ${c.confirmationCount}명 확인">
              <b>${escapeHtml(c.label || c.category)}</b>
              <span>${c.confirmationCount}명 확인</span>
              ${agoLabel ? `<span class="muted">${escapeHtml(agoLabel)}</span>` : ""}
            </div>`,
            iconSize: [130, 48],
            iconAnchor: [65, 24]
          }),
          interactive: true,
          zIndexOffset: zOffsetForKind("spatial_message") + offset
        })
          .on("click", () =>
            openConversationInChat(stateRef.roadChat?.session?.conversationId || "road-session-current")
          )
          .addTo(layer);
        offset += 1;
      }
      return;
    }
    if (pack.count > 0 && me) {
      L.marker([me.lat, me.lng], {
        icon: L.divIcon({
          className: "vroo-marker-wrap spatial-overlay-cluster",
          html: `<div class="vroo-marker vroo-marker--spatial-message spatial-cluster-badge">최근 공간 메시지 ${pack.count}</div>`,
          iconSize: [140, 28],
          iconAnchor: [70, 14]
        }),
        interactive: true,
        zIndexOffset: zOffsetForKind("spatial_message")
      })
        .on("click", () =>
          openConversationInChat(stateRef.roadChat?.session?.conversationId || "road-session-current")
        )
        .addTo(layer);
    }
    return;
  }
  const clusters = Array.isArray(pack.situationClusters) ? pack.situationClusters : [];
  if (clusters.length && me && clusters.some((c) => c.confirmationCount >= 2)) {
    const top = [...clusters].sort((a, b) => b.confirmationCount - a.confirmationCount)[0];
    L.marker([me.lat + 0.00025, me.lng], {
      icon: L.divIcon({
        className: "vroo-marker-wrap spatial-overlay-cluster",
        html: `<div class="vroo-marker vroo-marker--spatial-message spatial-cluster-badge"><b>${escapeHtml(top.label)}</b> ${top.confirmationCount}명 확인</div>`,
        iconSize: [130, 36],
        iconAnchor: [65, 18]
      }),
      interactive: true,
      zIndexOffset: zOffsetForKind("spatial_message") + 20
    })
      .on("click", () =>
        openConversationInChat(stateRef.roadChat?.session?.conversationId || "road-session-current")
      )
      .addTo(layer);
  }
  for (const item of pack.items) {
    const uid = item.anchorVehicleId;
    const u = users.find((x) => String(x.id) === String(uid));
    let lat = stateRef.location?.lat;
    let lng = stateRef.location?.lng;
    if (u) {
      lat = u.lat;
      lng = u.lng;
    } else if (String(uid) === String(MY_USER_ID)) {
      lat = stateRef.location?.lat;
      lng = stateRef.location?.lng;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const pri = item.spatialPriority || "normal";
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: `vroo-marker-wrap spatial-overlay-bubble pri-${pri}`,
        html: `<div class="vroo-marker vroo-marker--spatial-message spatial-bubble"><span class="spatial-bubble-tag">${pri === "urgent" ? "주의" : pri === "warning" ? "안내" : "공간"}</span>${escapeHtml(item.body)}</div>`,
        iconSize: [160, 44],
        iconAnchor: [80, 48]
      }),
      interactive: true,
      zIndexOffset: zOffsetForKind("spatial_message")
    })
      .on("click", () => openConversationInChat(item.conversationId || "road-session-current"))
      .addTo(layer);
  }
}

function refreshSpatialOverlays() {
  clearTimeout(spatialBubbleExpiryTimer);
  try {
    if (map && spatialOverlayLayerNear) syncSpatialOverlays(map, spatialOverlayLayerNear);
  } catch (e) {
    warnRare("[VROO map] spatial near", e);
  }
  try {
    if (allMap && spatialOverlayLayerAll) syncSpatialOverlays(allMap, spatialOverlayLayerAll);
  } catch (e) {
    warnRare("[VROO map] spatial all", e);
  }
  const nextExpiry = (stateRef?.spatialMessageOverlays || [])
    .map((item) => Number(item.bubbleVisibleUntil) || (Number(item.createdAt) || 0) + 5_000)
    .filter((expiresAt) => expiresAt > Date.now())
    .sort((a, b) => a - b)[0];
  if (nextExpiry) {
    spatialBubbleExpiryTimer = setTimeout(
      refreshSpatialOverlays,
      Math.max(20, nextExpiry - Date.now() + 20)
    );
  }
}

function convoIndicatorHtml(statusInfo) {
  const st = statusInfo?.status || "no_conversation";
  if (st === "no_conversation" || st === "muted") return "";
  if (st === "blocked") {
    return `<span class="map-convo-ind blocked" title="차단">✕</span>`;
  }
  const unread = Math.max(0, Number(statusInfo.unread) || 0);
  const urgent = st === "urgent" ? " urgent" : "";
  const active = st === "active" || st === "unread" || st === "urgent" ? " active" : "";
  const badge = unread > 0 ? `<span class="map-convo-badge">${unread > 9 ? "9+" : unread}</span>` : "";
  return `<span class="map-convo-ind${active}${urgent}" aria-hidden="true">${badge || "·"}</span>`;
}

function createBasemap(targetMap) {
  return L.tileLayer(BASEMAP_URL, BASEMAP_OPTIONS).addTo(targetMap);
}

function runProgrammatic(fn) {
  programmaticMoveDepth += 1;
  try {
    fn();
  } finally {
    setTimeout(() => {
      programmaticMoveDepth = Math.max(0, programmaticMoveDepth - 1);
    }, 0);
  }
}

function onUserMapInteract() {
  if (programmaticMoveDepth > 0) return;
  userMovedMap = true;
  awaitingFirstGpsCenter = false;
}

function bindUserInteraction(targetMap) {
  targetMap.on("dragstart", onUserMapInteract);
  targetMap.on("zoomstart", onUserMapInteract);
}

function syncUserMarkerMap(store, layer, list) {
  const prefs = ensureMapLayerPrefs();
  const seen = new Set();
  for (const user of list) {
    if (!vehiclePassesFilter(user, prefs)) continue;
    seen.add(user.id);
    const selected = selectedPreviewUserId === user.id;
    let marker = store.get(user.id);
    if (!marker) {
      marker = L.marker([user.lat, user.lng], {
        icon: iconFor(user),
        zIndexOffset: zOffsetForKind("vehicle", selected)
      })
        .on("click", () => {
          const fresh = users.find((u) => u.id === user.id) || user;
          showVehiclePreviewCard(fresh);
        })
        .addTo(layer);
      store.set(user.id, marker);
    } else {
      marker.setLatLng([user.lat, user.lng]);
      marker.setIcon(iconFor(user));
      marker.setZIndexOffset(zOffsetForKind("vehicle", selected));
    }
  }
  for (const [id, marker] of store) {
    if (seen.has(id)) continue;
    layer.removeLayer(marker);
    store.delete(id);
  }
}

function syncMeMarker(which) {
  const latlng = [stateRef.location.lat, stateRef.location.lng];
  const icon = myLocationIcon();
  if (which === "near") {
    if (!meMarkerNear) {
      meMarkerNear = L.marker(latlng, { icon, zIndexOffset: zOffsetForKind("my_location") }).addTo(markerLayer);
    } else {
      meMarkerNear.setLatLng(latlng);
      meMarkerNear.setIcon(icon);
      meMarkerNear.setZIndexOffset(zOffsetForKind("my_location"));
    }
  } else {
    if (!meMarkerAll) {
      meMarkerAll = L.marker(latlng, { icon, zIndexOffset: zOffsetForKind("my_location") }).addTo(allLayer);
    } else {
      meMarkerAll.setLatLng(latlng);
      meMarkerAll.setIcon(icon);
      meMarkerAll.setZIndexOffset(zOffsetForKind("my_location"));
    }
  }
}

function notifyUsersChanged() {
  try {
    emit("users:changed", users);
  } catch (e) {
    warnRare("[VROO map] users:changed", e);
  }
}

/**
 * 강조 규칙 (겹침 시):
 * - 내 GRID+선택: 녹색 단일 테두리(중복 두꺼움 방지) + 약한 청 채움
 * - 테두리: 선택(청) > 내 GRID(녹) > 현재 위치(금) > 일반
 * - 채움: 현재 위치 > 내 GRID > 선택 > 일반
 * 일반 셀도 Black & Gold 톤으로 경계가 보이도록 유지.
 */
function styleForCell(cellId) {
  const locId = stateRef?.locationGridId;
  const curId = stateRef?.currentGridId;
  const selId = stateRef?.selectedGridId;
  const isLoc = !!(locId && cellCoversGridId(cellId, locId));
  const isCur = !!(isSpatialGridId(curId) && cellCoversGridId(cellId, curId));
  const isSel = !!(selId && cellCoversGridId(cellId, selId));
  const isMineSelected = isCur && isSel;

  let fillColor = "#0b1018";
  let fillOpacity = 0.03;
  if (isLoc) {
    fillColor = "#ffc400";
    fillOpacity = 0.13;
  } else if (isMineSelected) {
    fillColor = "#2ca9ff";
    fillOpacity = 0.08;
  } else if (isCur) {
    fillColor = "#50df78";
    fillOpacity = 0.07;
  } else if (isSel) {
    fillColor = "#2ca9ff";
    fillOpacity = 0.06;
  }

  let color = "#c9a227";
  let weight = 2;
  let opacity = 0.92;
  if (isMineSelected) {
    color = "#50df78";
    weight = 3.25;
    opacity = 1;
  } else if (isSel) {
    color = "#2ca9ff";
    weight = 3.5;
    opacity = 1;
  } else if (isCur) {
    color = "#50df78";
    weight = 3;
    opacity = 1;
  } else if (isLoc) {
    color = "#ffc400";
    weight = 2.75;
    opacity = 1;
  }

  return {
    color,
    weight,
    opacity,
    fillColor,
    fillOpacity,
    fill: true,
    stroke: true,
    lineJoin: "miter",
    lineCap: "butt"
  };
}

function occupantCount(cellId) {
  if (!cellId || !cellId.includes(":L3:")) return 0;
  let n = 0;
  for (const u of users) {
    if (!Number.isFinite(u.lat) || !Number.isFinite(u.lng)) continue;
    const cell = getGridCellFromLatLng(u.lat, u.lng, ACTIVE_GRID_LEVEL);
    if (cell?.id === cellId) n++;
  }
  if (stateRef?.location && stateRef.locationGridId === cellId) n += 1;
  return n;
}

function ensureSpatialPane(targetMap) {
  if (!targetMap.getPane("spatialGridPane")) {
    targetMap.createPane("spatialGridPane");
    const pane = targetMap.getPane("spatialGridPane");
    pane.classList.add("spatial-grid-pane");
    pane.style.zIndex = 450;
  }
  if (!targetMap._vrooGridRenderer) {
    targetMap._vrooGridRenderer = L.svg({pane: "spatialGridPane", padding: 0.5});
  }
  return targetMap._vrooGridRenderer;
}

function bindDragGuard(targetMap) {
  if (targetMap._vrooDragGuard) return;
  targetMap._vrooDragGuard = true;
  targetMap.on("dragstart", () => {
    targetMap._vrooSuppressGridClick = true;
  });
  targetMap.on("dragend", () => {
    setTimeout(() => {
      targetMap._vrooSuppressGridClick = false;
    }, 80);
  });
}

function updateDebugHud(info) {
  if (!DEBUG_SPATIAL_GRID) {
    if (debugHudEl) {
      debugHudEl.remove();
      debugHudEl = null;
    }
    return;
  }
  if (!debugHudEl) {
    debugHudEl = document.createElement("div");
    debugHudEl.className = "vroo-spatial-debug";
    document.querySelector(".stage-body")?.appendChild(debugHudEl);
  }
  const line = [
    `[SpatialGrid] zoom=${info.zoom}`,
    `preferred=${info.preferredLevel}`,
    `resolved=${info.level}`,
    `estimated=${info.estimated}`,
    `created=${info.created}`,
    `x=${info.ixMin}..${info.ixMax}`,
    `y=${info.iyMin}..${info.iyMax}`
  ].join(" ");
  debugHudEl.textContent = line;
  console.debug(line, {
    unclamped: info.unclamped,
    clamped: info.clamped,
    locationGridId: info.locationGridId,
    selectedGridId: info.selectedGridId,
    currentGridId: info.currentGridId
  });
}

function syncSpatialGridsOn(targetMap, layerMap, badgeMap) {
  if (!mapReady || !targetMap || !spatialGridVisible || spatialGridPaused) return;
  try {
    bindDragGuard(targetMap);
    const renderer = ensureSpatialPane(targetMap);
    const bounds = targetMap.getBounds();
    const zoom = targetMap.getZoom();
    const lastLv = lastDisplayLevelByMap.get(targetMap) || null;
    const preferred = levelForMapZoom(zoom, lastLv);
    const result = getVisibleGridCells(bounds, preferred);
    const {cells, level} = result;
    lastDisplayLevelByMap.set(targetMap, level);
    const seen = new Set();

    if (DEBUG_SPATIAL_GRID && targetMap === map) {
      updateDebugHud({
        zoom: Number(zoom?.toFixed?.(2) ?? zoom),
        preferredLevel: result.preferredLevel || preferred,
        level,
        estimated: result.estimated ?? cells.length,
        created: result.created ?? cells.length,
        ixMin: result.ixMin,
        ixMax: result.ixMax,
        iyMin: result.iyMin,
        iyMax: result.iyMax,
        unclamped: result.unclamped,
        clamped: result.clamped,
        locationGridId: stateRef?.locationGridId,
        selectedGridId: stateRef?.selectedGridId,
        currentGridId: stateRef?.currentGridId
      });
    }

    for (const cell of cells) {
      seen.add(cell.id);
      let rect = layerMap.get(cell.id);
      const pathOpts = {
        ...styleForCell(cell.id),
        interactive: true,
        bubblingMouseEvents: true,
        className: "vroo-spatial-grid",
        pane: "spatialGridPane",
        renderer
      };
      const latlngs = [
        [cell.south, cell.west],
        [cell.south, cell.east],
        [cell.north, cell.east],
        [cell.north, cell.west]
      ];
      if (!rect) {
        rect = L.polygon(latlngs, pathOpts);
        rect.on("click", e => {
          try {
            if (targetMap._vrooSuppressGridClick) return;
            L.DomEvent.stopPropagation(e);
            const lat = Number(e?.latlng?.lat ?? cell.center.lat);
            const lng = Number(e?.latlng?.lng ?? cell.center.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              showSystemMessage("GRID 좌표를 확인할 수 없습니다.");
              return;
            }
            const localId = localGridIdFromLatLng(lat, lng);
            if (!localId) {
              showSystemMessage("이 위치의 Spatial GRID를 계산할 수 없습니다.");
              return;
            }
            if (stateRef) stateRef.selectedGridId = localId;
            emit("grid:spatialOpen", {gridId: localId});
            refreshSpatialGridStyles();
          } catch (err) {
            warnRare("[VROO map] grid click", err);
          }
        });
        rect.addTo(targetMap);
        layerMap.set(cell.id, rect);
      } else {
        rect.setLatLngs(latlngs);
        rect.setStyle(pathOpts);
      }

      const count = occupantCount(cell.id);
      let badge = badgeMap.get(cell.id);
      if (count > 0 && cell.level === "L3") {
        if (!badge) {
          badge = L.marker(cell.center, {
            interactive: false,
            keyboard: false,
            zIndexOffset: 200,
            icon: L.divIcon({
              className: "vroo-grid-count",
              html: `<span>${count}</span>`,
              iconSize: [22, 18],
              iconAnchor: [11, 9]
            })
          }).addTo(targetMap);
          badgeMap.set(cell.id, badge);
        } else {
          badge.setLatLng(cell.center);
          badge.setIcon(
            L.divIcon({
              className: "vroo-grid-count",
              html: `<span>${count}</span>`,
              iconSize: [22, 18],
              iconAnchor: [11, 9]
            })
          );
        }
      } else if (badge) {
        targetMap.removeLayer(badge);
        badgeMap.delete(cell.id);
      }
    }

    for (const [id, rect] of layerMap) {
      if (seen.has(id)) continue;
      targetMap.removeLayer(rect);
      layerMap.delete(id);
      const badge = badgeMap.get(id);
      if (badge) {
        targetMap.removeLayer(badge);
        badgeMap.delete(id);
      }
    }
  } catch (e) {
    warnRare("[VROO map] spatial grids", e);
  }
}

function refreshSpatialGridStyles() {
  for (const [id, rect] of visibleGridLayersNear) {
    try {
      rect.setStyle(styleForCell(id));
    } catch {
      /* ignore */
    }
  }
  for (const [id, rect] of visibleGridLayersAll) {
    try {
      rect.setStyle(styleForCell(id));
    } catch {
      /* ignore */
    }
  }
}

export function refreshSpatialGrids() {
  if (!mapReady || !spatialGridVisible || spatialGridPaused) {
    if (!spatialGridVisible || spatialGridPaused) clearSpatialGridLayers();
    return;
  }
  if (map) syncSpatialGridsOn(map, visibleGridLayersNear, countBadgeNear);
  if (allMap) syncSpatialGridsOn(allMap, visibleGridLayersAll, countBadgeAll);
}

export function refreshSpatialGrid() {
  refreshSpatialGrids();
}

function scheduleSpatialRefresh() {
  if (!spatialGridVisible || spatialGridPaused) return;
  clearTimeout(spatialRefreshTimer);
  spatialRefreshTimer = setTimeout(() => refreshSpatialGrids(), 120);
}

function bindSpatialGridEvents() {
  if (spatialGridBound || !map || !allMap) return;
  spatialGridBound = true;
  map.on("moveend zoomend", scheduleSpatialRefresh);
  allMap.on("moveend zoomend", scheduleSpatialRefresh);
  window.addEventListener("resize", scheduleSpatialRefresh);
}

function clearSpatialGridLayers() {
  clearTimeout(spatialRefreshTimer);
  for (const [id, rect] of visibleGridLayersNear) {
    try {
      map?.removeLayer(rect);
    } catch {
      /* ignore */
    }
    visibleGridLayersNear.delete(id);
  }
  for (const [id, rect] of visibleGridLayersAll) {
    try {
      allMap?.removeLayer(rect);
    } catch {
      /* ignore */
    }
    visibleGridLayersAll.delete(id);
  }
  for (const [id, b] of countBadgeNear) {
    try {
      map?.removeLayer(b);
    } catch {
      /* ignore */
    }
    countBadgeNear.delete(id);
  }
  for (const [id, b] of countBadgeAll) {
    try {
      allMap?.removeLayer(b);
    } catch {
      /* ignore */
    }
    countBadgeAll.delete(id);
  }
  try {
    gridOverlayLayer?.clearLayers();
  } catch {
    /* ignore */
  }
  if (DEBUG_SPATIAL_GRID && debugHudEl) {
    debugHudEl.remove();
    debugHudEl = null;
  }
}

/**
 * 상단 메인 메뉴 “그리드” 선택 시에만 Spatial GRID Leaflet 레이어 표시.
 * locationGridId 등 계산 상태는 유지한다.
 */
export function setSpatialGridVisible(visible) {
  spatialGridVisible = !!visible;
  if (!spatialGridVisible) {
    clearSpatialGridLayers();
    return;
  }
  if (!spatialGridPaused) refreshSpatialGrids();
}

export function showSpatialGrid() {
  setSpatialGridVisible(true);
}

export function hideSpatialGrid() {
  setSpatialGridVisible(false);
}

/** @deprecated setSpatialGridVisible 사용 — 호환 유지 */
export function setSpatialGridEnabled(on) {
  setSpatialGridVisible(on);
}

function updateLocationGridId(location) {
  if (!stateRef || !location) return;
  try {
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const cell = getGridCellFromLatLng(lat, lng, ACTIVE_GRID_LEVEL);
    if (!cell?.id) return;
    const prev = stateRef.locationGridId;
    if (prev === cell.id) return;
    stateRef.locationGridId = cell.id;
    emit("grid:locationChanged", {gridId: cell.id, prev});
    if (spatialGridVisible && !spatialGridPaused) refreshSpatialGridStyles();
  } catch (e) {
    warnRare("[VROO map] locationGridId", e);
  }
}

export function isMapReady() {
  return mapReady;
}

export function initMap(state) {
  stateRef = state;

  if (mapReady) return;

  if (!window.L) {
    throw new Error("Leaflet을 불러오지 못했습니다.");
  }

  map = L.map("map", {
    zoomControl: true,
    preferCanvas: true
  }).setView([state.location.lat, state.location.lng], 16);

  createBasemap(map);
  markerLayer = L.layerGroup().addTo(map);
  placeLabelLayer = L.layerGroup().addTo(map);
  spatialOverlayLayerNear = L.layerGroup().addTo(map);

  allMap = L.map("allMap", {
    zoomControl: false,
    preferCanvas: true
  }).setView([state.location.lat, state.location.lng], 13);

  createBasemap(allMap);
  allLayer = L.layerGroup().addTo(allMap);
  allPlaceLabelLayer = L.layerGroup().addTo(allMap);
  spatialOverlayLayerAll = L.layerGroup().addTo(allMap);

  map.on("zoomend moveend", () => {
    refreshLabels();
    refreshSpatialOverlays();
    drawUsers(markerMode);
  });
  allMap.on("zoomend moveend", () => {
    refreshLabels();
    refreshSpatialOverlays();
    drawUsers(markerMode);
  });
  bindUserInteraction(map);
  bindUserInteraction(allMap);

  const locateButton = document.querySelector("#locateButton");
  if (locateButton) locateButton.onclick = () => locateMe();

  document.querySelector("#compassLeft").onclick = () => emit("map:rotate", -15);
  document.querySelector("#compassRight").onclick = () => emit("map:rotate", 15);
  document.querySelector("#northButton").onclick = () => emit("map:north");

  const labelButton = document.querySelector("#labelToggleButton");
  if (labelButton) {
    const prefs = ensureMapLayerPrefs(state);
    labelsVisible = prefs.labelsVisible !== false;
    labelButton.classList.toggle("active", labelsVisible);
    labelButton.textContent = labelsVisible ? "지명 ON" : "지명 OFF";
    labelButton.onclick = () => {
      const p = ensureMapLayerPrefs(state);
      p.labelsVisible = !p.labelsVisible;
      labelsVisible = p.labelsVisible;
      labelButton.classList.toggle("active", labelsVisible);
      labelButton.textContent = labelsVisible ? "지명 ON" : "지명 OFF";
      saveMapPrefs();
      refreshLabels();
    };
  }

  ensureMapLegendUi();

  mapReady = true;
  users = makeDemoUsers(state.location);
  updateLocationGridId(state.location);
  drawUsers("near");
  refreshLabels();
  bindSpatialGridEvents();
  // Spatial GRID는 상단 “그리드” 메뉴에서만 표시 — 부팅 시 레이어 생성 안 함
  notifyUsersChanged();
}

export function locateMe() {
  if (!mapReady || !map || !stateRef?.location) return;
  const {lat, lng} = stateRef.location;
  runProgrammatic(() => {
    try {
      map.setView([lat, lng], 16);
    } catch (e) {
      warnRare("[VROO map] locate near", e);
    }
    try {
      if (allMap) allMap.setView([lat, lng], allMap.getZoom());
    } catch (e) {
      warnRare("[VROO map] locate all", e);
    }
  });
  refreshLabels();
}

/**
 * GPS/위치 갱신.
 * 위치 값은 항상 state에 반영. 마커·데모유저·도로 동기화는 throttle.
 * 최초 GPS는 즉시 반영. 반환: 마커 렌더 수행 여부.
 */
export function setLocation(location, options = {}) {
  if (!stateRef) return false;
  stateRef.location = location;
  updateLocationGridId(location);

  const doRender = shouldRenderMarkers(location, options);
  if (!doRender) return false;

  lastRenderAt = Date.now();
  lastRenderLoc = {lat: location.lat, lng: location.lng};

  users = updateDemoUserPositions(users, location);

  if (mapReady && map && allMap) {
    const forceCenter = options.forceCenter === true;
    const shouldCenter =
      forceCenter || (awaitingFirstGpsCenter && !userMovedMap);

    if (shouldCenter) {
      runProgrammatic(() => {
        try {
          map.setView([location.lat, location.lng], 16);
        } catch (e) {
          warnRare("[VROO map] center near", e);
        }
        try {
          allMap.setView([location.lat, location.lng], 13);
        } catch (e) {
          warnRare("[VROO map] center all", e);
        }
      });
      if (!forceCenter) awaitingFirstGpsCenter = false;
    }

    drawUsers(markerMode);
    refreshLabels();
    scheduleSpatialRefresh();
  }

  notifyUsersChanged();
  return true;
}

export function getUsers() {
  return users;
}

export function drawUsers(mode = "near") {
  if (!mapReady || !markerLayer || !allLayer || !stateRef) return;
  markerMode = mode === "all" ? "all" : "near";

  const center = L.latLng(stateRef.location.lat, stateRef.location.lng);
  const visible =
    markerMode === "near"
      ? users.filter(user => center.distanceTo([user.lat, user.lng]) < 600)
      : users;

  try {
    syncUserMarkerMap(markersNear, markerLayer, visible);
    syncMeMarker("near");
  } catch (e) {
    warnRare("[VROO map] markers near", e);
  }

  try {
    syncUserMarkerMap(markersAll, allLayer, visible);
    syncMeMarker("all");
  } catch (e) {
    warnRare("[VROO map] markers all", e);
  }

  refreshSpatialOverlays();
}

export function setMapView(mode) {
  if (!mapReady || !map || !stateRef) return;

  drawUsers(mode === "all" ? "all" : "near");

  if (mode === "road") {
    spatialGridPaused = true;
    clearSpatialGridLayers();
  } else {
    spatialGridPaused = false;
    if (spatialGridVisible) scheduleSpatialRefresh();
  }

  runProgrammatic(() => {
    try {
      if (mode === "all" && allMap) {
        const c = map.getCenter();
        const z = map.getZoom();
        allMap.setView([c.lat, c.lng], z, {animate: false});
      } else if (lastMapViewMode === "all" && allMap && (mode === "near" || mode === "road")) {
        const c = allMap.getCenter();
        const z = allMap.getZoom();
        map.setView([c.lat, c.lng], z, {animate: false});
      }
    } catch (e) {
      warnRare("[VROO map] setMapView", e);
    }
  });

  lastMapViewMode = mode;
  refreshLabels();
}

export function invalidateMaps() {
  const run = () => {
    try {
      map?.invalidateSize({pan: false});
    } catch (e) {
      warnRare("[VROO map] invalidate near", e);
    }
    try {
      allMap?.invalidateSize({pan: false});
    } catch (e) {
      warnRare("[VROO map] invalidate all", e);
    }
    refreshLabels();
    scheduleSpatialRefresh();
  };
  requestAnimationFrame(() => {
    run();
    setTimeout(run, 50);
    setTimeout(run, 200);
  });
}

/**
 * GRID 중심 표시 — Spatial은 사각형 셀, Community는 호환용 원형.
 * GPS/유저 상태 초기화 없음.
 */
export function focusGridOnMap(grid) {
  if (!mapReady || !map || !grid) return;
  if (!spatialGridVisible || spatialGridPaused) return;

  try {
    if (!map.getPane("spatialFocusPane")) {
      map.createPane("spatialFocusPane");
      map.getPane("spatialFocusPane").style.zIndex = 460;
      map.getPane("spatialFocusPane").style.pointerEvents = "none";
    }
    if (!gridOverlayLayer) {
      gridOverlayLayer = L.layerGroup({pane: "spatialFocusPane"}).addTo(map);
    }
    gridOverlayLayer.clearLayers();
    gridOverlayId = grid.id || null;

    const spatialId =
      (grid.type === "spatial" && grid.id) ||
      (isSpatialGridId(grid.id) ? grid.id : null) ||
      (isSpatialGridId(grid.spatialId) ? grid.spatialId : null);

    if (spatialId) {
      const bounds = getGridBounds(spatialId);
      if (bounds) {
        L.polygon(
          [
            [bounds.south, bounds.west],
            [bounds.south, bounds.east],
            [bounds.north, bounds.east],
            [bounds.north, bounds.west]
          ],
          {
            color: "#2ca9ff",
            weight: 3.5,
            opacity: 1,
            fillColor: "#2ca9ff",
            fillOpacity: 0.1,
            interactive: false,
            pane: "spatialFocusPane",
            className: "vroo-spatial-focus"
          }
        ).addTo(gridOverlayLayer);

        if (stateRef) stateRef.selectedGridId = spatialId;
        refreshSpatialGridStyles();

        runProgrammatic(() => {
          map.fitBounds(
            [
              [bounds.south, bounds.west],
              [bounds.north, bounds.east]
            ],
            {padding: [40, 40], maxZoom: 16}
          );
          if (allMap) {
            allMap.fitBounds(
              [
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
              ],
              {padding: [24, 24], maxZoom: 14}
            );
          }
        });
        scheduleSpatialRefresh();
        return;
      }
    }

    const lat = Number(grid.center?.lat);
    const lng = Number(grid.center?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const radius = Math.max(200, Number(grid.radiusM) || 800);
    L.circle([lat, lng], {
      radius,
      color: "#ffc400",
      weight: 2,
      fillColor: "#ffc400",
      fillOpacity: 0.08,
      interactive: false,
      pane: "spatialFocusPane"
    }).addTo(gridOverlayLayer);

    runProgrammatic(() => {
      map.setView([lat, lng], 15);
      if (allMap) allMap.setView([lat, lng], 13);
    });
  } catch (e) {
    warnRare("[VROO map] focusGrid", e);
  }
}

/** Spatial 셀 ID만으로 지도 포커스 */
export function focusSpatialGridOnMap(gridId) {
  focusGridOnMap({id: gridId, type: "spatial"});
}

/** 주변·전체 지도 모두 동일 bearing 적용 */
export function rotateMap(bearing) {
  for (const sel of ["#map", "#allMap"]) {
    const element = document.querySelector(sel);
    if (!element) continue;
    element.style.transformOrigin = "50% 50%";
    element.style.transform = `rotate(${bearing}deg) scale(1.18)`;
  }
}

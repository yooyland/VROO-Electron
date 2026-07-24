import {emit} from "../core/events.js";
import {carInfo, makeDemoUsers, updateDemoUserPositions} from "./data.js";
import {placesForZoom, normalizePlaceName} from "./places.js";
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

let map;
let allMap;
let markerLayer;
let allLayer;
let placeLabelLayer;
let allPlaceLabelLayer;
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

function iconFor(user, me = false) {
  return L.divIcon({
    className: "",
    html: `<div style="text-align:center;filter:drop-shadow(0 4px 5px #000)">
      <div style="font-size:36px">${carInfo(me ? stateRef.profile.car : user.car).emoji}</div>
      <div style="background:#07101dea;border:1px solid ${me ? "#ffc400" : "#465465"};border-radius:8px;padding:4px 7px;font-size:11px;white-space:nowrap">
        <b>${me ? stateRef.profile.nickname : user.nickname}</b><br>
        Lv.${me ? stateRef.level : user.level}
      </div>
    </div>`,
    iconSize: [120, 70],
    iconAnchor: [60, 35]
  });
}

function placeClass(type) {
  return `vroo-place-label vroo-place-${type || "place"}`;
}

function placeIcon(place) {
  const title = normalizePlaceName(place.name);
  const subtitle = place.subtitle ? `<span>${place.subtitle}</span>` : "";
  return L.divIcon({
    className: "",
    html: `<div class="${placeClass(place.type)}">
      <i>${place.icon || "📍"}</i>
      <div><b>${title}</b>${subtitle}</div>
    </div>`,
    iconSize: [190, 52],
    iconAnchor: [95, 26]
  });
}

function drawPlaceLabels(targetMap, targetLayer) {
  targetLayer.clearLayers();
  if (!labelsVisible) return;
  const zoom = targetMap.getZoom();
  const bounds = targetMap.getBounds().pad(0.3);
  for (const place of placesForZoom(zoom)) {
    const latlng = L.latLng(place.lat, place.lng);
    if (!bounds.contains(latlng)) continue;
    L.marker(latlng, {
      icon: placeIcon(place),
      interactive: true,
      keyboard: false,
      zIndexOffset: 300
    })
      .on("click", () => {
        emit("place:open", {
          ...place,
          name: normalizePlaceName(place.name)
        });
      })
      .addTo(targetLayer);
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
  const seen = new Set();
  for (const user of list) {
    seen.add(user.id);
    let marker = store.get(user.id);
    if (!marker) {
      marker = L.marker([user.lat, user.lng], {icon: iconFor(user)})
        .on("click", () => emit("user:open", {id: user.id}))
        .addTo(layer);
      store.set(user.id, marker);
    } else {
      marker.setLatLng([user.lat, user.lng]);
      marker.setIcon(iconFor(user));
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
  const icon = iconFor({}, true);
  if (which === "near") {
    if (!meMarkerNear) {
      meMarkerNear = L.marker(latlng, {icon, zIndexOffset: 1000}).addTo(markerLayer);
    } else {
      meMarkerNear.setLatLng(latlng);
      meMarkerNear.setIcon(icon);
    }
  } else {
    if (!meMarkerAll) {
      meMarkerAll = L.marker(latlng, {icon, zIndexOffset: 1000}).addTo(allLayer);
    } else {
      meMarkerAll.setLatLng(latlng);
      meMarkerAll.setIcon(icon);
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

  allMap = L.map("allMap", {
    zoomControl: false,
    preferCanvas: true
  }).setView([state.location.lat, state.location.lng], 13);

  createBasemap(allMap);
  allLayer = L.layerGroup().addTo(allMap);
  allPlaceLabelLayer = L.layerGroup().addTo(allMap);

  map.on("zoomend moveend", refreshLabels);
  allMap.on("zoomend moveend", refreshLabels);
  bindUserInteraction(map);
  bindUserInteraction(allMap);

  const locateButton = document.querySelector("#locateButton");
  if (locateButton) locateButton.onclick = () => locateMe();

  document.querySelector("#compassLeft").onclick = () => emit("map:rotate", -15);
  document.querySelector("#compassRight").onclick = () => emit("map:rotate", 15);
  document.querySelector("#northButton").onclick = () => emit("map:north");

  const labelButton = document.querySelector("#labelToggleButton");
  if (labelButton) {
    labelButton.onclick = () => {
      labelsVisible = !labelsVisible;
      labelButton.classList.toggle("active", labelsVisible);
      labelButton.textContent = labelsVisible ? "지명 ON" : "지명 OFF";
      refreshLabels();
    };
  }

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

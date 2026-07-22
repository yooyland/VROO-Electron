import {emit} from "../core/events.js";
import {carInfo, makeDemoUsers, updateDemoUserPositions} from "./data.js";
import {placesForZoom, normalizePlaceName} from "./places.js";

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

const markersNear = new Map();
const markersAll = new Map();
let meMarkerNear = null;
let meMarkerAll = null;

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
        .on("click", () => emit("user:profile", user))
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

export function isMapReady() {
  return mapReady;
}

export function initMap(state) {
  stateRef = state;

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
  drawUsers("near");
  refreshLabels();
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

  runProgrammatic(() => {
    try {
      if (mode === "all") {
        map.setZoom(13);
      } else if (mode !== "road") {
        map.setView([stateRef.location.lat, stateRef.location.lng], 16);
      }
    } catch (e) {
      warnRare("[VROO map] setMapView", e);
    }
  });

  refreshLabels();
}

export function invalidateMaps() {
  setTimeout(() => {
    try {
      map?.invalidateSize();
    } catch (e) {
      warnRare("[VROO map] invalidate near", e);
    }
    try {
      allMap?.invalidateSize();
    } catch (e) {
      warnRare("[VROO map] invalidate all", e);
    }
    refreshLabels();
  }, 50);
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

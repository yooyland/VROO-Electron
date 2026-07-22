import {emit} from "../core/events.js";
import {carInfo, makeDemoUsers} from "./data.js";
import {placesForZoom, normalizePlaceName} from "./places.js";

let map;
let allMap;
let markerLayer;
let allLayer;
let placeLabelLayer;
let allPlaceLabelLayer;
let users = [];
let stateRef;
let labelsVisible = true;
let mapReady = false;
/** 최초 GPS 확정 시에만 자동 중앙 이동 */
let awaitingFirstGpsCenter = true;
/** 사용자가 지도를 직접 조작하면 true → 이후 GPS 자동 중앙 이동 중단 */
let userMovedMap = false;
/** 프로그램 setView/setZoom으로 인한 move/zoom 이벤트를 사용자 조작으로 오인하지 않기 위함 */
let programmaticMoveDepth = 0;

const BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";

const BASEMAP_OPTIONS = {
  maxZoom: 20,
  subdomains: "abcd",
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
};

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
  const subtitle = place.subtitle
    ? `<span>${place.subtitle}</span>`
    : "";

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
  if (map && placeLabelLayer) drawPlaceLabels(map, placeLabelLayer);
  if (allMap && allPlaceLabelLayer) drawPlaceLabels(allMap, allPlaceLabelLayer);
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

  users = makeDemoUsers(state.location);
  drawUsers("near");
  refreshLabels();

  map.on("zoomend moveend", refreshLabels);
  allMap.on("zoomend moveend", refreshLabels);
  bindUserInteraction(map);
  bindUserInteraction(allMap);

  const locateButton = document.querySelector("#locateButton");
  if (locateButton) {
    locateButton.onclick = () => locateMe();
  }

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
}

/** 📍 내 위치 버튼 — 현재 좌표로 지도 중심 이동 */
export function locateMe() {
  if (!mapReady || !map || !stateRef?.location) return;
  const {lat, lng} = stateRef.location;
  runProgrammatic(() => {
    map.setView([lat, lng], 16);
    if (allMap) allMap.setView([lat, lng], allMap.getZoom());
  });
  refreshLabels();
}

/**
 * GPS/위치 갱신.
 * 마커·데모 유저는 항상 갱신하고, 지도 중앙 이동은 최초 GPS 1회만(사용자 조작 전).
 * options.forceCenter === true 이면 버튼 등과 같이 강제 중앙 이동.
 */
export function setLocation(location, options = {}) {
  if (!stateRef) return;
  stateRef.location = location;
  users = makeDemoUsers(location);

  if (!mapReady || !map || !allMap) return;

  const forceCenter = options.forceCenter === true;
  const shouldCenter =
    forceCenter || (awaitingFirstGpsCenter && !userMovedMap);

  if (shouldCenter) {
    runProgrammatic(() => {
      map.setView([location.lat, location.lng], 16);
      allMap.setView([location.lat, location.lng], 13);
    });
    if (!forceCenter) awaitingFirstGpsCenter = false;
  }

  drawUsers("near");
  refreshLabels();
}

export function getUsers() {
  return users;
}

export function drawUsers(mode = "near") {
  if (!mapReady || !markerLayer || !allLayer || !stateRef) return;

  markerLayer.clearLayers();
  allLayer.clearLayers();

  const center = L.latLng(stateRef.location.lat, stateRef.location.lng);
  const visible =
    mode === "near"
      ? users.filter(user => center.distanceTo([user.lat, user.lng]) < 600)
      : users;

  for (const user of visible) {
    L.marker([user.lat, user.lng], {icon: iconFor(user)})
      .on("click", () => emit("user:profile", user))
      .addTo(markerLayer);

    L.marker([user.lat, user.lng], {icon: iconFor(user)})
      .on("click", () => emit("user:profile", user))
      .addTo(allLayer);
  }

  L.marker(
    [stateRef.location.lat, stateRef.location.lng],
    {icon: iconFor({}, true), zIndexOffset: 1000}
  ).addTo(markerLayer);

  L.marker(
    [stateRef.location.lat, stateRef.location.lng],
    {icon: iconFor({}, true), zIndexOffset: 1000}
  ).addTo(allLayer);
}

export function setMapView(mode) {
  if (!mapReady || !map || !stateRef) return;

  drawUsers(mode === "all" ? "all" : "near");

  runProgrammatic(() => {
    if (mode === "all") {
      map.setZoom(13);
    } else {
      map.setView([stateRef.location.lat, stateRef.location.lng], 16);
    }
  });

  refreshLabels();
}

export function invalidateMaps() {
  setTimeout(() => {
    map?.invalidateSize();
    allMap?.invalidateSize();
    refreshLabels();
  }, 50);
}

export function rotateMap(bearing) {
  const element = document.querySelector("#map");
  if (!element) return;
  element.style.transformOrigin = "50% 50%";
  element.style.transform = `rotate(${bearing}deg) scale(1.18)`;
}

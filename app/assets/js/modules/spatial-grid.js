/**
 * 대한민국 전국 Spatial GRID — Web Mercator 미터 기반 고정 셀.
 * 전국 셀을 미리 생성·저장하지 않고, ID/경계는 좌표로 계산한다.
 */

import {VROO_PLACES} from "./places.js";

export const KR_BOUNDS = {
  west: 124.0,
  east: 132.0,
  south: 32.5,
  north: 39.5
};

export const GRID_LEVELS = {
  L1: {key: "L1", sizeM: 50000, label: "NATIONAL"},
  L2: {key: "L2", sizeM: 10000, label: "REGIONAL"},
  L3: {key: "L3", sizeM: 2000, label: "LOCAL"}
};

/** 참여·채팅 기본 단계 */
export const ACTIVE_GRID_LEVEL = "L3";

export const MAX_VISIBLE_GRID_CELLS = 400;

/**
 * 개발용 Spatial GRID 디버그. 기본 false.
 * true일 때만 zoom/level/cell 수·ID를 HUD·콘솔에 출력.
 */
export const DEBUG_SPATIAL_GRID = false;

/**
 * Zoom ↔ 표시 level (hysteresis로 L2↔L3 경계 깜빡임 방지)
 *
 * 상승 진입: L1→L2 @ zoom≥8, L2→L3 @ zoom≥12
 * 하강 이탈: L3→L2 @ zoom<11, L2→L1 @ zoom<7
 *
 * 화면 기준(대략):
 *  A 전국 축소 ~5–7 → L1 (50km)
 *  B 서울·광역 ~9–11 → L2 (10km)
 *  C 동네 확대 ~14–17 → L3 (2km)
 */
export function levelForMapZoom(zoom, lastLevel = null) {
  const z = Number(zoom);
  const zz = Number.isFinite(z) ? z : 10;
  const last =
    lastLevel === "L1" || lastLevel === "L2" || lastLevel === "L3" ? lastLevel : null;

  if (last === "L3") {
    if (zz < 11) return zz < 7 ? "L1" : "L2";
    return "L3";
  }
  if (last === "L2") {
    if (zz >= 12) return "L3";
    if (zz < 7) return "L1";
    return "L2";
  }
  if (last === "L1") {
    if (zz >= 12) return "L3";
    if (zz >= 8) return "L2";
    return "L1";
  }
  if (zz >= 12) return "L3";
  if (zz >= 8) return "L2";
  return "L1";
}

const R = 6378137; // Web Mercator

let originMeters = null;

function ensureOrigin() {
  if (originMeters) return originMeters;
  originMeters = latLngToWorldMeters(KR_BOUNDS.south, KR_BOUNDS.west);
  return originMeters;
}

export function latLngToWorldMeters(lat, lng) {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return {x, y};
}

export function worldMetersToLatLng(x, y) {
  const lng = (x / R) * (180 / Math.PI);
  const lat = ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI;
  return {lat, lng};
}

export function isInKoreaApprox(lat, lng) {
  return (
    lat >= KR_BOUNDS.south - 0.5 &&
    lat <= KR_BOUNDS.north + 0.5 &&
    lng >= KR_BOUNDS.west - 0.5 &&
    lng <= KR_BOUNDS.east + 0.5
  );
}

export function parseGridId(gridId) {
  const m = String(gridId || "").match(/^KR:(L[123]):(-?\d+):(-?\d+)$/);
  if (!m) return null;
  return {level: m[1], ix: Number(m[2]), iy: Number(m[3]), id: `KR:${m[1]}:${m[2]}:${m[3]}`};
}

export function makeGridId(level, ix, iy) {
  return `KR:${level}:${ix}:${iy}`;
}

export function isSpatialGridId(id) {
  return !!parseGridId(id);
}

/** 참여·채팅용 LOCAL(L3) ID로 정규화. L1/L2는 중심 좌표의 L3로 변환. */
export function resolveToLocalGridId(gridId) {
  const parsed = parseGridId(gridId);
  if (!parsed) return null;
  if (parsed.level === ACTIVE_GRID_LEVEL) return parsed.id;
  const bounds = getGridBounds(parsed.id);
  if (!bounds) return null;
  return getGridCellFromLatLng(bounds.center.lat, bounds.center.lng, ACTIVE_GRID_LEVEL)?.id || null;
}

/** 클릭 좌표 → LOCAL(L3) 셀 ID */
export function localGridIdFromLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cell = getGridCellFromLatLng(lat, lng, ACTIVE_GRID_LEVEL);
  return cell?.id || null;
}

/**
 * 표시 중인 셀(ID)이 기준 셀(보통 L3)과 같은 공간인지.
 * 상위 level 표시에서도 위치/선택/내 GRID 강조에 사용.
 */
export function cellCoversGridId(displayCellId, targetGridId) {
  if (!displayCellId || !targetGridId) return false;
  if (displayCellId === targetGridId) return true;
  const display = parseGridId(displayCellId);
  const target = parseGridId(targetGridId);
  if (!display || !target) return false;
  const tb = getGridBounds(target.id);
  if (!tb) return false;
  const atDisplay = getGridCellFromLatLng(tb.center.lat, tb.center.lng, display.level);
  return atDisplay.id === display.id;
}

export function getGridCellFromLatLng(lat, lng, level = ACTIVE_GRID_LEVEL) {
  const la = Number(lat);
  const ln = normalizeLng(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const lvl = GRID_LEVELS[level] || GRID_LEVELS.L3;
  const origin = ensureOrigin();
  const p = latLngToWorldMeters(la, ln);
  // 반개구간 [min, max): 경계 max는 다음 셀 — floor로 한 셀에만 속함
  const ix = Math.floor((p.x - origin.x) / lvl.sizeM);
  const iy = Math.floor((p.y - origin.y) / lvl.sizeM);
  const id = makeGridId(lvl.key, ix, iy);
  return {id, level: lvl.key, ix, iy, sizeM: lvl.sizeM};
}

export function getGridBounds(gridId) {
  const parsed = parseGridId(gridId);
  if (!parsed) return null;
  const lvl = GRID_LEVELS[parsed.level];
  if (!lvl) return null;
  const origin = ensureOrigin();
  const minX = origin.x + parsed.ix * lvl.sizeM;
  const minY = origin.y + parsed.iy * lvl.sizeM;
  const maxX = minX + lvl.sizeM;
  const maxY = minY + lvl.sizeM;
  const sw = worldMetersToLatLng(minX, minY);
  const ne = worldMetersToLatLng(maxX, maxY);
  const nw = worldMetersToLatLng(minX, maxY);
  const se = worldMetersToLatLng(maxX, minY);
  const center = {
    lat: (sw.lat + ne.lat) / 2,
    lng: (sw.lng + ne.lng) / 2
  };
  return {
    id: parsed.id,
    level: parsed.level,
    ix: parsed.ix,
    iy: parsed.iy,
    sizeM: lvl.sizeM,
    sw,
    ne,
    nw,
    se,
    center,
    // Leaflet LatLngBounds-compatible corners
    south: Math.min(sw.lat, se.lat, nw.lat, ne.lat),
    north: Math.max(sw.lat, se.lat, nw.lat, ne.lat),
    west: Math.min(sw.lng, se.lng, nw.lng, ne.lng),
    east: Math.max(sw.lng, se.lng, nw.lng, ne.lng)
  };
}

function haversineM(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const Rk = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Rk * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** places.js 근접 지명 활용 (서버 지오코딩 없음) */
export function nearestPlaceName(lat, lng, maxM = 4000) {
  let best = null;
  let bestD = Infinity;
  for (const p of VROO_PLACES) {
    const d = haversineM({lat, lng}, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best && bestD <= maxM) return best.name;
  return null;
}

export function getGridDisplayName(gridId) {
  const bounds = getGridBounds(gridId);
  if (!bounds) return String(gridId || "GRID");
  const place = nearestPlaceName(bounds.center.lat, bounds.center.lng);
  const short = `${bounds.level}-${bounds.ix}-${bounds.iy}`;
  if (place) return `${place} ${short}`;
  return `KR ${short}`;
}

/** 경도 정규화: -180 <= lng < 180 */
export function normalizeLng(lng) {
  const n = Number(lng);
  if (!Number.isFinite(n)) return NaN;
  return ((((n + 180) % 360) + 360) % 360) - 180;
}

function readLatLngBounds(mapBounds) {
  if (!mapBounds) return null;
  let south = typeof mapBounds.getSouth === "function" ? mapBounds.getSouth() : mapBounds.south;
  let north = typeof mapBounds.getNorth === "function" ? mapBounds.getNorth() : mapBounds.north;
  let west = typeof mapBounds.getWest === "function" ? mapBounds.getWest() : mapBounds.west;
  let east = typeof mapBounds.getEast === "function" ? mapBounds.getEast() : mapBounds.east;
  if (![south, north, west, east].every(Number.isFinite)) return null;
  if (south > north) {
    const t = south;
    south = north;
    north = t;
  }
  west = normalizeLng(west);
  east = normalizeLng(east);
  return {south, north, west, east};
}

/**
 * viewport ∩ 대한민국 서비스 경계.
 * 경도 wrap(viewport가 180을 넘는 경우)은 서비스 구간(124~132)과 겹치면 그 구간만 사용.
 */
export function intersectLatLngBounds(mapBounds, serviceBounds = KR_BOUNDS) {
  const a = readLatLngBounds(mapBounds);
  if (!a) return null;
  const b = serviceBounds || KR_BOUNDS;

  const south = Math.max(a.south, b.south);
  const north = Math.min(a.north, b.north);
  if (!(south < north)) return null;

  // 서비스 구간은 항도 wrap 없음(124~132)
  const svcWest = b.west;
  const svcEast = b.east;

  let west;
  let east;
  if (a.west <= a.east) {
    west = Math.max(a.west, svcWest);
    east = Math.min(a.east, svcEast);
  } else {
    // world wrap: viewport가 날짜변경선을 가로지름 → 서비스 구간과 겹치는지만 검사
    const overlaps =
      a.east >= svcWest || a.west <= svcEast || (a.west <= svcWest && a.east >= svcEast);
    if (!overlaps) return null;
    west = svcWest;
    east = svcEast;
  }

  if (!(west < east)) return null;
  return {south, north, west, east};
}

/** 생성 없이 ix/iy 범위·예상 셀 수만 계산 */
export function estimateVisibleCellCount(bounds, level) {
  const range = cellIndexRange(bounds, level);
  if (!range) return {count: 0, ixMin: 0, ixMax: -1, iyMin: 0, iyMax: -1};
  const count = (range.ixMax - range.ixMin + 1) * (range.iyMax - range.iyMin + 1);
  return {count, ...range};
}

function cellIndexRange(bounds, level) {
  if (!bounds) return null;
  const lvl = GRID_LEVELS[level];
  if (!lvl) return null;
  const {south, west, north, east} = bounds;
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (!(south < north) || !(west < east)) return null;

  const origin = ensureOrigin();
  const corners = [
    latLngToWorldMeters(south, west),
    latLngToWorldMeters(south, east),
    latLngToWorldMeters(north, west),
    latLngToWorldMeters(north, east)
  ];
  const minX = Math.min(...corners.map(c => c.x));
  const maxX = Math.max(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxY = Math.max(...corners.map(c => c.y));

  // 반개구간: max 모서리는 다음 셀에 속하므로 인덱스 상한은 floor(max - epsilon)
  const eps = 1e-6;
  const ixMin = Math.floor((minX - origin.x) / lvl.sizeM);
  const ixMax = Math.floor((maxX - origin.x - eps) / lvl.sizeM);
  const iyMin = Math.floor((minY - origin.y) / lvl.sizeM);
  const iyMax = Math.floor((maxY - origin.y - eps) / lvl.sizeM);
  if (ixMax < ixMin || iyMax < iyMin) return null;
  return {ixMin, ixMax, iyMin, iyMax};
}

/**
 * preferred level에서 시작해 MAX 이내일 때까지 L3→L2→L1 상향.
 * 셀 목록을 잘라내지 않음.
 */
export function chooseGridLevelForBounds(bounds, preferredLevel) {
  const order = ["L3", "L2", "L1"];
  let idx = Math.max(0, order.indexOf(preferredLevel || "L3"));
  let level = order[idx];
  let estimate = estimateVisibleCellCount(bounds, level);

  while (estimate.count > MAX_VISIBLE_GRID_CELLS && idx < order.length - 1) {
    idx += 1;
    level = order[idx];
    estimate = estimateVisibleCellCount(bounds, level);
  }

  return {level, estimate};
}

/**
 * 지도 bounds ∩ KR_BOUNDS 안의 셀 전체 반환.
 * MAX 초과 시 level만 상향 — slice/break로 일부 절단 금지.
 */
export function getVisibleGridCells(mapBounds, preferredLevel) {
  const empty = {
    level: preferredLevel || "L3",
    cells: [],
    preferredLevel: preferredLevel || "L3",
    unclamped: null,
    clamped: null,
    estimated: 0,
    created: 0,
    ixMin: 0,
    ixMax: -1,
    iyMin: 0,
    iyMax: -1
  };

  const unclamped = readLatLngBounds(mapBounds);
  if (!unclamped) return empty;

  const clamped = intersectLatLngBounds(unclamped, KR_BOUNDS);
  if (!clamped) {
    return {...empty, unclamped, preferredLevel: preferredLevel || "L3"};
  }

  const preferred = preferredLevel || "L3";
  const {level, estimate} = chooseGridLevelForBounds(clamped, preferred);
  const cells = computeCellsInRange(level, estimate);

  return {
    level,
    cells,
    preferredLevel: preferred,
    unclamped,
    clamped,
    estimated: estimate.count,
    created: cells.length,
    ixMin: estimate.ixMin,
    ixMax: estimate.ixMax,
    iyMin: estimate.iyMin,
    iyMax: estimate.iyMax
  };
}

function computeCellsInRange(level, range) {
  if (!range || range.count <= 0) return [];
  const cells = [];
  for (let ix = range.ixMin; ix <= range.ixMax; ix++) {
    for (let iy = range.iyMin; iy <= range.iyMax; iy++) {
      const id = makeGridId(level, ix, iy);
      const bounds = getGridBounds(id);
      if (bounds) cells.push(bounds);
    }
  }
  return cells;
}

/** Leaflet 줌에 맞는 표시 level */
export function resolveDisplayLevel(zoom, mapBounds) {
  const preferred = levelForMapZoom(zoom);
  const probe = getVisibleGridCells(mapBounds, preferred);
  return probe.level;
}

export function usersInSpatialGrid(users, gridId) {
  const list = Array.isArray(users) ? users : [];
  if (!isSpatialGridId(gridId)) return [];
  return list.filter(u => {
    if (!u || !Number.isFinite(u.lat) || !Number.isFinite(u.lng)) return false;
    const cell = getGridCellFromLatLng(u.lat, u.lng, ACTIVE_GRID_LEVEL);
    return cell && cell.id === gridId;
  });
}

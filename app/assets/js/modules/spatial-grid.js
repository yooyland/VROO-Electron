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
  return getGridCellFromLatLng(bounds.center.lat, bounds.center.lng, ACTIVE_GRID_LEVEL).id;
}

/** 클릭 좌표 → LOCAL(L3) 셀 ID */
export function localGridIdFromLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return getGridCellFromLatLng(lat, lng, ACTIVE_GRID_LEVEL).id;
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
  const lvl = GRID_LEVELS[level] || GRID_LEVELS.L3;
  const origin = ensureOrigin();
  const p = latLngToWorldMeters(lat, lng);
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

export function levelForMapZoom(zoom) {
  const z = Number(zoom) || 10;
  if (z < 8) return "L1";
  if (z < 12) return "L2";
  return "L3";
}

/**
 * 지도 bounds 내 셀 목록. 셀 수가 MAX를 넘으면 상위 level로 재계산.
 * mapBounds: { south, west, north, east } 또는 Leaflet LatLngBounds-like
 */
export function getVisibleGridCells(mapBounds, preferredLevel) {
  if (!mapBounds) return {level: preferredLevel || "L3", cells: []};

  const south = typeof mapBounds.getSouth === "function" ? mapBounds.getSouth() : mapBounds.south;
  const north = typeof mapBounds.getNorth === "function" ? mapBounds.getNorth() : mapBounds.north;
  const west = typeof mapBounds.getWest === "function" ? mapBounds.getWest() : mapBounds.west;
  const east = typeof mapBounds.getEast === "function" ? mapBounds.getEast() : mapBounds.east;

  if (![south, north, west, east].every(Number.isFinite)) {
    return {level: preferredLevel || "L3", cells: []};
  }

  let level = preferredLevel || "L3";
  let cells = computeCellsInBounds(south, west, north, east, level);

  const order = ["L3", "L2", "L1"];
  let idx = order.indexOf(level);
  while (cells.length > MAX_VISIBLE_GRID_CELLS && idx > 0) {
    idx -= 1;
    level = order[idx];
    cells = computeCellsInBounds(south, west, north, east, level);
  }

  if (cells.length > MAX_VISIBLE_GRID_CELLS) {
    cells = cells.slice(0, MAX_VISIBLE_GRID_CELLS);
  }

  return {level, cells};
}

function computeCellsInBounds(south, west, north, east, level) {
  const lvl = GRID_LEVELS[level];
  if (!lvl) return [];
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

  const ix0 = Math.floor((minX - origin.x) / lvl.sizeM);
  const ix1 = Math.floor((maxX - origin.x) / lvl.sizeM);
  const iy0 = Math.floor((minY - origin.y) / lvl.sizeM);
  const iy1 = Math.floor((maxY - origin.y) / lvl.sizeM);

  const cells = [];
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      const id = makeGridId(level, ix, iy);
      const bounds = getGridBounds(id);
      if (bounds) cells.push(bounds);
    }
  }
  return cells;
}

/** Leaflet 줌에 맞는 표시 level */
export function resolveDisplayLevel(zoom, mapBounds) {
  let level = levelForMapZoom(zoom);
  const probe = getVisibleGridCells(mapBounds, level);
  return probe.level;
}

export function usersInSpatialGrid(users, gridId) {
  const list = Array.isArray(users) ? users : [];
  return list.filter(u => {
    if (!u || !Number.isFinite(u.lat) || !Number.isFinite(u.lng)) return false;
    const cell = getGridCellFromLatLng(u.lat, u.lng, ACTIVE_GRID_LEVEL);
    return cell.id === gridId;
  });
}

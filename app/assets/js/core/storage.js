/** 테스트용 무한 크레딧. 기본 false — 실제 잔액 규칙 사용 */
export const DEV_MODE = false;

/** 최초 설치(저장값 없음·비정상) 시 기본 크레딧 */
export const DEFAULT_CREDITS = 10000;

/** GRID 생성 비용 */
export const GRID_CREATE_COST = 1200;

/** 성장 업그레이드: 현재 레벨 × 이 값 */
export const LEVEL_UP_COST_FACTOR = 900;

export const STORAGE_KEY = "vrooBeta10";

export function growthUpgradeCost(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return lv * LEVEL_UP_COST_FACTOR;
}

/** 크레딧을 0 이상 정수로 정규화. 비정상이면 0 */
export function normalizeCredits(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** 천 단위 구분 표시 (음수 방지) */
export function formatCredits(value) {
  return normalizeCredits(value).toLocaleString("ko-KR");
}

export function canAfford(state, cost) {
  if (DEV_MODE) return true;
  const need = Math.max(0, Math.floor(Number(cost) || 0));
  return normalizeCredits(state?.credits) >= need;
}

/**
 * 성공 시에만 state.credits 차감.
 * DEV_MODE면 차감하지 않고 ok.
 */
export function spendCredits(state, cost) {
  const need = Math.max(0, Math.floor(Number(cost) || 0));
  if (DEV_MODE) {
    state.credits = normalizeCredits(state.credits);
    return {ok: true, spent: 0, balance: state.credits};
  }
  const bal = normalizeCredits(state.credits);
  if (bal < need) {
    return {ok: false, spent: 0, balance: bal, needed: need};
  }
  state.credits = bal - need;
  return {ok: true, spent: need, balance: state.credits};
}

export const defaults = {
  credits: DEFAULT_CREDITS,
  level: 1,
  xp: 0,
  currentScreen: "nearby",
  currentView: "near",
  currentGrid: "MY GRID",
  joinedGrids: ["MY GRID"],
  connections: [],
  favoriteRooms: [],
  rooms: {},
  posts: [],
  profile: {
    nickname: "VROO 관리자",
    plate: "12가 3456",
    car: "sport",
    status: "1.1.0-beta.1 테스트 중"
  },
  location: {lat: 37.5665, lng: 126.9780},
  hornEnabled: true,
  mapBearing: 0
};

function merge(base, value) {
  if (Array.isArray(base)) {
    return Array.isArray(value) ? value : structuredClone(base);
  }
  if (base && typeof base === "object") {
    const out = {...base};
    const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], src[k]);
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out;
  }
  return value === undefined ? base : value;
}

function sanitizeState(s) {
  const n = Number(s.credits);
  if (!Number.isFinite(n) || n < 0) s.credits = DEFAULT_CREDITS;
  else s.credits = Math.floor(n);

  s.level = Math.max(1, Math.floor(Number(s.level) || 1));
  const xp = Number(s.xp);
  s.xp = Number.isFinite(xp) ? Math.max(0, Math.min(100, Math.floor(xp))) : 0;

  for (const key of ["joinedGrids", "connections", "favoriteRooms", "posts"]) {
    if (!Array.isArray(s[key])) s[key] = structuredClone(defaults[key]);
  }
  if (!s.rooms || typeof s.rooms !== "object" || Array.isArray(s.rooms)) {
    s.rooms = {};
  }
  if (!s.profile || typeof s.profile !== "object" || Array.isArray(s.profile)) {
    s.profile = structuredClone(defaults.profile);
  }
  if (!s.location || typeof s.location !== "object" || Array.isArray(s.location)) {
    s.location = structuredClone(defaults.location);
  } else {
    const lat = Number(s.location.lat);
    const lng = Number(s.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      s.location = structuredClone(defaults.location);
    }
  }
  const bearing = Number(s.mapBearing);
  s.mapBearing = Number.isFinite(bearing) ? bearing : 0;
  s.hornEnabled = !!s.hornEnabled;
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let parsed = {};
    if (raw) {
      try {
        const json = JSON.parse(raw);
        if (json && typeof json === "object" && !Array.isArray(json)) parsed = json;
      } catch {
        parsed = {};
      }
    }
    const s = merge(structuredClone(defaults), parsed);
    return sanitizeState(s);
  } catch {
    return sanitizeState(structuredClone(defaults));
  }
}

export function saveState(state) {
  try {
    state.credits = normalizeCredits(state.credits);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error(e);
  }
}

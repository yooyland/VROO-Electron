/**
 * MY GARAGE — Garage 루트 컨테이너 (Vehicle 다수 + Inventory/Mission/…)
 * 기존 profile.car / level / credits 마이그레이션
 */
import { cars, carInfo } from "../data.js";
import { characterFieldsForType } from "./character-adapter.js";

/** 메인 IA — Garage 중심 */
export const MY_VIEWS = Object.freeze([
  { id: "garage", label: "Garage", group: "main" },
  { id: "inventory", label: "Inventory", group: "main" },
  { id: "accessory", label: "Accessories", group: "main" },
  { id: "missions", label: "Mission", group: "main" },
  { id: "collection", label: "Collection", group: "main" },
  { id: "friends", label: "Friends", group: "main" },
  { id: "records", label: "Record", group: "main" },
  { id: "upgrade", label: "Upgrade", group: "more" },
  { id: "custom", label: "Custom", group: "more" },
  { id: "achievements", label: "Achievements", group: "more" },
  { id: "profile", label: "Settings", group: "more" }
]);

export const MY_VIEW_IDS = MY_VIEWS.map((v) => v.id);

const RARITY = Object.freeze({
  sport: "legend",
  classic: "epic",
  sedan: "rare",
  suv: "rare",
  taxi: "common",
  van: "common",
  truck: "uncommon",
  bus: "uncommon",
  delivery: "common"
});

const TYPE_LABEL = Object.freeze({
  sport: "스포츠",
  sedan: "세단",
  suv: "SUV",
  taxi: "택시",
  van: "밴",
  truck: "픽업",
  bus: "미니버스",
  delivery: "배송",
  classic: "클래식"
});

const MODEL_NAME = Object.freeze({
  sport: "Roadster GT",
  sedan: "Executive S",
  suv: "Trail X",
  taxi: "Urban Cab",
  van: "Cargo V",
  truck: "Hauler",
  bus: "Shuttle",
  delivery: "Express",
  classic: "Heritage Executive S"
});

const RARITY_LABEL = Object.freeze({
  legend: "Legendary",
  epic: "Epic",
  rare: "Rare",
  uncommon: "Uncommon",
  common: "Common"
});

const DEFAULT_OWNED = new Set(["sport", "sedan", "suv", "classic"]);

/** 상세 성장 지표 (내부) */
const STAT_KEYS = Object.freeze([
  ["speed", "속도"],
  ["acceleration", "가속"],
  ["braking", "제동"],
  ["handling", "코너링"],
  ["safety", "안전"],
  ["communication", "통신거리"],
  ["style", "스타일"]
]);

/** 쇼케이스 표시용 (프리미엄 카드) */
export const SHOWCASE_ABILITY_KEYS = Object.freeze([
  ["engine", "Engine"],
  ["handling", "Handling"],
  ["comfort", "Comfort"],
  ["economy", "Economy"],
  ["style", "Style"]
]);

/** 포스터형 Garage 홈 — 4축 */
export const POSTER_ABILITY_KEYS = Object.freeze([
  ["engine", "Engine"],
  ["handling", "Handling"],
  ["comfort", "Comfort"],
  ["style", "Style"]
]);

/** 하단 Room 탭 */
export const GARAGE_ROOMS = Object.freeze([
  { id: "garage", label: "Garage" },
  { id: "inventory", label: "Inventory" },
  { id: "missions", label: "Mission" },
  { id: "friends", label: "Friends" },
  { id: "records", label: "Record" }
]);

/** 차고 배경 테마 — 분위기 전환 */
export const GARAGE_THEMES = Object.freeze([
  { id: "luxury", label: "Luxury Garage", blurb: "블랙 & 골드" },
  { id: "modern", label: "Modern Garage", blurb: "미니멀 스틸" },
  { id: "neon", label: "Neon Garage", blurb: "네온 나이트" },
  { id: "classic", label: "Classic Garage", blurb: "클래식 우드" },
  { id: "race", label: "Race Pit", blurb: "피트 레인" },
  { id: "forest", label: "Forest Garage", blurb: "포레스트" }
]);

export const GARAGE_THEME_IDS = GARAGE_THEMES.map((t) => t.id);

export { STAT_KEYS, RARITY_LABEL, TYPE_LABEL, MODEL_NAME };

function clampStat(n) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(1, Math.min(99, v));
}

function clamp01to100(n, fallback = 80) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function baseStatsForType(type, level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const bump = Math.min(25, Math.floor(lv / 4));
  const seeds = {
    sport: [78, 82, 64, 80, 70, 86, 90],
    sedan: [62, 60, 72, 68, 82, 88, 70],
    suv: [58, 55, 70, 62, 88, 84, 66],
    taxi: [60, 58, 68, 65, 80, 90, 55],
    van: [52, 50, 66, 58, 84, 80, 50],
    truck: [55, 48, 62, 52, 86, 78, 48],
    bus: [48, 45, 60, 50, 90, 82, 45],
    delivery: [56, 54, 64, 56, 78, 85, 52],
    classic: [70, 68, 60, 74, 72, 75, 92]
  };
  const s = seeds[type] || seeds.sedan;
  return {
    speed: clampStat(s[0] + bump),
    acceleration: clampStat(s[1] + bump),
    braking: clampStat(s[2] + Math.floor(bump / 2)),
    handling: clampStat(s[3] + bump),
    safety: clampStat(s[4] + Math.floor(bump / 2)),
    communication: clampStat(s[5] + Math.floor(bump / 3)),
    style: clampStat(s[6] + bump)
  };
}

function abilitiesFromStats(stats) {
  const s = stats || {};
  return {
    engine: clampStat(((Number(s.speed) || 0) + (Number(s.acceleration) || 0)) / 2),
    handling: clampStat(s.handling),
    comfort: clampStat(((Number(s.safety) || 0) + (Number(s.braking) || 0)) / 2),
    economy: clampStat(s.communication),
    style: clampStat(s.style)
  };
}

function vehicleScoreFromAbilities(abilities) {
  const vals = SHOWCASE_ABILITY_KEYS.map(([k]) => Number(abilities?.[k]) || 0);
  const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  return Math.max(1, Math.min(5, Math.round(avg / 20)));
}

function expToNextForLevel(level) {
  return Math.max(100, Math.floor(Number(level) || 1) * 120);
}

function vehicleIdForType(type) {
  return `vehicle-vroo-${String(type || "sedan")}`;
}

function defaultCustomization(type) {
  return {
    bodyColor: type === "sport" ? "#c9a227" : type === "classic" ? "#8b7355" : "#d8dee8",
    wheelId: "wheel-std",
    glassId: "glass-clear",
    lightId: "light-std",
    neonId: null,
    stickerIds: [],
    plateStyleId: "plate-std",
    hornId: "horn-std",
    effectId: null
  };
}

function defaultHistory(type, level) {
  return [
    { at: Date.now() - 86400000 * 30, text: `${MODEL_NAME[type] || "Vehicle"} 등록` },
    { at: Date.now() - 86400000 * 7, text: `레벨 ${Math.max(1, level - 2)} 도달` },
    { at: Date.now() - 86400000 * 1, text: "Garage 점검 · 로컬" }
  ];
}

/** 카탈로그 기준 차량 객체 — DATA_MODEL Vehicle */
export function buildCatalogVehicle(type, opts = {}) {
  const info = carInfo(type);
  const level = Math.max(1, Math.floor(Number(opts.level) || 1));
  const rarity = opts.grade || opts.rarity || RARITY[info.id] || "common";
  const stats = opts.stats || opts.abilitiesDetail || baseStatsForType(info.id, level);
  const abilities = opts.abilities || abilitiesFromStats(stats);
  const manufacturer = opts.manufacturer || "VROO";
  const model = opts.model || MODEL_NAME[info.id] || info.name;
  const nickname = opts.nickname || null;
  const name = opts.name || `${manufacturer} ${model}`;
  const expToNext = opts.expToNext != null ? Number(opts.expToNext) : expToNextForLevel(level);
  const exp = Math.max(0, Math.min(expToNext - 1, Number(opts.exp) || Math.floor(expToNext * 0.62)));
  const charDefaults = characterFieldsForType(info.id);

  return {
    id: opts.id || vehicleIdForType(info.id),
    ownerId: opts.ownerId || "me",
    catalogType: info.id,
    type: info.id,
    typeLabel: TYPE_LABEL[info.id] || info.name,
    manufacturer,
    model,
    nickname,
    name,
    grade: rarity,
    rarity,
    rarityLabel: RARITY_LABEL[rarity] || rarity,
    level,
    exp,
    expToNext,
    mileage: Math.max(0, Number(opts.mileage) || Math.floor(8000 + level * 1200 + (info.id.length * 777) % 5000)),
    todayMileage: Math.max(0, Number(opts.todayMileage) || Math.floor(8 + (level % 20))),
    weekMileage: Math.max(
      0,
      Number(opts.weekMileage) || Math.floor((Number(opts.todayMileage) || 12) * 7 + level * 3)
    ),
    fuelType: opts.fuelType || (info.id === "classic" ? "gasoline" : "hybrid"),
    condition: clamp01to100(opts.condition, 88),
    energy: clamp01to100(opts.energy, 76),
    fuelLevel: clamp01to100(opts.fuelLevel, 95),
    batteryLevel: clamp01to100(opts.batteryLevel, 82),
    tuningStage: Math.max(0, Math.min(10, Number(opts.tuningStage) || Math.floor(level / 8))),
    seasonRank: opts.seasonRank || "—",
    score: opts.score != null ? Math.max(1, Math.min(5, Number(opts.score))) : vehicleScoreFromAbilities(abilities),
    vehicleScorePoints: opts.vehicleScorePoints != null
      ? Math.max(0, Math.min(100, Number(opts.vehicleScorePoints)))
      : Math.round(
          (abilities.engine + abilities.handling + abilities.comfort + abilities.style) / 4
        ),
    owned: !!opts.owned,
    active: !!opts.active,
    acquiredAt: opts.acquiredAt || null,
    description: opts.description || `${manufacturer} ${model} · VROO 성장형 디지털 차량`,
    stats,
    abilities,
    accessories: Array.isArray(opts.accessories) ? opts.accessories : [],
    customization: opts.customization || defaultCustomization(info.id),
    history: Array.isArray(opts.history) ? opts.history : defaultHistory(info.id, level),
    friendIds: Array.isArray(opts.friendIds) ? opts.friendIds : [],
    missionIds: Array.isArray(opts.missionIds) ? opts.missionIds : [],
    growthRate: Math.min(100, Number(opts.growthRate) || 40 + level),
    source: opts.source || "local",
    /* Character System — catalogType별 고유 ID (강제 재매핑) */
    characterId: charDefaults.characterId,
    evolutionStage: charDefaults.evolutionStage,
    characterView: charDefaults.characterView,
    hasOfficialAsset: !!charDefaults.hasOfficialAsset,
    characterStatus: charDefaults.characterStatus || "missing",
    characterAssetStatus: charDefaults.characterAssetStatus || charDefaults.characterStatus || "missing"
  };
}

export function vehicleDisplayName(v) {
  if (!v) return "Vehicle";
  if (v.nickname) return v.nickname;
  if (v.manufacturer && v.model) return `${v.manufacturer} ${v.model}`;
  return v.name || "Vehicle";
}

export function formatKm(n) {
  const v = Math.max(0, Number(n) || 0);
  return v.toLocaleString("ko-KR");
}

export function expProgressPct(v) {
  const next = Math.max(1, Number(v?.expToNext) || 100);
  const exp = Math.max(0, Number(v?.exp) || 0);
  return Math.max(0, Math.min(100, Math.round((exp / next) * 100)));
}

function migrateVehicles(state) {
  const activeType = state.profile?.car || "sport";
  const accountLv = Math.max(1, Math.floor(Number(state.level) || 1));
  const existing = Array.isArray(state.myGarage?.vehicles) ? state.myGarage.vehicles : [];
  const byType = new Map();
  for (const v of existing) {
    if (v && v.catalogType) byType.set(v.catalogType, v);
  }

  const list = cars.map((c, i) => {
    const type = c[0];
    const prev = byType.get(type);
    const owned = prev ? !!prev.owned : DEFAULT_OWNED.has(type) || type === activeType;
    const level =
      prev?.level != null ? Math.max(1, Number(prev.level) || 1) : type === activeType ? accountLv : Math.max(1, accountLv - 8 - i);
    return buildCatalogVehicle(type, {
      ...(prev || {}),
      owned,
      active: type === activeType,
      level,
      acquiredAt: prev?.acquiredAt || (owned ? Date.now() - i * 86400000 * 3 : null),
      stats: prev?.stats,
      abilities: prev?.abilities,
      customization: prev?.customization,
      name: prev?.name,
      nickname: prev?.nickname,
      manufacturer: prev?.manufacturer,
      model: prev?.model,
      mileage: prev?.mileage,
      todayMileage: prev?.todayMileage,
      weekMileage: prev?.weekMileage,
      condition: prev?.condition,
      energy: prev?.energy,
      fuelLevel: prev?.fuelLevel,
      batteryLevel: prev?.batteryLevel,
      tuningStage: prev?.tuningStage,
      seasonRank: prev?.seasonRank,
      history: prev?.history,
      exp: prev?.exp,
      expToNext: prev?.expToNext,
      id: prev?.id,
      /* character 필드는 catalogType에서 재계산 — prev 잘못된 Heritage 공유 ID 폐기 */
      characterId: undefined,
      evolutionStage: undefined,
      characterView: undefined,
      hasOfficialAsset: undefined,
      characterStatus: undefined,
      characterAssetStatus: undefined
    });
  });

  for (const v of list) v.active = v.catalogType === activeType && v.owned;
  return list;
}

/**
 * Garage 루트 확보
 * Garage → vehicles[] · inventory · missions · records · friends · achievements
 */
export function ensureMyGarage(state) {
  if (!state.myGarage || typeof state.myGarage !== "object" || Array.isArray(state.myGarage)) {
    state.myGarage = {};
  }
  const g = state.myGarage;
  g.schemaVersion = Math.max(2, Number(g.schemaVersion) || 2);
  if (!MY_VIEW_IDS.includes(g.activeMyView)) g.activeMyView = "garage";
  g.vehicles = migrateVehicles(state);
  const active = g.vehicles.find((v) => v.active && v.owned) || g.vehicles.find((v) => v.owned) || g.vehicles[0];
  if (!g.activeVehicleId || !g.vehicles.some((v) => v.id === g.activeVehicleId)) {
    g.activeVehicleId = active?.id || null;
  }
  if (!g.selectedVehicleId || !g.vehicles.some((v) => v.id === g.selectedVehicleId)) {
    g.selectedVehicleId = g.activeVehicleId;
  }
  if (!["default", "close", "wide"].includes(g.garageCameraPreset)) g.garageCameraPreset = "default";
  if (!GARAGE_THEME_IDS.includes(g.garageTheme)) g.garageTheme = "luxury";
  /* local UI sample — not server earnings */
  if (g.todayEarnedCoins == null) g.todayEarnedCoins = 425;
  if (!g.customDraft || typeof g.customDraft !== "object") g.customDraft = null;
  if (!["all", "active", "owned", "locked", "sport", "sedan", "suv", "legend", "epic", "rare", "uncommon", "common"].includes(g.collectionFilter)) {
    g.collectionFilter = "all";
  }
  if (!["level", "recent", "name", "rarity"].includes(g.collectionSort)) g.collectionSort = "level";
  if (!["all", "vehicle", "skin", "accessory", "material", "coupon", "consumable"].includes(g.inventoryFilter)) {
    g.inventoryFilter = "all";
  }
  if (!g.profileDraft || typeof g.profileDraft !== "object") g.profileDraft = null;
  if (!Array.isArray(g.inventory)) g.inventory = defaultInventory();
  else {
    g.inventory = g.inventory.map((it) => ({
      ...it,
      equipped: !!it.equipped
    }));
  }
  if (!Array.isArray(g.missions)) g.missions = defaultMissions();
  else {
    const seed = defaultMissions();
    g.missions = g.missions.map((m) => {
      const s = seed.find((x) => x.id === m.id);
      return {
        ...m,
        difficulty: m.difficulty ?? s?.difficulty ?? 3,
        rewardCoins: m.rewardCoins ?? s?.rewardCoins ?? 30,
        rewardExp: m.rewardExp ?? s?.rewardExp ?? null,
        etaMinutes: m.etaMinutes ?? s?.etaMinutes ?? null,
        status: m.status ?? s?.status ?? "active",
        claimReady: m.claimReady ?? s?.claimReady ?? false,
        claimed: !!m.claimed
      };
    });
  }
  if (!g.records || typeof g.records !== "object") g.records = defaultRecords(state);
  else if (!Array.isArray(g.records.weekSeries) || g.records.weekSeries.length < 7) {
    g.records.weekSeries = weekDistanceSeries(g.records);
  }
  if (!Array.isArray(g.achievements)) g.achievements = defaultAchievements();
  if (!Array.isArray(g.friends)) g.friends = defaultFriends();
  else {
    g.friends = g.friends.map((f) => ({
      ...f,
      vehicleLabel: f.vehicleLabel || MODEL_NAME[f.vehicleType] || TYPE_LABEL[f.vehicleType] || "Vehicle",
      vehicleColor: f.vehicleColor || "#c9a227",
      status: f.status || (f.online ? "Online" : "Offline")
    }));
  }
  /* Garage 컨테이너 요약 — Vehicle 주행과 records 동기(표시용) */
  const sel = g.vehicles.find((v) => v.id === g.selectedVehicleId) || active;
  if (sel && g.records) {
    if (sel.mileage != null) g.records.totalDistanceKm = Number(sel.mileage) || g.records.totalDistanceKm;
    if (sel.todayMileage != null) g.records.todayDistanceKm = Number(sel.todayMileage) || g.records.todayDistanceKm;
  }
  syncActiveFromProfile(state);
  return g;
}

export function syncActiveFromProfile(state) {
  const g = state.myGarage;
  if (!g?.vehicles) return;
  const type = state.profile?.car || "sport";
  for (const v of g.vehicles) {
    v.active = v.owned && v.catalogType === type;
  }
  const active = g.vehicles.find((v) => v.active);
  if (active) {
    g.activeVehicleId = active.id;
    if (!g.selectedVehicleId) g.selectedVehicleId = active.id;
  }
}

export function getSelectedVehicle(state) {
  const g = ensureMyGarage(state);
  return g.vehicles.find((v) => v.id === g.selectedVehicleId) || g.vehicles.find((v) => v.active) || g.vehicles[0];
}

export function getActiveVehicle(state) {
  const g = ensureMyGarage(state);
  return g.vehicles.find((v) => v.id === g.activeVehicleId && v.owned) || getSelectedVehicle(state);
}

export function setSelectedVehicle(state, vehicleId) {
  const g = ensureMyGarage(state);
  const v = g.vehicles.find((x) => x.id === vehicleId);
  if (!v) return null;
  g.selectedVehicleId = v.id;
  return v;
}

/** 대표(사용 중) 차량 설정 — profile.car 동기화 */
export function setActiveVehicle(state, vehicleId) {
  const g = ensureMyGarage(state);
  const v = g.vehicles.find((x) => x.id === vehicleId && x.owned);
  if (!v) return { ok: false, reason: "owned_required" };
  for (const x of g.vehicles) x.active = x.id === v.id;
  g.activeVehicleId = v.id;
  g.selectedVehicleId = v.id;
  state.profile.car = v.catalogType;
  return { ok: true, vehicle: v };
}

export function ownedVehicleCount(state) {
  return ensureMyGarage(state).vehicles.filter((v) => v.owned).length;
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatShortDate(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t) || t <= 0) return "—";
  return new Date(t).toLocaleDateString("ko-KR");
}

/** 차량 실루엣 SVG — door/light 그룹으로 인터랙션 가능 */
export function vehicleSilhouetteSvg(type, color = "#d8dee8") {
  const fill = escapeHtml(color);
  const common = `class="my-car-svg" viewBox="0 0 240 120" aria-hidden="true"`;
  const lights = `<g class="my-car-lights" opacity="0"><ellipse cx="52" cy="72" rx="10" ry="5" fill="#fff8d0"/><ellipse cx="198" cy="72" rx="10" ry="5" fill="#fff8d0"/><ellipse class="my-car-beam" cx="30" cy="72" rx="22" ry="10" fill="#ffe9a0" opacity=".45"/><ellipse class="my-car-beam" cx="220" cy="72" rx="22" ry="10" fill="#ffe9a0" opacity=".45"/></g>`;
  const doors = `<g class="my-car-doors"><rect class="my-car-door my-car-door--l" x="78" y="52" width="28" height="30" rx="2" fill="${fill}" stroke="#0b1017" stroke-opacity=".25"/><rect class="my-car-door my-car-door--r" x="134" y="52" width="28" height="30" rx="2" fill="${fill}" stroke="#0b1017" stroke-opacity=".25"/></g>`;
  if (type === "suv" || type === "van" || type === "bus") {
    return `<svg ${common}><g class="my-car-body"><path fill="${fill}" d="M28 78h184l-8 18H36l-8-18zm12-8 14-28h100l22 28H40zm18 26a12 12 0 1 0 0-24 12 12 0 0 0 0 24zm112 0a12 12 0 1 0 0-24 12 12 0 0 0 0 24z"/><path fill="#0b1017" opacity=".35" d="M58 48h36l6 18H54l4-18zm52 0h40l8 18H106l4-18z"/></g>${doors}${lights}</svg>`;
  }
  if (type === "truck" || type === "delivery") {
    return `<svg ${common}><g class="my-car-body"><path fill="${fill}" d="M20 70h120v26H20V70zm120 0 28-24h36v50h-20l-8-10H140V70z"/><circle cx="52" cy="100" r="14" fill="#0b1017"/><circle cx="52" cy="100" r="7" fill="${fill}"/><circle cx="188" cy="100" r="14" fill="#0b1017"/><circle cx="188" cy="100" r="7" fill="${fill}"/></g>${doors}${lights}</svg>`;
  }
  if (type === "classic") {
    return `<svg ${common}><g class="my-car-body"><path fill="${fill}" d="M30 78c8-28 40-40 90-40s82 12 90 40H30zm20 8a14 14 0 1 0 0-28 14 14 0 0 0 0 28zm120 0a14 14 0 1 0 0-28 14 14 0 0 0 0 28z"/><path fill="#0b1017" opacity=".3" d="M70 50h40l8 20H64l6-20zm50 0h36l10 20h-42l-4-20z"/></g>${doors}${lights}</svg>`;
  }
  /* sport / sedan / taxi default */
  return `<svg ${common}><g class="my-car-body"><path fill="${fill}" d="M24 76 48 44h52l18-12h40l28 28 30 16v18H24V76zm28 20a14 14 0 1 0 0-28 14 14 0 0 0 0 28zm120 0a14 14 0 1 0 0-28 14 14 0 0 0 0 28z"/><path fill="#0b1017" opacity=".32" d="M56 50h40l10 22H50l6-22zm58-10h28l16 16 8 16H108l6-32z"/></g>${doors}${lights}</svg>`;
}

/** 최근 7일 주행 시리즈 (Record 스파크라인용 · 로컬) */
export function weekDistanceSeries(records) {
  const r = records || {};
  if (Array.isArray(r.weekSeries) && r.weekSeries.length >= 7) {
    return r.weekSeries.slice(-7).map((n) => Math.max(0, Number(n) || 0));
  }
  const week = Math.max(0, Number(r.weekDistanceKm) || 0);
  const today = Math.max(0, Number(r.todayDistanceKm) || 0);
  const base = week > 0 ? week / 7 : 2.5;
  const seeds = [0.7, 1.1, 0.55, 1.35, 0.9, 1.2, 1];
  const raw = seeds.map((s, i) => (i === 6 ? today || base * s : base * s));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const scale = week > 0 ? week / sum : 1;
  return raw.map((n) => Math.round(n * scale * 10) / 10);
}

export function setGarageTheme(state, themeId) {
  const g = ensureMyGarage(state);
  if (!GARAGE_THEME_IDS.includes(themeId)) return false;
  g.garageTheme = themeId;
  return true;
}

function defaultInventory() {
  return [
    { id: "inv-skin-gold", kind: "skin", name: "Gold Skin", qty: 1, usable: true, equipped: true, expiresAt: null },
    { id: "inv-wheel-sport", kind: "accessory", name: "스포츠 휠", qty: 1, usable: true, equipped: false, expiresAt: null },
    { id: "inv-mat-xp", kind: "material", name: "성장 재료 (로컬)", qty: 12, usable: true, equipped: false, expiresAt: null },
    { id: "inv-coupon-demo", kind: "coupon", name: "체험 쿠폰", qty: 1, usable: false, equipped: false, expiresAt: Date.now() - 86400000 },
    { id: "inv-horn", kind: "consumable", name: "경적 체험권", qty: 3, usable: true, equipped: false, expiresAt: null }
  ];
}

function defaultMissions() {
  return [
    { id: "m-daily-5km", group: "daily", title: "오늘 5km 이동", progress: 3.6, target: 5, unit: "km", source: "local", status: "active", difficulty: 3, rewardCoins: 50, rewardExp: 20, etaMinutes: 5 },
    { id: "m-daily-road", group: "daily", title: "도로 상황 메시지 1회 확인", progress: 0, target: 1, unit: "회", source: "local", status: "active", difficulty: 2, rewardCoins: 20, rewardExp: 10, etaMinutes: 2 },
    { id: "m-weekly-grid", group: "weekly", title: "GRID 참여 1회", progress: 0, target: 1, unit: "회", source: "local", status: "active", difficulty: 4, rewardCoins: 100, rewardExp: 40, etaMinutes: 10 },
    { id: "m-growth-lv", group: "growth", title: "차량 레벨 성장", progress: 1, target: 1, unit: "회", source: "local", status: "complete", difficulty: 5, rewardCoins: 80, rewardExp: 50, etaMinutes: null, claimReady: true },
    { id: "m-safe-10", group: "safety", title: "안전운전 시간 10분", progress: 4, target: 10, unit: "분", source: "local", status: "active", difficulty: 3, rewardCoins: 40, rewardExp: 15, etaMinutes: 6 },
    { id: "m-comm", group: "community", title: "커뮤니티 게시글 확인", progress: 0, target: 1, unit: "회", source: "local", status: "active", difficulty: 2, rewardCoins: 25, rewardExp: 8, etaMinutes: 2 }
  ];
}

function defaultRecords(state) {
  return {
    totalDistanceKm: 128.4,
    todayDistanceKm: 3.2,
    weekDistanceKm: 21.6,
    weekSeries: [2.1, 3.4, 1.8, 4.2, 2.9, 3.6, 3.2],
    visitedAreas: 7,
    gridJoins: Array.isArray(state.joinedGrids) ? state.joinedGrids.length : 1,
    roadMessages: Math.max(0, Number(state.roadChat?.messages?.length) || 0),
    nearbyInteractions: 14,
    thanks: 9,
    reportAccuracy: null,
    safeDriveScore: 84,
    joinedAt: state.profile?.joinedAt || null,
    source: "local"
  };
}

function defaultAchievements() {
  return [
    { id: "a-first-grid", title: "첫 GRID 참여", unlocked: true, progress: 1, target: 1, unlockedAt: Date.now() - 86400000 * 20, titleReward: "GRID 입문자" },
    { id: "a-road-100", title: "도로 메시지 100회", unlocked: false, progress: 12, target: 100, unlockedAt: null, titleReward: "도로 메신저" },
    { id: "a-safe-100", title: "안전운전 100km", unlocked: false, progress: 42, target: 100, unlockedAt: null, titleReward: "안전 드라이버" },
    { id: "a-friends-10", title: "친구 10명", unlocked: false, progress: 2, target: 10, unlockedAt: null, titleReward: "로드 메이트" },
    { id: "a-place-5", title: "등록지점 5곳 방문", unlocked: false, progress: 1, target: 5, unlockedAt: null, titleReward: "탐험가" }
  ];
}

function defaultFriends() {
  return [
    { id: "u0", nickname: "별빛드라이버", online: true, status: "Driving", lastGrid: "MY GRID", vehicleType: "sedan", vehicleLabel: "Executive S", vehicleColor: "#d8dee8" },
    { id: "u3", nickname: "서울라이더", online: false, status: "Parked", lastGrid: "강남 드라이브", vehicleType: "sport", vehicleLabel: "Roadster GT", vehicleColor: "#c9a227" },
    { id: "u7", nickname: "충전중파일럿", online: true, status: "Charging", lastGrid: "한강 피어", vehicleType: "suv", vehicleLabel: "Trail X", vehicleColor: "#4a6fa5" }
  ];
}

export function userSummary(state) {
  const g = ensureMyGarage(state);
  const rec = g.records || defaultRecords(state);
  const title =
    g.achievements?.find((a) => a.unlocked && a.titleReward)?.titleReward || "VROO 드라이버";
  return {
    nickname: state.profile?.nickname || "드라이버",
    level: Math.max(1, Number(state.level) || 1),
    title,
    totalDistanceKm: rec.totalDistanceKm,
    todayDistanceKm: rec.todayDistanceKm,
    gridCount: rec.gridJoins,
    roadMessages: rec.roadMessages,
    friendCount: g.friends?.length || 0,
    safeDriveScore: rec.safeDriveScore,
    joinedAt: rec.joinedAt,
    credits: state.credits,
    ownedVehicles: ownedVehicleCount(state)
  };
}

export function nextVehicleIndex(state, delta) {
  const g = ensureMyGarage(state);
  const owned = g.vehicles.filter((v) => v.owned);
  if (!owned.length) return null;
  const cur = owned.findIndex((v) => v.id === g.selectedVehicleId);
  const i = cur < 0 ? 0 : (cur + delta + owned.length) % owned.length;
  g.selectedVehicleId = owned[i].id;
  return owned[i];
}

export function applyCustomDraft(state, save) {
  const g = ensureMyGarage(state);
  const v = getSelectedVehicle(state);
  if (!v || !g.customDraft) return false;
  if (save) {
    v.customization = { ...v.customization, ...g.customDraft };
    g.customDraft = null;
    return true;
  }
  g.customDraft = null;
  return false;
}

export function previewCustomization(vehicle, draft) {
  if (!vehicle) return defaultCustomization("sedan");
  return { ...vehicle.customization, ...(draft || {}) };
}

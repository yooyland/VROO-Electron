/**
 * Character System ↔ MY GARAGE adapter (승인형 에셋)
 *
 * 로드 순서:
 * 1) approved && transparent && assetType==="character" → webp → png → svg
 * 2) else placeholder SVG (useInGarageHero인 경우만)
 * 3) false → Three.js → premium SVG (garage.js)
 *
 * promotional / concept / 미승인 raster 절대 로드하지 않음
 */

export const CATALOG_TO_CHARACTER = Object.freeze({
  classic: {
    characterId: "vroo-heritage-executive-s",
    evolutionStage: 5,
    characterView: "front45",
    rarity: "MYTHIC",
    assetRel: "Vehicles/05_Heritage/views/front_45.svg",
    hasOfficialAsset: false,
    characterStatus: "missing",
    characterAssetStatus: "missing",
    useInGarageHero: true
  },
  sport: {
    characterId: "vroo-roadster-gt",
    evolutionStage: 3,
    characterView: "front45",
    rarity: "EPIC",
    assetRel: "Vehicles/03_Sport/views/front_45.svg",
    hasOfficialAsset: false,
    characterStatus: "missing",
    characterAssetStatus: "missing",
    useInGarageHero: false
  },
  sedan: {
    characterId: "vroo-executive-s",
    evolutionStage: 2,
    characterView: "front45",
    rarity: "RARE",
    assetRel: "Vehicles/02_Street/views/front_45.svg",
    hasOfficialAsset: false,
    characterStatus: "missing",
    characterAssetStatus: "missing",
    useInGarageHero: false
  },
  suv: {
    characterId: "vroo-trail-x",
    evolutionStage: 4,
    characterView: "front45",
    rarity: "LEGENDARY",
    assetRel: "Vehicles/04_Performance/views/front_45.svg",
    hasOfficialAsset: false,
    characterStatus: "missing",
    characterAssetStatus: "missing",
    useInGarageHero: false
  }
});

const DEFAULT_MAP = Object.freeze({
  characterId: "vroo-basic",
  evolutionStage: 1,
  characterView: "front45",
  rarity: "COMMON",
  assetRel: "Vehicles/01_Basic/views/front_45.svg",
  hasOfficialAsset: false,
  characterStatus: "missing",
  characterAssetStatus: "missing",
  useInGarageHero: false
});

const APP_CHARACTER_BASE = "./assets/characters";
export const CHARACTER_SOURCE_BASE = "../Character";

let manifestCache = null;
let manifestTried = false;
const resolvedUrlCache = new Map();

export function normalizeCharacterAssetRel(assetPath) {
  if (assetPath == null) return null;
  let p = String(assetPath).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p || p === "null") return null;
  if (p.startsWith("Character/")) p = p.slice("Character/".length);
  if (p.startsWith("assets/characters/")) p = p.slice("assets/characters/".length);
  return p;
}

export function characterMapForVehicle(vehicle) {
  if (!vehicle) return { ...DEFAULT_MAP };
  const byCatalog = CATALOG_TO_CHARACTER[vehicle.catalogType] || DEFAULT_MAP;
  return {
    characterId: byCatalog.characterId,
    evolutionStage: Number(vehicle.evolutionStage) || byCatalog.evolutionStage,
    characterView: vehicle.characterView || byCatalog.characterView || "front45",
    rarity: byCatalog.rarity,
    assetRel: byCatalog.assetRel,
    hasOfficialAsset: byCatalog.hasOfficialAsset,
    characterStatus: byCatalog.characterStatus || "missing",
    characterAssetStatus: byCatalog.characterAssetStatus || "missing",
    useInGarageHero: byCatalog.useInGarageHero
  };
}

export function characterFieldsForType(catalogType) {
  const m = CATALOG_TO_CHARACTER[catalogType] || DEFAULT_MAP;
  return {
    characterId: m.characterId,
    evolutionStage: m.evolutionStage,
    characterView: m.characterView,
    hasOfficialAsset: !!m.hasOfficialAsset,
    characterStatus: m.characterStatus || "missing",
    characterAssetStatus: m.characterAssetStatus || "missing"
  };
}

function resolveAssetUrl(relPath) {
  const clean = normalizeCharacterAssetRel(relPath);
  if (!clean) return null;
  return `${APP_CHARACTER_BASE}/${clean}`.replace(/\\/g, "/");
}

export async function loadCharacterManifest() {
  if (manifestCache) return manifestCache;
  if (manifestTried) return null;
  manifestTried = true;
  try {
    const res = await fetch(`${APP_CHARACTER_BASE}/Data/vehicle-character-manifest.json`);
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    manifestCache = await res.json();
    return manifestCache;
  } catch {
    return null;
  }
}

function resolveAlias(manifest, characterId) {
  return (manifest?.aliases && manifest.aliases[characterId]) || characterId;
}

export function findManifestVehicle(manifest, characterId) {
  const list = Array.isArray(manifest?.vehicles) ? manifest.vehicles : [];
  const id = resolveAlias(manifest, characterId);
  return list.find((v) => v.characterId === id || v.id === id) || null;
}

/** 공식 character cutout (webp/png/svg 승인 경로) */
export function isApprovedCharacterAsset(row) {
  if (!row || typeof row !== "object") return false;
  if (row.assetType !== "character") return false;
  if (row.approved !== true) return false;
  if (row.transparent !== true) return false;
  return true;
}

function front45Views(row) {
  const v = row?.views?.front45 || row?.views?.front_45;
  if (!v) return { webp: null, png: null, svg: null };
  if (typeof v === "string") return { webp: null, png: null, svg: v };
  return {
    webp: v.webp || null,
    png: v.png || null,
    svg: v.svg || null
  };
}

async function probeAssetUrl(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "GET", cache: "force-cache" });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    return buf.byteLength > 32;
  } catch {
    return false;
  }
}

async function firstExistingUrl(paths) {
  for (const rel of paths) {
    const url = resolveAssetUrl(rel);
    if (!url) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await probeAssetUrl(url)) return url;
  }
  return null;
}

export function clearCharacterAssetCache() {
  resolvedUrlCache.clear();
  manifestCache = null;
  manifestTried = false;
}

function mountImg(hostEl, vehicle, map, stage, url, status) {
  return new Promise((resolve) => {
    hostEl.innerHTML = "";
    hostEl.hidden = false;
    hostEl.classList.add("my-character-host", "is-character-active");
    hostEl.dataset.characterId = map.characterId;
    hostEl.dataset.evolutionStage = String(stage);
    hostEl.dataset.characterAsset = url;
    hostEl.dataset.characterStatus = status || map.characterStatus || "missing";

    const img = document.createElement("img");
    img.className = "vroo-character-image my-character-image";
    img.alt = `${vehicle.name || map.characterId}`;
    img.draggable = false;
    img.decoding = "async";

    img.onload = () => {
      hostEl.dataset.characterLoaded = "1";
      const m = url.match(/\.(webp|png|svg)$/i);
      if (m) hostEl.dataset.characterFormat = m[1].toLowerCase();
      resolve(true);
    };
    img.onerror = () => {
      clearCharacterHost(hostEl);
      resolve(false);
    };
    img.src = url;
    hostEl.appendChild(img);
  });
}

/**
 * @returns {Promise<boolean>} true면 Character img 사용, false면 Three.js/premium
 */
export async function mountCharacterHero(hostEl, vehicle, opts = {}) {
  if (!hostEl || !vehicle) return false;

  const map = characterMapForVehicle(vehicle);
  if (opts.requireHeroFlag !== false && !map.useInGarageHero) {
    clearCharacterHost(hostEl);
    return false;
  }

  const manifest = await loadCharacterManifest();
  const row = manifest ? findManifestVehicle(manifest, map.characterId) : null;
  const stage = Number(row?.stage ?? row?.evolutionStage ?? map.evolutionStage) || map.evolutionStage;
  const views = front45Views(row) || { webp: null, png: null, svg: map.assetRel };

  /* 1) 승인된 character cutout만 raster 포함 로드 */
  if (isApprovedCharacterAsset(row)) {
    const cacheKey = `${map.characterId}|approved`;
    let url = resolvedUrlCache.has(cacheKey) ? resolvedUrlCache.get(cacheKey) : undefined;
    if (url === undefined) {
      url = await firstExistingUrl([views.webp, views.png, views.svg]);
      resolvedUrlCache.set(cacheKey, url);
    }
    if (url) {
      return mountImg(hostEl, vehicle, map, stage, url, "approved_character");
    }
  }

  /* 2) placeholder SVG — Hero 허용 차량만 (현재 Heritage) · webp/png 절대 사용 안 함 */
  const allowPlaceholder =
    (manifest?.garagePolicy?.allowPlaceholderSvg !== false) &&
    map.useInGarageHero &&
    (row?.assetType === "placeholder" || !isApprovedCharacterAsset(row));

  if (allowPlaceholder) {
    const svgRel = views.svg || map.assetRel;
    const cacheKey = `${map.characterId}|placeholder-svg`;
    let url = resolvedUrlCache.has(cacheKey) ? resolvedUrlCache.get(cacheKey) : undefined;
    if (url === undefined) {
      url = await firstExistingUrl([svgRel]);
      resolvedUrlCache.set(cacheKey, url);
    }
    if (url && /\.svg$/i.test(url)) {
      return mountImg(hostEl, vehicle, map, stage, url, "placeholder");
    }
  }

  clearCharacterHost(hostEl);
  return false;
}

export function clearCharacterHost(hostEl) {
  if (!hostEl) return;
  hostEl.innerHTML = "";
  hostEl.hidden = true;
  hostEl.classList.remove("is-character-active");
  delete hostEl.dataset.characterLoaded;
  delete hostEl.dataset.characterId;
  delete hostEl.dataset.characterAsset;
  delete hostEl.dataset.characterFormat;
  delete hostEl.dataset.characterStatus;
  delete hostEl.dataset.evolutionStage;
}

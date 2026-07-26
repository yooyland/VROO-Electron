/**
 * Character → app/assets/characters 동기화 (승인형)
 *
 * 복사 허용:
 * - Data/*.json (manifest 등)
 * - approved character 의 webp/png/svg
 * - placeholder 의 svg 만
 *
 * 복사 제외:
 * - Concept / Archive / Source
 * - promotional
 * - 미승인 PNG/WebP
 *
 * 사용: node scripts/sync-characters.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "Character");
const DST = path.join(ROOT, "app", "assets", "characters");
const MANIFEST = path.join(SRC, "Data", "vehicle-character-manifest.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeRel(assetPath) {
  if (!assetPath || assetPath === "null") return null;
  let p = String(assetPath).replace(/\\/g, "/");
  if (p.startsWith("Character/")) p = p.slice("Character/".length);
  return p;
}

function copyFile(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(DST, rel);
  if (!fs.existsSync(from)) return null;
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
  return path.relative(ROOT, to).replace(/\\/g, "/");
}

function syncData() {
  const dataSrc = path.join(SRC, "Data");
  const dataDst = path.join(DST, "Data");
  ensureDir(dataDst);
  const out = [];
  if (!fs.existsSync(dataSrc)) return out;
  for (const name of fs.readdirSync(dataSrc)) {
    if (!name.endsWith(".json")) continue;
    const from = path.join(dataSrc, name);
    const to = path.join(dataDst, name);
    fs.copyFileSync(from, to);
    out.push(path.relative(ROOT, to).replace(/\\/g, "/"));
  }
  return out;
}

function collectRuntimeAssets(manifest) {
  const list = [];
  const vehicles = Array.isArray(manifest?.vehicles) ? manifest.vehicles : [];
  for (const row of vehicles) {
    if (row.assetType === "concept" || row.assetType === "promotional") continue;
    const view = row.views?.front45 || row.views?.front_45 || {};
    const approved =
      row.approved === true && row.transparent === true && row.assetType === "character";

    if (approved) {
      for (const key of ["webp", "png", "svg"]) {
        const rel = normalizeRel(view[key]);
        if (rel) list.push(rel);
      }
      continue;
    }

    /* placeholder: svg only */
    if (row.assetType === "placeholder" || row.characterStatus === "missing") {
      const rel = normalizeRel(view.svg || row.asset);
      if (rel && rel.toLowerCase().endsWith(".svg")) list.push(rel);
    }
  }
  return [...new Set(list)];
}

/** 런타임에 남아 있으면 안 되는 미승인 raster 제거 */
function purgeUnapprovedRasters(manifest) {
  const removed = [];
  const allowed = new Set(collectRuntimeAssets(manifest).map((p) => p.replace(/\\/g, "/")));
  const vehiclesRoot = path.join(DST, "Vehicles");
  if (!fs.existsSync(vehiclesRoot)) return removed;

  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      const ext = path.extname(name).toLowerCase();
      if (![".webp", ".png", ".jpg", ".jpeg"].includes(ext)) continue;
      const rel = path.relative(DST, full).replace(/\\/g, "/");
      if (!allowed.has(rel)) {
        fs.unlinkSync(full);
        removed.push(rel);
      }
    }
  }
  walk(vehiclesRoot);
  return removed;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Character source missing:", SRC);
    process.exit(1);
  }
  if (!fs.existsSync(MANIFEST)) {
    console.error("Manifest missing:", MANIFEST);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  ensureDir(DST);

  const data = syncData();
  const assets = collectRuntimeAssets(manifest);
  const copied = [];
  for (const rel of assets) {
    const r = copyFile(rel);
    if (r) copied.push(r);
  }
  const purged = purgeUnapprovedRasters(manifest);

  console.log(`[sync-characters] data: ${data.length}, copied: ${copied.length}, purged: ${purged.length}`);
  for (const p of data) console.log("  data", p);
  for (const p of copied) console.log("  +", p);
  for (const p of purged) console.log("  -", p);
}

main();

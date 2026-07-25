# VROO Project State

> Last verified: 2026-07-25 · Task: **VROO-001** Repository audit  
> Path: `D:\VROO_Electron` · Branch: `ai/VROO-001-repository-audit`

## Mission

Build VROO as a location-based automotive social/game platform whose **vehicle is the user's identity and character**.

## Verified stack (on disk)

| Item | Finding |
|------|---------|
| Product | Electron desktop: User App + role-based Console |
| Package | `vroo-desktop` `1.1.0-beta.1` (`package.json`) |
| Electron (lock) | **43.2.0** (`package-lock.json` / `node_modules`); `package.json` declares `"electron": "latest"` |
| electron-builder | 26.x (lock); scripts `pack`, `build:win` |
| Frontend | Vanilla JS **ES modules** — no React/Vue, no bundler in npm scripts |
| Map / 3D | Leaflet 1.9.4 + Three.js 0.160.0 via `unpkg.com` (`app/index.html`) |
| Runtime npm deps | **None** (devDependencies only) |
| TypeScript | **Not used** (no `tsconfig`) |
| Firebase SDK | **Not installed / not wired** (docs only: `docs/FIREBASE_SCHEMA.md`) |

## Entry points

| Role | Path |
|------|------|
| Main process | `main.js` — User window default; `--console` / `--platform` flags |
| Preload | `preload.js` — `contextIsolation`, exposes `window.vrooDesktop` |
| User App | `app/index.html` → `app/assets/js/app.js` |
| Console | `console/index.html` → `console/assets/js/console-app.js` |

Prefs: `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`.

## State & data

- **User App:** `localStorage` key `vrooBeta10` via `app/assets/js/core/storage.js`
- **Garage:** `state.myGarage` hydrated in `app/assets/js/modules/my/my-data.js`
- **Console:** separate localStorage session keys + `shared/data/demo-*.js`
- **No live backend** in current runtime path

## Character system (verified)

- Source of truth: `Character/` (not in electron-builder `files`)
- Runtime mirror: `app/assets/characters/` (CSP `'self'`)
- Sync: `npm run sync:characters` → `scripts/sync-characters.js`
- Adapter: `app/assets/js/modules/my/character-adapter.js` (approval: `approved` + `transparent` + `assetType === "character"`)
- Invalid promo assets: `Character/Archive/Invalid_Heritage_Assets/`

## npm scripts

| Script | Status |
|--------|--------|
| `start` / `dev` | `electron .` |
| `console` / `dev:platform` | Console / dual window |
| `sync:characters` | Character → app assets |
| `pack` / `build:win` | electron-builder |
| `lint` | **Missing** |
| `typecheck` | **Missing** |
| `test` | **Missing** (no test files found) |
| `build` | **Missing** (use `pack` / `build:win`) |

## Baseline check (`scripts/ai-check.ps1`)

Runs `npm run lint|typecheck|test|build` **only if defined**, then `git diff --check`.

**Current behavior:** all four npm targets are skipped; pass/fail depends on `git diff --check`.

### Safe assumption (VROO-001)

Until VROO-002 adds real lint/test/build wiring, “verification passed” means: package.json present + skipped missing scripts + clean `git diff --check` on the committed diff. This is **not** full product QA.

## Known risks / errors (observed)

1. `electron: "latest"` — version can drift; lock currently pins 43.2.0.
2. `package-lock.json` root version text may not match `package.json` `1.1.0-beta.1`.
3. User App CSP allows `unpkg.com` + `'unsafe-inline'` — offline CDN failure risk.
4. Packaged builds must include synced `app/assets/characters`; raw `Character/` is excluded from builder `files`.
5. No automated unit/UI tests.
6. Extra trees on disk: `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/`, optional `node_modules_tmp_sharp/` (cleanup candidates — not removed in VROO-001).
7. Root `README.md` currently Character-pack oriented; Electron run guide is stronger in `README_KO.md`.

## Current known priorities

1. Stabilize project and establish reproducible checks (**VROO-001 → VROO-002**).
2. Chat-room navigation / history UX (VROO-101).
3. My Page section clarity (VROO-102).
4. Automotive Character Bible / approved assets (VROO-201).
5. Map / grid / road interaction reliability.

## Product principles

- The vehicle is identity, progression, and social presence — not decoration.
- Nickname first; plate data protected by product rules.
- Driving UX minimizes distraction.
- Every visible control must work or be marked unavailable.

## Update log

- Bootstrap created: AI workflow rules, task queue, and checks.
- **2026-07-25 VROO-001:** Verified Electron/vanilla structure, entry points, localStorage state, missing lint/test/build scripts, Character sync path, and `ai-check.ps1` baseline behavior. No feature redesign.
- **ai-check:** `scripts/ai-check.ps1` **passed** after minimal whitespace/EOF fixes (`docs/PRODUCT_VISION.md`, `app/assets/css/app.css`).
- **Branch:** `ai/VROO-001-repository-audit` pushed to `origin`. Draft PR requires GitHub auth (`gh auth login`) if CLI was not logged in; compare URL: `https://github.com/yooyland/VROO-Electron/compare/main...ai/VROO-001-repository-audit?expand=1`

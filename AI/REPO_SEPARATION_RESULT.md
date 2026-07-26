# REPO SEPARATION RESULT

Task: **REPO-001**  
Branch: `foundation/v1.0-operational-20260726-221332`  
HEAD: `c6fe516`  
Generated: 2026-07-26 (plan only — **no commits executed**)  
Source plan: `AI/REPOSITORY_COMMIT_PLAN.md`  
Working tree: `git status --porcelain -uall` → **281** paths (plan listed **275**)

## Method

1. Read `AI/REPOSITORY_COMMIT_PLAN.md` (11 proposed commits).
2. Enumerate current working tree with `git status --porcelain -uall`.
3. Diff plan ↔ working tree (Node compare).
4. Reorder so **Commit Group 1 = AI Foundation / Project Brain / Orchestrator only**.
5. Flag duplicates, generated, obsolete, ambiguous, and do-not-commit paths.

### Coverage check

| Metric | Count |
|--------|------:|
| Working-tree paths | 281 |
| Paths in REPOSITORY_COMMIT_PLAN | 275 |
| In plan, missing from WT | **0** |
| In WT, missing from plan | **6** (see Do-not-commit / Generated) |
| Deleted in WT | 1 (`.cursor/rules/vroo-domain.mdc`) |

---

## Recommended branch strategy

Stay on **`foundation/v1.0-operational-20260726-221332`**.

Optional later (owner decision — not done here):

| Branch (suggested) | Purpose |
|--------------------|---------|
| *(current)* | Sequential commits 1→N on foundation branch |
| `chore/ai-foundation` | If Group 1 must be isolated PR first |
| `feat/character-system` | Groups Character + Garage if PR size must shrink |
| `chore/bootstrap-archive` | Only `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/` |

**Do not** merge to `main` autonomously. **Do not** force-push.

---

## Recommended commit order

Execute **in this order** after human review. Staging example:

```powershell
# Group N example (do not run batch until reviewed)
git add -- <exact-files-from-group>
git status
git commit -m "<message>"
```

---

## Commit Group 1 — AI Foundation / Project Brain / Orchestrator

**Must be first.**  
Message: `chore(ai): add project brain, orchestrator, and foundation OS`

Exact files:

### AI root (operations)
- `AI/WORK_QUEUE.md`
- `AI/CURRENT_TASK.json`
- `AI/CURSOR_TASK_INSTRUCTION.md`
- `AI/DEPENDENCY_GRAPH.json`
- `AI/DEPENDENCY_GRAPH.md`
- `AI/EXECUTION_PLAN.json`
- `AI/EXECUTION_PLAN.md`
- `AI/NEXT_ACTION.md`
- `AI/ORCHESTRATOR_REPORT.md`
- `AI/PROJECT_BRAIN.json`
- `AI/PROJECT_DASHBOARD.md`
- `AI/PROJECT_MEMORY_REPORT.md`
- `AI/REPOSITORY_COMMIT_PLAN.md`
- `AI/VALIDATION_PLAN.md`
- `AI/REPO_SEPARATION_RESULT.md` *(this document — add when committing Group 1)*

### Brain / memory / policies
- `AI/brain/AREAS.json`
- `AI/brain/BRAIN_RULES.md`
- `AI/brain/TASK_CATALOG.json`
- `AI/brain-v1-backup-20260726-223101/AREAS.json`
- `AI/brain-v1-backup-20260726-223101/BRAIN_RULES.md`
- `AI/brain-v1-backup-20260726-223101/TASK_CATALOG.json`
- `AI/dependency/DEPENDENCY_RULES.json`
- `AI/memory/MEMORY_SCHEMA.json`
- `AI/memory/PROJECT_MEMORY.json`
- `AI/orchestrator/ORCHESTRATOR_POLICY.json`
- `AI/orchestrator/ORCHESTRATOR_RULES.md`
- `AI/os/OS_MANIFEST.json`
- `AI/os/OS_RULES.md`
- `AI/planner/PLANNER_POLICY.json`
- `AI/reviewer/REVIEW_POLICY.json`

### Reports (generated scans — include only if keeping history)
- `AI/reports/BRAIN_V2_SCAN_20260726-223109.md`
- `AI/reports/BRAIN_V2_SCAN_20260726-223658.md`
- `AI/reports/BRAIN_V2_SCAN_20260726-223734.md`
- `AI/reports/BRAIN_V2_SCAN_20260726-224455.md`
- `AI/reports/BRAIN_V2_SCAN_20260726-224456.md` *(in WT, missing from original plan)*

### Scripts (brain / orchestrator / OS)
- `scripts/brain/Scan-ProjectBrain.ps1`
- `scripts/brain/Scan-ProjectBrain.ps1.v1.0-backup`
- `scripts/brain/Scan-ProjectBrain.ps1.v1.0.2-backup`
- `scripts/brain/Sync-BrainQueue.ps1`
- `scripts/brain/vroo-brain.ps1`
- `scripts/dependency/Build-DependencyGraph.ps1`
- `scripts/memory/Update-ProjectMemory.ps1`
- `scripts/orchestrator/Generate-ExecutionPackage.ps1`
- `scripts/orchestrator/Select-NextTask.ps1`
- `scripts/orchestrator/vroo-orchestrator.ps1`
- `scripts/os/vroo-ai-os.ps1`
- `scripts/planner/Create-ExecutionPlan.ps1`
- `scripts/reviewer/Review-Execution.ps1`

**Note:** Original plan put orchestrator scripts in “Repository” leftovers. They belong here with Group 1.

---

## Commit Group 2 — Architecture docs

Message: `docs(architecture): establish VROO system documentation`

- `docs/API_GUIDE.md`
- `docs/ARCHITECTURE_BIBLE.md`
- `docs/DATA_MODEL.md`
- `docs/FIREBASE_SCHEMA.md`
- `docs/ROADMAP.md`
- `docs/UI_FLOW.md`

---

## Commit Group 3 — Cursor rules

Message: `chore(cursor): update VROO development rules`

- `.cursor/rules/project-boundary.mdc` *(modified)*
- `.cursor/rules/vroo-dev-workflow.mdc` *(modified)*
- `.cursor/rules/vroo-domain.mdc` *(deleted — stage as deletion)*
- `.cursor/rules/00-vroo-core.mdc`
- `.cursor/rules/01-design.mdc`
- `.cursor/rules/02-ui.mdc`
- `.cursor/rules/03-domain.mdc`
- `.cursor/rules/04-server.mdc`
- `.cursor/rules/05-game-system.mdc`
- `.cursor/rules/06-reuse.mdc`
- `.cursor/rules/07-character-system.mdc`
- `.cursor/rules/10-ui-ux.mdc`
- `.cursor/rules/20-safe-engineering.mdc`
- `CURSOR_INSTALL_PROMPT.txt`
- `START_CURSOR_AGENT.txt`

---

## Commit Group 4 — Character system (source + runtime mirror)

Message: `feat(characters): add character source and runtime assets`

All paths from original Commit 3 in `REPOSITORY_COMMIT_PLAN.md`, including:

- Entire `Character/**` tree listed in the plan
- `app/assets/characters/**` listed in the plan
- `scripts/sync-characters.js`

*(Exact file list = plan Commit 3 — 160+ paths; not re-pasted here to avoid drift — use plan § Commit 3 as the checklist when staging.)*

**Staging tip:**

```powershell
git add -- Character app/assets/characters scripts/sync-characters.js
git status
```

Then unstage any path listed under **Do-not-commit** if accidentally included.

---

## Commit Group 5 — Garage / MY modules

Message: `feat(garage): implement garage and my-page modules`

- `app/assets/css/my-garage.css`
- `app/assets/js/modules/my/accessory.js`
- `app/assets/js/modules/my/achievements.js`
- `app/assets/js/modules/my/character-adapter.js`
- `app/assets/js/modules/my/collection.js`
- `app/assets/js/modules/my/custom.js`
- `app/assets/js/modules/my/friends.js`
- `app/assets/js/modules/my/garage-interact.js`
- `app/assets/js/modules/my/garage-stage.js`
- `app/assets/js/modules/my/garage.js`
- `app/assets/js/modules/my/inventory.js`
- `app/assets/js/modules/my/missions.js`
- `app/assets/js/modules/my/my-data.js`
- `app/assets/js/modules/my/my-shell.js`
- `app/assets/js/modules/my/profile-form.js`
- `app/assets/js/modules/my/records.js`
- `app/assets/js/modules/my/upgrade.js`
- `app/assets/js/modules/my/vehicle-premium-svg.js`

**Dependency:** Prefer after Group 4 (adapter expects characters mirror).

---

## Commit Group 6 — Chat

Message: `feat(chat): improve conversation and road chat behavior`

- `app/assets/js/modules/chat.js`
- `app/assets/js/modules/conversation-store.js`
- `app/assets/js/modules/road-chat.js`

---

## Commit Group 7 — Core UI shell

Message: `feat(ui): refine core application interface`

- `app/assets/js/app.js`
- `app/index.html`

**Note:** May link Garage CSS / MY shell — verify after Groups 5–6.

---

## Commit Group 8 — Profile entry

Message: `feat(profile): reorganize profile and my-page experience`

- `app/assets/js/modules/profile.js`

---

## Commit Group 9 — Storage / local data

Message: `feat(data): update storage and firebase model`

- `app/assets/js/core/storage.js`

*(Message retained from plan; runtime remains localStorage — no Firebase SDK wired.)*

---

## Commit Group 10 — Build / delivery

Message: `chore(build): update package and delivery configuration`

- `package.json`

---

## Commit Group 11 — Repository leftovers

Message: `chore(repo): organize remaining repository changes`

- `README.md`
- `.github/pull_request_template.md`
- `preview.html`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.cursor/rules/00-vroo-core.mdc`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.cursor/rules/10-ui-ux.mdc`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.cursor/rules/20-safe-engineering.mdc`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.github/pull_request_template.md`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.github/workflows/verify.yml`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/AGENTS.md`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/INSTALL.ps1`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/START_CURSOR_AGENT.txt`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/docs/AI_TASK_QUEUE.md`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/docs/VROO_PROJECT_STATE.md`
- `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/scripts/ai-check.ps1`

**Ambiguous:** Bootstrap pack duplicates live `AGENTS.md` / ai-check / rules. Prefer **archive-as-vendor** or keep out of product history unless intentional.

---

## Duplicated / generated / obsolete / ambiguous

### Duplicated
| Item | Notes |
|------|--------|
| `Character/Archive/rejected-promo-heritage/` vs `Invalid_Heritage_Assets/` | Same rejected promo story; assets live under Invalid; rejected folder may only have `REJECTED.md` |
| `front-45.svg` and `front_45.svg` | Parallel naming in several vehicle view folders |
| `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/**` vs live AI/docs/rules | Near-duplicate bootstrap kit |
| Concept PNGs under `Character/Concept/` | Design refs — not runtime |

### Generated
| Item | Notes |
|------|--------|
| `AI/reports/BRAIN_V2_SCAN_*.md` | Scan outputs; safe to keep or prune later |
| `AI/DEPENDENCY_GRAPH.json` / `.md` | Likely regenerable via `Build-DependencyGraph.ps1` |
| `AI/EXECUTION_PLAN.*`, `AI/NEXT_ACTION.md`, `AI/ORCHESTRATOR_REPORT.md` | Orchestrator outputs |

### Obsolete / backup
| Item | Notes |
|------|--------|
| `scripts/brain/*.v1.0*-backup` | Keep only if needed for rollback |
| `AI/brain-v1-backup-*` | Brain v1 snapshot |
| `.cursor/rules/vroo-domain.mdc` | **Deleted**; replaced by `03-domain.mdc` family |

### Ambiguous (owner decision before commit)
| Item | Recommendation |
|------|----------------|
| Bootstrap pack in Group 11 | Separate archive commit **or** omit from this foundation branch |
| Binary `.docx` / large PNGs / rejected webp|png | Confirm license/size; rejected assets already marked Invalid |
| `preview.html` | Confirm still used |
| `storage.js` commit message “firebase” | Rename message when committing if desired |

### Do-not-commit (agent scratch — not product)
- `AI/_compare_plan.js`
- `AI/_compare_plan.json`
- `AI/_git_status_snapshot.txt`
- `AI/_wt_all.txt`
- `AI/_wt_raw.txt`
- `AI/_wt_files.txt` *(if present)*
- `AI/_wt_utf8.txt` *(if present)*

These were created during REPO-001 analysis. **Exclude from all groups.**

---

## Verification commands

Run **after each group** (and before any push):

```powershell
cd D:\VROO_Electron

# Identity
git branch --show-current
git rev-parse HEAD

# Staging hygiene
git status --short
git diff --cached --stat
git diff --check
git diff --cached --check

# Ensure scratch not staged
git status --short | Select-String '_compare|_wt_|_git_status'

# Optional baseline (skips missing lint/test/build)
powershell -ExecutionPolicy Bypass -File scripts/ai-check.ps1

# Character sync sanity (after Group 4)
node scripts/sync-characters.js

# Spot-check JS syntax for Garage/Chat groups
node --check app/assets/js/modules/my/character-adapter.js
node --check app/assets/js/modules/my/garage.js
node --check app/assets/js/modules/chat.js
```

**Acceptance for REPO-001 (this task):** separation plan document exists; no auto-commit; every WT product file mapped; scratch files called out.

---

## Mapping from original plan → this order

| Original plan commit | New group |
|----------------------|-----------|
| 8 Foundation (+ orchestrator scripts from 11) | **1** |
| 1 Architecture | **2** |
| 6 Cursor Rules | **3** |
| 3 Character | **4** |
| 9 Garage | **5** |
| 4 Chat | **6** |
| 5 Core UI | **7** |
| 10 Profile | **8** |
| 7 Storage | **9** |
| 2 Build | **10** |
| 11 Repository (minus scripts moved to 1) | **11** |

---

## Constraints honored

- No `git reset` / `git clean` / merge / commit
- No deletion of user product work
- UTF-8 documentation
- Stop before destructive decisions (bootstrap pack / binary assets left as owner choices)

## Risk

- VROO_AI_AUTOMATION_BOOTSTRAP_v1.0 중복 키트의 보관 여부는 소유자 결정이 필요하다.
- rejected-promo-heritage와 Invalid_Heritage_Assets의 중복 Archive 정책을 결정해야 한다.
- front-45.svg와 front_45.svg 파일명 표준화가 필요하다.
- Group 11 바이너리 및 홍보 이미지의 보관 정책을 결정해야 한다.

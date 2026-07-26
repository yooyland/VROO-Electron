# VROO PROJECT DASHBOARD v2.0

- Generated: 2026-07-26T22:55:20.2479498+09:00
- Branch: `foundation/v1.0-operational-20260726-221332`
- HEAD: `c6fe516`
- Overall operational confidence: **73%**
- Changed entries: **288**
- Tracked files: **134**

## Area status

| Area | Score | Signals | Git integration | Queue | Risk readiness | Changes |
|---|---:|---:|---:|---:|---:|---:|
| Architecture | 57% | 100% | 0% | 50% | 60% | 6 |
| Garage | 57% | 100% | 0% | 50% | 60% | 18 |
| Character System | 57% | 100% | 0% | 50% | 60% | 168 |
| Foundation | 72% | 100% | 100% | 0% | 60% | 50 |
| Firebase / Data | 78% | 100% | 50% | 50% | 100% | 1 |
| Profile / My Page | 78% | 100% | 50% | 50% | 100% | 1 |
| Build / Delivery | 90% | 100% | 100% | 50% | 100% | 1 |
| Core UI | 90% | 100% | 100% | 50% | 100% | 2 |
| Chat | 90% | 100% | 100% | 50% | 100% | 3 |

## Repository change groups

### Architecture ??6 files

Suggested commit: `docs(architecture): establish VROO system documentation`

- `??` `docs/API_GUIDE.md`
- `??` `docs/ARCHITECTURE_BIBLE.md`
- `??` `docs/DATA_MODEL.md`
- `??` `docs/FIREBASE_SCHEMA.md`
- `??` `docs/ROADMAP.md`
- `??` `docs/UI_FLOW.md`

### Build / Delivery ??1 files

Suggested commit: `chore(build): update package and delivery configuration`

- ` M` `package.json`

### Character System ??168 files

Suggested commit: `feat(characters): add character source and runtime assets`

- `??` `Character/Archive/.gitkeep`
- `??` `Character/Archive/Invalid_Heritage_Assets/README.md`
- `??` `Character/Archive/Invalid_Heritage_Assets/REJECTED.md`
- `??` `Character/Archive/Invalid_Heritage_Assets/views/front_45.png`
- `??` `Character/Archive/Invalid_Heritage_Assets/views/front_45.webp`
- `??` `Character/Archive/rejected-promo-heritage/REJECTED.md`
- `??` `Character/Audio/Engine/.gitkeep`
- `??` `Character/Audio/Horn/.gitkeep`
- `??` `Character/Bible/ASSET_NAMING_RULES.md`
- `??` `Character/Bible/CHARACTER_BIBLE.md`
- `??` `Character/Bible/PRODUCTION_CHECKLIST.md`
- `??` `Character/Concept/.gitkeep`
- `??` `Character/Concept/Heritage/heritage_hex_ref.png`
- `??` `Character/Concept/Heritage/heritage_showroom_ref.png`
- `??` `Character/Concept/a_clean_high_fidelity_game_ui_concept_art_poster.png`
- `??` `Character/Concept/a_high_end_glossy_game_ui_dashboard_screenshot_on.png`
- `??` `Character/Data/vehicle-character-manifest.json`
- `??` `Character/Data/vehicle-evolution.json`
- `??` `Character/Data/vehicle-layer-schema.json`
- `??` `Character/Effects/Glow/.gitkeep`
- `??` `Character/Effects/Reflection/.gitkeep`
- `??` `Character/Effects/Shadow/.gitkeep`
- `??` `Character/Exports/png/.gitkeep`
- `??` `Character/Exports/svg/.gitkeep`
- `??` `Character/Exports/webp/.gitkeep`
- `??` `Character/Integration/INTEGRATION_GUIDE.md`
- `??` `Character/Integration/css/vroo-character.css`
- `??` `Character/Integration/examples/garage-character-demo.html`
- `??` `Character/Integration/js/vroo-character-loader.js`
- `??` `Character/Parts/BodyKits/.gitkeep`
- `??` `Character/Parts/Lights/.gitkeep`
- `??` `Character/Parts/Paints/.gitkeep`
- `??` `Character/Parts/Spoilers/.gitkeep`
- `??` `Character/Parts/Stickers/.gitkeep`
- `??` `Character/Parts/Wheels/.gitkeep`
- `??` `Character/README.md`
- `??` `Character/SETUP_CHARACTER_FOLDER.ps1`
- `??` `Character/Source/.gitkeep`
- `??` `Character/UI/Badges/.gitkeep`
- `??` `Character/UI/Icons/.gitkeep`
- `??` `Character/UI/Thumbnails/.gitkeep`
- `??` `Character/VROO_Character_Bible_v0.1.docx`
- `??` `Character/Vehicles/01_Basic/README.md`
- `??` `Character/Vehicles/01_Basic/layers/body.svg`
- `??` `Character/Vehicles/01_Basic/layers/door_left.svg`
- `??` `Character/Vehicles/01_Basic/layers/door_right.svg`
- `??` `Character/Vehicles/01_Basic/layers/glass.svg`
- `??` `Character/Vehicles/01_Basic/layers/headlight.svg`
- `??` `Character/Vehicles/01_Basic/layers/reflection.svg`
- `??` `Character/Vehicles/01_Basic/layers/shadow.svg`
- `??` `Character/Vehicles/01_Basic/layers/spoiler.svg`
- `??` `Character/Vehicles/01_Basic/layers/taillight.svg`
- `??` `Character/Vehicles/01_Basic/layers/wheel_front.svg`
- `??` `Character/Vehicles/01_Basic/layers/wheel_rear.svg`
- `??` `Character/Vehicles/01_Basic/views/front-45.svg`
- `??` `Character/Vehicles/01_Basic/views/front.svg`
- `??` `Character/Vehicles/01_Basic/views/front_45.svg`
- `??` `Character/Vehicles/01_Basic/views/rear.svg`
- `??` `Character/Vehicles/01_Basic/views/rear_45.svg`
- `??` `Character/Vehicles/01_Basic/views/side.svg`
- `??` `Character/Vehicles/02_Street/README.md`
- `??` `Character/Vehicles/02_Street/layers/body.svg`
- `??` `Character/Vehicles/02_Street/layers/door_left.svg`
- `??` `Character/Vehicles/02_Street/layers/door_right.svg`
- `??` `Character/Vehicles/02_Street/layers/glass.svg`
- `??` `Character/Vehicles/02_Street/layers/headlight.svg`
- `??` `Character/Vehicles/02_Street/layers/reflection.svg`
- `??` `Character/Vehicles/02_Street/layers/shadow.svg`
- `??` `Character/Vehicles/02_Street/layers/spoiler.svg`
- `??` `Character/Vehicles/02_Street/layers/taillight.svg`
- `??` `Character/Vehicles/02_Street/layers/wheel_front.svg`
- `??` `Character/Vehicles/02_Street/layers/wheel_rear.svg`
- `??` `Character/Vehicles/02_Street/views/front-45.svg`
- `??` `Character/Vehicles/02_Street/views/front.svg`
- `??` `Character/Vehicles/02_Street/views/front_45.svg`
- `??` `Character/Vehicles/02_Street/views/rear.svg`
- `??` `Character/Vehicles/02_Street/views/rear_45.svg`
- `??` `Character/Vehicles/02_Street/views/side.svg`
- `??` `Character/Vehicles/03_Sport/README.md`
- `??` `Character/Vehicles/03_Sport/layers/body.svg`
- `??` `Character/Vehicles/03_Sport/layers/door_left.svg`
- `??` `Character/Vehicles/03_Sport/layers/door_right.svg`
- `??` `Character/Vehicles/03_Sport/layers/glass.svg`
- `??` `Character/Vehicles/03_Sport/layers/headlight.svg`
- `??` `Character/Vehicles/03_Sport/layers/reflection.svg`
- `??` `Character/Vehicles/03_Sport/layers/shadow.svg`
- `??` `Character/Vehicles/03_Sport/layers/spoiler.svg`
- `??` `Character/Vehicles/03_Sport/layers/taillight.svg`
- `??` `Character/Vehicles/03_Sport/layers/wheel_front.svg`
- `??` `Character/Vehicles/03_Sport/layers/wheel_rear.svg`
- `??` `Character/Vehicles/03_Sport/views/front-45.svg`
- `??` `Character/Vehicles/03_Sport/views/front.svg`
- `??` `Character/Vehicles/03_Sport/views/front_45.svg`
- `??` `Character/Vehicles/03_Sport/views/rear.svg`
- `??` `Character/Vehicles/03_Sport/views/rear_45.svg`
- `??` `Character/Vehicles/03_Sport/views/side.svg`
- `??` `Character/Vehicles/04_Performance/README.md`
- `??` `Character/Vehicles/04_Performance/layers/body.svg`
- `??` `Character/Vehicles/04_Performance/layers/door_left.svg`
- `??` `Character/Vehicles/04_Performance/layers/door_right.svg`
- `??` `Character/Vehicles/04_Performance/layers/glass.svg`
- `??` `Character/Vehicles/04_Performance/layers/headlight.svg`
- `??` `Character/Vehicles/04_Performance/layers/reflection.svg`
- `??` `Character/Vehicles/04_Performance/layers/shadow.svg`
- `??` `Character/Vehicles/04_Performance/layers/spoiler.svg`
- `??` `Character/Vehicles/04_Performance/layers/taillight.svg`
- `??` `Character/Vehicles/04_Performance/layers/wheel_front.svg`
- `??` `Character/Vehicles/04_Performance/layers/wheel_rear.svg`
- `??` `Character/Vehicles/04_Performance/views/front-45.svg`
- `??` `Character/Vehicles/04_Performance/views/front.svg`
- `??` `Character/Vehicles/04_Performance/views/front_45.svg`
- `??` `Character/Vehicles/04_Performance/views/rear.svg`
- `??` `Character/Vehicles/04_Performance/views/rear_45.svg`
- `??` `Character/Vehicles/04_Performance/views/side.svg`
- `??` `Character/Vehicles/05_Heritage/README.md`
- `??` `Character/Vehicles/05_Heritage/layers/body.svg`
- `??` `Character/Vehicles/05_Heritage/layers/door_left.svg`
- `??` `Character/Vehicles/05_Heritage/layers/door_right.svg`
- `??` `Character/Vehicles/05_Heritage/layers/glass.svg`
- `??` `Character/Vehicles/05_Heritage/layers/headlight.svg`
- `??` `Character/Vehicles/05_Heritage/layers/reflection.svg`
- `??` `Character/Vehicles/05_Heritage/layers/shadow.svg`
- `??` `Character/Vehicles/05_Heritage/layers/spoiler.svg`
- `??` `Character/Vehicles/05_Heritage/layers/taillight.svg`
- `??` `Character/Vehicles/05_Heritage/layers/wheel_front.svg`
- `??` `Character/Vehicles/05_Heritage/layers/wheel_rear.svg`
- `??` `Character/Vehicles/05_Heritage/views/front-45.svg`
- `??` `Character/Vehicles/05_Heritage/views/front.svg`
- `??` `Character/Vehicles/05_Heritage/views/front_45.svg`
- `??` `Character/Vehicles/05_Heritage/views/rear.svg`
- `??` `Character/Vehicles/05_Heritage/views/rear_45.svg`
- `??` `Character/Vehicles/05_Heritage/views/side.svg`
- `??` `Character/images/VROO_Vehicle_Evolution_Concept.png`
- `??` `app/assets/characters/Data/vehicle-character-manifest.json`
- `??` `app/assets/characters/Data/vehicle-evolution.json`
- `??` `app/assets/characters/Data/vehicle-layer-schema.json`
- `??` `app/assets/characters/README.md`
- `??` `app/assets/characters/Vehicles/01_Basic/views/front-45.svg`
- `??` `app/assets/characters/Vehicles/01_Basic/views/front.svg`
- `??` `app/assets/characters/Vehicles/01_Basic/views/front_45.svg`
- `??` `app/assets/characters/Vehicles/01_Basic/views/rear.svg`
- `??` `app/assets/characters/Vehicles/01_Basic/views/rear_45.svg`
- `??` `app/assets/characters/Vehicles/01_Basic/views/side.svg`
- `??` `app/assets/characters/Vehicles/02_Street/views/front-45.svg`
- `??` `app/assets/characters/Vehicles/02_Street/views/front.svg`
- `??` `app/assets/characters/Vehicles/02_Street/views/front_45.svg`
- `??` `app/assets/characters/Vehicles/02_Street/views/rear.svg`
- `??` `app/assets/characters/Vehicles/02_Street/views/rear_45.svg`
- `??` `app/assets/characters/Vehicles/02_Street/views/side.svg`
- `??` `app/assets/characters/Vehicles/03_Sport/views/front-45.svg`
- `??` `app/assets/characters/Vehicles/03_Sport/views/front.svg`
- `??` `app/assets/characters/Vehicles/03_Sport/views/front_45.svg`
- `??` `app/assets/characters/Vehicles/03_Sport/views/rear.svg`
- `??` `app/assets/characters/Vehicles/03_Sport/views/rear_45.svg`
- `??` `app/assets/characters/Vehicles/03_Sport/views/side.svg`
- `??` `app/assets/characters/Vehicles/04_Performance/views/front-45.svg`
- `??` `app/assets/characters/Vehicles/04_Performance/views/front.svg`
- `??` `app/assets/characters/Vehicles/04_Performance/views/front_45.svg`
- `??` `app/assets/characters/Vehicles/04_Performance/views/rear.svg`
- `??` `app/assets/characters/Vehicles/04_Performance/views/rear_45.svg`
- `??` `app/assets/characters/Vehicles/04_Performance/views/side.svg`
- `??` `app/assets/characters/Vehicles/05_Heritage/views/front-45.svg`
- `??` `app/assets/characters/Vehicles/05_Heritage/views/front.svg`
- `??` `app/assets/characters/Vehicles/05_Heritage/views/front_45.svg`
- `??` `app/assets/characters/Vehicles/05_Heritage/views/rear.svg`
- `??` `app/assets/characters/Vehicles/05_Heritage/views/rear_45.svg`
- `??` `app/assets/characters/Vehicles/05_Heritage/views/side.svg`
- `??` `scripts/sync-characters.js`

### Chat ??3 files

Suggested commit: `feat(chat): improve conversation and road chat behavior`

- ` M` `app/assets/js/modules/chat.js`
- ` M` `app/assets/js/modules/conversation-store.js`
- ` M` `app/assets/js/modules/road-chat.js`

### Core UI ??2 files

Suggested commit: `feat(ui): refine core application interface`

- ` M` `app/assets/js/app.js`
- ` M` `app/index.html`

### Cursor Rules ??15 files

Suggested commit: `chore(cursor): update VROO development rules`

- ` M` `.cursor/rules/project-boundary.mdc`
- ` M` `.cursor/rules/vroo-dev-workflow.mdc`
- ` D` `.cursor/rules/vroo-domain.mdc`
- `??` `.cursor/rules/00-vroo-core.mdc`
- `??` `.cursor/rules/01-design.mdc`
- `??` `.cursor/rules/02-ui.mdc`
- `??` `.cursor/rules/03-domain.mdc`
- `??` `.cursor/rules/04-server.mdc`
- `??` `.cursor/rules/05-game-system.mdc`
- `??` `.cursor/rules/06-reuse.mdc`
- `??` `.cursor/rules/07-character-system.mdc`
- `??` `.cursor/rules/10-ui-ux.mdc`
- `??` `.cursor/rules/20-safe-engineering.mdc`
- `??` `CURSOR_INSTALL_PROMPT.txt`
- `??` `START_CURSOR_AGENT.txt`

### Firebase / Data ??1 files

Suggested commit: `feat(data): update storage and firebase model`

- ` M` `app/assets/js/core/storage.js`

### Foundation ??50 files

Suggested commit: `feat(ai): upgrade project brain and foundation operations`

- ` M` `AI/WORK_QUEUE.md`
- `??` `AI/CURRENT_TASK.json`
- `??` `AI/CURSOR_TASK_INSTRUCTION.md`
- `??` `AI/DEPENDENCY_GRAPH.json`
- `??` `AI/DEPENDENCY_GRAPH.md`
- `??` `AI/EXECUTION_PLAN.json`
- `??` `AI/EXECUTION_PLAN.md`
- `??` `AI/NEXT_ACTION.md`
- `??` `AI/ORCHESTRATOR_REPORT.md`
- `??` `AI/PROJECT_BRAIN.json`
- `??` `AI/PROJECT_DASHBOARD.md`
- `??` `AI/PROJECT_MEMORY_REPORT.md`
- `??` `AI/REPOSITORY_COMMIT_PLAN.md`
- `??` `AI/REPO_SEPARATION_RESULT.md`
- `??` `AI/REVIEW_RESULT.json`
- `??` `AI/REVIEW_RESULT.md`
- `??` `AI/VALIDATION_PLAN.md`
- `??` `AI/_compare_plan.js`
- `??` `AI/_compare_plan.json`
- `??` `AI/_git_status_snapshot.txt`
- `??` `AI/_wt_all.txt`
- `??` `AI/_wt_raw.txt`
- `??` `AI/brain-v1-backup-20260726-223101/AREAS.json`
- `??` `AI/brain-v1-backup-20260726-223101/BRAIN_RULES.md`
- `??` `AI/brain-v1-backup-20260726-223101/TASK_CATALOG.json`
- `??` `AI/brain/AREAS.json`
- `??` `AI/brain/BRAIN_RULES.md`
- `??` `AI/brain/TASK_CATALOG.json`
- `??` `AI/dependency/DEPENDENCY_RULES.json`
- `??` `AI/memory/MEMORY_SCHEMA.json`
- `??` `AI/memory/PROJECT_MEMORY.json`
- `??` `AI/orchestrator/ORCHESTRATOR_POLICY.json`
- `??` `AI/orchestrator/ORCHESTRATOR_RULES.md`
- `??` `AI/os/OS_MANIFEST.json`
- `??` `AI/os/OS_RULES.md`
- `??` `AI/planner/PLANNER_POLICY.json`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-223109.md`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-223658.md`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-223734.md`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-224455.md`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-224456.md`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-224949.md`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-224951.md`
- `??` `AI/reports/BRAIN_V2_SCAN_20260726-225306.md`
- `??` `AI/reviewer/REVIEW_POLICY.json`
- `??` `scripts/brain/Scan-ProjectBrain.ps1`
- `??` `scripts/brain/Scan-ProjectBrain.ps1.v1.0-backup`
- `??` `scripts/brain/Scan-ProjectBrain.ps1.v1.0.2-backup`
- `??` `scripts/brain/Sync-BrainQueue.ps1`
- `??` `scripts/brain/vroo-brain.ps1`

### Garage ??18 files

Suggested commit: `feat(garage): implement garage and my-page modules`

- `??` `app/assets/css/my-garage.css`
- `??` `app/assets/js/modules/my/accessory.js`
- `??` `app/assets/js/modules/my/achievements.js`
- `??` `app/assets/js/modules/my/character-adapter.js`
- `??` `app/assets/js/modules/my/collection.js`
- `??` `app/assets/js/modules/my/custom.js`
- `??` `app/assets/js/modules/my/friends.js`
- `??` `app/assets/js/modules/my/garage-interact.js`
- `??` `app/assets/js/modules/my/garage-stage.js`
- `??` `app/assets/js/modules/my/garage.js`
- `??` `app/assets/js/modules/my/inventory.js`
- `??` `app/assets/js/modules/my/missions.js`
- `??` `app/assets/js/modules/my/my-data.js`
- `??` `app/assets/js/modules/my/my-shell.js`
- `??` `app/assets/js/modules/my/profile-form.js`
- `??` `app/assets/js/modules/my/records.js`
- `??` `app/assets/js/modules/my/upgrade.js`
- `??` `app/assets/js/modules/my/vehicle-premium-svg.js`

### Profile / My Page ??1 files

Suggested commit: `feat(profile): reorganize profile and my-page experience`

- ` M` `app/assets/js/modules/profile.js`

### Repository ??23 files

Suggested commit: `chore(repo): organize remaining repository changes`

- ` M` `README.md`
- `??` `.github/pull_request_template.md`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.cursor/rules/00-vroo-core.mdc`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.cursor/rules/10-ui-ux.mdc`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.cursor/rules/20-safe-engineering.mdc`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.github/pull_request_template.md`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/.github/workflows/verify.yml`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/AGENTS.md`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/INSTALL.ps1`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/START_CURSOR_AGENT.txt`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/docs/AI_TASK_QUEUE.md`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/docs/VROO_PROJECT_STATE.md`
- `??` `VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/scripts/ai-check.ps1`
- `??` `preview.html`
- `??` `scripts/dependency/Build-DependencyGraph.ps1`
- `??` `scripts/memory/Update-ProjectMemory.ps1`
- `??` `scripts/orchestrator/Generate-ExecutionPackage.ps1`
- `??` `scripts/orchestrator/Select-NextTask.ps1`
- `??` `scripts/orchestrator/vroo-orchestrator.ps1`
- `??` `scripts/os/vroo-ai-os.ps1`
- `??` `scripts/planner/Create-ExecutionPlan.ps1`
- `??` `scripts/reviewer/Review-Execution.ps1`
- `??` `scripts/reviewer/Review-Execution.ps1.broken-backup-20260726-225246`

## Risks

- **HIGH** `DIRTY_WORKTREE` ??288 changed file entries remain.
- **HIGH** `MIXED_FOUNDATION_BRANCH` ??Application changes are mixed into a Foundation branch.
- **HIGH** `DELETED_FILES` ??Deleted files require explicit review before commit.
- **MEDIUM** `LARGE_UNTRACKED_SET` ??Large untracked file set should be separated by domain.

## Recommended next task

- **REPO-001** 쨌 P0
- Split mixed repository changes into coherent commits
- Acceptance: Every remaining change is assigned to a coherent commit group; no file is lost.

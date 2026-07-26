# VROO Repository Intake

- Timestamp: 20260726-221332
- Original branch: ai/VROO-001-repository-audit
- Original HEAD: bcbf925c7d07c08be1ebb22e3e7703679be8facc
- Backup: D:\VROO_Backups\VROO-20260726-221332
- Policy: no reset, no deletion, no forced checkout

## Foundation

- `?? AI/`
- `?? scripts/foundation/`

## Application

- ` M app/assets/js/app.js`
- ` M app/assets/js/core/storage.js`
- ` M app/assets/js/modules/chat.js`
- ` M app/assets/js/modules/conversation-store.js`
- ` M app/assets/js/modules/profile.js`
- ` M app/assets/js/modules/road-chat.js`
- ` M app/index.html`
- `?? app/assets/characters/`
- `?? app/assets/css/my-garage.css`
- `?? app/assets/js/modules/my/`

## Character and assets

- `?? Character/`

## Documentation

- `?? docs/API_GUIDE.md`
- `?? docs/ARCHITECTURE_BIBLE.md`
- `?? docs/DATA_MODEL.md`
- `?? docs/FIREBASE_SCHEMA.md`
- `?? docs/ROADMAP.md`
- `?? docs/UI_FLOW.md`

## Cursor rules

- ` M .cursor/rules/project-boundary.mdc`
- ` M .cursor/rules/vroo-dev-workflow.mdc`
- ` D .cursor/rules/vroo-domain.mdc`
- `?? .cursor/rules/00-vroo-core.mdc`
- `?? .cursor/rules/01-design.mdc`
- `?? .cursor/rules/02-ui.mdc`
- `?? .cursor/rules/03-domain.mdc`
- `?? .cursor/rules/04-server.mdc`
- `?? .cursor/rules/05-game-system.mdc`
- `?? .cursor/rules/06-reuse.mdc`
- `?? .cursor/rules/07-character-system.mdc`
- `?? .cursor/rules/10-ui-ux.mdc`
- `?? .cursor/rules/20-safe-engineering.mdc`

## GitHub automation

- `?? .github/ISSUE_TEMPLATE/`
- `?? .github/pull_request_template.md`
- `?? .github/pull_request_template_foundation.md`
- `?? .github/workflows/ai-company-check.yml`
- `?? .github/workflows/foundation-check.yml`

## Install packages or temporary material

- `?? CURSOR_INSTALL_PROMPT.txt`
- `?? START_CURSOR_AGENT.txt`
- `?? VROO_AI_AUTOMATION_BOOTSTRAP_v1.0/`

## Other

- ` M .gitignore`
- ` M README.md`
- ` M package.json`
- `?? preview.html`
- `?? scripts/aios/`
- `?? scripts/sync-characters.js`

## Recommended commit sequence

1. Foundation and AIOS operating files
2. Architecture and project documentation
3. Cursor rules, only after conflict review
4. Application source changes by functional area
5. Character and visual assets
6. Exclude installer copies and temporary bootstrap folders

## Safety result

- [x] Tracked diff backed up
- [x] Untracked file list backed up
- [x] Untracked files copied outside repository
- [ ] Remaining changes reviewed and split
- [ ] Main branch protected
- [ ] First VROO task started through Work Queue

# FOUNDATION STATUS

- Product: VROO
- Foundation version: 1.0
- Status: OPERATIONAL
- Operating model: Controlled automation
- Required local executor: PowerShell + Git
- Optional implementation tools: Cursor, Codex, VS Code, human developer
- Source of truth: `AI/`
- Main branch direct development: prohibited
- Merge without owner approval: prohibited

## Completion criteria

Foundation v1.0 is operational only when all checks below pass:

- Required governance documents exist.
- Work queue has a valid machine-readable task table.
- A READY task can create an isolated branch.
- Dirty working trees block new task creation.
- Validation produces a deterministic pass/fail result.
- Completion reports are recorded under `AI/reports/`.
- GitHub Actions runs the same core validation.
- No specific AI implementation engine is required.

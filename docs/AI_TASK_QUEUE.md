# AI Task Queue

Cursor must work top-to-bottom, taking only one unblocked task per branch.

## P0 — Foundation

### VROO-001 Repository audit and baseline
Status: DONE
Acceptance:
- Identify framework, entry points, state management, data sources, commands, and known failing checks.
- Do not redesign features.
- Update `docs/VROO_PROJECT_STATE.md` with verified findings.
- Make only minimal fixes required to run baseline checks.

Branch: `ai/VROO-001-repository-audit`

### VROO-002 Reproducible verification
Status: READY
Acceptance:
- `scripts/ai-check.ps1` runs available lint/typecheck/test/build commands.
- Failures are actionable and do not get silently ignored.

## P1 — Product repair

### VROO-101 Chat-room information architecture
Status: BLOCKED_BY_VROO-002
Acceptance:
- Chat-room menu follows the structural clarity of the Nearby Vehicles menu.
- Recent conversation snippets are visible.
- Participants, unread state, online state, last activity, and room type are distinguishable.
- No horizontal overflow.

### VROO-102 My Page restructuring
Status: BLOCKED_BY_VROO-002
Acceptance:
- Profile, vehicle, level/progression, credits, missions, settings, and administration are visually separated.
- Existing functions remain reachable.
- Mobile and desktop screenshots are attached to the PR.

### VROO-103 Draggable utility panels
Status: BLOCKED_BY_VROO-002
Acceptance:
- Panels opened from `+` can be moved within viewport where appropriate.
- Position persists during the current session.
- Keyboard and touch interaction remain usable.

## P2 — Design system

### VROO-201 Automotive Character Bible implementation map
Status: BLOCKED_BY_VROO-001
Acceptance:
- Define asset naming, viewpoints, skeletal anchors, accessories, effects, states, and fallback behavior.
- Do not generate or replace final art without approved source assets.

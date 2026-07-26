# WORK QUEUE SCHEMA

`AI/WORK_QUEUE.md` must contain a Markdown table using these columns:

| ID | Area | Title | Status | Priority | DependsOn | Acceptance |
|---|---|---|---|---|---|---|

Valid status values:

- BACKLOG
- READY
- IN_PROGRESS
- REVIEW
- APPROVED
- DONE
- BLOCKED
- FAILED
- CANCELLED

Valid priority values:

- P0
- P1
- P2
- P3

Rules:

- ID must be unique and use `AREA-NNN`, for example `UI-004`.
- Only a task with no unresolved dependency may be READY.
- Only one task should normally be IN_PROGRESS.
- Acceptance must be objectively testable.

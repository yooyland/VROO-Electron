# VROO Quality Rules v1.0

## Quality Gate Levels

### Q0 — Task Clarity
Required before coding:
- objective defined
- scope bounded
- acceptance criteria testable
- dependencies identified

### Q1 — Code Integrity
Required before review:
- no syntax errors
- no accidental duplicate logic
- no secrets committed
- existing module boundaries respected
- error handling present where failures are expected

### Q2 — Build and Runtime
Required before ready state:
- project build or validation command passes
- Electron app starts when the task affects runtime
- console has no new critical errors

### Q3 — Product Behavior
Required before completion:
- acceptance criteria demonstrated
- primary path works
- relevant empty, loading, offline, and error states considered
- no known critical regression

### Q4 — UI Quality
Required for visible changes:
- layout hierarchy is clear
- text is readable
- controls have hover, active, disabled, and selected states where applicable
- no unintended horizontal scrolling
- desktop resizing does not break the layout
- black-and-gold visual language remains controlled and premium
- screenshots or equivalent visual evidence attached

### Q5 — Operational Readiness
Required before merge:
- Completion Tree updated
- Work Queue updated
- Decision Log updated for material choices
- rollback path known for risky changes
- PR contains verification evidence

## Automatic Merge Prohibition
Do not auto-merge when any of these apply:
- authentication or permissions
- payment, token, credit, or wallet logic
- destructive data migration
- privacy or security behavior
- major architecture replacement
- unresolved review comment
- failed or missing required checks
- UI change without visual evidence

## Severity
- Critical: data loss, security, app cannot start, core flow impossible
- High: major feature broken or severe regression
- Medium: incomplete behavior with workaround
- Low: polish, copy, minor inconsistency

Critical and High issues block completion.

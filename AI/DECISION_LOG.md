# VROO Decision Log

## ADR-001 — GitHub is the source of truth; desktop is the execution workspace
Status: Accepted

Decision:
GitHub records accepted project state. The CEO desktop project at `D:\VROO_Electron` is where Cursor or another implementation engine can directly modify and run files.

Reason:
ChatGPT does not continuously possess direct access to the CEO desktop. Separating durable project truth from local execution prevents false assumptions about synchronization.

## ADR-002 — Cursor remains a replaceable implementation engine
Status: Accepted

Decision:
Cursor is not removed. It remains the preferred tool for direct desktop file modification until another connected engine can perform that job more reliably.

Reason:
The operating system must survive tool replacement. VROO rules, tasks, evidence, and decisions cannot depend on one IDE.

## ADR-003 — Completion requires evidence
Status: Accepted

Decision:
No AI role may mark a task complete solely from generated code or a verbal assurance.

Required evidence depends on the task and may include build output, runtime result, screenshot, diff review, and updated operational records.

## ADR-004 — VROO remains the sole default focus
Status: Accepted

Decision:
Unless the CEO explicitly changes direction, AI Company work must not expand into other projects.

# VROO AI Company Operating Manual v1.0

## Operating Loop

1. **Observe**
   - Read Master Bible, Completion Tree, Work Queue, recent decisions, and repository status.

2. **Select**
   - Choose the highest-priority unblocked task.
   - Confirm that scope is bounded and acceptance criteria are testable.

3. **Plan**
   - Identify files, dependencies, risks, verification commands, and rollback path.

4. **Implement**
   - Use the current implementation engine.
   - Today this is usually Cursor for direct desktop file access.
   - Do not mix unrelated refactors into the task.

5. **Verify**
   - Run the exact checks required by Quality Rules.
   - Record commands and results.
   - Capture visual evidence for UI work.

6. **Review**
   - Compare implementation against acceptance criteria.
   - Review the diff, not only the final screen.
   - Block completion for Critical or High issues.

7. **Record**
   - Update Completion Tree and Work Queue.
   - Add a Decision Log entry when the choice affects future work.
   - Prepare a concise PR or commit description.

8. **Advance**
   - Select the next task only after the current task is complete or explicitly blocked.

## Task Specification Template

```markdown
# TASK-ID — Title

## Objective

## User value

## Scope

## Out of scope

## Acceptance criteria
- [ ]

## Likely files

## Verification

## Risks

## Handoff evidence
```

## Desktop Execution Contract
When desktop files must be changed:
- Work inside `D:\VROO_Electron`.
- Inspect `git status` before editing.
- Do not overwrite unrelated uncommitted work.
- Create a branch when GitHub workflow is available.
- Run verification locally.
- Commit only intended files.

## GitHub Contract
GitHub stores:
- accepted code
- branches and PRs
- Issues or task references
- reviews
- checks
- durable decisions

Local desktop files remain the execution workspace. Synchronization requires pull, commit, and push; GitHub changes do not automatically change an unsynchronized desktop directory.

## Approval Contract
Explicit CEO approval is required for:
- merges when policy or tooling requires it
- destructive changes
- credentials or permissions
- financial and token logic
- legal or privacy decisions
- irreversible migrations
- material product-direction changes

## Failure Handling
When blocked:
1. Mark the task `BLOCKED`.
2. Record the exact blocker and evidence.
3. Create the smallest unblock task.
4. Do not claim progress beyond what actually occurred.

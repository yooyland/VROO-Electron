# VROO AI ORCHESTRATOR RULES

## Purpose

The Orchestrator converts Project Brain output into one reviewable development action.

## Operating cycle

1. Read `AI\PROJECT_BRAIN.json`
2. Check repository safety
3. Select exactly one task
4. Generate Cursor instruction
5. Generate validation plan
6. Wait for execution
7. Verify results
8. Update Work Queue
9. Rescan Project Brain

## Safety

The Orchestrator must never:

- discard user work
- run destructive Git commands
- delete files automatically
- merge branches automatically
- force-push
- mark a task complete without validation evidence

## Selection rules

1. Mixed or unsafe repository state
2. Broken Foundation or Brain
3. P0
4. P1
5. Dependency-unblocked P2
6. Cosmetic work

## Single-task rule

Only one task may be ACTIVE at a time.

# VROO AI DEVELOPMENT OPERATING SYSTEM RULES

## Mission

VROO AI Development OS manages project state, decisions, dependencies, task selection,
execution instructions, validation, review, and the next development cycle.

## Core cycle

1. Scan repository
2. Update project memory
3. Build dependency graph
4. Select one executable task
5. Generate implementation instruction
6. Wait for implementation
7. Review evidence
8. Update queue and memory
9. Rescan
10. Recommend the next task

## Authority boundaries

The OS may:
- inspect repository state
- write reports and plans
- create task instructions
- calculate priorities
- update its own machine-readable state

The OS must not automatically:
- delete user files
- reset Git
- clean untracked files
- merge branches
- force-push
- mark implementation complete without evidence
- alter product decisions without recording the decision

## Single active task

Only one task may be ACTIVE at a time.

## Evidence hierarchy

1. Actual Git and filesystem state
2. Test and validation output
3. Approved decision records
4. Work Queue status
5. Architecture documents
6. Estimates

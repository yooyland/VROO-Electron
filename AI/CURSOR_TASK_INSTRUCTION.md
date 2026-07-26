# CURSOR TASK INSTRUCTION

## Task

- ID: **REPO-001**
- Area: **Repository**
- Priority: **P0**
- Title: **Split mixed repository changes into coherent commits**

## Objective

Every remaining change is assigned to a coherent commit group; no file is lost.

## Repository state

- Branch: `foundation/v1.0-operational-20260726-221332`
- HEAD: `c6fe516`
- Changed entries: **283**

## Mandatory constraints

1. Do not delete or reset existing user work.
2. Do not run `git reset --hard` or `git clean -fd`.
3. Do not force-push or merge.
4. Do not modify unrelated areas.
5. Preserve Korean text encoding as UTF-8.
6. Report every changed file.
7. Stop if a destructive or ambiguous decision is required.

## Required work

Analyze `AI\REPOSITORY_COMMIT_PLAN.md` and the current Git working tree.

Prepare a safe separation plan only. Do not commit automatically.

Create `AI\REPO_SEPARATION_RESULT.md` containing:

- each proposed commit group
- exact files in each group
- files that appear duplicated, generated, obsolete, or ambiguous
- recommended branch strategy
- recommended commit order
- verification commands

The first commit group must contain only AI Foundation, Project Brain, and Orchestrator files.

## Completion report

At the end, provide:

- work completed
- files changed
- tests or checks run
- unresolved risks
- whether acceptance criteria were met

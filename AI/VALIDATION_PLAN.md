# VALIDATION PLAN

- Task: **REPO-001**
- Acceptance: Every remaining change is assigned to a coherent commit group; no file is lost.

## Required checks

1. `git status --short`
2. Confirm no unrelated file was modified.
3. Confirm no tracked user file was deleted unintentionally.
4. Confirm generated documentation exists and is UTF-8 readable.
5. Run Project Brain scan again.
6. Compare task acceptance criteria with evidence.

## REPO-001 specific checks

- `AI\REPO_SEPARATION_RESULT.md` exists.
- Every changed file appears in exactly one proposed group or in an ambiguity section.
- No commit, reset, clean, deletion, or force action was performed.
- Foundation-related files are isolated from application files.

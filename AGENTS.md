# VROO Autonomous Development Charter

## Authority
- Product owner and final authority: 정창훈.
- AI design/technical director: ChatGPT.
- Implementation agent: Cursor Agent / Background Agent.
- Work autonomously unless a decision is irreversible, legally sensitive, destructive, security-sensitive, or changes product identity.

## Default operating mode
1. Read `docs/VROO_PROJECT_STATE.md`, `docs/AI_TASK_QUEUE.md`, and applicable `.cursor/rules/*.mdc`.
2. Inspect the existing implementation before editing.
3. Select the first unblocked `P0`, then `P1` task.
4. Create a dedicated branch: `ai/<task-id>-<short-name>`.
5. Make the smallest coherent implementation.
6. Run `powershell -ExecutionPolicy Bypass -File scripts/ai-check.ps1`.
7. Update project state and task queue.
8. Commit with `feat|fix|refactor|docs|test: <summary>`.
9. Open a draft PR. Never merge autonomously.

## Escalate only when
- Data loss or destructive migration is possible.
- Authentication, payments, privacy, encryption, legal wording, or production secrets are affected.
- Two valid product directions conflict and the choice materially changes VROO.
- A paid external service or irreversible deployment is required.

## Quality bar
- Preserve existing functionality unless explicitly replacing it.
- No fake buttons, dead controls, placeholder data presented as real, or silent failures.
- Mobile-first responsive UI; Korean-first copy.
- Keep VROO's vehicle-character identity consistent.
- Add or update tests when behavior changes.
- Never commit secrets, tokens, `.env`, certificates, or user data.

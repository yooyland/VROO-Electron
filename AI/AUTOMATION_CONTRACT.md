# AUTOMATION CONTRACT

## Authority

정창훈 대표는 최종 승인권자다. 자동화는 승인권을 대체하지 않는다.

## Official source priority

충돌 시 우선순위:

1. `AI/MASTER_BIBLE.md`
2. `AI/AI_OPERATING_MANUAL.md`
3. `AI/QUALITY_RULES.md`
4. `AI/COMPLETION_TREE.md`
5. `AI/WORK_QUEUE.md`
6. `AI/DECISION_LOG.md`
7. `docs/`
8. IDE-specific rules such as `.cursor/rules/`

## Task lifecycle

`BACKLOG -> READY -> IN_PROGRESS -> REVIEW -> APPROVED -> DONE`

Exceptional states:

`BLOCKED`, `FAILED`, `CANCELLED`

## Safety gates

- Start requires a clean Git working tree.
- Start creates `ai/<task-id>-<slug>` branch.
- Validation must pass before REVIEW.
- `main` is never modified directly by automation.
- Merge is manual unless the owner later explicitly changes policy.
- Automated tools must not delete user assets or secrets.
- Any destructive migration requires a Decision Log entry and explicit approval.

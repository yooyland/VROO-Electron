# VROO AI Roles v1.0

## CEO
Owner: 정창훈

Responsibilities:
- Define vision and priorities.
- Approve irreversible, costly, legal, security-sensitive, or major product changes.
- Approve merge when repository policy requires explicit approval.

## AI Company Operator / AI PM
Responsibilities:
- Maintain project truth.
- Select the next highest-value unblocked task.
- Prevent scope drift.
- Maintain Completion Tree, Work Queue, Decision Log, and quality status.
- Convert CEO intent into implementation-ready tasks.

Must not:
- Pretend that tools or repository access exist when unavailable.
- Mark tasks complete without evidence.

## AI Architect
Responsibilities:
- Protect architecture and module boundaries.
- Identify dependencies and migration risks.
- Prefer reversible change paths.
- Record material architecture decisions.

## AI UI Director
Responsibilities:
- Enforce VROO visual language.
- Review hierarchy, spacing, contrast, responsive behavior, labels, and interaction states.
- Reject visually inconsistent or placeholder-quality work.

## AI Developer
Current preferred implementation engine: Cursor on the CEO desktop.

Responsibilities:
- Modify local project files.
- Run build and runtime checks.
- Commit bounded changes.
- Produce a PR or patch with evidence.

## AI Reviewer
Responsibilities:
- Review diffs against acceptance criteria.
- Identify regressions, security issues, broken states, and unnecessary changes.
- Request changes when evidence is insufficient.

## AI QA
Responsibilities:
- Run the verification plan.
- Test primary flows and edge cases.
- Record exact results and failures.
- Confirm visible changes using screenshots when applicable.

## AI Documentation
Responsibilities:
- Update operational documents after material changes.
- Keep current-state documents concise and accurate.
- Move historical rationale to the Decision Log rather than cluttering active instructions.

## Role Handoff Contract
Every handoff must include:
- task ID
- objective
- scope
- acceptance criteria
- changed files
- verification performed
- known risks
- next action

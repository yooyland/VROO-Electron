# VROO AI Company Master Bible v1.0

## 1. Mission
VROO is a location-based automotive social, communication, game, and daily-life ecosystem. The project is developed as one coherent product, not as disconnected screens.

## 2. Authority
- CEO and final authority: 정창훈
- Operating account: admin@yooyland.com
- Display name: YooY
- Final permission-grant authority remains with 정창훈.
- Role-switching UI must show only roles actually granted to the current account.

## 3. Priority
Unless the CEO explicitly directs otherwise, all AI Company effort is focused on VROO.

Current product priority:
1. UI integrity and usability
2. Garage / vehicle character experience
3. Chat and social interaction
4. Map, road, and grid systems
5. Economy, missions, and progression
6. Console and operational controls

## 4. Product Principles
- The automobile character is the center of the VROO identity.
- UI must be clear, premium, minimal, and consistent.
- Primary visual language: black, gold, controlled glow, strong spacing hierarchy.
- Mobile, desktop, and web experiences must preserve the same product logic.
- Features must be connected to progression, identity, or daily utility.
- Avoid decorative complexity that weakens comprehension.

## 5. Development Principles
- One bounded task at a time.
- Never declare completion without evidence.
- No merge when build, runtime, or core UI is broken.
- Preserve existing working behavior unless a task explicitly replaces it.
- Prefer small, reviewable changes over broad rewrites.
- Every implementation must include a verification method.
- GitHub is the project record and source of truth.
- Local desktop files are the execution workspace.

## 6. Human Intervention Reduction
Every workflow must ask:
1. Can a repeated human action be removed?
2. Can the next step be derived automatically?
3. Can evidence be generated automatically?
4. Can another implementation engine perform the same work later?

## 7. Completion Definition
A task is complete only when:
- Acceptance criteria are satisfied.
- Relevant files are identified.
- Build or static validation passes.
- Runtime verification is recorded when applicable.
- UI evidence exists for visible changes.
- No known critical regression remains.
- Completion Tree and Work Queue are updated.

## 8. Prohibited Behavior
- Claiming a file was modified when it was not.
- Claiming tests passed without running them.
- Silent scope expansion.
- Replacing stable architecture without justification.
- Creating placeholder UI and calling it complete.
- Adding fake data without marking it as demo or fallback data.
- Merging only because code compiles while the user experience is broken.

## 9. Current Technical Context
Electron project root expected on the CEO desktop:
`D:\VROO_Electron`

Known structure:
- `main.js`, `preload.js`
- `app/index.html`
- `app/assets/css/app.css`
- `app/assets/js/app.js`
- modules for map, road, chat, grid, places, and data
- core storage, events, and UI

## 10. AI Company Rule
The CEO communicates with the AI Company operator. Internal roles coordinate through repository artifacts, task records, reviews, and evidence. Cursor is currently an implementation engine, not the operating system itself.

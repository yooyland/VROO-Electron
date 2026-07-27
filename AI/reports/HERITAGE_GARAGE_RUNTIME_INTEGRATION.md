# Heritage S — Garage Runtime Integration

## Scope

- Connect all nine approved Heritage S directions to the MY CAR Garage.
- Preserve the existing Garage V2 layout and the separate conversation workspace.
- Keep the approved Front 45 image as the safe runtime fallback.

## Runtime Behavior

- The Garage presents nine explicit direction controls.
- The selected direction is stored in application state and restored when the Garage reopens.
- Each direction loads alpha WebP first through `<picture>` and falls back to transparent PNG.
- A missing direction falls back once to the approved `front_45.png` master and displays a notice.
- Direction buttons expose `aria-pressed` state for accessibility.

## Validation

- JavaScript syntax check: passed for `app`, `console`, and `shared`
- metadata direction coverage: 9 / 9
- PNG availability: 9 / 9
- WebP availability: 9 / 9
- Garage selector registration: 9 / 9
- whitespace/error check: passed

## Approval Boundary

This integration verifies repository paths, selector behavior, state persistence wiring, and fallback logic. `approval.runtimeTest` remains `false` until the packaged Electron application is visually exercised on the target Windows runtime.

HERITAGE_GARAGE_RUNTIME_INTEGRATED

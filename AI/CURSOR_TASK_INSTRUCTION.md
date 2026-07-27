# Cursor Task — Verify Heritage S Front 45 Pass 3

## Scope

Review the candidate only:

`app/assets/characters/05_Heritage/views/front_45_pass3_candidate.png`

Compare it with:

- `app/assets/characters/05_Heritage/views/front_45.png`
- `app/assets/characters/05_Heritage/metadata.json`
- `app/assets/characters/00_DNA/vroo_vehicle_dna.json`
- `AI/reports/HERITAGE_FRONT45_PASS3_REVIEW.md`
- `AI/reports/HERITAGE_ACCEPTANCE_CHECKLIST.md`

Preserve Garage V2 UI and vehicle data. Do not touch the local Garage WIP files
unless a separate task explicitly authorizes it.

## Required verification

1. Confirm 2048 × 2048 RGBA and transparent corners.
2. Inspect at 200% on black, white and checkerboard backgrounds.
3. Confirm there is no magenta/green fringe, floor, shadow, reflection, text or watermark.
4. Confirm one complete vehicle is visible with at least 8% safe margin.
5. Confirm the front identity:
   - wide low hex mesh grille
   - compact Winged-V Shield
   - Twin-Blade DRL
   - restrained gold
   - executive lower fascia
6. Confirm the candidate is not loaded by the current Garage runtime.

## If every check passes

Do not merge or replace the master automatically. Report:

`HERITAGE_FRONT45_PASS3_VERIFIED`

Include:

- exact image dimensions and mode
- alpha corner values
- visible bounding box and margins
- fringe test result
- the exact files that would change during final promotion

Wait for the AI Project Manager approval before:

- replacing `front_45.png`
- creating `front_45.webp`
- changing `polishPass.front_45`
- setting `approval.masterFront45: true`
- starting the remaining eight directions

## If any check fails

Report:

`HERITAGE_FRONT45_PASS3_REJECTED`

List the failing criterion and exact evidence. Do not modify the approved runtime
path or metadata approval values.


# Cursor Task — Heritage S Nine Directions Pass 1: Front

## Authority and source of truth

Produce one new candidate direction for the approved VROO flagship:

- officialName: `VROO Heritage Executive S`
- displayName: `Heritage S`
- role: `brand_flagship`

Immutable identity reference:

`app/assets/characters/05_Heritage/views/front_45.png`

Supporting rules:

- `app/assets/characters/05_Heritage/metadata.json`
- `app/assets/characters/00_DNA/vroo_vehicle_dna.json`
- `AI/prompts/NINE_DIRECTION_PRODUCTION.md`
- `AI/specs/ASSET_STANDARD.md`

Do not use the nickname “VROO Model S”.

## Scope — candidate only

Create exactly one candidate:

`app/assets/characters/05_Heritage/views/front_pass1_candidate.png`

Do not replace or modify any approved runtime asset in this pass.

Do not create `front.webp`.

Do not modify `metadata.json`.

Do not touch Garage V2 UI, vehicle data, JavaScript, CSS, SVG runtime assets, or local Garage WIP.

## Required visual continuity

This must be the same vehicle rotated to an exact front view, not a redesign or a new car.

Preserve from the approved `front_45` master:

- identical wheelbase, roofline, greenhouse, hood height, width and ride height
- midnight-black body and restrained Heritage gold trim
- wide low Hex Mesh grille
- compact Winged-V Shield emblem
- Twin-Blade DRL and lamp geometry
- Executive lower fascia; no exaggerated sports armor
- identical wheel design, tire size, mirrors and body kit
- centered number plate and emblem positions

For geometry hidden by the source angle, infer the minimum necessary symmetric form. Do not invent new vents, lamps, badges, trim or aerodynamic parts.

## Output standard

- 2048 × 2048 px
- RGBA 8-bit / sRGB
- true-alpha transparent background
- one complete vehicle only
- exact front camera, level horizon, no yaw
- centered pivot and consistent vehicle scale
- minimum 8% safe margin
- no environment, floor, shadow, reflection, text, border or watermark
- clean alpha edge at 200% on black, white and checkerboard backgrounds

## Verification evidence

Report:

1. image dimensions and mode
2. alpha values at all four corners
3. visible alpha bounding box and margins
4. centerline symmetry check
5. fringe test result
6. confirmation that approved `front_45.png` is unchanged
7. confirmation that no runtime file references the candidate
8. SHA-256 and Git blob SHA
9. complete changed-file list

## Stop gate

If every check passes, report:

`HERITAGE_FRONT_PASS1_CANDIDATE_READY`

Then stop and wait for AI Project Manager review.

Do not promote, convert to WebP, update metadata, start another direction, merge, or change approval values without explicit approval.

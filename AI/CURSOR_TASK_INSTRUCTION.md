# Cursor Task — Heritage S Nine Directions: Right Pass 1

## Authority and approved references

Produce one candidate for the approved VROO flagship:

- officialName: `VROO Heritage Executive S`
- displayName: `Heritage S`
- role: `brand_flagship`

Use both approved runtime masters as immutable identity references:

- `app/assets/characters/05_Heritage/views/front_45.png`
- `app/assets/characters/05_Heritage/views/front.png`

Supporting rules:

- `app/assets/characters/05_Heritage/metadata.json`
- `app/assets/characters/00_DNA/vroo_vehicle_dna.json`
- `AI/prompts/NINE_DIRECTION_PRODUCTION.md`
- `AI/specs/ASSET_STANDARD.md`

Do not use the nickname “VROO Model S”.

## Scope — candidate only

Create exactly one candidate:

`app/assets/characters/05_Heritage/views/right_pass1_candidate.png`

Do not create `right.webp`, modify metadata, replace approved assets, or touch Garage/UI/JS/CSS/runtime files.

## Camera and geometry

- exact passenger-side profile
- camera perpendicular to vehicle centerline
- level horizon, zero front or rear yaw
- all four body corners implied correctly; two right-side wheels visible
- entire vehicle visible and centered
- same perceived scale as approved Front 45
- preserve long premium-sedan wheelbase, low roofline, greenhouse, hood-to-cabin ratio and ride height
- wheel centers must share one horizontal baseline
- front and rear wheel diameter must match
- no perspective distortion that enlarges one wheel

## Immutable vehicle DNA

This must be the same approved car rotated to the right, not a redesign.

Preserve:

- midnight-black fastback premium sports-sedan body
- exact wheel design, gold wheel accent and tire profile
- restrained gold beltline/window surround and lower sill line
- front Twin-Blade lamp visible only as a natural side sliver
- rear lamp signature consistent with the body geometry
- compact Winged-V wheel-center/emblem language where visible
- Executive lower body kit and restrained rear spoiler
- mirror, door-handle, vent and fender geometry already visible in Front 45
- four-door proportions

Do not invent new doors, vents, badges, lamps, trim, diffuser elements, exhausts or aerodynamic parts.

## Output standard

- 2048 × 2048 px
- sRGB, RGBA 8-bit
- true transparent background
- natural partial-alpha edges; partial alpha must be greater than zero
- one complete vehicle only
- minimum 8% safe margin
- no checkerboard or validation background baked into the PNG
- no floor, shadow, reflection, text, border or watermark
- clean edge on white, black and checkerboard at 200%

## Verification evidence

Report:

1. dimensions and mode
2. four corner RGBA values
3. vehicle-only alpha BBox, margins and center
4. transparent / partial / opaque pixel counts
5. front/rear wheel diameter difference and wheel baseline difference
6. roofline, wheelbase and ride-height continuity against Front 45
7. fringe inspection on white, black and checkerboard
8. confirmation that Front and Front 45 masters are unchanged
9. confirmation that runtime does not reference the candidate
10. SHA-256, Git blob SHA and complete changed-file list

## Stop gate

If every check passes, report:

`HERITAGE_RIGHT_PASS1_CANDIDATE_READY`

Then stop. Do not promote, create WebP, update metadata, start another direction or merge without AI Project Manager approval.

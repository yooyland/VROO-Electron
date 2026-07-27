# VROO Game-Ready Vehicle Asset Standard v1.0

## 1. Canvas
- Master: 2048 × 2048 px
- Background: true alpha transparency
- Color: sRGB / RGBA 8-bit
- Vehicle pivot: canvas center
- Safe margin: minimum 8%
- No typography, UI, platform, showroom, border, watermark

## 2. Direction Set
- front
- front_45
- right
- rear_right
- rear
- rear_left
- left
- front_left
- front_right

## 3. Naming
PNG master:
`<direction>.png`

Runtime:
`<direction>.webp`

## 4. Visual Consistency
All directions must preserve:
- wheelbase and body proportions
- grille shape
- headlamp and rear-lamp signatures
- wheel design and size
- gold trim positions
- spoiler geometry
- number plate and emblem position
- ride height

## 5. Separation Layers
- body
- windows
- front_lights
- rear_lights
- wheels
- gold_trim
- spoiler
- exhaust
- shadow
- reflection

## 6. Runtime Priority
`webp → png → svg → procedural fallback`

## 7. Acceptance Test
- true transparent background
- one vehicle only
- entire vehicle visible
- no clipping
- centered composition
- silhouette matches approved master
- same identity across all directions
- clean edge alpha at 200% zoom

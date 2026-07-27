# Heritage S — Layer Contract Report

## Result

The deterministic layer and parts contract is now defined without altering any approved vehicle pixels.

## Locked Rules

- canvas: 2048×2048, sRGB, RGBA 8-bit
- pivot: exact center
- directions: the approved nine-direction set
- source pattern: `layers/{direction}/{layer}.png`
- runtime pattern: `layers/{direction}/{layer}.webp`
- pixel registration tolerance: 0
- normal composite must reproduce the approved view
- only approved emissive light states may differ from the normal composite

## Layer Stack

1. shadow
2. wheels
3. body
4. windows
5. gold_trim
6. front_lights
7. rear_lights
8. spoiler
9. exhaust
10. reflection

## Runtime Interactions

- wheels: wheel variant
- body: body color
- windows: tint
- gold trim: trim variant
- front lights: headlight toggle
- rear lights: rear-light toggle
- spoiler: spoiler variant
- exhaust: exhaust variant

## Approval Boundary

This change approves the contract only. No raster layer has been claimed as complete, and `approval.layers` remains `false` until all required layers exist and their recomposite validation passes.

HERITAGE_LAYER_CONTRACT_READY

# Heritage S — Front 45 Light Layer Pilot

## Result

The first independent runtime layer is connected without modifying the approved Front 45 master.

- direction: `front_45`
- layer: `front_lights`
- format: deterministic 2048×2048 SVG
- mode: additive emissive overlay
- identity: VROO Twin-Blade DRL
- state persistence: `garageLightsOn`
- unsupported directions: toggle disabled automatically

## Safety

- The approved PNG and WebP remain byte-for-byte unchanged.
- The light layer is optional and defaults to off.
- Removing or failing to load the overlay leaves the approved vehicle view intact.
- This pilot does not claim body, wheel, window, trim, spoiler, exhaust, shadow, or reflection separation.

## Approval Boundary

`approval.layers` remains `false`. It may advance only after all required raster layers exist and recomposition validation passes.

HERITAGE_FRONT45_LIGHT_LAYER_PILOT_READY

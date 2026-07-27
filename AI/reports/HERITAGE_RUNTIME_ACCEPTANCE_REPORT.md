# Heritage S — Windows Runtime Acceptance Report

## Result

The target Windows Electron runtime smoke test completed successfully.

- repository main before acceptance: `0de0c4c737a7901251cc9464e4f606db09313f29`
- command: `npm run test:heritage-runtime`
- application boot: passed
- Garage direction selector count: 9
- rendered directions: 9 / 9
- rendered dimensions: 2048×2048 for every direction
- safety fallback activations: 0
- pressed-state validation: passed for every direction
- process marker: `HERITAGE_RUNTIME_TEST_PASS`

## Direction Evidence

| Direction | Loaded | Size | Fallback | Pressed |
| --- | --- | --- | --- | --- |
| front | yes | 2048×2048 | no | yes |
| front_45 | yes | 2048×2048 | no | yes |
| front_right | yes | 2048×2048 | no | yes |
| right | yes | 2048×2048 | no | yes |
| rear_right | yes | 2048×2048 | no | yes |
| rear | yes | 2048×2048 | no | yes |
| rear_left | yes | 2048×2048 | no | yes |
| left | yes | 2048×2048 | no | yes |
| front_left | yes | 2048×2048 | no | yes |

## Dependency Notes

The install completed with Node.js 20 engine warnings because the current latest Electron toolchain declares Node.js 22.12 or newer for its install tooling. The runtime test itself passed. The reported npm audit findings are tracked as a separate dependency-maintenance concern and are not altered with `npm audit fix --force` in this acceptance change.

## Approval

- `approval.masterFront45: true`
- `approval.nineDirections: true`
- `approval.runtimeTest: true`
- `approval.layers: false` remains unchanged until raster layer recomposition passes.

HERITAGE_WINDOWS_RUNTIME_ACCEPTED

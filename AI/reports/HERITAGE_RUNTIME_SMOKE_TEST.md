# Heritage S — Windows Runtime Smoke Test

## Command

Run from the repository root on the target Windows machine:

```powershell
npm ci
npm run test:heritage-runtime
```

## Automated Checks

- VROO application boot completes.
- MY CAR Garage opens.
- Exactly nine Heritage direction controls render.
- Every direction control becomes pressed when selected.
- Every selected asset renders at 2048×2048.
- No direction falls back to the Front 45 safety master.

## Result Markers

- success: `HERITAGE_RUNTIME_TEST_PASS`
- failure: `HERITAGE_RUNTIME_TEST_FAIL`
- evidence: `HERITAGE_RUNTIME_TEST_RESULT` followed by JSON

## Approval Rule

Set `approval.runtimeTest` to `true` only after this command exits with code `0` on the target Windows Electron runtime. Linux sandbox DBus restrictions are not treated as an application failure.

HERITAGE_RUNTIME_TEST_READY

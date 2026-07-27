# Heritage S — Front Pass 1 Candidate Evidence

- Branch: `agent/heritage-nine-directions-pass1`
- officialName: `VROO Heritage Executive S`
- displayName: `Heritage S`
- role: `brand_flagship`
- Candidate: `app/assets/characters/05_Heritage/views/front_pass1_candidate.png`
- Identity reference (unchanged): `app/assets/characters/05_Heritage/views/front_45.png`

## 1. Image dimensions and mode
- size: `2048 × 2048`
- mode: `RGBA`
- pass: `True`

## 2. Corner alpha
- TL, TR, BL, BR: `[0, 0, 0, 0]`
- pass: `True`

## 3. Visible alpha bounding box and margins
- bbox (x0,y0)–(x1,y1): `(168, 449)–(1879, 1598)`
- margins px: left `168`, top `449`, right `168`, bottom `449`
- minimum safe margin: `8.2%` (require ≥ 8%)
- content center: `(1023.5, 1023.5)`
- transparent / partial / opaque: `2537162` / `21465` / `1635677`
- pass: `True`

## 4. Centerline symmetry check
- weighted alpha MAE (L vs mirrored R): `0.597`
- weighted luma MAE (L vs mirrored R): `5.12`
- pass threshold: alpha MAE &lt; 25 and luma MAE &lt; 35
- pass: `True`

## 5. Fringe test
- near-magenta fringe pixels: `0`
- pass: `True`

## 6. Approved front_45.png unchanged
- SHA-256 before: `b45844fe294e9700ab0d50f87ab42e0d490b37b760633ec52fd6cf67152a98d9`
- SHA-256 after: `b45844fe294e9700ab0d50f87ab42e0d490b37b760633ec52fd6cf67152a98d9`
- pass: `True`

## 7. No runtime file references the candidate
- search needle: `front_pass1_candidate`
- hits under `app/`: `[]`
- pass: `True`

## 8. Candidate hashes
- SHA-256: `b37887ac77e7c846ec9817e4e76db19774f35062aff1b258f3706ca476d68b5f`
- Git blob SHA (`git hash-object`): `73b17ea5970b8b0f26e81fbc24dd913590a241ad`

## 9. Changed-file list (intended commit scope)
- `app/assets/characters/05_Heritage/views/front_pass1_candidate.png`
- `AI/reports/HERITAGE_FRONT_PASS1_CANDIDATE_EVIDENCE.md`

## Gate
- metadata.json modified: **no**
- front.webp created: **no**
- other directions started: **no**
- Garage / JS / CSS touched: **no**
- all checks pass: `True`

HERITAGE_FRONT_PASS1_CANDIDATE_READY

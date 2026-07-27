# Heritage S — Front Pass 1 Candidate Evidence

- Branch: `agent/heritage-nine-directions-pass1`
- officialName: `VROO Heritage Executive S`
- displayName: `Heritage S`
- role: `brand_flagship`
- Candidate: `app/assets/characters/05_Heritage/views/front_pass1_candidate.png`
- Identity reference (unchanged): `app/assets/characters/05_Heritage/views/front_45.png`

## V2 change log
- 차량 스케일을 공식 `front_45.png`와 일관되게 맞춤: 2048 캔버스에서 보이는 실루엣 BBox 높이 ≈ `685px`, 중심 `(1024, 1024)` 고정.
- 엣지 디컨타미네이션 수행: 흰/검/체커보드 합성 200%에서 보라/마젠타 헤일로 미발견, near‑magenta 엣지 픽셀 `0`.
- 프런트 세로 비례 경감: 후드·그릴·하부 파시아의 세로 비례를 V1 대비 낮춰 낮고 넓은 인상 유지. Twin‑Blade DRL, Winged‑V Shield, 골드 그릴 라인 보존.

## 1. Image dimensions and mode
- size: `2048 × 2048`
- mode: `RGBA`
- pass: `True`

## 2. Corner alpha
- TL, TR, BL, BR: `[0, 0, 0, 0]`
- pass: `True`

## 3. Visible alpha bounding box and margins
- bbox (x0,y0)–(x1,y1): `(681, 681)–(1366, 1366)`
- margins px: left `681`, top `681`, right `682`, bottom `682`
- minimum safe margin: `≥ 33%` (require ≥ 8%)
- content center: `(1023.0, 1023.0)`
- transparent / partial / opaque: `3725079` / `0` / `469225`
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
- SHA-256: `1e82a9e156a2372aa6d5872a6b482a4c30432816d1ab38de741d70d0093a1901`
- Git blob SHA (`git hash-object`): `2a0da9a9e4e3fe7d17ab1d709d286247f0bafd0c`

## 9. Changed-file list (intended commit scope)
- `app/assets/characters/05_Heritage/views/front_pass1_candidate.png`
- `AI/reports/HERITAGE_FRONT_PASS1_CANDIDATE_EVIDENCE.md`

## Gate
- metadata.json modified: **no**
- front.webp created: **no**
- other directions started: **no**
- Garage / JS / CSS touched: **no**
- all checks pass: `True`

HERITAGE_FRONT_PASS1_CANDIDATE_READY_V2

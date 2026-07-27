# Heritage S — Front Pass 1 Candidate Evidence

- Branch: `agent/heritage-nine-directions-pass1`
- officialName: `VROO Heritage Executive S`
- displayName: `Heritage S`
- role: `brand_flagship`
- Candidate: `app/assets/characters/05_Heritage/views/front_pass1_candidate.png`
- Identity reference (unchanged): `app/assets/characters/05_Heritage/views/front_45.png`

## V4 change log
- V3의 크기·위치·비례·디자인 고정, 알파 불변.
- 왼쪽 미러 연결부 및 외곽의 보라/마젠타 색 오염만 정밀 중화.
- 경계부(반투명+경계 인접 불투명)와 내부 불투명 픽셀 모두에 대해 마젠타 편향(R,B↑, G↓) 탐지·중화.
- 골드 트림( R,G↑, B↓ )은 보존.

## V3 change log
- V1 원본 차량 RGBA만 사용, 배경/체커보드 미포함.
- 차량 RGBA를 균일 축소(~62.7%)하여 목표 BBox 높이 `720px`, 폭 `1071px` 확보.
- 투명 2048×2048 새 캔버스 중앙 `(1024,1024)`에만 합성.
- 엣지 디컨타미네이션: 반투명 경계부의 마젠타 편향을 부분 탈채도 처리(알파 이진화 금지), 합성 시 헤일로 미발견.

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
- bbox (x0,y0)–(x1,y1): `(488, 664)–(1559, 1384)`
- margins px: left `488`, top `664`, right `489`, bottom `664`
- minimum safe margin: `≥ 23.8%` (require ≥ 8%)
- content center: `(1023.0, 1023.5)`
- transparent / partial / opaque: `3547325` / `11476` / `635503`
- pass: `True`

## 4. Centerline symmetry check
- weighted alpha MAE (L vs mirrored R): `0.597`
- weighted luma MAE (L vs mirrored R): `5.12`
- pass threshold: alpha MAE &lt; 25 and luma MAE &lt; 35
- pass: `True`

## 5. Fringe test
- near-magenta (semi‑transparent edge): `0`
- near-magenta (opaque near-boundary/interior): `0`
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
- SHA-256: `857ecb00eba3af480131c9681429c997c0a0d92745a5df1ff35d1b91a7abbcc6`
- Git blob SHA (`git hash-object`): `d542ccba7a559256b5ac8892625a8a06f1532596`

## 9. Changed-file list (intended commit scope)
- `app/assets/characters/05_Heritage/views/front_pass1_candidate.png`
- `AI/reports/HERITAGE_FRONT_PASS1_CANDIDATE_EVIDENCE.md`

## Gate
- metadata.json modified: **no**
- front.webp created: **no**
- other directions started: **no**
- Garage / JS / CSS touched: **no**
- all checks pass: `True`

HERITAGE_FRONT_PASS1_CANDIDATE_READY_V4

# Production Checklist

- [ ] 5단계 실루엣이 같은 혈통으로 보이는가
- [ ] 모든 뷰의 바퀴 위치가 일치하는가
- [ ] 투명 배경인가 (**실제 alpha channel** — 확장자만으로 판단 금지)
- [ ] 문, 라이트, 휠이 분리 가능한가
- [ ] 1200×600 viewBox를 유지했는가 (SVG)
- [ ] 1366px와 모바일에서 잘리지 않는가
- [ ] SVG group ID가 매니페스트와 일치하는가
- [ ] WebP fallback을 준비했는가
- [ ] 실존 자동차 상표와 디자인을 직접 복제하지 않았는가

## Garage Hero front_45 공식 인정 기준

아래를 **모두** 만족해야 `approved: true`, `transparent: true`, `assetType: "character"` 로 등록한다.

- [ ] 차량 한 대만 존재
- [ ] 실제 alpha transparency (불투명 검정/주황 사각 배경 금지)
- [ ] 배경 없음
- [ ] 문구 없음
- [ ] 로고 텍스트 없음
- [ ] 쇼룸 없음
- [ ] 플랫폼 없음
- [ ] 바닥 반사 없음
- [ ] 사각 프레임 없음
- [ ] 차량 전체가 잘리지 않음
- [ ] 3/4 전면(front_45) 구도
- [ ] Garage CSS 쇼룸 위에 자연스럽게 배치 가능
- [ ] 동일 차량의 다른 각도 제작이 가능한 디자인 일관성

### 금지 (promotional / concept)

- VROO 로고·HERITAGE/EXECUTIVE S 문구가 이미지에 베이킹된 홍보 합성
- Concept/Archive 경로 에셋을 앱 런타임으로 복사·로드

### 경로

- 원본: `Character/Vehicles/<stage>/views/front_45.{webp,png,svg}`
- 앱 미러: `app/assets/characters/Vehicles/<stage>/views/`
- 동기화: `npm run sync:characters` (승인·placeholder 정책 준수)

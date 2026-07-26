# VROO ROADMAP

> 버전 계획 — Digital Car Life Platform  
> 개발 순서 고정: Garage → Map → Chat → Mission → Grid → Community → Shop → Settings  
> 상세 설계: `ARCHITECTURE_BIBLE.md` · 데이터: `DATA_MODEL.md`

상태는 `FEATURE_STATUS.md`와 동기화한다.  
미구현을 완료처럼 출시 문구에 쓰지 않는다.

---

## v0.1 — Foundation (현재~단기)

**목표:** 자동차 주인공 경험의 뼈대 + 데이터 기준 고정

| 영역 | 내용 | 상태 |
|------|------|------|
| Design system | rules 01–06 · Architecture Bible · Data docs | done / in progress |
| Map | Leaflet 주변·도로·전체 | prototype |
| Garage | MY GARAGE 쇼케이스·컬렉션·커스텀 | prototype |
| Chat | AppShell · road/nearby/grid/direct | prototype |
| Data | DATA_MODEL · FIREBASE_SCHEMA · API_GUIDE | docs |

**완료 기준**

- [ ] Vehicle 표준 필드가 Garage·Chat 목록에 일관 반영
- [ ] 대표 차량(`activeVehicleId`) 단일 소스
- [ ] Renderer/Leaflet 회귀 없음

---

## v0.2 — Growth & Social

| 영역 | 내용 |
|------|------|
| Mission | 일일/주간/성장 — `source` 구분, 가짜 클리어 금지 |
| Inventory | 아이템 스택 UI + Vehicle 장착 연결 |
| Friends | 친구 목록 · 1:1 · 차단 (서버 planned면 로컬 명시) |
| Progression | Vehicle.level/exp 정본화 (계정 level과 매핑 문서화) |

**완료 기준**

- [ ] Mission → XP/Credits 경로가 DATA_MODEL과 일치
- [ ] Inventory ↔ Accessory ↔ loadout 단일 흐름

---

## v0.3 — Economy & Scale

| 영역 | 내용 |
|------|------|
| Marketplace / Shop | 카탈로그·구매 API (실결제는 Phase 별도) |
| Guild | GRID/커뮤니티 길드형 확장 (기획) |
| Ranking | 시즌·안전·성장 랭킹 (서버 검증) |
| Firebase | Auth + users/vehicles/chatRooms 동기화 시작 |

**완료 기준**

- [ ] Shop purchase → ledger (server)
- [ ] Notifications 기본 채널

---

## v0.4+ (축 확장)

PRODUCT_VISION 8축: BENEFITS · CARE · LOCAL · 멤버십 · Partner Console 고도화  
→ Vehicle 성장·공간과 연결될 때만 제품에 편입.

---

## 우선순위 (지금)

1. Architecture / Data docs 유지 (본 문서군)
2. Data Model 기준으로 Garage 완성
3. Map + Chat 연동 강화
4. Mission / 성장
5. Grid → Community → Shop

---

## 버전 태그 규칙

- `prototype` — localStorage 데모
- `planned` — 문서·스키마만
- `implemented` — 서버 검증 포함 사용 가능 수준

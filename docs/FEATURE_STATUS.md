# Feature Status

상태 값: **`implemented`** | **`prototype`** | **`planned`**

- `implemented` — 제품으로 쓸 수 있는 수준(현재 Electron 빌드에는 거의 없음; 대부분 prototype)
- `prototype` — 로컬 데모로 동작, 서버·결제·실운영 없음
- `planned` — 스키마·문서만, UI가 있어도 “준비 중”으로만 표시

코드 미러: `app/assets/js/config/feature-status.js`

## 보존 수명주기

기능의 구현 상태와 별도로 다음 수명주기를 사용한다.

| 값 | 의미 |
|---|---|
| `keep` | 현재 기능·데이터·에셋·테스트 유지. 수명주기 미지정 시 기본값 |
| `hide` | 코드와 데이터를 보존하고 현재 UI에서만 숨김 |
| `backend-ready` | 로컬 기능을 유지하면서 향후 서버 서비스로 교체 가능한 경계로 분리 |
| `review-for-delete` | 삭제 후보. 근거·대체 경로·영향·회귀검증·복구 계획 없이는 삭제 금지 |

`review-for-delete`는 삭제 승인이 아니다. 실제 삭제는 별도 이슈와 검증을 거쳐야 한다.

---

## DRIVE

| 기능 | 상태 | 비고 |
|------|------|------|
| 주변(Leaflet) | prototype | GPS, 마커, 지명 |
| 도로(Three.js) | prototype | 단일 renderer/loop |
| 전체 50:50 | prototype | 동일 road scene |
| 내 차량 표시 | prototype | 프로필 차량 |
| 주행 상태 | planned | |
| 실시간 위치 동기화 | planned | Phase 2 |

## SOCIAL

| 기능 | 상태 | 비고 |
|------|------|------|
| 1:1 채팅 | prototype | senderId, createdAt, unread |
| GRID 단체채팅 | prototype | |
| 음성 입력 | prototype | |
| Spatial GRID 참여·상세 | prototype | location/current/selected 분리 |
| 커뮤니티 게시판 | prototype | localStorage |
| 친구 | planned | |
| 드라이브 파티 | planned | |
| 신고·차단 | planned | |

## STORE

| 기능 | 상태 | 비고 |
|------|------|------|
| 기본 상점(차량 선택) | prototype | shop.js |
| 차량 스킨·휠·LED 등 | planned | |
| 말풍선·광선 아이템 | planned | 도로 연출은 prototype, 상점 판매는 planned |
| BenefitProduct 쿠폰몰 | planned | 데이터 시드만 |
| 포인트몰·실결제 | planned | |

## BENEFITS

| 기능 | 상태 |
|------|------|
| 주유·커피·편의점·세차·외식 쿠폰 | planned |
| 멤버십·가입·시즌 혜택 | planned |

## CARE

| 기능 | 상태 | 비고 |
|------|------|------|
| InsuranceProduct 카탈로그 | planned | 데모 데이터 |
| InsuranceLead 상담 신청 | planned | 가입 확정 금지 |
| AccidentCase 상태 모델 | planned | 외부 전송 금지 |
| 긴급출동·견인·정비·검사 | planned | |

### AccidentCase 상태 (모델)

`draft` → `reported` → `assistanceRequested` → `towing` → `repair` → `closed`

### InsuranceLead 상태 (모델)

`inquiry` → `quoteRequested` → `quoted` → `applied` → `active` / `expired` / `cancelled`

## LOCAL

| 기능 | 상태 | 비고 |
|------|------|------|
| VROO 지명 레이어 | prototype | places |
| PartnerOffer GRID 혜택 | planned | |
| 주변 주유소·카페·맛집 등 POI 혜택 | planned | |

## PLAY

| 기능 | 상태 |
|------|------|
| 성장·크레딧·레벨 | prototype |
| Basic → Street → Sport → Performance → Heritage 진행 모델 | prototype |
| 미션·랭킹·시즌·출석·주행 보상 | planned |

## MY

| 기능 | 상태 |
|------|------|
| MY CAR / 프로필 | prototype |
| 포인트·쿠폰함·보험 현황·결제 내역 | planned |
| 알림·설정(동의 포함) | planned |

## 플랫폼·운영

| 기능 | 상태 |
|------|------|
| localStorage 상태 | prototype |
| 서버·WebSocket·로그인 | planned |
| Admin Console | planned |
| Partner Console | planned |
| PG 결제·정산 | planned |

---

## 현재 상단 메뉴 ↔ 축

| 메뉴 | 축 | 화면 id |
|------|-----|---------|
| 주변차량 | DRIVE + SOCIAL(주변) | nearby |
| 그리드 | SOCIAL | grid |
| 대화방 | SOCIAL | chat |
| 성장 | PLAY | growth |
| 상점 | STORE | shop |
| 커뮤니티 | SOCIAL | community |
| MY CAR | MY | (모달) |

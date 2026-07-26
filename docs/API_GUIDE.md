# VROO API GUIDE

> REST / Firebase Callable 규칙 · 서비스 경계  
> 모델: `DATA_MODEL.md` · 컬렉션: `FIREBASE_SCHEMA.md`  
> **현재:** 서버 미연동 — 클라이언트는 Service 인터페이스를 로컬 어댑터로 구현

---

## 1. 공통 규칙

| 항목 | 규칙 |
|------|------|
| Auth | Bearer / Firebase Auth ID token (목표) |
| 시간 | Unix ms UTC |
| ID | 서버 발급 우선; 로컬은 `local_*` 접두 |
| Idempotency | POST mutation에 `Idempotency-Key` |
| 에러 | `{ code, message, details? }` |
| source | 응답에 `source: local\|server` 가능하면 포함 |
| 금지 | 클라이언트가 ledger/credits/xp를 임의 확정 |

### 로컬 어댑터 (현재)

Electron은 `*Service` 이름을 논리 경계로 쓰고, 구현은 기존 모듈을 재사용한다.

| Service | 현재 구현 위치 |
|---------|----------------|
| VehicleService | `modules/my/my-data.js` |
| MissionService | `my/missions.js` · `growth.js` |
| ChatService | `chat.js` · `road-chat.js` · `conversation-store.js` |
| GridService | `grid.js` · `spatial-grid.js` |
| MapService | `map.js` · `places.js` · `nearby.js` |
| ShopService | `shop.js` · storage credits |

동일 역할의 새 Service 파일을 중복 생성하지 말고, 위 모듈을 확장한다.

---

## 2. VehicleService

| Op | Method | Path / Callable | 설명 |
|----|--------|-----------------|------|
| listMine | GET | `/vehicles?owner=me` | 내 차고 |
| get | GET | `/vehicles/{id}` | 단건 |
| setActive | POST | `/vehicles/{id}/activate` | 대표 차량 |
| patchLoadout | PATCH | `/vehicles/{id}/loadout` | 커스텀 저장 |
| localGrow | POST | `/vehicles/{id}/grow` | **dev/local only** |

요청/응답 바디는 `DATA_MODEL.md` Vehicle 스키마.

---

## 3. MissionService

| Op | Method | Path | 설명 |
|----|--------|------|------|
| listActive | GET | `/missions` | 진행 중 |
| syncProgress | POST | `/missions/{id}/progress` | 서버 검증 진행 |
| claim | POST | `/missions/{id}/claim` | 보상 (ledger) |

클라이언트 단독 “완료 처리” API 없음 → 서버 검증 필수 (목표).

---

## 4. ChatService

| Op | Method | Path | 설명 |
|----|--------|------|------|
| listRooms | GET | `/chatRooms` | 타입 필터 |
| open | POST | `/chatRooms` | 생성/확보 |
| listMessages | GET | `/chatRooms/{id}/messages` | cursor |
| send | POST | `/chatRooms/{id}/messages` | 전송 |
| markRead | POST | `/chatRooms/{id}/read` | unread 분리 반영 |

Realtime: Firestore onSnapshot 또는 RTDB (road/nearby ephemeral).

---

## 5. GridService

| Op | Method | Path | 설명 |
|----|--------|------|------|
| resolveCell | GET | `/grids/at?lat=&lng=` | Spatial 셀 |
| get | GET | `/grids/{id}` | 메타 |
| join | POST | `/grids/{id}/join` | 참여 |
| members | GET | `/grids/{id}/members` | 멤버 |
| notice | PATCH | `/grids/{id}/notice` | 관리자 |

---

## 6. MapService

| Op | Method | Path | 설명 |
|----|--------|------|------|
| updatePresence | PUT | `/presence/me` | 위치·online |
| nearby | GET | `/presence/nearby?radius=` | 주변 차량 |
| places | GET | `/map/places` | 지명/POI |

Electron: Leaflet 렌더는 로컬 유지, 데이터만 Service로 교체.

---

## 7. ShopService

| Op | Method | Path | 설명 |
|----|--------|------|------|
| catalog | GET | `/shop/catalog` | items |
| purchase | POST | `/shop/purchase` | 서버 ledger |
| inventory | GET | `/inventory` | 보유 |

실결제 성공 응답은 payment Phase 전 금지. credits 차감은 서버.

---

## 8. 추가 서비스 (Phase+)

- `FriendService` — friendships
- `NotificationService` — notifications
- `WalletService` — balance + ledger read

---

## 9. 버전

| Ver | 내용 |
|-----|------|
| 0.1 | 로컬 어댑터 + 스키마 고정 |
| 0.2 | Auth + Vehicle/Chat pull |
| 0.3 | Mission claim + Shop ledger |

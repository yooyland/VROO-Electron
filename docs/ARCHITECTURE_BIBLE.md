# VROO Architecture Bible

> Digital Car Life Platform — **자동차가 RPG 캐릭터인 디지털 생태계**  
> Slogan: **Drive • Connect • Grow**  
> 문서 상태: **Living design** (구현 상태와 목표를 구분)  
> 관련: `PRODUCT_VISION.md` · `PLATFORM_ARCHITECTURE.md` · `FEATURE_STATUS.md` · `.cursor/rules/01~05-*.mdc`

---

## 0. 한 줄 정의

VROO는 SNS·내비게이션·게임이 아니다.  
사용자는 **자신의 자동차를 성장**시키며, 현실 GPS 공간에서 연결·미션·수집·커뮤니티를 한다.

| 역할 | 의미 |
|------|------|
| Owner (사람) | 계정·설정·결제 주체 |
| **Vehicle (자동차)** | **서비스의 주인공 = RPG 캐릭터** |
| World | Map · Road · GRID · Chat · Community |

### 자동차 캐릭터 속성

Level · Experience(XP) · Ability · Items · Collection · Mission · Achievement · History · Friends

---

## 1. 현재 vs 목표

| 층 | 현재 (Electron prototype) | 목표 |
|----|---------------------------|------|
| 런타임 | Electron + 바닐라 JS | 동일 User App + 서버 |
| 상태 | `localStorage` (`vrooBeta10`) | API + Firestore 동기화 |
| 지도 | Leaflet | + 실시간 presence |
| 도로 | Three.js 단일 renderer | 유지 + 서버 메타 |
| 성장 | level/xp/credits + MY GARAGE | Vehicle 중심 공식 루프 |
| 인증·결제 | 없음 | Auth + ledger (실결제 Phase) |

**규칙:** prototype을 implemented처럼 표시하지 않는다.

---

## 2. UI Flow (목표)

```
App Launch
  → Auth (향후) / Local boot (현재)
  → HOME (Map 중심 요약) 또는 마지막 Workspace 복원
       │
       ├─ GARAGE     대표 차량 · 능력 · 장착 · 컬렉션
       ├─ MAP        주변 · 도로 · 전체
       ├─ CHAT       도로/주변/GRID/1:1
       ├─ MISSION    일일·주간·성장·안전
       ├─ GRID       전국/지역/내 Grid
       ├─ COMMUNITY  자동차 커뮤니티
       ├─ SHOP       Garage 꾸미기 · 아이템
       └─ SETTINGS   프로필·알림·개인정보 (MY 하위)
```

### 권장 기능 개발 순서

1. Garage → 2. Map → 3. Chat → 4. Mission → 5. Grid → 6. Community → 7. Shop → 8. Settings

새 화면마다: **사용자 목적 → 자동차 성장 → 서버 데이터 → UI → 확장**

---

## 3. 정보 구조 (IA)

### 목표 메인 메뉴

`HOME · GARAGE · MAP · CHAT · GRID · MISSION · SHOP · COMMUNITY · MY`

### 현재 Electron 메뉴 매핑

| 목표 | 현재 UI |
|------|---------|
| HOME / MAP | 주변차량 + 뷰탭(주변/도로/전체) |
| GARAGE / MY | MY CAR → MY GARAGE (`app/assets/js/modules/my/`) |
| CHAT | 대화방 |
| GRID | 그리드 |
| MISSION | 성장 (+ MY 미션 탭) |
| SHOP | 상점 |
| COMMUNITY | 커뮤니티 |
| SETTINGS | MY → 프로필 |

일괄 메뉴 개편은 **별도 요청 시** 단계적으로만 수행한다.

### Workspace

- **Spatial**: Map · Road · GRID · 공간 대화 오버레이  
- **Content**: Chat · Growth/Mission · Shop · Community · Garage/MY  

---

## 4. 데이터 구조 (논리 모델)

**정본:** [`docs/DATA_MODEL.md`](./DATA_MODEL.md)  
**Firebase:** [`docs/FIREBASE_SCHEMA.md`](./FIREBASE_SCHEMA.md) · **API:** [`docs/API_GUIDE.md`](./API_GUIDE.md)  
**Flow / Roadmap:** [`UI_FLOW.md`](./UI_FLOW.md) · [`ROADMAP.md`](./ROADMAP.md)

아래는 요약이다. 필드 추가·변경은 DATA_MODEL을 먼저 고친다.

### 4.1 Owner (User)

```
User {
  id, nickname, statusMessage, intro,
  plate, platePublic, regionPublic,
  activeVehicleId,
  credits,          // 계정 지갑 (코인)
  level, xp,        // 계정 진행(프로토타입) → 향후 Vehicle로 이전 가능
  joinedAt,
  blockedUserIds[],
  friendIds[],
  settings { notify, privacy }
}
```

### 4.2 Vehicle (RPG 캐릭터) — 핵심

```
Vehicle {
  id, ownerId, nickname, manufacturer, model, grade,
  level, exp, mileage, fuelType,
  accessories[], abilities, records, friends[], missions[],
  catalogType, owned, active, loadout, ...
  characterId?, evolutionStage?, characterView?,  // Character System 매핑 (추가 필드)
  // abilities = VROO 성장 지표 (실차 성능 아님)
}
```

현재 저장: `state.myGarage.vehicles[]` + `state.profile.car` (active catalogType)
상세 매핑은 DATA_MODEL §2.

**Character System (단일 시각 기준):** `Character/`  
- Manifest: `Character/Data/vehicle-character-manifest.json`  
- Evolution: `Character/Data/vehicle-evolution.json`  
- Bible: `Character/Bible/CHARACTER_BIBLE.md`  
- App adapter: `app/assets/js/modules/my/character-adapter.js`  
- 원본 수정 금지 · 앱 연결만 adapter/Exports로

### 4.3 Inventory / Item

```
ItemDef { id, kind: skin|wheel|horn|effect|material|coupon|consumable, name, rarity, stackable }
InventoryStack { itemId, qty, usable, expiresAt, source: local|server }
```

### 4.4 Mission / Achievement

```
Mission { id, group, title, progress, target, unit, source, status, reward { xp, credits, itemId } }
Achievement { id, title, progress, target, unlocked, unlockedAt, titleReward, featured }
```

### 4.5 Spatial

```
Location { lat, lng, updatedAt }
GridCell { id, level: L1|L2|L3, name }
GridMembership { gridId, role, joinedAt }
RoadSession { conversationId, roadName, direction, participantIds[] }
NearbySession { conversationId, radiusM }
```

### 4.6 Chat

```
Conversation {
  id, type: road|nearby|grid|direct|room,
  title, participantIds[], lastMessage, lastAt,
  unreadMessageCount, unreadSituationCount
}
Message {
  id, conversationId, senderId, vehicleId?,
  body, createdAt, purpose?, category?, spatialVisibility?
}
```

### 4.7 Economy

```
LedgerEntry { id, userId, delta, reason, refType, refId, createdAt, source }
```

현재: `state.credits` + `spendCredits` / `canAfford` (단일 차감 경로 유지)

---

## 5. 레벨 · XP 시스템

### 목표 공식 (초안)

- 활동(주행 검증·메시지·GRID·미션) → **XP**
- `xp >= xpToNext(level)` → Level+1, Ability 소폭 상승(고정 테이블)
- **확률 강화 없음**

### XP 소스 (예시 · 서버 검증 전제)

| 활동 | XP (예시) | 검증 |
|------|-----------|------|
| 미션 클리어 | 미션 정의 | server |
| GRID 참여 | 소량 | server |
| 도로 상황 유의미 제보 | 소량 | server + 정책 |
| 일일 출석 | 소량 | server |

### 현재 프로토타입

- 계정 `level` / `xp` / 성장 메뉴 크레딧 업그레이드
- 차량 `myGarage` 로컬 테스트 성장 (명시적 local)

---

## 6. 미션 시스템

| 그룹 | 예 | 보상 |
|------|----|------|
| daily | 5km · 도로 메시지 확인 | XP/크레딧 |
| weekly | GRID 1회 | XP |
| growth | 차량 레벨 | Ability |
| safety | 안전운전 시간 | 칭호/XP |
| community | 커뮤니티 활동 | XP |
| grid | Grid 미션 | 지역 보상(향후) |

`source: local | server` 필수. 자동 완료 UI 금지.

---

## 7. 아이템 · 컬렉션

| kind | 용도 | UI |
|------|------|-----|
| skin / wheel / plate / horn / effect | Garage 꾸미기 | Custom · Accessory · Shop |
| material | 성장 재료 | Inventory · Upgrade |
| coupon | 혜택(향후) | BENEFITS |
| vehicle | 보유 차종 | Collection |

장착은 **디지털 아바타**에만 영향. 실차 제어·실성능 암시 금지.

---

## 8. 친구 시스템

```
Friendship { userA, userB, status: pending|active|blocked, createdAt }
Presence { userId, online, lastLat?, lastLng?, activeVehicleId, updatedAt }
```

현재: MY Friends 로컬 목록 · `blockedUserIds` · SOCIAL friends = planned

---

## 9. 채팅 시스템

| type | 공간 | 비고 |
|------|------|------|
| road | 도로 세션 | ROAD INSIGHT · 상황 unread 분리 |
| nearby | 반경 | Map 연동 |
| grid | GRID | 단체 |
| direct | 1:1 | 차량 아이콘·온라인 |
| room | 일반 방 | 향후 |

원칙: **자동차 기반 채팅**. 읽음·온라인·미확인·차량 아이콘 우선.  
저장: 현재 rooms/roadChat/nearbyChat local → 목표 Conversations/Messages 컬렉션.

---

## 10. 지도 · 도로 시스템

| 뷰 | 기술 | 주인공 |
|----|------|--------|
| 주변 | Leaflet | 내 위치·주변 차량 |
| 도로 | Three.js | 내 차량 메시 |
| 전체 | Map+Road | 요약 + 도로 |

금지: Renderer/Leaflet 불필요 destroy, 루프 중복.  
향후: Presence 구독, 클러스터, 서버 TTL.

---

## 11. 코인 경제

| 용어 | 현재 | 목표 |
|------|------|------|
| Credits | `state.credits` | `wallets/{uid}` + ledger |
| 획득 | 데모 기본값 | 미션·시즌·구매 |
| 소비 | 성장·번호판 공개·GRID 생성 등 | Shop · 쿠폰 · 멤버십 |

규칙: 클라이언트만의 잔액 신뢰 금지(서버 연동 후). 실결제 성공 연출 금지 until payment Phase.

---

## 12. 서버 API 구조 (목표)

```
Client (Electron)
  → HTTPS API Gateway
      → Auth Service
      → User / Vehicle Service
      → Presence / Spatial Service
      → Chat Service
      → Mission / Progression Service
      → Shop / Ledger Service
      → CARE / Partner (Phase+)
      → Firestore / RTDB / Storage
```

### API 스케치 (REST 또는 Callable)

| Method | Path | 용도 |
|--------|------|------|
| POST | `/auth/session` | 로그인 |
| GET/PATCH | `/me` | 프로필 |
| GET/PATCH | `/me/vehicles` | 차고 |
| POST | `/me/vehicles/{id}/equip` | 장착 |
| GET | `/presence/nearby` | 주변 차량 |
| GET/POST | `/conversations` | 대화 |
| POST | `/messages` | 전송 |
| GET/POST | `/missions` | 미션 |
| POST | `/missions/{id}/claim` | 보상 수령 |
| GET | `/shop/catalog` | 상점 |
| POST | `/shop/purchase` | 구매(서버 검증) |

모든 mutating API는 **idempotency key** 권장.

---

## 13. Firebase 컬렉션 구조 (목표 초안)

> 아직 프로젝트에 Firebase 미연동. 설치·초기화는 **명시 요청 전 금지**.

```
users/{userId}
  profile, settings, creditsCache?, activeVehicleId

vehicles/{vehicleId}
  ownerId, catalogType, level, xp, ability, loadout, owned

inventories/{userId}/items/{itemId}
  qty, expiresAt

friendships/{friendshipId}
  userA, userB, status

presence/{userId}
  online, lat, lng, updatedAt, activeVehicleId

grids/{gridId}
  meta, level, name

gridMembers/{gridId}/members/{userId}

conversations/{conversationId}
  type, participantIds, lastMessage, unread...

messages/{conversationId}/items/{messageId}

missions/{userId}/active/{missionId}
achievements/{userId}/{achievementId}

ledger/{userId}/entries/{entryId}

shopCatalog/{skuId}          // 또는 Remote Config + CMS
```

Realtime 후보: `presence`, typing, road session ephemeral → RTDB or short TTL Firestore.

Security Rules: owner-only write · chat participant read · ledger server-only write.

---

## 14. User App 모듈 맵 (현재)

| 영역 | 경로 |
|------|------|
| Garage | `app/assets/js/modules/my/*` |
| Character | `Character/` (원본) · `modules/my/character-adapter.js` (앱 연결) |
| Map | `modules/map.js`, `places.js` |
| Road | `modules/road.js`, `road-chat.js` |
| Chat | `modules/chat.js`, `conversation-store.js` |
| Grid | `modules/grid.js`, `spatial-grid.js` |
| Mission/Growth | `modules/growth.js`, `my/missions.js` |
| Shop | `modules/shop.js` |
| Community | `modules/community.js` |
| State | `core/storage.js` |
| Console | `console/` (User와 분리) |

---

## 15. 확장 · 금지

### 확장 축 (PRODUCT_VISION 8축)

DRIVE · SOCIAL · STORE · BENEFITS · CARE · LOCAL · PLAY · MY  
→ 모두 **Vehicle 성장·표현·공간**으로 연결될 것.

### NEVER

- 사람 중심 SNS로 제품 피벗
- 싸구려 게임 UI / 올드 게시판 / 복잡 관리화면을 User App에 이식
- 실차 제어·실성능·실결제·실보험 확정처럼 오해되는 카피
- Console 로직을 User App에 섞기
- 타 저장소(YooYLand 등) 구조 복사

### ALWAYS

Premium · Minimal · Modern · Smooth · Elegant  
**자동차가 주인공.**

---

## 16. 개정

| 버전 | 일자 | 내용 |
|------|------|------|
| 0.1 | 2026-07-25 | 최초 Architecture Bible + rules 01–05 |

# VROO DATA MODEL

> **무엇을 저장하는가** — 화면·모듈이 공유하는 단일 기준  
> 관련: `ARCHITECTURE_BIBLE.md` · `FIREBASE_SCHEMA.md` · `API_GUIDE.md`  
> 상태: **Canonical design** (현재 localStorage 매핑 포함)

모든 신규 기능은 이 문서의 엔티티를 확장한다.  
화면마다 임의 JSON 형태를 만들지 않는다.

---

## 0. 원칙

1. **Garage = 루트 컨테이너** (User가 직접 Vehicle 하나만 갖는 구조가 아님)
2. **Vehicle = RPG 캐릭터** (서비스 주인공, 다수 보유)
3. User = Owner (계정·지갑·설정) → `activeVehicleId`로 Garage 대표 차량 연결
4. 모든 소셜·공간·성장은 `vehicleId` 또는 `activeVehicleId`로 연결 가능해야 한다
5. 필드에 `source: "local" | "server"` 를 둘 수 있으면 둔다
6. **실차 성능·실결제·실보험**처럼 오해되는 의미는 카피로 금지

### Garage 루트

```
Garage (state.myGarage)
 ├── vehicles[]          // Vehicle 1..N
 ├── inventory[]
 ├── missions[]
 ├── records
 ├── friends[]
 ├── achievements[]
 ├── activeVehicleId
 ├── selectedVehicleId
 └── ui (filters, drafts, view)
```

### 현재 저장 위치

| 영역 | 경로 |
|------|------|
| User App | `localStorage` key `vrooBeta10` (`app/assets/js/core/storage.js`) |
| Garage | `state.myGarage` (`modules/my/my-data.js`) |
| Chat | `state.rooms` · `roadChat` · `nearbyChat` |
| Console | `shared/data` (User App과 분리) |

---

## 1. User

```
User {
  id: string                    // 예: "me"
  nickname: string
  intro?: string
  statusMessage: string         // 현재 profile.status
  plate: string
  platePublic: boolean
  regionPublic: boolean
  activeVehicleId: string | null
  credits: number               // Coin 잔액 캐시 (정본은 ledger)
  accountLevel: number          // 프로토타입 — 점진적으로 Vehicle.level 중심화
  accountXp: number
  friendIds: string[]
  blockedUserIds: string[]
  joinedAt: number | null
  settings: {
    notifyEnabled: boolean
    privacy: { platePublic, regionPublic }
  }
  source: "local" | "server"
}
```

**현재 매핑:** `state.profile` + `state.credits` + `state.level` + `state.xp` + `state.blockedUserIds` + `state.connections`

---

## 2. Vehicle ⭐ (핵심)

표준 트리 (제품 기준):

```
Vehicle
 ├── id
 ├── nickname              // 차고에서 부르는 이름 (없으면 name)
 ├── manufacturer          // 예: "VROO" | 제휴 브랜드 코드
 ├── model                 // 예: "Roadster" / catalog 표시명
 ├── grade                 // rarity: legend|epic|rare|uncommon|common
 ├── level
 ├── exp                   // xp
 ├── mileage               // km (데모/검증 전 — 실주행 검증 전 source=local)
 ├── fuelType              // digital meta: electric|gasoline|hybrid|unknown (실연비 아님)
 ├── accessories[]         // 장착 Accessory id
 ├── abilities             // VROO 성장 지표 (실차 성능 아님)
 ├── records               // 요약 또는 RecordSummary ref
 ├── friends[]             // 차량 간 소셜 링크(향후) / 현재는 Owner.friendIds
 └── missions[]            // 진행 중 missionId (또는 MissionProgress)
```

### 전체 스키마

```
Vehicle {
  id, ownerId,
  nickname, manufacturer, model, name,
  catalogType, grade(=rarity), level, exp, expToNext,
  mileage, todayMileage, fuelType,
  condition, energy, tuningStage, seasonRank, score,
  owned, active, acquiredAt, description,
  abilities { engine, handling, comfort, economy, style },  // 쇼케이스
  stats { speed, acceleration, ... },                     // 상세
  accessories[], loadout/customization,
  history[], friendIds[], missionIds[],
  growthRate, source
}
```

**차별화 필드:** 희귀도(grade) · 컨디션 · 에너지 · 누적/오늘 주행 · 튜닝 Stage · 시즌 랭크 · Vehicle Score · 히스토리

**현재 매핑 (`myGarage.vehicles[]`):** `modules/my/my-data.js` `buildCatalogVehicle` 가 정본.

---

## 3. Mission

```
MissionDef {
  id, group: daily|weekly|growth|safety|community|grid,
  title, target, unit, reward: { exp?, credits?, itemId? }
}

MissionProgress {
  id, missionId, userId, vehicleId?,
  progress, target, status: active|completed|claimed,
  source: "local"|"server",
  updatedAt
}
```

**현재:** `state.myGarage.missions[]` (Def+Progress 혼합 prototype)

---

## 4. Friend

```
Friendship {
  id,
  userA: string,
  userB: string,
  status: pending|active|blocked,
  lastGridId?: string,
  createdAt: number,
  source: "local"|"server"
}

FriendView {          // UI용 조인
  userId, nickname, online, lastGrid, vehicleType, vehicleId?
}
```

**현재:** `myGarage.friends[]` 로컬 뷰 + `blockedUserIds`

---

## 5. ChatRoom (Conversation)

```
ChatRoom {
  id: string
  type: road|nearby|grid|direct|room
  title: string
  participantIds: string[]
  vehicleIds?: string[]          // 참가 차량 (가능 시)
  gridId?: string
  lastMessage: string
  lastAt: number
  unreadMessageCount: number
  unreadSituationCount: number   // road 상황 분리
  source: "local"|"server"
}
```

**현재:** `state.rooms` + `roadChat.session` + `nearbyChat.session`

---

## 6. Message

```
Message {
  id: string
  chatRoomId: string             // conversationId
  senderId: string
  vehicleId?: string
  body: string
  createdAt: number
  purpose?: chat|situation|help
  category?: string
  spatialVisibility?: string
  mine?: boolean                 // 클라이언트 전용
}
```

---

## 7. Grid

```
Grid {
  id: string
  kind: spatial|community
  level?: L1|L2|L3               // spatial
  name: string
  notice?: string
  memberCount?: number
  ownerId?: string
}

GridMembership {
  gridId, userId, role: member|admin, joinedAt
}
```

**현재:** `state.grids` · `joinedGrids` · `spatialMembers` · spatial-grid 셀 id

---

## 8. Accessory

```
Accessory {
  id: string
  kind: plate_frame|roof|badge|chat_fx|nick_deco|horn|aura|wheel|skin
  name: string
  rarity?: string
  digitalOnly: true              // 항상 true — 실차 안전 무관
  previewAsset?: string
}
```

장착은 `Vehicle.accessories[]` + `Vehicle.loadout`

---

## 9. Inventory

```
InventoryStack {
  id: string                     // stack id
  userId: string
  itemId: string
  kind: vehicle|skin|accessory|material|coupon|consumable
  name: string
  qty: number
  usable: boolean
  expiresAt: number | null
  source: "local"|"server"
}
```

**현재:** `state.myGarage.inventory[]`

---

## 10. Item (카탈로그)

```
ItemDef {
  id, sku?, kind, name, rarity, stackable, priceCredits?,
  status: prototype|planned|implemented
}
```

Shop 카탈로그·Inventory가 참조.

---

## 11. Coin (Economy)

```
Wallet {
  userId: string
  balance: number
  updatedAt: number
}

LedgerEntry {
  id, userId, delta: number,
  reason: string,
  refType?: mission|shop|grid|plate|admin,
  refId?: string,
  createdAt: number,
  source: "local"|"server"
}
```

**현재:** `state.credits` + `spendCredits` / `canAfford` (ledger 배열 없음 → v0.2+)

---

## 12. Notification

```
Notification {
  id: string
  userId: string
  type: chat|mission|friend|system|shop
  title: string
  body: string
  read: boolean
  refType?: string
  refId?: string
  createdAt: number
  source: "local"|"server"
}
```

**현재:** 미구현 (system toast만). planned.

---

## 13. 엔티티 관계 (요약)

```
User 1──* Vehicle
User 1──* InventoryStack
User *──* User (Friendship)
User *──* Grid (membership)
Vehicle *──* Accessory (equip)
Vehicle *──* MissionProgress
ChatRoom 1──* Message
ChatRoom )── Vehicle / User / Grid
Wallet 1──* LedgerEntry
User 1──* Notification
```

---

## 14. 변경 규칙

- 필드 추가: 이 문서에 먼저 기록 → 코드 반영
- 이름 변경: 별칭 호환 기간 명시
- UI 전용 임시 객체는 `Ui*` 접두사, 저장 금지

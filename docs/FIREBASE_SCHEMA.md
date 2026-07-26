# VROO FIREBASE SCHEMA

> 목표 컬렉션 구조 — **아직 Firebase 미연동**  
> 설치·초기화는 명시 요청 전까지 금지  
> 논리 모델: `DATA_MODEL.md`

---

## 1. 컬렉션 목록

| Collection | 문서 ID | 설명 |
|------------|---------|------|
| `users` | `{userId}` | Owner 프로필·설정·지갑 캐시 |
| `vehicles` | `{vehicleId}` | RPG 캐릭터 (자동차) |
| `missions` | `{userId}_{missionId}` 또는 하위컬렉션 | 진행도 |
| `chatRooms` | `{chatRoomId}` | 대화방 메타 |
| `messages` | 하위: `chatRooms/{id}/messages/{messageId}` | 메시지 |
| `grids` | `{gridId}` | GRID 메타 |
| `inventory` | `{userId}/items/{itemId}` | 보유 스택 |
| `items` | `{itemId}` | 아이템 카탈로그 |
| `notifications` | `{userId}/items/{notificationId}` | 알림 |
| *(추가)* `friendships` | `{friendshipId}` | 친구 |
| *(추가)* `presence` | `{userId}` | 온라인·위치 요약 |
| *(추가)* `ledger` | `{userId}/entries/{entryId}` | 코인 원장 |

---

## 2. 문서 형태

### users/{userId}

```
{
  nickname, intro, statusMessage, plate,
  platePublic, regionPublic,
  activeVehicleId,
  credits,              // 캐시 — 쓰기는 Cloud Function 권장
  accountLevel, accountXp,
  blockedUserIds: [],
  friendIds: [],
  settings: {},
  updatedAt
}
```

### vehicles/{vehicleId}

```
{
  ownerId,
  nickname, manufacturer, model, catalogType,
  grade, level, exp, expToNext,
  mileage, fuelType,
  owned, active, acquiredAt, description,
  abilities: { speed, acceleration, braking, handling, safety, communication, style },
  accessories: [],
  loadout: {},
  records: {},
  friendIds: [],
  missionIds: [],
  growthRate,
  updatedAt
}
```

인덱스: `ownerId` · `ownerId + active`

### missions

권장: `users/{userId}/missions/{missionId}`

```
{ progress, target, status, group, title, unit, reward, updatedAt, source }
```

### chatRooms/{chatRoomId}

```
{
  type, title, participantIds, vehicleIds,
  gridId, lastMessage, lastAt,
  unreadByUser: { [userId]: { message, situation } },
  updatedAt
}
```

### chatRooms/{chatRoomId}/messages/{messageId}

```
{ senderId, vehicleId, body, createdAt, purpose, category, spatialVisibility }
```

### grids/{gridId}

```
{ kind, level, name, notice, ownerId, memberCount, updatedAt }
```

`grids/{gridId}/members/{userId}` → `{ role, joinedAt }`

### inventory — `users/{userId}/inventory/{stackId}`

```
{ itemId, kind, name, qty, usable, expiresAt, updatedAt }
```

### items/{itemId}

```
{ sku, kind, name, rarity, stackable, priceCredits, status }
```

### notifications — `users/{userId}/notifications/{id}`

```
{ type, title, body, read, refType, refId, createdAt }
```

### friendships/{id}

```
{ userA, userB, status, lastGridId, createdAt }
```

### presence/{userId}

```
{ online, lat, lng, activeVehicleId, updatedAt }
```

TTL/단기 데이터는 RTDB 후보.

### ledger — `users/{userId}/ledger/{entryId}`

```
{ delta, reason, refType, refId, createdAt }
```

**클라이언트 직접 write 금지** (Admin SDK / Functions만).

---

## 3. Security Rules 초안 (개념)

- `users/{uid}`: read 자신·제한 공개 필드 / write 자신 (credits 제외)
- `vehicles`: read 공개 메타·owner write / `ownerId == auth.uid`
- `chatRooms`: participant만 read/write meta
- `messages`: participant create; update/delete 제한
- `ledger` · `credits`: server only
- `items` catalog: read all authenticated; write admin

---

## 4. localStorage ↔ Firebase 매핑

| local | Firebase |
|-------|----------|
| `profile` + credits/level | `users/{id}` |
| `myGarage.vehicles` | `vehicles` |
| `myGarage.missions` | `users/.../missions` |
| `rooms` / roadChat / nearbyChat | `chatRooms` + `messages` |
| `grids` / joinedGrids | `grids` + members |
| `myGarage.inventory` | `users/.../inventory` |
| (없음) | `notifications`, `ledger` |

동기화 전략: 로그인 후 pull → 로컬 캐시 → mutation은 API/Functions.

---

## 5. 금지

- 클라이언트에서 잔액·XP를 신뢰 가능한 정본으로 취급
- Rules 없이 전역 read/write
- User App과 Console이 동일 컬렉션을 권한 없이 공유 기록

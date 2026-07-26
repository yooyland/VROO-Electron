# VROO UI FLOW

> 사용자 이동 구조 · 화면 목적  
> IA/우선순위: `ARCHITECTURE_BIBLE.md` · `02-ui.mdc`  
> 데이터: `DATA_MODEL.md`

---

## 1. 목표 플로우 (제품)

```
Splash
  ↓
Login          (Auth — 향후; 현재 boot 후 바로 진입)
  ↓
Garage         ★ 허브 — 자동차가 주인공
  ↓
Map            주변 · 도로 · 전체
  ↓
Chat           도로/주변/GRID/1:1
  ↓
Mission        성장 · 일일/주간
  ↓
Community      자동차 커뮤니티
  ↓
Shop           Garage 꾸미기 · 아이템
```

보조 축 (병렬 진입):

```
Garage → Collection / Custom / Inventory / Records / Friends / Settings
Map    → Grid (Spatial)
Chat   ↔ Map / Grid (공간에서 보기)
Mission → Garage (보상·능력 반영)
Shop   → Garage (장착 미리보기)
```

---

## 2. 현재 Electron 플로우

```
Boot (#boot)
  ↓
Spatial HOME = 주변차량 (Map)
  ├─ 뷰: 주변 | 도로 | 전체
  ├─ GRID 메뉴
  └─ 공간 대화 오버레이
  ↓ (상단 메뉴 / MY CAR)
Content Workspace
  ├─ 대화방 (Chat AppShell)
  ├─ 성장 (Mission 일부)
  ├─ 상점 (Shop)
  ├─ 커뮤니티 (Community)
  └─ MY GARAGE (Garage + 하위 탭)
```

목표 플로우로 **일괄 강제 전환하지 않는다**.  
메뉴 IA 정렬은 ROADMAP v0.1~v0.2에서 단계적.

---

## 3. 화면별 목적 (One purpose)

| Screen | 목적 | 주인공 데이터 |
|--------|------|----------------|
| Splash | 모듈 준비 | — |
| Login | 신원 | User |
| Garage | 대표 차량 성장·표현 | **Vehicle** |
| Map | 현실 공간 연결 | Vehicle + Presence |
| Chat | 자동차 기반 대화 | ChatRoom + Vehicle |
| Mission | 성장 루프 | Mission + Vehicle |
| Grid | 지역 소속 | Grid + Vehicle |
| Community | 자동차 문화 | Post + Vehicle |
| Shop | 꾸미기·아이템 | Item + Vehicle |
| Settings | 계정·공개 | User |

---

## 4. Workspace 규칙

- Spatial: Map / Road / Grid (Leaflet·Three 유지)
- Content: Garage / Chat / Mission / Shop / Community / Settings
- 전환 200–300ms, 상태(`activeVehicleId`, conversation, view) 복원

---

## 5. 진입 딥링크 (논리)

| 이벤트 | 목적지 |
|--------|--------|
| MY CAR / Garage | Content · Garage |
| 도로 대화방 열기 | Content · Chat (road) |
| grid:chatOpen | Spatial Grid + Chat |
| 상점 장착 | Garage Custom |

모든 딥링크는 가능하면 `activeVehicleId`를 유지한다.

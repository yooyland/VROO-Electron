# VROO Desktop

**운전의 모든 순간을 연결하다.**  
*Drive Together, Live Better.*

| | |
|---|---|
| **제품** | Mobility Lifestyle Platform |
| **버전** | `1.1.0-beta.1` |
| **플랫폼** | Windows (Electron) |
| **라이선스** | UNLICENSED (private) |
| **단계** | Phase 1 — 프로토타입 안정화 |

VROO는 **운전자의 모든 생활을 하나로 연결하는** 위치 기반 모빌리티 라이프스타일 플랫폼입니다.  
차량을 아바타로 사용하는 소셜·GRID 커뮤니티·성장과 함께, 향후 혜택·커머스·보험·사고처리·지역 제휴·운영 콘솔로 확장합니다.

현재 빌드는 **서버 없는 Electron 로컬 프로토타입**입니다.  
미구현 기능을 완료된 것처럼 표시하지 않습니다. 상태: `implemented` · `prototype` · `planned`  
→ [docs/FEATURE_STATUS.md](./docs/FEATURE_STATUS.md)

---

## 제품 문서

| 문서 | 내용 |
|------|------|
| [docs/PRODUCT_VISION.md](./docs/PRODUCT_VISION.md) | 비전, 8개 서비스 축, 수익·차별점 |
| [docs/COMMERCIAL_ROADMAP.md](./docs/COMMERCIAL_ROADMAP.md) | Phase 1–6 상업화 로드맵 |
| [docs/FEATURE_STATUS.md](./docs/FEATURE_STATUS.md) | 기능별 상태표 |
| [docs/ADMIN_CONSOLE_PLAN.md](./docs/ADMIN_CONSOLE_PLAN.md) | 관리자 콘솔 설계 |
| [docs/PARTNER_PLATFORM_PLAN.md](./docs/PARTNER_PLATFORM_PLAN.md) | 제휴·혜택 노출 |
| [docs/COMMERCE_ARCHITECTURE.md](./docs/COMMERCE_ARCHITECTURE.md) | 주문·결제·정산 (미구현) |
| [docs/PRIVACY_AND_SAFETY_PLAN.md](./docs/PRIVACY_AND_SAFETY_PLAN.md) | 동의·안전 체크리스트 |

---

## 여덟 개 서비스 축

| 축 | 요약 | 현재 |
|----|------|------|
| **DRIVE** | 주변 · 도로 · 전체 · 위치 차량 | prototype |
| **SOCIAL** | 채팅 · GRID · 커뮤니티 | prototype |
| **STORE** | 차량 아이템 · 혜택 상품 | prototype / planned |
| **BENEFITS** | 주유·커피·멤버십 혜택 | planned |
| **CARE** | 보험 · 사고 · 긴급출동 | planned |
| **LOCAL** | GRID 지역 혜택 · POI | planned (+ 지명 prototype) |
| **PLAY** | 성장 · 미션 · 시즌 | prototype / planned |
| **MY** | 내 차량 · 쿠폰 · 설정 | prototype / planned |

확장 메뉴 정의(기존 UI 미교체): `app/assets/js/config/product-navigation.js`

---

## 현재 구현(프로토타입) 기능

- **지도**: 주변 / 도로 / 전체(좌우 50:50), GPS, 지명 레이어, 회전
- **Spatial GRID**: L1 50km / L2 10km / L3 2km, `locationGridId` · `currentGridId` · `selectedGridId`
- **도로**: Three.js, 레벨별 차량, 대화 광선·말풍선, 단일 renderer·loop
- **소셜**: 1:1·GRID 채팅, unread, 음성 입력, 커뮤니티
- **PLAY/STORE**: 성장·크레딧, 상점 기본(차량 선택), MY CAR
- **상태**: `localStorage` (`core/storage.js`)

### 상업화 목표 (미구현 · planned)

주유·커피 등 혜택, 멤버십, 보험 상담, 사고 접수, 긴급출동, Admin/Partner, 결제·정산, 실시간 서버, 신고·알림

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| 셸 | Electron (`contextIsolation`, `sandbox`, `nodeIntegration: false`) |
| UI | HTML / CSS / ES Modules |
| 지도 | Leaflet 1.9 (CDN) |
| 3D | Three.js r160 (CDN) |
| 상태 | `localStorage` |
| 이벤트 | `core/events.js` |
| 제품 설정 | `app/assets/js/config/*` |
| 도메인 시드 | `app/assets/js/data/*` |
| 빌드 | electron-builder (NSIS + Portable) |

CDN 의존으로 **인터넷 연결**이 필요합니다. 백엔드·WebSocket·Firebase 없음.

---

## 빠른 시작

### 요구 사항
- [Node.js LTS](https://nodejs.org/)
- Windows x64 (권장)

### 설치 & 실행

**방법 A — 배치 파일**

1. 처음: `01_INSTALL_AND_RUN.cmd`
2. 이후: `02_RUN_VROO.cmd`

**방법 B — npm**

```bash
npm install
npm start              # 일반 사용자 앱
npm run console        # VROO Console (역할 기반 운영)
npm run dev:platform   # User App + Console 동시
```

플랫폼 구조: [docs/PLATFORM_ARCHITECTURE.md](./docs/PLATFORM_ARCHITECTURE.md)  
콘솔 가이드: [docs/CONSOLE_USER_GUIDE.md](./docs/CONSOLE_USER_GUIDE.md)

> 사용자 앱 메뉴에 콘솔 링크는 없습니다. 개발 빌드에서 Electron 메뉴 **Develop → Open VROO Console** 또는 `Ctrl+Shift+C`.

### Windows 빌드

```bash
npm run build:win
```

결과: `dist/` (NSIS · Portable)

---

## 프로젝트 구조

```
VROO_Electron/
├── main.js / preload.js / package.json
├── docs/                         # 제품·상업화·운영 문서
├── app/
│   ├── index.html
│   └── assets/
│       ├── css/app.css
│       └── js/
│           ├── app.js            # 화면 연결만
│           ├── config/           # 네비·기능 상태
│           ├── data/             # 혜택·제휴·보험·멤버십 시드
│           ├── core/             # storage, events, ui
│           └── modules/          # map, road, grid, chat, …
├── assets/
└── *.cmd
```

### 모듈 역할

| 모듈 | 역할 |
|------|------|
| `map.js` | Leaflet, 마커, Spatial 오버레이 |
| `spatial-grid.js` | GRID ID·경계 |
| `grid.js` | GRID UI·참여 |
| `road.js` | Three.js 도로 |
| `chat.js` | 1:1 · GRID 채팅 |
| `shop.js` | 상점 (prototype + planned 카테고리 표시) |
| `growth.js` / `community.js` / … | PLAY · SOCIAL 패널 |

---

## 화면 구성 (현재 메뉴 유지)

상단: **주변차량 · 그리드 · 대화방 · 성장 · 상점 · 커뮤니티** (+ MY CAR)

```
주변: 지도 | 도로: Three.js | 전체: 지도 50% + 도로 50%
```

향후 1차 메뉴 후보: DRIVE · SOCIAL · STORE · BENEFITS · CARE · LOCAL · PLAY · MY  
→ 설정 파일만 정의, **이번 빌드에서 메뉴를 바꾸지 않음**

---

## 식별자 규칙

- 사용자: `user.id` (닉네임 ≠ 고유키)
- GRID: `grid.id`
- GRID 상태: `locationGridId` / `currentGridId` / `selectedGridId`

---

## 현재 제한사항

- Beta — 스키마·API·UI 변경 가능
- 서버 동기화·실결제·실보험 가입·외부 사고 전송 **없음**
- 민감정보(주민번호·카드번호 등) 수집 필드 **없음**
- Leaflet / Three.js CDN 의존
- `README_KO.md` — 초기 Electron 전환 보충 설명

---

## 개발 원칙

- 분석 → 최소 수정 → `node --check` → 수동 검증
- 대규모 리팩토링·기존 기능 삭제 금지
- Animation loop / Renderer 중복 생성 금지
- `app.js` 비대화 금지
- 상세: `.cursor/rules.md`

---

## 라이선스

Private / `UNLICENSED`. 무단 배포·재사용 금지.

## 관련

- 제품명: **VROO** · App ID: `com.vroo.desktop`
- 슬로건(KO): *운전의 모든 순간을 연결하다.*
- 슬로건(EN): *Drive Together, Live Better.*

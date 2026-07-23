# VROO Desktop

**Drive Together** — 위치 기반 자동차 SNS · 게임형 데스크톱 클라이언트

| | |
|---|---|
| **버전** | `1.1.0-beta.1` |
| **플랫폼** | Windows (Electron) |
| **라이선스** | UNLICENSED (private) |

VROO는 주변 지도, Spatial GRID, 3D 도로 주행, 1:1·GRID 단체 대화, 성장·상점·커뮤니티를 한 화면에서 연결하는 Electron 앱입니다.  
로컬 정적 서버나 PowerShell 호스팅 없이 `file://` 기반 Electron 창에서 바로 실행됩니다.

---

## 주요 기능

### 지도 · 위치
- **주변 / 도로 / 전체** 뷰 전환 (상단 guidebar)
- Leaflet 기반 지도 + VROO 자체 지명 레이어 (베이스맵 글자 타일 비의존)
- GPS 위치, 내 위치 버튼, 지도 회전(↺ N ↻), 지명 ON/OFF
- **전체** 화면: 왼쪽 실제 주변 지도 + 오른쪽 실제 Three.js 도로 (동일 road scene 재사용)

### Spatial GRID
- Web Mercator 기반 셀 (`KR:L{n}:ix:iy`)
- L1 50km / L2 10km / L3 2km — 참여·채팅은 **L3(LOCAL)** 기준
- `locationGridId` · `currentGridId` · `selectedGridId` 분리 (셀 클릭만으로 참여 GRID 변경 금지)
- 선택 GRID 상세: 현재 공간 차량 / 가입자, 참여·내 GRID 설정·단체 대화
- 상단 **그리드** 메뉴일 때만 지도에 Spatial GRID 오버레이 표시

### 도로 (Three.js)
- 레벨별 차량 Group, 환경(도심·주거·고속도로·해안 등)
- Direct / GRID 채팅 연동 대화 광선 · 차량 말풍선
- 단일 WebGL renderer · 단일 animation loop (전체 화면에서도 DOM 마운트만 이동)

### 소셜 · 기타
- 주변 차량, 1:1 채팅, GRID 단체방 (`grid:KR:L3:…`)
- 성장, 상점, MY PAGE, 커뮤니티 게시판 (게시판·정렬·내 글 드롭다운 필터)
- 크레딧 · 레벨 — `localStorage`에 가입/프로필 등 로컬 상태 저장

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| 셸 | Electron (`contextIsolation`, `sandbox`, `nodeIntegration: false`) |
| UI | HTML / CSS / ES Modules |
| 지도 | Leaflet 1.9 (CDN) |
| 3D | Three.js r160 (CDN) |
| 상태 | `localStorage` (`app/assets/js/core/storage.js`) |
| 이벤트 | 경량 pub/sub (`core/events.js`) |
| 빌드 | electron-builder (NSIS + Portable) |

> 현재 지도·Three.js는 CDN을 사용하므로 **인터넷 연결**이 필요합니다.  
> 백엔드 서버·WebSocket·Firebase 없이 클라이언트 단독으로 동작합니다.

---

## 빠른 시작

### 요구 사항
- [Node.js LTS](https://nodejs.org/)
- Windows x64 (권장)

### 설치 & 실행

**방법 A — 배치 파일**

1. 처음 한 번: `01_INSTALL_AND_RUN.cmd`  
   (`npm install` 후 앱 실행)
2. 이후: `02_RUN_VROO.cmd`

**방법 B — npm**

```bash
npm install
npm start
```

### Windows 실행 파일 빌드

```bash
# 또는 03_BUILD_EXE.cmd
npm run build:win
```

결과물: `dist/`  
- NSIS 설치 파일  
- Portable `VROO-{version}-x64.exe`

---

## 프로젝트 구조

```
VROO_Electron/
├── main.js                 # Electron 메인 프로세스
├── preload.js              # Preload (contextIsolation)
├── package.json
├── app/
│   ├── index.html          # 셸 UI · guidebar · view layers
│   └── assets/
│       ├── css/app.css
│       └── js/
│           ├── app.js      # 화면 연결 · setView / setScreen
│           ├── core/       # storage, events, ui
│           └── modules/    # map, road, grid, spatial-grid, chat, …
├── assets/                 # 아이콘 등 빌드 리소스
├── 01_INSTALL_AND_RUN.cmd
├── 02_RUN_VROO.cmd
└── 03_BUILD_EXE.cmd
```

### 모듈 역할 (요약)

| 모듈 | 역할 |
|------|------|
| `map.js` | Leaflet 주변/전체 지도, 마커, 지명, Spatial 오버레이 |
| `spatial-grid.js` | GRID ID·경계·줌 레벨 계산 |
| `grid.js` | GRID 목록·상세·참여·단체 대화 진입 |
| `road.js` | Three.js 도로, 차량, 광선, 말풍선, mount/resize |
| `chat.js` | 1:1 · GRID 단체방 |
| `nearby.js` / `community.js` / … | 패널 화면 |

---

## 화면 구성

```
┌─ topbar (메뉴 · 크레딧 · MY CAR) ─────────────────┐
├─ stage-head (현재 GRID · GPS) ────────────────────┤
├─ view-guidebar ───────────────────────────────────┤
│  [↺ N ↻ 지명]   [주변|도로|전체]   [도로환경]     │
├─ view-content ────────────────────────────────────┤
│  주변: 지도 전체폭                                 │
│  도로: Three.js 전체폭                             │
│  전체: 지도 50% | 도로 50% (동일 road scene)       │
└───────────────────────────────────────────────────┘
│ side-panel (주변차량 · GRID · 채팅 · …)            │
```

- guidebar는 지도/캔버스 **위가 아닌** 별도 문서 흐름 영역입니다.
- `selectedGridId`와 `currentGridId`를 혼용하지 않습니다.

---

## 개발 메모

- 앱 로직은 `app/assets/js/modules/*`에 두고, `app.js`는 화면 연결만 유지하는 것을 권장합니다.
- Spatial GRID 전국 셀을 `localStorage`에 통째로 저장하지 않습니다. 가입 상태(`joinedGrids`, `spatialMembers`)만 저장합니다.
- 사용자 식별 키는 `user.id`, GRID 식별 키는 `grid.id`입니다.
- 문법 검사 예:

```bash
node --check app/assets/js/app.js
node --check app/assets/js/modules/road.js
```

---

## 상태 · 제한

- **Beta** — API·UI·데이터 스키마가 바뀔 수 있습니다.
- 서버 동기화 없음 (로컬 데모/클라이언트 중심).
- Leaflet / Three.js CDN 의존 (오프라인 내장화는 향후 과제).
- `README_KO.md`에 초기 Electron 전환·지명 레이어 관련 추가 설명이 있습니다.

---

## 라이선스

Private / `UNLICENSED`. 무단 배포·재사용을 금합니다.

---

## 관련

- 제품명: **VROO**
- App ID: `com.vroo.desktop`
- 슬로건: *DRIVE TOGETHER*

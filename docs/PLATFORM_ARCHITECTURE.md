# PLATFORM_ARCHITECTURE

VROO Electron은 **User App** 과 **VROO Console** 을 한 저장소에서 분리 운영한다.

```
VROO Electron
├── User App (app/)          — Spatial / Content Workspace
├── VROO Console (console/)  — 역할 기반 통합 운영 콘솔
└── Shared (shared/)         — roles · permissions · demo data · utils
```

---

## 1. User App vs Console

| | User App | Console |
|--|----------|---------|
| 진입 | `npm start` → `app/index.html` | `npm run console` → `console/index.html` |
| 대상 | 운전자 | 운영·제휴·CS·분석·개발 |
| UI | 지도·도로·GRID·소셜 | 대시보드·테이블·업무 화면 |
| 인증 | 로컬 프로토타입 | **DEMO 역할 로그인** (실인증 아님) |

사용자 앱 상단 메뉴에 콘솔 링크를 **넣지 않는다**.  
개발 빌드에서만 Electron 메뉴 `Develop → Open VROO Console` / `Ctrl+Shift+C`.

---

## 2. 역할

`super_admin` · `operator` · `partner_admin` · `partner_staff` · `cs_agent` · `analyst` · `developer`  

정의: `shared/config/roles.js`

---

## 3. 권한

권한 카탈로그: `shared/config/permissions.js`  
검사: `shared/utils/permission.js` — **메뉴 필터 + route 진입 가드**

---

## 4. 실행 방법

```powershell
cd D:\VROO_Electron
npm start              # User App
npm run console        # Console
npm run dev:platform   # 둘 다
```

Electron: `createUserWindow()` / `createConsoleWindow()` (`main.js`)

---

## 5. 데이터 흐름

- Console 데모 데이터: `shared/data/*` (메모리 + 세션 localStorage)
- User App 데이터: `app` localStorage (`storage.js`) — **콘솔이 파괴·초기화하지 않음**
- 향후: 서버 API가 단일 소스, 클라이언트는 권한 토큰 기반

---

## 6. 보안 경계

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- preload로 버전·플랫폼만 노출
- Console 권한은 **UI 데모** — localStorage 조작으로 우회 가능 (실보안 아님)
- 제휴사 격리는 `session.partnerId` 필터 (서버 ACL 아님)

---

## 7. 향후 서버 인증

Phase 2+: OAuth/세션 토큰, 역할 claim, Partner tenant ACL, 감사 로그.

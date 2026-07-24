# CONSOLE_DEVELOPMENT_GUIDE

## 새 메뉴 추가

1. `shared/config/console-navigation.js`에 항목 추가 (`permission`, `route`, `status`)
2. `console/assets/js/modules/`에 렌더 함수 작성
3. `console-router.js`의 `ROUTES`에 등록
4. HTML 수정 불필요

## 새 권한 추가

1. `shared/config/permissions.js`의 `PERMISSIONS` + `ROLE_PERMISSION_MAP`
2. 라우트/버튼에서 `hasPermission(session, "…")` 검사

## 새 데모 데이터

`shared/data/`에 시드 추가 후 모듈에서 import.  
User App `localStorage`를 덮어쓰지 말 것.

## 라우팅

`navigate(route, ctx)` → `resolveRoute` (존재 + permission) → 모듈 렌더  
실패 시 toast + `defaultRoute` 폴백

## 상태

세션: `vroo.console.session` / `role` / `route`  
화면 데이터: 모듈 메모리(새로고침 시 시드 복귀)

## UI 패턴

`console-ui.js`: pageHeader, statCards, filterBar, dataTable, statusBadge, modal, toast, plannedNotice

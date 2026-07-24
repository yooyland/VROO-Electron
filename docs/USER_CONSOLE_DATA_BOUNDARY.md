# USER_CONSOLE_DATA_BOUNDARY

## User App 데이터

- 위치: `localStorage` via `app/assets/js/core/storage.js`
- 예: 프로필, 크레딧, 채팅, GRID 가입, 게시글, map view
- **보안 저장소가 아님**

## Console 데이터

- 시드: `shared/data/*`
- 세션: `vroo.console.session` · `vroo.console.role` · `vroo.console.route`
- 상태 변경은 콘솔 메모리(데모). User App 키를 지우거나 초기화하지 **않는다**

## 공유 가능 (향후 API)

사용자·차량·GRID·상품·혜택 스키마는 개념적으로 공유 가능하나,  
현재는 **별도 데모 시드**를 쓴다 (앱 회귀 방지).

## 서버 도입 후

| 구분 | 원칙 |
|------|------|
| 인증 | 서버 세션/JWT |
| 권한 | 서버 ACL + 클라이언트 UX |
| 제휴 격리 | tenant `partnerId` 서버 강제 |
| localStorage | 캐시·UI 선호만 |

**localStorage 기반 권한은 보안이 아니다.**

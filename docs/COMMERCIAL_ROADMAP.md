# VROO Commercial Roadmap

제품 정의: Mobility Lifestyle Platform  
슬로건: **운전의 모든 순간을 연결하다.**

기능 상태는 `implemented` / `prototype` / `planned` 로만 표기한다.  
미구현을 완료처럼 표현하지 않는다.

---

## Phase 1 — 프로토타입 안정화 *(현재 중심)*

| 영역 | 목표 | 상태 |
|------|------|------|
| 지도 (주변·전체) | GPS, 마커, 지명 | prototype |
| 도로 (Three.js) | 단일 renderer/loop, 차량·광선 | prototype |
| Spatial GRID | L1/L2/L3, 참여·상세 | prototype |
| 채팅 | 1:1, GRID, unread, 음성 | prototype |
| 성장·크레딧 | 로컬 규칙 | prototype |
| 상점 기본 | 차량 선택 수준 | prototype |
| 커뮤니티 | 로컬 게시글 | prototype |

**완료 기준:** 기존 화면 안정, 식별자(`user.id` / `grid.id`)·GRID 상태 분리 유지.

---

## Phase 2 — 서비스 기반

- 로그인·사용자 계정
- 백엔드 서버
- 실시간 위치·채팅
- 신고·차단
- 푸시/인앱 알림

**완료 기준:** localStorage 데모와 서버 계정의 경계가 문서·코드로 분리됨.

---

## Phase 3 — 혜택·상점

- 주유·커피·제휴 쿠폰
- 쿠폰함·포인트
- BenefitProduct / PartnerOffer
- MembershipPlan (결제 연동 전 데모 가능)

**완료 기준:** 혜택이 “광고”가 아닌 GRID 혜택 UX로 노출.

---

## Phase 4 — CARE

- 보험 비교·상담 리드 (InsuranceLead)
- 사고 접수 UI (AccidentCase, 외부 전송 전)
- 긴급출동·견인·정비 요청 플로우

**완료 기준:** 민감정보 없이 상담·접수 상태머신만 상용 가능 수준.

---

## Phase 5 — 운영 시스템

- Admin Console
- Partner Console
- 통계 대시보드
- 정산·CS

상세: [ADMIN_CONSOLE_PLAN.md](./ADMIN_CONSOLE_PLAN.md), [PARTNER_PLATFORM_PLAN.md](./PARTNER_PLATFORM_PLAN.md)

---

## Phase 6 — 상용 출시

- 외부 PG 결제 (카드번호 저장 금지)
- 보안·약관·위치정보 사업 대응
- 모니터링
- 모바일 배포 (별도 클라이언트 검토)

상세: [COMMERCE_ARCHITECTURE.md](./COMMERCE_ARCHITECTURE.md), [PRIVACY_AND_SAFETY_PLAN.md](./PRIVACY_AND_SAFETY_PLAN.md)

---

## 이번 작업(문서·스키마)에서 하지 않는 것

- 실결제 / 실보험 가입 / 외부 사고 신고 전송
- Firebase·WebSocket·서버 임의 추가
- 상단 메뉴 전면 교체
- 기존 기능 삭제·대규모 리팩토링

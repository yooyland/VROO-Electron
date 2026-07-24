# 프로젝트명: VROO Electron

**위치:** `D:\VROO_Electron`  
**성격:** 장기 프로젝트 · Mobility Lifestyle Platform

---

## 제품 정의

VROO는 **운전자의 모든 생활을 하나로 연결하는 Mobility Lifestyle Platform** 이다.

슬로건(KO): **운전의 모든 순간을 연결하다.**  
슬로건(EN): Drive Together, Live Better.

핵심: 위치 기반 자동차 소셜 · 차량=아바타 · GRID · 혜택 · 커머스 · CARE(보험·사고) · LOCAL · PLAY · 운영

상세: `docs/PRODUCT_VISION.md` · `README.md`

---

## 여덟 개 서비스 축

DRIVE · SOCIAL · STORE · BENEFITS · CARE · LOCAL · PLAY · MY  
메뉴 설정: `app/assets/js/config/product-navigation.js`  
기능 상태: `implemented` | `prototype` | `planned` → `feature-status.js` / `docs/FEATURE_STATUS.md`

현재 상단 메뉴(주변차량·그리드·대화방·성장·상점·커뮤니티)는 **유지**. 8축은 확장 구조만.

---

## 현재 개발 원칙

- 대규모 리팩토링 금지 · 기존 기능 유지 · 단계별 안정화
- 순서: **분석 → 최소 수정 → 검증** (`node --check` → 수동 테스트 → 보고)
- 미구현을 완료처럼 표시하지 않음
- 실결제 · 실보험 가입 · 외부 사고 전송 · 민감정보 필드 · 서버 임의 추가 금지
- 이벤트 중복 등록 금지 · Animation Loop 하나 · Renderer 중복 생성 금지
- `app.js` 비대화 금지

---

## 핵심 구조

| 경로 | 역할 |
|------|------|
| `app.js` | 화면 연결 |
| `modules/map|road|grid|chat|…` | 기능 모듈 |
| `config/` | 네비·기능 상태 |
| `data/` | 혜택·제휴·보험·멤버십 시드 |
| `docs/` | 제품·상업화·운영 문서 |
| `storage.js` | localStorage |

---

## 식별자

- 사용자: `user.id` (닉네임 ≠ 키)
- GRID: `grid.id`
- GRID 상태: `locationGridId` / `currentGridId` / `selectedGridId`

---

## Spatial GRID

KR 전체 · L1 50km / L2 10km / L3 2km · Web Mercator · viewport만 · GRID는 그리드 메뉴에서만

---

## 디자인

Black & Gold · 고급 자동차 UI · 게임감 · 버튼 최소화 · UI 용어는 **광고보다 혜택** 우선

---

## 작업 범위 경계

- 이 프로젝트(`D:\VROO_Electron`)만 수정
- App-YooYLand / OpenStudio / YooY·RN·Expo 패턴 금지
- 응답은 한국어

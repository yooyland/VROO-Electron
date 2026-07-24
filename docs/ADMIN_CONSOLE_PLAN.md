# Admin Console Plan

상태: **planned** (이번 단계: 기능 목록·폴더 초안만)

Electron 본앱과 분리된 운영 콘솔을 전제로 한다.  
실제 관리자 UI·API는 Phase 5에서 구현한다.

---

## 1. 목적

상업 운영에 필요한 회원·GRID·커머스·제휴·안전·공지를 한곳에서 관리한다.

---

## 2. 기능 모듈

### A. Dashboard
- 현재 접속자, 오늘 신규 가입, 활성 차량
- 채팅 수, GRID 수, 쿠폰 사용, 신고, 사고 요청

### B. Users
- 회원 검색·상태·정지
- 크레딧 지급, 레벨 변경, 차량 아이템 지급

### C. GRID
- GRID 조회, 참가자 수, 공식 GRID, 지역 이벤트, GRID 공지

### D. Commerce
- 상품·쿠폰·재고·주문·사용 내역·환불 상태

### E. Partners
- 보험사·주유사·카페·정비소·세차장·지역 광고주

### F. Safety
- 신고(채팅·게시글), 사고 접수, 긴급출동 상태

### G. Operations
- 공지·이벤트·푸시·배너·운영 로그

---

## 3. 권장 폴더 초안 (미생성)

```
admin/                          # 향후 별도 패키지 또는 app/admin
├── index.html
├── assets/
│   ├── css/
│   └── js/
│       ├── admin-app.js
│       ├── modules/
│       │   ├── dashboard.js
│       │   ├── users.js
│       │   ├── grids.js
│       │   ├── commerce.js
│       │   ├── partners.js
│       │   ├── safety.js
│       │   └── operations.js
│       └── api/                # 서버 API 클라이언트 (Phase 2+)
└── README.md
```

본 저장소에는 지금 `admin/` 을 만들지 않는다.  
도메인 스키마는 `app/assets/js/data/*` 데모와 docs를 따른다.

---

## 4. 권한 (향후)

| 역할 | 범위 |
|------|------|
| super_admin | 전체 |
| ops | Users / Safety / Operations |
| commerce | Commerce / Partners |
| partner_readonly | 자기 Partner 데이터만 (Partner Console) |

---

## 5. 연동 지점 (향후 API)

| 영역 | 예시 엔드포인트 |
|------|-----------------|
| Dashboard | `GET /admin/metrics` |
| Users | `GET/PATCH /admin/users/:id` |
| Safety | `GET /admin/reports`, `GET /admin/accidents` |
| Commerce | `GET /admin/orders`, `POST /admin/refunds` |

클라이언트는 토큰·감사 로그 없이 민감 작업을 수행하지 않는다.

---

## 6. 이번 단계 금지

- 실제 관리자 앱 구현
- 운영자 백도어·하드코딩 권한
- 실사용자 개인정보 대량 조회 UI

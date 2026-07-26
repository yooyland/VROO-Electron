# VROO Product Vision

**운전의 모든 순간을 연결하다.**  
*Drive Together, Live Better.*

---

## 1. 제품 정의

VROO는 **운전자의 모든 생활을 하나로 연결하는 Mobility Lifestyle Platform** 이다.

단순 자동차 채팅·지도 앱이 아니다.  
실제 위치 위에서 **차량을 아바타**로 삼아 소셜·혜택·커머스·보험·긴급지원·지역 커뮤니티를 한 경험으로 묶는다.

| 핵심 가치 | 설명 |
|-----------|------|
| 위치 기반 자동차 소셜 | 주변 차량·도로·GRID에서 만남과 대화 |
| 차량 = 사용자 아바타 | 외관·레벨·아이템이 정체성 ([Vehicle Face DNA](./VEHICLE_FACE_DNA.md) Draft) |
| GRID 지역 커뮤니티 | L3 Spatial GRID 기반 소속·단체채팅 |
| 운전자 생활 혜택 | 주유·커피·세차 등 “혜택” 우선 노출 |
| 자동차 커머스 | 스킨·아이템·제휴상품·포인트몰 |
| CARE | 보험·사고처리·긴급출동·정비 |
| LOCAL | GRID 기반 지역 혜택·장소·이벤트 |
| PLAY | 성장·미션·시즌·주행 보상 |
| 운영 | Admin / Partner / 정산 / 안전 |

---

## 2. 여덟 개 서비스 축

| 축 | 역할 | 현재 ↔ 향후 |
|----|------|-------------|
| **A. DRIVE** | 주변·도로·전체·내 차량·주행·위치 표시 | 프로토타입 중심 → 실시간 서버 |
| **B. SOCIAL** | 1:1·GRID 채팅·친구·파티·커뮤니티 | 채팅·GRID·커뮤니티 있음 → 친구/파티 |
| **C. STORE** | 차량 아이템·스킨·쿠폰·제휴·포인트몰 | 기본 상점 → 혜택·결제 연동 |
| **D. BENEFITS** | 주유·커피·멤버십·시즌 혜택 | planned |
| **E. CARE** | 보험·사고·긴급출동·정비 | planned (스키마만) |
| **F. LOCAL** | GRID 광고→혜택, 주유소·카페·정비 등 | 지명 레이어 일부 → PartnerOffer |
| **G. PLAY** | 성장·미션·랭킹·시즌·출석 | 성장·크레딧 → 시즌/미션 |
| **H. MY** | 차량·포인트·쿠폰·보험·결제·설정 | MY CAR 일부 → 통합 MY |

현재 UI 메뉴(주변차량·그리드·대화방·성장·상점·커뮤니티)는 유지한다.  
확장 메뉴 정의는 `app/assets/js/config/product-navigation.js` 를 따른다.

---

## 3. 주요 사용자 흐름 (목표)

### 일상 드라이브
GPS → 주변/도로/전체 → 주변 차량 확인 → 1:1 또는 GRID 대화 → 성장·상점

### GRID 소속
위치 셀 확인 → L3 GRID 선택·참여 → 단체채팅 → 지역 혜택(향후)

### 혜택 이용 (향후)
현재 GRID 혜택 목록 → BenefitProduct 선택 → 쿠폰함 → 사용(제휴사)

### CARE (향후)
사고/긴급 상황 → 위치·시간 기록 → 사진 → 보험 상담/긴급출동 요청 → 상태 추적  
※ 직접 보험 확정·외부 전송은 상용 Phase에서만

### 가입·멤버십 (향후)
가입 → welcomeBenefits → MembershipPlan → UserMembership (데모는 결제 없음)

---

## 4. 수익 모델 (방향)

| 축 | 수익원 |
|----|--------|
| STORE / BENEFITS | 아이템·쿠폰·포인트몰 마진, 제휴 수수료 |
| LOCAL | GRID 기반 PartnerOffer / 공식 GRID |
| CARE | 보험 상담·가입 연결 수수료 (중개, 직접 인수 아님) |
| PLAY | 시즌패스·프리미엄 성장 (선택) |
| MEMBERSHIP | 월/연 멤버십 |
| B2B | Partner Console, 지역 광고주 |

광고 용어보다 **“현재 위치에서 쓸 수 있는 혜택”** 을 UI 기본 언어로 쓴다.

---

## 5. 차별점

1. **차량 아바타 + 실위치** — SNS와 모빌리티가 같은 좌표에서 만남  
2. **Spatial GRID** — 행정구역이 아닌 주행 공간 커뮤니티  
3. **혜택 우선 LOCAL** — 배너 광고가 아니라 GRID 혜택  
4. **CARE 내장** — 소셜 앱이 사고·긴급·보험 상담까지 연결  
5. **게임화(PLAY)** — 운전 생활의 지속 참여 동기  

---

## 6. 현재 단계 원칙

- Electron + `localStorage` 프로토타입  
- 미구현 기능을 완료된 것처럼 표시하지 않음 (`implemented` / `prototype` / `planned`)  
- 민감정보·실결제·실보험 가입·외부 사고 신고 전송 금지  
- 상세 상태표: [FEATURE_STATUS.md](./FEATURE_STATUS.md)  
- 로드맵: [COMMERCIAL_ROADMAP.md](./COMMERCIAL_ROADMAP.md)

# Commerce Architecture

상태: **planned** (문서·스키마만. 결제·PG 구현 금지)

---

## 1. 원칙

- 카드번호·계좌 등 결제수단 원문 **저장 금지**
- PG는 외부 결제사업자 연동만 (직접 결제창 구현 금지)
- 데모 구매를 실결제로 표현하지 않음
- BenefitProduct 와 차량 아이템을 **사용자 혜택 상품** 관점으로 통일

---

## 2. 핵심 개념

| 개념 | 역할 |
|------|------|
| **BenefitProduct** | 쿠폰·할인·제휴 상품 마스터 |
| **Order** | 구매/교환 요청 |
| **Payment** | PG 결과 참조 (토큰·거래ID만) |
| **CouponIssue** | 사용자에게 발급된 쿠폰 |
| **CouponUse** | 사용 기록 |
| **Refund** | 환불 상태 |
| **Settlement** | 제휴 정산 배치 |
| **Commission** | 수수료 계산 결과 |

### BenefitProduct (요약)

`id, type, category, title, partnerId, description, benefitType, discountAmount, discountRate, price, pointPrice, stock, validFrom, validUntil, usageLimit, eligibility, regionGridIds, status, image, terms`

카테고리: `fuel|coffee|convenience|carwash|food|maintenance|parking|insurance`

시드: `app/assets/js/data/benefit-products.js`

### MembershipPlan / UserMembership

시드: `app/assets/js/data/membership-plans.js`  
데모는 `status: "prototype"` 또는 `"planned"`, **결제 없이** 가입 시뮬레이션만 허용(향후 UI).

---

## 3. 주문·결제 흐름 (향후)

```
장바구니/즉시구매
  → Order(created)
  → PG redirect / SDK (외부)
  → Payment webhook (paid|failed)
  → CouponIssue 또는 아이템 지급
  → Settlement 배치 (Partner)
```

데모 단계:

```
선택 → “데모 지급(프로토타입)” 표시 → localStorage만 갱신
```

---

## 4. 외부 연동 지점

| 지점 | 설명 |
|------|------|
| `POST /payments/intent` | PG intent 생성 |
| `POST /webhooks/pg` | 결제 결과 |
| `POST /coupons/issue` | 발급 |
| `POST /settlements/run` | 정산 배치 |

Electron 클라이언트는 비밀키를 갖지 않는다.

---

## 5. 상점 UI와의 관계

현재 `shop.js` 는 차량 선택 **prototype**.  
planned 카테고리(혜택·제휴)는 상태 뱃지로만 표시 가능.  
실구매·실쿠폰 발급은 Phase 3+.

---

## 6. 금지 (현재 단계)

- PG SDK 임의 추가
- 카드번호 필드
- “결제 완료” 문구로 데모 구매 포장

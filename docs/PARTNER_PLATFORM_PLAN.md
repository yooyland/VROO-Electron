# Partner Platform Plan

상태: **planned** (데모 Partner 데이터만 허용, 실계약·정산 데이터 금지)

---

## 1. 목적

주유·커피·보험·세차·정비·견인 등 제휴사가 VROO에 **혜택·상품·CARE 서비스**를 공급하는 B2B 축.

UI 언어는 “광고”보다 **혜택(PartnerOffer / BenefitProduct)** 을 우선한다.

---

## 2. Partner 스키마

```js
{
  id: "partner_fuel_01",
  name: "데모 주유 파트너",
  category: "fuel",           // fuel|coffee|insurance|carwash|maintenance|parking|food|convenience|towing
  contact: { email: "demo@example.com", phone: null },  // 실연락처·계약서 금지
  status: "planned",          // planned|active|suspended
  serviceRegions: ["KR"],     // 또는 gridId 목록 (향후)
  settlementType: "commission",
  commissionRate: null,       // 실계약율 저장 금지(데모는 null)
  branding: { logo: null, primaryColor: "#c9a227" }
}
```

데모 시드: `app/assets/js/data/partners.js`

---

## 3. PartnerOffer (GRID 혜택 노출)

```js
{
  id: "offer_01",
  partnerId: "partner_fuel_01",
  gridIds: ["KR:L3:…"],      // 노출 GRID
  category: "fuel",
  title: "주변 주유 할인 혜택",
  benefit: "리터당 할인 쿠폰 (데모)",
  targetAudience: "grid_members",
  activeFrom: null,
  activeUntil: null,
  priority: 10,
  status: "planned"
}
```

노출 예: 현재 GRID(선정릉 등) → 주유·커피·세차·보험 갱신 **혜택** 목록.

---

## 4. Partner Console (향후)

| 기능 | 설명 |
|------|------|
| 오퍼 등록 | BenefitProduct / PartnerOffer CRUD |
| 재고·유효기간 | stock, validFrom/Until |
| 사용 현황 | CouponUse 집계 (개인 식별 최소화) |
| 정산 미리보기 | Settlement 요약 (실계좌 정보 없음) |

폴더 초안: `partner-console/` (Phase 5, 현재 미생성)

---

## 5. 카테고리

`fuel` · `coffee` · `insurance` · `carwash` · `maintenance` · `parking` · `food` · `convenience` · `towing`

---

## 6. 금지

- 실제 정산·계약·수수료율 운영 데이터
- 제휴사 담당자 실명·개인연락처 대량 저장
- 배너형 “광고”를 완료 기능처럼 UI에 심기

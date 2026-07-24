/**
 * BenefitProduct 데모 시드 — 결제·발급 로직 없음
 * status: planned | prototype
 */

/** @typedef {"fuel"|"coffee"|"convenience"|"carwash"|"food"|"maintenance"|"parking"|"insurance"} BenefitCategory */

/**
 * @type {Array<{
 *   id: string,
 *   type: string,
 *   category: BenefitCategory,
 *   title: string,
 *   partnerId: string|null,
 *   description: string,
 *   benefitType: string,
 *   discountAmount: number|null,
 *   discountRate: number|null,
 *   price: number|null,
 *   pointPrice: number|null,
 *   stock: number|null,
 *   validFrom: string|null,
 *   validUntil: string|null,
 *   usageLimit: number|null,
 *   eligibility: string,
 *   regionGridIds: string[],
 *   status: string,
 *   image: string|null,
 *   terms: string
 * }>}
 */
export const BENEFIT_PRODUCTS = [
  {
    id: "bp_fuel_demo_01",
    type: "coupon",
    category: "fuel",
    title: "주유 할인 쿠폰 (데모)",
    partnerId: "partner_fuel_01",
    description: "GRID 근처 제휴 주유소 할인 혜택 예시. 실결제·실발급 없음.",
    benefitType: "discount_amount",
    discountAmount: 3000,
    discountRate: null,
    price: null,
    pointPrice: 500,
    stock: null,
    validFrom: null,
    validUntil: null,
    usageLimit: 1,
    eligibility: "all_users",
    regionGridIds: [],
    status: "planned",
    image: null,
    terms: "데모 상품. 실제 주유소에서 사용할 수 없습니다."
  },
  {
    id: "bp_coffee_demo_01",
    type: "coupon",
    category: "coffee",
    title: "커피 쿠폰 (데모)",
    partnerId: "partner_coffee_01",
    description: "드라이브 중 이용 가능한 커피 혜택 예시.",
    benefitType: "discount_rate",
    discountAmount: null,
    discountRate: 20,
    price: null,
    pointPrice: 200,
    stock: null,
    validFrom: null,
    validUntil: null,
    usageLimit: 1,
    eligibility: "all_users",
    regionGridIds: [],
    status: "planned",
    image: null,
    terms: "데모 상품. 실제 매장 사용 불가."
  },
  {
    id: "bp_carwash_demo_01",
    type: "coupon",
    category: "carwash",
    title: "세차 할인 (데모)",
    partnerId: "partner_carwash_01",
    description: "세차 제휴 할인 혜택 예시.",
    benefitType: "discount_rate",
    discountAmount: null,
    discountRate: 15,
    price: null,
    pointPrice: 300,
    stock: null,
    validFrom: null,
    validUntil: null,
    usageLimit: 2,
    eligibility: "grid_members",
    regionGridIds: [],
    status: "planned",
    image: null,
    terms: "데모 상품."
  },
  {
    id: "bp_welcome_credit",
    type: "reward",
    category: "convenience",
    title: "가입 환영 VROO Credit",
    partnerId: null,
    description: "가입 시 지급되는 크레딧 혜택 예시(미연동).",
    benefitType: "credit_grant",
    discountAmount: null,
    discountRate: null,
    price: 0,
    pointPrice: 0,
    stock: null,
    validFrom: null,
    validUntil: null,
    usageLimit: 1,
    eligibility: "new_users",
    regionGridIds: [],
    status: "planned",
    image: null,
    terms: "실제 자동 지급 없음. MembershipPlan.welcomeBenefits 참조."
  }
];

/** PartnerOffer — GRID 혜택 노출 (광고 용어 대신 혜택) */
export const PARTNER_OFFERS = [
  {
    id: "offer_fuel_grid_demo",
    partnerId: "partner_fuel_01",
    gridIds: [],
    category: "fuel",
    title: "주변 주유소 할인 혜택",
    benefit: "리터당 할인 쿠폰 (데모)",
    targetAudience: "grid_members",
    activeFrom: null,
    activeUntil: null,
    priority: 10,
    status: "planned"
  },
  {
    id: "offer_coffee_grid_demo",
    partnerId: "partner_coffee_01",
    gridIds: [],
    category: "coffee",
    title: "커피 쿠폰 혜택",
    benefit: "아메리카노 할인 (데모)",
    targetAudience: "nearby_drivers",
    activeFrom: null,
    activeUntil: null,
    priority: 8,
    status: "planned"
  }
];

export function listBenefitsByCategory(category) {
  return BENEFIT_PRODUCTS.filter((p) => p.category === category);
}

export function listPlannedBenefits() {
  return BENEFIT_PRODUCTS.filter((p) => p.status === "planned");
}

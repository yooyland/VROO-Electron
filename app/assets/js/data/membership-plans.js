/**
 * MembershipPlan / UserMembership — 데모 스키마
 * 실제 결제 없이 status·혜택 ID만 정의
 */

export const MEMBERSHIP_PLANS = [
  {
    id: "plan_basic",
    name: "VROO Basic",
    monthlyPrice: 0,
    annualPrice: 0,
    benefits: ["bp_welcome_credit"],
    welcomeBenefits: ["bp_welcome_credit"],
    renewalBenefits: [],
    status: "planned"
  },
  {
    id: "plan_drive_plus",
    name: "VROO Drive Plus (데모)",
    monthlyPrice: null,
    annualPrice: null,
    benefits: ["bp_fuel_demo_01", "bp_coffee_demo_01", "bp_carwash_demo_01"],
    welcomeBenefits: ["bp_fuel_demo_01", "bp_coffee_demo_01"],
    renewalBenefits: ["bp_carwash_demo_01"],
    status: "planned"
  }
];

/**
 * UserMembership 스키마 예시 — 인스턴스를 localStorage에 강제 저장하지 않음
 */
export const USER_MEMBERSHIP_SCHEMA = {
  userId: "string",
  planId: "string",
  joinedAt: "number|ISO",
  expiresAt: "number|ISO|null",
  status: "planned|active|expired|cancelled",
  receivedBenefitIds: "string[]"
};

/** 가입 시 제공 가능 혜택 유형 (카탈로그) */
export const WELCOME_BENEFIT_TYPES = [
  { id: "fuel_coupon", label: "주유쿠폰", status: "planned" },
  { id: "coffee_coupon", label: "커피쿠폰", status: "planned" },
  { id: "car_skin", label: "차량 스킨", status: "planned" },
  { id: "vroo_credit", label: "VROO Credit", status: "planned" },
  { id: "grid_badge", label: "GRID 특별 배지", status: "planned" },
  { id: "insurance_reward", label: "보험 가입 리워드", status: "planned" },
  { id: "carwash_coupon", label: "세차 할인권", status: "planned" }
];

export function getPlanById(id) {
  return MEMBERSHIP_PLANS.find((p) => p.id === id) || null;
}

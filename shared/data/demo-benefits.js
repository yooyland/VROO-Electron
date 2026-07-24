export const DEMO_BENEFITS = [
  { id: "bf_fuel_01", partnerId: "partner-gas-001", title: "주유 3,000원 할인", category: "fuel", status: "active", usageLimit: 1, stock: 200 },
  { id: "bf_fuel_02", partnerId: "partner-gas-001", title: "주말 주유 5%", category: "fuel", status: "pending", usageLimit: 2, stock: 100 },
  { id: "bf_coffee_01", partnerId: "partner-coffee-001", title: "아메리카노 20%", category: "coffee", status: "active", usageLimit: 1, stock: 300 },
  { id: "bf_wash_01", partnerId: "partner-wash-001", title: "세차 15% 할인", category: "carwash", status: "inactive", usageLimit: 1, stock: 50 },
  { id: "bf_welcome", partnerId: null, title: "가입 환영 Credit", category: "credit", status: "planned", usageLimit: 1, stock: null }
];

export const DEMO_COUPON_USES = [
  { id: "cu1", benefitId: "bf_fuel_01", partnerId: "partner-gas-001", userId: "u1", usedAt: "2026-07-20", status: "resolved" },
  { id: "cu2", benefitId: "bf_coffee_01", partnerId: "partner-coffee-001", userId: "u2", usedAt: "2026-07-21", status: "resolved" },
  { id: "cu3", benefitId: "bf_fuel_01", partnerId: "partner-gas-001", userId: "u5", usedAt: "2026-07-22", status: "pending" }
];

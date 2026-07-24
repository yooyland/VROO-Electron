export const DEMO_PRODUCTS = [
  { id: "prd_skin_01", partnerId: null, title: "골드 차량 스킨", category: "skin", price: 1200, stock: 99, status: "active", scope: "global" },
  { id: "prd_led_01", partnerId: null, title: "LED 언더글로우", category: "led", price: 800, stock: 40, status: "active", scope: "global" },
  { id: "prd_gas_01", partnerId: "partner-gas-001", title: "주유 할인 상품", category: "fuel", price: 0, stock: 500, status: "active", scope: "partner" },
  { id: "prd_gas_02", partnerId: "partner-gas-001", title: "세차 연계 패키지", category: "bundle", price: 500, stock: 80, status: "pending", scope: "partner" },
  { id: "prd_coffee_01", partnerId: "partner-coffee-001", title: "드라이브 커피 세트", category: "coffee", price: 300, stock: 200, status: "active", scope: "partner" },
  { id: "prd_wash_01", partnerId: "partner-wash-001", title: "프리미엄 세차", category: "carwash", price: 450, stock: 60, status: "inactive", scope: "partner" }
];

export const DEMO_SETTLEMENTS = [
  { id: "st1", partnerId: "partner-gas-001", period: "2026-06", amount: 1280000, status: "pending", note: "데모 정산" },
  { id: "st2", partnerId: "partner-gas-001", period: "2026-05", amount: 980000, status: "approved", note: "데모 정산" },
  { id: "st3", partnerId: "partner-coffee-001", period: "2026-06", amount: 420000, status: "approved", note: "데모 정산" },
  { id: "st4", partnerId: "partner-wash-001", period: "2026-06", amount: 210000, status: "pending", note: "데모 정산" }
];

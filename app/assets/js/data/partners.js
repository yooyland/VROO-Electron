/**
 * Partner 데모 시드 — 실계약·정산율·실연락처 운영 데이터 금지
 */

export const PARTNER_CATEGORIES = [
  "fuel",
  "coffee",
  "insurance",
  "carwash",
  "maintenance",
  "parking",
  "food",
  "convenience",
  "towing"
];

export const PARTNERS = [
  {
    id: "partner_fuel_01",
    name: "데모 주유 파트너",
    category: "fuel",
    contact: { email: "demo-fuel@example.com", phone: null },
    status: "planned",
    serviceRegions: ["KR"],
    settlementType: "commission",
    commissionRate: null,
    branding: { logo: null, primaryColor: "#c9a227" }
  },
  {
    id: "partner_coffee_01",
    name: "데모 커피 파트너",
    category: "coffee",
    contact: { email: "demo-coffee@example.com", phone: null },
    status: "planned",
    serviceRegions: ["KR"],
    settlementType: "commission",
    commissionRate: null,
    branding: { logo: null, primaryColor: "#c9a227" }
  },
  {
    id: "partner_insurance_01",
    name: "데모 보험 파트너",
    category: "insurance",
    contact: { email: "demo-insure@example.com", phone: null },
    status: "planned",
    serviceRegions: ["KR"],
    settlementType: "lead_fee",
    commissionRate: null,
    branding: { logo: null, primaryColor: "#c9a227" }
  },
  {
    id: "partner_carwash_01",
    name: "데모 세차 파트너",
    category: "carwash",
    contact: { email: "demo-wash@example.com", phone: null },
    status: "planned",
    serviceRegions: ["KR"],
    settlementType: "commission",
    commissionRate: null,
    branding: { logo: null, primaryColor: "#c9a227" }
  },
  {
    id: "partner_towing_01",
    name: "데모 견인·긴급출동",
    category: "towing",
    contact: { email: "demo-tow@example.com", phone: null },
    status: "planned",
    serviceRegions: ["KR"],
    settlementType: "service_fee",
    commissionRate: null,
    branding: { logo: null, primaryColor: "#c9a227" }
  }
];

export function getPartnerById(id) {
  return PARTNERS.find((p) => p.id === id) || null;
}

export function listPartnersByCategory(category) {
  return PARTNERS.filter((p) => p.category === category);
}

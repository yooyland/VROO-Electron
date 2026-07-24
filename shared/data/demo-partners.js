/** Partner demo — UI 격리용. 실계약·정산 데이터 아님 */
export const DEMO_PARTNERS = [
  {
    id: "partner-gas-001",
    name: "데모 주유 파트너",
    category: "fuel",
    status: "active",
    branches: 12,
    contractStatus: "active",
    settlementStatus: "pending",
    contractEndDate: "2026-09-30",
    pendingSinceDays: null,
    productApprovalsPending: 0
  },
  {
    id: "partner-coffee-001",
    name: "데모 커피 파트너",
    category: "coffee",
    status: "active",
    branches: 8,
    contractStatus: "active",
    settlementStatus: "approved",
    contractEndDate: "2026-08-15",
    pendingSinceDays: null,
    productApprovalsPending: 1
  },
  {
    id: "partner-insure-001",
    name: "데모 보험 파트너",
    category: "insurance",
    status: "pending",
    branches: 1,
    contractStatus: "pending",
    settlementStatus: "inactive",
    contractEndDate: null,
    pendingSinceDays: 2,
    productApprovalsPending: 2
  },
  {
    id: "partner-wash-001",
    name: "데모 세차 파트너",
    category: "carwash",
    status: "active",
    branches: 5,
    contractStatus: "active",
    settlementStatus: "pending",
    contractEndDate: "2026-12-01",
    pendingSinceDays: null,
    productApprovalsPending: 0
  }
];

export const DEMO_BRANCHES = [
  { id: "br1", partnerId: "partner-gas-001", name: "강남점", status: "active", region: "서울" },
  { id: "br2", partnerId: "partner-gas-001", name: "선정릉점", status: "active", region: "서울" },
  { id: "br3", partnerId: "partner-coffee-001", name: "역삼점", status: "active", region: "서울" },
  { id: "br4", partnerId: "partner-wash-001", name: "삼성점", status: "inactive", region: "서울" }
];

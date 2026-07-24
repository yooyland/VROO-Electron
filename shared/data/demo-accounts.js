/**
 * Console operator accounts — seed only (not real PII)
 * Maps roleId → display identity for session hydration
 */
export const CONSOLE_ACCOUNTS = Object.freeze({
  super_admin: {
    userId: "ops-sa-001",
    displayName: "운영 총괄",
    roleId: "super_admin",
    organizationId: "org-vroo",
    organizationName: "VROO Operations",
    partnerId: null,
    department: "플랫폼 운영",
    email: "ops.lead@vroo.local"
  },
  operator: {
    userId: "ops-op-001",
    displayName: "운영 담당",
    roleId: "operator",
    organizationId: "org-vroo",
    organizationName: "VROO Operations",
    partnerId: null,
    department: "서비스 운영",
    email: "ops.desk@vroo.local"
  },
  partner_admin: {
    userId: "ptn-adm-001",
    displayName: "제휴 관리자",
    roleId: "partner_admin",
    organizationId: "org-partner-gas",
    organizationName: "모빌리티 제휴 파트너",
    partnerId: "partner-gas-001",
    department: "제휴 본부",
    email: "partner.admin@example.local"
  },
  partner_staff: {
    userId: "ptn-stf-001",
    displayName: "제휴 운영 직원",
    roleId: "partner_staff",
    organizationId: "org-partner-gas",
    organizationName: "모빌리티 제휴 파트너",
    partnerId: "partner-gas-001",
    department: "매장 운영",
    email: "partner.staff@example.local"
  },
  cs_agent: {
    userId: "cs-001",
    displayName: "고객지원 상담",
    roleId: "cs_agent",
    organizationId: "org-vroo",
    organizationName: "VROO Customer Support",
    partnerId: null,
    department: "고객지원 데스크",
    email: "cs.agent@vroo.local"
  },
  analyst: {
    userId: "an-001",
    displayName: "데이터 분석",
    roleId: "analyst",
    organizationId: "org-vroo",
    organizationName: "VROO Insights",
    partnerId: null,
    department: "분석팀",
    email: "analyst@vroo.local"
  },
  developer: {
    userId: "dev-001",
    displayName: "플랫폼 엔지니",
    roleId: "developer",
    organizationId: "org-vroo",
    organizationName: "VROO Engineering",
    partnerId: null,
    department: "플랫폼 엔지니어링",
    email: "dev@vroo.local"
  }
});

export function accountForRole(roleId) {
  return CONSOLE_ACCOUNTS[roleId] || null;
}

/** App environment — not shown on main dashboard */
export const APP_ENVIRONMENT = "development";

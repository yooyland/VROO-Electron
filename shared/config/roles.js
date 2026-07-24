import { ROLE_PERMISSION_MAP } from "./permissions.js";

/**
 * Console roles — DEMO only (실서버 인증 아님)
 */
export const ROLES = Object.freeze({
  super_admin: {
    id: "super_admin",
    label: "최고 관리자",
    description: "VROO 전체 운영 및 권한 관리",
    permissions: ROLE_PERMISSION_MAP.super_admin,
    defaultRoute: "dashboard",
    consoleSections: ["operations", "commerce", "partners", "support", "analytics", "system"],
    demoPartnerId: null
  },
  operator: {
    id: "operator",
    label: "운영 관리자",
    description: "회원·차량·GRID·신고·상품 운영",
    permissions: ROLE_PERMISSION_MAP.operator,
    defaultRoute: "dashboard",
    consoleSections: ["operations", "commerce", "support", "analytics"],
    demoPartnerId: null
  },
  partner_admin: {
    id: "partner_admin",
    label: "제휴사 관리자",
    description: "자기 제휴사 상품·혜택·정산 관리",
    permissions: ROLE_PERMISSION_MAP.partner_admin,
    defaultRoute: "dashboard",
    consoleSections: ["partners", "commerce", "analytics"],
    demoPartnerId: "partner-gas-001"
  },
  partner_staff: {
    id: "partner_staff",
    label: "제휴사 직원",
    description: "자기 제휴사 상품·쿠폰 제한적 관리",
    permissions: ROLE_PERMISSION_MAP.partner_staff,
    defaultRoute: "products",
    consoleSections: ["commerce", "partners", "analytics"],
    demoPartnerId: "partner-gas-001"
  },
  cs_agent: {
    id: "cs_agent",
    label: "고객센터 상담원",
    description: "문의·신고·사고 접수 처리",
    permissions: ROLE_PERMISSION_MAP.cs_agent,
    defaultRoute: "support",
    consoleSections: ["support", "operations"],
    demoPartnerId: null
  },
  analyst: {
    id: "analyst",
    label: "통계 분석가",
    description: "서비스 통계 및 보고서 열람",
    permissions: ROLE_PERMISSION_MAP.analyst,
    defaultRoute: "analytics",
    consoleSections: ["analytics"],
    demoPartnerId: null
  },
  developer: {
    id: "developer",
    label: "개발자",
    description: "시스템 상태·기능 플래그·로그 확인",
    permissions: ROLE_PERMISSION_MAP.developer,
    defaultRoute: "system",
    consoleSections: ["system", "analytics"],
    demoPartnerId: null
  }
});

export const DEMO_ROLE_OPTIONS = Object.values(ROLES);

export function getRole(roleId) {
  return ROLES[roleId] || null;
}

export function isValidRoleId(roleId) {
  return Boolean(ROLES[roleId]);
}

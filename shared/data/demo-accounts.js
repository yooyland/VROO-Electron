/**
 * Console accounts — Account ≠ Role
 * Seed only. Server auth not connected.
 */

import { isValidRoleId } from "../config/roles.js";

export const APP_ENVIRONMENT = "development";

export const ROOT_AUTHORITY_ACCOUNT_ID = "account-root-001";

/** Account-level authority permissions (not granted by super_admin *) */
export const ROOT_AUTHORITY_PERMISSIONS = Object.freeze([
  "accounts.view",
  "accounts.manage",
  "roles.assign",
  "roles.revoke",
  "permissions.assign",
  "permissions.revoke",
  "root_authority.manage"
]);

const SEED_ACCOUNTS = [
  {
    id: "account-root-001",
    username: "YooY",
    displayName: "YooY",
    legalName: "정창훈",
    email: "admin@yooyland.com",
    accountType: "root_authority",
    organizationId: "vroo-hq",
    organizationName: "VROO Operations",
    department: "운영 총괄",
    assignedRoles: ["super_admin", "operator", "analyst", "developer"],
    assignedRoleContexts: [
      { roleId: "super_admin", organizationId: "vroo-hq", partnerId: null },
      { roleId: "operator", organizationId: "vroo-hq", partnerId: null },
      { roleId: "analyst", organizationId: "vroo-hq", partnerId: null },
      { roleId: "developer", organizationId: "vroo-hq", partnerId: null }
    ],
    defaultRole: "super_admin",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "VROO 본사"
  },
  {
    id: "account-ops-001",
    username: "ops.desk",
    displayName: "운영 담당",
    legalName: null,
    email: "ops.desk@vroo.local",
    accountType: "standard",
    organizationId: "vroo-hq",
    organizationName: "VROO Operations",
    department: "서비스 운영",
    assignedRoles: ["operator"],
    assignedRoleContexts: [
      { roleId: "operator", organizationId: "vroo-hq", partnerId: null }
    ],
    defaultRole: "operator",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "VROO 본사"
  },
  {
    id: "account-sa-ops-001",
    username: "ops.lead",
    displayName: "운영 총괄",
    legalName: null,
    email: "ops.lead@vroo.local",
    accountType: "standard",
    organizationId: "vroo-hq",
    organizationName: "VROO Operations",
    department: "플랫폼 운영",
    assignedRoles: ["super_admin"],
    assignedRoleContexts: [
      { roleId: "super_admin", organizationId: "vroo-hq", partnerId: null }
    ],
    defaultRole: "super_admin",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "VROO 본사 (일반 최고 관리자)"
  },
  {
    id: "account-ptn-adm-001",
    username: "partner.admin",
    displayName: "제휴 관리자",
    legalName: null,
    email: "partner.admin@example.local",
    accountType: "standard",
    organizationId: "org-partner-gas",
    organizationName: "모빌리티 제휴 파트너",
    department: "제휴 본부",
    assignedRoles: ["partner_admin"],
    assignedRoleContexts: [
      {
        roleId: "partner_admin",
        organizationId: "org-partner-gas",
        partnerId: "partner-gas-001",
        organizationName: "모빌리티 제휴 파트너"
      }
    ],
    defaultRole: "partner_admin",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "모빌리티 제휴 파트너"
  },
  {
    id: "account-ptn-stf-001",
    username: "partner.staff",
    displayName: "제휴 운영 직원",
    legalName: null,
    email: "partner.staff@example.local",
    accountType: "standard",
    organizationId: "org-partner-gas",
    organizationName: "모빌리티 제휴 파트너",
    department: "매장 운영",
    assignedRoles: ["partner_staff"],
    assignedRoleContexts: [
      {
        roleId: "partner_staff",
        organizationId: "org-partner-gas",
        partnerId: "partner-gas-001",
        organizationName: "모빌리티 제휴 파트너"
      }
    ],
    defaultRole: "partner_staff",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "모빌리티 제휴 파트너"
  },
  {
    id: "account-cs-001",
    username: "cs.agent",
    displayName: "고객지원 상담",
    legalName: null,
    email: "cs.agent@vroo.local",
    accountType: "standard",
    organizationId: "org-vroo-cs",
    organizationName: "VROO Customer Support",
    department: "고객지원 데스크",
    assignedRoles: ["cs_agent"],
    assignedRoleContexts: [
      { roleId: "cs_agent", organizationId: "org-vroo-cs", partnerId: null }
    ],
    defaultRole: "cs_agent",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "VROO 고객지원"
  },
  {
    id: "account-an-001",
    username: "analyst",
    displayName: "데이터 분석",
    legalName: null,
    email: "analyst@vroo.local",
    accountType: "standard",
    organizationId: "vroo-hq",
    organizationName: "VROO Insights",
    department: "분석팀",
    assignedRoles: ["analyst"],
    assignedRoleContexts: [
      { roleId: "analyst", organizationId: "vroo-hq", partnerId: null }
    ],
    defaultRole: "analyst",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "VROO 데이터팀"
  },
  {
    id: "account-dev-001",
    username: "dev",
    displayName: "플랫폼 엔지니",
    legalName: null,
    email: "dev@vroo.local",
    accountType: "standard",
    organizationId: "vroo-hq",
    organizationName: "VROO Engineering",
    department: "플랫폼 엔지니어링",
    assignedRoles: ["developer"],
    assignedRoleContexts: [
      { roleId: "developer", organizationId: "vroo-hq", partnerId: null }
    ],
    defaultRole: "developer",
    directPermissions: [],
    status: "active",
    lastLoginAt: null,
    devLabel: "VROO 엔지니어링"
  }
];

function cloneAccount(a) {
  return {
    ...a,
    assignedRoles: [...(a.assignedRoles || [])],
    assignedRoleContexts: (a.assignedRoleContexts || []).map((c) => ({ ...c })),
    directPermissions: [...(a.directPermissions || [])]
  };
}

/** Immutable seed snapshot */
export const CONSOLE_ACCOUNT_SEED = Object.freeze(
  SEED_ACCOUNTS.map((a) => Object.freeze(cloneAccount(a)))
);

export function getSeedAccounts() {
  return CONSOLE_ACCOUNT_SEED.map(cloneAccount);
}

export function findSeedAccount(accountId) {
  const a = CONSOLE_ACCOUNT_SEED.find((x) => x.id === accountId);
  return a ? cloneAccount(a) : null;
}

export function findSeedAccountByEmail(email) {
  if (!email) return null;
  const key = String(email).trim().toLowerCase();
  const a = CONSOLE_ACCOUNT_SEED.find((x) => x.email.toLowerCase() === key);
  return a ? cloneAccount(a) : null;
}

export function isRootAuthorityAccount(account) {
  return account?.accountType === "root_authority" && account?.id === ROOT_AUTHORITY_ACCOUNT_ID;
}

export function accountTypeLabel(accountType) {
  if (accountType === "root_authority") return "최종 권한 관리자";
  return "표준 계정";
}

export function getRoleContext(account, roleId) {
  const contexts = account?.assignedRoleContexts || [];
  return contexts.find((c) => c.roleId === roleId) || null;
}

export function validateAssignedRoles(account) {
  const roles = account?.assignedRoles || [];
  if (!roles.length) return { ok: false, reason: "no_roles" };
  for (const r of roles) {
    if (!isValidRoleId(r)) return { ok: false, reason: "invalid_role", roleId: r };
    if (r === "partner_admin" || r === "partner_staff") {
      const ctx = getRoleContext(account, r);
      if (!ctx?.partnerId) return { ok: false, reason: "partner_required", roleId: r };
    }
  }
  if (!roles.includes(account.defaultRole)) {
    return { ok: false, reason: "default_not_assigned" };
  }
  return { ok: true };
}

/** Development account picker list */
export function getDevelopmentAccounts() {
  return getSeedAccounts().map((a) => ({
    id: a.id,
    displayName: a.displayName,
    email: a.email,
    organizationName: a.organizationName,
    devLabel: a.devLabel || a.organizationName,
    defaultRole: a.defaultRole,
    assignedRoles: [...a.assignedRoles],
    accountType: a.accountType
  }));
}

/**
 * @deprecated legacy role→account map — prefer findSeedAccount
 * Kept so older imports do not crash; returns a shim from first matching defaultRole.
 */
export function accountForRole(roleId) {
  const a = CONSOLE_ACCOUNT_SEED.find((x) => x.defaultRole === roleId);
  if (!a) return null;
  return {
    userId: a.id,
    displayName: a.displayName,
    roleId,
    organizationId: a.organizationId,
    organizationName: a.organizationName,
    partnerId: getRoleContext(a, roleId)?.partnerId || null,
    department: a.department,
    email: a.email
  };
}

/**
 * Local account repository + protection rules
 * Development: mutable overlay in localStorage
 * Production (no server): read-only
 */

import { safeJsonParse } from "../../../shared/utils/validation.js";
import { getRole, isValidRoleId } from "../../../shared/config/roles.js";
import {
  APP_ENVIRONMENT,
  ROOT_AUTHORITY_ACCOUNT_ID,
  ROOT_AUTHORITY_PERMISSIONS,
  getSeedAccounts,
  findSeedAccount,
  isRootAuthorityAccount,
  getRoleContext,
  validateAssignedRoles,
  accountTypeLabel
} from "../../../shared/data/demo-accounts.js";
import { ROOT_SCOPED_PERMISSIONS } from "../../../shared/config/permissions.js";
import { isRootScopedPermission } from "../../../shared/utils/permission.js";

const KEYS = {
  accounts: "vroo.console.accounts",
  audit: "vroo.console.auditLocal"
};

function storageGet(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function nowIso() {
  return new Date().toISOString();
}

function clone(a) {
  return {
    ...a,
    assignedRoles: [...(a.assignedRoles || [])],
    assignedRoleContexts: (a.assignedRoleContexts || []).map((c) => ({ ...c })),
    directPermissions: [...(a.directPermissions || [])]
  };
}

export function isWritableEnvironment() {
  return APP_ENVIRONMENT === "development";
}

function loadOverlay() {
  return safeJsonParse(storageGet(KEYS.accounts), null);
}

function saveOverlay(list) {
  storageSet(KEYS.accounts, JSON.stringify(list));
}

/** Merged account list (overlay over seed) */
export function listAccounts() {
  const seed = getSeedAccounts();
  const overlay = loadOverlay();
  if (!Array.isArray(overlay) || !overlay.length) return seed;
  const byId = new Map(seed.map((a) => [a.id, a]));
  overlay.forEach((o) => {
    if (o?.id) byId.set(o.id, clone(o));
  });
  return [...byId.values()];
}

export function getAccount(accountId) {
  if (!accountId) return null;
  return listAccounts().find((a) => a.id === accountId) || null;
}

export function getAccountByEmail(email) {
  if (!email) return null;
  const key = String(email).trim().toLowerCase();
  return listAccounts().find((a) => a.email.toLowerCase() === key) || null;
}

function persistAccount(account) {
  if (!isWritableEnvironment()) {
    return { ok: false, reason: "readonly", message: "서버 미연결 환경에서는 계정 변경을 저장할 수 없습니다." };
  }
  const list = listAccounts();
  const idx = list.findIndex((a) => a.id === account.id);
  if (idx >= 0) list[idx] = clone(account);
  else list.push(clone(account));
  saveOverlay(list);
  return { ok: true, account: clone(account) };
}

export function countRootAuthorityAccounts(accounts = listAccounts()) {
  return accounts.filter(
    (a) => a.accountType === "root_authority" && a.status === "active"
  ).length;
}

export function appendLocalAudit(entry) {
  const logs = safeJsonParse(storageGet(KEYS.audit), []) || [];
  const row = {
    id: `aud-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: nowIso(),
    source: "console_local",
    result: "success",
    ...entry
  };
  logs.unshift(row);
  storageSet(KEYS.audit, JSON.stringify(logs.slice(0, 200)));
  return row;
}

export function listLocalAudit(limit = 50) {
  const logs = safeJsonParse(storageGet(KEYS.audit), []) || [];
  return logs.slice(0, limit);
}

export function clearLocalAccountOverlay() {
  storageRemove(KEYS.accounts);
}

/** Effective permissions for account + active role */
export function computeEffectivePermissions(account, roleId) {
  const role = getRole(roleId);
  if (!role) return [];
  const set = new Set();
  (role.permissions || []).forEach((p) => {
    if (p === "*") set.add("*");
    else if (!isRootScopedPermission(p)) set.add(p);
  });
  (account.directPermissions || []).forEach((p) => set.add(p));
  if (account.accountType === "root_authority" && account.status === "active") {
    ROOT_AUTHORITY_PERMISSIONS.forEach((p) => set.add(p));
  }
  return [...set];
}

export function buildSessionFromAccount(account, activeRole, meta = {}) {
  const v = validateAssignedRoles(account);
  if (!v.ok) return null;
  if (account.status !== "active") return null;
  if (!isValidRoleId(activeRole)) return null;
  if (!(account.assignedRoles || []).includes(activeRole)) return null;

  const role = getRole(activeRole);
  if (!role || !role.defaultRoute) return null;

  const ctx = getRoleContext(account, activeRole) || {
    roleId: activeRole,
    organizationId: account.organizationId,
    partnerId: null,
    organizationName: account.organizationName
  };

  if ((activeRole === "partner_admin" || activeRole === "partner_staff") && !ctx.partnerId) {
    return null;
  }

  const organizationId = ctx.organizationId || account.organizationId;
  const organizationName = ctx.organizationName || account.organizationName;
  const partnerId = ctx.partnerId || null;
  const permissions = computeEffectivePermissions(account, activeRole);

  return {
    accountId: account.id,
    userId: account.id,
    username: account.username,
    displayName: account.displayName,
    legalName: account.legalName || null,
    email: account.email,
    accountType: account.accountType,
    accountTypeLabel: accountTypeLabel(account.accountType),
    status: account.status,
    department: account.department,
    assignedRoles: [...account.assignedRoles],
    assignedRoleContexts: (account.assignedRoleContexts || []).map((c) => ({ ...c })),
    directPermissions: [...(account.directPermissions || [])],
    defaultRole: account.defaultRole,
    activeRole,
    roleId: activeRole,
    label: role.label,
    roleDescription: role.description,
    organizationId,
    organizationName,
    partnerId,
    activeOrganizationId: organizationId,
    activePartnerId: partnerId,
    permissions,
    defaultRoute: role.defaultRoute,
    consoleSections: [...role.consoleSections],
    lastLoginAt: meta.lastLoginAt || account.lastLoginAt || Date.now(),
    issuedAt: meta.issuedAt || nowIso(),
    lastValidatedAt: nowIso(),
    environment: APP_ENVIRONMENT,
    source: "local_seed",
    isRootAuthority: isRootAuthorityAccount(account)
  };
}

/**
 * Validate role switch request
 * @returns {{ ok: boolean, message?: string, session?: object }}
 */
export function validateRoleSwitch(session, nextRoleId) {
  if (!session?.accountId) {
    return { ok: false, message: "세션이 유효하지 않습니다." };
  }
  const account = getAccount(session.accountId);
  if (!account) {
    return { ok: false, message: "계정을 찾을 수 없습니다." };
  }
  if (account.status !== "active") {
    return { ok: false, message: "비활성 계정입니다." };
  }
  if (!isValidRoleId(nextRoleId)) {
    return { ok: false, message: "존재하지 않는 역할입니다." };
  }
  if (!(account.assignedRoles || []).includes(nextRoleId)) {
    return { ok: false, message: "이 계정에는 해당 역할이 부여되어 있지 않습니다." };
  }
  const ctx = getRoleContext(account, nextRoleId);
  if ((nextRoleId === "partner_admin" || nextRoleId === "partner_staff") && !ctx?.partnerId) {
    return { ok: false, message: "제휴사 역할에는 partnerId가 필요합니다." };
  }
  const role = getRole(nextRoleId);
  if (!role?.defaultRoute) {
    return { ok: false, message: "역할의 기본 경로가 유효하지 않습니다." };
  }
  const next = buildSessionFromAccount(account, nextRoleId, {
    lastLoginAt: session.lastLoginAt,
    issuedAt: session.issuedAt
  });
  if (!next) {
    return { ok: false, message: "역할 전환을 완료할 수 없습니다." };
  }
  return { ok: true, session: next, previousRole: session.activeRole || session.roleId };
}

/** Protection: self / last root */
export function canRevokeRole(actorSession, targetAccountId, roleId) {
  if (!actorSession || !hasRootManage(actorSession)) {
    return { ok: false, message: "최종 권한 관리자만 역할을 회수할 수 있습니다." };
  }
  const target = getAccount(targetAccountId);
  if (!target) return { ok: false, message: "대상을 찾을 수 없습니다." };

  if (target.id === actorSession.accountId && roleId === "super_admin") {
    return { ok: false, message: "자기 계정의 최고 관리자 역할은 제거할 수 없습니다." };
  }
  if (target.accountType === "root_authority" && target.id === actorSession.accountId) {
    return { ok: false, message: "자기 계정의 최종 권한 관리자 권한은 제거할 수 없습니다." };
  }
  return { ok: true };
}

export function canDeactivateAccount(actorSession, targetAccountId) {
  if (!hasRootManage(actorSession)) {
    return { ok: false, message: "최종 권한 관리자만 계정을 비활성화할 수 있습니다." };
  }
  if (targetAccountId === actorSession.accountId) {
    return { ok: false, message: "자기 계정은 비활성화할 수 없습니다." };
  }
  const target = getAccount(targetAccountId);
  if (!target) return { ok: false, message: "대상을 찾을 수 없습니다." };
  if (target.accountType === "root_authority" && countRootAuthorityAccounts() <= 1) {
    return {
      ok: false,
      message: "최소 1개의 최종 권한 관리자 계정은 유지되어야 합니다."
    };
  }
  return { ok: true };
}

export function hasRootManage(session) {
  return session?.permissions?.includes("root_authority.manage")
    || (session?.accountType === "root_authority" && session?.status === "active");
}

export function assignRoleLocal(actorSession, targetAccountId, roleId, reason) {
  if (!isWritableEnvironment()) {
    return { ok: false, message: "서버 미연결 — 역할 부여가 저장되지 않습니다." };
  }
  if (!hasRootManage(actorSession)) {
    return { ok: false, message: "권한이 없습니다." };
  }
  if (!reason?.trim()) {
    return { ok: false, message: "사유를 입력하세요." };
  }
  if (!isValidRoleId(roleId)) {
    return { ok: false, message: "유효하지 않은 역할입니다." };
  }
  const target = getAccount(targetAccountId);
  if (!target) return { ok: false, message: "계정을 찾을 수 없습니다." };
  if ((roleId === "partner_admin" || roleId === "partner_staff") && !getRoleContext(target, roleId)?.partnerId) {
    /* require context — for seed partners use org partner if assigning */
    if (!target.organizationId?.includes("partner") && !target.assignedRoleContexts?.some((c) => c.partnerId)) {
      return { ok: false, message: "제휴사 역할에는 partnerId 컨텍스트가 필요합니다." };
    }
  }
  if (!target.assignedRoles.includes(roleId)) {
    target.assignedRoles.push(roleId);
    if (!getRoleContext(target, roleId)) {
      target.assignedRoleContexts.push({
        roleId,
        organizationId: target.organizationId,
        partnerId: target.assignedRoleContexts.find((c) => c.partnerId)?.partnerId || null,
        organizationName: target.organizationName
      });
    }
  }
  const saved = persistAccount(target);
  if (!saved.ok) return saved;
  appendLocalAudit({
    action: "account.role_assigned",
    actorAccountId: actorSession.accountId,
    actorDisplayName: actorSession.displayName,
    targetAccountId,
    nextRole: roleId,
    organizationId: target.organizationId,
    reason: reason.trim(),
    result: "success"
  });
  return { ok: true, account: saved.account, message: "로컬 상태에 역할을 부여했습니다. (서버 미연동)" };
}

export function revokeRoleLocal(actorSession, targetAccountId, roleId, reason) {
  if (!isWritableEnvironment()) {
    return { ok: false, message: "서버 미연결 — 역할 회수가 저장되지 않습니다." };
  }
  const gate = canRevokeRole(actorSession, targetAccountId, roleId);
  if (!gate.ok) return gate;
  if (!reason?.trim()) return { ok: false, message: "사유를 입력하세요." };

  const target = getAccount(targetAccountId);
  if (target.accountType === "root_authority" && roleId === "super_admin") {
    return { ok: false, message: "최종 권한 관리자 계정의 최고 관리자 역할은 제거할 수 없습니다." };
  }
  if (target.assignedRoles.length <= 1) {
    return { ok: false, message: "계정에는 최소 1개의 역할이 필요합니다." };
  }
  target.assignedRoles = target.assignedRoles.filter((r) => r !== roleId);
  target.assignedRoleContexts = (target.assignedRoleContexts || []).filter((c) => c.roleId !== roleId);
  if (target.defaultRole === roleId) {
    target.defaultRole = target.assignedRoles[0];
  }
  const saved = persistAccount(target);
  if (!saved.ok) return saved;
  appendLocalAudit({
    action: "account.role_revoked",
    actorAccountId: actorSession.accountId,
    actorDisplayName: actorSession.displayName,
    targetAccountId,
    previousRole: roleId,
    organizationId: target.organizationId,
    reason: reason.trim(),
    result: "success"
  });
  return { ok: true, account: saved.account, message: "로컬 상태에서 역할을 회수했습니다. (서버 미연동)" };
}

export function deactivateAccountLocal(actorSession, targetAccountId, reason) {
  if (!isWritableEnvironment()) {
    return { ok: false, message: "서버 미연결 — 계정 상태 변경이 저장되지 않습니다." };
  }
  const gate = canDeactivateAccount(actorSession, targetAccountId);
  if (!gate.ok) return gate;
  if (!reason?.trim()) return { ok: false, message: "사유를 입력하세요." };
  const target = getAccount(targetAccountId);
  target.status = "inactive";
  const saved = persistAccount(target);
  if (!saved.ok) return saved;
  appendLocalAudit({
    action: "account.status_changed",
    actorAccountId: actorSession.accountId,
    actorDisplayName: actorSession.displayName,
    targetAccountId,
    organizationId: target.organizationId,
    reason: reason.trim(),
    result: "success"
  });
  return { ok: true, account: saved.account, message: "로컬 상태에서 계정을 비활성화했습니다. (서버 미연동)" };
}

export function resetAccountsToSeed() {
  clearLocalAccountOverlay();
  storageRemove(KEYS.audit);
}

export { findSeedAccount, ROOT_AUTHORITY_ACCOUNT_ID, ROOT_SCOPED_PERMISSIONS, accountTypeLabel };

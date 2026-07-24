/**
 * Console session — Account → Assigned Roles → Active Role
 * localStorage payload is revalidated against account repository on every load.
 */

import { safeJsonParse } from "../../../shared/utils/validation.js";
import { isValidRoleId, getRole } from "../../../shared/config/roles.js";
import { APP_ENVIRONMENT } from "../../../shared/data/demo-accounts.js";
import {
  getAccount,
  buildSessionFromAccount,
  validateRoleSwitch,
  appendLocalAudit
} from "./account-store.js";

const KEYS = {
  session: "vroo.console.session",
  role: "vroo.console.role",
  route: "vroo.console.route",
  navCollapse: "vroo.console.navCollapse"
};

function writePayload(payload) {
  localStorage.setItem(KEYS.session, JSON.stringify(payload));
  if (payload.activeRole) {
    localStorage.setItem(KEYS.role, payload.activeRole);
  }
}

function readPayload() {
  return safeJsonParse(localStorage.getItem(KEYS.session), null);
}

/**
 * Rehydrate + validate. Never trust localStorage alone.
 */
export function loadSession() {
  try {
    const raw = readPayload();
    if (!raw) {
      clearSession();
      return null;
    }

    /* Migrate / reject legacy { roleId } without accountId */
    const accountId = raw.accountId;
    if (!accountId) {
      clearSession();
      return null;
    }

    const account = getAccount(accountId);
    if (!account || account.status !== "active") {
      clearSession();
      return null;
    }

    let activeRole = raw.activeRole || raw.roleId || account.defaultRole;
    if (!isValidRoleId(activeRole) || !(account.assignedRoles || []).includes(activeRole)) {
      activeRole = account.defaultRole;
      if (!isValidRoleId(activeRole) || !(account.assignedRoles || []).includes(activeRole)) {
        clearSession();
        return null;
      }
    }

    const session = buildSessionFromAccount(account, activeRole, {
      lastLoginAt: raw.issuedAt ? Date.parse(raw.issuedAt) || Date.now() : Date.now(),
      issuedAt: raw.issuedAt || new Date().toISOString()
    });
    if (!session) {
      clearSession();
      return null;
    }

    /* Persist corrected payload if role was repaired */
    writePayload({
      accountId: session.accountId,
      activeRole: session.activeRole,
      activeOrganizationId: session.activeOrganizationId,
      activePartnerId: session.activePartnerId,
      issuedAt: session.issuedAt,
      lastValidatedAt: session.lastValidatedAt
    });

    return session;
  } catch {
    clearSession();
    return null;
  }
}

/** Login with account id (Development access / local) */
export function saveSessionForAccount(accountId, preferredRole = null) {
  const account = getAccount(accountId);
  if (!account) throw new Error("계정을 찾을 수 없습니다.");
  if (account.status !== "active") throw new Error("비활성 계정입니다.");

  let role = preferredRole || account.defaultRole;
  if (!(account.assignedRoles || []).includes(role)) {
    role = account.defaultRole;
  }
  const session = buildSessionFromAccount(account, role, {
    lastLoginAt: Date.now(),
    issuedAt: new Date().toISOString()
  });
  if (!session) throw new Error("세션을 만들 수 없습니다.");

  writePayload({
    accountId: session.accountId,
    activeRole: session.activeRole,
    activeOrganizationId: session.activeOrganizationId,
    activePartnerId: session.activePartnerId,
    issuedAt: session.issuedAt,
    lastValidatedAt: session.lastValidatedAt
  });

  /* Touch last login on overlay if writable — skip if seed-only */
  return loadSession();
}

/**
 * @deprecated Use saveSessionForAccount — role-only login is blocked
 */
export function saveSession(roleOrAccount) {
  /* If looks like account id */
  if (typeof roleOrAccount === "string" && roleOrAccount.startsWith("account-")) {
    return saveSessionForAccount(roleOrAccount);
  }
  throw new Error("역할만으로 로그인할 수 없습니다. 테스트 계정을 선택하세요.");
}

export function switchActiveRole(currentSession, nextRoleId) {
  const check = validateRoleSwitch(currentSession, nextRoleId);
  if (!check.ok) {
    return { ok: false, message: check.message };
  }
  const next = check.session;
  writePayload({
    accountId: next.accountId,
    activeRole: next.activeRole,
    activeOrganizationId: next.activeOrganizationId,
    activePartnerId: next.activePartnerId,
    issuedAt: currentSession.issuedAt || next.issuedAt,
    lastValidatedAt: next.lastValidatedAt
  });
  appendLocalAudit({
    action: "session.role_switched",
    actorAccountId: next.accountId,
    actorDisplayName: next.displayName,
    targetAccountId: next.accountId,
    previousRole: check.previousRole,
    nextRole: next.activeRole,
    organizationId: next.organizationId,
    reason: null,
    result: "success"
  });
  return { ok: true, session: loadSession() };
}

export function clearSession() {
  localStorage.removeItem(KEYS.session);
  localStorage.removeItem(KEYS.role);
}

export function loadSavedRoute(fallback = "dashboard") {
  try {
    const r = localStorage.getItem(KEYS.route);
    return r && typeof r === "string" ? r : fallback;
  } catch {
    return fallback;
  }
}

export function saveRoute(route) {
  try {
    localStorage.setItem(KEYS.route, route);
  } catch {
    /* ignore */
  }
}

export function logout() {
  clearSession();
  try {
    localStorage.removeItem(KEYS.route);
  } catch {
    /* ignore */
  }
}

export function loadNavCollapse() {
  return safeJsonParse(localStorage.getItem(KEYS.navCollapse), {}) || {};
}

export function saveNavCollapse(map) {
  try {
    localStorage.setItem(KEYS.navCollapse, JSON.stringify(map || {}));
  } catch {
    /* ignore */
  }
}

export function getAssignedRoleOptions(session) {
  const roles = session?.assignedRoles || [];
  return roles
    .filter((id) => isValidRoleId(id))
    .map((id) => {
      const r = getRole(id);
      return {
        id,
        label: r.label,
        description: r.description,
        active: id === (session.activeRole || session.roleId),
        organizationName: session.organizationName
      };
    });
}

export { APP_ENVIRONMENT, KEYS as SESSION_KEYS };

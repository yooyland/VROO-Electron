import { safeJsonParse } from "../../../shared/utils/validation.js";
import { getRole, isValidRoleId } from "../../../shared/config/roles.js";
import { accountForRole, APP_ENVIRONMENT } from "../../../shared/data/demo-accounts.js";

const KEYS = {
  session: "vroo.console.session",
  role: "vroo.console.role",
  route: "vroo.console.route",
  navCollapse: "vroo.console.navCollapse"
};

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEYS.session);
    const session = safeJsonParse(raw, null);
    if (!session || !isValidRoleId(session.roleId)) {
      clearSession();
      return null;
    }
    return hydrateSession(session.roleId, session);
  } catch {
    clearSession();
    return null;
  }
}

function hydrateSession(roleId, raw = {}) {
  const role = getRole(roleId);
  const account = accountForRole(roleId);
  if (!role || !account) return null;
  return {
    userId: account.userId,
    displayName: account.displayName,
    roleId: role.id,
    label: role.label,
    organizationId: account.organizationId,
    organizationName: account.organizationName,
    partnerId: account.partnerId || role.demoPartnerId,
    department: account.department,
    email: account.email,
    permissions: [...role.permissions],
    defaultRoute: role.defaultRoute,
    consoleSections: [...role.consoleSections],
    lastLoginAt: raw.loggedInAt || Date.now(),
    environment: APP_ENVIRONMENT,
    source: "local_seed"
  };
}

export function saveSession(roleId) {
  const role = getRole(roleId);
  if (!role) throw new Error("유효하지 않은 접근 역할입니다.");
  const payload = { roleId: role.id, loggedInAt: Date.now() };
  localStorage.setItem(KEYS.session, JSON.stringify(payload));
  localStorage.setItem(KEYS.role, role.id);
  return loadSession();
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

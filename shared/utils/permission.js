/** Permission helpers — 메뉴 숨김 + route 가드 공용 */

import { ROOT_SCOPED_PERMISSIONS } from "../config/permissions.js";

const ROOT_SET = new Set(ROOT_SCOPED_PERMISSIONS);

export function isRootScopedPermission(permission) {
  return ROOT_SET.has(permission);
}

export function hasPermission(sessionOrPerms, permission) {
  const perms = Array.isArray(sessionOrPerms)
    ? sessionOrPerms
    : sessionOrPerms?.permissions || [];
  if (!permission) return false;
  if (perms.includes(permission)) return true;
  if (perms.includes("*")) {
    /* super_admin * does not grant root authority permissions */
    if (isRootScopedPermission(permission)) return false;
    return true;
  }
  return false;
}

export function hasAnyPermission(session, permissions = []) {
  return permissions.some((p) => hasPermission(session, p));
}

export function assertPermission(session, permission) {
  if (!hasPermission(session, permission)) {
    const err = new Error(`권한이 없습니다: ${permission}`);
    err.code = "FORBIDDEN";
    throw err;
  }
  return true;
}

export function filterNavByPermissions(navItems, session) {
  return (navItems || []).filter((item) => hasPermission(session, item.permission));
}

export function expandRolePermissions(rolePerms = []) {
  return [...rolePerms];
}

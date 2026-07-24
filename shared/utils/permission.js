/** Permission helpers — 메뉴 숨김 + route 가드 공용 */

export function hasPermission(sessionOrPerms, permission) {
  const perms = Array.isArray(sessionOrPerms)
    ? sessionOrPerms
    : sessionOrPerms?.permissions || [];
  if (!permission) return false;
  if (perms.includes("*")) return true;
  return perms.includes(permission);
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

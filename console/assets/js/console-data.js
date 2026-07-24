/** Partner-scoped filtering for demo isolation (UI only, not server security) */

export function scopeByPartner(list, session, partnerKey = "partnerId") {
  if (!session?.partnerId) return list || [];
  return (list || []).filter((item) => {
    const pid = item[partnerKey];
    if (pid == null) return false;
    return pid === session.partnerId;
  });
}

export function scopePartners(list, session) {
  if (!session?.partnerId) return list || [];
  return (list || []).filter((p) => p.id === session.partnerId);
}

export function canMutate(session, managePermission, hasPermissionFn) {
  return hasPermissionFn(session, managePermission);
}

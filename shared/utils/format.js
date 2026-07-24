export function formatNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("ko-KR");
}

export function formatDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("ko-KR");
  } catch {
    return "—";
  }
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function statusLabel(status) {
  const map = {
    active: "활성",
    inactive: "비활성",
    pending: "대기",
    approved: "승인",
    rejected: "거절",
    suspended: "정지",
    resolved: "해결",
    open: "열림",
    closed: "종료",
    prototype: "프로토타입",
    planned: "준비 중",
    draft: "초안",
    reported: "접수"
  };
  return map[status] || status || "—";
}

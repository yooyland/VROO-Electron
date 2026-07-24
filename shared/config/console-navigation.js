/**
 * Console navigation — icon keys (no emoji). planned items hidden from sidebar.
 */

export const CONSOLE_NAV_GROUPS = Object.freeze([
  { id: "overview", label: "개요", labelEn: "Overview" },
  { id: "operations", label: "운영 관리", labelEn: "Operations" },
  { id: "commerce", label: "커머스", labelEn: "Commerce" },
  { id: "partners", label: "제휴사", labelEn: "Partners" },
  { id: "support", label: "고객지원", labelEn: "Support" },
  { id: "analytics", label: "분석", labelEn: "Insights" },
  { id: "system", label: "시스템", labelEn: "System" }
]);

export const CONSOLE_NAV_ITEMS = Object.freeze([
  { id: "dashboard", group: "overview", label: "Dashboard", icon: "dashboard", route: "dashboard", permission: "dashboard.view", status: "ready" },

  { id: "users", group: "operations", label: "회원 관리", icon: "users", route: "users", permission: "users.view", status: "ready" },
  { id: "vehicles", group: "operations", label: "차량 관리", icon: "vehicle", route: "vehicles", permission: "vehicles.view", status: "ready" },
  { id: "grids", group: "operations", label: "GRID 관리", icon: "grid", route: "grids", permission: "grids.view", status: "ready" },
  { id: "moderation", group: "operations", label: "커뮤니티·신고", icon: "flag", route: "moderation", permission: "reports.view", status: "ready" },
  { id: "notifications", group: "operations", label: "공지·알림", icon: "bell", route: "notifications", permission: "notifications.view", status: "ready" },

  { id: "products", group: "commerce", label: "상품 관리", icon: "box", route: "products", permission: "products.view", status: "ready" },
  { id: "benefits", group: "commerce", label: "혜택·쿠폰", icon: "ticket", route: "benefits", permission: "benefits.view", status: "ready" },
  { id: "memberships", group: "commerce", label: "멤버십", icon: "ticket", route: "memberships", permission: "benefits.view", status: "planned" },
  { id: "orders", group: "commerce", label: "주문·이용 내역", icon: "list", route: "orders", permission: "products.view", status: "planned" },
  { id: "settlements", group: "commerce", label: "정산 관리", icon: "settle", route: "settlements", permission: "settlements.view", status: "ready" },

  { id: "partners", group: "partners", label: "제휴사", icon: "partners", route: "partners", permission: "partners.view", status: "ready" },

  { id: "support", group: "support", label: "고객 문의", icon: "support", route: "support", permission: "support.view", status: "ready" },
  { id: "incidents", group: "support", label: "사고 접수", icon: "alert", route: "incidents", permission: "incidents.view", status: "ready" },

  { id: "analytics", group: "analytics", label: "통계", icon: "chart", route: "analytics", permission: "analytics.view", status: "ready" },

  { id: "system", group: "system", label: "시스템 상태", icon: "system", route: "system", permission: "system.view", status: "ready" },
  { id: "accounts", group: "system", label: "계정·역할 관리", icon: "users", route: "accounts", permission: "accounts.view", status: "ready" },
  { id: "permissions", group: "system", label: "권한 정보", icon: "key", route: "permissions", permission: "system.view", status: "ready" }
]);

export function getNavItemByRoute(route) {
  return CONSOLE_NAV_ITEMS.find((i) => i.route === route) || null;
}

/** Sidebar에 표시할 항목 — planned 숨김 */
export function getVisibleNavItems() {
  return CONSOLE_NAV_ITEMS.filter((i) => i.status !== "planned");
}

import { getNavItemByRoute } from "../../../shared/config/console-navigation.js";
import { hasPermission } from "../../../shared/utils/permission.js";
import { saveRoute } from "./console-auth.js";
import { toast } from "./console-ui.js";
import { renderDashboard } from "./console-dashboard.js";
import { renderUsers } from "./modules/users.js";
import { renderVehicles } from "./modules/vehicles.js";
import { renderGrids } from "./modules/grids.js";
import { renderModeration } from "./modules/moderation.js";
import { renderProducts } from "./modules/products.js";
import { renderBenefits, renderMemberships, renderOrders } from "./modules/benefits.js";
import { renderPartners } from "./modules/partners.js";
import { renderSettlements } from "./modules/settlements.js";
import { renderSupport } from "./modules/support.js";
import { renderIncidents } from "./modules/incidents.js";
import { renderAnalytics } from "./modules/analytics.js";
import { renderSystem, renderPermissionsTool, renderNotifications } from "./modules/system.js";
import { renderAccounts } from "./modules/accounts.js";

const ROUTES = {
  dashboard: renderDashboard,
  users: renderUsers,
  vehicles: renderVehicles,
  grids: renderGrids,
  moderation: renderModeration,
  notifications: renderNotifications,
  products: renderProducts,
  benefits: renderBenefits,
  memberships: renderMemberships,
  orders: renderOrders,
  settlements: renderSettlements,
  partners: renderPartners,
  support: renderSupport,
  incidents: renderIncidents,
  analytics: renderAnalytics,
  system: renderSystem,
  accounts: renderAccounts,
  permissions: renderPermissionsTool
};

export function resolveRoute(route, session) {
  const item = getNavItemByRoute(route);
  if (!item || !ROUTES[route]) {
    return { ok: false, reason: "not_found", fallback: session.defaultRoute || "dashboard" };
  }
  if (!hasPermission(session, item.permission)) {
    return { ok: false, reason: "forbidden", fallback: session.defaultRoute || "dashboard" };
  }
  return { ok: true, item };
}

export function navigate(route, ctx) {
  const root = document.querySelector("#consoleMain");
  if (!root || !ctx?.session) return;

  const check = resolveRoute(route, ctx.session);
  if (!check.ok) {
    const msg = check.reason === "forbidden"
      ? "권한이 없어 접근이 차단되었습니다."
      : "존재하지 않는 화면입니다.";
    toast(msg, "error");
    const fb = check.fallback;
    if (fb && fb !== route) {
      ctx.route = fb;
      saveRoute(fb);
      updateNavCurrent(fb);
      ROUTES[fb]?.(root, {
        ...ctx,
        route: fb,
        goto: (next) => navigate(next, ctx)
      });
    }
    return;
  }

  ctx.route = route;
  saveRoute(route);
  updateNavCurrent(route);
  try {
    ROUTES[route](root, {
      ...ctx,
      goto: (next) => navigate(next, ctx)
    });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="empty-state"><b>화면을 표시하지 못했습니다.</b><p class="muted">${e.message || e}</p></div>`;
  }
}

function updateNavCurrent(route) {
  document.querySelectorAll(".console-nav-link").forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

export function listKnownRoutes() {
  return Object.keys(ROUTES);
}

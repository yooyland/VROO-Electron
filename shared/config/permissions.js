/**
 * VROO Console permission catalog
 * UI 숨김 + route 진입 시 모두 검사한다.
 */

export const PERMISSIONS = Object.freeze([
  "dashboard.view",
  "users.view",
  "users.manage",
  "users.suspend",
  "vehicles.view",
  "vehicles.manage",
  "grids.view",
  "grids.manage",
  "community.view",
  "community.moderate",
  "reports.view",
  "reports.process",
  "products.view",
  "products.manage",
  "benefits.view",
  "benefits.manage",
  "partners.view",
  "partners.manage",
  "settlements.view",
  "settlements.manage",
  "support.view",
  "support.respond",
  "incidents.view",
  "incidents.manage",
  "notifications.view",
  "notifications.send",
  "analytics.view",
  "analytics.export",
  "system.view",
  "system.manage",
  "logs.view",
  "developers.manage"
]);

/** 역할별 기본 권한 (super_admin은 * ) */
export const ROLE_PERMISSION_MAP = Object.freeze({
  super_admin: ["*"],
  operator: [
    "dashboard.view",
    "users.view", "users.manage", "users.suspend",
    "vehicles.view", "vehicles.manage",
    "grids.view", "grids.manage",
    "community.view", "community.moderate",
    "reports.view", "reports.process",
    "products.view", "products.manage",
    "benefits.view", "benefits.manage",
    "partners.view",
    "notifications.view", "notifications.send",
    "support.view",
    "incidents.view",
    "analytics.view"
  ],
  partner_admin: [
    "dashboard.view",
    "products.view", "products.manage",
    "benefits.view", "benefits.manage",
    "partners.view", "partners.manage",
    "settlements.view", "settlements.manage",
    "analytics.view"
  ],
  partner_staff: [
    "dashboard.view",
    "products.view", "products.manage",
    "benefits.view", "benefits.manage",
    "partners.view",
    "settlements.view",
    "analytics.view"
  ],
  cs_agent: [
    "dashboard.view",
    "users.view",
    "support.view", "support.respond",
    "reports.view", "reports.process",
    "incidents.view", "incidents.manage"
  ],
  analyst: [
    "dashboard.view",
    "analytics.view", "analytics.export"
  ],
  developer: [
    "dashboard.view",
    "system.view", "system.manage",
    "logs.view",
    "developers.manage",
    "analytics.view"
  ]
});

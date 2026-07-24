/** Platform module registry — User App vs Console 경계 */
export const PLATFORM_MODULES = Object.freeze({
  userApp: {
    id: "user_app",
    label: "User App",
    entry: "app/index.html",
    workspaces: ["spatial", "content"],
    npmScript: "start"
  },
  console: {
    id: "vroo_console",
    label: "VROO Console",
    entry: "console/index.html",
    npmScript: "console",
    note: "역할 기반 통합 운영 콘솔 (데모 인증)"
  },
  shared: {
    id: "shared",
    label: "Shared",
    path: "shared/",
    note: "roles · permissions · demo data · utils — 서버 API 도입 전 로컬 데모"
  }
});

export const PLATFORM_MODE = "demo";
export const APP_VERSION = "1.1.0-beta.1";

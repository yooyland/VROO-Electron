/**
 * MY 진입점 — MY GARAGE AppShell로 위임
 * 기존 openMyPage / renderMyPage import 경로 유지
 */
export { renderMyPage } from "./my/my-shell.js";
import { emit } from "../core/events.js";

/** @deprecated 호환 — Content Workspace의 renderMyPage 사용 */
export function openMyPage(state) {
  emit("mypage:open", state);
}

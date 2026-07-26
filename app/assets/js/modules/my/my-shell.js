/**
 * MY GARAGE AppShell — Hero 경험 + Room 하단 탭
 */
import { emit } from "../../core/events.js";
import { MY_VIEWS, GARAGE_ROOMS, ensureMyGarage, escapeHtml } from "./my-data.js";
import { renderGarageView, renderGarageHeaderMeta } from "./garage.js";
import { disposeGarageStage } from "./garage-stage.js";
import { renderCollectionView } from "./collection.js";
import { renderUpgradeView } from "./upgrade.js";
import { renderCustomView } from "./custom.js";
import { renderAccessoryView } from "./accessory.js";
import { renderInventoryView } from "./inventory.js";
import { renderMissionsView } from "./missions.js";
import { renderRecordsView } from "./records.js";
import { renderAchievementsView } from "./achievements.js";
import { renderProfileView } from "./profile-form.js";
import { renderFriendsView } from "./friends.js";

function menuIcon(id) {
  const common =
    'class="my-nav-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"';
  const paths = {
    garage:
      '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5z"/><path d="M9 21v-7h6v7"/>',
    collection:
      '<rect x="4" y="5" width="7" height="7" rx="1"/><rect x="13" y="5" width="7" height="7" rx="1"/><rect x="4" y="14" width="7" height="5" rx="1"/><rect x="13" y="14" width="7" height="5" rx="1"/>',
    upgrade: '<path d="M12 4v12"/><path d="m7 11 5-5 5 5"/><path d="M5 20h14"/>',
    custom:
      '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/>',
    accessory: '<path d="M12 3 4 7v5c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V7l-8-4z"/>',
    inventory:
      '<path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    missions: '<path d="M8 4h8v3H8z"/><path d="M6 7h12v13H6z"/><path d="m9 12 2 2 4-4"/>',
    records: '<path d="M4 19V5h4l2 3h4l2-3h4v14z"/>',
    achievements:
      '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4"/><path d="M12 13v3M9 20h6"/>',
    profile: '<circle cx="12" cy="9" r="3.2"/><path d="M5 19c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8"/>',
    friends:
      '<circle cx="9" cy="9" r="2.5"/><circle cx="16" cy="10" r="2"/><path d="M3.5 18c1.2-2.4 3.2-3.6 5.5-3.6M12.5 18c.8-1.8 2.2-2.8 4-2.8 1.4 0 2.6.6 3.5 1.6"/>'
  };
  return `<svg ${common}>${paths[id] || paths.garage}</svg>`;
}

function renderActiveView(main, state, refreshShell) {
  const g = ensureMyGarage(state);
  const view = g.activeMyView || "garage";
  const refresh = () => refreshShell();
  if (view !== "garage") disposeGarageStage();
  main.innerHTML = "";
  main.classList.toggle("is-garage-home", view === "garage");
  if (view === "garage") return renderGarageView(main, state, refresh);
  if (view === "collection") return renderCollectionView(main, state, refresh);
  if (view === "upgrade") return renderUpgradeView(main, state, refresh);
  if (view === "custom") return renderCustomView(main, state, refresh);
  if (view === "accessory") return renderAccessoryView(main, state, refresh);
  if (view === "inventory") return renderInventoryView(main, state, refresh);
  if (view === "missions") return renderMissionsView(main, state);
  if (view === "records") return renderRecordsView(main, state);
  if (view === "achievements") return renderAchievementsView(main, state, refresh);
  if (view === "profile") return renderProfileView(main, state, refresh);
  if (view === "friends") return renderFriendsView(main, state);
  main.innerHTML = `<div class="card muted">알 수 없는 화면입니다.</div>`;
}

function roomActiveId(view) {
  if (GARAGE_ROOMS.some((r) => r.id === view)) return view;
  return null;
}

/** Content Workspace용 MY GARAGE */
export function renderMyPage(panel, state) {
  if (!panel) return;
  ensureMyGarage(state);
  panel.classList.add("has-my-garage");

  const paint = () => {
    const g = ensureMyGarage(state);
    const view = g.activeMyView || "garage";
    const roomId = roomActiveId(view);
    const theme = g.garageTheme || "luxury";
    panel.innerHTML = `
      <div class="my-appshell my-appshell--rooms" data-my-appshell data-view="${escapeHtml(view)}" data-garage-theme="${escapeHtml(theme)}">
        <header class="my-appshell-head my-appshell-head--slim">
          <div class="my-head-side my-head-side--left">
            <b class="my-appshell-title">MY GARAGE</b>
            <div class="my-head-cluster">
              <span class="my-head-chip">Garage</span>
              <span class="my-head-chip my-head-chip--accent" id="myHeadVehicle"></span>
            </div>
          </div>
          <div class="my-head-side my-head-side--right">
            <div class="my-head-cluster" id="myHeadMetaRight"></div>
            <button type="button" class="secondary" id="myHeadMore" title="더보기">More</button>
            <button type="button" class="secondary" id="myHeadProfile" title="설정">Settings</button>
          </div>
        </header>
        <div class="my-appshell-body my-appshell-body--rooms">
          <div class="my-main my-main--rooms" id="myMain"></div>
        </div>
        <nav class="my-room-tabs" role="tablist" aria-label="Garage rooms">
          ${GARAGE_ROOMS.map(
            (r) =>
              `<button type="button" role="tab" class="my-room-tab ${roomId === r.id ? "active is-active" : ""}" data-my-view="${r.id}" aria-selected="${roomId === r.id ? "true" : "false"}">
                ${menuIcon(r.id)}<span class="my-room-tab-label">${escapeHtml(r.label)}</span>
              </button>`
          ).join("")}
        </nav>
        <div class="my-more-sheet" id="myMoreSheet" hidden>
          <div class="my-more-sheet-inner card">
            <b>More</b>
            <div class="my-more-grid">
              ${MY_VIEWS.filter((v) => v.group === "more" || ["accessory", "collection", "custom", "upgrade"].includes(v.id))
                .map(
                  (v) =>
                    `<button type="button" class="secondary" data-my-view="${v.id}">${escapeHtml(v.label)}</button>`
                )
                .join("")}
            </div>
            <button type="button" class="secondary" id="myMoreClose">닫기</button>
          </div>
        </div>
      </div>`;

    const main = panel.querySelector("#myMain");
    const refreshShell = () => paint();
    const go = (id) => {
      g.activeMyView = id;
      emit("state:save");
      paint();
    };

    const meta = renderGarageHeaderMeta(state);
    const vehEl = panel.querySelector("#myHeadVehicle");
    const rightEl = panel.querySelector("#myHeadMetaRight");
    if (vehEl) vehEl.textContent = meta.vehicle;
    if (rightEl) rightEl.innerHTML = meta.rightHtml;

    panel.querySelectorAll("[data-my-view]").forEach((b) => {
      b.onclick = () => go(b.dataset.myView);
    });
    panel.querySelector("#myHeadProfile")?.addEventListener("click", () => go("profile"));
    panel.querySelector("#myHeadMore")?.addEventListener("click", () => {
      const sheet = panel.querySelector("#myMoreSheet");
      if (sheet) sheet.hidden = false;
    });
    panel.querySelector("#myMoreClose")?.addEventListener("click", () => {
      const sheet = panel.querySelector("#myMoreSheet");
      if (sheet) sheet.hidden = true;
    });
    panel.querySelector("#myMoreSheet")?.addEventListener("click", (e) => {
      if (e.target.id === "myMoreSheet") e.currentTarget.hidden = true;
    });

    renderActiveView(main, state, refreshShell);
  };

  paint();
}

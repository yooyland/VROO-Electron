import { ensureMyGarage, escapeHtml, formatShortDate } from "./my-data.js";
import { emit } from "../../core/events.js";
import { showSystemMessage } from "../../core/ui.js";

export function renderAchievementsView(host, state, refresh) {
  const g = ensureMyGarage(state);
  const list = g.achievements || [];
  const featured = list.find((a) => a.unlocked) || null;

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>업적</b>
        <div class="muted">테스트·로컬 기준 데이터 · 서버 검증 전</div>
      </div>
      ${featured ? `<div class="my-head-chip">대표 · ${escapeHtml(featured.titleReward || featured.title)}</div>` : ""}
    </div>
    <div class="my-ach-grid">
      ${list
        .map((a) => {
          const pct = Math.min(100, Math.round(((Number(a.progress) || 0) / Math.max(1, Number(a.target) || 1)) * 100));
          return `<div class="card my-ach-card ${a.unlocked ? "is-unlocked" : "is-locked"}">
            <b>${escapeHtml(a.title)}</b>
            <div class="muted">${a.unlocked ? `획득 ${formatShortDate(a.unlockedAt)}` : "잠금"}</div>
            <div class="my-stat-bar"><i style="width:${pct}%"></i></div>
            <div class="muted">${a.progress}/${a.target}${a.titleReward ? ` · 칭호 ${escapeHtml(a.titleReward)}` : ""}</div>
            ${a.unlocked ? `<button type="button" class="secondary" data-feat="${escapeHtml(a.id)}">대표 업적으로</button>` : ""}
          </div>`;
        })
        .join("")}
    </div>`;

  host.querySelectorAll("[data-feat]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.feat;
      g.achievements = list.map((a) => ({ ...a, featured: a.id === id }));
      emit("state:save");
      showSystemMessage("대표 업적을 변경했습니다. (로컬)");
      refresh();
    };
  });
}

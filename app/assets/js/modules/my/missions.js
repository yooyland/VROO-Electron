import { ensureMyGarage, escapeHtml } from "./my-data.js";
import { showSystemMessage } from "../../core/ui.js";

const GROUP_LABEL = {
  daily: "Daily",
  weekly: "Weekly",
  growth: "Growth",
  safety: "Safety",
  community: "Community",
  grid: "GRID"
};

function missionStars(difficulty = 3) {
  const n = Math.max(1, Math.min(5, Number(difficulty) || 3));
  let out = "";
  for (let i = 1; i <= 5; i++) out += `<span class="my-star ${i <= n ? "on" : ""}"></span>`;
  return `<div class="my-stars" aria-label="난이도 ${n}">${out}</div>`;
}

function rewardChips(m) {
  const chips = [];
  if (m.rewardCoins != null) chips.push(`<span class="my-mission-reward-chip is-coin">+${m.rewardCoins} Coin</span>`);
  if (m.rewardExp != null) chips.push(`<span class="my-mission-reward-chip is-exp">+${m.rewardExp} EXP</span>`);
  if (!chips.length && m.rewardLabel) chips.push(`<span class="my-mission-reward-chip">${escapeHtml(m.rewardLabel)}</span>`);
  if (!chips.length) chips.push(`<span class="my-mission-reward-chip is-coin">+30 Coin</span>`);
  return `<div class="my-mission-rewards">${chips.join("")}</div>`;
}

export function renderMissionsView(host, state) {
  const g = ensureMyGarage(state);
  const list = g.missions || [];

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>미션</b>
        <div class="muted">보상과 진행률을 함께 · source: local</div>
      </div>
    </div>
    <div class="my-mission-list">
      ${list
        .map((m) => {
          const pct = Math.min(100, Math.round(((Number(m.progress) || 0) / Math.max(1, Number(m.target) || 1)) * 100));
          const done = m.status === "complete" || pct >= 100;
          const eta =
            m.etaMinutes != null && Number(m.etaMinutes) > 0
              ? `<div class="my-mission-eta">약 ${Number(m.etaMinutes)}분</div>`
              : "";
          const claim =
            done || m.claimReady
              ? `<button type="button" class="secondary my-mission-claim" data-claim="${escapeHtml(m.id)}" ${m.claimed ? "disabled" : ""}>${m.claimed ? "수령 완료" : "보상 수령"}</button>`
              : "";
          return `<div class="card my-mission-card my-mission-card--rich ${done ? "is-complete" : ""}">
            <div class="my-mission-top">
              ${missionStars(m.difficulty)}
              <span class="my-mission-group">${GROUP_LABEL[m.group] || m.group}</span>
            </div>
            <b class="my-mission-title">${escapeHtml(m.title)}</b>
            ${eta}
            <div class="my-mission-pct">${pct}%</div>
            <div class="my-stat-bar my-stat-bar--glow" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(pct, 0)}%"></i></div>
            ${rewardChips(m)}
            <div class="muted my-mission-progress">${m.progress}/${m.target} ${escapeHtml(m.unit || "")}${done ? " · 완료" : ""}</div>
            ${claim}
          </div>`;
        })
        .join("")}
    </div>`;

  host.querySelectorAll("[data-claim]").forEach((b) => {
    b.onclick = () => {
      const m = (g.missions || []).find((x) => x.id === b.dataset.claim);
      if (!m || m.claimed) return;
      // 구조만 준비 — 자동 지급/결제 없음
      showSystemMessage("보상 수령은 서버 연동 후 제공됩니다. (로컬 미리보기)");
    };
  });
}

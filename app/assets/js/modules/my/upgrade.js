import { ensureMyGarage, getSelectedVehicle, escapeHtml, STAT_KEYS } from "./my-data.js";
import { emit } from "../../core/events.js";
import { formatCredits, growthUpgradeCost, canAfford, spendCredits } from "../../core/storage.js";
import { showSystemMessage } from "../../core/ui.js";

/** 다음 레벨 미리보기용 — my-data에 없으면 로컬 계산 */
function nextStats(stats) {
  const out = { ...stats };
  for (const [k] of STAT_KEYS) {
    out[k] = Math.min(99, (Number(out[k]) || 0) + 2);
  }
  return out;
}

export function renderUpgradeView(host, state, refresh) {
  ensureMyGarage(state);
  const v = getSelectedVehicle(state);
  if (!v) {
    host.innerHTML = `<div class="card muted">차량을 선택하세요.</div>`;
    return;
  }
  if (!v.owned) {
    host.innerHTML = `<div class="card muted">보유한 차량만 업그레이드 미리보기가 가능합니다.</div>`;
    return;
  }
  const cost = growthUpgradeCost(v.level);
  const next = nextStats(v.stats);
  const accountCost = growthUpgradeCost(state.level);

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>업그레이드</b>
        <div class="muted">예측 가능한 성장 미리보기 · 실제 결제·강화 서버 미연동</div>
      </div>
    </div>
    <div class="my-upgrade-grid">
      <div class="card">
        <b>${escapeHtml(v.name)}</b>
        <div class="muted">현재 Lv.${v.level} → 다음 Lv.${v.level + 1}</div>
        <div class="my-upgrade-cost">필요 크레딧(로컬 기준) ${formatCredits(cost)}</div>
        <div class="muted">보유 크레딧 ${formatCredits(state.credits)}</div>
        <div class="my-stat-delta">
          ${STAT_KEYS.map(([k, label]) => {
            const a = Number(v.stats?.[k]) || 0;
            const b = Number(next[k]) || 0;
            return `<div><span class="muted">${escapeHtml(label)}</span><div>${a} → <b>${b}</b></div></div>`;
          }).join("")}
        </div>
      </div>
      <div class="card">
        <b>연동 상태</b>
        <ul class="my-note-list">
          <li>서버 강화 API: 미연결</li>
          <li>확률형 강화: 사용하지 않음</li>
          <li>아래 로컬 테스트는 기기 저장에만 반영됩니다</li>
        </ul>
        <div class="my-garage-actions" style="margin-top:12px">
          <button type="button" class="primary" id="myUpServer" disabled title="서버 미연동">업그레이드 (서버 연동 필요)</button>
          <button type="button" class="secondary" id="myUpLocal">로컬 테스트 성장</button>
        </div>
        <div class="muted" style="margin-top:10px;font-size:12px">계정 레벨 성장은 성장 메뉴에서도 가능합니다. (비용 ${formatCredits(accountCost)})</div>
      </div>
    </div>`;

  host.querySelector("#myUpLocal").onclick = () => {
    if (!canAfford(state, cost)) {
      showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(cost)})`);
      return;
    }
    const paid = spendCredits(state, cost);
    if (!paid.ok) {
      showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(cost)})`);
      return;
    }
    v.level += 1;
    v.stats = nextStats(v.stats);
    v.growthRate = Math.min(100, (v.growthRate || 40) + 3);
    emit("state:save");
    emit("ui:refreshAccount");
    showSystemMessage("로컬 테스트용으로 차량 성장을 반영했습니다. 서버 연동 시 동기화가 필요합니다.");
    refresh();
  };
}

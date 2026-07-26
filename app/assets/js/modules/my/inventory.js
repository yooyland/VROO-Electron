import { ensureMyGarage, escapeHtml, formatShortDate } from "./my-data.js";
import { emit } from "../../core/events.js";
import { showSystemMessage } from "../../core/ui.js";

const KIND_LABEL = {
  all: "전체",
  vehicle: "차량",
  skin: "스킨",
  accessory: "액세서리",
  material: "성장 재료",
  coupon: "쿠폰",
  consumable: "소모품"
};

function invStars(n = 4) {
  const s = Math.max(1, Math.min(5, n));
  let out = "";
  for (let i = 1; i <= 5; i++) out += `<span class="my-star ${i <= s ? "on" : ""}"></span>`;
  return `<div class="my-stars">${out}</div>`;
}

function invArt(kind) {
  const c = 'class="my-inv-art-svg" viewBox="0 0 140 96" width="140" height="96" aria-hidden="true"';
  if (kind === "skin") {
    return `<svg ${c}><rect x="12" y="22" width="116" height="52" rx="14" fill="#c9a227"/><rect x="28" y="34" width="84" height="28" rx="7" fill="#1a1608" opacity=".35"/><circle cx="40" cy="78" r="10" fill="#0b1017"/><circle cx="100" cy="78" r="10" fill="#0b1017"/></svg>`;
  }
  if (kind === "accessory") {
    return `<svg ${c}><circle cx="70" cy="48" r="30" fill="#2b3644" stroke="#c9a227" stroke-width="4"/><circle cx="70" cy="48" r="12" fill="#c9a227"/><path d="M70 14v10M70 72v10M14 48h10M116 48h10" stroke="#8eb4d4" stroke-width="3"/></svg>`;
  }
  if (kind === "material") {
    return `<svg ${c}><path d="M70 12 108 34v36L70 92 32 70V34Z" fill="#7dba7a55" stroke="#7dba7a" stroke-width="2"/><path d="M70 30v36M52 40l36 20M52 60l36-20" stroke="#c9a227" stroke-width="2"/></svg>`;
  }
  if (kind === "coupon") {
    return `<svg ${c}><rect x="18" y="28" width="104" height="40" rx="10" fill="#ff6a3d44" stroke="#ff6a3d"/><circle cx="34" cy="48" r="7" fill="#0b1017"/><circle cx="106" cy="48" r="7" fill="#0b1017"/><path d="M48 48h44" stroke="#fff" stroke-dasharray="4 4"/></svg>`;
  }
  if (kind === "consumable") {
    return `<svg ${c}><ellipse cx="70" cy="52" rx="40" ry="22" fill="#5cffd733" stroke="#5cffd7"/><path d="M44 40c10-16 42-16 52 0" fill="none" stroke="#c9a227" stroke-width="3"/><circle cx="70" cy="32" r="7" fill="#c9a227"/></svg>`;
  }
  return `<svg ${c}><rect x="24" y="28" width="92" height="40" rx="10" fill="#8eb4d455" stroke="#8eb4d4"/></svg>`;
}

function rarityStars(kind) {
  if (kind === "skin") return 5;
  if (kind === "accessory") return 4;
  if (kind === "material") return 3;
  if (kind === "consumable") return 4;
  return 2;
}

export function renderInventoryView(host, state, refresh) {
  const g = ensureMyGarage(state);
  const filter = g.inventoryFilter || "all";
  const items = (g.inventory || []).filter((it) => filter === "all" || it.kind === filter);

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>보관함</b>
        <div class="muted">아이템 비주얼 중심 · 로컬 미리보기</div>
      </div>
    </div>
    <div class="my-filter-tabs">${Object.entries(KIND_LABEL)
      .map(
        ([id, label]) =>
          `<button type="button" class="${filter === id ? "active" : ""}" data-inv-filter="${id}">${label}</button>`
      )
      .join("")}</div>
    <div class="my-inv-grid my-inv-grid--visual">
      ${
        items
          .map((it) => {
            const expired = it.expiresAt && Number(it.expiresAt) < Date.now();
            const usable = it.usable && !expired;
            const equipped = !!it.equipped;
            return `<div class="card my-inv-card my-inv-card--visual ${usable ? "" : "is-disabled"} ${equipped ? "is-equipped" : ""}">
              <div class="my-inv-art">${invArt(it.kind)}</div>
              ${equipped ? `<span class="my-inv-equipped">장착 중</span>` : ""}
              <b class="my-inv-name">${escapeHtml(it.name)}</b>
              ${invStars(rarityStars(it.kind))}
              <div class="muted my-inv-meta">${KIND_LABEL[it.kind] || it.kind} · ×${it.qty}${expired ? " · 만료" : ""}</div>
              <button type="button" class="${usable ? "primary" : "secondary"}" data-use="${escapeHtml(it.id)}" ${usable ? "" : "disabled"}>${equipped ? "장착 중" : "사용"}</button>
            </div>`;
          })
          .join("") || `<div class="card muted">아이템이 없습니다.</div>`
      }
    </div>`;

  host.querySelectorAll("[data-inv-filter]").forEach((b) => {
    b.onclick = () => {
      g.inventoryFilter = b.dataset.invFilter;
      emit("state:save");
      refresh();
    };
  });
  host.querySelectorAll("[data-use]").forEach((b) => {
    b.onclick = () => {
      showSystemMessage("아이템 사용은 서버 연동 후 제공됩니다. (로컬 보관함 미리보기)");
    };
  });
}

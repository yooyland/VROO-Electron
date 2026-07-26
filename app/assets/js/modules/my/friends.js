import { ensureMyGarage, escapeHtml, vehicleSilhouetteSvg, MODEL_NAME, TYPE_LABEL } from "./my-data.js";
import { emit } from "../../core/events.js";
import { showSystemMessage } from "../../core/ui.js";

const STATUS_LABEL = {
  Driving: "Driving",
  Parked: "Parked",
  Charging: "Charging",
  Online: "Online",
  Offline: "Offline"
};

function friendCarLabel(f) {
  if (f.vehicleLabel) return f.vehicleLabel;
  const t = f.vehicleType || "sedan";
  return MODEL_NAME[t] || TYPE_LABEL[t] || t;
}

function friendStatus(f) {
  if (f.status && STATUS_LABEL[f.status]) return f.status;
  return f.online ? "Online" : "Offline";
}

export function renderFriendsView(host, state) {
  const g = ensureMyGarage(state);
  const friends = g.friends || [];
  const blocked = Array.isArray(state.blockedUserIds) ? state.blockedUserIds : [];

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>친구</b>
        <div class="muted">차량 썸네일 우선 · 로컬 목록</div>
      </div>
    </div>
    <div class="my-friend-list">
      ${
        friends
          .map((f) => {
            const car = friendCarLabel(f);
            const st = friendStatus(f);
            const isOnlineDot = ["Driving", "Charging", "Online"].includes(st);
            return `<div class="card my-friend-card">
              <div class="my-friend-thumb">
                ${vehicleSilhouetteSvg(f.vehicleType || "sedan", f.vehicleColor || "#c9a227")}
                <span class="my-friend-car">${escapeHtml(car)}</span>
              </div>
              <div>
                <b>${escapeHtml(f.nickname)}</b>
                <div class="my-friend-status">
                  <span class="status-dot ${isOnlineDot ? "online" : "offline"}"></span>
                  ${escapeHtml(st)}
                </div>
                <div class="muted">${escapeHtml(f.lastGrid || "—")}</div>
              </div>
              <div class="my-friend-actions">
                <button type="button" class="secondary" data-dm="${escapeHtml(f.id)}" title="1:1 대화">1:1</button>
                <button type="button" class="secondary" data-car="${escapeHtml(f.id)}" title="차량 보기">차량 보기</button>
              </div>
            </div>`;
          })
          .join("") || `<div class="card muted">친구 목록이 비어 있습니다.</div>`
      }
    </div>
    <div class="card" style="margin-top:12px">
      <b>차단 목록</b>
      <div class="muted">${blocked.length ? blocked.map((id) => escapeHtml(id)).join(", ") : "없음"}</div>
      <div class="muted" style="margin-top:8px">친구 추가·동기화는 서버 연동 후 제공됩니다.</div>
    </div>`;

  host.querySelectorAll("[data-dm]").forEach((b) => {
    b.onclick = () => {
      emit("chat:open", { id: b.dataset.dm });
      showSystemMessage("1:1 대화는 Spatial/대화방에서 이어집니다.");
    };
  });
  host.querySelectorAll("[data-car]").forEach((b) => {
    b.onclick = () => showSystemMessage("상대 차량 보기는 서버 연동 후 제공됩니다.");
  });
}

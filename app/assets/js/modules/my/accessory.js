import { ensureMyGarage, getSelectedVehicle, escapeHtml } from "./my-data.js";
import { emit } from "../../core/events.js";

const ACCESSORIES = [
  { id: "plate-frame", label: "번호판 프레임", status: "local", equippedKey: "plateStyleId" },
  { id: "roof", label: "루프 액세서리", status: "planned" },
  { id: "badge", label: "차량 배지", status: "planned" },
  { id: "chat-fx", label: "대화 이펙트", status: "planned" },
  { id: "nick-deco", label: "닉네임 장식", status: "planned" },
  { id: "horn", label: "경적 사운드", status: "local", equippedKey: "hornId" },
  { id: "aura", label: "차량 주변 효과", status: "planned" }
];

export function renderAccessoryView(host, state, refresh) {
  ensureMyGarage(state);
  const v = getSelectedVehicle(state);

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>액세서리</b>
        <div class="muted">디지털 아바타 꾸미기 요소입니다. 실제 차량 안전·성능과 무관합니다.</div>
      </div>
    </div>
    <div class="my-acc-grid">
      ${ACCESSORIES.map((a) => {
        const planned = a.status === "planned";
        const equipped = a.equippedKey && v?.customization?.[a.equippedKey];
        return `<div class="card my-acc-card ${planned ? "is-planned" : ""}">
          <b>${escapeHtml(a.label)}</b>
          <div class="muted">${planned ? "준비 중" : equipped ? `장착: ${escapeHtml(String(equipped))}` : "로컬 장착 가능"}</div>
          <button type="button" class="secondary" data-acc="${a.id}" ${planned ? "disabled" : ""}>${planned ? "준비 중" : "커스텀에서 설정"}</button>
        </div>`;
      }).join("")}
    </div>`;

  host.querySelectorAll("[data-acc]").forEach((b) => {
    b.onclick = () => {
      state.myGarage.activeMyView = "custom";
      emit("state:save");
      refresh();
    };
  });
}

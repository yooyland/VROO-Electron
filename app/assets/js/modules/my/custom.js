import {
  ensureMyGarage,
  getSelectedVehicle,
  vehicleSilhouetteSvg,
  previewCustomization,
  applyCustomDraft,
  escapeHtml
} from "./my-data.js";
import { emit } from "../../core/events.js";
import { showSystemMessage } from "../../core/ui.js";

const BODY_COLORS = [
  { id: "#c9a227", label: "VROO Gold" },
  { id: "#d8dee8", label: "실버" },
  { id: "#1a2330", label: "미드나잇" },
  { id: "#4a6fa5", label: "스틸 블루" },
  { id: "#8b3a3a", label: "레드" },
  { id: "#2f5d50", label: "포레스트" }
];

const WHEELS = [
  { id: "wheel-std", label: "스탠다드" },
  { id: "wheel-sport", label: "스포츠" },
  { id: "wheel-classic", label: "클래식" }
];

const PLATES = [
  { id: "plate-std", label: "기본" },
  { id: "plate-gold", label: "골드 프레임" },
  { id: "plate-minimal", label: "미니멀" }
];

const HORNS = [
  { id: "horn-std", label: "기본 경적" },
  { id: "horn-soft", label: "소프트" }
];

export function renderCustomView(host, state, refresh) {
  const g = ensureMyGarage(state);
  const v = getSelectedVehicle(state);
  if (!v?.owned) {
    host.innerHTML = `<div class="card muted">보유 차량만 커스텀할 수 있습니다.</div>`;
    return;
  }
  if (!g.customDraft) g.customDraft = { ...v.customization };
  const draft = g.customDraft;
  const preview = previewCustomization(v, draft);

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>커스텀</b>
        <div class="muted">디지털 아바타 꾸미기 · 미리보기와 저장을 구분합니다</div>
      </div>
    </div>
    <div class="my-custom-layout">
      <div class="card my-custom-preview">
        <div class="my-showcase-stage compact">
          <div class="my-platform" aria-hidden="true"></div>
          <div class="my-car-figure">${vehicleSilhouetteSvg(v.catalogType, preview.bodyColor)}</div>
        </div>
        <div class="muted" style="text-align:center;margin-top:8px">${escapeHtml(v.name)} · 미리보기</div>
      </div>
      <div class="card my-custom-controls">
        <b>차체 색상</b>
        <div class="my-swatch-row">${BODY_COLORS.map(
          (c) =>
            `<button type="button" class="my-swatch ${draft.bodyColor === c.id ? "active" : ""}" data-body="${c.id}" title="${escapeHtml(c.label)}" style="--sw:${c.id}"></button>`
        ).join("")}</div>
        <b>휠</b>
        <div class="my-option-row">${WHEELS.map(
          (w) =>
            `<button type="button" class="secondary ${draft.wheelId === w.id ? "active" : ""}" data-wheel="${w.id}">${escapeHtml(w.label)}</button>`
        ).join("")}</div>
        <b>번호판 스타일</b>
        <div class="my-option-row">${PLATES.map(
          (p) =>
            `<button type="button" class="secondary ${draft.plateStyleId === p.id ? "active" : ""}" data-plate="${p.id}">${escapeHtml(p.label)}</button>`
        ).join("")}</div>
        <b>경적</b>
        <div class="my-option-row">${HORNS.map(
          (h) =>
            `<button type="button" class="secondary ${draft.hornId === h.id ? "active" : ""}" data-horn="${h.id}">${escapeHtml(h.label)}</button>`
        ).join("")}</div>
        <div class="muted" style="margin-top:12px">유리·라이트·네온·스티커·이펙트는 준비 중입니다.</div>
        <div class="my-garage-actions" style="margin-top:14px">
          <button type="button" class="secondary" id="myCustomCancel">미리보기 취소</button>
          <button type="button" class="primary" id="myCustomSave">저장</button>
        </div>
      </div>
    </div>`;

  const touch = () => {
    emit("state:save");
    refresh();
  };
  host.querySelectorAll("[data-body]").forEach((b) => {
    b.onclick = () => {
      draft.bodyColor = b.dataset.body;
      touch();
    };
  });
  host.querySelectorAll("[data-wheel]").forEach((b) => {
    b.onclick = () => {
      draft.wheelId = b.dataset.wheel;
      touch();
    };
  });
  host.querySelectorAll("[data-plate]").forEach((b) => {
    b.onclick = () => {
      draft.plateStyleId = b.dataset.plate;
      touch();
    };
  });
  host.querySelectorAll("[data-horn]").forEach((b) => {
    b.onclick = () => {
      draft.hornId = b.dataset.horn;
      touch();
    };
  });
  host.querySelector("#myCustomCancel").onclick = () => {
    applyCustomDraft(state, false);
    emit("state:save");
    showSystemMessage("미리보기를 취소했습니다.");
    refresh();
  };
  host.querySelector("#myCustomSave").onclick = () => {
    applyCustomDraft(state, true);
    emit("state:save");
    showSystemMessage("커스텀을 저장했습니다. (로컬)");
    refresh();
  };
}

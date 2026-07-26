import {
  ensureMyGarage,
  setSelectedVehicle,
  setActiveVehicle,
  vehicleSilhouetteSvg,
  vehicleDisplayName,
  formatKm,
  escapeHtml,
  formatShortDate,
  RARITY_LABEL
} from "./my-data.js";
import { emit } from "../../core/events.js";
import { showSystemMessage } from "../../core/ui.js";

const FILTERS = [
  ["all", "전체"],
  ["active", "사용 중"],
  ["owned", "보유"],
  ["locked", "잠금"],
  ["sport", "스포츠"],
  ["sedan", "세단"],
  ["suv", "SUV"],
  ["legend", "Legend"],
  ["rare", "Rare"]
];

const SORTS = [
  ["level", "레벨"],
  ["recent", "최근 획득"],
  ["name", "이름"],
  ["rarity", "등급"]
];

const RARITY_ORDER = { legend: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

function matchesFilter(v, filter) {
  if (filter === "all") return true;
  if (filter === "active") return !!v.active;
  if (filter === "owned") return !!v.owned;
  if (filter === "locked") return !v.owned;
  if (["sport", "sedan", "suv", "taxi", "van", "truck", "bus", "delivery", "classic"].includes(filter)) {
    return v.catalogType === filter;
  }
  if (RARITY_LABEL[filter]) return v.rarity === filter;
  return true;
}

function sortVehicles(list, sort) {
  const arr = [...list];
  if (sort === "name") arr.sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  else if (sort === "recent") arr.sort((a, b) => (Number(b.acquiredAt) || 0) - (Number(a.acquiredAt) || 0));
  else if (sort === "rarity") arr.sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));
  else arr.sort((a, b) => (b.level || 0) - (a.level || 0));
  return arr;
}

export function renderCollectionView(host, state, refresh) {
  const g = ensureMyGarage(state);
  const filter = g.collectionFilter || "all";
  const sort = g.collectionSort || "level";
  const list = sortVehicles(g.vehicles.filter((v) => matchesFilter(v, filter)), sort);

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>차량 컬렉션</b>
        <div class="muted">보유·잠금 차량을 살펴보고 Garage에 표시합니다.</div>
      </div>
    </div>
    <div class="my-toolbar">
      <div class="my-filter-tabs">${FILTERS.map(
        ([id, label]) =>
          `<button type="button" class="${filter === id ? "active" : ""}" data-col-filter="${id}">${label}</button>`
      ).join("")}</div>
      <label class="my-sort muted">정렬
        <select id="myColSort">${SORTS.map(
          ([id, label]) => `<option value="${id}" ${sort === id ? "selected" : ""}>${label}</option>`
        ).join("")}</select>
      </label>
    </div>
    <div class="my-collection-grid">
      ${
        list
          .map((v) => {
            const color = v.customization?.bodyColor || "#d8dee8";
            return `<button type="button" class="card my-vehicle-card ${g.selectedVehicleId === v.id ? "is-selected" : ""} ${v.active ? "is-active" : ""} ${v.owned ? "" : "is-locked"}" data-pick="${escapeHtml(v.id)}">
              <div class="my-vehicle-thumb">${vehicleSilhouetteSvg(v.catalogType, color)}</div>
              <div class="my-vehicle-card-body">
                <div class="my-vehicle-card-title"><b>${escapeHtml(vehicleDisplayName(v))}</b>${v.active ? '<span class="my-badge-active">사용 중</span>' : ""}</div>
                <div class="muted">Lv.${v.level} · ${escapeHtml(v.rarityLabel)} · ${formatKm(v.mileage)} km</div>
                <div class="muted">${v.owned ? `획득 ${formatShortDate(v.acquiredAt)}` : "미보유"} · 성장 ${v.growthRate || 0}%</div>
              </div>
            </button>`;
          })
          .join("") || `<div class="card muted">조건에 맞는 차량이 없습니다.</div>`
      }
    </div>
    <div class="my-garage-actions">
      <button type="button" class="primary" id="myColToGarage">Garage에서 보기</button>
      <button type="button" class="secondary" id="myColSetActive">대표 차량으로 설정</button>
    </div>`;

  host.querySelectorAll("[data-col-filter]").forEach((b) => {
    b.onclick = () => {
      g.collectionFilter = b.dataset.colFilter;
      emit("state:save");
      refresh();
    };
  });
  host.querySelector("#myColSort").onchange = (e) => {
    g.collectionSort = e.target.value;
    emit("state:save");
    refresh();
  };
  host.querySelectorAll("[data-pick]").forEach((b) => {
    b.onclick = () => {
      setSelectedVehicle(state, b.dataset.pick);
      emit("state:save");
      refresh();
    };
  });
  host.querySelector("#myColToGarage").onclick = () => {
    g.activeMyView = "garage";
    emit("state:save");
    refresh();
  };
  host.querySelector("#myColSetActive").onclick = () => {
    const r = setActiveVehicle(state, g.selectedVehicleId);
    if (!r.ok) {
      showSystemMessage("보유한 차량만 대표로 설정할 수 있습니다.");
      return;
    }
    emit("state:save");
    emit("ui:refreshAccount");
    showSystemMessage("대표 차량을 변경했습니다.");
    refresh();
  };
}

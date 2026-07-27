import {emit} from "../core/events.js";

const HERITAGE_VIEW_ROOT = "./assets/characters/05_Heritage/views";
const HERITAGE_VIEWS = [
  ["front", "정면"],
  ["front_45", "전면 45°"],
  ["front_right", "전면 우측"],
  ["right", "우측"],
  ["rear_right", "후면 우측"],
  ["rear", "후면"],
  ["rear_left", "후면 좌측"],
  ["left", "좌측"],
  ["front_left", "전면 좌측"]
];
const HERITAGE_VIEW_IDS = new Set(HERITAGE_VIEWS.map(([id]) => id));

function metric(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeView(view) {
  return HERITAGE_VIEW_IDS.has(view) ? view : "front_45";
}

function vehicleImage(view) {
  const activeView = normalizeView(view);
  const asset = `${HERITAGE_VIEW_ROOT}/${activeView}`;
  return `
    <picture class="garage-vehicle-picture" data-garage-picture>
      <source srcset="${asset}.webp" type="image/webp" data-garage-webp>
      <img src="${asset}.png" alt="VROO Heritage Executive S ${activeView} view" data-garage-image>
    </picture>`;
}

function viewSelector(activeView) {
  return `
    <div class="garage-view-selector" role="group" aria-label="차량 방향 선택">
      ${HERITAGE_VIEWS.map(([id, label]) => `
        <button type="button" data-garage-view="${id}" class="${id === activeView ? "active" : ""}" aria-pressed="${id === activeView}">
          ${label}
        </button>`).join("")}
    </div>`;
}

function setVehicleView(root, view) {
  const activeView = normalizeView(view);
  const asset = `${HERITAGE_VIEW_ROOT}/${activeView}`;
  const source = root.querySelector("[data-garage-webp]");
  const image = root.querySelector("[data-garage-image]");
  if (source) source.srcset = `${asset}.webp`;
  if (image) {
    image.dataset.fallbackApplied = "false";
    image.src = `${asset}.png`;
    image.alt = `VROO Heritage Executive S ${activeView} view`;
    image.onerror = () => {
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      if (source) source.removeAttribute("srcset");
      image.src = `${HERITAGE_VIEW_ROOT}/front_45.png`;
      showNotice(root, "선택 방향을 불러오지 못해 승인된 전면 45° 마스터를 표시합니다.");
    };
  }
  root.querySelectorAll("[data-garage-view]").forEach(button => {
    const selected = button.dataset.garageView === activeView;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  return activeView;
}

function renderOverview(root, state, requestedView = "front_45") {
  const activeView = normalizeView(requestedView);
  const level = Math.max(1, metric(state.level, 1));
  const xp = Math.max(0, Math.min(100, metric(state.xp, 0)));
  const score = Math.round(720 + level * 18 + xp * 0.8);
  const mileage = metric(state.weekMileage, 128.4);
  const fuel = metric(state.fuelLevel, 95);
  const battery = metric(state.batteryLevel, 82);

  root.innerHTML = `
    <section class="garage-hero" aria-label="MY CAR Garage">
      <div class="garage-hero-copy">
        <span class="garage-eyebrow">VROO FLAGSHIP · HERITAGE</span>
        <h3>Heritage Executive S</h3>
        <p>${state.profile.nickname} · ${state.profile.plate}</p>
        <div class="garage-level-row">
          <b>LV.${level}</b>
          <div class="garage-exp"><i style="width:${xp}%"></i></div>
          <span>${xp}%</span>
        </div>
      </div>
      <div class="garage-score"><small>VEHICLE SCORE</small><strong>${score}</strong></div>
      ${vehicleImage(activeView)}
      <div class="garage-stage-glow" aria-hidden="true"></div>
    </section>

    ${viewSelector(activeView)}

    <section class="garage-stat-grid" aria-label="차량 상태">
      <article><small>이번 주 주행</small><b>${mileage.toLocaleString("ko-KR")} km</b></article>
      <article><small>연료</small><b>${fuel}%</b><i><span style="width:${fuel}%"></span></i></article>
      <article><small>배터리</small><b>${battery}%</b><i><span style="width:${battery}%"></span></i></article>
      <article><small>등급</small><b>HERITAGE S</b></article>
    </section>

    <section class="garage-action-grid">
      <button data-garage-action="customize"><span>✦</span><b>Customize</b><small>외관과 파츠</small></button>
      <button data-garage-action="upgrade"><span>▲</span><b>Upgrade</b><small>성능과 레벨</small></button>
      <button data-garage-action="mission"><span>◆</span><b>Mission</b><small>보상과 도전</small></button>
      <button data-garage-action="collection"><span>▦</span><b>Collection</b><small>보유 차량</small></button>
    </section>`;

  root.querySelector('[data-garage-action="upgrade"]').onclick = () => emit("garage:openGrowth");
  root.querySelector('[data-garage-action="mission"]').onclick = () => showNotice(root, "미션은 PLAY 메뉴에 통합될 예정입니다.");
  root.querySelector('[data-garage-action="customize"]').onclick = () => showNotice(root, "커스터마이즈 파츠를 준비 중입니다.");
  root.querySelector('[data-garage-action="collection"]').onclick = () => showNotice(root, "Heritage S가 대표 차량으로 선택되어 있습니다.");
  setVehicleView(root, activeView);
  root.querySelectorAll("[data-garage-view]").forEach(button => {
    button.onclick = () => {
      state.garageView = setVehicleView(root, button.dataset.garageView);
      emit("state:save");
    };
  });
}

function showNotice(root, message) {
  let notice = root.querySelector(".garage-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "garage-notice";
    root.prepend(notice);
  }
  notice.textContent = message;
}

function renderInventory(root) {
  root.innerHTML = `
    <div class="garage-empty-card">
      <span>✦</span><h3>Inventory</h3>
      <p>휠·라이트·스포일러·배기 파츠가 이곳에 정리됩니다.</p>
      <small>현재는 Heritage S 기본 파츠가 장착되어 있습니다.</small>
    </div>`;
}

function renderMission(root) {
  root.innerHTML = `
    <div class="garage-list-card"><b>오늘의 드라이브</b><span>0 / 10 km</span></div>
    <div class="garage-list-card"><b>GRID 방문</b><span>0 / 3</span></div>
    <div class="garage-list-card"><b>안전 운전 연속 기록</b><span>준비 중</span></div>`;
}

function renderFriends(root, state) {
  const count = Array.isArray(state.connections) ? state.connections.length : 0;
  root.innerHTML = `
    <div class="garage-empty-card">
      <span>●</span><h3>Friends</h3>
      <p>연결된 드라이버 ${count}명</p>
      <small>친구 대화는 SOCIAL의 대화방에서 한 번만 관리합니다.</small>
    </div>`;
}

function renderRecord(root, state) {
  const mileage = metric(state.weekMileage, 128.4);
  root.innerHTML = `
    <div class="garage-record-card">
      <div><small>주간 주행 기록</small><strong>${mileage.toLocaleString("ko-KR")} km</strong></div>
      <svg viewBox="0 0 600 150" role="img" aria-label="주간 주행 추이">
        <defs><linearGradient id="garageChart" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffc400" stop-opacity=".5"/><stop offset="1" stop-color="#ffc400" stop-opacity="0"/></linearGradient></defs>
        <path class="garage-chart-fill" d="M10 130 C80 120 90 85 160 92 S245 118 310 70 S420 82 470 45 S550 38 590 18 L590 145 L10 145 Z"/>
        <path class="garage-chart-line" d="M10 130 C80 120 90 85 160 92 S245 118 310 70 S420 82 470 45 S550 38 590 18"/>
      </svg>
    </div>`;
}

export function renderGarage(panel, state) {
  if (!panel) return;
  panel.innerHTML = `
    <div class="garage-shell">
      <div id="garageContent" class="garage-content"></div>
      <nav class="garage-room-tabs" aria-label="MY CAR 메뉴">
        <button class="active" data-room="garage">Garage</button>
        <button data-room="inventory">Inventory</button>
        <button data-room="mission">Mission</button>
        <button data-room="friends">Friends</button>
        <button data-room="record">Record</button>
      </nav>
    </div>`;

  const content = panel.querySelector("#garageContent");
  const renderRoom = room => {
    panel.querySelectorAll("[data-room]").forEach(button => {
      button.classList.toggle("active", button.dataset.room === room);
    });
    if (room === "inventory") renderInventory(content);
    else if (room === "mission") renderMission(content);
    else if (room === "friends") renderFriends(content, state);
    else if (room === "record") renderRecord(content, state);
    else renderOverview(content, state, state.garageView);
  };

  panel.querySelectorAll("[data-room]").forEach(button => {
    button.onclick = () => renderRoom(button.dataset.room);
  });
  renderRoom("garage");
}

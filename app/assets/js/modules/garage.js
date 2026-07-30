import {emit} from "../core/events.js";
import {carInfo} from "./data.js";
import {getProgressionSummary} from "./progression.js";

const HERITAGE_VIEW_ROOT = "./assets/characters/05_Heritage/views";
const HERITAGE_LAYER_ROOT = "./assets/characters/05_Heritage/layers";
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
const HERITAGE_AUTO_VIEW_IDS = HERITAGE_VIEWS.map(([id]) => id);
const HERITAGE_VIEW_IDS = new Set(HERITAGE_VIEWS.map(([id]) => id));
const GARAGE_ROTATE_STEP_PX = 72;
const GARAGE_AUTO_INTERVAL_MS = 1800;
let garageAutoTimer = 0;

function stopGarageAutoTimer() {
  if (garageAutoTimer) clearInterval(garageAutoTimer);
  garageAutoTimer = 0;
}

function metric(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeView(view) {
  return HERITAGE_VIEW_IDS.has(view) ? view : "front";
}

function resolveViewAsset(view) {
  const activeView = normalizeView(view);
  return {
    activeView,
    assetView: activeView === "front_right" ? "front_left" : activeView,
    mirrored: activeView === "front_right"
  };
}

function vehicleImage(view) {
  const {activeView, assetView, mirrored} = resolveViewAsset(view);
  const asset = `${HERITAGE_VIEW_ROOT}/${assetView}`;
  return `
    <div class="garage-vehicle-picture ${mirrored ? "is-mirrored" : ""}" data-garage-picture>
      <picture>
        <source srcset="${asset}.webp" type="image/webp" data-garage-webp>
        <img src="${asset}.png" alt="VROO Heritage Executive S ${activeView} view" data-garage-image>
      </picture>
      <img class="garage-light-layer" src="${HERITAGE_LAYER_ROOT}/front_45/front_lights.svg" alt="" aria-hidden="true" data-garage-light-layer>
    </div>`;
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
  const {activeView, assetView, mirrored} = resolveViewAsset(view);
  const asset = `${HERITAGE_VIEW_ROOT}/${assetView}`;
  const picture = root.querySelector("[data-garage-picture]");
  const source = root.querySelector("[data-garage-webp]");
  const image = root.querySelector("[data-garage-image]");
  if (picture) picture.classList.toggle("is-mirrored", mirrored);
  if (source) source.srcset = `${asset}.webp`;
  if (image) {
    image.dataset.fallbackApplied = "false";
    image.src = `${asset}.png`;
    image.alt = `VROO Heritage Executive S ${activeView} view`;
    image.onerror = () => {
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      if (source) source.removeAttribute("srcset");
      if (picture) picture.classList.remove("is-mirrored");
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

function bindGarageRotation(root, state, restartAuto) {
  const stage = root.querySelector("[data-garage-stage]");
  const image = root.querySelector("[data-garage-image]");
  if (!stage) return;
  if (image) image.draggable = false;

  let pointerId = null;
  let startX = 0;
  let startIndex = 0;
  let changed = false;

  const finish = () => {
    if (pointerId == null) return;
    pointerId = null;
    stage.classList.remove("is-dragging");
    if (changed) {
      emit("state:save");
      restartAuto();
    }
  };

  stage.addEventListener("pointerdown", event => {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest?.("button, input, select, textarea, a")) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startIndex = Math.max(0, HERITAGE_VIEWS.findIndex(([id]) => id === normalizeView(state.garageView)));
    changed = false;
    stage.classList.add("is-dragging");
    try {
      stage.setPointerCapture(pointerId);
    } catch {
      /* synthetic events and older WebViews */
    }
  });

  stage.addEventListener("pointermove", event => {
    if (pointerId == null || event.pointerId !== pointerId) return;
    const steps = Math.trunc((startX - event.clientX) / GARAGE_ROTATE_STEP_PX);
    if (!steps) return;
    const total = HERITAGE_VIEWS.length;
    const nextIndex = ((startIndex + steps) % total + total) % total;
    const nextView = HERITAGE_VIEWS[nextIndex][0];
    if (nextView === state.garageView) return;
    state.garageView = setVehicleView(root, nextView);
    syncLightLayer(root, state, state.garageView);
    changed = true;
  });

  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", finish);
  stage.addEventListener("lostpointercapture", finish);
}

function syncGarageAutoControl(root, state) {
  const button = root.querySelector("[data-garage-auto]");
  const enabled = state.garageAutoRotate !== false;
  if (!button) return;
  button.classList.toggle("active", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  button.innerHTML = enabled ? "<b>■</b><span>STOP</span>" : "<b>▶</b><span>AUTO</span>";
  button.setAttribute("aria-label", enabled ? "자동 회전 중지" : "자동 회전 시작");
}

function startGarageAuto(root, state) {
  stopGarageAutoTimer();
  syncGarageAutoControl(root, state);
  if (state.garageAutoRotate === false) return;
  garageAutoTimer = setInterval(() => {
    if (!root.isConnected) {
      stopGarageAutoTimer();
      return;
    }
    const activeView = normalizeView(state.garageView);
    const current = HERITAGE_AUTO_VIEW_IDS.indexOf(activeView);
    const nextIndex = current >= 0 ? (current + 1) % HERITAGE_AUTO_VIEW_IDS.length : 0;
    const next = HERITAGE_AUTO_VIEW_IDS[nextIndex];
    state.garageView = setVehicleView(root, next);
    syncLightLayer(root, state, next);
  }, GARAGE_AUTO_INTERVAL_MS);
}

function syncLightLayer(root, state, view) {
  const supported = view === "front_45";
  const enabled = supported && state.garageLightsOn === true;
  const layer = root.querySelector("[data-garage-light-layer]");
  const button = root.querySelector("[data-garage-light-toggle]");
  if (layer) layer.classList.toggle("active", enabled);
  if (button) {
    button.disabled = !supported;
    button.classList.toggle("active", enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.querySelector("span").textContent = supported ? (enabled ? "LIGHTS ON" : "LIGHTS OFF") : "FRONT 45 ONLY";
  }
}

function renderOverview(root, state, requestedView = "front", openRoom = () => {}) {
  const activeView = normalizeView(requestedView);
  const level = Math.max(1, metric(state.level, 1));
  const xp = Math.max(0, Math.min(100, metric(state.xp, 0)));
  const score = Math.round(720 + level * 18 + xp * 0.8);
  const mileage = metric(state.weekMileage, 128.4);
  const fuel = metric(state.fuelLevel, 95);
  const battery = metric(state.batteryLevel, 82);
  const vehicle = carInfo(state.profile.car);
  const progression = getProgressionSummary(state.vehicleProgression);
  const heritageOwned = progression.currentTier.id === "heritage";
  const heroEyebrow = heritageOwned ? "VROO FLAGSHIP · HERITAGE" : "FINAL GOAL PREVIEW · HERITAGE";
  const heroTitle = heritageOwned ? "Heritage Executive S" : "Heritage Executive S · 목표 프리뷰";

  root.innerHTML = `
    <section class="garage-hero" aria-label="MY CAR Garage" data-garage-stage>
      <div class="garage-hero-copy">
        <span class="garage-eyebrow">${heroEyebrow}</span>
        <h3>${heroTitle}</h3>
        <p>${heritageOwned
          ? `${state.profile.nickname} · ${state.profile.plate}`
          : `현재 차량 ${progression.currentTier.label} · 성장 목표 미리보기`}</p>
        <div class="garage-level-row">
          <b>LV.${level}</b>
          <div class="garage-exp"><i style="width:${xp}%"></i></div>
          <span>${xp}%</span>
        </div>
      </div>
      <div class="garage-current-vehicle" data-current-vehicle-tier="${progression.currentTier.id}">
        <span>${vehicle.emoji}</span>
        <div><small>CURRENT VEHICLE</small><b>${progression.currentTier.label}</b><em>${vehicle.name}</em></div>
      </div>
      <div class="garage-score"><small>VEHICLE SCORE</small><strong>${score}</strong></div>
      <button type="button" class="garage-light-toggle" data-garage-light-toggle aria-pressed="false">
        <b>◉</b><span>LIGHTS OFF</span>
      </button>
      ${vehicleImage(activeView)}
      <div class="garage-stage-glow" aria-hidden="true"></div>
      <button type="button" class="garage-auto-control" data-garage-auto aria-pressed="true">
        <b>■</b><span>STOP</span>
      </button>
    </section>

    ${viewSelector(activeView)}

    <section class="garage-stat-grid" aria-label="차량 상태">
      <article><small>이번 주 주행</small><b>${mileage.toLocaleString("ko-KR")} km</b></article>
      <article><small>연료</small><b>${fuel}%</b><i><span style="width:${fuel}%"></span></i></article>
      <article><small>배터리</small><b>${battery}%</b><i><span style="width:${battery}%"></span></i></article>
      <article><small>현재 등급</small><b data-garage-tier>${progression.currentTier.label}</b></article>
    </section>

    <section class="garage-action-grid">
      <button data-garage-action="customize"><span>✦</span><b>Customize</b><small>외관과 파츠</small></button>
      <button data-garage-action="upgrade"><span>▲</span><b>Upgrade</b><small>성능과 레벨</small></button>
      <button data-garage-action="mission"><span>◆</span><b>Mission</b><small>보상과 도전</small></button>
      <button data-garage-action="collection"><span>▦</span><b>Collection</b><small>보유 차량</small></button>
    </section>`;

  root.querySelector('[data-garage-action="upgrade"]').onclick = () => emit("garage:openGrowth");
  root.querySelector('[data-garage-action="mission"]').onclick = () => openRoom("mission");
  root.querySelector('[data-garage-action="customize"]').onclick = () => emit("garage:openCustomize");
  root.querySelector('[data-garage-action="collection"]').onclick = () => openRoom("inventory");
  setVehicleView(root, activeView);
  syncLightLayer(root, state, activeView);
  root.querySelector("[data-garage-light-toggle]").onclick = () => {
    if (normalizeView(state.garageView) !== "front_45") return;
    state.garageLightsOn = state.garageLightsOn !== true;
    syncLightLayer(root, state, "front_45");
    emit("state:save");
  };
  root.querySelectorAll("[data-garage-view]").forEach(button => {
    button.onclick = () => {
      state.garageView = setVehicleView(root, button.dataset.garageView);
      syncLightLayer(root, state, state.garageView);
      emit("state:save");
      startGarageAuto(root, state);
    };
  });
  const autoButton = root.querySelector("[data-garage-auto]");
  autoButton.onpointerdown = event => event.stopPropagation();
  autoButton.onclick = event => {
    event.stopPropagation();
    state.garageAutoRotate = state.garageAutoRotate === false;
    syncGarageAutoControl(root, state);
    emit("state:save");
    startGarageAuto(root, state);
  };
  bindGarageRotation(root, state, () => startGarageAuto(root, state));
  startGarageAuto(root, state);
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
    <div class="garage-empty-card">
      <span>◆</span><h3>Mission</h3>
      <p>미션 진행·보상·레벨 성장은 PLAY에서 한 번만 관리합니다.</p>
      <small>Garage는 내 차량과 장착 상태를 관리합니다.</small>
      <button type="button" class="primary" id="openPlayFromGarage">게임 · PLAY 열기</button>
    </div>`;
  root.querySelector("#openPlayFromGarage").onclick = () => emit("garage:openGrowth");
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
  stopGarageAutoTimer();
  const validRooms = new Set(["garage", "inventory", "mission", "friends", "record"]);
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
    const activeRoom = validRooms.has(room) ? room : "garage";
    state.garageRoom = activeRoom;
    panel.querySelectorAll("[data-room]").forEach(button => {
      button.classList.toggle("active", button.dataset.room === activeRoom);
    });
    if (activeRoom !== "garage") stopGarageAutoTimer();
    if (activeRoom === "inventory") renderInventory(content);
    else if (activeRoom === "mission") renderMission(content);
    else if (activeRoom === "friends") renderFriends(content, state);
    else if (activeRoom === "record") renderRecord(content, state);
    else renderOverview(content, state, state.garageView, renderRoom);
    emit("state:save");
  };

  panel.querySelectorAll("[data-room]").forEach(button => {
    button.onclick = () => renderRoom(button.dataset.room);
  });
  renderRoom(state.garageRoom);
}

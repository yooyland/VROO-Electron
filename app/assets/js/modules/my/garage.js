import {
  ensureMyGarage,
  getSelectedVehicle,
  getActiveVehicle,
  setActiveVehicle,
  nextVehicleIndex,
  previewCustomization,
  userSummary,
  POSTER_ABILITY_KEYS,
  GARAGE_THEMES,
  setGarageTheme,
  vehicleDisplayName,
  formatKm,
  expProgressPct,
  escapeHtml
} from "./my-data.js";
import { vehiclePremiumSvg } from "./vehicle-premium-svg.js";
import { runCarPresenceSequence } from "./garage-interact.js";
import {
  mountGarageStage,
  runGarageStagePresence,
  disposeGarageStage,
  garageStageAvailable
} from "./garage-stage.js";
import { mountCharacterHero, clearCharacterHost } from "./character-adapter.js";
import { emit } from "../../core/events.js";
import { formatCredits } from "../../core/storage.js";
import { showSystemMessage } from "../../core/ui.js";

let activeSeq = null;
let using3d = false;
let usingCharacter = false;

function starsHtml(score, label = "Score") {
  const n = Math.max(0, Math.min(5, Number(score) || 0));
  let out = "";
  for (let i = 1; i <= 5; i++) {
    out += `<span class="my-star ${i <= n ? "on" : ""}" aria-hidden="true"></span>`;
  }
  return `<div class="my-stars" aria-label="${escapeHtml(label)} ${n} of 5">${out}</div>`;
}

function raceBar(pct, opts = {}) {
  const n = Math.max(0, Math.min(100, Number(pct) || 0));
  const showPct = opts.showPct !== false;
  return `<div class="my-race-bar" role="progressbar" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="100">
    <div class="my-race-fill" style="width:${n}%"></div>
    <div class="my-race-rest" aria-hidden="true"></div>
  </div>${showPct ? `<span class="my-race-pct">${n}%</span>` : ""}`;
}

function abilityGrade(n) {
  if (n >= 90) return "S";
  if (n >= 80) return "A";
  if (n >= 70) return "B";
  if (n >= 55) return "C";
  return "D";
}

function abilityStars(n) {
  const s = Math.max(1, Math.min(5, Math.round(n / 20)));
  return starsHtml(s, "Ability");
}

function abilityRows(abilities) {
  return POSTER_ABILITY_KEYS.map(([key, label]) => {
    const n = Math.max(0, Math.min(99, Number(abilities?.[key]) || 0));
    const g = abilityGrade(n);
    const glowClass = g === "S" ? "is-grade-s" : "";
    const barGlow = g === "S" ? "my-race-bar--glow" : "";
    return `<div class="my-ability-tile ${glowClass}">
      <div class="my-ability-tile-top">
        <span class="my-ability-label">${escapeHtml(label)}</span>
        <span class="my-ability-grade-badge grade-${g}">${g}</span>
      </div>
      <div class="my-ability-tile-mid">
        <b class="my-ability-num">${n}</b>
        ${abilityStars(n)}
      </div>
      <div class="my-race-bar my-race-bar--gold ${barGlow}" aria-hidden="true">
        <div class="my-race-fill" style="width:${n}%"></div>
        <div class="my-race-rest"></div>
      </div>
    </div>`;
  }).join("");
}

/** UI-only mock percentile — NOT server ranking. Local display sample. */
function mockScoreTopPct(pts) {
  const n = Math.max(0, Math.min(100, Number(pts) || 0));
  // local heuristic for presentation only (server 연동 전)
  if (n >= 95) return 3;
  if (n >= 90) return 7;
  if (n >= 80) return 12;
  if (n >= 70) return 22;
  if (n >= 60) return 35;
  return 48;
}

function themeRoomsHtml(activeId) {
  return `<section class="garage-background-section my-theme-rooms" aria-label="Garage Background">
    <div class="my-theme-rooms-head">
      <b>Garage Background</b>
      <span class="muted">차고 배경을 선택하면 분위기가 바뀝니다</span>
    </div>
    <div class="my-theme-rail">
      ${GARAGE_THEMES.map(
        (t) => `<button type="button" class="my-theme-room ${activeId === t.id ? "active" : ""}" data-garage-theme="${t.id}" data-theme="${t.id}" aria-pressed="${activeId === t.id ? "true" : "false"}">
          <span class="my-theme-preview my-theme-swatch" aria-hidden="true"></span>
          <span class="my-theme-check" aria-hidden="true">✓</span>
          <span class="my-theme-room-body">
            <span class="my-theme-name">${escapeHtml(t.label)}</span>
            <span class="muted my-theme-blurb">${escapeHtml(t.blurb)}</span>
          </span>
        </button>`
      ).join("")}
    </div>
  </section>`;
}

function scoreLabel(pts) {
  if (pts >= 90) return "Excellent";
  if (pts >= 75) return "Great";
  if (pts >= 60) return "Good";
  return "Fair";
}

function vitalLabel(pct) {
  if (pct >= 90) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 40) return "Fair";
  return "Low";
}

function roomGo(refresh, state, id) {
  state.myGarage.activeMyView = id;
  emit("state:save");
  refresh();
}

/**
 * 포스터형 Garage — Hero · 테마 · 차량 Presence 시퀀스
 */
export function renderGarageView(host, state, refresh) {
  ensureMyGarage(state);
  const v = getSelectedVehicle(state);
  const active = getActiveVehicle(state);
  if (!v) {
    host.innerHTML = `<div class="card muted">Garage에 표시할 차량이 없습니다.</div>`;
    return;
  }
  const custom = previewCustomization(v, state.myGarage.customDraft);
  const isActive = active?.id === v.id;
  const cam = state.myGarage.garageCameraPreset || "default";
  const theme = state.myGarage.garageTheme || "luxury";
  const title = vehicleDisplayName(v);
  const titleParts = String(title).split(/\s+/);
  const titleBrand = titleParts[0] || "VROO";
  const titleModel = titleParts.slice(1).join(" ") || title;
  const expPct = expProgressPct(v);
  const expNow = Math.max(0, Number(v.exp) || 0);
  const expNext = Math.max(1, Number(v.expToNext) || 100);
  const abilities = v.abilities || {};
  const scorePts = Math.max(0, Math.min(100, Number(v.vehicleScorePoints) || 0));
  const topPct = mockScoreTopPct(scorePts);
  const conditionStars = Math.max(1, Math.min(5, Math.round((Number(v.condition) || 80) / 20)));
  const fuel = Number(v.fuelLevel) || 0;
  const battery = Number(v.batteryLevel) || 0;
  const energy = Number(v.energy) || 0;
  const owned = ensureMyGarage(state).vehicles.filter((x) => x.owned);
  const carIdx = Math.max(0, owned.findIndex((x) => x.id === v.id));
  const carDots = owned
    .map((_, i) => `<span class="my-car-dot ${i === carIdx ? "is-on" : ""}" aria-hidden="true"></span>`)
    .join("");

  if (activeSeq) {
    activeSeq.cancel();
    activeSeq = null;
  }
  disposeGarageStage();
  using3d = false;

  host.innerHTML = `
    <div class="my-garage-page garage-v2" data-garage-theme="${escapeHtml(theme)}">
      <div class="garage-content-container">
        <section class="garage-hero garage-showroom-hero" data-cam="${escapeHtml(cam)}" data-garage-theme="${escapeHtml(theme)}">
          <div class="garage-hero-info">
            <div class="garage-hero-kicker-row">
              <span class="my-kicker">MY GARAGE</span>
              <span class="my-rarity-pill grade-${escapeHtml(v.grade || v.rarity || "common")}">${escapeHtml(v.rarityLabel || "Common")}</span>
            </div>
            <h2 class="garage-hero-title">
              <span class="garage-hero-brand">${escapeHtml(titleBrand)}</span>
              <span class="garage-hero-model">${escapeHtml(titleModel)}</span>
            </h2>
            <div class="garage-hero-meta">
              <span>LV.${v.level}</span>
              <span>${formatKm(v.mileage)} km</span>
              <span>Vehicle Score ${scorePts}</span>
            </div>
            <div class="garage-hero-status-row">
              ${starsHtml(v.score || conditionStars, "Vehicle")}
              ${isActive ? '<span class="my-badge-active">사용 중</span>' : ""}
            </div>
            <p class="garage-hero-hint">탭하면: 확대 → 회전 → 문 → 라이트 → 경적 → 엔진</p>
            <div class="garage-hero-exp">
              <div class="garage-hero-exp-top">
                <span class="my-exp-label">EXP</span>
                <span class="garage-hero-exp-vals">${expNow.toLocaleString("ko-KR")} / ${expNext.toLocaleString("ko-KR")}</span>
              </div>
              <div class="my-race-bar my-race-bar--gold my-race-bar--glow" role="progressbar" aria-valuenow="${expPct}" aria-valuemin="0" aria-valuemax="100">
                <div class="my-race-fill" style="width:${expPct}%"></div>
              </div>
            </div>
            <button type="button" class="garage-reward-btn" data-my-go="missions">보상 보기</button>
          </div>

          <div class="garage-showroom vehicle-stage" id="myCarStage">
            <div class="garage-showroom-fx" aria-hidden="true">
              <span class="showroom-light-beam showroom-light-beam--1"></span>
              <span class="showroom-light-beam showroom-light-beam--2"></span>
              <span class="showroom-light-beam showroom-light-beam--3"></span>
              <span class="showroom-light-beam showroom-light-beam--4"></span>
              <span class="showroom-light-beam showroom-light-beam--5"></span>
              <span class="showroom-haze"></span>
            </div>
            <div class="showroom-platform" aria-hidden="true">
              <div class="showroom-platform-ring"></div>
              <div class="showroom-platform-disc"></div>
              <div class="vehicle-reflection"></div>
            </div>
            <div class="showroom-vehicle-layer">
              <div class="my-garage-stage-host vehicle-render" id="myGarage3d"></div>
              <div class="my-character-host" id="myCharacterHost" hidden aria-label="Character vehicle"></div>
              <div class="my-car-svg-fallback" id="myCarSvgFallback">
                <button type="button" class="my-car-figure my-car-hit" id="myCarHit" aria-label="차량 체험 시작">
                  ${vehiclePremiumSvg(v.catalogType, custom.bodyColor || "#1a1f28")}
                </button>
              </div>
              <button type="button" class="my-stage-hit" id="myStageHit" aria-label="차량 체험 시작"></button>
            </div>
            <div class="my-seq-label" id="mySeqLabel" hidden></div>
            <div class="garage-hero-controls">
              <button type="button" class="garage-nav-btn" id="myPrevCar" aria-label="이전 차량">‹</button>
              <div class="my-car-dots" aria-label="차량 ${carIdx + 1} / ${owned.length || 1}">${carDots || '<span class="my-car-dot is-on"></span>'}</div>
              <button type="button" class="garage-nav-btn" id="myNextCar" aria-label="다음 차량">›</button>
            </div>
            <button type="button" class="garage-nav-btn garage-nav-btn--present garage-zoom-btn" id="myZoomCar" aria-label="확대 보기">
              <span class="garage-zoom-ico" aria-hidden="true"></span>
              <span>확대 보기</span>
            </button>
          </div>
        </section>

        <section class="vehicle-status-summary garage-status-cards" aria-label="차량 상태 요약">
          <div class="vss-item vss-item--score">
            <span class="vss-ico vss-ico--score" aria-hidden="true"></span>
            <span class="vss-label">Vehicle Score</span>
            <b class="vss-value">${scorePts}</b>
            <span class="vss-sub">${scoreLabel(scorePts)} · Top ${topPct}%</span>
            ${starsHtml(Math.round(scorePts / 20), "Score")}
          </div>
          <div class="vss-item">
            <span class="vss-ico vss-ico--fuel" aria-hidden="true"></span>
            <span class="vss-label">Fuel</span>
            <b class="vss-value">${fuel}%</b>
            <span class="vss-sub">${vitalLabel(fuel)}</span>
            <div class="my-race-bar my-race-bar--gold"><div class="my-race-fill" style="width:${fuel}%"></div></div>
          </div>
          <div class="vss-item">
            <span class="vss-ico vss-ico--battery" aria-hidden="true"></span>
            <span class="vss-label">Battery</span>
            <b class="vss-value">${battery}%</b>
            <span class="vss-sub">${vitalLabel(battery)}</span>
            <div class="my-race-bar my-race-bar--gold"><div class="my-race-fill" style="width:${battery}%"></div></div>
          </div>
          <div class="vss-item">
            <span class="vss-ico vss-ico--condition" aria-hidden="true"></span>
            <span class="vss-label">Condition</span>
            <b class="vss-value">${conditionStars}/5</b>
            ${starsHtml(conditionStars, "Condition")}
          </div>
          <div class="vss-item">
            <span class="vss-ico vss-ico--energy" aria-hidden="true"></span>
            <span class="vss-label">Energy</span>
            <b class="vss-value">${energy}%</b>
            <div class="my-race-bar my-race-bar--gold"><div class="my-race-fill" style="width:${energy}%"></div></div>
          </div>
          <div class="vss-item">
            <span class="vss-ico vss-ico--exp" aria-hidden="true"></span>
            <span class="vss-label">EXP</span>
            <b class="vss-value">${expPct}%</b>
            <div class="my-race-bar my-race-bar--gold"><div class="my-race-fill" style="width:${expPct}%"></div></div>
          </div>
        </section>
        <p class="muted my-disclaimer garage-disclaimer">디지털 성장 지표 · 실제 차량 성능이 아닙니다</p>

        <section class="my-drive-strip garage-drive-summary" aria-label="주행 요약">
          <div class="garage-drive-cell"><span class="muted">오늘 운행</span><b>${formatKm(v.todayMileage)} km</b></div>
          <div class="garage-drive-cell"><span class="muted">이번 주</span><b>${formatKm(v.weekMileage)} km</b></div>
          <div class="garage-drive-cell"><span class="muted">총 주행</span><b>${formatKm(v.mileage)} km</b></div>
          <button type="button" class="garage-upgrade-cta" data-my-go="upgrade">
            <span>차량 업그레이드</span>
            <span class="garage-upgrade-cta-chevron" aria-hidden="true">›</span>
          </button>
        </section>

        <section class="garage-actions my-room-grid" aria-label="Garage actions">
          <button type="button" class="my-room-tile my-room-tile--custom" data-my-go="custom">
            <span class="my-room-art" aria-hidden="true">${roomArt("custom")}</span>
            <span class="my-room-tile-copy"><b>Customize</b><span class="muted">외관 · 휠 · 번호판</span></span>
            <span class="my-room-chevron" aria-hidden="true">›</span>
          </button>
          <button type="button" class="my-room-tile my-room-tile--upgrade" data-my-go="upgrade">
            <span class="my-room-art" aria-hidden="true">${roomArt("upgrade")}</span>
            <span class="my-room-tile-copy"><b>Upgrade</b><span class="muted">레벨 · 성능 미리보기</span></span>
            <span class="my-room-chevron" aria-hidden="true">›</span>
          </button>
          <button type="button" class="my-room-tile my-room-tile--mission" data-my-go="missions">
            <span class="my-room-art" aria-hidden="true">${roomArt("missions")}</span>
            <span class="my-room-tile-copy"><b>Mission</b><span class="muted">일일 · 주간 성장</span></span>
            <span class="my-room-chevron" aria-hidden="true">›</span>
          </button>
          <button type="button" class="my-room-tile my-room-tile--collection" data-my-go="collection">
            <span class="my-room-art" aria-hidden="true">${roomArt("collection")}</span>
            <span class="my-room-tile-copy"><b>Collection</b><span class="muted">보유 차량 차고</span></span>
            <span class="my-room-chevron" aria-hidden="true">›</span>
          </button>
        </section>

        ${themeRoomsHtml(theme)}

        <section class="card my-ability-card">
          <div class="my-ability-grid">${abilityRows(abilities)}</div>
        </section>

        <footer class="my-garage-actions my-garage-actions-premium">
          ${
            isActive
              ? `<button type="button" class="primary" disabled>사용 중</button>`
              : v.owned
                ? `<button type="button" class="primary" id="myActSetActive">대표 차량으로 설정</button>`
                : `<button type="button" class="secondary" disabled>미보유</button>`
          }
          <button type="button" class="secondary" data-my-go="accessory">Accessories</button>
          <button type="button" class="secondary" id="myActDetail">상세</button>
        </footer>
      </div>
    </div>`;

  const stage = host.querySelector("#myCarStage");
  const seqLabel = host.querySelector("#mySeqLabel");
  const stage3d = host.querySelector("#myGarage3d");
  const svgFallback = host.querySelector("#myCarSvgFallback");
  const characterHost = host.querySelector("#myCharacterHost");
  using3d = false;
  usingCharacter = false;

  const startPresence = () => {
    if (seqLabel) {
      seqLabel.hidden = false;
      seqLabel.textContent = "…";
    }
    const onStep = (_id, label) => {
      if (seqLabel) seqLabel.textContent = label;
    };
    const onDone = () => {
      if (seqLabel) {
        seqLabel.textContent = "Ready";
        setTimeout(() => {
          if (seqLabel) seqLabel.hidden = true;
        }, 600);
      }
      activeSeq = null;
    };

    if (using3d) {
      runGarageStagePresence();
      return;
    }
    if (activeSeq) activeSeq.cancel();
    if (!stage) return;
    activeSeq = runCarPresenceSequence(stage, { onStep, onDone });
  };

  const mountLegacyStage = () => {
    clearCharacterHost(characterHost);
    if (garageStageAvailable() && stage3d) {
      using3d = mountGarageStage(stage3d, {
        bodyColor: custom.bodyColor,
        onStep: (_id, label) => {
          if (seqLabel) {
            seqLabel.hidden = false;
            seqLabel.textContent = label;
          }
        },
        onDone: () => {
          if (seqLabel) {
            seqLabel.textContent = "Ready";
            setTimeout(() => {
              if (seqLabel) seqLabel.hidden = true;
            }, 600);
          }
        }
      });
      if (using3d && svgFallback) svgFallback.hidden = true;
    }
  };

  /* Character: 승인+투명+character 만 — 없으면 Three.js/premium */
  const mountToken = v.id;
  void (async () => {
    const ok = await mountCharacterHero(characterHost, v, { requireHeroFlag: true });
    if (getSelectedVehicle(state)?.id !== mountToken) return;
    if (ok) {
      usingCharacter = true;
      using3d = false;
      disposeGarageStage();
      if (stage3d) stage3d.hidden = true;
      if (svgFallback) svgFallback.hidden = true;
      return;
    }
    mountLegacyStage();
  })();

  host.querySelector("#myStageHit")?.addEventListener("click", startPresence);
  host.querySelector("#myCarHit")?.addEventListener("click", startPresence);
  host.querySelector("#myPrevCar").onclick = () => {
    disposeGarageStage();
    clearCharacterHost(characterHost);
    nextVehicleIndex(state, -1);
    emit("state:save");
    refresh();
  };
  host.querySelector("#myNextCar").onclick = () => {
    disposeGarageStage();
    clearCharacterHost(characterHost);
    nextVehicleIndex(state, 1);
    emit("state:save");
    refresh();
  };
  host.querySelector("#myZoomCar").onclick = () => {
    startPresence();
  };
  host.querySelectorAll("[data-garage-theme]").forEach((b) => {
    b.onclick = () => {
      if (!setGarageTheme(state, b.dataset.garageTheme)) return;
      emit("state:save");
      refresh();
    };
  });
  host.querySelector("#myActSetActive")?.addEventListener("click", () => {
    const r = setActiveVehicle(state, v.id);
    if (!r.ok) {
      showSystemMessage("보유한 차량만 대표로 설정할 수 있습니다.");
      return;
    }
    emit("state:save");
    emit("ui:refreshAccount");
    showSystemMessage(`${vehicleDisplayName(r.vehicle)}을(를) 대표 차량으로 설정했습니다.`);
    refresh();
  });
  host.querySelector("#myActDetail")?.addEventListener("click", () => {
    showSystemMessage(
      `${title}\nLV.${v.level} · Score ${scorePts}\n${formatKm(v.mileage)} km\n\n디지털 성장 지표입니다.`
    );
  });
  host.querySelectorAll("[data-my-go]").forEach((b) => {
    b.onclick = () => roomGo(refresh, state, b.dataset.myGo);
  });
}

function roomArt(kind) {
  const base = 'class="my-room-svg" viewBox="0 0 80 56" width="80" height="56" aria-hidden="true"';
  if (kind === "custom") {
    return `<svg ${base}><rect x="8" y="10" width="64" height="36" rx="8" fill="#1a222c" stroke="#c9a22755"/><circle cx="28" cy="28" r="8" fill="#c9a227"/><circle cx="52" cy="28" r="8" fill="#8eb4d4"/><path d="M20 42h40" stroke="#ffffff33" stroke-width="3"/></svg>`;
  }
  if (kind === "upgrade") {
    return `<svg ${base}><path d="M40 8 48 28H32L40 8z" fill="#c9a227"/><rect x="22" y="30" width="36" height="14" rx="3" fill="#243040"/><path d="M40 18v22" stroke="#fff" stroke-width="2"/></svg>`;
  }
  if (kind === "missions") {
    return `<svg ${base}><rect x="18" y="8" width="44" height="40" rx="6" fill="#1c2836" stroke="#5cffd744"/><path d="m30 28 6 6 14-14" stroke="#5cffd7" stroke-width="3" fill="none"/><rect x="26" y="12" width="28" height="6" rx="2" fill="#c9a22766"/></svg>`;
  }
  return `<svg ${base}><rect x="10" y="12" width="26" height="20" rx="3" fill="#c9a22755"/><rect x="44" y="12" width="26" height="20" rx="3" fill="#8eb4d455"/><rect x="10" y="36" width="26" height="12" rx="3" fill="#7dba7a44"/><rect x="44" y="36" width="26" height="12" rx="3" fill="#ff6a3d44"/></svg>`;
}

export function renderGarageHeaderMeta(state) {
  const summary = userSummary(state);
  const v = getActiveVehicle(state);
  const g = ensureMyGarage(state);
  // todayEarnedCoins: local UI sample only — hide when missing/zero
  const todayEarn = Number(g.todayEarnedCoins ?? state.todayEarnedCoins);
  const todayHtml =
    Number.isFinite(todayEarn) && todayEarn > 0
      ? `<span class="my-head-chip my-head-chip--today">+${formatCredits(todayEarn)} Today</span>`
      : "";
  return {
    vehicle: vehicleDisplayName(v) || "Vehicle",
    rightHtml: `
      <span class="my-head-chip">${formatCredits(summary.credits)} Coins</span>
      ${todayHtml}
      <span class="my-head-chip">Garage Lv.${v?.level ?? summary.level}</span>`
  };
}

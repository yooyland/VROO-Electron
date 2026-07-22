import {carInfo, MY_USER_ID} from "./data.js";
import {getUsers} from "./map.js";
import {getAllGrids} from "./grid.js";
import {emit} from "../core/events.js";
import {openModal, closeModal, showSystemMessage} from "../core/ui.js";
import {
  PLATE_REVEAL_COST,
  formatCredits,
  canAfford,
  spendCredits
} from "../core/storage.js";
import {playHornThrottled} from "./sound.js";

let plateBusy = false;
let detailBoundUserId = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeQuery(q) {
  return String(q || "").trim().toLowerCase();
}

function haversineMeters(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const r = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
}

export function maskPlate(plate) {
  const p = String(plate || "").trim();
  if (!p) return "번호판 미등록";
  const m = p.match(/^(.+?)\s+(\d{3,4})$/);
  if (m) return `${m[1]} ••••`;
  if (p.length <= 4) return "••••";
  return `${p.slice(0, Math.max(2, p.length - 4))}••••`;
}

function ensureRevealedList(state) {
  if (!Array.isArray(state.revealedPlateUserIds)) state.revealedPlateUserIds = [];
  state.revealedPlateUserIds = [...new Set(state.revealedPlateUserIds.map(String).filter(Boolean))];
  return state.revealedPlateUserIds;
}

export function isPlateRevealed(state, userId) {
  if (!userId || userId === MY_USER_ID) return true;
  return ensureRevealedList(state).includes(String(userId));
}

export function displayPlate(state, user) {
  if (!user) return "번호판 미등록";
  if (user.id === MY_USER_ID) return String(user.plate || state.profile?.plate || "").trim() || "번호판 미등록";
  if (user.platePublic === false && !isPlateRevealed(state, user.id)) {
    return "비공개";
  }
  const raw = String(user.plate || "").trim();
  if (!raw) return "번호판 미등록";
  if (isPlateRevealed(state, user.id)) return raw;
  return maskPlate(raw);
}

function liveUserById(userId, fallback) {
  if (!userId) return null;
  if (userId === MY_USER_ID) return null;
  return getUsers().find(u => u && u.id === userId) || (fallback?.id === userId ? fallback : null);
}

function userGridNames(state, userId) {
  try {
    return getAllGrids(state)
      .filter(g => Array.isArray(g.memberIds) && g.memberIds.includes(userId))
      .map(g => g.name)
      .slice(0, 4);
  } catch {
    return [];
  }
}

function matchesQuery(user, query) {
  if (!query) return true;
  const car = carInfo(user.car);
  const hay = [user.nickname, user.plate, car.name, car.id, user.id]
    .map(v => normalizeQuery(v))
    .join(" ");
  return hay.includes(query);
}

function listNearbyUsers(state, query) {
  const q = normalizeQuery(query);
  const me = state.location;
  const seen = new Set();
  const rows = [];
  for (const u of getUsers()) {
    if (!u?.id || u.id === MY_USER_ID) continue;
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    if (!matchesQuery(u, q)) continue;
    const dist = haversineMeters(me, u);
    rows.push({user: u, dist});
  }
  const hasDist = rows.some(r => r.dist != null);
  if (hasDist) {
    rows.sort((a, b) => {
      if (a.dist == null && b.dist == null) return 0;
      if (a.dist == null) return 1;
      if (b.dist == null) return -1;
      return a.dist - b.dist;
    });
  }
  return rows;
}

export function renderNearby(panel, state) {
  const query = panel.querySelector("#nearbySearch")?.value || "";
  const rows = listNearbyUsers(state, query);
  const listHtml = rows.length
    ? rows
        .map(({user: u, dist}) => {
          const car = carInfo(u.car);
          const plateHint = isPlateRevealed(state, u.id) ? "번호판 공개" : "번호판 숨김";
          const distLabel = formatDistance(dist);
          return `<div class="card user-row" data-open-user="${escapeHtml(u.id)}">
            <div class="avatar">${car.emoji}</div>
            <div>
              <b>${escapeHtml(u.nickname)}</b>
              <div class="muted">
                <span class="status-dot ${u.online ? "online" : "offline"}"></span>
                ${u.online ? "온라인" : "오프라인"} · ${escapeHtml(car.name)} · Lv.${u.level}
                ${distLabel ? ` · ${distLabel}` : ""}
              </div>
              <div class="muted">${plateHint} · ${escapeHtml(displayPlate(state, u))}</div>
            </div>
            <button class="primary" data-open-user-btn="${escapeHtml(u.id)}" type="button">보기</button>
          </div>`;
        })
        .join("")
    : '<div class="card muted">검색 결과가 없습니다.</div>';

  panel.innerHTML = `<div class="tabs">
      <button type="button" class="active" data-nearby-tab="friends">주변 친구</button>
      <button type="button" data-nearby-tab="poi">편의시설</button>
      <button type="button" data-nearby-tab="fav">자주가는 곳</button>
      <button type="button" data-nearby-tab="pins">등록지점</button>
    </div>
    <div class="card nearby-search-card">
      <b>내 주변 차량</b>
      <input id="nearbySearch" class="nearby-search" type="search" placeholder="닉네임 · 차종 · 번호판 검색" value="${escapeHtml(query)}">
      <div class="muted">실제 서비스에서는 서버의 실시간 위치를 표시합니다.</div>
    </div>
    <div id="nearbyList">${listHtml}</div>`;

  const search = panel.querySelector("#nearbySearch");
  let searchTimer = 0;
  search?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderNearby(panel, state), 160);
  });

  panel.querySelectorAll("[data-nearby-tab]").forEach(btn => {
    btn.onclick = () => {
      panel.querySelectorAll("[data-nearby-tab]").forEach(b => b.classList.toggle("active", b === btn));
      if (btn.dataset.nearbyTab !== "friends") {
        showSystemMessage("이 탭은 다음 버전에서 연결됩니다.");
      }
    };
  });

  const open = id => emit("user:open", {id});
  panel.querySelectorAll("[data-open-user-btn]").forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      open(b.dataset.openUserBtn);
    };
  });
  panel.querySelectorAll("[data-open-user]").forEach(row => {
    row.onclick = e => {
      if (e.target.closest("button")) return;
      open(row.dataset.openUser);
    };
  });
}

/**
 * 다른 사용자 차량 상세 (MY PAGE와 구분)
 * payload: user 객체 또는 { id }
 */
export function openUserDetail(state, payload) {
  const userId =
    typeof payload === "string"
      ? payload
      : payload?.id || payload?.userId || "";
  if (!userId || userId === MY_USER_ID) {
    emit("mypage:open");
    return;
  }

  const live = liveUserById(userId, typeof payload === "object" ? payload : null);
  if (!live) {
    showSystemMessage("차량 정보를 찾을 수 없습니다.");
    return;
  }

  detailBoundUserId = userId;
  plateBusy = false;
  renderDetailModal(state, live);
}

function renderDetailModal(state, userSnap) {
  const user = liveUserById(userSnap.id, userSnap) || userSnap;
  const car = carInfo(user.car);
  const revealed = isPlateRevealed(state, user.id);
  const plateText = displayPlate(state, user);
  const dist = formatDistance(haversineMeters(state.location, user));
  const grids = userGridNames(state, user.id);
  const canReveal =
    !revealed &&
    user.platePublic !== false &&
    String(user.plate || "").trim();

  const body = `<div class="card row">
      <div class="avatar" style="font-size:70px">${car.emoji}</div>
      <div>
        <h3>${escapeHtml(user.nickname)}</h3>
        <div class="muted">${escapeHtml(car.name)} · Lv.${user.level}</div>
        <div class="muted"><span class="status-dot ${user.online ? "online" : "offline"}"></span> ${user.online ? "온라인" : "오프라인"}${dist ? ` · ${dist}` : ""}</div>
      </div>
    </div>
    <div class="card">
      <b>번호판</b>
      <div id="detailPlateValue" style="margin-top:6px;font-size:18px;font-weight:900">${escapeHtml(plateText)}</div>
      <div class="muted" style="margin-top:6px">${revealed ? "확인됨" : canReveal ? `확인 비용 🪙 ${formatCredits(PLATE_REVEAL_COST)}` : user.platePublic === false ? "상대가 번호판을 비공개로 설정했습니다." : "번호판 미등록"}</div>
    </div>
    ${
      grids.length
        ? `<div class="card"><b>GRID</b><div class="muted" style="margin-top:6px">${grids.map(escapeHtml).join(" · ")}</div></div>`
        : ""
    }
    <div class="card muted">빵빵은 데모 피드백입니다. 상대 기기로 전달되지 않습니다.</div>`;

  const actions = [{label: "닫기", onClick: closeModal}];

  if (canReveal) {
    actions.push({
      label: `번호판 확인 · ${formatCredits(PLATE_REVEAL_COST)}`,
      className: "secondary",
      onClick: () => revealPlate(state, user.id)
    });
  }

  actions.push({
    label: "빵빵",
    className: "secondary",
    onClick: () => {
      if (detailBoundUserId !== user.id) return;
      const played = playHornThrottled(state.hornEnabled !== false);
      if (played) showSystemMessage(`빵빵 · ${user.nickname} (데모)`);
    }
  });

  actions.push({
    label: "1:1 대화",
    className: "primary",
    onClick: () => {
      if (detailBoundUserId !== user.id) return;
      closeModal();
      const fresh = liveUserById(user.id, user) || user;
      emit("chat:open", fresh);
    }
  });

  openModal("차량 상세", body, actions);
}

function revealPlate(state, userId) {
  if (plateBusy) return;
  if (detailBoundUserId !== userId) return;
  if (isPlateRevealed(state, userId)) {
    showSystemMessage("이미 확인한 번호판입니다.");
    return;
  }

  const live = liveUserById(userId);
  if (!live || !String(live.plate || "").trim()) {
    showSystemMessage("번호판 정보가 없습니다.");
    return;
  }
  if (live.platePublic === false) {
    showSystemMessage("상대가 번호판을 비공개로 설정했습니다.");
    return;
  }

  if (!canAfford(state, PLATE_REVEAL_COST)) {
    showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(PLATE_REVEAL_COST)})`);
    return;
  }

  plateBusy = true;
  const paid = spendCredits(state, PLATE_REVEAL_COST);
  if (!paid.ok) {
    plateBusy = false;
    showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(PLATE_REVEAL_COST)})`);
    return;
  }

  ensureRevealedList(state);
  if (!state.revealedPlateUserIds.includes(userId)) {
    state.revealedPlateUserIds.push(userId);
  }
  emit("state:save");
  plateBusy = false;
  showSystemMessage("번호판을 확인했습니다.");
  renderDetailModal(state, live);
}

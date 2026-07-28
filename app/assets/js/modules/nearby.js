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
import {
  getVehicleConversationStatus,
  getUnreadSummary,
  ensureNearbyChat,
  openConversationInChat,
  ensureConversationUi
} from "./conversation-store.js";
import {VROO_PLACES, normalizePlaceMeta, categoryLabel, categorySvg} from "./places.js";

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

function renderNearbyPlaces(panel, state, activeTab) {
  const registered = Array.isArray(state.registeredPlaces) ? state.registeredPlaces : [];
  const allPlaces = [
    ...VROO_PLACES.map(normalizePlaceMeta).filter(Boolean),
    ...registered.map(normalizePlaceMeta).filter(Boolean)
  ];
  const favoriteIds = new Set(
    Array.isArray(state.favoritePlaceIds) ? state.favoritePlaceIds.map(String) : []
  );
  const list =
    activeTab === "fav"
      ? allPlaces.filter((p) => favoriteIds.has(String(p.id)))
      : activeTab === "pins"
        ? allPlaces.filter((p) => String(p.id).startsWith("pin-"))
        : allPlaces.filter((p) => p.kind === "place" || p.kind === "landmark");
  const title =
    activeTab === "fav" ? "자주가는 곳" : activeTab === "pins" ? "등록지점" : "주변 편의시설";
  const empty =
    activeTab === "fav"
      ? "아직 저장한 자주가는 곳이 없습니다."
      : activeTab === "pins"
        ? "등록지점이 없습니다. 현재 위치를 등록해 보세요."
        : "표시할 편의시설이 없습니다.";
  const rows = list.length
    ? list.map((p) => `<div class="card user-row nearby-place-row">
        <div class="avatar">${categorySvg(p.category)}</div>
        <div>
          <b>${escapeHtml(p.name)}</b>
          <div class="muted">${escapeHtml(categoryLabel(p.category))} · ${escapeHtml(p.subtitle || "등록 장소")}</div>
        </div>
        <div class="convo-actions">
          <button type="button" class="primary" data-place-view="${escapeHtml(p.id)}">지도 보기</button>
          <button type="button" class="secondary" data-place-favorite="${escapeHtml(p.id)}" aria-label="즐겨찾기">${favoriteIds.has(String(p.id)) ? "★" : "☆"}</button>
        </div>
      </div>`).join("")
    : `<div class="card muted">${empty}</div>`;

  panel.innerHTML = `<div class="tabs">
      <button type="button" data-nearby-tab="friends">주변 차량</button>
      <button type="button" class="${activeTab === "poi" ? "active" : ""}" data-nearby-tab="poi">편의시설</button>
      <button type="button" class="${activeTab === "fav" ? "active" : ""}" data-nearby-tab="fav">자주가는 곳</button>
      <button type="button" class="${activeTab === "pins" ? "active" : ""}" data-nearby-tab="pins">등록지점</button>
    </div>
    <div class="card nearby-search-card">
      <b>${title}</b>
      <div class="muted">VROO 지명과 사용자가 저장한 위치를 지도와 연결합니다.</div>
      ${activeTab === "pins" ? '<div class="convo-actions" style="margin-top:8px"><button type="button" class="primary" id="registerCurrentPlace">현재 위치 등록</button></div>' : ""}
    </div>
    <div id="nearbyList">${rows}</div>`;

  panel.querySelectorAll("[data-nearby-tab]").forEach((btn) => {
    btn.onclick = () => {
      state.nearbyTab = btn.dataset.nearbyTab;
      emit("state:save");
      renderNearby(panel, state);
    };
  });
  panel.querySelectorAll("[data-place-view]").forEach((btn) => {
    btn.onclick = () => {
      const place = allPlaces.find((p) => String(p.id) === btn.dataset.placeView);
      if (place) emit("place:focus", place);
    };
  });
  panel.querySelectorAll("[data-place-favorite]").forEach((btn) => {
    btn.onclick = () => {
      const place = allPlaces.find((p) => String(p.id) === btn.dataset.placeFavorite);
      if (place) emit("place:toggleFavorite", place);
    };
  });
  panel.querySelector("#registerCurrentPlace")?.addEventListener("click", () => {
    const lat = Number(state.location?.lat);
    const lng = Number(state.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showSystemMessage("현재 위치를 확인할 수 없습니다.");
      return;
    }
    if (!Array.isArray(state.registeredPlaces)) state.registeredPlaces = [];
    state.registeredPlaces.push({
      id: `pin-${Date.now()}`,
      name: `내 등록지점 ${state.registeredPlaces.length + 1}`,
      subtitle: "현재 위치에서 등록",
      kind: "place",
      category: "favorite",
      lat,
      lng,
      createdAt: Date.now()
    });
    emit("state:save");
    renderNearbyPlaces(panel, state, "pins");
    showSystemMessage("현재 위치를 등록했습니다.");
  });
}

export function renderNearby(panel, state) {
  ensureNearbyChat(state);
  const activeTab = ["friends", "poi", "fav", "pins"].includes(state.nearbyTab)
    ? state.nearbyTab
    : "friends";
  if (activeTab !== "friends") {
    renderNearbyPlaces(panel, state, activeTab);
    return;
  }
  const query = panel.querySelector("#nearbySearch")?.value || "";
  const rows = listNearbyUsers(state, query);
  const unread = getUnreadSummary(state);
  const listHtml = rows.length
    ? rows
        .map(({user: u, dist}) => {
          const car = carInfo(u.car);
          const plateHint = isPlateRevealed(state, u.id) ? "번호판 공개" : "번호판 숨김";
          const distLabel = formatDistance(dist);
          const st = getVehicleConversationStatus(state, u.id);
          const stLabel =
            st.status === "urgent"
              ? "긴급·주의 공간 메시지"
              : st.status === "unread"
                ? `읽지 않음 ${st.unread}`
                : st.status === "active"
                  ? "대화 중"
                  : st.status === "blocked"
                    ? "차단됨"
                    : "대화 없음";
          const preview =
            st.lastMessage && st.status !== "no_conversation"
              ? `<div class="muted nearby-msg-preview">최근: “${escapeHtml(String(st.lastMessage).slice(0, 40))}”</div>`
              : "";
          return `<div class="card user-row" data-open-user="${escapeHtml(u.id)}">
            <div class="avatar">${car.emoji}</div>
            <div>
              <b>${escapeHtml(u.nickname)}</b>
              <div class="muted">
                <span class="status-dot ${u.online ? "online" : "offline"}"></span>
                ${u.online ? "온라인" : "오프라인"} · ${escapeHtml(car.name)} · Lv.${u.level}
                ${distLabel ? ` · ${distLabel}` : ""}
              </div>
              <div class="muted">${escapeHtml(stLabel)} · ${plateHint}</div>
              ${preview}
            </div>
            <button class="primary" data-open-user-btn="${escapeHtml(u.id)}" type="button">보기</button>
          </div>`;
        })
        .join("")
    : '<div class="card muted">검색 결과가 없습니다.</div>';

  panel.innerHTML = `<div class="tabs">
      <button type="button" class="active" data-nearby-tab="friends">주변 차량</button>
      <button type="button" data-nearby-tab="poi">편의시설</button>
      <button type="button" data-nearby-tab="fav">자주가는 곳</button>
      <button type="button" data-nearby-tab="pins">등록지점</button>
    </div>
    <div class="card nearby-search-card">
      <b>주변 차량 · 지도에서 대화 중</b>
      <div class="muted">주변 대화 미읽음 ${unread.nearby} · 도로 ${unread.road} · 공간 메시지는 지도 배지·선택 미리보기</div>
      <input id="nearbySearch" class="nearby-search" type="search" placeholder="닉네임 · 차종 검색" value="${escapeHtml(query)}">
      <div class="convo-actions" style="margin-top:8px">
        <button type="button" class="secondary" id="openNearbyChatRooms">주변 대화 열기</button>
        <button type="button" class="secondary" id="openRoadChatRooms">도로 대화 열기</button>
      </div>
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
      state.nearbyTab = btn.dataset.nearbyTab;
      emit("state:save");
      renderNearby(panel, state);
    };
  });

  panel.querySelector("#openNearbyChatRooms")?.addEventListener("click", () => {
    const id = ensureNearbyChat(state).session.conversationId;
    const ui = ensureConversationUi(state);
    ui.activeConversationId = id;
    ui.returnView = "near";
    emit("state:save");
    openConversationInChat(id, { returnView: "near" });
  });
  panel.querySelector("#openRoadChatRooms")?.addEventListener("click", () => {
    const id = state.roadChat?.session?.conversationId || "road-session-current";
    const ui = ensureConversationUi(state);
    ui.activeConversationId = id;
    ui.returnView = "near";
    emit("state:save");
    openConversationInChat(id, { returnView: "near" });
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

/** 전체 화면 사이드: 통합 요약 (상세 대화 복제 없음) */
export function renderAllViewSummary(panel, state) {
  ensureNearbyChat(state);
  const unread = getUnreadSummary(state);
  const roadLast = state.roadChat?.messages?.at(-1);
  const nearLast = state.nearbyChat?.messages?.at(-1);
  const urgent = (state.spatialMessageOverlays || []).find((o) => o.spatialPriority === "urgent");
  panel.innerHTML = `
    <div class="card">
      <b>통합 보기</b>
      <div class="muted">지도·도로·공간 대화 현황을 요약합니다. 상세 메시지는 대화방에서 확인하세요.</div>
    </div>
    <div class="card">
      <b>공간 대화 현황</b>
      <div class="muted">도로 ${unread.road} · 주변 ${unread.nearby} · GRID ${unread.grid} · 1:1 ${unread.direct}</div>
      <div class="convo-actions" style="margin-top:8px">
        <button type="button" class="primary" data-go-chat="road-session-current">도로 대화</button>
        <button type="button" class="secondary" data-go-chat="nearby-session-current">주변 대화</button>
        <button type="button" class="secondary" data-go-chat-menu>대화방</button>
      </div>
    </div>
    <div class="card">
      <b>최근 도로 메시지</b>
      <div class="muted">${roadLast ? `“${escapeHtml(String(roadLast.body || roadLast.text || "").slice(0, 80))}”` : "없음"}</div>
    </div>
    <div class="card">
      <b>최근 공간 메시지</b>
      <div class="muted">${nearLast ? `“${escapeHtml(String(nearLast.body || nearLast.text || "").slice(0, 80))}”` : "없음"}</div>
      ${urgent ? `<div class="muted" style="margin-top:6px">주의(공간 표시): “${escapeHtml(String(urgent.body || "").slice(0, 48))}” · 긴급신고 서비스가 아닙니다</div>` : ""}
    </div>`;
  panel.querySelectorAll("[data-go-chat]").forEach((b) => {
    b.onclick = () => openConversationInChat(b.dataset.goChat, { returnView: "all" });
  });
  panel.querySelector("[data-go-chat-menu]")?.addEventListener("click", () => {
    emit("chat:openMenu");
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
  const distM = haversineMeters(state.location, user);
  const dist = formatDistance(distM);
  const myHeading = Number(state.mapBearing) || 0;
  const theirHeading = Number.isFinite(Number(user.heading)) ? Number(user.heading) : null;
  const sameDir =
    theirHeading != null &&
    Math.abs((((theirHeading - myHeading) % 360) + 540) % 360 - 180) < 45;
  const car = carInfo(user.car);
  const revealed = isPlateRevealed(state, user.id);
  const plateText = displayPlate(state, user);
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
        <div class="muted" style="margin-top:4px">${sameDir ? "같은 진행 방향" : "진행 방향 다름 또는 확인 중"}</div>
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
    <div class="card muted">빵빵은 데모 피드백입니다. 상대 기기로 전달되지 않습니다. 정확한 위치 좌표는 메시지에 첨부되지 않습니다.</div>`;

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

  actions.push({
    label: "차단",
    className: "danger",
    onClick: () => {
      if (!Array.isArray(state.blockedUserIds)) state.blockedUserIds = [];
      if (!state.blockedUserIds.includes(user.id)) state.blockedUserIds.push(user.id);
      emit("state:save");
      closeModal();
      showSystemMessage(`${user.nickname} 님을 차단했습니다. (로컬)`);
    }
  });

  actions.push({
    label: "신고",
    className: "secondary",
    onClick: () => {
      showSystemMessage("신고가 접수 대기 상태로 기록됩니다. (서버 연동 전 · 로컬 안내)");
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

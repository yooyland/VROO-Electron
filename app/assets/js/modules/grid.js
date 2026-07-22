import {
  SEED_GRIDS,
  GRID_LEGACY_NAME_TO_ID,
  MY_USER_ID,
  carInfo,
  gridChatRoomId
} from "./data.js";
import {getUsers, focusGridOnMap, refreshSpatialGrids} from "./map.js";
import {emit, on} from "../core/events.js";
import {showSystemMessage, openModal, closeModal} from "../core/ui.js";
import {
  GRID_CREATE_COST,
  formatCredits,
  canAfford,
  spendCredits
} from "../core/storage.js";
import {getGridRoomUnread, refreshChatBadge} from "./chat.js";
import {
  isSpatialGridId,
  getGridBounds,
  getGridDisplayName,
  getGridCellFromLatLng,
  usersInSpatialGrid,
  ACTIVE_GRID_LEVEL,
  GRID_LEVELS,
  resolveToLocalGridId
} from "./spatial-grid.js";

const DEFAULT_CENTER = {lat: 37.5665, lng: 126.978};

let actionBusy = false;
let activePanel = null;
let activeState = null;
let viewingGridId = null;
let viewMode = "list";
let usersListenerBound = false;
let locationListenerBound = false;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueIds(ids) {
  return [...new Set((ids || []).map(String).filter(Boolean))];
}

export function normalizeGrid(raw, fallbackCenter) {
  if (!raw || typeof raw !== "object") return null;
  let id = String(raw.id || "").trim();
  if (!id && raw.name) id = GRID_LEGACY_NAME_TO_ID[raw.name] || "";
  if (!id) return null;

  if (isSpatialGridId(id) || raw.type === "spatial") {
    return buildSpatialGridRecord(id, raw);
  }

  let memberIds = Array.isArray(raw.memberIds)
    ? raw.memberIds.map(String)
    : Array.isArray(raw.members)
      ? raw.members.map(m => (typeof m === "string" ? m : m?.id)).filter(Boolean)
      : [];
  memberIds = uniqueIds(memberIds);
  const ownerId = String(raw.ownerId || (raw.mine ? MY_USER_ID : "vroo"));
  if (!memberIds.includes(ownerId)) memberIds.unshift(ownerId);

  const center =
    raw.center && typeof raw.center === "object"
      ? {
          lat: Number(raw.center.lat) || fallbackCenter?.lat || DEFAULT_CENTER.lat,
          lng: Number(raw.center.lng) || fallbackCenter?.lng || DEFAULT_CENTER.lng
        }
      : {
          lat: fallbackCenter?.lat || DEFAULT_CENTER.lat,
          lng: fallbackCenter?.lng || DEFAULT_CENTER.lng
        };

  return {
    id,
    type: "community",
    name: String(raw.name || raw.title || id),
    ownerId,
    memberIds,
    createdAt: Number(raw.createdAt) || Date.now(),
    center,
    visibility: raw.visibility || "public",
    chatRoomId: raw.chatRoomId || gridChatRoomId(id),
    radiusM: Math.max(200, Number(raw.radiusM) || 800),
    ad: !!raw.ad,
    people: Math.max(memberIds.length, Number(raw.people) || memberIds.length),
    mine: !!raw.mine || ownerId === MY_USER_ID,
    spatialId: raw.spatialId && isSpatialGridId(raw.spatialId) ? raw.spatialId : null
  };
}

/** Spatial 셀 — 필요 시 계산용 레코드 (전국 저장 금지) */
export function buildSpatialGridRecord(gridId, extra = {}) {
  const bounds = getGridBounds(gridId);
  if (!bounds) return null;
  const memberIds = uniqueIds(extra.memberIds || []);
  return {
    id: bounds.id,
    type: "spatial",
    name: getGridDisplayName(bounds.id),
    ownerId: "vroo",
    memberIds,
    createdAt: Number(extra.createdAt) || 0,
    center: {...bounds.center},
    visibility: "public",
    chatRoomId: gridChatRoomId(bounds.id),
    radiusM: bounds.sizeM / 2,
    ad: false,
    people: memberIds.length,
    mine: false,
    level: bounds.level,
    ix: bounds.ix,
    iy: bounds.iy,
    south: bounds.south,
    north: bounds.north,
    west: bounds.west,
    east: bounds.east
  };
}

function offsetSeedCenter(center, id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 97;
  const dLat = ((h % 11) - 5) * 0.004;
  const dLng = ((h % 7) - 3) * 0.004;
  return {lat: center.lat + dLat, lng: center.lng + dLng};
}

function seedWithCenter(state) {
  const center = state?.location || DEFAULT_CENTER;
  return SEED_GRIDS.map(g =>
    normalizeGrid(
      {
        ...g,
        type: "community",
        center: g.id === "g_my" ? {...center} : offsetSeedCenter(center, g.id)
      },
      center
    )
  ).filter(Boolean);
}

/** Community GRID 목록만 (시드 + 사용자 생성) */
export function getAllGrids(state) {
  if (!Array.isArray(state.grids)) state.grids = [];
  const map = new Map();
  for (const g of seedWithCenter(state)) map.set(g.id, g);
  for (const raw of state.grids) {
    const g = normalizeGrid(raw, state.location);
    if (!g || g.type === "spatial") continue;
    map.set(g.id, g);
  }
  return [...map.values()];
}

export function findGrid(state, gridId) {
  if (isSpatialGridId(gridId)) {
    const joinedMembers = (state.spatialMembers && state.spatialMembers[gridId]) || [];
    return buildSpatialGridRecord(gridId, {memberIds: joinedMembers});
  }
  return getAllGrids(state).find(g => g.id === gridId) || null;
}

export function resolveCurrentGridId(state) {
  let id = state.currentGridId || GRID_LEGACY_NAME_TO_ID[state.currentGrid] || state.currentGrid;
  if (!Array.isArray(state.joinedGrids)) state.joinedGrids = [];

  if (isSpatialGridId(id)) {
    state.currentGridId = id;
    state.currentGrid = getGridDisplayName(id);
    if (!state.joinedGrids.includes(id)) state.joinedGrids.push(id);
    return id;
  }

  const all = getAllGrids(state);
  if (!all.some(g => g.id === id)) {
    id = state.joinedGrids.find(j => !isSpatialGridId(j)) || "g_my";
  }
  state.currentGridId = id;
  const g = findGrid(state, id);
  state.currentGrid = g?.name || state.currentGrid || id;
  if (!state.joinedGrids.includes(id)) state.joinedGrids.push(id);
  return id;
}

export function syncGridHeader(state) {
  resolveCurrentGridId(state);
  const el = document.querySelector("#gridSelector");
  if (el) el.textContent = `${state.currentGrid} ▼`;
  updateGridMenuBadge(state);
}

function updateGridMenuBadge(state) {
  const btn = document.querySelector('#mainMenu [data-screen="grid"]');
  if (!btn) return;
  const communityUnread = getAllGrids(state).reduce(
    (sum, g) => sum + getGridRoomUnread(state, g.id),
    0
  );
  const spatialUnread = (state.joinedGrids || [])
    .filter(isSpatialGridId)
    .reduce((sum, id) => sum + getGridRoomUnread(state, id), 0);
  const n = communityUnread + spatialUnread;
  let badge = btn.querySelector(".grid-unread-badge");
  if (n <= 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "chat-unread-badge grid-unread-badge";
    btn.appendChild(badge);
  }
  badge.textContent = n > 99 ? "99+" : String(n);
}

function persistGrid(state, grid) {
  if (!grid || grid.type === "spatial") return;
  if (!Array.isArray(state.grids)) state.grids = [];
  const idx = state.grids.findIndex(g => g.id === grid.id);
  if (idx >= 0) state.grids[idx] = {...grid};
  else state.grids.push({...grid});
}

function hydrateDemoMembers(grid, state) {
  if (grid.type === "spatial") {
    ensureMemberMe(grid, state);
    return grid;
  }
  if (grid.memberIds.length > 1) {
    ensureMemberMe(grid, state);
    return grid;
  }
  const users = getUsers();
  const extras = users
    .filter(u => u.online)
    .slice(0, Math.min(10, Math.max(3, Math.floor((grid.people || 8) / 20))))
    .map(u => u.id);
  grid.memberIds = uniqueIds([grid.ownerId, ...grid.memberIds, ...extras]);
  ensureMemberMe(grid, state);
  return grid;
}

function ensureMemberMe(grid, state) {
  if (state.joinedGrids.includes(grid.id) && !grid.memberIds.includes(MY_USER_ID)) {
    grid.memberIds.push(MY_USER_ID);
  }
  if (grid.ownerId === MY_USER_ID && !grid.memberIds.includes(MY_USER_ID)) {
    grid.memberIds.unshift(MY_USER_ID);
  }
  grid.memberIds = uniqueIds(grid.memberIds);
  grid.people = Math.max(grid.people || 0, grid.memberIds.length);
}

function bindUsersListener() {
  if (usersListenerBound) return;
  usersListenerBound = true;
  on("users:changed", () => {
    if (!activeState || !activePanel || viewMode !== "detail" || !viewingGridId) return;
    try {
      if (isSpatialGridId(viewingGridId)) {
        openSpatialGridDetail(activePanel, activeState, viewingGridId, {soft: true});
      } else {
        refreshParticipantPresence(activePanel, activeState, viewingGridId);
      }
    } catch (e) {
      console.warn("[VROO grid] users:changed", e);
    }
  });
}

function bindLocationListener() {
  if (locationListenerBound) return;
  locationListenerBound = true;
  on("grid:locationChanged", ({gridId, prev}) => {
    if (!activeState) return;
    try {
      syncGridHeader(activeState);
      if (activePanel && viewMode === "list") {
        renderGrid(activePanel, activeState);
      }
      if (prev && gridId && prev !== gridId && activeState.currentGridId === prev) {
        showSystemMessage(
          "위치가 다른 Spatial GRID로 이동했습니다. 참여는 자동으로 바뀌지 않습니다."
        );
      }
    } catch (e) {
      console.warn("[VROO grid] locationChanged", e);
    }
  });
}

function refreshParticipantPresence(panel, state, gridId) {
  const grid = findGrid(state, gridId);
  if (!grid) return;
  const byId = new Map(getUsers().map(u => [u.id, u]));
  panel.querySelectorAll("[data-member-id]").forEach(row => {
    const id = row.getAttribute("data-member-id");
    if (id === MY_USER_ID) return;
    const live = byId.get(id);
    if (!live) return;
    const dot = row.querySelector("[data-online-dot]");
    if (dot) {
      dot.classList.toggle("online", !!live.online);
      dot.classList.toggle("offline", !live.online);
    }
    const nameEl = row.querySelector("[data-member-name]");
    if (nameEl) nameEl.textContent = live.nickname || id;
    const metaEl = row.querySelector("[data-member-meta]");
    if (metaEl) metaEl.textContent = `Lv.${live.level ?? "?"} · ${live.plate || ""}`;
  });
  const countEl = panel.querySelector("[data-member-count]");
  if (countEl) countEl.textContent = String(grid.memberIds.length);
}

function resolveMemberUser(memberId, state) {
  if (memberId === MY_USER_ID) {
    return {
      id: MY_USER_ID,
      nickname: state.profile?.nickname || "나",
      plate: state.profile?.plate || "",
      level: state.level || 1,
      online: true,
      car: state.profile?.car || "sport",
      lat: state.location?.lat,
      lng: state.location?.lng
    };
  }
  return (
    getUsers().find(u => u.id === memberId) || {
      id: memberId,
      nickname: memberId,
      plate: "",
      level: 1,
      online: false,
      car: "sedan"
    }
  );
}

function memberRowHtml(u, state) {
  const room = state.rooms?.[u.id];
  const talking = !!(room && room.type !== "grid");
  const self = u.id === MY_USER_ID;
  return `<div class="card user-row" data-member-id="${escapeHtml(u.id)}" style="${talking ? "border-left:4px solid #ffc400" : ""}">
    <div class="avatar">${carInfo(u.car).emoji}</div>
    <div>
      <b data-member-name>${escapeHtml(u.nickname)}${self ? " (나)" : ""}${talking ? ' <span style="color:#ffc400;font-size:10px">대화 중</span>' : ""}</b>
      <div class="muted" data-member-meta>Lv.${u.level ?? "?"} · ${escapeHtml(u.plate || "")}</div>
    </div>
    <button class="${u.online ? "primary" : "secondary"}" data-member-chat="${escapeHtml(u.id)}" type="button">
      <span class="status-dot ${u.online ? "online" : "offline"}" data-online-dot></span> ${self ? "MY" : talking ? "계속 대화" : "대화"}
    </button>
  </div>`;
}

export function renderGrid(panel, state) {
  bindUsersListener();
  bindLocationListener();
  activePanel = panel;
  activeState = state;
  viewMode = "list";
  viewingGridId = null;
  resolveCurrentGridId(state);

  const locId = state.locationGridId || null;
  const locName = locId ? getGridDisplayName(locId) : "위치 확인 중";
  const list = getAllGrids(state);
  const joinedSpatial = (state.joinedGrids || []).filter(isSpatialGridId);

  panel.innerHTML = `
    <div class="card spatial-status-card">
      <b>공간 GRID (LOCAL 2km)</b>
      <div class="muted">지도 셀을 누르면 조회만 됩니다. 참여·내 GRID 설정은 별도입니다.</div>
      <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
        <div>
          <div class="muted">현재 위치 GRID</div>
          <b>${escapeHtml(locName)}</b>
          <div class="muted" style="font-size:11px">${escapeHtml(locId || "—")}</div>
        </div>
        <div>
          <div class="muted">내 GRID</div>
          <b>${escapeHtml(state.currentGrid || state.currentGridId)}</b>
          <div class="muted" style="font-size:11px">${escapeHtml(state.currentGridId || "—")}</div>
        </div>
      </div>
      <div class="row" style="margin-top:10px;gap:8px">
        ${
          locId
            ? `<button class="primary" id="openLocSpatial" type="button">위치 GRID 보기</button>`
            : ""
        }
        ${
          locId && state.currentGridId !== locId
            ? `<button class="secondary" id="joinLocSpatial" type="button">위치 GRID 참여</button>`
            : ""
        }
      </div>
    </div>
    ${
      joinedSpatial.length
        ? `<div class="card"><b>참여 중 Spatial GRID</b></div>${joinedSpatial
            .map(id => {
              const isMine = state.currentGridId === id;
              const unread = getGridRoomUnread(state, id);
              const occupants =
                usersInSpatialGrid(getUsers(), id).length +
                (state.locationGridId === id ? 1 : 0);
              return `<div class="card row grid-list-row" style="border-left:4px solid #50df78" data-grid-row="${escapeHtml(id)}">
                <div>
                  <b>▣ ${escapeHtml(getGridDisplayName(id))}${isMine ? ' <span class="muted">· 내 GRID</span>' : ""}</b>
                  <div class="muted">현장 ${occupants}대 · ${escapeHtml(id)}</div>
                </div>
                <div class="room-actions">
                  <span class="chat-room-unread" ${unread ? "" : "hidden"}>${unread > 99 ? "99+" : unread}</span>
                  <button class="secondary" data-spatial-view="${escapeHtml(id)}" type="button">보기</button>
                </div>
              </div>`;
            })
            .join("")}`
        : ""
    }
    <div class="card"><b>커뮤니티 GRID</b><div class="muted">이름·비용으로 만드는 GRID입니다. 참여한 항목은 노란색입니다.</div></div>
    ${list
      .map(g => {
        const joined = state.joinedGrids.includes(g.id);
        const isMine = state.currentGridId === g.id;
        const unread = getGridRoomUnread(state, g.id);
        return `<div class="card row grid-list-row" style="${joined ? "border-left:4px solid #ffc400" : ""}" data-grid-row="${escapeHtml(g.id)}">
          <div>
            <b>${g.ad ? "📣 " : "👥 "}${escapeHtml(g.name)}${isMine ? ' <span class="muted">· 내 GRID</span>' : ""}</b>
            <div class="muted">${g.memberIds?.length || g.people || 0}명 · ${g.visibility === "private" ? "비공개" : "공개"}${g.ad ? " · 광고" : ""}</div>
          </div>
          <div class="room-actions">
            <span class="chat-room-unread" data-grid-unread="${escapeHtml(g.id)}" ${unread ? "" : "hidden"}>${unread > 99 ? "99+" : unread}</span>
            <button class="${joined ? "secondary" : "primary"}" data-grid-action="${joined ? "view" : "join"}" data-grid="${escapeHtml(g.id)}" type="button">${joined ? "참가자" : "참여"}</button>
          </div>
        </div>`;
      })
      .join("")}
    <button class="fab" id="createGrid" type="button">＋</button>`;

  const openLoc = panel.querySelector("#openLocSpatial");
  if (openLoc) openLoc.onclick = () => openSpatialGridDetail(panel, state, locId);
  const joinLoc = panel.querySelector("#joinLocSpatial");
  if (joinLoc) joinLoc.onclick = () => joinSpatialGrid(panel, state, locId);
  panel.querySelectorAll("[data-spatial-view]").forEach(btn => {
    btn.onclick = () => openSpatialGridDetail(panel, state, btn.dataset.spatialView);
  });
  panel.querySelectorAll("[data-grid-action]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.grid;
      const action = btn.dataset.gridAction;
      if (action === "join") joinGrid(panel, state, id);
      else openGridDetail(panel, state, id);
    };
  });
  panel.querySelector("#createGrid").onclick = () => beginCreateGrid(panel, state);
  syncGridHeader(state);
  refreshChatBadge(state);
}

function joinSpatialGrid(panel, state, gridId) {
  if (actionBusy) return;
  const localId = resolveToLocalGridId(gridId) || (isSpatialGridId(gridId) ? gridId : null);
  if (!localId) return;
  actionBusy = true;
  try {
    if (state.joinedGrids.includes(localId)) {
      showSystemMessage("이미 참여 중인 Spatial GRID입니다.");
      openSpatialGridDetail(panel, state, localId);
      return;
    }
    if (!state.spatialMembers) state.spatialMembers = {};
    const members = uniqueIds([...(state.spatialMembers[localId] || []), MY_USER_ID]);
    state.spatialMembers[localId] = members;
    state.joinedGrids.push(localId);
    state.currentGridId = localId;
    state.currentGrid = getGridDisplayName(localId);
    state.selectedGridId = localId;
    emit("state:save");
    emit("grid:changed", {gridId: localId, action: "join", type: "spatial"});
    try {
      refreshSpatialGrids();
    } catch {
      /* ignore */
    }
    openSpatialGridDetail(panel, state, localId);
  } finally {
    actionBusy = false;
  }
}

function joinGrid(panel, state, gridId) {
  if (actionBusy) return;
  if (isSpatialGridId(gridId)) {
    joinSpatialGrid(panel, state, gridId);
    return;
  }
  actionBusy = true;
  try {
    const grid = findGrid(state, gridId);
    if (!grid) {
      showSystemMessage("GRID를 찾을 수 없습니다.");
      return;
    }
    hydrateDemoMembers(grid, state);
    if (!state.joinedGrids.includes(gridId)) state.joinedGrids.push(gridId);
    if (!grid.memberIds.includes(MY_USER_ID)) grid.memberIds.push(MY_USER_ID);
    ensureMemberMe(grid, state);
    persistGrid(state, grid);
    state.currentGridId = gridId;
    state.currentGrid = grid.name;
    emit("state:save");
    emit("grid:changed", {gridId, action: "join"});
    openGridDetail(panel, state, gridId);
  } finally {
    actionBusy = false;
  }
}

function leaveGrid(panel, state, gridId) {
  if (actionBusy) return;
  if (isSpatialGridId(gridId)) {
    actionBusy = true;
    try {
      state.joinedGrids = state.joinedGrids.filter(id => id !== gridId);
      if (state.spatialMembers?.[gridId]) {
        state.spatialMembers[gridId] = state.spatialMembers[gridId].filter(
          id => id !== MY_USER_ID
        );
      }
      if (state.currentGridId === gridId) {
        const next =
          state.joinedGrids.find(j => !isSpatialGridId(j)) ||
          state.joinedGrids[0] ||
          "g_my";
        state.currentGridId = next;
        const nextG = findGrid(state, next);
        state.currentGrid = nextG?.name || getGridDisplayName(next) || "MY GRID";
      }
      emit("state:save");
      emit("grid:changed", {gridId, action: "leave", type: "spatial"});
      showSystemMessage("Spatial GRID에서 탈퇴했습니다.");
      renderGrid(panel, state);
    } finally {
      actionBusy = false;
    }
    return;
  }

  const grid = findGrid(state, gridId);
  if (!grid) return;
  if (grid.ownerId === MY_USER_ID) {
    showSystemMessage("소유한 GRID는 탈퇴할 수 없습니다.");
    return;
  }
  actionBusy = true;
  try {
    grid.memberIds = grid.memberIds.filter(id => id !== MY_USER_ID);
    state.joinedGrids = state.joinedGrids.filter(id => id !== gridId);
    persistGrid(state, grid);
    if (state.currentGridId === gridId) {
      state.currentGridId = state.joinedGrids[0] || "g_my";
      const next = findGrid(state, state.currentGridId);
      state.currentGrid = next?.name || "MY GRID";
    }
    emit("state:save");
    emit("grid:changed", {gridId, action: "leave"});
    showSystemMessage("GRID에서 탈퇴했습니다.");
    renderGrid(panel, state);
  } finally {
    actionBusy = false;
  }
}

function setAsMyGrid(panel, state, gridId) {
  if (!state.joinedGrids.includes(gridId)) {
    showSystemMessage("먼저 GRID에 참여해 주세요.");
    return;
  }
  const grid = findGrid(state, gridId);
  if (!grid) return;
  state.currentGridId = gridId;
  state.currentGrid = grid.name || getGridDisplayName(gridId);
  emit("state:save");
  emit("grid:changed", {gridId, action: "setCurrent", type: grid.type});
  syncGridHeader(state);
  try {
    refreshSpatialGrids();
  } catch {
    /* ignore */
  }
  if (isSpatialGridId(gridId)) openSpatialGridDetail(panel, state, gridId);
  else openGridDetail(panel, state, gridId);
}

export function openSpatialGridDetail(panel, state, gridId, options = {}) {
  bindUsersListener();
  bindLocationListener();
  const localId = resolveToLocalGridId(gridId) || (isSpatialGridId(gridId) ? gridId : null);
  if (!localId) {
    openGridDetail(panel, state, gridId);
    return;
  }
  gridId = localId;

  activePanel = panel;
  activeState = state;
  viewMode = "detail";
  viewingGridId = gridId;
  state.selectedGridId = gridId;

  const grid = findGrid(state, gridId);
  if (!grid) {
    showSystemMessage("Spatial GRID를 찾을 수 없습니다.");
    renderGrid(panel, state);
    return;
  }

  if (state.spatialMembers?.[gridId]) {
    grid.memberIds = uniqueIds(state.spatialMembers[gridId]);
  }
  ensureMemberMe(grid, state);

  if (!options.soft) {
    try {
      focusGridOnMap(grid);
    } catch (e) {
      console.warn("[VROO grid] spatial focus", e);
    }
  }

  const bounds = getGridBounds(gridId);
  const joined = state.joinedGrids.includes(gridId);
  const isCurrent = state.currentGridId === gridId;
  const isLocation = state.locationGridId === gridId;
  const unread = getGridRoomUnread(state, gridId);
  const presentUsers = usersInSpatialGrid(getUsers(), gridId);
  const mePresent = isLocation;
  const presentCount = presentUsers.length + (mePresent ? 1 : 0);
  const onlinePresent =
    presentUsers.filter(u => u.online).length + (mePresent ? 1 : 0);
  const members = uniqueIds(grid.memberIds)
    .map(id => resolveMemberUser(id, state))
    .filter(Boolean);
  const levelMeta = GRID_LEVELS[grid.level] || GRID_LEVELS.L3;

  panel.innerHTML = `<div class="card row">
      <button class="secondary" id="gridBack" type="button">←</button>
      <div style="flex:1;min-width:0">
        <b>${escapeHtml(grid.name)}</b>
        <div class="muted">Spatial · ${escapeHtml(levelMeta.label)} ${escapeHtml(grid.level)}</div>
      </div>
      <span class="chat-room-unread" ${unread ? "" : "hidden"}>${unread > 99 ? "99+" : unread}</span>
    </div>
    <div class="card">
      <div class="muted">GRID ID</div>
      <b style="font-size:12px;word-break:break-all">${escapeHtml(gridId)}</b>
      <div class="muted" style="margin-top:8px">중심 ${bounds.center.lat.toFixed(5)}, ${bounds.center.lng.toFixed(5)}</div>
      <div class="muted">셀 약 ${Math.round(bounds.sizeM / 1000)}km · ix ${bounds.ix} / iy ${bounds.iy}</div>
      <div style="margin-top:8px">
        ${isLocation ? '<span class="pill gold">현재 위치 GRID</span> ' : ""}
        ${isCurrent ? '<span class="pill green">내 GRID</span> ' : ""}
        ${joined ? '<span class="pill">참여 중</span>' : '<span class="pill muted-pill">미참여</span>'}
      </div>
      <div class="muted" style="margin-top:8px">현장 차량 ${presentCount} · 온라인 ${onlinePresent} · 가입 ${members.length}</div>
    </div>
    <div class="card row grid-detail-actions" style="flex-wrap:wrap;gap:8px">
      <button class="secondary" id="gridShowMembers" type="button">참가자 보기</button>
      ${!joined ? `<button class="primary" id="gridJoinSpatial" type="button">이 GRID 참여</button>` : ""}
      ${joined && !isCurrent ? `<button class="secondary" id="gridSetCurrent" type="button">내 GRID로 설정</button>` : ""}
      <button class="primary" id="gridGroupChat" type="button">GRID 단체 대화</button>
      <button class="secondary" id="gridCenterMap" type="button">지도 중심으로 이동</button>
      ${joined ? `<button class="danger" id="gridLeave" type="button">탈퇴</button>` : ""}
    </div>
    <div class="card"><b>현재 이 공간에 있는 차량</b><div class="muted">좌표가 이 LOCAL 셀에 속한 사용자</div></div>
    ${
      presentCount
        ? `${
            mePresent
              ? memberRowHtml(resolveMemberUser(MY_USER_ID, state), state)
              : ""
          }${presentUsers.map(u => memberRowHtml(u, state)).join("")}`
        : '<div class="card muted">현재 이 셀에 표시할 차량이 없습니다.</div>'
    }
    <div class="card" id="joinedSection"><b>이 GRID 가입자</b><div class="muted">참여한 사용자 (user.id)</div></div>
    ${
      members.length
        ? members.map(u => memberRowHtml(u, state)).join("")
        : '<div class="card muted">아직 가입자가 없습니다.</div>'
    }`;

  panel.querySelector("#gridBack").onclick = () => renderGrid(panel, state);
  panel.querySelector("#gridGroupChat").onclick = () => {
    if (!joined && !isCurrent) {
      showSystemMessage("단체 대화는 참여 후 이용할 수 있습니다.");
      return;
    }
    emit("grid:chatOpen", {gridId});
  };
  panel.querySelector("#gridCenterMap")?.addEventListener("click", () => {
    focusGridOnMap(grid);
  });
  panel.querySelector("#gridShowMembers")?.addEventListener("click", () => {
    panel.querySelector("#joinedSection")?.scrollIntoView({behavior: "smooth"});
  });
  const joinBtn = panel.querySelector("#gridJoinSpatial");
  if (joinBtn) joinBtn.onclick = () => joinSpatialGrid(panel, state, gridId);
  const setBtn = panel.querySelector("#gridSetCurrent");
  if (setBtn) setBtn.onclick = () => setAsMyGrid(panel, state, gridId);
  const leaveBtn = panel.querySelector("#gridLeave");
  if (leaveBtn) leaveBtn.onclick = () => leaveGrid(panel, state, gridId);

  panel.querySelectorAll("[data-member-chat]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.memberChat;
      if (id === MY_USER_ID) {
        emit("mypage:open");
        return;
      }
      emit("chat:open", resolveMemberUser(id, state));
    };
  });

  if (!options.soft) emit("state:save");
  syncGridHeader(state);
}

export function openGridDetail(panel, state, gridId) {
  if (isSpatialGridId(gridId)) {
    openSpatialGridDetail(panel, state, gridId);
    return;
  }

  bindUsersListener();
  activePanel = panel;
  activeState = state;
  viewMode = "detail";
  viewingGridId = gridId;
  state.selectedGridId = gridId;

  let grid = findGrid(state, gridId);
  if (!grid) {
    showSystemMessage("GRID를 찾을 수 없습니다.");
    renderGrid(panel, state);
    return;
  }

  hydrateDemoMembers(grid, state);
  ensureMemberMe(grid, state);
  persistGrid(state, grid);

  try {
    focusGridOnMap(grid);
  } catch (e) {
    console.warn("[VROO grid] map focus", e);
  }

  const joined = state.joinedGrids.includes(gridId);
  const isCurrent = state.currentGridId === gridId;
  const isOwner = grid.ownerId === MY_USER_ID;
  const unread = getGridRoomUnread(state, gridId);
  const members = uniqueIds(grid.memberIds)
    .map(id => resolveMemberUser(id, state))
    .filter(Boolean);

  panel.innerHTML = `<div class="card row">
      <button class="secondary" id="gridBack" type="button">←</button>
      <div style="flex:1;min-width:0">
        <b>${escapeHtml(grid.name)}</b>
        <div class="muted">커뮤니티 · 참가자 <span data-member-count>${members.length}</span>명${isCurrent ? " · 내 GRID" : ""}${isOwner ? " · 소유" : ""}</div>
      </div>
      <span class="chat-room-unread" ${unread ? "" : "hidden"}>${unread > 99 ? "99+" : unread}</span>
    </div>
    <div class="card row grid-detail-actions">
      <button class="primary" id="gridGroupChat" type="button">단체 대화</button>
      ${joined && !isCurrent ? `<button class="secondary" id="gridSetCurrent" type="button">내 GRID로</button>` : ""}
      ${joined && !isOwner ? `<button class="danger" id="gridLeave" type="button">탈퇴</button>` : ""}
      ${isOwner ? `<span class="muted">소유자 · 탈퇴 불가</span>` : ""}
    </div>
    <div class="card"><b>참가자</b><div class="muted">참가자를 누르면 1:1 대화가 열립니다.</div></div>
    ${
      members.length
        ? members.map(u => memberRowHtml(u, state)).join("")
        : '<div class="card muted">아직 참가자가 없습니다.</div>'
    }`;

  panel.querySelector("#gridBack").onclick = () => renderGrid(panel, state);
  panel.querySelector("#gridGroupChat").onclick = () => {
    emit("grid:chatOpen", {gridId});
  };
  const setBtn = panel.querySelector("#gridSetCurrent");
  if (setBtn) setBtn.onclick = () => setAsMyGrid(panel, state, gridId);
  const leaveBtn = panel.querySelector("#gridLeave");
  if (leaveBtn) leaveBtn.onclick = () => leaveGrid(panel, state, gridId);

  panel.querySelectorAll("[data-member-chat]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.memberChat;
      if (id === MY_USER_ID) {
        emit("mypage:open");
        return;
      }
      emit("chat:open", resolveMemberUser(id, state));
    };
  });

  emit("state:save");
  syncGridHeader(state);
}

export function beginCreateGrid(panel, state) {
  let busy = false;
  const locSpatial =
    state.locationGridId ||
    (state.location
      ? getGridCellFromLatLng(state.location.lat, state.location.lng, ACTIVE_GRID_LEVEL)
          .id
      : null);
  openModal(
    "새 GRID 만들기",
    `<label>GRID 이름</label><input id="newGridName">
     <label>유형</label>
     <select id="newGridVisibility">
       <option value="public">공개 GRID</option>
       <option value="private">비공개 GRID</option>
       <option value="club">차량모임 GRID</option>
       <option value="event">이벤트 GRID</option>
     </select>
     <div class="card"><b>예상 비용</b><div>🪙 ${formatCredits(GRID_CREATE_COST)}</div>
     <div class="muted">커뮤니티 GRID · 현재 Spatial 셀에 연결 가능</div>
     ${locSpatial ? `<div class="muted">연결 후보: ${escapeHtml(locSpatial)}</div>` : ""}
     </div>`,
    [
      {label: "취소", onClick: closeModal},
      {
        label: "생성",
        className: "primary",
        onClick: () => {
          if (busy) return;
          const name = document.querySelector("#newGridName")?.value.trim();
          if (!name) {
            showSystemMessage("GRID 이름을 입력해 주세요.");
            return;
          }
          if (!canAfford(state, GRID_CREATE_COST)) {
            showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(GRID_CREATE_COST)})`);
            return;
          }
          busy = true;
          const paid = spendCredits(state, GRID_CREATE_COST);
          if (!paid.ok) {
            busy = false;
            showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(GRID_CREATE_COST)})`);
            return;
          }
          const id = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const visibility = document.querySelector("#newGridVisibility")?.value || "public";
          const grid = normalizeGrid(
            {
              id,
              type: "community",
              name,
              ownerId: MY_USER_ID,
              memberIds: [MY_USER_ID],
              createdAt: Date.now(),
              center: {...(state.location || DEFAULT_CENTER)},
              visibility,
              chatRoomId: gridChatRoomId(id),
              people: 1,
              spatialId: locSpatial
            },
            state.location
          );
          if (!Array.isArray(state.grids)) state.grids = [];
          if (getAllGrids(state).some(g => g.id === id)) {
            busy = false;
            showSystemMessage("GRID 생성에 실패했습니다. 다시 시도해 주세요.");
            return;
          }
          state.grids.push(grid);
          if (!state.joinedGrids.includes(id)) state.joinedGrids.push(id);
          state.currentGridId = id;
          state.currentGrid = grid.name;
          closeModal();
          emit("state:save");
          emit("grid:changed", {gridId: id, action: "create"});
          openGridDetail(panel, state, id);
        }
      }
    ]
  );
}

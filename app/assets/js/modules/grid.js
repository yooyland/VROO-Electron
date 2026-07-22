import {
  SEED_GRIDS,
  GRID_LEGACY_NAME_TO_ID,
  MY_USER_ID,
  carInfo,
  gridChatRoomId
} from "./data.js";
import {getUsers, focusGridOnMap} from "./map.js";
import {emit, on} from "../core/events.js";
import {showSystemMessage, openModal, closeModal} from "../core/ui.js";
import {
  GRID_CREATE_COST,
  formatCredits,
  canAfford,
  spendCredits
} from "../core/storage.js";
import {getGridRoomUnread, refreshChatBadge} from "./chat.js";

const DEFAULT_CENTER = {lat: 37.5665, lng: 126.978};

let actionBusy = false;
let activePanel = null;
let activeState = null;
let viewingGridId = null;
let viewMode = "list";
let usersListenerBound = false;

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
    mine: !!raw.mine || ownerId === MY_USER_ID
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
        center: g.id === "g_my" ? {...center} : offsetSeedCenter(center, g.id)
      },
      center
    )
  ).filter(Boolean);
}

export function getAllGrids(state) {
  if (!Array.isArray(state.grids)) state.grids = [];
  const map = new Map();
  for (const g of seedWithCenter(state)) map.set(g.id, g);
  for (const raw of state.grids) {
    const g = normalizeGrid(raw, state.location);
    if (!g) continue;
    map.set(g.id, g);
  }
  return [...map.values()];
}

export function findGrid(state, gridId) {
  return getAllGrids(state).find(g => g.id === gridId) || null;
}

export function resolveCurrentGridId(state) {
  let id = state.currentGridId || GRID_LEGACY_NAME_TO_ID[state.currentGrid] || state.currentGrid;
  const all = getAllGrids(state);
  if (!all.some(g => g.id === id)) {
    id = state.joinedGrids?.[0] || "g_my";
  }
  state.currentGridId = id;
  const g = findGrid(state, id);
  state.currentGrid = g?.name || state.currentGrid || id;
  if (!Array.isArray(state.joinedGrids)) state.joinedGrids = [];
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
  const n = getAllGrids(state).reduce((sum, g) => sum + getGridRoomUnread(state, g.id), 0);
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
  if (!Array.isArray(state.grids)) state.grids = [];
  const idx = state.grids.findIndex(g => g.id === grid.id);
  if (idx >= 0) state.grids[idx] = {...grid};
  else state.grids.push({...grid});
}

function hydrateDemoMembers(grid, state) {
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
      refreshParticipantPresence(activePanel, activeState, viewingGridId);
    } catch (e) {
      console.warn("[VROO grid] users:changed", e);
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
      car: state.profile?.car || "sport"
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

export function renderGrid(panel, state) {
  bindUsersListener();
  activePanel = panel;
  activeState = state;
  viewMode = "list";
  viewingGridId = null;
  resolveCurrentGridId(state);

  const list = getAllGrids(state);
  panel.innerHTML = `<div class="card"><b>GRID 목록</b><div class="muted">참여한 GRID는 노란색으로 표시됩니다. 조회만으로는 내 GRID가 바뀌지 않습니다.</div></div>${
    list
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
      .join("")
  }<button class="fab" id="createGrid" type="button">＋</button>`;

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

function joinGrid(panel, state, gridId) {
  if (actionBusy) return;
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
  state.currentGrid = grid.name;
  emit("state:save");
  emit("grid:changed", {gridId, action: "setCurrent"});
  syncGridHeader(state);
  openGridDetail(panel, state, gridId);
}

export function openGridDetail(panel, state, gridId) {
  bindUsersListener();
  activePanel = panel;
  activeState = state;
  viewMode = "detail";
  viewingGridId = gridId;

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
        <div class="muted">참가자 <span data-member-count>${members.length}</span>명${isCurrent ? " · 내 GRID" : ""}${isOwner ? " · 소유" : ""}</div>
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
        ? members
            .map(u => {
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
            })
            .join("")
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
     <div class="card"><b>예상 비용</b><div>🪙 ${formatCredits(GRID_CREATE_COST)}</div></div>`,
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
              name,
              ownerId: MY_USER_ID,
              memberIds: [MY_USER_ID],
              createdAt: Date.now(),
              center: {...(state.location || DEFAULT_CENTER)},
              visibility,
              chatRoomId: gridChatRoomId(id),
              people: 1
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

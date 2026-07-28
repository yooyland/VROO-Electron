import {playHorn} from "./sound.js";
import {emit, on} from "../core/events.js";
import {getUsers} from "./map.js";
import {showSystemMessage} from "../core/ui.js";
import {gridChatRoomId, MY_USER_ID, SEED_GRIDS} from "./data.js";
import {getGridDisplayName, isSpatialGridId, getGridCellFromLatLng, ACTIVE_GRID_LEVEL} from "./spatial-grid.js";
import {
  ensureRoadChat,
  getRoadConversationCard,
  getRoadChatHistory,
  renderRoadChatContentDetail
} from "./road-chat.js";
import {
  ensureNearbyChat,
  getNearbyParticipants,
  ensureConversationUi,
  inferSpatialMeta,
  pushSpatialOverlay
} from "./conversation-store.js";

/** 주변 대화 — 로컬 세션 (road와 분리) */
const NEARBY_CHAT_FEATURE = { enabled: true, status: "local" };

/** @type {SpeechRecognition|null} */
let voiceRecognition = null;
let voiceListening = false;
let voiceBoundToRoomId = null;

/** 현재 패널에 열린 채팅방 peer id (목록이면 null) */
let activeRoomId = null;
let activePanel = null;
let activeState = null;
let viewMode = "list"; // "list" | "chat"

let sendBusy = false;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const replyTimers = new Map();
let usersListenerBound = false;
let msgIdSeq = 0;
let commandPreviewHideTimer = null;

function commandShellFor(panel) {
  if (!panel) return null;
  if (panel.matches?.(".chat-command-shell")) return panel;
  return panel.closest?.(".chat-command-shell") || panel.querySelector?.(".chat-command-shell") || null;
}

function activeConversationMessages(state) {
  const context = state?.activeConversationContext;
  const room = context?.roomId ? state?.rooms?.[context.roomId] : null;
  if (!Array.isArray(room?.messages)) return null;
  return room.messages
    .map((message) => normalizeMessage(message, context.peerId || "unknown", MY_USER_ID, context.roomId))
    .filter((message) => String(message?.text || "").trim())
    .slice(-2);
}

function syncCommandSpatialPreviews(panel, state) {
  const shell = commandShellFor(panel);
  if (!shell || !state) return;

  const sharedMessages = activeConversationMessages(state);
  const roadMessages = sharedMessages || ensureRoadChat(state).messages
    .filter((message) => String(message?.text || "").trim())
    .slice(-2);
  const mapMessages = sharedMessages || ensureNearbyChat(state).messages
    .filter((message) => String(message?.text || "").trim())
    .slice(-2);

  const roadScene = shell.querySelector(".chat-road-scene");
  if (roadScene) {
    roadScene.querySelectorAll(".chat-road-bubble,.chat-road-empty").forEach((node) => node.remove());
    const html = roadMessages.length
      ? roadMessages.map((message, index) => `<div class="chat-road-bubble ${index === 0 ? "one" : "two"} ${message.mine ? "mine" : ""}">${escapeHtml(String(message.text).slice(0, 54))}</div>`).join("")
      : '<div class="chat-road-empty">현재 대화를 시작해 보세요.</div>';
    roadScene.querySelector(".chat-road-copy")?.insertAdjacentHTML("afterend", html);
  }

  const mapScene = shell.querySelector(".chat-grid-map");
  if (mapScene) {
    mapScene.querySelectorAll(".chat-map-message").forEach((node) => node.remove());
    const html = mapMessages.map((message, index) => `<div class="chat-map-message ${index === 0 ? "one" : "two"} ${message.mine ? "mine" : ""}">${escapeHtml(String(message.text).slice(0, 46))}</div>`).join("");
    mapScene.querySelector(".chat-map-grid-lines")?.insertAdjacentHTML("afterend", html);
  }
}


function scheduleCommandPreviewHide(panel) {
  if (commandPreviewHideTimer) clearTimeout(commandPreviewHideTimer);
  commandPreviewHideTimer = setTimeout(() => {
    const shell = commandShellFor(panel);
    if (!shell) return;
    const bubbles = shell.querySelectorAll(".chat-road-bubble,.chat-map-message");
    bubbles.forEach((bubble) => bubble.classList.add("is-fading"));
    setTimeout(() => {
      bubbles.forEach((bubble) => bubble.remove());
    }, 280);
  }, 5000);
}

on("roadchat:changed", () => {
  try {
    syncCommandSpatialPreviews(activePanel, activeState);
  } catch (e) {
    console.warn("[VROO chat] command preview sync", e);
  }
});

on("chat:messagePreview", (detail) => {
  try {
    const activeId = activeState?.activeConversationContext?.roomId;
    if (activeId && detail?.roomId && String(activeId) !== String(detail.roomId)) return;
    syncCommandSpatialPreviews(activePanel, activeState);
    scheduleCommandPreviewHide(activePanel);
  } catch (e) {
    console.warn("[VROO chat] active message preview sync", e);
  }
});

function nextMessageId() {
  msgIdSeq += 1;
  return `m_${Date.now().toString(36)}_${msgIdSeq.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** GRID 단체방 참가자 user.id 목록 (도로 광선용) */
function resolveGridParticipantIds(state, gridId) {
  const out = new Set([MY_USER_ID]);
  const sm = state?.spatialMembers?.[gridId];
  if (Array.isArray(sm)) sm.forEach(id => out.add(String(id)));
  const owned = state?.grids?.find(g => g.id === gridId);
  if (Array.isArray(owned?.memberIds)) owned.memberIds.forEach(id => out.add(String(id)));
  const seed = SEED_GRIDS.find(g => g.id === gridId);
  if (Array.isArray(seed?.memberIds)) seed.memberIds.forEach(id => out.add(String(id)));
  if (isSpatialGridId(gridId)) {
    for (const u of getUsers()) {
      if (!u?.id || !Number.isFinite(u.lat) || !Number.isFinite(u.lng)) continue;
      const cell = getGridCellFromLatLng(u.lat, u.lng, ACTIVE_GRID_LEVEL);
      if (cell?.id === gridId) out.add(String(u.id));
    }
  }
  return [...out];
}


function conversationContextOf(state, info) {
  const type = info?.type || null;
  const gridId = info?.gridId || null;
  const peerId = info?.peerId || null;
  const gridRoomId = gridId ? gridChatRoomId(gridId) : null;
  const gridTitle =
    state?.rooms?.[gridRoomId]?.title ||
    state?.grids?.find?.((grid) => grid.id === gridId)?.name ||
    (gridId && isSpatialGridId(gridId) ? getGridDisplayName(gridId) : null) ||
    state?.currentGrid ||
    "MY GRID";
  const peer = peerId ? liveUser(peerId, state?.rooms?.[peerId]?.user) : null;
  const roadTitle =
    type === "grid"
      ? `${gridTitle} 도로 대화`
      : type === "direct" && peer
        ? `${peer.nickname || peer.id}와 대화 중`
        : "현재 도로 대화";
  return {
    roomId: info?.roomId || null,
    type,
    peerId,
    gridId,
    participantIds: Array.isArray(info?.participantIds) ? info.participantIds.map(String) : [],
    gridTitle,
    roadTitle
  };
}

function syncCommandConversationContext(panel, state, info) {
  const context = conversationContextOf(state, info);
  state.activeConversationContext = context;
  const shell = commandShellFor(panel);
  if (!shell) return context;
  shell.dataset.conversationType = context.type || "";
  shell.dataset.conversationGridId = context.gridId || "";
  const roadTitle = shell.querySelector("[data-command-road-title]");
  const gridTitle = shell.querySelector("[data-command-grid-title]");
  const roadMeta = shell.querySelector("[data-command-road-meta]");
  if (roadTitle) roadTitle.textContent = context.roadTitle;
  if (gridTitle) gridTitle.textContent = context.gridTitle;
  if (roadMeta) {
    const count = Math.max(0, context.participantIds.length - 1);
    roadMeta.textContent = context.type === "grid"
      ? `GRID 참여 차량 ${Math.max(1, count)}대`
      : context.type === "direct"
        ? "1:1 대화 환경"
        : roadMeta.textContent;
  }
  syncCommandSpatialPreviews(panel, state);
  return context;
}

function emitActiveRoomChanged(state, info) {
  try {
    const context = syncCommandConversationContext(activePanel, state, info);
    emit("chat:activeRoomChanged", context);
  } catch (e) {
    console.warn("[VROO chat] activeRoomChanged", e);
  }
}

function emitChatClosed(roomId) {
  try {
    emit("chat:closed", {roomId: roomId || null});
  } catch (e) {
    console.warn("[VROO chat] closed", e);
  }
}

function emitMessagePreview(msg) {
  if (!msg?.id || !msg?.text) return;
  try {
    emit("chat:messagePreview", {
      messageId: msg.id,
      roomId: msg.roomId,
      roomType: msg.roomType || (String(msg.roomId || "").startsWith("grid:") ? "grid" : "direct"),
      senderId: msg.senderId,
      text: String(msg.text),
      createdAt: msg.createdAt || Date.now()
    });
  } catch (e) {
    console.warn("[VROO chat] messagePreview", e);
  }
}

function closeActiveChat(state) {
  const prev = activeRoomId;
  activeRoomId = null;
  viewMode = "list";
  if (prev) emitChatClosed(prev);
}

function peerIdOf(userOrId) {
  if (userOrId == null) return "";
  if (typeof userOrId === "string") return userOrId;
  if (typeof userOrId === "object" && userOrId.id) return String(userOrId.id);
  return "";
}

function liveUser(peerId, fallback) {
  const fromMap = getUsers().find(u => u && u.id === peerId);
  if (fromMap) return fromMap;
  if (fallback && typeof fallback === "object") return fallback;
  return {
    id: peerId,
    nickname: peerId,
    plate: "",
    level: 1,
    online: false,
    car: "sedan"
  };
}

function normalizeMessage(raw, peerId, myId = MY_USER_ID, roomId = "") {
  if (raw == null) return null;
  if (typeof raw === "string") {
    return {
      id: nextMessageId(),
      text: raw,
      mine: false,
      senderId: peerId || "unknown",
      createdAt: Date.now(),
      roomId: roomId || undefined
    };
  }
  if (typeof raw !== "object") return null;
  const text = String(raw.text ?? raw.body ?? "").trim();
  if (!text) return null;
  const mine = raw.mine === true || raw.senderId === myId;
  return {
    id: raw.id || nextMessageId(),
    text,
    mine,
    senderId: raw.senderId || (mine ? myId : peerId || "unknown"),
    createdAt: Number(raw.createdAt) || Date.now(),
    roomId: raw.roomId || roomId || undefined
  };
}

function normalizeRoom(room, key) {
  const isGrid =
    room?.type === "grid" ||
    String(key).startsWith("grid:") ||
    String(room?.id || "").startsWith("grid:");

  if (isGrid) {
    const gridId =
      room.gridId ||
      String(key).replace(/^grid:/, "") ||
      String(room.id || "").replace(/^grid:/, "");
    if (!gridId) return null;
    const roomId = room.id || gridChatRoomId(gridId);
    const messages = Array.isArray(room?.messages)
      ? room.messages.map(m => normalizeMessage(m, "unknown", MY_USER_ID, roomId)).filter(Boolean)
      : [];
    return {
      id: roomId,
      type: "grid",
      gridId,
      title: room.title || "GRID 대화",
      messages,
      last: room.last || (messages.length ? messages[messages.length - 1].text : ""),
      unread: Math.max(0, Math.floor(Number(room?.unread) || 0))
    };
  }

  const peerId = String(room?.peerId || room?.id || room?.user?.id || key || "");
  if (!peerId || peerId.startsWith("grid:")) return null;
  const user = room?.user && typeof room.user === "object" ? room.user : {id: peerId};
  const messages = Array.isArray(room?.messages)
    ? room.messages.map(m => normalizeMessage(m, peerId, MY_USER_ID, peerId)).filter(Boolean)
    : [];
  return {
    id: peerId,
    type: "direct",
    peerId,
    title: room?.title || user.nickname || peerId,
    user: {...user, id: peerId},
    messages,
    last: room?.last || (messages.length ? messages[messages.length - 1].text : ""),
    unread: Math.max(0, Math.floor(Number(room?.unread) || 0))
  };
}

/** localStorage rooms 객체를 id 기준으로 안전하게 보정 */
export function sanitizeRooms(rooms) {
  if (!rooms || typeof rooms !== "object" || Array.isArray(rooms)) return {};
  const out = {};
  for (const [key, room] of Object.entries(rooms)) {
    const normalized = normalizeRoom(room, key);
    if (!normalized) continue;
    const storeKey = normalized.type === "grid" ? normalized.id : normalized.peerId;
    if (out[storeKey]) {
      const existing = out[storeKey];
      const ids = new Set(existing.messages.map(m => m.id));
      for (const m of normalized.messages) {
        if (!ids.has(m.id)) existing.messages.push(m);
      }
      existing.unread = Math.max(existing.unread, normalized.unread);
      if (normalized.last) existing.last = normalized.last;
      if (normalized.type === "grid") {
        existing.title = normalized.title || existing.title;
        existing.gridId = normalized.gridId;
      }
    } else {
      out[storeKey] = normalized;
    }
  }
  return out;
}

function ensureRoom(state, peerId, userHint) {
  if (!state.rooms || typeof state.rooms !== "object") state.rooms = {};
  const live = liveUser(peerId, userHint || state.rooms[peerId]?.user);
  if (!state.rooms[peerId] || state.rooms[peerId].type === "grid") {
    state.rooms[peerId] = {
      id: peerId,
      type: "direct",
      peerId,
      title: live.nickname || peerId,
      user: live,
      messages: Array.isArray(state.rooms[peerId]?.messages) && state.rooms[peerId]?.type !== "grid"
        ? state.rooms[peerId].messages
        : [],
      last: state.rooms[peerId]?.type === "direct" ? state.rooms[peerId].last || "" : "",
      unread: state.rooms[peerId]?.type === "direct" ? state.rooms[peerId].unread || 0 : 0
    };
  } else {
    const room = normalizeRoom(state.rooms[peerId], peerId);
    room.type = "direct";
    room.user = {...room.user, ...live, id: peerId};
    room.title = live.nickname || room.title || peerId;
    state.rooms[peerId] = room;
  }
  if (!Array.isArray(state.connections)) state.connections = [];
  if (!state.connections.includes(peerId)) state.connections.push(peerId);
  return state.rooms[peerId];
}

export function getGridRoomUnread(state, gridId) {
  const room = state?.rooms?.[gridChatRoomId(gridId)];
  return Math.max(0, Number(room?.unread) || 0);
}

function ensureGridRoom(state, gridId, title) {
  if (!state.rooms || typeof state.rooms !== "object") state.rooms = {};
  const roomId = gridChatRoomId(gridId);
  if (!state.rooms[roomId] || state.rooms[roomId].type !== "grid") {
    const prev = state.rooms[roomId];
    state.rooms[roomId] = {
      id: roomId,
      type: "grid",
      gridId,
      title: title || prev?.title || "GRID 대화",
      messages: Array.isArray(prev?.messages) ? prev.messages : [],
      last: prev?.last || "",
      unread: Math.max(0, Number(prev?.unread) || 0)
    };
  } else {
    state.rooms[roomId].title = title || state.rooms[roomId].title || "GRID 대화";
    state.rooms[roomId].gridId = gridId;
  }
  return state.rooms[roomId];
}

function totalUnread(state) {
  if (!state?.rooms) return 0;
  return Object.values(state.rooms).reduce((sum, r) => {
    if (r?.type === "road") return sum;
    return sum + (Math.max(0, Number(r?.unread) || 0));
  }, 0);
}

function unreadByType(state) {
  const out = { direct: 0, grid: 0, room: 0, road: 0, nearby: 0 };
  for (const r of Object.values(state?.rooms || {})) {
    const n = Math.max(0, Number(r?.unread) || 0);
    if (r?.type === "grid") out.grid += n;
    else if (r?.type === "room") out.room += n;
    else if (r?.type === "road") out.road += n;
    else out.direct += n;
  }
  out.road += Math.max(0, Number(state?.roadChat?.unread) || 0);
  out.nearby += Math.max(0, Number(state?.nearbyChat?.unread) || 0);
  return out;
}

function syncCommandUnreadBadge(state) {
  const shell = commandShellFor(activePanel) || document.querySelector(".chat-command-shell");
  if (!shell || !state) return;
  const by = unreadByType(state);
  const n = by.direct + by.room + by.grid + by.road + by.nearby;
  const host = shell.querySelector(".chat-command-unread");
  const strong = host?.querySelector("strong");
  if (strong) strong.textContent = n > 99 ? "99+" : String(n);
  host?.classList.toggle("has-unread", n > 0);
  host?.setAttribute("aria-label", `읽지 않은 메시지 ${n}개`);
}

function updateNavBadge(state) {
  syncCommandUnreadBadge(state);
  const btn = document.querySelector('#mainMenu [data-screen="chat"]');
  if (!btn) return;
  const by = unreadByType(state);
  const n = by.direct + by.room + by.grid + by.road + by.nearby;
  let badge = btn.querySelector(".chat-unread-badge");
  if (n <= 0) {
    if (badge) badge.remove();
    btn.classList.remove("has-unread");
  } else {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "chat-unread-badge";
      btn.appendChild(badge);
    }
    badge.textContent = n > 99 ? "99+" : String(n);
    btn.classList.add("has-unread");
  }
  updateSpatialBadges(by);
}

function updateSpatialBadges(by) {
  const nearBtn = document.querySelector('#mainMenu [data-screen="nearby"]');
  if (nearBtn) {
    let b = nearBtn.querySelector(".road-unread-badge");
    if (by.road > 0) {
      if (!b) {
        b = document.createElement("span");
        b.className = "chat-unread-badge road-unread-badge";
        nearBtn.appendChild(b);
      }
      b.textContent = by.road > 99 ? "99+" : String(by.road);
      nearBtn.classList.add("has-unread");
    } else {
      b?.remove();
      if (!nearBtn.querySelector(".chat-unread-badge")) nearBtn.classList.remove("has-unread");
    }
  }
  const gridBtn = document.querySelector('#mainMenu [data-screen="grid"]');
  if (gridBtn) {
    let b = gridBtn.querySelector(".grid-unread-badge");
    if (by.grid > 0) {
      if (!b) {
        b = document.createElement("span");
        b.className = "chat-unread-badge grid-unread-badge";
        gridBtn.appendChild(b);
      }
      b.textContent = by.grid > 99 ? "99+" : String(by.grid);
      gridBtn.classList.add("has-unread");
    } else {
      b?.remove();
      if (!gridBtn.querySelector(".chat-unread-badge")) gridBtn.classList.remove("has-unread");
    }
  }
}

function stopVoice() {
  voiceListening = false;
  voiceBoundToRoomId = null;
  try {
    voiceRecognition?.stop();
  } catch {
    /* ignore */
  }
  const b = activePanel?.querySelector("#voiceChat");
  if (b) {
    b.textContent = "🎙️ 음성 듣기 시작";
    b.classList.remove("voice-listening");
  }
}

export function pauseChatVoice() {
  stopVoice();
}

function clearReplyTimer(roomId) {
  const t = replyTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    replyTimers.delete(roomId);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function onlineLabel(user) {
  if (user?.online) return "온라인";
  if (user?.lastSeen) return `마지막 접속 ${user.lastSeen}`;
  return "오프라인";
}

function bindUsersListener() {
  if (usersListenerBound) return;
  usersListenerBound = true;
  on("users:changed", users => {
    if (!activeState || !activePanel) return;
    try {
      refreshPresence(activePanel, activeState, Array.isArray(users) ? users : getUsers());
    } catch (e) {
      console.warn("[VROO chat] users:changed", e);
    }
  });
}

/** 온라인 상태만 DOM 부분 갱신 (전체 채팅 재생성 없음) */
function refreshPresence(panel, state, users) {
  const byId = new Map(users.map(u => [u.id, u]));
  for (const room of Object.values(state.rooms || {})) {
    const live = byId.get(room.peerId || room.id);
    if (!live) continue;
    room.user = {...room.user, ...live, id: room.peerId || room.id};
    room.title = live.nickname || room.title;
  }

  panel.querySelectorAll("[data-peer-id]").forEach(el => {
    const id = el.getAttribute("data-peer-id");
    const live = byId.get(id);
    if (!live) return;
    const dot = el.querySelector("[data-online-dot]");
    if (dot) {
      dot.classList.toggle("online", !!live.online);
      dot.classList.toggle("offline", !live.online);
    }
    const statusText = el.querySelector("[data-online-text]");
    if (statusText) statusText.textContent = onlineLabel(live);
    const titleEl = el.querySelector("[data-peer-title]");
    if (titleEl) titleEl.textContent = live.nickname || id;
    const metaEl = el.querySelector("[data-peer-meta]");
    if (metaEl) {
      const plate = live.plate ? `${live.plate} · ` : "";
      metaEl.textContent = `${plate}Lv.${live.level ?? "?"} · ${onlineLabel(live)}`;
    }
  });

  if (viewMode === "list") {
    panel.querySelectorAll("[data-room-unread]").forEach(el => {
      const id = el.getAttribute("data-room-unread");
      const room = state.rooms[id];
      const n = Math.max(0, Number(room?.unread) || 0);
      el.hidden = n <= 0;
      el.textContent = n > 99 ? "99+" : String(n);
    });
  }
  updateNavBadge(state);
}

function migrateLegacyRoadRooms(state) {
  if (!state?.rooms) return;
  const keys = Object.keys(state.rooms).filter(
    (k) => state.rooms[k]?.type === "road" || String(k).startsWith("road:")
  );
  if (!keys.length) return;
  ensureRoadChat(state);
  for (const k of keys) {
    const room = state.rooms[k];
    for (const m of Array.isArray(room.messages) ? room.messages : []) {
      state.roadChat.messages.push({
        id: m.id || nextMessageId(),
        conversationType: "road",
        conversationId: state.roadChat.session.conversationId,
        senderAccountId: m.senderId,
        body: m.text || m.body,
        text: m.text || m.body,
        mine: !!m.mine,
        messageType: "text",
        roadContext: { roadId: null, segmentId: null, direction: null },
        createdAt: m.createdAt || Date.now()
      });
    }
    state.roadChat.unread = Math.max(state.roadChat.unread, Number(room.unread) || 0);
    delete state.rooms[k];
  }
}

function roomsFilterOf(state) {
  const f = state.roomsListFilter;
  return ["all", "spatial", "direct", "room"].includes(f) ? f : "all";
}

function convoIcon(kind) {
  const common = 'class="convo-icon-svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"';
  if (kind === "road") {
    return `<svg ${common} fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 19h16M7 19V7l5-3 5 3v12M10 11h4M10 15h4"/></svg>`;
  }
  if (kind === "grid") {
    return `<svg ${common} fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h16v16H4zM4 12h16M12 4v16"/></svg>`;
  }
  if (kind === "nearby") {
    return `<svg ${common} fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></svg>`;
  }
  if (kind === "history") {
    return `<svg ${common} fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/><path d="M12 7v5l3 2"/></svg>`;
  }
  return `<svg ${common} fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="9" r="3.2"/><path d="M5 19c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8"/></svg>`;
}

function formatListTime(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(t).toLocaleDateString("ko-KR");
}

export function openRoadChatInContent(panel, state) {
  bindUsersListener();
  stopVoice();
  activePanel = panel;
  activeState = state;
  const id = ensureRoadChat(state).session.conversationId;
  activeRoomId = id;
  viewMode = "chat";
  const ui = ensureConversationUi(state);
  ui.activeConversationId = id;
  if (!state.spatialChatUi) state.spatialChatUi = {};
  state.spatialChatUi.mode = "road";
  state.spatialChatUi.peerId = null;
  state.spatialChatUi.gridId = null;
  emit("state:save");
  renderRoadChatContentDetail(panel, state);
  updateNavBadge(state);
}

export function openNearbyChatInContent(panel, state) {
  bindUsersListener();
  stopVoice();
  const nc = ensureNearbyChat(state);
  const participants = getNearbyParticipants(state, getUsers());
  activePanel = panel;
  activeState = state;
  activeRoomId = nc.session.conversationId;
  viewMode = "chat";
  const ui = ensureConversationUi(state);
  ui.activeConversationId = nc.session.conversationId;
  nc.unread = 0;
  emit("state:save");
  updateNavBadge(state);

  const messages = nc.messages || [];
  const bubbles = messages
    .map((m) => {
      const label = m.mine ? "" : `<div class="bubble-sender">${escapeHtml(m.senderNickname || "차량")}</div>`;
      return `${label}<div class="bubble ${m.mine ? "mine" : ""}">${escapeHtml(m.body || m.text || "")}</div>`;
    })
    .join("");

  panel.innerHTML = `
    <div class="chat-shell" data-conversation-type="nearby" data-conversation-id="${escapeHtml(nc.session.conversationId)}" data-nearby-content-detail>
      <div class="card chat-header">
        <button class="secondary" id="nearbyContentBack" type="button">←</button>
        <div class="chat-header-main">
          <b class="chat-peer-name">주변 대화</b>
          <div class="muted">반경 ${nc.session.radiusM}m · 참여 ${participants.length}대 · 도로 대화와 분리 · 로컬</div>
        </div>
        <button class="secondary" id="nearbyOpenSpatial" type="button">공간에서 보기</button>
      </div>
      <div id="nearbyChatScroll" class="chat-scroll">${bubbles || '<div class="muted" style="padding:8px">주변 대화를 시작해 보세요.</div>'}</div>
      <div class="chat-compose">
        <textarea id="nearbyChatText" placeholder="주변 메시지 (개인 인사·긴 대화는 1:1 권장)" rows="2">${escapeHtml(nc.draftText || "")}</textarea>
        <div class="compose-actions">
          <button type="button" class="secondary" id="nearbyReport">신고</button>
          <button type="button" class="primary" id="nearbySend">전송</button>
        </div>
      </div>
    </div>`;

  panel.querySelector("#nearbyContentBack").onclick = () => {
    nc.draftText = panel.querySelector("#nearbyChatText")?.value || "";
    emit("state:save");
    emit("roadchat:contentBack");
  };
  panel.querySelector("#nearbyOpenSpatial").onclick = () => {
    nc.draftText = panel.querySelector("#nearbyChatText")?.value || "";
    emit("state:save");
    emit("workspace:spatialHome");
  };
  panel.querySelector("#nearbyReport").onclick = () => {
    showSystemMessage("신고는 서버 연동 후 처리됩니다. 긴급신고 서비스가 아닙니다.");
  };
  const sendNearby = () => {
    const text = String(panel.querySelector("#nearbyChatText")?.value || "").trim();
    if (!text) return;
    const msg = {
      id: nextMessageId(),
      conversationType: "nearby",
      conversationId: nc.session.conversationId,
      senderAccountId: MY_USER_ID,
      senderVehicleId: MY_USER_ID,
      senderNickname: state.profile?.nickname || "나",
      body: text,
      text,
      mine: true,
      createdAt: Date.now()
    };
    nc.messages.push(msg);
    nc.draftText = "";
    nc.session.lastActiveAt = Date.now();
    const spatial = inferSpatialMeta(text);
    if (spatial.spatialVisibility !== "none") {
      pushSpatialOverlay(state, {
        id: `ov-${msg.id}`,
        conversationId: nc.session.conversationId,
        conversationType: "nearby",
        senderVehicleId: MY_USER_ID,
        senderNickname: msg.senderNickname,
        body: text,
        spatialVisibility: spatial.spatialVisibility,
        spatialPriority: spatial.spatialPriority,
        createdAt: msg.createdAt,
        anchorVehicleId: MY_USER_ID
      });
    }
    emit("state:save");
    syncCommandSpatialPreviews(panel, state);
    openNearbyChatInContent(panel, state);
  };
  panel.querySelector("#nearbySend").onclick = sendNearby;
  panel.querySelector("#nearbyChatText")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    sendNearby();
  });
  requestAnimationFrame(() => {
    const s = panel.querySelector("#nearbyChatScroll");
    if (s) s.scrollTop = nc.scrollTop != null ? nc.scrollTop : s.scrollHeight;
  });
}

/** 지도·도로 요약에서 대화방 상세로 진입 */
export function openConversationById(panel, state, conversationId) {
  const id = String(conversationId || "");
  if (!id) return renderRooms(panel, state);
  if (id === "road-session-current" || id === ensureRoadChat(state).session.conversationId) {
    return openRoadChatInContent(panel, state);
  }
  if (id === "nearby-session-current" || id === ensureNearbyChat(state).session.conversationId) {
    return openNearbyChatInContent(panel, state);
  }
  if (id.startsWith("grid:") || state.rooms[id]?.type === "grid") {
    const gridId = state.rooms[id]?.gridId || id.replace(/^grid:/, "");
    return openGridChat(panel, state, gridId);
  }
  if (state.rooms[id]) {
    return openChatWith(panel, state, liveUser(id, state.rooms[id]?.user));
  }
  return renderRooms(panel, state);
}


const CHAT_FAVORITE_GIFTS = [
  { id: "coffee", icon: "☕", label: "커피" },
  { id: "fuel", icon: "⛽", label: "주유" },
  { id: "coupon", icon: "🎟️", label: "쿠폰" },
  { id: "event", icon: "🎁", label: "이벤트" }
];
const CHAT_DEFAULT_PHRASES = ["안전운전하세요 😊", "여기서 만나요!", "확인했습니다.", "잠시 후 연락드릴게요."];

function ensureChatUtilities(state) {
  if (!state.chatUtilities || typeof state.chatUtilities !== "object") state.chatUtilities = {};
  const util = state.chatUtilities;
  if (!Array.isArray(util.customPhrases)) util.customPhrases = [];
  if (!Array.isArray(util.pinnedPhrases) || !util.pinnedPhrases.length) {
    util.pinnedPhrases = CHAT_DEFAULT_PHRASES.slice(0, 3);
  }
  if (typeof util.phraseDrawerOpen !== "boolean") util.phraseDrawerOpen = false;
  return util;
}

function mountChatUtilities(panel, state, options = {}) {
  const shell = panel?.querySelector?.(".chat-shell");
  const compose = shell?.querySelector?.(".chat-compose");
  const textarea = shell?.querySelector?.("#chatText");
  if (!shell || !compose || !textarea) return;

  const util = ensureChatUtilities(state);
  if (util.pendingText) {
    textarea.value = String(util.pendingText);
    util.pendingText = "";
    emit("state:save");
  }
  const embeddedInThirdPane = panel?.matches?.("[data-chat-room-host]");
  if (embeddedInThirdPane) return;
  shell.querySelector(".chat-gift-shelf")?.remove();
  shell.querySelector(".chat-phrase-drawer")?.remove();

  const gifts = document.createElement("div");
  gifts.className = "chat-gift-shelf";
  gifts.setAttribute("aria-label", "자주 쓰는 선물");
  gifts.innerHTML = `<span class="chat-utility-label">자주 쓰는 상품</span>
    <div class="chat-gift-row">${CHAT_FAVORITE_GIFTS.map(g => `<button type="button" class="chat-gift-chip" data-chat-gift="${escapeHtml(g.id)}"><span>${g.icon}</span>${escapeHtml(g.label)}</button>`).join("")}</div>`;
  compose.before(gifts);

  const allPhrases = [...CHAT_DEFAULT_PHRASES, ...util.customPhrases]
    .filter((phrase, index, list) => phrase && list.indexOf(phrase) === index);
  const drawer = document.createElement("div");
  drawer.className = `chat-phrase-drawer ${util.phraseDrawerOpen ? "is-open" : ""}`;
  drawer.innerHTML = `
    <button type="button" class="chat-phrase-toggle" aria-expanded="${util.phraseDrawerOpen}">
      <span>${util.phraseDrawerOpen ? "▼" : "▲"} 상용구</span>
      <small>자주 쓰는 문장을 선택해 바로 전송</small>
    </button>
    <div class="chat-pinned-phrases">
      ${util.pinnedPhrases.map(p => `<button type="button" data-chat-phrase="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
    </div>
    <div class="chat-phrase-panel">
      <div class="chat-phrase-list">
        ${allPhrases.map(p => `<div class="chat-phrase-item"><button type="button" data-chat-phrase="${escapeHtml(p)}">${escapeHtml(p)}</button><button type="button" class="chat-phrase-pin ${util.pinnedPhrases.includes(p) ? "active" : ""}" data-pin-phrase="${escapeHtml(p)}" aria-label="하단 진열">${util.pinnedPhrases.includes(p) ? "★" : "☆"}</button></div>`).join("")}
      </div>
      <div class="chat-custom-phrase">
        <input type="text" maxlength="60" placeholder="사용자 상용구 만들기" data-custom-phrase-input>
        <button type="button" class="primary" data-add-custom-phrase>추가</button>
      </div>
    </div>`;
  compose.after(drawer);

  gifts.querySelectorAll("[data-chat-gift]").forEach(button => {
    button.onclick = () => {
      const gift = CHAT_FAVORITE_GIFTS.find(item => item.id === button.dataset.chatGift);
      if (!gift) return;
      textarea.value = `[선물] ${gift.icon} ${gift.label}`;
      textarea.focus();
      shell.querySelector("#sendChat")?.click();
    };
  });
  drawer.querySelector(".chat-phrase-toggle").onclick = () => {
    util.phraseDrawerOpen = !util.phraseDrawerOpen;
    emit("state:save");
    mountChatUtilities(panel, state, options);
  };
  drawer.querySelectorAll("[data-chat-phrase]").forEach(button => {
    button.onclick = () => {
      textarea.value = button.dataset.chatPhrase || "";
      textarea.focus();
      shell.querySelector("#sendChat")?.click();
    };
  });
  drawer.querySelectorAll("[data-pin-phrase]").forEach(button => {
    button.onclick = () => {
      const phrase = button.dataset.pinPhrase || "";
      util.pinnedPhrases = util.pinnedPhrases.includes(phrase)
        ? util.pinnedPhrases.filter(item => item !== phrase)
        : [...util.pinnedPhrases, phrase].slice(-5);
      emit("state:save");
      mountChatUtilities(panel, state, options);
    };
  });
  drawer.querySelector("[data-add-custom-phrase]").onclick = () => {
    const input = drawer.querySelector("[data-custom-phrase-input]");
    const phrase = String(input?.value || "").trim();
    if (!phrase) return;
    if (!util.customPhrases.includes(phrase)) util.customPhrases.push(phrase);
    util.pinnedPhrases = [...util.pinnedPhrases.filter(item => item !== phrase), phrase].slice(-5);
    emit("state:save");
    mountChatUtilities(panel, state, options);
  };
}

export function renderRooms(panel, state) {
  bindUsersListener();
  stopVoice();
  activePanel = panel;
  activeState = state;
  closeActiveChat(state);

  state.rooms = sanitizeRooms(state.rooms);
  migrateLegacyRoadRooms(state);
  ensureRoadChat(state);
  ensureNearbyChat(state);

  const filter = roomsFilterOf(state);
  const all = Object.values(state.rooms);
  const directs = all.filter((r) => r.type !== "grid" && r.type !== "road" && r.type !== "room");
  const rooms = all.filter((r) => r.type === "room");
  const grids = all.filter((r) => r.type === "grid");
  const sortRooms = (list) =>
    list.sort((a, b) => {
      const fa = state.favoriteRooms?.includes(b.id) ? 1 : 0;
      const fb = state.favoriteRooms?.includes(a.id) ? 1 : 0;
      if (fa !== fb) return fa - fb;
      return (b.unread || 0) - (a.unread || 0);
    });
  sortRooms(directs);
  sortRooms(grids);
  sortRooms(rooms);
  const by = unreadByType(state);
  const roadCard = getRoadConversationCard(state);
  const history = getRoadChatHistory(state);
  const showSpatial = filter === "all" || filter === "spatial";
  const showDirect = filter === "all" || filter === "direct";
  const showRoom = filter === "all" || filter === "room";
  const liveDrivers = getUsers().filter(u => u?.id).slice(0, 6);
  const mapMarkers = liveDrivers.map((u, index) => {
    const x = [18, 69, 44, 77, 27, 54][index] || 50;
    const y = [24, 18, 52, 64, 76, 84][index] || 50;
    return `<button type="button" class="chat-map-driver ${u.online ? "is-online" : ""}" style="--x:${x}%;--y:${y}%" data-map-peer="${escapeHtml(u.id)}">
      <span>${escapeHtml((u.nickname || "?").slice(0, 1))}</span>
      <b>${escapeHtml(u.nickname || u.id)}</b>
      <small>Lv.${u.level ?? "?"}</small>
    </button>`;
  }).join("");

  const roadMeta = roadCard.hasContextName
    ? `참여 차량 ${roadCard.participantCount}대`
    : `주변 차량 ${roadCard.participantCount}대`;
  const roadPreviewMessages = ensureRoadChat(state).messages
    .filter((message) => String(message?.text || "").trim())
    .slice(-2);
  const roadPreviewHtml = roadPreviewMessages
    .map((message, index) => `<div class="chat-road-bubble ${index === 0 ? "one" : "two"} ${message.mine ? "mine" : ""}">${escapeHtml(String(message.text).slice(0, 54))}</div>`)
    .join("");
  const nearbyPreviewMessages = ensureNearbyChat(state).messages
    .filter((message) => String(message?.text || "").trim())
    .slice(-2);
  const nearbyPreviewHtml = nearbyPreviewMessages
    .map((message, index) => `<div class="chat-map-message ${index === 0 ? "one" : "two"} ${message.mine ? "mine" : ""}">${escapeHtml(String(message.text).slice(0, 46))}</div>`)
    .join("");

  const historyHtml =
    showSpatial && history.length
      ? `<div class="card section-label"><b>최근 도로 대화</b><div class="muted">로컬 최근 기록 · 일반 대화방으로 변환되지 않습니다.</div></div>${history
          .map(
            (h) => `<div class="card convo-card convo-card-history">
            <div class="convo-icon">${convoIcon("history")}</div>
            <div class="convo-body">
              <div class="convo-title-row"><b>${escapeHtml(h.roadName || "도로 대화")}</b><span class="muted">${escapeHtml(formatListTime(h.endedAt))}</span></div>
              <div class="convo-space">${escapeHtml(h.directionLabel || "")} · 참여 ${Number(h.participantCount) || 0}대</div>
              <div class="convo-preview muted">${escapeHtml(String(h.lastMessage || "").slice(0, 80))}</div>
              <div class="muted">읽기 전용 · 로컬 기록</div>
            </div>
          </div>`
          )
          .join("")}`
      : showSpatial
        ? `<div class="card muted">최근 도로 대화(로컬)가 없습니다.</div>`
        : "";

  const gridHtml = showSpatial
    ? grids.length
      ? grids
          .map((r) => {
            const unread = Math.max(0, Number(r.unread) || 0);
            return `<div class="card convo-card" data-room-type="grid">
              <div class="convo-icon">${convoIcon("grid")}</div>
              <div class="convo-body">
                <div class="convo-title-row"><b>${escapeHtml(r.title || "GRID 대화")}</b>${unread ? `<span class="chat-room-unread">${unread > 99 ? "99+" : unread}</span>` : ""}</div>
                <div class="convo-space">현재 GRID 대화</div>
                <div class="convo-preview muted">${escapeHtml(r.last || "대화를 시작하세요")}</div>
                <div class="convo-actions">
                  <button class="primary" data-grid-content="${escapeHtml(r.gridId || "")}" type="button">대화 열기</button>
                  <button class="secondary" data-open-grid="${escapeHtml(r.gridId || "")}" type="button">공간에서 열기</button>
                </div>
              </div>
            </div>`;
          })
          .join("")
      : `<div class="card muted">참여 중인 GRID 대화가 없습니다.</div>`
    : "";

  const directHtml = showDirect
    ? `<div class="card section-label"><b>직접 대화</b><div class="muted">1:1 지속 대화</div></div>${
        directs.length
          ? directs
              .map((r) => {
                const unread = Math.max(0, Number(r.unread) || 0);
                const peer = liveUser(r.peerId || r.id, r.user);
                return `<div class="card convo-card room-row" data-peer-id="${escapeHtml(peer.id)}">
              <div class="convo-icon">${convoIcon("direct")}</div>
              <div class="convo-body">
                <div class="convo-title-row"><b data-peer-title>${escapeHtml(peer.nickname || r.title)}</b>${unread ? `<span class="chat-room-unread" data-room-unread="${escapeHtml(r.id)}">${unread > 99 ? "99+" : unread}</span>` : ""}</div>
                <div class="muted"><span class="status-dot ${peer.online ? "online" : "offline"}" data-online-dot></span> <span data-online-text>${onlineLabel(peer)}</span></div>
                <div class="convo-preview muted">${escapeHtml(r.last || "대화를 시작하세요")}</div>
                <div class="convo-actions">
                  <button class="secondary" data-room="${escapeHtml(r.id)}" type="button">열기</button>
                </div>
              </div>
            </div>`;
              })
              .join("")
          : '<div class="card muted">아직 1:1 대화방이 없습니다.</div>'
      }`
    : "";

  const roomHtml = showRoom
    ? `<div class="card section-label"><b>일반 대화방</b><div class="muted">참여 중인 그룹 · 친구 · 향후 커뮤니티</div></div>${
        rooms.length
          ? rooms
              .map((r) => {
                const unread = Math.max(0, Number(r.unread) || 0);
                return `<div class="card convo-card">
              <div class="convo-icon">${convoIcon("direct")}</div>
              <div class="convo-body">
                <div class="convo-title-row"><b>${escapeHtml(r.title || "그룹 대화")}</b>${unread ? `<span class="chat-room-unread">${unread > 99 ? "99+" : unread}</span>` : ""}</div>
                <div class="convo-preview muted">${escapeHtml(r.last || "대화를 시작하세요")}</div>
                <div class="convo-actions"><button class="secondary" data-room="${escapeHtml(r.id)}" type="button">열기</button></div>
              </div>
            </div>`;
              })
              .join("")
          : '<div class="card muted">참여 중인 그룹·친구 대화방이 없습니다. 커뮤니티 대화방은 향후 연동 예정입니다.</div>'
      }`
    : "";

  panel.innerHTML = `
    <div class="chat-command-shell">
      <header class="chat-command-head">
        <div>
          <span class="chat-command-kicker">SOCIAL · SPATIAL CONVERSATION</span>
          <b>대화방</b>
          <small>도로·GRID·주변 차량과 대화를 한 화면에서 연결합니다.</small>
        </div>
      </header>
      <div class="chat-command-control-row">
        <div class="chat-command-unread">읽지 않음 <strong>${by.road + by.nearby + by.grid + by.direct + by.room}</strong></div>
        <div class="chat-command-gifts" aria-label="자주 쓰는 상품">
          <b>선물</b>
          <div class="chat-gift-row">
            ${CHAT_FAVORITE_GIFTS.map(g => `<button type="button" class="chat-gift-chip" data-list-gift="${escapeHtml(g.id)}"><span>${g.icon}</span>${escapeHtml(g.label)}</button>`).join("")}
          </div>
        </div>
        <div class="tabs rooms-filter-tabs chat-command-filters" role="tablist" aria-label="대화방 종류">
          <button type="button" data-rooms-filter="all" class="${filter === "all" ? "active" : ""}">전체</button>
          <button type="button" data-rooms-filter="spatial" class="${filter === "spatial" ? "active" : ""}">공간</button>
          <button type="button" data-rooms-filter="direct" class="${filter === "direct" ? "active" : ""}">1:1</button>
          <button type="button" data-rooms-filter="room" class="${filter === "room" ? "active" : ""}">친구</button>
          <button type="button" data-rooms-filter="room">단체</button>
          <button type="button" data-rooms-filter="spatial">그리드</button>
        </div>
      </div>
      <div class="chat-command-grid">
        <section class="chat-road-scene" aria-label="도로 대화 장면" data-open-road-scene>
          <div class="chat-scene-top">
            <span><i></i> 온라인 ${liveDrivers.filter(u => u.online).length}</span>
            <div class="chat-view-switch"><b class="active">도로</b></div>
          </div>
          <div class="chat-road-copy">
            <span>LIVE ROAD</span>
            <h3 data-command-road-title>${roadCard.hasContextName ? escapeHtml(roadCard.roadName) : "현재 도로 대화"}</h3>
            <p data-command-road-meta>${roadMeta}</p>
          </div>
          ${roadPreviewHtml || '<div class="chat-road-empty">현재 도로 대화를 시작해 보세요.</div>'}
          <picture class="chat-road-car"><source srcset="./assets/characters/05_Heritage/views/rear.webp" type="image/webp"><img src="./assets/characters/05_Heritage/views/rear.png" alt="Heritage S 도로 차량"></picture>
          <div class="chat-road-lanes" aria-hidden="true"></div>
        </section>

        <section class="chat-grid-map" aria-label="공간 GRID 대화 지도">
          <div class="chat-map-head">
            <div><small>주변 · 지도 대화</small><b data-command-grid-title>${escapeHtml(state.activeConversationContext?.gridTitle || state.currentGrid || "MY GRID")}</b></div>
            <div class="chat-map-head-actions">
              <button type="button" class="secondary" data-open-nearby-content>주변 대화</button>
              <button type="button" class="secondary" data-open-grid-map>위치 GRID 보기</button>
            </div>
          </div>
          <div class="chat-map-grid-lines" aria-hidden="true"></div>
          ${nearbyPreviewHtml}
          ${mapMarkers || '<div class="chat-map-empty">주변 차량을 찾는 중입니다.</div>'}
          <button type="button" class="chat-my-location" data-open-nearby-map><span></span>나</button>
          <div class="chat-map-footer"><button type="button" class="secondary" data-open-nearby-map>내 위치</button><button type="button" class="primary" data-open-grid-map>GRID</button><button type="button" class="secondary" data-open-nearby-map>참여자</button></div>
        </section>

        <aside class="chat-live-rail">
          <div class="chat-live-scroll" data-chat-room-host>
            ${gridHtml}
            ${directHtml}
            ${roomHtml}
          </div>
          <div class="chat-list-phrase-drawer ${ensureChatUtilities(state).phraseDrawerOpen ? "is-open" : ""}">
            <button type="button" class="chat-phrase-toggle" data-list-phrase-toggle aria-expanded="${ensureChatUtilities(state).phraseDrawerOpen}">
              <span>${ensureChatUtilities(state).phraseDrawerOpen ? "▼" : "▲"} 상용구</span>
              <small>대화방을 선택하면 바로 보낼 수 있습니다.</small>
            </button>
            <div class="chat-pinned-phrases">
              ${ensureChatUtilities(state).pinnedPhrases.map(p => `<button type="button" data-list-phrase="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
            </div>
            <div class="chat-phrase-panel">
              <div class="chat-custom-phrase">
                <input type="text" maxlength="60" placeholder="사용자 상용구 만들기" data-list-custom-input>
                <button type="button" class="primary" data-list-custom-add>추가</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <section class="chat-road-alert-ticker" aria-label="도로 위험 안내">
        <span>▲ 전방에 사고 났습니다.</span>
        <span>교통사고 위험지역입니다.</span>
        <span>전방에 사고 났습니다.</span>
        <span>교통사고 위험지역입니다.</span>
        <span>전방에 사고 났습니다.</span>
      </section>
      ${showSpatial && history.length ? `<section class="chat-command-below chat-history-collapsed" aria-label="최근 공간 대화 기록">${historyHtml}</section>` : ""}
    </div>`;

  const roomHost = panel.querySelector("[data-chat-room-host]");
  const listUtil = ensureChatUtilities(state);
  panel.querySelector("[data-list-phrase-toggle]")?.addEventListener("click", () => {
    listUtil.phraseDrawerOpen = !listUtil.phraseDrawerOpen;
    emit("state:save");
    renderRooms(panel, state);
  });
  panel.querySelectorAll("[data-list-gift],[data-list-phrase]").forEach(button => {
    button.onclick = () => {
      const text = button.dataset.listPhrase || (() => {
        const gift = CHAT_FAVORITE_GIFTS.find(item => item.id === button.dataset.listGift);
        return gift ? `[선물] ${gift.icon} ${gift.label}` : "";
      })();
      const openTextarea = roomHost?.querySelector?.("#chatText");
      const openSend = roomHost?.querySelector?.("#sendChat");
      if (openTextarea && openSend) {
        openTextarea.value = text;
        openTextarea.focus();
        openSend.click();
        return;
      }
      state.chatUtilities.pendingText = text;
      emit("state:save");
      showSystemMessage("보낼 대화방을 선택하세요.");
    };
  });
  panel.querySelector("[data-list-custom-add]")?.addEventListener("click", () => {
    const input = panel.querySelector("[data-list-custom-input]");
    const phrase = String(input?.value || "").trim();
    if (!phrase) return;
    if (!listUtil.customPhrases.includes(phrase)) listUtil.customPhrases.push(phrase);
    listUtil.pinnedPhrases = [...listUtil.pinnedPhrases.filter(item => item !== phrase), phrase].slice(-5);
    emit("state:save");
    renderRooms(panel, state);
  });
  panel.querySelectorAll("[data-rooms-filter]").forEach((b) => {
    b.onclick = () => {
      state.roomsListFilter = b.dataset.roomsFilter;
      emit("state:save");
      renderRooms(panel, state);
    };
  });
  panel.querySelector("[data-open-road-scene]")?.addEventListener("click", () => {
    openRoadChatInContent(roomHost, state);
  });
  panel.querySelector("[data-open-nearby-content]")?.addEventListener("click", () => {
    openNearbyChatInContent(roomHost, state);
  });
  panel.querySelectorAll("[data-open-nearby-map]").forEach((b) => {
    b.onclick = () => emit("workspace:spatialHome");
  });
  panel.querySelectorAll("[data-open-grid-map]").forEach((b) => {
    b.onclick = () => emit("grid:spatialOpen", {gridId: state.currentGridId});
  });
  panel.querySelectorAll("[data-map-peer]").forEach((b) => {
    b.onclick = () => {
      state.chatRoomListRequested = false;
      const id = b.dataset.mapPeer;
      openChatWith(roomHost, state, liveUser(id));
    };
  });
  panel.querySelectorAll("[data-grid-content]").forEach((b) => {
    b.onclick = () => {
      state.chatRoomListRequested = false;
      openGridChat(roomHost, state, b.dataset.gridContent);
    };
  });
  panel.querySelectorAll("[data-open-grid]").forEach((b) => {
    b.onclick = () => emit("grid:spatialOpen", { gridId: b.dataset.openGrid });
  });
  panel.querySelectorAll("[data-room]").forEach((b) => {
    b.onclick = () => {
      state.chatRoomListRequested = false;
      const id = b.dataset.room;
      openChatWith(roomHost, state, liveUser(id, state.rooms[id]?.user));
    };
  });
  updateNavBadge(state);

  if (!state.chatRoomListRequested) {
    const preferred = directs
      .slice()
      .sort((a, b) => {
        const messageDiff = (b.messages?.length || 0) - (a.messages?.length || 0);
        if (messageDiff) return messageDiff;
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      })[0];
    if (preferred) {
      requestAnimationFrame(() => {
        if (!roomHost?.isConnected || roomHost.querySelector(".chat-shell")) return;
        openChatWith(roomHost, state, liveUser(preferred.peerId || preferred.id, preferred.user));
      });
    }
  }
}

/**
 * 1:1 채팅방 열기 — peer user id가 방 키.
 * userOrId: 사용자 객체 또는 id 문자열
 */
export function openChatWith(panel, state, userOrId) {
  bindUsersListener();
  const peerId = peerIdOf(userOrId);
  if (!peerId) {
    showSystemMessage("대화 상대를 확인할 수 없습니다.");
    return;
  }
  if (peerId.startsWith("grid:") || userOrId?.type === "grid") {
    const gridId = userOrId?.gridId || peerId.replace(/^grid:/, "");
    openGridChat(panel, state, gridId);
    return;
  }

  if (activeRoomId && activeRoomId !== peerId) {
    stopVoice();
    clearReplyTimer(activeRoomId);
  }

  const hint = typeof userOrId === "object" ? userOrId : null;
  const room = ensureRoom(state, peerId, hint);
  room.unread = 0;
  sendBusy = false;
  activePanel = panel;
  activeState = state;
  activeRoomId = peerId;
  viewMode = "chat";
  if (!state.spatialChatUi) state.spatialChatUi = {};
  state.spatialChatUi.mode = "direct";
  state.spatialChatUi.peerId = peerId;
  state.spatialChatUi.gridId = null;
  emit("state:save");
  updateNavBadge(state);
  emitActiveRoomChanged(state, {
    roomId: peerId,
    type: "direct",
    peerId,
    gridId: null,
    participantIds: [MY_USER_ID, peerId]
  });
  renderChat(panel, state, peerId);
}

function renderChat(panel, state, peerId) {
  const room = state.rooms[peerId];
  if (!room) return renderRooms(panel, state);

  stopVoice();
  activeRoomId = peerId;
  activePanel = panel;
  activeState = state;
  viewMode = "chat";

  const peer = liveUser(peerId, room.user);
  room.user = peer;
  room.title = peer.nickname || room.title;

  const messages = Array.isArray(room.messages) ? room.messages : [];
  const bubbles = messages
    .map(m => {
      const msg = normalizeMessage(m, peerId) || {text: "", mine: false};
      if (!msg.text) return "";
      return `<div class="bubble ${msg.mine ? "mine" : ""}">${escapeHtml(msg.text)}</div>`;
    })
    .join("");

  panel.innerHTML = `<div class="chat-shell">
    <div class="card chat-header" data-peer-id="${escapeHtml(peerId)}">
      <button class="secondary" id="chatBack" type="button">←</button>
      <div class="chat-header-main">
        <b class="chat-peer-name" data-peer-title>${escapeHtml(peer.nickname || room.title)}</b>
        <div class="muted chat-peer-meta" data-peer-meta>1:1 대화 · ${peer.plate ? `${escapeHtml(peer.plate)} · ` : ""}Lv.${peer.level ?? "?"} · <span class="status-dot ${peer.online ? "online" : "offline"}" data-online-dot></span> <span data-online-text>${onlineLabel(peer)}</span></div>
      </div>
      <button class="secondary" id="favoriteRoom" type="button">${state.favoriteRooms?.includes(peerId) ? "★" : "☆"}</button>
    </div>
    <div id="chatScroll" class="chat-scroll">${bubbles}</div>
    <div class="chat-compose">
      <div class="tabs">
        <button type="button" class="active" data-chatmode="text">텍스트</button>
        <button type="button" data-chatmode="voice">음성</button>
      </div>
      <div id="textCompose">
        <textarea id="chatText" placeholder="메시지를 입력하세요"></textarea>
        <div class="compose-actions"><button class="primary" id="sendChat" type="button">전송</button></div>
      </div>
      <div id="voiceCompose" style="display:none">
        <button class="secondary" id="voiceChat" type="button" style="width:100%;padding:14px">🎙️ 음성 듣기 시작</button>
        <div class="muted" style="margin-top:8px">인식 결과가 입력창에 채워집니다. 확인 후 전송하세요.</div>
      </div>
    </div>
  </div>`;

  panel.querySelector("#chatBack").onclick = () => {
    state.chatRoomListRequested = true;
    stopVoice();
    clearReplyTimer(peerId);
    closeActiveChat(state);
    if (state.spatialChatUi) {
      state.spatialChatUi.mode = null;
      state.spatialChatUi.peerId = null;
    }
    emit("spatialChat:back");
  };

  panel.querySelector("#favoriteRoom").onclick = () => {
    if (!Array.isArray(state.favoriteRooms)) state.favoriteRooms = [];
    state.favoriteRooms = state.favoriteRooms.includes(peerId)
      ? state.favoriteRooms.filter(x => x !== peerId)
      : [...state.favoriteRooms, peerId];
    emit("state:save");
    renderChat(panel, state, peerId);
  };

  panel.querySelectorAll("[data-chatmode]").forEach(b => {
    b.onclick = () => {
      panel.querySelectorAll("[data-chatmode]").forEach(x => x.classList.toggle("active", x === b));
      const mode = b.dataset.chatmode;
      panel.querySelector("#textCompose").style.display = mode === "text" ? "block" : "none";
      panel.querySelector("#voiceCompose").style.display = mode === "voice" ? "block" : "none";
      if (mode !== "voice") stopVoice();
    };
  });

  const textarea = panel.querySelector("#chatText");
  const sendBtn = panel.querySelector("#sendChat");

  const doSend = () => {
    const text = (textarea?.value || "").trim();
    send(panel, state, peerId, text);
  };

  sendBtn.onclick = doSend;
  textarea.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    doSend();
  });

  panel.querySelector("#voiceChat").onclick = () => toggleVoice(panel, state, peerId);
  mountChatUtilities(panel, state, { type: "direct", peerId });

  requestAnimationFrame(() => {
    const s = panel.querySelector("#chatScroll");
    if (s) s.scrollTop = s.scrollHeight;
  });
}

function send(panel, state, peerId, text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return;
  if (sendBusy) return;
  sendBusy = true;

  const room = ensureRoom(state, peerId, state.rooms[peerId]?.user);
  const msg = {
    id: nextMessageId(),
    text: cleaned,
    mine: true,
    senderId: MY_USER_ID,
    createdAt: Date.now(),
    roomId: peerId
  };
  room.messages.push(msg);
  room.last = cleaned;
  emit("state:save");
  emitMessagePreview({...msg, roomType: "direct", conversationType: "direct"});

  const ta = panel.querySelector("#chatText");
  if (ta) ta.value = "";

  renderChat(panel, state, peerId);
  scheduleDemoReply(panel, state, peerId);
  sendBusy = false;
}

function scheduleDemoReply(panel, state, peerId) {
  clearReplyTimer(peerId);
  const timer = setTimeout(() => {
    replyTimers.delete(peerId);
    const room = state.rooms[peerId];
    if (!room || room.type === "grid") return;
    const reply = ["빵빵! 안전운전하세요.", "네, 확인했습니다.", "좋아요 👍"][
      Math.floor(Math.random() * 3)
    ];
    const replyMsg = {
      id: nextMessageId(),
      text: reply,
      mine: false,
      senderId: peerId,
      createdAt: Date.now(),
      roomId: peerId
    };
    room.messages.push(replyMsg);
    room.last = reply;
    emitMessagePreview({...replyMsg, roomType: "direct"});

    const isOpen = viewMode === "chat" && activeRoomId === peerId && activePanel === panel;
    if (isOpen) {
      room.unread = 0;
      emit("state:save");
      playHorn(state.hornEnabled);
      renderChat(panel, state, peerId);
    } else {
      room.unread = Math.max(0, Number(room.unread) || 0) + 1;
      emit("state:save");
      playHorn(state.hornEnabled);
      updateNavBadge(state);
      if (viewMode === "list" && activePanel === panel) {
        refreshPresence(panel, state, getUsers());
      }
    }
  }, 700);
  replyTimers.set(peerId, timer);
}

/**
 * GRID 단체 대화방 — room id = grid:{gridId}, type: grid
 */
export function openGridChat(panel, state, gridId) {
  bindUsersListener();
  if (!gridId) {
    showSystemMessage("GRID를 확인할 수 없습니다.");
    return;
  }

  const seedNames = {
    g_my: "MY GRID",
    g_gangnam: "강남 드라이브",
    g_safe: "안전운전",
    g_night: "야간 드라이브",
    g_event: "VROO 공식 이벤트",
    g_insure: "자동차 보험 혜택"
  };
  const displayTitle =
    state.grids?.find(g => g.id === gridId)?.name ||
    seedNames[gridId] ||
    (isSpatialGridId(gridId) ? getGridDisplayName(gridId) : null) ||
    (state.currentGridId === gridId ? state.currentGrid : null) ||
    "GRID 대화";

  const roomId = gridChatRoomId(gridId);
  if (activeRoomId && activeRoomId !== roomId) {
    stopVoice();
    clearReplyTimer(activeRoomId);
  }

  const room = ensureGridRoom(state, gridId, displayTitle);
  room.unread = 0;
  sendBusy = false;
  activePanel = panel;
  activeState = state;
  activeRoomId = roomId;
  viewMode = "chat";
  if (!state.spatialChatUi) state.spatialChatUi = {};
  state.spatialChatUi.mode = "grid";
  state.spatialChatUi.peerId = null;
  state.spatialChatUi.gridId = gridId;
  emit("state:save");
  updateNavBadge(state);
  emitActiveRoomChanged(state, {
    roomId,
    type: "grid",
    peerId: null,
    gridId,
    participantIds: resolveGridParticipantIds(state, gridId)
  });
  renderGridChat(panel, state, gridId);
}

function senderLabel(senderId, state) {
  if (senderId === MY_USER_ID) return state.profile?.nickname || "나";
  const u = getUsers().find(x => x.id === senderId);
  return u?.nickname || senderId || "알 수 없음";
}

function renderGridChat(panel, state, gridId) {
  const roomId = gridChatRoomId(gridId);
  const room = state.rooms[roomId];
  if (!room) return renderRooms(panel, state);

  stopVoice();
  activeRoomId = roomId;
  activePanel = panel;
  activeState = state;
  viewMode = "chat";

  const messages = Array.isArray(room.messages) ? room.messages : [];
  const bubbles = messages
    .map(m => {
      const msg = normalizeMessage(m, "unknown", MY_USER_ID, roomId);
      if (!msg?.text) return "";
      const label = msg.mine
        ? ""
        : `<div class="bubble-sender">${escapeHtml(senderLabel(msg.senderId, state))}</div>`;
      return `${label}<div class="bubble ${msg.mine ? "mine" : ""}">${escapeHtml(msg.text)}</div>`;
    })
    .join("");

  panel.innerHTML = `<div class="chat-shell" data-conversation-type="grid" data-conversation-id="${escapeHtml(roomId)}">
    <div class="card chat-header">
      <button class="secondary" id="chatBack" type="button">←</button>
      <div class="chat-header-main">
        <b class="chat-peer-name">${escapeHtml(room.title || "GRID 대화")}</b>
        <div class="muted chat-peer-meta">${isSpatialGridId(gridId) ? "Spatial GRID 단체 대화" : "GRID 단체 대화"} · 동일 세션</div>
      </div>
      <button class="secondary" id="gridOpenSpatial" type="button">공간에서 열기</button>
      <button class="secondary" id="favoriteRoom" type="button">${state.favoriteRooms?.includes(roomId) ? "★" : "☆"}</button>
    </div>
    <div id="chatScroll" class="chat-scroll">${bubbles}</div>
    <div class="chat-compose">
      <div class="tabs">
        <button type="button" class="active" data-chatmode="text">텍스트</button>
        <button type="button" data-chatmode="voice">음성</button>
      </div>
      <div id="textCompose">
        <textarea id="chatText" placeholder="GRID에 메시지를 입력하세요"></textarea>
        <div class="compose-actions"><button class="primary" id="sendChat" type="button">전송</button></div>
      </div>
      <div id="voiceCompose" style="display:none">
        <button class="secondary" id="voiceChat" type="button" style="width:100%;padding:14px">음성 듣기 시작</button>
        <div class="muted" style="margin-top:8px">인식 결과가 입력창에 채워집니다. 확인 후 전송하세요.</div>
      </div>
    </div>
  </div>`;

  panel.querySelector("#chatBack").onclick = () => {
    state.chatRoomListRequested = true;
    stopVoice();
    clearReplyTimer(roomId);
    closeActiveChat(state);
    if (state.spatialChatUi) {
      state.spatialChatUi.mode = null;
      state.spatialChatUi.gridId = null;
    }
    emit("spatialChat:back");
  };
  panel.querySelector("#gridOpenSpatial").onclick = () => {
    emit("grid:spatialOpen", { gridId });
  };

  panel.querySelector("#favoriteRoom").onclick = () => {
    if (!Array.isArray(state.favoriteRooms)) state.favoriteRooms = [];
    state.favoriteRooms = state.favoriteRooms.includes(roomId)
      ? state.favoriteRooms.filter(x => x !== roomId)
      : [...state.favoriteRooms, roomId];
    emit("state:save");
    renderGridChat(panel, state, gridId);
  };

  panel.querySelectorAll("[data-chatmode]").forEach(b => {
    b.onclick = () => {
      panel.querySelectorAll("[data-chatmode]").forEach(x => x.classList.toggle("active", x === b));
      const mode = b.dataset.chatmode;
      panel.querySelector("#textCompose").style.display = mode === "text" ? "block" : "none";
      panel.querySelector("#voiceCompose").style.display = mode === "voice" ? "block" : "none";
      if (mode !== "voice") stopVoice();
    };
  });

  const textarea = panel.querySelector("#chatText");
  const doSend = () => sendGrid(panel, state, gridId, (textarea?.value || "").trim());
  panel.querySelector("#sendChat").onclick = doSend;
  textarea.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    doSend();
  });
  panel.querySelector("#voiceChat").onclick = () => toggleVoice(panel, state, roomId);
  mountChatUtilities(panel, state, { type: "grid", gridId });

  requestAnimationFrame(() => {
    const s = panel.querySelector("#chatScroll");
    if (s) s.scrollTop = s.scrollHeight;
  });
}

function sendGrid(panel, state, gridId, text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return;
  if (sendBusy) return;
  sendBusy = true;
  const roomId = gridChatRoomId(gridId);
  const room = ensureGridRoom(state, gridId, state.rooms[roomId]?.title);
  const msg = {
    id: nextMessageId(),
    roomId,
    senderId: MY_USER_ID,
    text: cleaned,
    mine: true,
    createdAt: Date.now()
  };
  room.messages.push(msg);
  room.last = cleaned;
  emit("state:save");
  emitMessagePreview({...msg, roomType: "grid"});
  const ta = panel.querySelector("#chatText");
  if (ta) ta.value = "";
  renderGridChat(panel, state, gridId);
  scheduleGridDemoReply(panel, state, gridId);
  sendBusy = false;
}

function scheduleGridDemoReply(panel, state, gridId) {
  const roomId = gridChatRoomId(gridId);
  clearReplyTimer(roomId);
  const timer = setTimeout(() => {
    replyTimers.delete(roomId);
    const room = state.rooms[roomId];
    if (!room || room.type !== "grid") return;
    const users = getUsers().filter(u => u.online);
    const bot = users[Math.floor(Math.random() * Math.max(users.length, 1))] || {id: "u0"};
    const reply = ["빵빵! GRID 안전운전!", "확인했습니다.", "같이 달려요 👍"][
      Math.floor(Math.random() * 3)
    ];
    const replyMsg = {
      id: nextMessageId(),
      roomId,
      senderId: bot.id,
      text: reply,
      mine: false,
      createdAt: Date.now()
    };
    room.messages.push(replyMsg);
    room.last = reply;
    emitMessagePreview({...replyMsg, roomType: "grid"});
    const isOpen = viewMode === "chat" && activeRoomId === roomId && activePanel === panel;
    if (isOpen) {
      room.unread = 0;
      emit("state:save");
      playHorn(state.hornEnabled);
      renderGridChat(panel, state, gridId);
    } else {
      room.unread = Math.max(0, Number(room.unread) || 0) + 1;
      emit("state:save");
      playHorn(state.hornEnabled);
      updateNavBadge(state);
      if (viewMode === "list" && activePanel === panel) renderRooms(panel, state);
    }
  }, 700);
  replyTimers.set(roomId, timer);
}

function toggleVoice(panel, state, peerId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showSystemMessage("이 환경에서는 음성 입력을 지원하지 않습니다.");
    return;
  }

  if (!voiceRecognition) {
    voiceRecognition = new SR();
    voiceRecognition.lang = "ko-KR";
    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = false;
    voiceRecognition.onresult = e => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      chunk = chunk.trim();
      if (!chunk) return;
      // 자동 전송하지 않음 — 입력창에만 채움
      const ta = activePanel?.querySelector("#chatText");
      const textCompose = activePanel?.querySelector("#textCompose");
      const voiceCompose = activePanel?.querySelector("#voiceCompose");
      if (ta) {
        ta.value = ta.value.trim() ? `${ta.value.trim()} ${chunk}` : chunk;
      }
      activePanel?.querySelectorAll("[data-chatmode]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.chatmode === "text");
      });
      if (textCompose) textCompose.style.display = "block";
      if (voiceCompose) voiceCompose.style.display = "none";
    };
    voiceRecognition.onerror = () => {
      stopVoice();
    };
    voiceRecognition.onend = () => {
      if (voiceListening && voiceBoundToRoomId === activeRoomId) {
        try {
          voiceRecognition.start();
        } catch {
          /* ignore */
        }
      }
    };
  }

  if (voiceListening && voiceBoundToRoomId === peerId) {
    stopVoice();
    return;
  }

  stopVoice();
  voiceListening = true;
  voiceBoundToRoomId = peerId;
  const b = panel.querySelector("#voiceChat");
  if (b) {
    b.textContent = "🔴 음성 듣기 종료";
    b.classList.add("voice-listening");
  }
  try {
    voiceRecognition.start();
  } catch (e) {
    stopVoice();
    showSystemMessage("음성 인식을 시작하지 못했습니다.");
  }
}

/** 앱 부팅 후 배지 초기화용 */
export function refreshChatBadge(state) {
  if (!state) return;
  state.rooms = sanitizeRooms(state.rooms);
  updateNavBadge(state);
}

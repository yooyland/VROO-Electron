import {playHorn} from "./sound.js";
import {emit, on} from "../core/events.js";
import {getUsers} from "./map.js";
import {showSystemMessage} from "../core/ui.js";
import {gridChatRoomId, MY_USER_ID} from "./data.js";
import {getGridDisplayName, isSpatialGridId} from "./spatial-grid.js";

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

function nextMessageId() {
  msgIdSeq += 1;
  return `m_${Date.now().toString(36)}_${msgIdSeq.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
  return Object.values(state.rooms).reduce((sum, r) => sum + (Math.max(0, Number(r?.unread) || 0)), 0);
}

function updateNavBadge(state) {
  const btn = document.querySelector('#mainMenu [data-screen="chat"]');
  if (!btn) return;
  const n = totalUnread(state);
  let badge = btn.querySelector(".chat-unread-badge");
  if (n <= 0) {
    if (badge) badge.remove();
    btn.classList.remove("has-unread");
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "chat-unread-badge";
    btn.appendChild(badge);
  }
  badge.textContent = n > 99 ? "99+" : String(n);
  btn.classList.add("has-unread");
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

export function renderRooms(panel, state) {
  bindUsersListener();
  stopVoice();
  activePanel = panel;
  activeState = state;
  activeRoomId = null;
  viewMode = "list";

  state.rooms = sanitizeRooms(state.rooms);
  const rooms = Object.values(state.rooms).sort((a, b) => {
    const fa = state.favoriteRooms?.includes(b.id) ? 1 : 0;
    const fb = state.favoriteRooms?.includes(a.id) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    return (b.unread || 0) - (a.unread || 0);
  });

  panel.innerHTML = `<div class="card"><b>대화방</b><div class="muted">즐겨찾기 대화방은 위에 표시됩니다.</div></div>${
    rooms.length
      ? rooms
          .map(r => {
            const unread = Math.max(0, Number(r.unread) || 0);
            if (r.type === "grid") {
              return `<div class="card room-row" data-room-type="grid">
              <div class="avatar">${state.favoriteRooms?.includes(r.id) ? "★" : "👥"}</div>
              <div>
                <b>${escapeHtml(r.title || "GRID 대화")}</b>
                <div class="muted">GRID 단체 · ${escapeHtml(r.last || "대화를 시작하세요")}</div>
              </div>
              <div class="room-actions">
                <span class="chat-room-unread" data-room-unread="${escapeHtml(r.id)}" ${unread ? "" : "hidden"}>${unread > 99 ? "99+" : unread}</span>
                <button class="secondary" data-room="${escapeHtml(r.id)}" data-open-grid="${escapeHtml(r.gridId || "")}" type="button">열기</button>
              </div>
            </div>`;
            }
            const peer = liveUser(r.peerId || r.id, r.user);
            return `<div class="card room-row" data-peer-id="${escapeHtml(peer.id)}">
              <div class="avatar">${state.favoriteRooms?.includes(r.id) ? "★" : "🚘"}</div>
              <div>
                <b data-peer-title>${escapeHtml(peer.nickname || r.title)}</b>
                <div class="muted"><span class="status-dot ${peer.online ? "online" : "offline"}" data-online-dot></span> <span data-online-text>${onlineLabel(peer)}</span> · ${escapeHtml(r.last || "대화를 시작하세요")}</div>
              </div>
              <div class="room-actions">
                <span class="chat-room-unread" data-room-unread="${escapeHtml(r.id)}" ${unread ? "" : "hidden"}>${unread > 99 ? "99+" : unread}</span>
                <button class="secondary" data-room="${escapeHtml(r.id)}" type="button">열기</button>
              </div>
            </div>`;
          })
          .join("")
      : '<div class="card muted">아직 대화방이 없습니다.</div>'
  }`;

  panel.querySelectorAll("[data-room]").forEach(b => {
    b.onclick = () => {
      const gridId = b.getAttribute("data-open-grid");
      if (gridId) {
        openGridChat(panel, state, gridId);
        return;
      }
      const id = b.dataset.room;
      openChatWith(panel, state, liveUser(id, state.rooms[id]?.user));
    };
  });
  updateNavBadge(state);
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
  emit("state:save");
  updateNavBadge(state);
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
        <div class="muted chat-peer-meta" data-peer-meta>${peer.plate ? `${escapeHtml(peer.plate)} · ` : ""}Lv.${peer.level ?? "?"} · <span class="status-dot ${peer.online ? "online" : "offline"}" data-online-dot></span> <span data-online-text>${onlineLabel(peer)}</span></div>
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
    stopVoice();
    clearReplyTimer(peerId);
    activeRoomId = null;
    viewMode = "list";
    renderRooms(panel, state);
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
  room.messages.push({
    id: nextMessageId(),
    text: cleaned,
    mine: true,
    senderId: MY_USER_ID,
    createdAt: Date.now(),
    roomId: peerId
  });
  room.last = cleaned;
  emit("state:save");

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
    room.messages.push({
      id: nextMessageId(),
      text: reply,
      mine: false,
      senderId: peerId,
      createdAt: Date.now(),
      roomId: peerId
    });
    room.last = reply;

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
  emit("state:save");
  updateNavBadge(state);
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

  panel.innerHTML = `<div class="chat-shell">
    <div class="card chat-header">
      <button class="secondary" id="chatBack" type="button">←</button>
      <div class="chat-header-main">
        <b class="chat-peer-name">${escapeHtml(room.title || "GRID 대화")}</b>
        <div class="muted chat-peer-meta">${isSpatialGridId(gridId) ? "Spatial GRID 단체 대화" : "GRID 단체 대화"}</div>
      </div>
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
        <button class="secondary" id="voiceChat" type="button" style="width:100%;padding:14px">🎙️ 음성 듣기 시작</button>
        <div class="muted" style="margin-top:8px">인식 결과가 입력창에 채워집니다. 확인 후 전송하세요.</div>
      </div>
    </div>
  </div>`;

  panel.querySelector("#chatBack").onclick = () => {
    stopVoice();
    clearReplyTimer(roomId);
    activeRoomId = null;
    viewMode = "list";
    renderRooms(panel, state);
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
  room.messages.push({
    id: nextMessageId(),
    roomId,
    senderId: MY_USER_ID,
    text: cleaned,
    mine: true,
    createdAt: Date.now()
  });
  room.last = cleaned;
  emit("state:save");
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
    room.messages.push({
      id: nextMessageId(),
      roomId,
      senderId: bot.id,
      text: reply,
      mine: false,
      createdAt: Date.now()
    });
    room.last = reply;
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

import {playHorn} from "./sound.js";
import {emit, on} from "../core/events.js";
import {getUsers} from "./map.js";
import {showSystemMessage} from "../core/ui.js";
import {gridChatRoomId, MY_USER_ID, SEED_GRIDS} from "./data.js";
import {
  approveSpeaker,
  ensureVoiceSession,
  removeSpeaker,
  requestToSpeak,
  setParticipantBlocked,
  setParticipantMuted,
  transitionVoiceState,
  VOICE_ROLES,
  VOICE_STATES
} from "./voice-session.js";
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
let voiceReconnectTimer = null;

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

function ensureChatComposeModes(state) {
  if (!state.chatComposeModes || typeof state.chatComposeModes !== "object") {
    state.chatComposeModes = {};
  }
  return state.chatComposeModes;
}

function getChatComposeMode(state, roomId) {
  return ensureChatComposeModes(state)[roomId] === "voice" ? "voice" : "text";
}

function setChatComposeMode(state, roomId, mode) {
  ensureChatComposeModes(state)[roomId] = mode === "voice" ? "voice" : "text";
  emit("state:save");
}

function ensureVoicePreferences(state, roomId) {
  if (!state.voicePreferences || typeof state.voicePreferences !== "object") {
    state.voicePreferences = {};
  }
  const current = state.voicePreferences[roomId] || {};
  const profiles = ["device-default", "male-calm", "male-bright", "female-calm", "female-bright"];
  const legacyMap = {default: "device-default", low: "male-calm", high: "female-bright"};
  const preferences = {
    listening: current.listening !== false,
    volume: Math.min(100, Math.max(0, Number(current.volume) || 80)),
    myVoice: profiles.includes(current.myVoice) ? current.myVoice : (legacyMap[current.myVoice || current.voice] || "male-calm"),
    otherVoice: profiles.includes(current.otherVoice) ? current.otherVoice : (legacyMap[current.otherVoice] || "female-calm"),
    autoParticipantVoices: current.autoParticipantVoices !== false,
    autoListen: current.autoListen !== false,
    keepOnGridChange: current.keepOnGridChange === true
  };
  state.voicePreferences[roomId] = preferences;
  return preferences;
}

function voiceStatusLabel(session) {
  const reasonLabels = {
    "permission-denied": "마이크 권한이 필요합니다",
    "microphone-missing": "사용 가능한 마이크가 없습니다",
    "network-error": "음성 연결을 다시 시도합니다",
    "no-speech": "음성이 감지되지 않았습니다",
    "start-failed": "마이크를 시작하지 못했습니다"
  };
  if (session?.reason && reasonLabels[session.reason]) return reasonLabels[session.reason];
  const labels = {
    idle: "음성 대기",
    listening: "듣기·음성 인식 중",
    requesting: "발언 요청 중",
    queued: "발언 대기",
    speaking: "말하는 중",
    muted: "듣기 꺼짐",
    reconnecting: "재연결 중",
    blocked: "이용 제한"
  };
  return labels[session?.state] || "음성 대기";
}

function voiceParticipantIds(state, roomId, roomType) {
  const context = state?.activeConversationContext;
  const contextual = context?.roomId === roomId && Array.isArray(context.participantIds)
    ? context.participantIds
    : [];
  const fallback = roomType === "direct" ? [MY_USER_ID, roomId] : [MY_USER_ID];
  return [...new Set([...fallback, ...contextual].map(String).filter(Boolean))];
}

function voiceParticipantName(state, userId) {
  if (userId === MY_USER_ID) return state.profile?.nickname || "나";
  const user = getUsers().find((item) => String(item?.id) === String(userId));
  return user?.nickname || state.rooms?.[userId]?.title || userId;
}

function voiceParticipantState(session, userId) {
  if (session.blockedIds.includes(userId)) return {key: "blocked", label: "차단"};
  if (session.mutedIds.includes(userId)) return {key: "muted", label: "음소거"};
  if (session.speakerIds.includes(userId)) return {key: "speaker", label: "발언 중"};
  if (session.requestQueue.includes(userId)) return {key: "queued", label: "발언 대기"};
  return {key: "listener", label: "듣는 중"};
}

function voiceParticipantRows(state, roomId, roomType) {
  const session = ensureVoiceSession(state, roomId);
  const canModerate = session.hostId === MY_USER_ID || session.moderatorIds.includes(MY_USER_ID);
  return voiceParticipantIds(state, roomId, roomType).map((userId) => {
    const status = voiceParticipantState(session, userId);
    const online = userId === MY_USER_ID || getUsers().some((item) => String(item?.id) === userId && item.online);
    const isSelf = userId === MY_USER_ID;
    const role = userId === session.hostId
      ? "방장"
      : session.moderatorIds.includes(userId)
        ? "관리자"
        : session.speakerIds.includes(userId)
          ? "발언자"
          : "참여자";
    const controls = canModerate && !isSelf
      ? `<div class="chat-voice-member-actions">
          <button type="button" data-voice-member-action="allow" data-user-id="${escapeHtml(userId)}">${session.speakerIds.includes(userId) ? "내리기" : "허용"}</button>
          <button type="button" data-voice-member-action="mute" data-user-id="${escapeHtml(userId)}">${session.mutedIds.includes(userId) ? "음소거 해제" : "음소거"}</button>
          <button type="button" data-voice-member-action="block" data-user-id="${escapeHtml(userId)}">${session.blockedIds.includes(userId) ? "차단 해제" : "차단"}</button>
        </div>`
      : `<div class="chat-voice-member-actions"><span>${isSelf ? "내 음성 상태" : "청취 전용"}</span></div>`;
    return `<div class="chat-voice-member" data-member-state="${status.key}">
      <span class="chat-voice-member-avatar">${escapeHtml(voiceParticipantName(state, userId).slice(0, 1))}</span>
      <div class="chat-voice-member-copy">
        <b>${escapeHtml(voiceParticipantName(state, userId))}${isSelf ? " · 나" : ""}</b>
        <small><i class="${online ? "online" : ""}"></i>${role} · ${status.label}</small>
      </div>
      ${controls}
    </div>`;
  }).join("");
}

function voiceParticipantsPopupMarkup(state, roomId, roomType) {
  return `<div class="chat-voice-participant-popup" data-voice-participant-popup hidden>
    <div class="chat-voice-participant-card" role="dialog" aria-modal="true" aria-label="음성 참여자 관리">
      <div class="chat-voice-participant-head">
        <div><b>음성 참여자</b><small>발언 요청·허용·음소거·차단</small></div>
        <button class="secondary" type="button" data-close-voice-participants aria-label="음성 참여자 닫기">×</button>
      </div>
      <div class="chat-voice-member-list" data-voice-member-list>${voiceParticipantRows(state, roomId, roomType)}</div>
      <div class="chat-voice-participant-foot">현재 단계의 권한·상태 제어는 로컬 프로토타입이며 실제 음성 서버 연결 후 동기화됩니다.</div>
    </div>
  </div>`;
}

function voiceControlsMarkup(state, roomId, roomType) {
  if (!state.voiceHosts || typeof state.voiceHosts !== "object") state.voiceHosts = {};
  const hostId = state.voiceHosts[roomId] || MY_USER_ID;
  state.voiceHosts[roomId] = hostId;
  const session = ensureVoiceSession(state, roomId, {
    hostId,
    role: hostId === MY_USER_ID ? VOICE_ROLES.HOST : (roomType === "grid" ? VOICE_ROLES.LISTENER : VOICE_ROLES.SPEAKER),
    mode: roomType === "grid" ? "approval" : "open"
  });
  const prefs = ensureVoicePreferences(state, roomId);
  const recognizing = voiceListening && voiceBoundToRoomId === roomId;
  const requestControl = roomType === "grid"
    ? '<button class="secondary chat-voice-control" type="button" data-voice-request><span>✋</span><small>발언 요청</small></button>'
    : "";
  return `
    <div class="chat-voice-status" data-voice-state="${escapeHtml(session.state)}">
      <span class="chat-voice-dot" aria-hidden="true"></span>
      <div><b data-voice-status>${escapeHtml(voiceStatusLabel(session))}</b><small data-voice-detail>이 방의 음성모드는 계속 유지됩니다.</small></div>
    </div>
    <div class="chat-voice-toolbar">
      <button class="secondary chat-voice-control ${prefs.listening ? "is-active" : ""}" type="button" data-voice-listen aria-pressed="${prefs.listening}">
        <span>${prefs.listening ? "🔊" : "🔇"}</span><small>듣기 ${prefs.listening ? "ON" : "OFF"}</small>
      </button>
      <button class="secondary chat-voice-control ${recognizing ? "is-active" : ""}" id="voiceChat" type="button" aria-pressed="${recognizing}">
        <span>🎙️</span><small>${recognizing ? "마이크 끄기" : "마이크"}</small>
      </button>
      ${requestControl}
      <button class="secondary chat-voice-control" type="button" data-voice-participants>
        <span>👥</span><small>참여자</small>
      </button>
      <button class="secondary chat-voice-control" type="button" data-voice-settings aria-expanded="false">
        <span>⚙️</span><small>설정</small>
      </button>
    </div>
    <div class="chat-voice-settings" data-voice-settings-panel hidden>
      <label><span>상대 목소리 크기</span><input type="range" min="0" max="100" value="${prefs.volume}" data-voice-volume><output data-voice-volume-output>${prefs.volume}%</output></label>
      <label><span>내 글 목소리</span><select data-my-voice-choice>
        <option value="device-default" ${prefs.myVoice === "device-default" ? "selected" : ""}>기기 기본 목소리</option>
        <option value="male-calm" ${prefs.myVoice === "male-calm" ? "selected" : ""}>남성 1 · 차분</option>
        <option value="male-bright" ${prefs.myVoice === "male-bright" ? "selected" : ""}>남성 2 · 활기</option>
        <option value="female-calm" ${prefs.myVoice === "female-calm" ? "selected" : ""}>여성 1 · 편안</option>
        <option value="female-bright" ${prefs.myVoice === "female-bright" ? "selected" : ""}>여성 2 · 밝음</option>
      </select><button type="button" class="secondary chat-voice-preview" data-preview-voice="mine">미리듣기</button></label>
      <label><span>상대 글 목소리</span><select data-other-voice-choice>
        <option value="device-default" ${prefs.otherVoice === "device-default" ? "selected" : ""}>기기 기본 목소리</option>
        <option value="male-calm" ${prefs.otherVoice === "male-calm" ? "selected" : ""}>남성 1 · 차분</option>
        <option value="male-bright" ${prefs.otherVoice === "male-bright" ? "selected" : ""}>남성 2 · 활기</option>
        <option value="female-calm" ${prefs.otherVoice === "female-calm" ? "selected" : ""}>여성 1 · 편안</option>
        <option value="female-bright" ${prefs.otherVoice === "female-bright" ? "selected" : ""}>여성 2 · 밝음</option>
      </select><button type="button" class="secondary chat-voice-preview" data-preview-voice="other">미리듣기</button></label>
      <label class="chat-voice-check"><input type="checkbox" data-auto-participant-voices ${prefs.autoParticipantVoices ? "checked" : ""}><span>GRID 참여자마다 목소리 자동 구분</span></label>
      <label class="chat-voice-check"><input type="checkbox" data-voice-auto-listen ${prefs.autoListen ? "checked" : ""}><span>음성 탭을 열면 자동 듣기</span></label>
      <label class="chat-voice-check"><input type="checkbox" data-voice-keep-grid ${prefs.keepOnGridChange ? "checked" : ""}><span>GRID가 바뀌어도 음성모드 유지</span></label>
      <p>방장·관리자의 발언 허용/차단은 참여자 화면에서 설정합니다.</p>
    </div>
    <div class="chat-voice-transcript" data-voice-transcript hidden></div>
    <div class="muted chat-voice-notice">음성인식은 현재 사용할 수 있으며, 실시간 상대 음성 송수신은 음성 서버 연결 후 활성화됩니다.</div>
    ${voiceParticipantsPopupMarkup(state, roomId, roomType)}`;
}

function updateVoiceStatusUi(panel, session) {
  const host = panel?.querySelector?.(".chat-voice-status");
  if (!host || !session) return;
  host.dataset.voiceState = session.state;
  const label = host.querySelector("[data-voice-status]");
  if (label) label.textContent = voiceStatusLabel(session);
  const detail = host.querySelector("[data-voice-detail]");
  if (detail) {
    detail.textContent = session.reason
      ? "음성모드는 유지됩니다. 마이크 버튼으로 다시 시도할 수 있습니다."
      : "이 방의 음성모드는 계속 유지됩니다.";
  }
  const microphone = panel.querySelector("#voiceChat");
  if (microphone && [VOICE_STATES.BLOCKED, VOICE_STATES.RECONNECTING].includes(session.state)) {
    const text = microphone.querySelector("small");
    if (text) text.textContent = session.state === VOICE_STATES.RECONNECTING ? "재연결 중" : "다시 시도";
  }
  const request = panel.querySelector("[data-voice-request]");
  if (request) {
    request.disabled = session.state === VOICE_STATES.QUEUED || session.state === VOICE_STATES.REQUESTING;
    const text = request.querySelector("small");
    if (text) text.textContent = session.state === VOICE_STATES.QUEUED ? "발언 대기" : "발언 요청";
  }
}

function refreshVoiceParticipantRows(panel, state, roomId, roomType) {
  const list = panel?.querySelector?.("[data-voice-member-list]");
  if (list) list.innerHTML = voiceParticipantRows(state, roomId, roomType);
}

function bindVoiceParticipantActions(panel, state, roomId, roomType) {
  const popup = panel?.querySelector?.("[data-voice-participant-popup]");
  const opener = panel?.querySelector?.("[data-voice-participants]");
  const close = panel?.querySelector?.("[data-close-voice-participants]");
  if (!popup || !opener || !close) return;

  const closePopup = () => {
    popup.hidden = true;
    opener.focus();
  };
  opener.onclick = () => {
    refreshVoiceParticipantRows(panel, state, roomId, roomType);
    popup.hidden = false;
    close.focus();
  };
  close.onclick = closePopup;
  popup.onclick = (event) => {
    if (event.target === popup) closePopup();
  };
  popup.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePopup();
    }
  };

  popup.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-voice-member-action]");
    if (!button) return;
    const userId = String(button.dataset.userId || "");
    const action = button.dataset.voiceMemberAction;
    const session = ensureVoiceSession(state, roomId);
    if (action === "allow") {
      if (session.speakerIds.includes(userId)) removeSpeaker(session, userId, MY_USER_ID);
      else approveSpeaker(session, userId, MY_USER_ID);
    } else if (action === "mute") {
      setParticipantMuted(session, userId, !session.mutedIds.includes(userId), MY_USER_ID);
    } else if (action === "block") {
      setParticipantBlocked(session, userId, !session.blockedIds.includes(userId), MY_USER_ID);
    }
    refreshVoiceParticipantRows(panel, state, roomId, roomType);
    updateVoiceStatusUi(panel, session);
    emit("state:save");
  });
}

function bindVoiceRequestControls(panel, state, roomId, roomType) {
  const prefs = ensureVoicePreferences(state, roomId);
  const request = panel?.querySelector?.("[data-voice-request]");
  if (request) {
    request.onclick = () => {
      const session = ensureVoiceSession(state, roomId);
      if (!requestToSpeak(session, MY_USER_ID)) return;
      transitionVoiceState(session, VOICE_STATES.QUEUED, "awaiting approval");
      updateVoiceStatusUi(panel, session);
      emit("state:save");
    };
  }

  const listen = panel?.querySelector?.("[data-voice-listen]");
  if (listen) {
    listen.onclick = () => {
      prefs.listening = !prefs.listening;
      listen.classList.toggle("is-active", prefs.listening);
      listen.setAttribute("aria-pressed", String(prefs.listening));
      const icon = listen.querySelector("span");
      const text = listen.querySelector("small");
      if (icon) icon.textContent = prefs.listening ? "🔊" : "🔇";
      if (text) text.textContent = `듣기 ${prefs.listening ? "ON" : "OFF"}`;
      const session = ensureVoiceSession(state, roomId);
      transitionVoiceState(session, prefs.listening ? VOICE_STATES.LISTENING : VOICE_STATES.MUTED);
      updateVoiceStatusUi(panel, session);
      if (!prefs.listening) window.speechSynthesis?.cancel?.();
      emit("state:save");
    };
  }

  const settings = panel?.querySelector?.("[data-voice-settings]");
  const settingsPanel = panel?.querySelector?.("[data-voice-settings-panel]");
  if (settings && settingsPanel) {
    settings.onclick = () => {
      const open = settingsPanel.hidden;
      settingsPanel.hidden = !open;
      settings.classList.toggle("is-active", open);
      settings.setAttribute("aria-expanded", String(open));
    };
  }

  const volume = panel?.querySelector?.("[data-voice-volume]");
  if (volume) {
    volume.oninput = () => {
      prefs.volume = Number(volume.value);
      const output = panel.querySelector("[data-voice-volume-output]");
      if (output) output.textContent = `${prefs.volume}%`;
      emit("state:save");
    };
  }
  const myVoiceChoice = panel?.querySelector?.("[data-my-voice-choice]");
  if (myVoiceChoice) myVoiceChoice.onchange = () => { prefs.myVoice = myVoiceChoice.value; emit("state:save"); };
  const otherVoiceChoice = panel?.querySelector?.("[data-other-voice-choice]");
  if (otherVoiceChoice) otherVoiceChoice.onchange = () => { prefs.otherVoice = otherVoiceChoice.value; emit("state:save"); };
  const autoParticipantVoices = panel?.querySelector?.("[data-auto-participant-voices]");
  if (autoParticipantVoices) autoParticipantVoices.onchange = () => {
    prefs.autoParticipantVoices = autoParticipantVoices.checked;
    emit("state:save");
  };
  panel?.querySelectorAll?.("[data-preview-voice]").forEach((button) => {
    button.onclick = () => {
      const profile = button.dataset.previewVoice === "mine" ? prefs.myVoice : prefs.otherVoice;
      previewVoiceProfile(profile, prefs.volume);
    };
  });
  const autoListen = panel?.querySelector?.("[data-voice-auto-listen]");
  if (autoListen) autoListen.onchange = () => { prefs.autoListen = autoListen.checked; emit("state:save"); };
  const keepGrid = panel?.querySelector?.("[data-voice-keep-grid]");
  if (keepGrid) keepGrid.onchange = () => { prefs.keepOnGridChange = keepGrid.checked; emit("state:save"); };

  bindVoiceParticipantActions(panel, state, roomId, roomType);
}

function stopVoice() {
  const stoppedRoomId = voiceBoundToRoomId;
  voiceListening = false;
  voiceBoundToRoomId = null;
  try {
    voiceRecognition?.stop();
  } catch {
    /* ignore */
  }
  const b = activePanel?.querySelector("#voiceChat");
  if (b) {
    b.classList.remove("voice-listening", "is-active");
    b.setAttribute("aria-pressed", "false");
    const text = b.querySelector("small");
    if (text) text.textContent = "마이크";
  }
  if (stoppedRoomId && activeState) {
    const session = ensureVoiceSession(activeState, stoppedRoomId);
    transitionVoiceState(session, VOICE_STATES.IDLE);
    updateVoiceStatusUi(activePanel, session);
  }
}

function ensureVoiceReadIds(state, roomId) {
  if (!state.voiceReadMessageIds || typeof state.voiceReadMessageIds !== "object") {
    state.voiceReadMessageIds = {};
  }
  if (!Array.isArray(state.voiceReadMessageIds[roomId])) {
    state.voiceReadMessageIds[roomId] = [];
  }
  return state.voiceReadMessageIds[roomId];
}

function speechFriendlyText(value) {
  return String(value || "")
    .replace(/👍(?:🏻|🏼|🏽|🏾|🏿)?/gu, " 좋아요 ")
    .replace(/👎(?:🏻|🏼|🏽|🏾|🏿)?/gu, " 싫어요 ")
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*/gu, " ")
    .replace(/[\uFE0E\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function koreanDeviceVoices() {
  if (!window.speechSynthesis?.getVoices) return [];
  const voices = window.speechSynthesis.getVoices();
  const korean = voices.filter((voice) => String(voice.lang || "").toLowerCase().startsWith("ko"));
  return korean.length ? korean : voices;
}

function voiceProfileIndex(profile) {
  return {
    "device-default": 0,
    "male-calm": 0,
    "male-bright": 1,
    "female-calm": 2,
    "female-bright": 3
  }[profile] || 0;
}

function applySpeechProfile(utterance, profile) {
  const voices = koreanDeviceVoices();
  if (voices.length) utterance.voice = voices[voiceProfileIndex(profile) % voices.length];
  const settings = {
    "device-default": {pitch: 1, rate: 1},
    "male-calm": {pitch: 0.78, rate: 0.93},
    "male-bright": {pitch: 0.9, rate: 1.06},
    "female-calm": {pitch: 1.08, rate: 0.94},
    "female-bright": {pitch: 1.24, rate: 1.07}
  }[profile] || {pitch: 1, rate: 1};
  utterance.pitch = settings.pitch;
  utterance.rate = settings.rate;
}

function previewVoiceProfile(profile, volume = 80) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  const utterance = new SpeechSynthesisUtterance("안녕하세요. 부르 기본 목소리입니다.");
  utterance.lang = "ko-KR";
  utterance.volume = Math.min(1, Math.max(0, Number(volume) / 100));
  applySpeechProfile(utterance, profile);
  window.speechSynthesis.speak(utterance);
}

function participantVoiceProfile(senderId) {
  const profiles = ["male-calm", "female-calm", "male-bright", "female-bright"];
  const hash = [...String(senderId || "")].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
  return profiles[hash % profiles.length];
}

function speakPendingMessages(state, roomId) {
  const prefs = ensureVoicePreferences(state, roomId);
  if (!prefs.listening || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  const room = state?.rooms?.[roomId];
  if (!Array.isArray(room?.messages)) return;

  const readIds = ensureVoiceReadIds(state, roomId);
  const readSet = new Set(readIds);
  let changed = false;

  for (const rawMessage of room.messages) {
    const message = normalizeMessage(rawMessage, room.peerId || "unknown", MY_USER_ID, roomId);
    if (!message?.id || readSet.has(message.id)) continue;

    const spokenText = speechFriendlyText(message.text);
    readSet.add(message.id);
    readIds.push(message.id);
    changed = true;
    if (!spokenText) continue;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = "ko-KR";
    utterance.volume = prefs.volume / 100;
    const profile = message.mine
      ? prefs.myVoice
      : (room.type === "grid" && prefs.autoParticipantVoices ? participantVoiceProfile(message.senderId) : prefs.otherVoice);
    applySpeechProfile(utterance, profile);
    window.speechSynthesis.speak(utterance);
  }

  if (readIds.length > 300) {
    state.voiceReadMessageIds[roomId] = readIds.slice(-300);
  }
  if (changed) emit("state:save");
}

function activateVoiceMode(panel, state, roomId) {
  const prefs = ensureVoicePreferences(state, roomId);
  speakPendingMessages(state, roomId);
  if (prefs.autoListen && (!voiceListening || voiceBoundToRoomId !== roomId)) {
    toggleVoice(panel, state, roomId);
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
const CHAT_PHRASE_GROUPS = [
  { id: "drive", label: "안전운전", phrases: ["안전운전하세요 😊", "앞쪽이 정체입니다.", "천천히 따라오세요.", "먼저 지나가세요."] },
  { id: "meet", label: "만남·이동", phrases: ["여기서 만나요!", "곧 도착합니다.", "지금 출발합니다.", "잠시만 기다려주세요."] },
  { id: "reply", label: "확인·응답", phrases: ["확인했습니다.", "좋아요 👍", "감사합니다.", "잠시 후 연락드릴게요."] },
  { id: "urgent", label: "긴급·도움", phrases: ["도움이 필요합니다.", "사고가 발생했습니다.", "긴급차량이 지나갑니다.", "안전한 곳에 정차해주세요."] }
];

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
        <button type="button" class="chat-command-unread" data-chat-popup="unread" aria-haspopup="dialog">읽지 않음 <strong>${by.road + by.nearby + by.grid + by.direct + by.room}</strong></button>
        <div class="chat-command-gifts" aria-label="자주 쓰는 상품">
          <button type="button" class="chat-gift-main" data-chat-popup="gifts" aria-haspopup="dialog">선물</button>
          ${CHAT_FAVORITE_GIFTS.map(g => `<button type="button" data-chat-popup="${escapeHtml(g.id)}" aria-haspopup="dialog"><span>${g.icon}</span>${escapeHtml(g.label)}</button>`).join("")}
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
            <div class="chat-map-chat-menu">
              <button type="button" class="secondary chat-map-chat-toggle" data-map-grid-chat-toggle aria-expanded="false">
                주변지도 대화 <span aria-hidden="true">▾</span>
              </button>
              <div class="chat-map-chat-list" data-map-grid-chat-list hidden>
                ${grids.length
                  ? grids.map((room) => `<button type="button" data-map-grid-chat="${escapeHtml(room.gridId || "")}">
                    <b>${escapeHtml(room.title || "GRID 대화")}</b>
                    <small>${escapeHtml(room.last || "대화를 시작하세요")}</small>
                  </button>`).join("")
                  : '<div class="muted">참여 가능한 GRID 채팅이 없습니다.</div>'}
              </div>
            </div>
          </div>
          <div class="chat-map-grid-lines" aria-hidden="true"></div>
          ${nearbyPreviewHtml}
          ${mapMarkers || '<div class="chat-map-empty">주변 차량을 찾는 중입니다.</div>'}
          <button type="button" class="chat-my-location" data-open-nearby-map><span></span>나</button>
        </section>

        <aside class="chat-live-rail">
          <div class="chat-live-scroll" data-chat-room-host>
            ${gridHtml}
            ${directHtml}
            ${roomHtml}
          </div>
        </aside>
        <div class="chat-workspace-popup" data-chat-tools-popup hidden role="dialog" aria-modal="true" aria-label="대화 도구">
          <div class="chat-workspace-popup-card">
            <div class="chat-third-popup-head">
              <b data-chat-popup-title>대화 도구</b>
              <button type="button" class="secondary" data-chat-popup-close aria-label="닫기">×</button>
            </div>
            <div class="chat-third-popup-body" data-chat-popup-body></div>
          </div>
        </div>
      </div>
      <section class="chat-bottom-phrase-drawer" aria-label="상용구 모음">
        <div class="chat-bottom-phrase-row">
          <button type="button" class="chat-phrase-toggle" data-chat-popup="phrases" aria-haspopup="dialog">
            <span>▲ 상용구</span>
          </button>
          <div class="chat-pinned-phrases">
            ${ensureChatUtilities(state).pinnedPhrases.map(p => `<button type="button" data-list-phrase="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
          </div>
        </div>
      </section>
      ${showSpatial && history.length ? `<section class="chat-command-below chat-history-collapsed" aria-label="최근 공간 대화 기록">${historyHtml}</section>` : ""}
    </div>`;

  const roomHost = panel.querySelector("[data-chat-room-host]");
  const listUtil = ensureChatUtilities(state);
  const toolsPopup = panel.querySelector("[data-chat-tools-popup]");
  const popupTitle = panel.querySelector("[data-chat-popup-title]");
  const popupBody = panel.querySelector("[data-chat-popup-body]");
  let popupTrigger = null;
  const closeToolsPopup = () => {
    if (!toolsPopup) return;
    toolsPopup.hidden = true;
    popupTrigger?.focus?.();
    popupTrigger = null;
  };
  const sendToolText = (text) => {
    const openTextarea = roomHost?.querySelector?.("#chatText");
    const openSend = roomHost?.querySelector?.("#sendChat");
    if (openTextarea && openSend) {
      openTextarea.value = text;
      openSend.click();
      closeToolsPopup();
      return;
    }
    state.chatUtilities.pendingText = text;
    emit("state:save");
    closeToolsPopup();
    showSystemMessage("보낼 대화방을 선택하세요.");
  };
  const giftButtonsHtml = (selectedId = "") => CHAT_FAVORITE_GIFTS
    .filter((gift) => !selectedId || gift.id === selectedId)
    .map((gift) => `<button type="button" class="chat-popup-action" data-popup-gift="${escapeHtml(gift.id)}"><span>${gift.icon}</span><b>${escapeHtml(gift.label)}</b><small>현재 대화 상대에게 보내기</small></button>`)
    .join("");
  const phraseOptionHtml = (phrase, custom = false) => {
    const pinned = listUtil.pinnedPhrases.includes(phrase);
    return `<span class="chat-phrase-option">
      <button type="button" data-popup-phrase="${escapeHtml(phrase)}">${escapeHtml(phrase)}</button>
      <button type="button" class="chat-phrase-pin ${pinned ? "is-pinned" : ""}" data-popup-pin-phrase="${escapeHtml(phrase)}" aria-pressed="${pinned}">${pinned ? "진열 해제" : "진열 등록"}</button>
      ${custom ? `<button type="button" class="chat-phrase-delete" data-popup-delete-phrase="${escapeHtml(phrase)}" aria-label="사용자 상용구 삭제">×</button>` : ""}
    </span>`;
  };
  const phrasePopupHtml = () => `
    <div class="chat-phrase-groups">
      ${CHAT_PHRASE_GROUPS.map((group) => `<section class="chat-phrase-group">
        <h4>${escapeHtml(group.label)}</h4>
        <div>${group.phrases.map((phrase) => phraseOptionHtml(phrase)).join("")}</div>
      </section>`).join("")}
      <section class="chat-phrase-group chat-custom-group">
        <h4>사용자 설정 상용구</h4>
        <div class="chat-saved-custom-phrases">
          ${listUtil.customPhrases.length
            ? listUtil.customPhrases.map((phrase) => phraseOptionHtml(phrase, true)).join("")
            : '<small class="muted">저장한 사용자 상용구가 없습니다.</small>'}
        </div>
        <div class="chat-custom-phrase">
          <input type="text" maxlength="60" placeholder="사용자 상용구를 입력하세요" data-popup-custom-input>
          <button type="button" class="primary" data-popup-custom-save>저장</button>
        </div>
      </section>
    </div>`;
  const roomPopupHtml = (kind) => {
    const cards = [];
    if (kind === "all" || kind === "spatial") {
      grids.forEach((room) => cards.push(`<button type="button" class="chat-popup-room" data-popup-grid="${escapeHtml(room.gridId || "")}">
        <span>${convoIcon("grid")}</span><b>${escapeHtml(room.title || "GRID 대화")}</b><small>${escapeHtml(room.last || "대화를 시작하세요")}</small>
      </button>`));
    }
    if (kind === "all" || kind === "direct") {
      directs.forEach((room) => cards.push(`<button type="button" class="chat-popup-room" data-popup-room="${escapeHtml(room.id)}">
        <span>${convoIcon("direct")}</span><b>${escapeHtml(room.title || room.user?.nickname || "1:1 대화")}</b><small>${escapeHtml(room.last || "대화를 시작하세요")}</small>
      </button>`));
    }
    if (kind === "all" || kind === "room") {
      rooms.forEach((room) => cards.push(`<button type="button" class="chat-popup-room" data-popup-room="${escapeHtml(room.id)}">
        <span>${convoIcon("direct")}</span><b>${escapeHtml(room.title || "대화방")}</b><small>${escapeHtml(room.last || "대화를 시작하세요")}</small>
      </button>`));
    }
    return `<div class="chat-popup-room-list">${cards.join("") || '<div class="muted">표시할 대화방이 없습니다.</div>'}</div>`;
  };
  const openToolsPopup = (button) => {
    if (!toolsPopup || !popupTitle || !popupBody) return;
    popupTrigger = button;
    const kind = button.dataset.chatPopup || "gifts";
    if (kind === "unread") {
      popupTitle.textContent = "읽지 않은 대화";
      popupBody.innerHTML = `<div class="chat-unread-summary">
        <button type="button" data-popup-filter="direct"><b>1:1</b><strong>${by.direct}</strong></button>
        <button type="button" data-popup-filter="spatial"><b>GRID</b><strong>${by.grid}</strong></button>
        <button type="button" data-popup-filter="spatial"><b>도로·주변</b><strong>${by.road + by.nearby}</strong></button>
        <button type="button" data-popup-filter="room"><b>단체·친구</b><strong>${by.room}</strong></button>
      </div>`;
    } else if (kind === "phrases") {
      popupTitle.textContent = "상황별 상용구";
      popupBody.innerHTML = phrasePopupHtml();
    } else if (kind.startsWith("rooms:")) {
      const roomKind = kind.slice(6) || "all";
      const labels = { all: "전체 대화방", spatial: "공간·GRID 대화방", direct: "1:1 대화방", room: "친구·단체 대화방" };
      popupTitle.textContent = labels[roomKind] || "대화방 목록";
      popupBody.innerHTML = roomPopupHtml(roomKind);
    } else {
      const gift = CHAT_FAVORITE_GIFTS.find((item) => item.id === kind);
      popupTitle.textContent = gift ? `${gift.icon} ${gift.label} 보내기` : "자주 쓰는 상품";
      popupBody.innerHTML = `<div class="chat-popup-gifts">${giftButtonsHtml(gift?.id || "")}</div>`;
    }
    toolsPopup.hidden = false;
    popupBody.querySelectorAll("[data-popup-gift]").forEach((giftButton) => {
      giftButton.onclick = () => {
        const gift = CHAT_FAVORITE_GIFTS.find((item) => item.id === giftButton.dataset.popupGift);
        if (gift) sendToolText(`[선물] ${gift.icon} ${gift.label}`);
      };
    });
    popupBody.querySelectorAll("[data-popup-filter]").forEach((filterButton) => {
      filterButton.onclick = () => {
        state.roomsListFilter = filterButton.dataset.popupFilter;
        state.chatRoomListRequested = true;
        emit("state:save");
        renderRooms(panel, state);
      };
    });
    popupBody.querySelectorAll("[data-popup-grid]").forEach((roomButton) => {
      roomButton.onclick = () => {
        state.chatRoomListRequested = false;
        closeToolsPopup();
        openGridChat(roomHost, state, roomButton.dataset.popupGrid);
      };
    });
    popupBody.querySelectorAll("[data-popup-room]").forEach((roomButton) => {
      roomButton.onclick = () => {
        const id = roomButton.dataset.popupRoom;
        state.chatRoomListRequested = false;
        closeToolsPopup();
        openChatWith(roomHost, state, liveUser(id, state.rooms[id]?.user));
      };
    });
    popupBody.querySelectorAll("[data-popup-phrase]").forEach((phraseButton) => {
      phraseButton.onclick = () => sendToolText(phraseButton.dataset.popupPhrase || "");
    });
    popupBody.querySelectorAll("[data-popup-pin-phrase]").forEach((pinButton) => {
      pinButton.onclick = () => {
        const phrase = pinButton.dataset.popupPinPhrase || "";
        listUtil.pinnedPhrases = listUtil.pinnedPhrases.includes(phrase)
          ? listUtil.pinnedPhrases.filter((item) => item !== phrase)
          : [...listUtil.pinnedPhrases, phrase].slice(-5);
        emit("state:save");
        renderRooms(panel, state);
        panel.querySelector('[data-chat-popup="phrases"]')?.click();
      };
    });
    popupBody.querySelector("[data-popup-custom-save]")?.addEventListener("click", () => {
      const input = popupBody.querySelector("[data-popup-custom-input]");
      const phrase = String(input?.value || "").trim();
      if (!phrase) return;
      if (!listUtil.customPhrases.includes(phrase)) listUtil.customPhrases.push(phrase);
      emit("state:save");
      openToolsPopup(button);
    });
    popupBody.querySelectorAll("[data-popup-delete-phrase]").forEach((deleteButton) => {
      deleteButton.onclick = () => {
        const phrase = deleteButton.dataset.popupDeletePhrase || "";
        listUtil.customPhrases = listUtil.customPhrases.filter((item) => item !== phrase);
        listUtil.pinnedPhrases = listUtil.pinnedPhrases.filter((item) => item !== phrase);
        emit("state:save");
        openToolsPopup(button);
      };
    });
    panel.querySelector("[data-chat-popup-close]")?.focus();
  };
  panel.querySelectorAll("[data-chat-popup]").forEach((button) => {
    button.onclick = () => openToolsPopup(button);
  });
  panel.querySelector("[data-chat-popup-close]")?.addEventListener("click", closeToolsPopup);
  toolsPopup?.addEventListener("click", (event) => {
    if (event.target === toolsPopup) closeToolsPopup();
  });
  if (panel._chatToolsKeyHandler) document.removeEventListener("keydown", panel._chatToolsKeyHandler);
  panel._chatToolsKeyHandler = (event) => {
    if (event.key === "Escape" && toolsPopup && !toolsPopup.hidden) closeToolsPopup();
  };
  document.addEventListener("keydown", panel._chatToolsKeyHandler);
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
  panel.querySelectorAll("[data-list-pin-phrase]").forEach((button) => {
    button.onclick = () => {
      const phrase = button.dataset.listPinPhrase || "";
      listUtil.pinnedPhrases = listUtil.pinnedPhrases.includes(phrase)
        ? listUtil.pinnedPhrases.filter((item) => item !== phrase)
        : [...listUtil.pinnedPhrases, phrase].slice(-5);
      emit("state:save");
      renderRooms(panel, state);
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
      b.dataset.chatPopup = `rooms:${b.dataset.roomsFilter}`;
      openToolsPopup(b);
    };
  });
  panel.querySelector("[data-open-road-scene]")?.addEventListener("click", () => {
    openRoadChatInContent(roomHost, state);
  });
  const mapGridChatToggle = panel.querySelector("[data-map-grid-chat-toggle]");
  const mapGridChatList = panel.querySelector("[data-map-grid-chat-list]");
  mapGridChatToggle?.addEventListener("click", () => {
    const open = mapGridChatList?.hidden !== false;
    if (mapGridChatList) mapGridChatList.hidden = !open;
    mapGridChatToggle.setAttribute("aria-expanded", String(open));
    mapGridChatToggle.classList.toggle("is-open", open);
  });
  panel.querySelectorAll("[data-map-grid-chat]").forEach((button) => {
    button.onclick = () => {
      state.chatRoomListRequested = false;
      if (mapGridChatList) mapGridChatList.hidden = true;
      mapGridChatToggle?.setAttribute("aria-expanded", "false");
      mapGridChatToggle?.classList.remove("is-open");
      openGridChat(roomHost, state, button.dataset.mapGridChat);
    };
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
    const preferred = [...directs, ...grids, ...rooms]
      .sort((a, b) => {
        const messageDiff = (b.messages?.length || 0) - (a.messages?.length || 0);
        if (messageDiff) return messageDiff;
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      })[0];
    const fallbackPeer = liveDrivers[0];
    requestAnimationFrame(() => {
      if (!roomHost?.isConnected || roomHost.querySelector(".chat-shell")) return;
      if (preferred?.type === "grid") {
        openGridChat(roomHost, state, preferred.gridId || preferred.id.replace(/^grid:/, ""));
        return;
      }
      if (preferred) {
        openChatWith(roomHost, state, liveUser(preferred.peerId || preferred.id, preferred.user));
        return;
      }
      if (fallbackPeer) openChatWith(roomHost, state, fallbackPeer);
    });
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

  if (voiceBoundToRoomId && voiceBoundToRoomId !== peerId) stopVoice();
  const composeMode = getChatComposeMode(state, peerId);
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
        <button type="button" class="${composeMode === "text" ? "active" : ""}" data-chatmode="text">텍스트</button>
        <button type="button" class="${composeMode === "voice" ? "active" : ""}" data-chatmode="voice">음성</button>
      </div>
      <div id="textCompose" style="display:${composeMode === "text" ? "block" : "none"}">
        <textarea id="chatText" placeholder="메시지를 입력하세요"></textarea>
        <div class="compose-actions"><button class="primary" id="sendChat" type="button">전송</button></div>
      </div>
      <div id="voiceCompose" style="display:${composeMode === "voice" ? "block" : "none"}">
        ${voiceControlsMarkup(state, peerId, "direct")}
      </div>
    </div>
  </div>`;

  panel.querySelector("#chatBack").onclick = () => {
    state.chatRoomListRequested = true;
    state.roomsListFilter = "all";
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
      setChatComposeMode(state, peerId, mode);
      panel.querySelector("#textCompose").style.display = mode === "text" ? "block" : "none";
      panel.querySelector("#voiceCompose").style.display = mode === "voice" ? "block" : "none";
      if (mode === "voice") activateVoiceMode(panel, state, peerId);
      else stopVoice();
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
  bindVoiceRequestControls(panel, state, peerId, "direct");
  if (composeMode === "voice") activateVoiceMode(panel, state, peerId);
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

  if (voiceBoundToRoomId && voiceBoundToRoomId !== roomId) stopVoice();
  const composeMode = getChatComposeMode(state, roomId);
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
      <button class="secondary" id="favoriteRoom" type="button">${state.favoriteRooms?.includes(roomId) ? "★" : "☆"}</button>
    </div>
    <div id="chatScroll" class="chat-scroll">${bubbles}</div>
    <div class="chat-compose">
      <div class="tabs">
        <button type="button" class="${composeMode === "text" ? "active" : ""}" data-chatmode="text">텍스트</button>
        <button type="button" class="${composeMode === "voice" ? "active" : ""}" data-chatmode="voice">음성</button>
      </div>
      <div id="textCompose" style="display:${composeMode === "text" ? "block" : "none"}">
        <textarea id="chatText" placeholder="메시지를 입력하세요"></textarea>
        <div class="compose-actions"><button class="primary" id="sendChat" type="button">전송</button></div>
      </div>
      <div id="voiceCompose" style="display:${composeMode === "voice" ? "block" : "none"}">
        ${voiceControlsMarkup(state, roomId, "grid")}
      </div>
    </div>
  </div>`;

  panel.querySelector("#chatBack").onclick = () => {
    state.chatRoomListRequested = true;
    state.roomsListFilter = "all";
    stopVoice();
    clearReplyTimer(roomId);
    closeActiveChat(state);
    if (state.spatialChatUi) {
      state.spatialChatUi.mode = null;
      state.spatialChatUi.gridId = null;
    }
    emit("spatialChat:back");
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
      setChatComposeMode(state, roomId, mode);
      panel.querySelector("#textCompose").style.display = mode === "text" ? "block" : "none";
      panel.querySelector("#voiceCompose").style.display = mode === "voice" ? "block" : "none";
      if (mode === "voice") activateVoiceMode(panel, state, roomId);
      else stopVoice();
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
  bindVoiceRequestControls(panel, state, roomId, "grid");
  if (composeMode === "voice") activateVoiceMode(panel, state, roomId);
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

function showVoiceRuntimeMessage(panel, message, isError = false) {
  const transcript = panel?.querySelector?.("[data-voice-transcript]");
  if (!transcript) return;
  transcript.hidden = false;
  transcript.classList.toggle("is-error", isError);
  transcript.textContent = message;
}

function scheduleVoiceReconnect(panel, state, roomId) {
  if (voiceReconnectTimer) clearTimeout(voiceReconnectTimer);
  voiceReconnectTimer = setTimeout(() => {
    voiceReconnectTimer = null;
    if (activePanel !== panel || activeRoomId !== roomId) return;
    if (getChatComposeMode(state, roomId) !== "voice") return;
    const prefs = ensureVoicePreferences(state, roomId);
    if (!prefs.autoListen) return;
    toggleVoice(panel, state, roomId);
  }, 1500);
}

function handleVoiceRecognitionError(errorCode) {
  const roomId = voiceBoundToRoomId || activeRoomId;
  const panel = activePanel;
  const state = activeState;
  if (!roomId || !panel || !state) return;

  if (errorCode === "no-speech") {
    const session = ensureVoiceSession(state, roomId);
    transitionVoiceState(session, VOICE_STATES.LISTENING, "no-speech");
    updateVoiceStatusUi(panel, session);
    showVoiceRuntimeMessage(panel, "음성이 감지되지 않았습니다. 계속 듣고 있습니다.");
    return;
  }
  if (errorCode === "aborted" && !voiceListening) return;

  const failure = ["not-allowed", "service-not-allowed"].includes(errorCode)
    ? {state: VOICE_STATES.BLOCKED, reason: "permission-denied", message: "마이크 권한을 허용한 뒤 다시 시도해 주세요."}
    : errorCode === "audio-capture"
      ? {state: VOICE_STATES.BLOCKED, reason: "microphone-missing", message: "사용 가능한 마이크를 찾을 수 없습니다."}
      : errorCode === "network"
        ? {state: VOICE_STATES.RECONNECTING, reason: "network-error", message: "음성 네트워크 연결을 다시 시도합니다."}
        : {state: VOICE_STATES.IDLE, reason: "start-failed", message: "음성 인식을 시작하지 못했습니다."};

  stopVoice();
  const session = ensureVoiceSession(state, roomId);
  transitionVoiceState(session, failure.state, failure.reason);
  updateVoiceStatusUi(panel, session);
  showVoiceRuntimeMessage(panel, failure.message, true);
  showSystemMessage(failure.message);
  if (failure.state === VOICE_STATES.RECONNECTING) scheduleVoiceReconnect(panel, state, roomId);
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
      // 음성모드는 유지하고 인식 문장만 전송 대기 상태로 보관
      const ta = activePanel?.querySelector("#chatText");
      if (ta) {
        ta.value = ta.value.trim() ? `${ta.value.trim()} ${chunk}` : chunk;
      }
      const transcript = activePanel?.querySelector("[data-voice-transcript]");
      if (transcript) {
        transcript.hidden = false;
        transcript.textContent = `인식됨: ${chunk}`;
      }
    };
    voiceRecognition.onerror = (event) => {
      handleVoiceRecognitionError(String(event?.error || "unknown"));
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
    b.classList.add("voice-listening", "is-active");
    b.setAttribute("aria-pressed", "true");
    const text = b.querySelector("small");
    if (text) text.textContent = "마이크 끄기";
  }
  const session = ensureVoiceSession(state, peerId);
  transitionVoiceState(session, VOICE_STATES.LISTENING);
  updateVoiceStatusUi(panel, session);
  try {
    voiceRecognition.start();
    showVoiceRuntimeMessage(panel, "마이크가 연결되었습니다.");
  } catch (error) {
    handleVoiceRecognitionError("start-failed");
  }
}

/** 앱 부팅 후 배지 초기화용 */
export function refreshChatBadge(state) {
  if (!state) return;
  state.rooms = sanitizeRooms(state.rooms);
  updateNavBadge(state);
}

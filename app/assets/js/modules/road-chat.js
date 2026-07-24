/**
 * 도로 기반 실시간 대화 — state.roadChat 단일 세션
 * Spatial 패널·도크와 Content 대화방 상세가 같은 messages 배열을 공유한다.
 */
import { emit, on } from "../core/events.js";
import { getUsers } from "./map.js";
import { MY_USER_ID } from "./data.js";
import { showSystemMessage, openModal, closeModal } from "../core/ui.js";
import { playHorn } from "./sound.js";
import {
  ensureNavigation,
  navigationModeLabel,
  inferSpatialMeta,
  pushSpatialOverlay,
  ensureConversationUi,
  openConversationInChat,
  ROAD_CHAT_CONFIG,
  ROAD_QUICK_DEFS,
  ROAD_SITUATION_CATEGORIES,
  getQuickDef,
  classifyFreeTextMessage,
  buildLocalRoadInsight,
  ensureRoadInsight,
  getSituationCategoryMeta,
  categoryLabel,
  severityLabel,
  getRoadUnreadSplit,
  rebuildSituationConsensus,
  getOrCreateTrustProfile
} from "./conversation-store.js";

export const CONVERSATION_TYPES = Object.freeze({
  road: "road",
  grid: "grid",
  nearby: "nearby",
  direct: "direct",
  room: "room"
});

/** @deprecated ROAD_QUICK_DEFS.label 사용 */
export const ROAD_QUICK_MESSAGES = Object.freeze(ROAD_QUICK_DEFS.map((q) => q.label));

/** Floating + 메뉴 — 향후 항목 추가용 */
export const ROAD_FLOAT_ACTIONS = Object.freeze([
  { id: "situation", label: "도로 상황 알리기" },
  { id: "help", label: "도움 요청" },
  { id: "quick", label: "빠른 메시지" },
  { id: "voice", label: "음성 모드" },
  { id: "open_room", label: "대화방에서 열기" }
]);

const HELP_REQUEST_OPTIONS = Object.freeze([
  { id: "vehicle", label: "차량 이상", phrase: "차량 이상으로 도움이 필요합니다" },
  { id: "guidance", label: "길 안내 필요", phrase: "길 안내가 필요합니다" },
  { id: "safety", label: "안전 지원 필요", phrase: "안전 지원이 필요합니다" },
  { id: "other", label: "기타 도움 요청", phrase: "도움이 필요합니다" }
]);

const SITUATION_PHRASE_HINTS = Object.freeze({
  traffic: ["앞에 정체가 있습니다", "차량 흐름이 느립니다", "우회가 필요할 수 있습니다"],
  incident: ["사고가 있습니다", "앞에 사고가 있습니다", "사고 구간을 주의하세요"],
  hazard: ["위험합니다", "전방 위험 구간입니다", "주의해서 통과하세요"],
  construction: ["도로 공사가 있습니다", "앞에 공사 중입니다", "공사 구간을 주의하세요"],
  obstacle: ["장애물이 있습니다", "앞에 장애물이 있습니다"],
  detour: ["우회가 필요할 수 있습니다", "우회가 필요합니다"],
  other: ["도로 상황을 확인해 주세요", "전방 상황을 공유합니다"]
});

const DEFAULT_QUICK_RECOMMEND = Object.freeze([
  "thanks_yield",
  "traffic_ahead",
  "accident",
  "hazard"
]);

/** 패널 상태와 별도인 일시 overlay (persist 안 함) */
const floatUi = {
  overlay: null,
  quickShowAll: false,
  outsideBound: false
};

const ROAD_RADIUS_M = 450;
const STALE_MS = 5 * 60 * 1000;

let panelEl = null;
/** Content Workspace 전체 상세 패널 (같은 roadChat 세션) */
let contentHostEl = null;
let stateRef = null;
let sendBusy = false;
let replyTimer = null;
let msgSeq = 0;
let voiceListening = false;
/** @type {SpeechRecognition|null} */
let voiceRecognition = null;
let workspaceVoicePaused = false;

function nextMsgId() {
  msgSeq += 1;
  return `message-road-${Date.now().toString(36)}_${msgSeq}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function haversineMeters(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingToCardinal(deg) {
  if (!Number.isFinite(deg)) return null;
  const d = ((deg % 360) + 360) % 360;
  if (d >= 315 || d < 45) return "north";
  if (d < 135) return "east";
  if (d < 225) return "south";
  return "west";
}

function cardinalKo(c) {
  return { north: "북쪽", east: "동쪽", south: "남쪽", west: "서쪽" }[c] || null;
}

function sameDirection(a, b) {
  if (!a || !b) return false;
  return a === b;
}

export function defaultRoadChatState() {
  return {
    session: {
      type: "road",
      conversationId: "road-session-current",
      id: "road-session-current",
      title: "현재 도로 대화",
      roadId: null,
      roadName: "",
      segmentId: null,
      direction: null,
      laneGroup: null,
      gridId: null,
      participantVehicleIds: [],
      startedAt: null,
      lastActiveAt: null
    },
    messages: [],
    unread: 0,
    voiceMode: "inactive",
    panelOpen: true,
    panelMinimized: false,
    draftText: "",
    scrollTop: null,
    selectedVehicleId: null,
    contentScrollTop: null,
    contentDraftText: "",
    /** Floating dock: collapsed | compact | expanded */
    dockMode: "compact",
    sendStatus: "local_only",
    unreadSituation: 0,
    messagePurpose: "chat",
    situationCategory: "traffic",
    contentCategoryFilter: "all",
    recentQuickIds: []
  };
}

/** 저장값 정규화 — 메시지를 삭제하지 않음 */
export function sanitizeRoadChat(raw) {
  const base = defaultRoadChatState();
  if (!raw || typeof raw !== "object") return base;
  const session = { ...base.session, ...(raw.session && typeof raw.session === "object" ? raw.session : {}) };
  session.type = "road";
  if (!session.conversationId || session.conversationId === "road-session-local") {
    session.conversationId = "road-session-current";
  }
  session.id = session.conversationId;
  if (!session.title) session.title = "현재 도로 대화";
  if (!Array.isArray(session.participantVehicleIds)) session.participantVehicleIds = [];
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .map((m) => {
          const nm = normalizeRoadMessage(m, session);
          if (nm) nm.conversationId = session.conversationId;
          return nm;
        })
        .filter(Boolean)
    : [];
  return {
    session,
    messages,
    unread: Math.max(0, Math.floor(Number(raw.unread) || 0)),
    voiceMode: ["inactive", "listening", "speaking", "unavailable", "permission_required", "processing", "draft_ready"].includes(raw.voiceMode)
      ? raw.voiceMode
      : "inactive",
    panelOpen: raw.panelOpen !== false,
    panelMinimized: !!raw.panelMinimized,
    dockMode: ["collapsed", "compact", "expanded"].includes(raw.dockMode)
      ? raw.dockMode
      : raw.panelMinimized
        ? "collapsed"
        : "compact",
    draftText: typeof raw.draftText === "string" ? raw.draftText : "",
    scrollTop: Number.isFinite(Number(raw.scrollTop)) ? Number(raw.scrollTop) : null,
    selectedVehicleId: raw.selectedVehicleId ? String(raw.selectedVehicleId) : null,
    contentScrollTop: Number.isFinite(Number(raw.contentScrollTop)) ? Number(raw.contentScrollTop) : null,
    contentDraftText: typeof raw.contentDraftText === "string" ? raw.contentDraftText : "",
    sendStatus: ["composing", "sending", "sent", "failed", "queued", "local_only"].includes(raw.sendStatus)
      ? raw.sendStatus
      : "local_only",
    unreadSituation: Math.max(0, Math.floor(Number(raw.unreadSituation) || 0)),
    messagePurpose: ["chat", "situation", "help"].includes(raw.messagePurpose) ? raw.messagePurpose : "chat",
    situationCategory: raw.situationCategory || "traffic",
    contentCategoryFilter: raw.contentCategoryFilter || "all",
    recentQuickIds: Array.isArray(raw.recentQuickIds)
      ? raw.recentQuickIds.map(String).filter(Boolean).slice(0, 4)
      : []
  };
}

function closeFloatOverlay() {
  floatUi.overlay = null;
  floatUi.quickShowAll = false;
}

function rememberQuickId(state, quickId) {
  if (!quickId) return;
  const rc = ensureRoadChat(state);
  const next = [String(quickId), ...(rc.recentQuickIds || []).filter((id) => id !== quickId)];
  rc.recentQuickIds = next.slice(0, 4);
}

function resetComposeMode(state) {
  const rc = ensureRoadChat(state);
  rc.messagePurpose = "chat";
  rc.situationCategory = "traffic";
}

function normalizeRoadMessage(raw, session) {
  if (!raw || typeof raw !== "object") return null;
  const body = String(raw.body ?? raw.text ?? "").trim();
  if (!body) return null;
  const mine = raw.mine === true || raw.senderId === MY_USER_ID || raw.senderAccountId === MY_USER_ID;
  return {
    id: raw.id || nextMsgId(),
    conversationType: "road",
    conversationId: raw.conversationId || session.conversationId,
    senderAccountId: raw.senderAccountId || raw.senderId || (mine ? MY_USER_ID : "unknown"),
    senderVehicleId: raw.senderVehicleId || raw.senderId || null,
    senderNickname: raw.senderNickname || null,
    body,
    text: body,
    messageType: raw.messageType || "text",
    source: raw.source || "road",
    category: raw.category || null,
    spatialVisibility: raw.spatialVisibility || "none",
    spatialPriority: raw.spatialPriority || "normal",
    deliveryStatus: raw.deliveryStatus || "local_only",
    mine,
    roadContext: {
      roadId: raw.roadContext?.roadId ?? session.roadId ?? null,
      segmentId: raw.roadContext?.segmentId ?? session.segmentId ?? null,
      direction: raw.roadContext?.direction ?? session.direction ?? null
    },
    createdAt: Number(raw.createdAt) || Date.now()
  };
}

export function ensureRoadChat(state) {
  if (!state.roadChat) state.roadChat = defaultRoadChatState();
  else state.roadChat = sanitizeRoadChat(state.roadChat);
  return state.roadChat;
}

/**
 * 도로 참가 차량 필터 (데모 데이터 기준)
 * - 온라인
 * - 반경 내
 * - 차단 제외
 * - 같은 진행 방향 우선(정렬)
 */
export function getRoadParticipants(state, opts = {}) {
  const me = state.location || { lat: 37.5665, lng: 126.978 };
  const myDir = bearingToCardinal(Number(state.mapBearing) || 0);
  const blocked = new Set((state.blockedUserIds || []).map(String));
  const radius = opts.radiusM || ROAD_RADIUS_M;
  const now = Date.now();

  const list = getUsers()
    .filter((u) => {
      if (!u?.id || u.id === MY_USER_ID) return false;
      if (blocked.has(String(u.id))) return false;
      if (u.online === false) return false;
      if (u.lastSeenAt && now - Number(u.lastSeenAt) > STALE_MS) return false;
      const d = haversineMeters(me, u);
      if (!Number.isFinite(d) || d > radius) return false;
      return true;
    })
    .map((u) => {
      const dir = bearingToCardinal(Number(u.heading));
      return {
        ...u,
        distanceM: haversineMeters(me, u),
        direction: dir,
        sameDirection: sameDirection(myDir, dir)
      };
    })
    .sort((a, b) => {
      if (a.sameDirection !== b.sameDirection) return a.sameDirection ? -1 : 1;
      return a.distanceM - b.distanceM;
    });

  return { participants: list, myDirection: myDir, radiusM: radius };
}

function refreshSessionContext(state) {
  const rc = ensureRoadChat(state);
  const { participants, myDirection, radiusM } = getRoadParticipants(state);
  const s = rc.session;
  s.type = "road";
  s.id = s.conversationId || "road-session-current";
  s.direction = myDirection;
  s.participantVehicleIds = participants.map((p) => String(p.id));
  s.gridId = state.locationGridId || state.currentGridId || null;
  if (!s.roadName) s.roadName = "";
  if (!s.startedAt) s.startedAt = Date.now();
  s.lastActiveAt = Date.now();
  rc._meta = { radiusM, participantCount: participants.length };
  return { rc, participants, myDirection, radiusM };
}

/** 세션 종료·도로 변경 시 최근 기록으로만 보관 (일반 room 변환 금지) */
export function archiveRoadChatToHistory(state, meta = {}) {
  const rc = ensureRoadChat(state);
  if (!rc.messages?.length) return null;
  if (!Array.isArray(state.roadChatHistory)) state.roadChatHistory = [];
  const last = rc.messages[rc.messages.length - 1];
  const entry = {
    id: `road-history-${Date.now().toString(36)}`,
    type: "road_history",
    conversationId: rc.session.conversationId,
    roadName: (rc.session.roadName || "").trim() || "이름 없는 도로",
    direction: rc.session.direction,
    directionLabel: directionLabel(rc.session.direction),
    participantCount: rc.session.participantVehicleIds?.length || 0,
    startedAt: rc.session.startedAt,
    endedAt: Date.now(),
    lastMessage: String(last?.body || last?.text || ""),
    messageCount: rc.messages.length,
    readOnly: true,
    localOnly: true,
    reason: meta.reason || "session_end"
  };
  state.roadChatHistory = [entry, ...state.roadChatHistory.filter((h) => h?.id !== entry.id)].slice(0, 12);
  saveState();
  return entry;
}

function isRoadUiVisible(state) {
  const rc = ensureRoadChat(state);
  const contentOpen = !!(
    contentHostEl?.isConnected && contentHostEl.querySelector?.("[data-road-content-detail]")
  );
  const dock = document.querySelector("#roadChatDock");
  const dockOpen = !!(
    dock &&
    rc.dockMode !== "collapsed" &&
    (dock.querySelector(".road-float-shell") || !dock.classList.contains("minimized"))
  );
  const sideOpen = !!(
    panelEl?.isConnected && panelEl.querySelector?.(".road-drive-assist, .road-chat-summary, .road-chat-shell")
  );
  return contentOpen || dockOpen || sideOpen;
}

export function syncRoadNavigationHud(state) {
  const nav = ensureNavigation(state);
  const modeEl = document.querySelector("#roadNavMode");
  const nameEl = document.querySelector("#roadNavName");
  const destEl = document.querySelector("#roadNavDest");
  const nextEl = document.querySelector("#roadNavNext");
  const noteEl = document.querySelector("#roadNavNote");
  if (modeEl) modeEl.textContent = navigationModeLabel(nav.navigationMode);
  if (nameEl) {
    nameEl.textContent = nav.currentRoadName || (state.roadChat?.session?.roadName || "도로 정보 확인 중");
  }
  if (destEl) {
    destEl.textContent = nav.destination
      ? String(nav.destination.name || nav.destination)
      : "목적지 미설정 · 경로 API 미연동";
  }
  if (nextEl) {
    nextEl.textContent = nav.nextInstruction || "다음 안내 없음 (로컬)";
  }
  if (noteEl) {
    noteEl.textContent =
      nav.dataSource === "local"
        ? "로컬·데모 정보만 표시합니다. 실제 내비게이션·ETA는 연동 전입니다."
        : String(nav.dataSource);
  }
  const dirEl = document.querySelector("#roadNavDir");
  if (dirEl) {
    const d = nav.direction || state.roadChat?.session?.direction;
    dirEl.textContent = directionLabel(d);
  }
}

function formatRelTime(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(t).toLocaleDateString("ko-KR");
}

function directionLabel(dir) {
  const k = cardinalKo(dir);
  return k ? `${k} 방향` : "진행 방향 확인 중";
}

function headerContextHtml(state, participants, myDirection, radiusM) {
  const rc = state.roadChat;
  const name = (rc.session.roadName || "").trim();
  const count = participants.length;
  if (name) {
    return `
      <div class="road-chat-title">현재 도로 대화</div>
      <div class="road-chat-sub">${escapeHtml(name)} · ${escapeHtml(directionLabel(myDirection))}</div>
      <div class="muted">참여 차량 ${count}대 · 반경 약 ${radiusM}m</div>`;
  }
  return `
    <div class="road-chat-title">현재 도로 대화</div>
    <div class="road-chat-sub">도로 정보를 확인하고 있습니다.</div>
    <div class="muted">주변 차량 ${count}대 · ${escapeHtml(directionLabel(myDirection))} · 반경 약 ${radiusM}m</div>`;
}

function voiceModeLabel(mode) {
  const map = {
    inactive: "음성 모드 꺼짐",
    listening: "듣는 중",
    speaking: "안내 중",
    processing: "처리 중",
    draft_ready: "초안 준비됨 · 확인 후 전송",
    unavailable: "음성 미지원 · 연동 전",
    permission_required: "마이크 권한 필요"
  };
  return map[mode] || map.inactive;
}

function persistUiDraft(state) {
  const rc = ensureRoadChat(state);
  const ui = ensureConversationUi(state);
  const cid = rc.session.conversationId || "road-session-current";
  const ta = document.querySelector("#roadFloatingText");
  if (ta) rc.draftText = ta.value;
  const scroll = document.querySelector("#roadFloatingScroll");
  if (scroll) rc.scrollTop = scroll.scrollTop;
  const cta = contentHostEl?.querySelector("#roadChatTextContent");
  if (cta) rc.contentDraftText = cta.value;
  const cscroll = contentHostEl?.querySelector("#roadChatScrollContent");
  if (cscroll) rc.contentScrollTop = cscroll.scrollTop;
  ui.draftByConversationId[cid] = {
    text: rc.draftText || "",
    updatedAt: Date.now()
  };
}

function getRoadDraft(state) {
  const rc = ensureRoadChat(state);
  const ui = ensureConversationUi(state);
  const cid = rc.session.conversationId || "road-session-current";
  const stored = ui.draftByConversationId[cid];
  if (stored && typeof stored.text === "string" && stored.text) {
    if (Number(stored.updatedAt) && Date.now() - Number(stored.updatedAt) > ROAD_CHAT_CONFIG.draftTtlMs) {
      delete ui.draftByConversationId[cid];
      return rc.draftText || "";
    }
    if (!rc.draftText) rc.draftText = stored.text;
  }
  return rc.draftText || "";
}

function clearRoadDraft(state) {
  const rc = ensureRoadChat(state);
  const ui = ensureConversationUi(state);
  const cid = rc.session.conversationId || "road-session-current";
  rc.draftText = "";
  rc.contentDraftText = "";
  delete ui.draftByConversationId[cid];
}

function setDockMode(state, mode) {
  const rc = ensureRoadChat(state);
  const next = ["collapsed", "compact", "expanded"].includes(mode) ? mode : "compact";
  rc.dockMode = next;
  rc.panelMinimized = next === "collapsed";
  rc.panelOpen = next !== "collapsed";
}

function saveState() {
  emit("state:save");
}

function notifyRoadChanged(state) {
  emit("roadchat:changed", {
    conversationId: state?.roadChat?.session?.conversationId || "road-session-current",
    unread: Math.max(0, Number(state?.roadChat?.unread) || 0)
  });
  emit("roadchat:unread", { count: Math.max(0, Number(state?.roadChat?.unread) || 0) });
}

/** 열린 Spatial/Content 도로 UI를 같은 세션으로 갱신 */
export function refreshRoadChatViews(state) {
  if (!state) return;
  if (panelEl?.isConnected && panelEl.querySelector?.(".road-drive-assist")) {
    renderRoadDriveAssist(panelEl, state, { skipActiveEmit: true, skipMarkRead: true });
  }
  const dock = document.querySelector("#roadChatDock");
  if (dock?.isConnected) renderFloatingRoadChat(dock, state, { skipMarkRead: true });
  if (contentHostEl?.isConnected && contentHostEl.querySelector?.("[data-road-content-detail]")) {
    renderRoadChatContentDetail(contentHostEl, state, { skipMarkRead: true });
  }
  updateRoadDockBadge(state);
  syncRoadNavigationHud(state);
}

export function getRoadConversationId(state) {
  return ensureRoadChat(state).session.conversationId || "road-session-current";
}

export function markRoadChatRead(state) {
  const rc = ensureRoadChat(state);
  const prev = Math.max(0, Number(rc.unread) || 0);
  const prevSit = Math.max(0, Number(rc.unreadSituation) || 0);
  rc.unread = 0;
  rc.unreadSituation = 0;
  updateRoadDockBadge(state);
  if (prev > 0 || prevSit > 0) {
    saveState();
    notifyRoadChanged(state);
  } else {
    emit("roadchat:unread", { count: 0, situation: 0 });
  }
}

/** 대화방 카드용 요약 — 메시지 배열 복제 없음 */
export function getRoadConversationCard(state) {
  const { rc, participants, myDirection, radiusM } = refreshSessionContext(state);
  const last = rc.messages?.length ? rc.messages[rc.messages.length - 1] : null;
  const name = (rc.session.roadName || "").trim();
  const split = getRoadUnreadSplit(state);
  return {
    conversationId: rc.session.conversationId,
    type: "road",
    title: "현재 도로 대화",
    roadName: name,
    direction: myDirection,
    directionLabel: directionLabel(myDirection),
    participantCount: participants.length,
    radiusM,
    unread: split.total,
    unreadMessageCount: split.unreadMessageCount,
    unreadSituationCount: split.unreadSituationCount,
    lastMessage: last ? String(last.body || last.text || "") : "",
    lastActiveAt: rc.session.lastActiveAt || last?.createdAt || null,
    lastActiveLabel: formatRelTime(rc.session.lastActiveAt || last?.createdAt),
    voiceMode: rc.voiceMode,
    voiceAvailable: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    messageCount: rc.messages?.length || 0,
    hasContextName: !!name
  };
}

export function getRoadChatHistory(state) {
  if (!Array.isArray(state.roadChatHistory)) return [];
  return state.roadChatHistory;
}

function emitRoadActive(state, participants) {
  const ids = [MY_USER_ID, ...participants.map((p) => String(p.id))];
  emit("chat:activeRoomChanged", {
    roomId: state.roadChat.session.conversationId,
    type: "road",
    peerId: null,
    gridId: state.roadChat.session.gridId,
    participantIds: ids
  });
}

export function pauseRoadVoiceForWorkspace() {
  workspaceVoicePaused = true;
  if (!voiceListening) return;
  try {
    voiceRecognition?.stop();
  } catch {
    /* ignore */
  }
  voiceListening = false;
  if (stateRef?.roadChat) {
    if (stateRef.roadChat.voiceMode === "listening") {
      stateRef.roadChat.voiceMode = "inactive";
    }
  }
  const btn = panelEl?.querySelector("#roadVoiceToggle");
  if (btn) {
    btn.classList.remove("voice-listening");
    btn.textContent = "음성 모드";
  }
}

export function clearWorkspaceVoicePauseFlag() {
  workspaceVoicePaused = false;
}

function stopRoadVoice(state) {
  voiceListening = false;
  try {
    voiceRecognition?.stop();
  } catch {
    /* ignore */
  }
  if (state?.roadChat) state.roadChat.voiceMode = "inactive";
  const btn = panelEl?.querySelector("#roadVoiceToggle");
  if (btn) {
    btn.classList.remove("voice-listening");
    btn.textContent = "음성 모드";
  }
}

function toggleRoadVoice(state) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    state.roadChat.voiceMode = "unavailable";
    showSystemMessage("이 환경에서는 음성 입력을 지원하지 않습니다.");
    refreshRoadChatViews(state);
    return;
  }
  if (voiceListening) {
    stopRoadVoice(state);
    saveState();
    refreshRoadChatViews(state);
    return;
  }
  if (!voiceRecognition) {
    voiceRecognition = new SR();
    voiceRecognition.lang = "ko-KR";
    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = false;
    voiceRecognition.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      chunk = chunk.trim();
      if (!chunk || !stateRef?.roadChat) return;
      const rc = stateRef.roadChat;
      rc.draftText = rc.draftText.trim() ? `${rc.draftText.trim()} ${chunk}` : chunk;
      if (rc.draftText.length > ROAD_CHAT_CONFIG.maxLengthRoad) {
        rc.draftText = rc.draftText.slice(0, ROAD_CHAT_CONFIG.maxLengthRoad);
      }
      rc.voiceMode = "draft_ready";
      const ta = document.querySelector("#roadFloatingText");
      if (ta) ta.value = rc.draftText;
      const cta = contentHostEl?.querySelector("#roadChatTextContent");
      if (cta) cta.value = rc.draftText;
      persistUiDraft(stateRef);
      saveState();
      refreshRoadChatViews(stateRef);
    };
    voiceRecognition.onerror = () => {
      if (stateRef?.roadChat) stateRef.roadChat.voiceMode = "permission_required";
      stopRoadVoice(stateRef);
      saveState();
    };
    voiceRecognition.onend = () => {
      if (voiceListening && !workspaceVoicePaused) {
        try {
          voiceRecognition.start();
        } catch {
          /* ignore */
        }
      }
    };
  }
  try {
    voiceRecognition.start();
    voiceListening = true;
    state.roadChat.voiceMode = "listening";
    workspaceVoicePaused = false;
    saveState();
    refreshRoadChatViews(state);
  } catch {
    state.roadChat.voiceMode = "permission_required";
    showSystemMessage("마이크 권한을 확인한 뒤 다시 시도하세요.");
    saveState();
    refreshRoadChatViews(state);
  }
}

function validateRoadSend(state, text, maxLen) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return { ok: false, reason: "empty" };
  if (!cleaned.replace(/\s/g, "").length) return { ok: false, reason: "empty" };
  if (cleaned.length > maxLen) return { ok: false, reason: "too_long", maxLen };
  const rc = ensureRoadChat(state);
  if (!rc?.session?.conversationId) return { ok: false, reason: "no_conversation" };
  if (rc.session.type !== "road") return { ok: false, reason: "bad_type" };
  return { ok: true, cleaned };
}

function promptSpatialConfirm(state, text, baseOpts) {
  openModal(
    "도로 상황 표시",
    `<p>이 메시지를 지도 위 도로 상황으로 표시하시겠습니까?</p>
     <p class="muted">“${escapeHtml(String(text).slice(0, 80))}”</p>
     <p class="muted">기본은 대화에만 보냅니다. 112·119 등 긴급신고를 대신하지 않습니다.</p>`,
    [
      {
        label: "대화에만 보내기",
        className: "secondary",
        onClick: () => {
          closeModal();
          sendRoadMessage(state, text, { ...baseOpts, asSpatial: false, skipSpatialPrompt: true });
        }
      },
      {
        label: "도로 상황으로 표시",
        className: "primary",
        onClick: () => {
          closeModal();
          sendRoadMessage(state, text, { ...baseOpts, asSpatial: true, skipSpatialPrompt: true });
        }
      }
    ]
  );
}

function sendRoadMessage(state, text, opts = {}) {
  const maxLen = opts.maxLen || ROAD_CHAT_CONFIG.maxLengthRoad;
  const check = validateRoadSend(state, text, maxLen);
  if (!check.ok) {
    if (check.reason === "too_long") {
      showSystemMessage(`메시지는 최대 ${check.maxLen}자까지 입력할 수 있습니다.`);
    }
    return;
  }
  if (sendBusy) return;

  const cleaned = check.cleaned;
  const quick = opts.quickId ? getQuickDef(opts.quickId) : getQuickDef(cleaned);
  const purpose = opts.purpose || state.roadChat?.messagePurpose || "chat";

  if (!opts.skipSpatialPrompt && !quick && !opts.fromQuick && purpose === "chat") {
    const cls = classifyFreeTextMessage(cleaned);
    if (cls.kind === "situation_candidate" && opts.asSpatial == null) {
      promptSpatialConfirm(state, cleaned, opts);
      return;
    }
  }

  if (purpose === "situation" && !opts.situationCategory && !quick && !opts.fromQuick) {
    showSystemMessage("도로 상황 분류(정체·사고·위험 등)를 선택해 주세요.");
    return;
  }

  sendBusy = true;
  const { rc, participants } = refreshSessionContext(state);
  rc.sendStatus = "sending";

  let spatialVisibility = "none";
  let spatialPriority = "normal";
  let category = "chat";
  let expiresInSeconds = 0;
  let source = opts.source || "road_input";

  if (quick || opts.fromQuick) {
    const q = quick || getQuickDef(opts.quickId || cleaned);
    source = "road_quick";
    if (q) {
      spatialVisibility = q.spatialVisibility || "none";
      spatialPriority = q.spatialPriority || "normal";
      category = q.category || "chat";
      expiresInSeconds = q.expiresInSeconds || 0;
    }
  } else if (purpose === "help") {
    category = "help";
    spatialVisibility = "nearby";
    spatialPriority = "warning";
    expiresInSeconds = 120;
  } else if (purpose === "situation" || opts.asSpatial === true) {
    const catId = opts.situationCategory || rc.situationCategory || "traffic";
    const meta = getSituationCategoryMeta(catId) || getSituationCategoryMeta("other");
    category = meta?.id || "other";
    spatialVisibility = "nearby";
    spatialPriority = meta?.spatialPriority || "warning";
    expiresInSeconds = meta?.expiresInSeconds || 120;
  } else if (opts.asSpatial === true) {
    const cls = classifyFreeTextMessage(cleaned);
    spatialVisibility = "nearby";
    spatialPriority = cls.suggestedPriority || "warning";
    category = cls.category || "traffic";
    expiresInSeconds = spatialPriority === "urgent" ? 300 : 120;
  } else {
    spatialVisibility = "none";
    spatialPriority = "normal";
    category = "chat";
  }

  const msg = normalizeRoadMessage(
    {
      id: nextMsgId(),
      body: cleaned,
      mine: true,
      senderAccountId: MY_USER_ID,
      senderVehicleId: MY_USER_ID,
      senderNickname: state.profile?.nickname || "나",
      createdAt: Date.now(),
      source,
      category,
      spatialVisibility,
      spatialPriority,
      deliveryStatus: "local_only",
      messageType: "text",
      purpose: purpose === "situation" || category !== "chat" && category !== "courtesy" ? purpose : "chat"
    },
    rc.session
  );
  rc.messages.push(msg);
  clearRoadDraft(state);
  rc.session.lastActiveAt = Date.now();
  rc.sendStatus = "local_only";

  const trust = getOrCreateTrustProfile(state, MY_USER_ID);
  if (category !== "chat" && category !== "courtesy") {
    trust.roadReportCount = Math.max(0, Number(trust.roadReportCount) || 0) + 1;
    if (trust.trustLevel === "unrated") trust.trustLevel = "new";
  }

  if (spatialVisibility !== "none") {
    pushSpatialOverlay(state, {
      id: `ov-${msg.id}`,
      conversationId: rc.session.conversationId,
      conversationType: "road",
      senderVehicleId: MY_USER_ID,
      senderNickname: msg.senderNickname,
      body: msg.body,
      spatialVisibility,
      spatialPriority,
      category,
      expiresInSeconds,
      createdAt: msg.createdAt,
      anchorVehicleId: MY_USER_ID
    });
  }

  rebuildSituationConsensus(state);
  buildLocalRoadInsight(state, participants);

  if (opts.fromQuick || opts.quickId) rememberQuickId(state, opts.quickId || quick?.id);
  /* Floating 작성 모드: 전송 후 일반 대화로 복귀 */
  if (opts.source === "road_input" || opts.fromQuick) {
    resetComposeMode(state);
    closeFloatOverlay();
  }

  emit("chat:messagePreview", {
    messageId: msg.id,
    roomId: rc.session.conversationId,
    roomType: "road",
    conversationType: "road",
    senderId: MY_USER_ID,
    text: msg.body,
    createdAt: msg.createdAt
  });
  saveState();
  refreshRoadChatViews(state);
  notifyRoadChanged(state);
  if (!opts.skipDemoReply) scheduleRoadDemoReply(state, participants);
  sendBusy = false;
}

export function sendRoadChatMessage(state, text, opts = {}) {
  sendRoadMessage(state, text, opts);
}

function scheduleRoadDemoReply(state, participants) {
  if (replyTimer) clearTimeout(replyTimer);
  replyTimer = setTimeout(() => {
    replyTimer = null;
    const rc = ensureRoadChat(state);
    const pool = participants.filter((p) => p.online !== false);
    const bot = pool[Math.floor(Math.random() * Math.max(pool.length, 1))];
    if (!bot) return;
    const lastMine = [...(rc.messages || [])].reverse().find((m) => m.mine);
    const lastSit =
      lastMine &&
      lastMine.category &&
      lastMine.category !== "chat" &&
      lastMine.category !== "courtesy"
        ? lastMine
        : null;
    /* 최근 상황 보고가 있으면 다른 차량이 동일 category로 확인(다수 확인 데모) */
    const confirmSit = lastSit && Math.random() < 0.55;
    let msg;
    if (confirmSit) {
      const label = categoryLabel(lastSit.category) || "상황";
      const meta = getSituationCategoryMeta(lastSit.category);
      msg = normalizeRoadMessage(
        {
          id: nextMsgId(),
          body: `${label} 확인했습니다.`,
          mine: false,
          senderAccountId: bot.id,
          senderVehicleId: bot.id,
          senderNickname: bot.nickname,
          createdAt: Date.now(),
          category: lastSit.category,
          spatialVisibility: "nearby",
          spatialPriority: meta?.spatialPriority || "warning",
          source: "road_demo_confirm"
        },
        rc.session
      );
      pushSpatialOverlay(state, {
        id: `ov-${msg.id}`,
        conversationId: rc.session.conversationId,
        conversationType: "road",
        senderVehicleId: bot.id,
        senderNickname: bot.nickname,
        body: msg.body,
        spatialVisibility: "nearby",
        spatialPriority: msg.spatialPriority,
        category: msg.category,
        expiresInSeconds: meta?.expiresInSeconds || 120,
        createdAt: msg.createdAt,
        anchorVehicleId: bot.id
      });
    } else {
      const reply = ["확인했습니다.", "안전운전하세요.", "빵빵!"][Math.floor(Math.random() * 3)];
      msg = normalizeRoadMessage(
        {
          id: nextMsgId(),
          body: reply,
          mine: false,
          senderAccountId: bot.id,
          senderVehicleId: bot.id,
          senderNickname: bot.nickname,
          createdAt: Date.now(),
          category: "chat",
          spatialVisibility: "none",
          spatialPriority: "normal"
        },
        rc.session
      );
    }
    rc.messages.push(msg);
    emit("chat:messagePreview", {
      messageId: msg.id,
      roomId: rc.session.conversationId,
      roomType: "road",
      senderId: bot.id,
      text: msg.body,
      createdAt: msg.createdAt
    });
    if (!isRoadUiVisible(state)) {
      rc.unread = Math.max(0, Number(rc.unread) || 0) + 1;
      if (confirmSit) {
        rc.unreadSituation = Math.max(0, Number(rc.unreadSituation) || 0) + 1;
      }
    }
    rebuildSituationConsensus(state);
    buildLocalRoadInsight(state, participants);
    playHorn(state.hornEnabled);
    saveState();
    refreshRoadChatViews(state);
    notifyRoadChanged(state);
  }, 800);
}

function updateRoadDockBadge(state) {
  const split = getRoadUnreadSplit(state);
  const badge = document.querySelector("#roadChatDockUnread");
  if (!badge) return;
  if (split.total <= 0) {
    badge.hidden = true;
    return;
  }
  badge.hidden = false;
  const sit = split.unreadSituationCount;
  const msg = split.unreadMessageCount;
  badge.setAttribute("aria-label", `대화 ${msg} 상황 ${sit}`);
  if (sit > 0 && msg > 0) badge.textContent = `상황 ${sit} · 대화 ${msg}`;
  else if (sit > 0) badge.textContent = `상황 ${sit}`;
  else badge.textContent = `대화 ${msg > 99 ? "99+" : msg}`;
}

function drivingModeHint(state) {
  const mode = ensureConversationUi(state).drivingInteractionMode || "unknown";
  if (mode === "moving" || mode === "unknown") {
    return "주행 중에는 빠른 메시지 또는 음성 기능을 이용하세요.";
  }
  return "";
}

function openRoadRooms(state) {
  const rc = ensureRoadChat(state);
  const ui = ensureConversationUi(state);
  ui.activeConversationId = rc.session.conversationId;
  ui.returnView = document.body.dataset.mapView || "road";
  persistUiDraft(state);
  saveState();
  openConversationInChat(rc.session.conversationId, { returnView: ui.returnView });
}

/**
 * 우측 패널: 요약만 (입력창 없음)
 */
export function renderRoadChatSummary(panel, state, opts = {}) {
  if (!panel) return;
  const { rc, participants, myDirection } = refreshSessionContext(state);
  const split = getRoadUnreadSplit(state);
  const last = rc.messages?.length ? rc.messages[rc.messages.length - 1] : null;
  const lastText = last ? String(last.body || last.text || "") : "아직 메시지가 없습니다.";
  const lastKind =
    last?.category && last.category !== "chat" && last.category !== "courtesy" ? "도로 상황" : "일반 대화";
  const unreadBadge =
    split.total > 0
      ? `<span class="chat-room-unread" aria-label="대화 ${split.unreadMessageCount} 상황 ${split.unreadSituationCount}">${split.unreadSituationCount ? `상황 ${split.unreadSituationCount}` : ""}${split.unreadSituationCount && split.unreadMessageCount ? " · " : ""}${split.unreadMessageCount ? `대화 ${split.unreadMessageCount}` : ""}</span>`
      : "";
  const sameDir = participants.filter((p) => p.sameDirection).length;

  panel.innerHTML = `
    <div class="road-chat-summary card" data-conversation-type="road" data-conversation-id="${escapeHtml(rc.session.conversationId)}">
      <div class="road-chat-summary-head">
        <b>현재 도로 대화</b> ${unreadBadge}
        <div class="muted">${escapeHtml(directionLabel(myDirection))} · 참여 ${participants.length}대 · 같은 방향 ${sameDir}대</div>
      </div>
      <div class="road-chat-summary-preview"><span class="muted">${escapeHtml(lastKind)}</span> “${escapeHtml(lastText.slice(0, 72))}”</div>
      <div class="muted">입력은 왼쪽 Floating Road Chat · 대화 ${split.unreadMessageCount} · 상황 ${split.unreadSituationCount}</div>
      <div class="convo-actions">
        <button type="button" class="primary" data-open-road-chat>대화방 열기</button>
      </div>
    </div>`;

  panel.querySelector("[data-open-road-chat]")?.addEventListener("click", () => openRoadRooms(state));
  if (!opts.skipMarkRead && opts.markRead) markRoadChatRead(state);
  else updateRoadDockBadge(state);
}

function insightCardHtml(insight, participants, radiusM, opts = {}) {
  const updated = insight.generatedAt
    ? new Date(insight.generatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : "확인 불가";
  const sev = insight.severity || "normal";
  const consensus = Array.isArray(insight.consensus) ? insight.consensus : [];
  const multi = consensus
    .filter((c) => c.uniqueSenderCount >= 2)
    .slice(0, 4)
    .map((c) => {
      const filterAttr = opts.filterable
        ? ` type="button" class="insight-confirm-row insight-filter-btn" data-insight-filter="${escapeHtml(c.category)}"`
        : ` class="insight-confirm-row"`;
      return `<${opts.filterable ? "button" : "div"}${filterAttr}><span>${escapeHtml(categoryLabel(c.category))}</span><b aria-label="다수 확인 ${c.uniqueSenderCount}명">${c.uniqueSenderCount}명 확인</b></${opts.filterable ? "button" : "div"}>`;
    })
    .join("");
  return `
    <div class="card road-insight-card severity-${escapeHtml(sev)}" data-road-insight>
      <div class="insight-head">
        <b>도로 상황 요약</b>
        <span class="insight-severity" aria-label="현재 상태 ${escapeHtml(severityLabel(sev))}">
          <span class="insight-sev-dot" aria-hidden="true"></span>${escapeHtml(severityLabel(sev))}
        </span>
      </div>
      <div class="muted">ROAD INSIGHT · 로컬 집계 · AI 연동 전 (${escapeHtml(insight.status)})</div>
      <p class="insight-summary">${escapeHtml(insight.summaryText || "데이터 없음")}</p>
      <div class="insight-grid">
        <div><span class="muted">정체</span><div>${insight.trafficCount ?? 0}건</div></div>
        <div><span class="muted">사고</span><div>${insight.incidentCount ?? 0}건</div></div>
        <div><span class="muted">위험</span><div>${insight.hazardCount ?? 0}건</div></div>
        <div><span class="muted">공사</span><div>${insight.constructionCount ?? 0}건</div></div>
        <div><span class="muted">도움</span><div>${insight.helpCount ?? 0}건</div></div>
        <div><span class="muted">공간 메시지</span><div>${insight.sourceMessageCount ?? 0}건</div></div>
        <div><span class="muted">같은 방향</span><div>${insight.sameDirectionVehicleCount ?? participants.filter((p) => p.sameDirection).length}대</div></div>
        <div><span class="muted">참여 차량</span><div>${insight.activeVehicleCount ?? participants.length}대</div></div>
      </div>
      ${multi ? `<div class="insight-confirm"><div class="muted">다수 확인</div>${multi}</div>` : ""}
      <div class="muted" style="margin-top:8px">마지막 갱신 ${escapeHtml(updated)} · 데이터 소스 Local · 반경 약 ${radiusM}m</div>
      <div class="muted insight-disclaimer">표시된 도로 정보는 참여자 메시지 기반 참고 정보입니다. 공식 교통·긴급신고를 대체하지 않습니다.</div>
    </div>`;
}

/**
 * 왼쪽 Floating Road Chat — compact 입력 중심 (+ 기능 메뉴)
 */
export function renderFloatingRoadChat(dock, state, opts = {}) {
  if (!dock) return;
  stateRef = state;
  const rc = ensureRoadChat(state);
  let mode = rc.dockMode || "compact";
  if (typeof window !== "undefined" && window.innerWidth < 1400 && mode === "expanded") mode = "compact";
  setDockMode(state, mode);
  mode = rc.dockMode;

  const { participants, myDirection } = refreshSessionContext(state);
  const draft = getRoadDraft(state);
  const split = getRoadUnreadSplit(state);
  const last = rc.messages?.length ? rc.messages[rc.messages.length - 1] : null;
  const lastText = last ? String(last.body || last.text || "") : "아직 메시지가 없습니다.";
  const lastKind =
    last?.category && last.category !== "chat" && last.category !== "courtesy" ? "도로 상황" : "일반 대화";
  const voice = rc.voiceMode || "inactive";
  const voiceActive = voice === "listening" || voice === "processing" || voice === "draft_ready";
  const maxLen = ROAD_CHAT_CONFIG.maxLengthRoad;
  const purpose = rc.messagePurpose || "chat";
  const sitCat = rc.situationCategory || "traffic";
  const overlay = floatUi.overlay;
  const nearLimit = draft.length >= Math.floor(maxLen * 0.85);

  dock.classList.toggle("dock-collapsed", mode === "collapsed");
  dock.classList.toggle("dock-compact", mode === "compact");
  dock.classList.toggle("dock-expanded", mode === "expanded");
  dock.classList.toggle("minimized", mode === "collapsed");

  const unreadBadge = `
    <span id="roadChatDockUnread" class="chat-room-unread" ${split.total ? "" : "hidden"}
      aria-label="대화 ${split.unreadMessageCount} 상황 ${split.unreadSituationCount}">
      ${split.unreadSituationCount ? `상황 ${split.unreadSituationCount}` : ""}${split.unreadSituationCount && split.unreadMessageCount ? " · " : ""}${split.unreadMessageCount ? `대화 ${split.unreadMessageCount}` : split.total || "0"}
    </span>`;

  if (mode === "collapsed") {
    closeFloatOverlay();
    dock.innerHTML = `
      <button type="button" class="road-chat-dock-toggle" id="roadChatDockToggle" aria-expanded="false">
        현재 도로 대화 ${unreadBadge}
      </button>
      <div class="road-float-collapsed-preview muted">“${escapeHtml(lastText.slice(0, 48))}”</div>
      <button type="button" class="secondary road-chat-dock-expand" id="roadChatDockExpand" aria-label="대화 패널 펼치기">펼치기</button>`;
    dock.querySelector("#roadChatDockToggle").onclick = () => {
      setDockMode(state, "compact");
      saveState();
      renderFloatingRoadChat(dock, state);
    };
    dock.querySelector("#roadChatDockExpand").onclick = () => {
      setDockMode(state, "compact");
      saveState();
      renderFloatingRoadChat(dock, state);
    };
    updateRoadDockBadge(state);
    return;
  }

  const modeChip =
    purpose === "situation"
      ? `<div class="road-mode-chip" aria-live="polite">
          <span>도로 상황 · ${escapeHtml(categoryLabel(sitCat))}</span>
          <button type="button" class="road-mode-chip-clear" id="roadModeClear" aria-label="일반 대화로 돌아가기">×</button>
        </div>`
      : purpose === "help"
        ? `<div class="road-mode-chip" aria-live="polite">
          <span>도움 요청</span>
          <button type="button" class="road-mode-chip-clear" id="roadModeClear" aria-label="일반 대화로 돌아가기">×</button>
        </div>`
        : "";

  const voiceBar = voiceActive
    ? `<div class="road-voice-bar" role="status">
        <span>음성 모드 · ${escapeHtml(voiceModeLabel(voice))}</span>
        <button type="button" class="secondary" id="roadVoiceStop">종료</button>
      </div>`
    : "";

  let expandedBlock = "";
  if (mode === "expanded") {
    const recentMsgs = (rc.messages || [])
      .slice(-5)
      .map((m) => {
        const who = m.mine ? "나" : m.senderNickname || "차량";
        const kind =
          m.category && m.category !== "chat" && m.category !== "courtesy" ? "상황" : "대화";
        return `<div class="road-float-msg ${m.mine ? "mine" : ""}"><span class="muted">${escapeHtml(kind)}</span> <b>${escapeHtml(who)}</b> ${escapeHtml(String(m.body || "").slice(0, 72))}</div>`;
      })
      .join("");
    const insight = buildLocalRoadInsight(state, participants);
    expandedBlock = `
      <div id="roadFloatingScroll" class="road-float-scroll">${recentMsgs || '<div class="muted">메시지 없음</div>'}</div>
      <div class="muted">참여 ${participants.length}대 · 같은 방향 ${participants.filter((p) => p.sameDirection).length}대 · ${escapeHtml(directionLabel(myDirection))}</div>
      <div class="muted road-float-insight-mini">${escapeHtml((insight.summaryText || "").slice(0, 80))}</div>
      <div class="convo-actions">
        <button type="button" class="primary" data-open-road-chat>대화방 열기</button>
      </div>`;
  }

  const menuOpen = overlay === "menu";
  const actionMenu = menuOpen
    ? `<div class="road-float-overlay road-float-menu" id="roadFloatMenu" role="menu" aria-label="메시지 기능">
        ${ROAD_FLOAT_ACTIONS.map(
          (a) =>
            `<button type="button" class="road-float-menu-item" role="menuitem" data-float-action="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button>`
        ).join("")}
      </div>`
    : "";

  let panelOverlay = "";
  if (overlay === "situation") {
    panelOverlay = `
      <div class="road-float-overlay road-float-sheet" id="roadFloatSheet" role="dialog" aria-label="도로 상황 선택">
        <div class="road-float-sheet-head">
          <b>도로 상황 알리기</b>
          <button type="button" class="secondary" id="roadOverlayClose" aria-label="닫기">닫기</button>
        </div>
        <div class="road-cat-bar" role="group" aria-label="도로 상황 분류">
          ${ROAD_SITUATION_CATEGORIES.map(
            (c) =>
              `<button type="button" class="secondary ${sitCat === c.id && purpose === "situation" ? "active" : ""}" data-sit-pick="${escapeHtml(c.id)}" aria-pressed="${sitCat === c.id && purpose === "situation"}">${escapeHtml(c.label)}</button>`
          ).join("")}
        </div>
        ${
          purpose === "situation"
            ? `<div class="road-suggest" role="listbox" aria-label="추천 문구">
            ${(SITUATION_PHRASE_HINTS[sitCat] || SITUATION_PHRASE_HINTS.other)
              .slice(0, 3)
              .map(
                (s) =>
                  `<button type="button" class="secondary road-suggest-item" role="option" data-sit-phrase="${escapeHtml(s)}">${escapeHtml(s)}</button>`
              )
              .join("")}
          </div>`
            : `<div class="muted">분류를 선택하면 추천 문구가 표시됩니다.</div>`
        }
      </div>`;
  } else if (overlay === "help") {
    panelOverlay = `
      <div class="road-float-overlay road-float-sheet" id="roadFloatSheet" role="dialog" aria-label="도움 요청">
        <div class="road-float-sheet-head">
          <b>도움 요청</b>
          <button type="button" class="secondary" id="roadOverlayClose" aria-label="닫기">닫기</button>
        </div>
        <div class="muted road-help-note">긴급신고 서비스가 아닙니다.</div>
        <div class="road-suggest" role="listbox">
          ${HELP_REQUEST_OPTIONS.map(
            (h) =>
              `<button type="button" class="secondary road-suggest-item" role="option" data-help-opt="${escapeHtml(h.id)}">${escapeHtml(h.label)}</button>`
          ).join("")}
        </div>
      </div>`;
  } else if (overlay === "quick") {
    const recent = (rc.recentQuickIds || [])
      .map((id) => getQuickDef(id))
      .filter(Boolean)
      .slice(0, 2);
    const recommend = DEFAULT_QUICK_RECOMMEND.map((id) => getQuickDef(id))
      .filter(Boolean)
      .filter((q) => !recent.some((r) => r.id === q.id));
    const primary = [...recent, ...recommend].slice(0, 6);
    const allList = floatUi.quickShowAll ? ROAD_QUICK_DEFS : primary;
    panelOverlay = `
      <div class="road-float-overlay road-float-sheet road-float-quick-sheet" id="roadFloatSheet" role="dialog" aria-label="빠른 메시지">
        <div class="road-float-sheet-head">
          <b>빠른 메시지</b>
          <button type="button" class="secondary" id="roadOverlayClose" aria-label="닫기">닫기</button>
        </div>
        ${
          recent.length
            ? `<div class="muted">최근 사용</div>
          <div class="road-quick-row">${recent
            .map(
              (q) =>
                `<button type="button" class="secondary road-quick" data-quick-id="${escapeHtml(q.id)}">${escapeHtml(q.label)}</button>`
            )
            .join("")}</div>`
            : ""
        }
        <div class="muted">${floatUi.quickShowAll ? "전체" : "추천"}</div>
        <div class="road-quick-row">${(floatUi.quickShowAll ? allList : primary)
          .map(
            (q) =>
              `<button type="button" class="secondary road-quick" data-quick-id="${escapeHtml(q.id)}">${escapeHtml(q.label)}</button>`
          )
          .join("")}</div>
        ${
          !floatUi.quickShowAll
            ? `<button type="button" class="secondary" id="roadQuickShowAll">전체 보기</button>`
            : ""
        }
      </div>`;
  }

  const placeholder =
    purpose === "situation"
      ? "도로 상황을 짧게 적어 주세요."
      : purpose === "help"
        ? "도움 요청을 입력하세요."
        : "메시지를 입력하세요";

  dock.innerHTML = `
    <div class="road-float-shell road-float-compact" data-conversation-id="${escapeHtml(rc.session.conversationId)}">
      <div class="road-float-head">
        <div>
          <b>현재 도로 대화</b> ${unreadBadge}
        </div>
        <div class="road-float-head-actions">
          <button type="button" class="secondary" id="roadDockCollapse" aria-label="패널 최소화">접기</button>
          <button type="button" class="secondary" id="roadDockModeToggle">${mode === "expanded" ? "간단히" : "더 보기"}</button>
        </div>
      </div>
      <div class="road-float-preview"><span class="muted">${escapeHtml(lastKind)}</span> “${escapeHtml(lastText.slice(0, 56))}”</div>
      ${expandedBlock}
      ${modeChip}
      ${voiceBar}
      <div class="road-float-compose-wrap">
        ${actionMenu}
        ${panelOverlay}
        <div class="road-float-compose-row">
          <button type="button" class="road-float-plus ${menuOpen ? "open" : ""}" id="roadFloatPlus"
            aria-label="메시지 기능 열기" aria-haspopup="menu" aria-expanded="${menuOpen}"
            aria-controls="roadFloatMenu">+</button>
          <div class="road-float-input-wrap">
            <label class="sr-only" for="roadFloatingText">도로 메시지 입력</label>
            <textarea id="roadFloatingText" rows="1" maxlength="${maxLen}"
              aria-label="현재 도로 참여 차량에 메시지를 보냅니다"
              placeholder="${escapeHtml(placeholder)}">${escapeHtml(draft)}</textarea>
            ${
              draft
                ? `<button type="button" class="road-float-inline-clear" id="roadFloatClear" aria-label="입력 지우기">×</button>`
                : ""
            }
            <span class="road-float-count ${nearLimit ? "near-limit" : ""}" id="roadFloatCount" ${draft.length < 40 && !nearLimit ? "hidden" : ""}>${draft.length}/${maxLen}</span>
          </div>
          <button type="button" class="primary road-float-send" id="roadFloatSend" aria-label="메시지 전송">전송</button>
        </div>
      </div>
    </div>`;

  const ta = dock.querySelector("#roadFloatingText");
  const countEl = dock.querySelector("#roadFloatCount");
  const clearBtn = dock.querySelector("#roadFloatClear");
  const updateCountUi = () => {
    if (!ta || !countEl) return;
    const len = ta.value.length;
    const near = len >= Math.floor(maxLen * 0.85);
    countEl.textContent = `${len}/${maxLen}`;
    countEl.hidden = len < 40 && !near;
    countEl.classList.toggle("near-limit", near);
    if (clearBtn) clearBtn.hidden = !len;
  };
  const autosize = () => {
    if (!ta) return;
    const dim = ensureConversationUi(state).drivingInteractionMode;
    const maxRows = dim === "moving" || dim === "unknown" ? 1 : 3;
    ta.rows = 1;
    const lines = Math.min(maxRows, Math.max(1, Math.ceil(ta.scrollHeight / 20)));
    ta.rows = lines;
    updateCountUi();
  };
  ta?.addEventListener("input", () => {
    if (ta.value.length > maxLen) ta.value = ta.value.slice(0, maxLen);
    rc.draftText = ta.value;
    persistUiDraft(state);
    autosize();
    if (clearBtn) {
      if (ta.value && clearBtn.hidden !== false) {
        /* clear 버튼은 재렌더 없이 표시 토글 */
      }
    }
    if (!dock.querySelector("#roadFloatClear") && ta.value) {
      const wrap = dock.querySelector(".road-float-input-wrap");
      if (wrap && !wrap.querySelector("#roadFloatClear")) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "road-float-inline-clear";
        b.id = "roadFloatClear";
        b.setAttribute("aria-label", "입력 지우기");
        b.textContent = "×";
        b.onclick = () => {
          clearRoadDraft(state);
          ta.value = "";
          saveState();
          autosize();
          b.remove();
        };
        wrap.appendChild(b);
      }
    }
  });
  ta?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (floatUi.overlay) {
        e.preventDefault();
        closeFloatOverlay();
        renderFloatingRoadChat(dock, state, { skipMarkRead: true });
        return;
      }
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    sendRoadMessage(state, ta.value, {
      source: "road_input",
      purpose: rc.messagePurpose,
      situationCategory: rc.situationCategory
    });
  });
  requestAnimationFrame(autosize);

  const plus = dock.querySelector("#roadFloatPlus");
  plus?.addEventListener("click", (e) => {
    e.stopPropagation();
    floatUi.overlay = floatUi.overlay === "menu" ? null : "menu";
    floatUi.quickShowAll = false;
    renderFloatingRoadChat(dock, state, { skipMarkRead: true });
    dock.querySelector("#roadFloatPlus")?.focus();
  });

  dock.querySelectorAll("[data-float-action]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.floatAction;
      if (id === "open_room") {
        closeFloatOverlay();
        openRoadRooms(state);
        return;
      }
      if (id === "voice") {
        closeFloatOverlay();
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          showSystemMessage("음성 입력은 아직 연동 전입니다. 텍스트 입력을 이용해 주세요.");
          renderFloatingRoadChat(dock, state, { skipMarkRead: true });
          return;
        }
        toggleRoadVoice(state);
        return;
      }
      if (id === "situation") {
        floatUi.overlay = "situation";
        renderFloatingRoadChat(dock, state, { skipMarkRead: true });
        return;
      }
      if (id === "help") {
        floatUi.overlay = "help";
        renderFloatingRoadChat(dock, state, { skipMarkRead: true });
        return;
      }
      if (id === "quick") {
        floatUi.overlay = "quick";
        floatUi.quickShowAll = false;
        renderFloatingRoadChat(dock, state, { skipMarkRead: true });
      }
    };
  });

  dock.querySelector("#roadOverlayClose")?.addEventListener("click", () => {
    closeFloatOverlay();
    renderFloatingRoadChat(dock, state, { skipMarkRead: true });
  });

  dock.querySelectorAll("[data-sit-pick]").forEach((b) => {
    b.onclick = () => {
      rc.messagePurpose = "situation";
      rc.situationCategory = b.dataset.sitPick;
      saveState();
      renderFloatingRoadChat(dock, state, { skipMarkRead: true });
    };
  });
  dock.querySelectorAll("[data-sit-phrase]").forEach((b) => {
    b.onclick = () => {
      rc.messagePurpose = "situation";
      const phrase = b.dataset.sitPhrase;
      rc.draftText = phrase;
      if (ta) ta.value = phrase;
      persistUiDraft(state);
      closeFloatOverlay();
      saveState();
      renderFloatingRoadChat(dock, state, { skipMarkRead: true });
      document.querySelector("#roadFloatingText")?.focus();
    };
  });
  dock.querySelectorAll("[data-help-opt]").forEach((b) => {
    b.onclick = () => {
      const opt = HELP_REQUEST_OPTIONS.find((h) => h.id === b.dataset.helpOpt);
      rc.messagePurpose = "help";
      if (opt) {
        rc.draftText = opt.phrase;
        if (ta) ta.value = opt.phrase;
        persistUiDraft(state);
      }
      closeFloatOverlay();
      saveState();
      renderFloatingRoadChat(dock, state, { skipMarkRead: true });
      document.querySelector("#roadFloatingText")?.focus();
    };
  });
  dock.querySelector("#roadQuickShowAll")?.addEventListener("click", () => {
    floatUi.quickShowAll = true;
    renderFloatingRoadChat(dock, state, { skipMarkRead: true });
  });
  dock.querySelectorAll("[data-quick-id]").forEach((b) => {
    b.onclick = () => {
      closeFloatOverlay();
      sendRoadMessage(state, getQuickDef(b.dataset.quickId)?.label, {
        quickId: b.dataset.quickId,
        fromQuick: true
      });
    };
  });

  dock.querySelector("#roadModeClear")?.addEventListener("click", () => {
    resetComposeMode(state);
    saveState();
    renderFloatingRoadChat(dock, state, { skipMarkRead: true });
  });
  dock.querySelector("#roadVoiceStop")?.addEventListener("click", () => {
    stopRoadVoice(state);
    saveState();
    renderFloatingRoadChat(dock, state, { skipMarkRead: true });
  });
  dock.querySelector("#roadFloatClear")?.addEventListener("click", () => {
    clearRoadDraft(state);
    if (ta) ta.value = "";
    saveState();
    renderFloatingRoadChat(dock, state, { skipMarkRead: true });
  });
  dock.querySelector("#roadFloatSend").onclick = () =>
    sendRoadMessage(state, ta?.value, {
      source: "road_input",
      purpose: rc.messagePurpose,
      situationCategory: rc.situationCategory
    });
  dock.querySelector("[data-open-road-chat]")?.addEventListener("click", () => openRoadRooms(state));
  dock.querySelector("#roadDockCollapse").onclick = () => {
    persistUiDraft(state);
    closeFloatOverlay();
    setDockMode(state, "collapsed");
    stopRoadVoice(state);
    saveState();
    renderFloatingRoadChat(dock, state);
  };
  dock.querySelector("#roadDockModeToggle").onclick = () => {
    persistUiDraft(state);
    closeFloatOverlay();
    setDockMode(state, mode === "expanded" ? "compact" : "expanded");
    saveState();
    renderFloatingRoadChat(dock, state);
  };

  if (!opts.skipMarkRead) markRoadChatRead(state);
  else updateRoadDockBadge(state);

  if (!floatUi.outsideBound) {
    floatUi.outsideBound = true;
    document.addEventListener("pointerdown", (e) => {
      if (!floatUi.overlay) return;
      const d = document.querySelector("#roadChatDock");
      if (!d || !stateRef) return;
      const t = e.target;
      if (d.contains(t)) {
        if (t.closest?.("#roadFloatPlus") || t.closest?.(".road-float-overlay")) return;
        /* 패널 안이지만 overlay 밖(입력 등) 클릭 시 메뉴만 닫기 */
        if (floatUi.overlay === "menu") {
          closeFloatOverlay();
          renderFloatingRoadChat(d, stateRef, { skipMarkRead: true });
        }
        return;
      }
      closeFloatOverlay();
      renderFloatingRoadChat(d, stateRef, { skipMarkRead: true });
    });
  }

  if (!dock.dataset.escBound) {
    dock.dataset.escBound = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const d = document.querySelector("#roadChatDock");
      if (!d || !stateRef) return;
      if (floatUi.overlay) {
        closeFloatOverlay();
        renderFloatingRoadChat(d, stateRef, { skipMarkRead: true });
        d.querySelector("#roadFloatPlus")?.focus();
        return;
      }
      if (stateRef.roadChat?.dockMode === "expanded") {
        setDockMode(stateRef, "compact");
        saveState();
        renderFloatingRoadChat(d, stateRef);
      }
    });
  }
}

/**
 * 도로 사이드: ROAD INSIGHT 우선 + 대화 요약(입력 없음)
 */
export function renderRoadDriveAssist(panel, state, opts = {}) {
  if (!panel) return;
  panelEl = panel;
  stateRef = state;
  const nav = ensureNavigation(state);
  const { rc, participants, myDirection, radiusM } = refreshSessionContext(state);
  if (!opts.skipActiveEmit) {
    emitRoadActive(state, participants);
    emit("spatialChat:mode", { mode: "road" });
  }
  syncRoadNavigationHud(state);
  const insight = buildLocalRoadInsight(state, participants);
  ensureRoadInsight(state);
  const name = (rc.session.roadName || nav.currentRoadName || "").trim();
  const split = getRoadUnreadSplit(state);
  const last = rc.messages?.length ? rc.messages[rc.messages.length - 1] : null;
  const lastText = last ? String(last.body || last.text || "") : "아직 메시지가 없습니다.";
  const lastKind =
    last?.category && last.category !== "chat" && last.category !== "courtesy" ? "도로 상황" : "일반 대화";

  panel.innerHTML = `
    <div class="road-drive-assist" data-conversation-type="road">
      ${insightCardHtml(insight, participants, radiusM)}
      <div class="card road-nav-card road-nav-compact">
        <b>주행 안내</b>
        <div class="muted">${escapeHtml(navigationModeLabel(nav.navigationMode))} · ${escapeHtml(name || "도로 확인 중")} · ${escapeHtml(directionLabel(myDirection))}</div>
        <div class="muted">목적지·ETA·제한속도: 경로 API 미연동 · 로컬 데모</div>
      </div>
      <div class="card road-chat-summary road-chat-summary-compact">
        <b>현재 도로 대화</b>
        <span class="muted" aria-label="대화 ${split.unreadMessageCount} 상황 ${split.unreadSituationCount}">
          대화 ${split.unreadMessageCount} · 상황 ${split.unreadSituationCount}
        </span>
        <div class="muted">참여 ${participants.length}대</div>
        <div class="road-chat-summary-preview"><span class="muted">${escapeHtml(lastKind)}</span> “${escapeHtml(lastText.slice(0, 64))}”</div>
        <div class="convo-actions">
          <button type="button" class="primary" data-open-road-chat>대화방 열기</button>
        </div>
        <div class="muted" style="margin-top:6px">입력·빠른 메시지는 왼쪽 Floating Chat</div>
      </div>
    </div>`;

  panel.querySelector("[data-open-road-chat]")?.addEventListener("click", () => openRoadRooms(state));
  updateRoadDockBadge(state);
}

export function renderRoadChatPanel(panel, state, opts = {}) {
  if (opts.full) return renderRoadChatContentDetail(panel, state, opts);
  return renderRoadDriveAssist(panel, state, opts);
}

/**
 * Content Workspace 전체 도로 대화 상세 — Spatial과 동일 messages · ROAD INSIGHT
 */
export function renderRoadChatContentDetail(panel, state, opts = {}) {
  if (!panel) return;
  contentHostEl = panel;
  stateRef = state;
  const { rc, participants, myDirection, radiusM } = refreshSessionContext(state);
  const q = String(opts.search || rc._contentSearch || "").trim().toLowerCase();
  rc._contentSearch = q;
  const catFilter = opts.categoryFilter || rc.contentCategoryFilter || "all";
  rc.contentCategoryFilter = catFilter;

  const voice = rc.voiceMode || "inactive";
  const voiceOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const insight = buildLocalRoadInsight(state, participants);
  const split = getRoadUnreadSplit(state);
  const purpose = rc.messagePurpose || "chat";
  const sitCat = rc.situationCategory || "traffic";

  const messages = (rc.messages || []).filter((m) => {
    if (catFilter === "chat") {
      if (m.category && m.category !== "chat" && m.category !== "courtesy") return false;
    } else if (catFilter !== "all") {
      if (m.category !== catFilter) return false;
    }
    if (!q) return true;
    const hay = `${m.body || ""} ${m.senderNickname || ""}`.toLowerCase();
    return hay.includes(q);
  });
  const bubbles = messages
    .map((m) => {
      const sit = m.category && m.category !== "chat" && m.category !== "courtesy";
      const tag = sit
        ? `<span class="bubble-cat muted">${escapeHtml(categoryLabel(m.category))}</span>`
        : `<span class="bubble-cat muted">일반</span>`;
      const label = m.mine
        ? ""
        : `<div class="bubble-sender">${escapeHtml(m.senderNickname || m.senderVehicleId || "차량")}</div>`;
      return `${label}<div class="bubble ${m.mine ? "mine" : ""} ${sit ? "bubble-situation" : "bubble-chat"}">${tag} ${escapeHtml(m.body || m.text || "")}</div>`;
    })
    .join("");

  const people = participants
    .map(
      (p) => `
    <button type="button" class="road-participant ${rc.selectedVehicleId === p.id ? "selected" : ""}" data-road-user="${escapeHtml(p.id)}">
      <b>${escapeHtml(p.nickname || p.id)}</b>
      <span class="muted">${p.sameDirection ? "같은 방향" : "다른 방향"} · ${Math.round(p.distanceM)}m</span>
    </button>`
    )
    .join("");

  const filters = [
    { id: "all", label: "전체" },
    { id: "traffic", label: "정체" },
    { id: "incident", label: "사고" },
    { id: "hazard", label: "위험" },
    { id: "construction", label: "공사" },
    { id: "help", label: "도움" },
    { id: "chat", label: "일반" }
  ];
  const filterBar = `<div class="road-content-filters" role="group" aria-label="메시지 분류 필터">
    ${filters
      .map(
        (f) =>
          `<button type="button" class="secondary ${catFilter === f.id ? "active" : ""}" data-cat-filter="${escapeHtml(f.id)}" aria-pressed="${catFilter === f.id}">${escapeHtml(f.label)}</button>`
      )
      .join("")}
  </div>`;

  panel.innerHTML = `
    <div class="road-chat-shell road-chat-content-detail" data-road-content-detail data-conversation-type="road" data-conversation-id="${escapeHtml(rc.session.conversationId)}">
      <div class="card chat-header road-chat-header">
        <button class="secondary" id="roadContentBack" type="button">←</button>
        <div class="chat-header-main">
          ${headerContextHtml(state, participants, myDirection, radiusM)}
          <div class="muted" style="margin-top:4px">대화 ${split.unreadMessageCount} · 상황 ${split.unreadSituationCount} · 음성 ${voiceOk ? "사용 가능" : "미지원"} · ${escapeHtml(voiceModeLabel(voice))}</div>
        </div>
        <button class="secondary" id="roadContentToSpatial" type="button">공간에서 보기</button>
      </div>
      ${insightCardHtml(insight, participants, radiusM, { filterable: true })}
      ${filterBar}
      <div class="card">
        <label class="muted">메시지 검색</label>
        <input id="roadContentSearch" type="search" placeholder="메시지·닉네임" value="${escapeHtml(q)}" />
      </div>
      <div class="card road-chat-participants">
        <b>참여 차량 ${participants.length}대</b>
        <div class="road-participant-list">${people || '<div class="muted">반경 내 참여 가능한 차량이 없습니다.</div>'}</div>
      </div>
      <div id="roadChatScrollContent" class="chat-scroll road-chat-scroll road-chat-scroll-full">${bubbles || '<div class="muted" style="padding:8px">도로 대화를 시작해 보세요.</div>'}</div>
      <div class="road-purpose-bar" role="radiogroup" aria-label="메시지 목적">
        <button type="button" class="secondary ${purpose === "chat" ? "active" : ""}" data-purpose="chat" role="radio" aria-checked="${purpose === "chat"}">일반 대화</button>
        <button type="button" class="secondary ${purpose === "situation" ? "active" : ""}" data-purpose="situation" role="radio" aria-checked="${purpose === "situation"}">도로 상황</button>
        <button type="button" class="secondary ${purpose === "help" ? "active" : ""}" data-purpose="help" role="radio" aria-checked="${purpose === "help"}">도움 요청</button>
      </div>
      ${
        purpose === "situation"
          ? `<div class="road-cat-bar" role="group" aria-label="도로 상황 분류">
          ${ROAD_SITUATION_CATEGORIES.map(
            (c) =>
              `<button type="button" class="secondary ${sitCat === c.id ? "active" : ""}" data-sit-cat="${escapeHtml(c.id)}" aria-pressed="${sitCat === c.id}">${escapeHtml(c.label)}</button>`
          ).join("")}
        </div>`
          : purpose === "help"
            ? `<div class="muted road-help-note">도움 요청은 참고용입니다. 긴급신고를 대체하지 않습니다.</div>`
            : ""
      }
      <div class="road-quick-row">
        ${ROAD_QUICK_DEFS.map(
          (qm) =>
            `<button type="button" class="secondary road-quick" data-quick-id="${escapeHtml(qm.id)}" aria-label="${escapeHtml(qm.label)}">${escapeHtml(qm.label)}</button>`
        ).join("")}
      </div>
      <div class="chat-compose road-compose">
        <textarea id="roadChatTextContent" maxlength="${ROAD_CHAT_CONFIG.maxLengthContent}" placeholder="메시지 입력 (최대 ${ROAD_CHAT_CONFIG.maxLengthContent}자)" rows="2">${escapeHtml(rc.contentDraftText || getRoadDraft(state) || "")}</textarea>
        <div class="compose-actions">
          <button type="button" class="secondary" id="roadContentReport">신고</button>
          <button type="button" class="secondary" id="roadContentBlock">차단</button>
          <button type="button" class="primary" id="roadChatSendContent" aria-label="메시지 전송">전송</button>
        </div>
      </div>
      <div class="muted insight-disclaimer" style="padding:8px">표시된 도로 정보는 참여자 메시지 기반 참고 정보입니다.</div>
    </div>`;

  const scroll = panel.querySelector("#roadChatScrollContent");
  if (scroll) {
    requestAnimationFrame(() => {
      scroll.scrollTop = rc.contentScrollTop != null ? rc.contentScrollTop : scroll.scrollHeight;
    });
  }

  panel.querySelector("#roadContentBack").onclick = () => {
    persistUiDraft(state);
    contentHostEl = null;
    saveState();
    emit("roadchat:contentBack");
  };
  panel.querySelector("#roadContentToSpatial").onclick = () => {
    persistUiDraft(state);
    saveState();
    emit("roadchat:requestOpen");
  };
  panel.querySelector("#roadContentSearch")?.addEventListener("change", (e) => {
    persistUiDraft(state);
    renderRoadChatContentDetail(panel, state, { search: e.target.value, skipMarkRead: true });
  });
  panel.querySelectorAll("[data-cat-filter]").forEach((b) => {
    b.onclick = () => {
      rc.contentCategoryFilter = b.dataset.catFilter;
      saveState();
      renderRoadChatContentDetail(panel, state, { skipMarkRead: true });
    };
  });
  panel.querySelectorAll("[data-insight-filter]").forEach((b) => {
    b.onclick = () => {
      rc.contentCategoryFilter = b.dataset.insightFilter;
      saveState();
      renderRoadChatContentDetail(panel, state, { skipMarkRead: true });
    };
  });
  panel.querySelectorAll("[data-purpose]").forEach((b) => {
    b.onclick = () => {
      rc.messagePurpose = b.dataset.purpose;
      saveState();
      renderRoadChatContentDetail(panel, state, { skipMarkRead: true });
    };
  });
  panel.querySelectorAll("[data-sit-cat]").forEach((b) => {
    b.onclick = () => {
      rc.situationCategory = b.dataset.sitCat;
      saveState();
      renderRoadChatContentDetail(panel, state, { skipMarkRead: true });
    };
  });
  panel.querySelector("#roadChatSendContent").onclick = () => {
    const ta = panel.querySelector("#roadChatTextContent");
    sendRoadMessage(state, ta?.value, {
      maxLen: ROAD_CHAT_CONFIG.maxLengthContent,
      source: "content_input",
      purpose: rc.messagePurpose,
      situationCategory: rc.situationCategory
    });
  };
  panel.querySelector("#roadChatTextContent")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    sendRoadMessage(state, e.target.value, {
      maxLen: ROAD_CHAT_CONFIG.maxLengthContent,
      source: "content_input",
      purpose: rc.messagePurpose,
      situationCategory: rc.situationCategory
    });
  });
  panel.querySelectorAll("[data-quick-id]").forEach((b) => {
    b.onclick = () =>
      sendRoadMessage(state, getQuickDef(b.dataset.quickId)?.label, {
        quickId: b.dataset.quickId,
        fromQuick: true,
        maxLen: ROAD_CHAT_CONFIG.maxLengthContent
      });
  });
  panel.querySelectorAll("[data-road-user]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.roadUser;
      rc.selectedVehicleId = id;
      persistUiDraft(state);
      saveState();
      emit("user:open", { id });
    };
  });
  panel.querySelector("#roadContentReport").onclick = () => {
    showSystemMessage("신고는 서버 연동 후 처리됩니다. 지금은 로컬 안내만 표시합니다.");
  };
  panel.querySelector("#roadContentBlock").onclick = () => {
    const id = rc.selectedVehicleId;
    if (!id) {
      showSystemMessage("차단할 참여 차량을 먼저 선택하세요.");
      return;
    }
    if (!Array.isArray(state.blockedUserIds)) state.blockedUserIds = [];
    if (!state.blockedUserIds.includes(id)) state.blockedUserIds.push(id);
    saveState();
    showSystemMessage("선택 차량을 차단 목록에 추가했습니다.");
    renderRoadChatContentDetail(panel, state, { skipMarkRead: true });
  };

  if (!opts.skipMarkRead) markRoadChatRead(state);
}

/**
 * 도로 스테이지 Floating Chat — Renderer 재생성 없음
 */
export function ensureRoadChatDock(state) {
  const stage = document.querySelector("#roadStage") || document.querySelector("#threeHost")?.parentElement;
  if (!stage) return null;
  let dock = document.querySelector("#roadChatDock");
  if (!dock) {
    dock = document.createElement("div");
    dock.id = "roadChatDock";
    dock.className = "road-chat-dock";
    stage.appendChild(dock);
  }
  const rc = ensureRoadChat(state);
  if (!rc.dockMode) setDockMode(state, rc.panelMinimized ? "collapsed" : "compact");
  renderFloatingRoadChat(dock, state, { skipMarkRead: true });
  return dock;
}

export function syncRoadChatOnView(state, viewName) {
  if (viewName === "road" || viewName === "all") {
    ensureRoadChatDock(state);
    refreshSessionContext(state);
    updateRoadDockBadge(state);
  }
}

export function captureRoadChatUi(state) {
  if (!state) return;
  persistUiDraft(state);
}

export function getRoadUnread(state) {
  return Math.max(0, Number(ensureRoadChat(state).unread) || 0);
}

let bootBound = false;
export function bindRoadChatBoot() {
  if (bootBound) return;
  bootBound = true;
  on("users:changed", () => {
    if (!stateRef) return;
    try {
      const dock = document.querySelector("#roadChatDock");
      if (dock) renderFloatingRoadChat(dock, stateRef, { skipMarkRead: true });
      if (panelEl?.isConnected && panelEl.querySelector?.(".road-drive-assist")) {
        renderRoadDriveAssist(panelEl, stateRef, { skipActiveEmit: true, skipMarkRead: true });
      }
    } catch (e) {
      console.warn("[VROO road-chat] users sync", e);
    }
  });
}

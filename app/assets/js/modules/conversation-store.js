/**
 * 공통 conversation store 파사드
 * - road / nearby / grid / direct 는 각각 별도 세션·메시지 배열
 * - 화면별 메시지 복제 금지
 */
import { emit } from "../core/events.js";
import { MY_USER_ID } from "./data.js";

export const ROAD_CHAT_CONFIG = Object.freeze({
  maxLengthRoad: 120,
  maxLengthContent: 500,
  draftTtlMs: 24 * 60 * 60 * 1000
});

export const ROAD_INSIGHT_CONFIG = Object.freeze({
  observationWindowSeconds: 300,
  warningThreshold: 3,
  criticalThreshold: 6,
  duplicateSenderWindowSeconds: 120,
  staleAfterSeconds: 180,
  maxSuggestions: 3
});

export const ROAD_SITUATION_CATEGORIES = Object.freeze([
  { id: "traffic", label: "정체", spatialPriority: "warning", expiresInSeconds: 120 },
  { id: "incident", label: "사고", spatialPriority: "urgent", expiresInSeconds: 300 },
  { id: "hazard", label: "위험", spatialPriority: "urgent", expiresInSeconds: 300 },
  { id: "construction", label: "공사", spatialPriority: "warning", expiresInSeconds: 180 },
  { id: "obstacle", label: "장애물", spatialPriority: "warning", expiresInSeconds: 180 },
  { id: "detour", label: "우회", spatialPriority: "warning", expiresInSeconds: 120 },
  { id: "other", label: "기타", spatialPriority: "normal", expiresInSeconds: 90 }
]);

/** 빠른 메시지 — group 별 표시 */
export const ROAD_QUICK_DEFS = Object.freeze([
  {
    id: "traffic_ahead",
    label: "앞에 정체가 있습니다",
    group: "traffic",
    category: "traffic",
    spatialVisibility: "nearby",
    spatialPriority: "warning",
    expiresInSeconds: 120
  },
  {
    id: "need_detour",
    label: "우회가 필요합니다",
    group: "traffic",
    category: "detour",
    spatialVisibility: "nearby",
    spatialPriority: "warning",
    expiresInSeconds: 120
  },
  {
    id: "construction",
    label: "도로 공사가 있습니다",
    group: "traffic",
    category: "construction",
    spatialVisibility: "nearby",
    spatialPriority: "warning",
    expiresInSeconds: 180
  },
  {
    id: "accident",
    label: "사고가 있습니다",
    group: "safety",
    category: "incident",
    spatialVisibility: "nearby",
    spatialPriority: "urgent",
    expiresInSeconds: 300
  },
  {
    id: "hazard",
    label: "위험합니다",
    group: "safety",
    category: "hazard",
    spatialVisibility: "nearby",
    spatialPriority: "urgent",
    expiresInSeconds: 300
  },
  {
    id: "obstacle",
    label: "장애물이 있습니다",
    group: "safety",
    category: "obstacle",
    spatialVisibility: "nearby",
    spatialPriority: "warning",
    expiresInSeconds: 180
  },
  {
    id: "thanks_yield",
    label: "양보 감사합니다",
    group: "courtesy",
    category: "courtesy",
    spatialVisibility: "none",
    spatialPriority: "normal",
    expiresInSeconds: 0
  },
  {
    id: "go_first",
    label: "먼저 가세요",
    group: "courtesy",
    category: "courtesy",
    spatialVisibility: "none",
    spatialPriority: "normal",
    expiresInSeconds: 0
  },
  {
    id: "need_help",
    label: "도움이 필요합니다",
    group: "help",
    category: "help",
    spatialVisibility: "nearby",
    spatialPriority: "warning",
    expiresInSeconds: 120
  }
]);

export const ROAD_QUICK_GROUPS = Object.freeze([
  { id: "traffic", label: "교통" },
  { id: "safety", label: "안전" },
  { id: "courtesy", label: "배려" },
  { id: "help", label: "도움" }
]);

export const PHRASE_SUGGESTIONS = Object.freeze([
  { prefix: "앞에", labels: ["앞에 정체가 있습니다", "앞에 사고가 있습니다", "앞에 공사 중입니다", "앞에 장애물이 있습니다"] },
  { prefix: "사고", labels: ["사고가 있습니다", "앞에 사고가 있습니다"] },
  { prefix: "정체", labels: ["앞에 정체가 있습니다"] },
  { prefix: "도움", labels: ["도움이 필요합니다"] },
  { prefix: "공사", labels: ["도로 공사가 있습니다"] },
  { prefix: "위험", labels: ["위험합니다"] }
]);

export const SPATIAL_OVERLAY_DEFAULTS = Object.freeze({
  maxBubbles: 4,
  clusterZoomBelow: 15,
  ttlMs: Object.freeze({
    normal: 30_000,
    warning: 120_000,
    urgent: 300_000
  }),
  spatialKeywords: Object.freeze([
    "앞에 정체가 있습니다",
    "사고가 있습니다",
    "위험합니다",
    "도로 공사가 있습니다",
    "도움이 필요합니다",
    "장애물이 있습니다",
    "우회가 필요합니다"
  ])
});

export function getQuickDef(idOrLabel) {
  const key = String(idOrLabel || "");
  return ROAD_QUICK_DEFS.find((q) => q.id === key || q.label === key) || null;
}

/**
 * 자유 입력 문장 분류 — 키워드만으로 urgent/지도표시 확정하지 않음
 */
export function classifyFreeTextMessage(text) {
  const body = String(text || "").trim();
  if (!body) return { kind: "chat", category: null, suggestedPriority: "normal", keyword: null };
  const hit = SPATIAL_OVERLAY_DEFAULTS.spatialKeywords.find((k) => body.includes(k));
  if (!hit) return { kind: "chat", category: null, suggestedPriority: "normal", keyword: null };
  let category = "traffic";
  let suggestedPriority = "warning";
  if (hit.includes("사고")) {
    category = "incident";
    suggestedPriority = "urgent";
  } else if (hit.includes("위험")) {
    category = "hazard";
    suggestedPriority = "urgent";
  } else if (hit.includes("공사")) {
    category = "construction";
    suggestedPriority = "warning";
  } else if (hit.includes("도움")) {
    category = "help";
    suggestedPriority = "warning";
  } else if (hit.includes("정체")) {
    category = "traffic";
    suggestedPriority = "warning";
  }
  return { kind: "situation_candidate", category, suggestedPriority, keyword: hit };
}

export function defaultNavigationState() {
  return {
    navigationMode: "idle",
    destination: null,
    routeId: null,
    currentRoadName: null,
    direction: null,
    remainingDistanceMeters: null,
    eta: null,
    speedKmh: null,
    speedLimitKmh: null,
    nextInstruction: null,
    nextInstructionDistanceMeters: null,
    laneGuidance: [],
    incidents: [],
    trafficLevel: "unknown",
    dataSource: "local",
    demoSpeedKmh: null,
    demoForwardVehicles: 0,
    demoSafety: "unknown"
  };
}

export function defaultNearbyChatState() {
  return {
    session: {
      type: "nearby",
      conversationId: "nearby-session-current",
      id: "nearby-session-current",
      title: "주변 대화",
      radiusM: 500,
      participantVehicleIds: [],
      startedAt: null,
      lastActiveAt: null
    },
    messages: [],
    unread: 0,
    draftText: "",
    scrollTop: null,
    selectedVehicleId: null
  };
}

export function defaultRoadInsightState() {
  return {
    status: "no_data",
    generatedAt: null,
    sourceMessageCount: 0,
    activeVehicleCount: 0,
    sameDirectionVehicleCount: 0,
    trafficCount: 0,
    incidentCount: 0,
    hazardCount: 0,
    constructionCount: 0,
    helpCount: 0,
    courtesyCount: 0,
    confidence: null,
    summaryText: "",
    severity: "normal",
    stale: false,
    dataSource: "local",
    consensus: []
  };
}

export function defaultTrustProfile(accountId) {
  return {
    accountId: accountId || null,
    vehicleId: accountId || null,
    roadReportCount: 0,
    confirmedReportCount: 0,
    rejectedReportCount: 0,
    trustScore: null,
    trustLevel: "unrated"
  };
}

export function ensureNavigation(state) {
  if (!state.navigation || typeof state.navigation !== "object" || Array.isArray(state.navigation)) {
    state.navigation = defaultNavigationState();
  }
  const n = state.navigation;
  const modes = ["idle", "route_preview", "navigating", "rerouting", "arrived", "unavailable"];
  if (!modes.includes(n.navigationMode)) n.navigationMode = "idle";
  if (!Array.isArray(n.laneGuidance)) n.laneGuidance = [];
  if (!Array.isArray(n.incidents)) n.incidents = [];
  if (!n.dataSource) n.dataSource = "local";
  if (!n.trafficLevel) n.trafficLevel = "unknown";
  if (n.navigationMode === "navigating" || n.navigationMode === "route_preview") {
    if (!n.routeId && !n.destination) n.navigationMode = "idle";
  }
  return n;
}

export function ensureNearbyChat(state) {
  if (!state.nearbyChat || typeof state.nearbyChat !== "object" || Array.isArray(state.nearbyChat)) {
    state.nearbyChat = defaultNearbyChatState();
  }
  const nc = state.nearbyChat;
  if (!nc.session || typeof nc.session !== "object") nc.session = defaultNearbyChatState().session;
  nc.session.type = "nearby";
  if (!nc.session.conversationId) nc.session.conversationId = "nearby-session-current";
  nc.session.id = nc.session.conversationId;
  if (!nc.session.title) nc.session.title = "주변 대화";
  nc.session.radiusM = Math.max(100, Math.floor(Number(nc.session.radiusM) || 500));
  if (!Array.isArray(nc.session.participantVehicleIds)) nc.session.participantVehicleIds = [];
  if (!Array.isArray(nc.messages)) nc.messages = [];
  nc.unread = Math.max(0, Math.floor(Number(nc.unread) || 0));
  if (typeof nc.draftText !== "string") nc.draftText = "";
  return nc;
}

export function ensureSpatialOverlayConfig(state) {
  if (!state.spatialOverlayConfig || typeof state.spatialOverlayConfig !== "object") {
    state.spatialOverlayConfig = {
      maxBubbles: SPATIAL_OVERLAY_DEFAULTS.maxBubbles,
      clusterZoomBelow: SPATIAL_OVERLAY_DEFAULTS.clusterZoomBelow,
      ttlMs: { ...SPATIAL_OVERLAY_DEFAULTS.ttlMs }
    };
  }
  const c = state.spatialOverlayConfig;
  c.maxBubbles = Math.max(1, Math.min(8, Math.floor(Number(c.maxBubbles) || SPATIAL_OVERLAY_DEFAULTS.maxBubbles)));
  c.clusterZoomBelow = Math.max(10, Math.min(18, Math.floor(Number(c.clusterZoomBelow) || 15)));
  if (!c.ttlMs || typeof c.ttlMs !== "object") c.ttlMs = { ...SPATIAL_OVERLAY_DEFAULTS.ttlMs };
  return c;
}

export function ensureSpatialOverlays(state) {
  if (!Array.isArray(state.spatialMessageOverlays)) state.spatialMessageOverlays = [];
  return state.spatialMessageOverlays;
}

export function ensureConversationUi(state) {
  if (!state.conversationUi || typeof state.conversationUi !== "object") {
    state.conversationUi = {
      activeConversationId: null,
      draftByConversationId: {},
      scrollByConversationId: {},
      selectedVehicleByConversationId: {},
      returnView: null,
      drivingInteractionMode: "unknown"
    };
  }
  const ui = state.conversationUi;
  if (!ui.draftByConversationId || typeof ui.draftByConversationId !== "object") ui.draftByConversationId = {};
  if (!ui.scrollByConversationId || typeof ui.scrollByConversationId !== "object") ui.scrollByConversationId = {};
  if (!ui.selectedVehicleByConversationId || typeof ui.selectedVehicleByConversationId !== "object") {
    ui.selectedVehicleByConversationId = {};
  }
  if (!["parked", "passenger", "moving", "unknown"].includes(ui.drivingInteractionMode)) {
    ui.drivingInteractionMode = "unknown";
  }
  return ui;
}

export function ensureRoadInsight(state) {
  if (!state.roadInsight || typeof state.roadInsight !== "object" || Array.isArray(state.roadInsight)) {
    state.roadInsight = defaultRoadInsightState();
  }
  const s = state.roadInsight;
  const statuses = ["unavailable", "no_data", "local_summary", "ai_summary", "stale", "error"];
  if (s.status === "ai_summary") s.status = "local_summary";
  else if (!statuses.includes(s.status)) s.status = "no_data";
  if (!s.dataSource) s.dataSource = "local";
  if (!["normal", "notice", "warning", "critical"].includes(s.severity)) s.severity = "normal";
  if (!Array.isArray(s.consensus)) s.consensus = [];
  s.confidence = null;
  return s;
}

export function ensureTrustProfiles(state) {
  if (!state.trustProfiles || typeof state.trustProfiles !== "object" || Array.isArray(state.trustProfiles)) {
    state.trustProfiles = {};
  }
  return state.trustProfiles;
}

export function getOrCreateTrustProfile(state, accountId) {
  const map = ensureTrustProfiles(state);
  const id = String(accountId || "");
  if (!id) return defaultTrustProfile(null);
  if (!map[id]) map[id] = defaultTrustProfile(id);
  const t = map[id];
  if (!["unrated", "new", "trusted", "high_confidence", "restricted"].includes(t.trustLevel)) {
    t.trustLevel = "unrated";
  }
  t.trustScore = null;
  return t;
}

export function getSituationCategoryMeta(id) {
  return ROAD_SITUATION_CATEGORIES.find((c) => c.id === id) || null;
}

export function categoryLabel(id) {
  if (id === "help") return "도움";
  if (id === "courtesy") return "배려";
  if (id === "chat" || !id) return "일반";
  return getSituationCategoryMeta(id)?.label || id;
}

export function severityLabel(sev) {
  return (
    {
      normal: "보통",
      notice: "참고",
      warning: "주의",
      critical: "경계"
    }[sev] || "보통"
  );
}

export function getPhraseSuggestions(text) {
  const t = String(text || "").trim();
  if (t.length < 1) return [];
  const hit = PHRASE_SUGGESTIONS.find((p) => t.startsWith(p.prefix) || t.includes(p.prefix));
  if (!hit) return [];
  return hit.labels.filter((l) => l !== t).slice(0, ROAD_INSIGHT_CONFIG.maxSuggestions);
}

function isSituationMessage(m) {
  if (!m) return false;
  const cat = m.category;
  if (!cat || cat === "courtesy" || cat === "chat") return false;
  if (m.spatialVisibility && m.spatialVisibility !== "none") return true;
  return ["traffic", "incident", "hazard", "construction", "obstacle", "detour", "help", "other"].includes(cat);
}

/** 동일 발신자 중복을 제한한 카테고리별 공간 공감 집계 */
export function rebuildSituationConsensus(state) {
  const cfg = ROAD_INSIGHT_CONFIG;
  const now = Date.now();
  const windowMs = cfg.observationWindowSeconds * 1000;
  const dupMs = cfg.duplicateSenderWindowSeconds * 1000;
  const msgs = (state.roadChat?.messages || []).filter(
    (m) => isSituationMessage(m) && now - (Number(m.createdAt) || 0) <= windowMs
  );
  /** @type {Map<string, { category: string, senders: Map<string, number>, first: number, last: number }>} */
  const byCat = new Map();
  for (const m of msgs) {
    const cat = m.category || "other";
    const sid = String(m.senderVehicleId || m.senderAccountId || "unknown");
    if (!byCat.has(cat)) {
      byCat.set(cat, { category: cat, senders: new Map(), first: Number(m.createdAt) || now, last: Number(m.createdAt) || now });
    }
    const bucket = byCat.get(cat);
    const prev = bucket.senders.get(sid);
    const ts = Number(m.createdAt) || now;
    if (prev == null || ts - prev > dupMs) {
      bucket.senders.set(sid, ts);
    }
    bucket.first = Math.min(bucket.first, ts);
    bucket.last = Math.max(bucket.last, ts);
  }
  const consensus = [...byCat.values()]
    .map((b) => ({
      category: b.category,
      confirmationCount: b.senders.size,
      uniqueSenderCount: b.senders.size,
      firstReportedAt: b.first,
      lastReportedAt: b.last,
      roadContextId: state.roadChat?.session?.conversationId || "road-session-current",
      status: "active"
    }))
    .filter((c) => c.uniqueSenderCount > 0)
    .sort((a, b) => b.uniqueSenderCount - a.uniqueSenderCount);
  const insight = ensureRoadInsight(state);
  insight.consensus = consensus;
  state.roadSituationConsensus = consensus;
  return consensus;
}

export function computeSeverity(counts, consensus) {
  const cfg = ROAD_INSIGHT_CONFIG;
  const weight =
    (counts.traffic || 0) +
    (counts.construction || 0) +
    (counts.obstacle || 0) * 1.2 +
    (counts.hazard || 0) * 2 +
    (counts.incident || 0) * 2.5 +
    (counts.help || 0) * 2;
  const multiConfirm = (consensus || []).filter((c) => c.uniqueSenderCount >= 2).length;
  const strong =
    (counts.incident || 0) + (counts.hazard || 0) + (counts.help || 0);
  if (weight >= cfg.criticalThreshold && (strong >= 2 || multiConfirm >= 2)) return "critical";
  if (weight >= cfg.warningThreshold || multiConfirm >= 1 && strong >= 1) return "warning";
  if (weight >= 1 || (counts.traffic || 0) + (counts.construction || 0) >= 1) return "notice";
  return "normal";
}

function buildSummaryText(insight, consensus) {
  const top = (consensus || []).filter((c) => c.uniqueSenderCount >= 2)[0];
  if (insight.status === "no_data" || insight.sourceMessageCount === 0) {
    return "최근 공간 메시지가 없습니다.";
  }
  if (insight.stale) {
    return "도로 정보가 오래되어 상황을 판단하기 어렵습니다. 전방을 직접 확인하세요.";
  }
  if (insight.severity === "critical") {
    return "사고·위험·도움 관련 메시지가 여러 차량에서 보고되었습니다. 전방을 주의해서 확인하세요. (참고 정보)";
  }
  if (top) {
    return `최근 ${categoryLabel(top.category)} 관련 메시지 ${top.uniqueSenderCount}명이 확인했습니다.`;
  }
  if (insight.trafficCount > 0) {
    return `최근 5분 동안 정체 관련 메시지 ${insight.trafficCount}건이 확인되었습니다.`;
  }
  if (insight.incidentCount > 0 || insight.hazardCount > 0) {
    return "사고 또는 위험 관련 메시지가 있습니다. 전방을 주의해서 확인하세요.";
  }
  return "참여자 메시지를 바탕으로 한 참고 정보입니다.";
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

export function getNearbyParticipants(state, usersList = []) {
  const nc = ensureNearbyChat(state);
  const me = state.location || { lat: 37.5665, lng: 126.978 };
  const radius = nc.session.radiusM || 500;
  const blocked = new Set((state.blockedUserIds || []).map(String));
  const list = (usersList || [])
    .filter((u) => {
      if (!u?.id || u.id === MY_USER_ID) return false;
      if (blocked.has(String(u.id))) return false;
      if (u.online === false) return false;
      const d = haversineMeters(me, u);
      return Number.isFinite(d) && d <= radius;
    })
    .map((u) => ({ ...u, distanceM: haversineMeters(me, u) }))
    .sort((a, b) => a.distanceM - b.distanceM);
  nc.session.participantVehicleIds = list.map((p) => String(p.id));
  return list;
}

export function getVehicleConversationStatus(state, userId) {
  const id = String(userId || "");
  if (!id) return { status: "no_conversation", unread: 0, lastMessage: "", lastAt: null, source: null };
  if ((state.blockedUserIds || []).map(String).includes(id)) {
    return { status: "blocked", unread: 0, lastMessage: "", lastAt: null, source: "blocked" };
  }

  const room = state.rooms?.[id];
  const road = state.roadChat;
  const nearby = state.nearbyChat;
  const roadHit = road?.messages?.filter((m) => String(m.senderVehicleId || m.senderAccountId) === id).at(-1);
  const nearHit = nearby?.messages?.filter((m) => String(m.senderVehicleId || m.senderAccountId) === id).at(-1);
  const directLast = room?.messages?.at(-1);
  const directUnread = Math.max(0, Number(room?.unread) || 0);

  let lastMessage = "";
  let lastAt = null;
  let source = null;
  let unread = 0;
  let status = "no_conversation";

  const candidates = [];
  if (roadHit) candidates.push({ m: roadHit, source: "road", unread: 0 });
  if (nearHit) candidates.push({ m: nearHit, source: "nearby", unread: 0 });
  if (directLast) candidates.push({ m: directLast, source: "direct", unread: directUnread });

  if (candidates.length) {
    candidates.sort((a, b) => (Number(b.m.createdAt) || 0) - (Number(a.m.createdAt) || 0));
    const top = candidates[0];
    lastMessage = String(top.m.body || top.m.text || "");
    lastAt = top.m.createdAt || null;
    source = top.source;
    unread = top.unread;
    status = unread > 0 ? "unread" : "active";
  }

  const overlays = ensureSpatialOverlays(state).filter(
    (o) => String(o.senderVehicleId || "") === id && (!o.expiresAt || o.expiresAt > nowSafe())
  );
  if (overlays.some((o) => o.spatialPriority === "urgent")) status = "urgent";
  else if (overlays.some((o) => o.spatialPriority === "warning") && status !== "unread") {
    status = status === "no_conversation" ? "active" : status;
  }

  return { status, unread, lastMessage, lastAt, source };
}

function nowSafe() {
  return Date.now();
}

/** 자유 입력은 classify + 사용자 확인. 기본 지도 표시 없음 */
export function inferSpatialMeta(text) {
  const c = classifyFreeTextMessage(text);
  if (c.kind !== "situation_candidate") {
    return { spatialVisibility: "none", spatialPriority: "normal" };
  }
  return {
    spatialVisibility: "none",
    spatialPriority: c.suggestedPriority,
    keyword: c.keyword,
    situationCandidate: true,
    category: c.category
  };
}

export function pushSpatialOverlay(state, payload) {
  ensureSpatialOverlayConfig(state);
  const list = ensureSpatialOverlays(state);
  const ttlSec = Number(payload.expiresInSeconds);
  const ttl =
    Number.isFinite(ttlSec) && ttlSec > 0
      ? ttlSec * 1000
      : state.spatialOverlayConfig.ttlMs?.[payload.spatialPriority] || SPATIAL_OVERLAY_DEFAULTS.ttlMs.normal;
  const entry = {
    id: payload.id || `overlay-${Date.now().toString(36)}`,
    conversationId: payload.conversationId,
    conversationType: payload.conversationType || "road",
    senderVehicleId: payload.senderVehicleId || null,
    senderNickname: payload.senderNickname || null,
    body: String(payload.body || "").slice(0, 48),
    spatialVisibility: payload.spatialVisibility || "marker",
    spatialPriority: payload.spatialPriority || "normal",
    category: payload.category || null,
    createdAt: payload.createdAt || Date.now(),
    expiresAt: payload.expiresAt != null ? payload.expiresAt : Date.now() + ttl,
    anchorVehicleId: payload.anchorVehicleId || payload.senderVehicleId || null
  };
  if (entry.spatialVisibility === "none") return null;
  state.spatialMessageOverlays = [entry, ...list.filter((x) => x.id !== entry.id)].slice(0, 40);
  emit("spatialOverlay:changed");
  return entry;
}

export function pruneSpatialOverlays(state) {
  const now = Date.now();
  const list = ensureSpatialOverlays(state);
  const next = list.filter((o) => !o.expiresAt || o.expiresAt > now);
  if (next.length !== list.length) {
    state.spatialMessageOverlays = next;
    emit("spatialOverlay:changed");
  }
  return next;
}

export function getActiveSpatialOverlays(state, zoom) {
  ensureSpatialOverlayConfig(state);
  pruneSpatialOverlays(state);
  const cfg = state.spatialOverlayConfig;
  const consensus = rebuildSituationConsensus(state);
  let list = ensureSpatialOverlays(state).filter((o) => o.spatialVisibility !== "none");
  list.sort((a, b) => {
    const p = { urgent: 3, warning: 2, normal: 1 };
    const pd = (p[b.spatialPriority] || 0) - (p[a.spatialPriority] || 0);
    if (pd) return pd;
    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
  });
  const situationClusters = consensus.map((c) => ({
    category: c.category,
    label: categoryLabel(c.category),
    confirmationCount: c.uniqueSenderCount,
    lastReportedAt: c.lastReportedAt,
    severity:
      c.category === "incident" || c.category === "hazard"
        ? "urgent"
        : c.category === "help"
          ? "warning"
          : "warning"
  }));
  if (Number(zoom) < cfg.clusterZoomBelow) {
    return {
      mode: "situation_cluster",
      count: list.length,
      items: [],
      situationClusters
    };
  }
  return {
    mode: "bubbles",
    count: list.length,
    items: list.slice(0, cfg.maxBubbles),
    situationClusters
  };
}

/** 최근 관측창 road 상황 메시지 로컬 집계 (AI 아님 · 일반 대화 제외) */
export function buildLocalRoadInsight(state, participants = []) {
  const insight = ensureRoadInsight(state);
  const cfg = ROAD_INSIGHT_CONFIG;
  const now = Date.now();
  const windowMs = cfg.observationWindowSeconds * 1000;
  const msgs = Array.isArray(state.roadChat?.messages) ? state.roadChat.messages : [];
  const recentAll = msgs.filter((m) => now - (Number(m.createdAt) || 0) <= windowMs);
  const recentSit = recentAll.filter(isSituationMessage);
  const consensus = rebuildSituationConsensus(state);

  const counts = {
    traffic: 0,
    incident: 0,
    hazard: 0,
    construction: 0,
    help: 0,
    courtesy: 0,
    obstacle: 0,
    detour: 0,
    other: 0
  };
  const bump = (cat) => {
    if (!cat) return;
    if (cat === "courtesy") counts.courtesy += 1;
    else if (counts[cat] != null) counts[cat] += 1;
    else counts.other += 1;
  };
  for (const m of recentSit) bump(m.category);

  const sameDir = participants.filter((p) => p.sameDirection).length;
  const lastSitAt = recentSit.reduce((mx, m) => Math.max(mx, Number(m.createdAt) || 0), 0);
  const stale = lastSitAt > 0 && now - lastSitAt > cfg.staleAfterSeconds * 1000;

  insight.activeVehicleCount = participants.length;
  insight.sameDirectionVehicleCount = sameDir;
  insight.sourceMessageCount = recentSit.length;
  insight.trafficCount = counts.traffic + counts.detour;
  insight.incidentCount = counts.incident;
  insight.hazardCount = counts.hazard + counts.obstacle;
  insight.constructionCount = counts.construction;
  insight.helpCount = counts.help;
  insight.courtesyCount = recentAll.filter((m) => m.category === "courtesy").length;
  insight.generatedAt = now;
  insight.dataSource = "local";
  insight.confidence = null;
  insight.stale = stale;
  insight.consensus = consensus;
  insight.severity = computeSeverity(
    {
      traffic: insight.trafficCount,
      incident: insight.incidentCount,
      hazard: insight.hazardCount,
      construction: insight.constructionCount,
      help: insight.helpCount,
      obstacle: counts.obstacle
    },
    consensus
  );

  if (recentSit.length === 0) {
    insight.status = stale ? "stale" : "no_data";
    insight.summaryText = "최근 공간 메시지가 없습니다.";
    if (!participants.length) insight.summaryText = "도로 정보가 부족하여 상황을 판단할 수 없습니다.";
  } else {
    insight.status = stale ? "stale" : "local_summary";
    insight.summaryText = buildSummaryText(insight, consensus);
  }
  return insight;
}

/** 일반 대화 unread vs 상황 unread 분리 */
export function getRoadUnreadSplit(state) {
  const rc = state?.roadChat;
  const total = Math.max(0, Number(rc?.unread) || 0);
  const unreadSituation = Math.max(0, Math.floor(Number(rc?.unreadSituation) || 0));
  const unreadMessage = Math.max(0, total - unreadSituation);
  return {
    unreadMessageCount: unreadMessage,
    unreadSituationCount: unreadSituation,
    total
  };
}

export function getUnreadSummary(state) {
  let direct = 0;
  let grid = 0;
  let room = 0;
  for (const r of Object.values(state?.rooms || {})) {
    const n = Math.max(0, Number(r?.unread) || 0);
    if (r?.type === "grid") grid += n;
    else if (r?.type === "room") room += n;
    else if (r?.type !== "road") direct += n;
  }
  const road = Math.max(0, Number(state?.roadChat?.unread) || 0);
  const nearby = Math.max(0, Number(state?.nearbyChat?.unread) || 0);
  const split = getRoadUnreadSplit(state);
  return {
    road,
    nearby,
    grid,
    direct,
    room,
    roadMessages: split.unreadMessageCount,
    roadSituations: split.unreadSituationCount,
    total: road + nearby + grid + direct + room
  };
}

export function navigationModeLabel(mode) {
  return (
    {
      idle: "대기 · 경로 미설정",
      route_preview: "경로 미리보기",
      navigating: "안내 중",
      rerouting: "재탐색 중",
      arrived: "도착",
      unavailable: "내비게이션 미연동"
    }[mode] || "대기"
  );
}

export function openConversationInChat(conversationId, opts = {}) {
  emit("chat:openConversation", {
    conversationId,
    returnView: opts.returnView || null,
    returnScreen: opts.returnScreen || null
  });
}

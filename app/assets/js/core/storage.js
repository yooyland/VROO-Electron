import {
  createVehicleProgression,
  normalizeVehicleProgression,
  progressionFromLegacyState
} from "../modules/progression.js";

/** 테스트용 무한 크레딧. 기본 false — 실제 잔액 규칙 사용 */
export const DEV_MODE = false;

/** 최초 설치(저장값 없음·비정상) 시 기본 크레딧 */
export const DEFAULT_CREDITS = 10000;

/** GRID 생성 비용 */
export const GRID_CREATE_COST = 1200;

/** 주변 차량 번호판 확인 비용 */
export const PLATE_REVEAL_COST = 300;

/** 성장 업그레이드: 현재 레벨 × 이 값 */
export const LEVEL_UP_COST_FACTOR = 900;

export const STORAGE_KEY = "vrooBeta10";
export const STORAGE_SCHEMA_VERSION = 2;
export const STORAGE_BACKUP_KEY = `${STORAGE_KEY}:backup`;
export const STORAGE_CORRUPT_KEY = `${STORAGE_KEY}:corrupt`;

export function growthUpgradeCost(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return lv * LEVEL_UP_COST_FACTOR;
}

/** 크레딧을 0 이상 정수로 정규화. 비정상이면 0 */
export function normalizeCredits(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** 천 단위 구분 표시 (음수 방지) */
export function formatCredits(value) {
  return normalizeCredits(value).toLocaleString("ko-KR");
}

export function canAfford(state, cost) {
  if (DEV_MODE) return true;
  const need = Math.max(0, Math.floor(Number(cost) || 0));
  return normalizeCredits(state?.credits) >= need;
}

/**
 * 성공 시에만 state.credits 차감.
 * DEV_MODE면 차감하지 않고 ok.
 */
export function spendCredits(state, cost) {
  const need = Math.max(0, Math.floor(Number(cost) || 0));
  if (DEV_MODE) {
    state.credits = normalizeCredits(state.credits);
    return {ok: true, spent: 0, balance: state.credits};
  }
  const bal = normalizeCredits(state.credits);
  if (bal < need) {
    return {ok: false, spent: 0, balance: bal, needed: need};
  }
  state.credits = bal - need;
  return {ok: true, spent: need, balance: state.credits};
}

export const defaults = {
  _schemaVersion: STORAGE_SCHEMA_VERSION,
  credits: DEFAULT_CREDITS,
  level: 1,
  xp: 0,
  vehicleProgression: createVehicleProgression(),
  currentScreen: "nearby",
  currentView: "near",
  currentGridId: "g_my",
  currentGrid: "MY GRID",
  /** GPS가 속한 LOCAL Spatial GRID (자동) */
  locationGridId: null,
  /** 지도에서 조회 중인 GRID (자동 참여 아님) */
  selectedGridId: null,
  joinedGrids: ["g_my"],
  /** 사용자 생성 community GRID만 저장 — 전국 spatial 셀 저장 금지 */
  grids: [],
  /** Spatial GRID 가입자 user.id 맵 { [gridId]: string[] } */
  spatialMembers: {},
  revealedPlateUserIds: [],
  connections: [],
  favoriteRooms: [],
  favoritePlaceIds: [],
  registeredPlaces: [],
  nearbyTab: "friends",
  rooms: {},
  /** 도로 기반 대화 세션 — Spatial·Content 공유 */
  roadChat: null,
  /** 주변 반경 대화 (road와 분리) */
  nearbyChat: null,
  /** 종료된 도로 세션 로컬 최근 기록 (일반 room 아님) */
  roadChatHistory: [],
  /** 대화방 목록 필터: all | spatial | direct | room */
  roomsListFilter: "all",
  /** 내비게이션 준비 상태 (API 미연동 시 idle) */
  navigation: null,
  /** 지도 공간 메시지 오버레이 */
  spatialMessageOverlays: [],
  spatialOverlayConfig: null,
  /** 지도 레이어·필터 표시 설정 */
  mapLayerPrefs: null,
  conversationUi: null,
  roadInsight: null,
  /** Spatial 채팅 UI 복원용 */
  spatialChatUi: {
    mode: null,
    peerId: null,
    gridId: null
  },
  blockedUserIds: [],
  posts: [],
  profile: {
    nickname: "VROO 관리자",
    plate: "12가 3456",
    car: "basic",
    status: "1.1.0-beta.1 테스트 중"
  },
  location: {lat: 37.5665, lng: 126.9780},
  hornEnabled: true,
  mapBearing: 0,
  garageAutoRotate: true
};

function merge(base, value) {
  if (Array.isArray(base)) {
    return Array.isArray(value) ? value : structuredClone(base);
  }
  if (base && typeof base === "object") {
    const out = {...base};
    const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], src[k]);
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out;
  }
  return value === undefined ? base : value;
}

function sanitizeState(s) {
  const n = Number(s.credits);
  if (!Number.isFinite(n) || n < 0) s.credits = DEFAULT_CREDITS;
  else s.credits = Math.floor(n);

  s.level = Math.max(1, Math.floor(Number(s.level) || 1));
  const xp = Number(s.xp);
  s.xp = Number.isFinite(xp) ? Math.max(0, Math.min(100, Math.floor(xp))) : 0;
  s.vehicleProgression = normalizeVehicleProgression(s.vehicleProgression);

  for (const key of ["joinedGrids", "connections", "favoriteRooms", "favoritePlaceIds", "registeredPlaces", "posts", "grids", "revealedPlateUserIds", "blockedUserIds"]) {
    if (!Array.isArray(s[key])) s[key] = structuredClone(defaults[key] || []);
  }
  s.revealedPlateUserIds = [...new Set(s.revealedPlateUserIds.map(String).filter(Boolean))];
  s.favoritePlaceIds = [...new Set(s.favoritePlaceIds.map(String).filter(Boolean))];
  s.registeredPlaces = s.registeredPlaces
    .filter((p) => p && typeof p === "object")
    .map((p, index) => ({
      id: String(p.id || `pin-${index}`),
      name: String(p.name || "내 등록지점"),
      subtitle: String(p.subtitle || "사용자 등록 위치"),
      kind: "place",
      category: String(p.category || "favorite"),
      lat: Number(p.lat),
      lng: Number(p.lng),
      createdAt: Number(p.createdAt) || Date.now()
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!["friends", "poi", "fav", "pins"].includes(s.nearbyTab)) s.nearbyTab = "friends";

  // 구버전 GRID 이름 → id 마이그레이션
  const legacyNameToId = {
    "MY GRID": "g_my",
    "강남 드라이브": "g_gangnam",
    "안전운전": "g_safe",
    "야간 드라이브": "g_night",
    "VROO 공식 이벤트": "g_event",
    "자동차 보험 혜택": "g_insure"
  };
  s.joinedGrids = [...new Set(
    s.joinedGrids
      .map(x => {
        const v = String(x || "");
        return legacyNameToId[v] || v;
      })
      .filter(Boolean)
  )];

  if (!s.currentGridId) {
    const fromName = legacyNameToId[s.currentGrid] || s.currentGrid;
    s.currentGridId = s.joinedGrids.includes(fromName) ? fromName : (s.joinedGrids[0] || "g_my");
  }
  if (!s.joinedGrids.includes(s.currentGridId)) {
    s.joinedGrids.push(s.currentGridId);
  }

  if (s.locationGridId != null && s.locationGridId !== "") {
    s.locationGridId = String(s.locationGridId);
  } else {
    s.locationGridId = null;
  }
  if (s.selectedGridId != null && s.selectedGridId !== "") {
    s.selectedGridId = String(s.selectedGridId);
  } else {
    s.selectedGridId = null;
  }

  if (!s.spatialMembers || typeof s.spatialMembers !== "object" || Array.isArray(s.spatialMembers)) {
    s.spatialMembers = {};
  } else {
    const cleaned = {};
    for (const [gid, members] of Object.entries(s.spatialMembers)) {
      if (!String(gid).startsWith("KR:")) continue;
      if (!Array.isArray(members)) continue;
      cleaned[gid] = [...new Set(members.map(String).filter(Boolean))];
    }
    s.spatialMembers = cleaned;
  }

  // 사용자 생성 community GRID 정규화 (spatial 전국 셀은 저장하지 않음)
  const seenGridIds = new Set();
  s.grids = s.grids.map((g, i) => {
    if (!g || typeof g !== "object") return null;
    let id = String(g.id || "").trim();
    if (!id) id = `g_migrated_${i}_${Date.now().toString(36)}`;
    if (String(id).startsWith("KR:") || g.type === "spatial") return null;
    if (seenGridIds.has(id)) return null;
    seenGridIds.add(id);
    let memberIds = Array.isArray(g.memberIds)
      ? g.memberIds.map(String)
      : Array.isArray(g.members)
        ? g.members.map(m => (typeof m === "string" ? m : m?.id)).filter(Boolean)
        : [];
    memberIds = [...new Set(memberIds.filter(Boolean))];
    const ownerId = String(g.ownerId || "me");
    if (!memberIds.includes(ownerId)) memberIds.unshift(ownerId);
    const center = g.center && typeof g.center === "object"
      ? {lat: Number(g.center.lat) || 37.5665, lng: Number(g.center.lng) || 126.978}
      : {lat: 37.5665, lng: 126.978};
    return {
      id,
      type: "community",
      name: String(g.name || g.title || id),
      ownerId,
      memberIds,
      createdAt: Number(g.createdAt) || Date.now(),
      center,
      visibility: g.visibility || "public",
      chatRoomId: g.chatRoomId || `grid:${id}`,
      radiusM: Math.max(200, Number(g.radiusM) || 800),
      ad: !!g.ad,
      people: Math.max(memberIds.length, Number(g.people) || memberIds.length),
      spatialId: g.spatialId && String(g.spatialId).startsWith("KR:") ? String(g.spatialId) : null
    };
  }).filter(Boolean);

  // currentGrid 표시명은 id에서 유도(없으면 유지)
  if (s.currentGridId === "g_my") s.currentGrid = s.currentGrid || "MY GRID";
  if (String(s.currentGridId || "").startsWith("KR:")) {
    /* 표시명은 grid 모듈에서 getGridDisplayName으로 보정 */
    if (!s.currentGrid || s.currentGrid === s.currentGridId) {
      s.currentGrid = s.currentGridId;
    }
  }
  const owned = s.grids.find(g => g.id === s.currentGridId);
  if (owned) s.currentGrid = owned.name;
  else if (legacyNameToId[s.currentGrid]) {
    /* keep display until grid module resolves seed name */
  } else if (!s.currentGrid) {
    s.currentGrid = s.currentGridId;
  }

  if (!s.rooms || typeof s.rooms !== "object" || Array.isArray(s.rooms)) {
    s.rooms = {};
  } else {
    for (const key of Object.keys(s.rooms)) {
      const room = s.rooms[key];
      if (!room || typeof room !== "object" || Array.isArray(room)) {
        delete s.rooms[key];
        continue;
      }
      const isGrid = room.type === "grid" || String(key).startsWith("grid:") || String(room.id || "").startsWith("grid:");
      if (!Array.isArray(room.messages)) room.messages = [];
      else {
        room.messages = room.messages.filter(m => m != null).map(m => {
          if (typeof m === "string") {
            return {id: `legacy_${key}_${Math.random().toString(36).slice(2, 7)}`, text: m, mine: false, senderId: isGrid ? "unknown" : key, createdAt: Date.now(), roomId: key};
          }
          if (typeof m !== "object") return null;
          const text = String(m.text ?? "").trim();
          if (!text) return null;
          return {
            id: m.id || `legacy_${key}_${Math.random().toString(36).slice(2, 7)}`,
            text,
            mine: m.mine === true,
            senderId: m.senderId || (m.mine ? "me" : (isGrid ? "unknown" : key)),
            createdAt: Number(m.createdAt) || Date.now(),
            roomId: m.roomId || key
          };
        }).filter(Boolean);
      }
      room.unread = Math.max(0, Math.floor(Number(room.unread) || 0));
      if (typeof room.last !== "string") room.last = "";
      if (isGrid) {
        room.type = "grid";
        room.gridId = room.gridId || String(key).replace(/^grid:/, "") || String(room.id || "").replace(/^grid:/, "");
        room.id = room.id || `grid:${room.gridId}`;
        if (!room.title) room.title = "GRID 대화";
      } else if (room.type === "road" || String(key).startsWith("road:")) {
        room.type = "road";
        room.conversationType = "road";
      } else {
        room.type = room.type === "room" ? "room" : (room.type || "direct");
        room.conversationType = room.type;
        room.id = room.id || key;
        room.peerId = room.peerId || room.user?.id || key;
        if (!room.title) room.title = room.user?.nickname || key;
      }
    }
  }

  if (!s.roadChat || typeof s.roadChat !== "object" || Array.isArray(s.roadChat)) {
    s.roadChat = {
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
      contentDraftText: ""
    };
  } else {
    if (!s.roadChat.session || typeof s.roadChat.session !== "object") {
      s.roadChat.session = {
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
      };
    }
    s.roadChat.session.type = "road";
    if (!s.roadChat.session.conversationId || s.roadChat.session.conversationId === "road-session-local") {
      s.roadChat.session.conversationId = "road-session-current";
    }
    s.roadChat.session.id = s.roadChat.session.conversationId;
    if (!s.roadChat.session.title) s.roadChat.session.title = "현재 도로 대화";
    if (!Array.isArray(s.roadChat.messages)) s.roadChat.messages = [];
    s.roadChat.unread = Math.max(0, Math.floor(Number(s.roadChat.unread) || 0));
    s.roadChat.unreadSituation = Math.max(0, Math.floor(Number(s.roadChat.unreadSituation) || 0));
    if (!["chat", "situation", "help"].includes(s.roadChat.messagePurpose)) s.roadChat.messagePurpose = "chat";
    if (typeof s.roadChat.situationCategory !== "string") s.roadChat.situationCategory = "traffic";
    if (typeof s.roadChat.contentCategoryFilter !== "string") s.roadChat.contentCategoryFilter = "all";
    if (typeof s.roadChat.draftText !== "string") s.roadChat.draftText = "";
    if (typeof s.roadChat.contentDraftText !== "string") s.roadChat.contentDraftText = "";
  }

  if (!s.roadInsight || typeof s.roadInsight !== "object" || Array.isArray(s.roadInsight)) {
    s.roadInsight = {
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
  if (!Array.isArray(s.roadSituationConsensus)) s.roadSituationConsensus = [];
  if (!s.trustProfiles || typeof s.trustProfiles !== "object" || Array.isArray(s.trustProfiles)) {
    s.trustProfiles = {};
  }

  if (!Array.isArray(s.roadChatHistory)) s.roadChatHistory = [];
  if (!["all", "spatial", "direct", "room"].includes(s.roomsListFilter)) s.roomsListFilter = "all";

  if (!s.nearbyChat || typeof s.nearbyChat !== "object" || Array.isArray(s.nearbyChat)) {
    s.nearbyChat = {
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
  } else {
    if (!s.nearbyChat.session || typeof s.nearbyChat.session !== "object") {
      s.nearbyChat.session = {
        type: "nearby",
        conversationId: "nearby-session-current",
        id: "nearby-session-current",
        title: "주변 대화",
        radiusM: 500,
        participantVehicleIds: [],
        startedAt: null,
        lastActiveAt: null
      };
    }
    s.nearbyChat.session.type = "nearby";
    if (!Array.isArray(s.nearbyChat.messages)) s.nearbyChat.messages = [];
    s.nearbyChat.unread = Math.max(0, Math.floor(Number(s.nearbyChat.unread) || 0));
  }

  if (!s.navigation || typeof s.navigation !== "object" || Array.isArray(s.navigation)) {
    s.navigation = {
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
  } else {
    const modes = ["idle", "route_preview", "navigating", "rerouting", "arrived", "unavailable"];
    if (!modes.includes(s.navigation.navigationMode)) s.navigation.navigationMode = "idle";
    if (!Array.isArray(s.navigation.laneGuidance)) s.navigation.laneGuidance = [];
    if (!Array.isArray(s.navigation.incidents)) s.navigation.incidents = [];
    if (!s.navigation.dataSource) s.navigation.dataSource = "local";
  }

  if (!Array.isArray(s.spatialMessageOverlays)) s.spatialMessageOverlays = [];
  if (!s.spatialOverlayConfig || typeof s.spatialOverlayConfig !== "object") {
    s.spatialOverlayConfig = {
      maxBubbles: 2,
      clusterZoomBelow: 15,
      ttlMs: { normal: 30000, warning: 120000, urgent: 300000 }
    };
  }
  if (!s.conversationUi || typeof s.conversationUi !== "object") {
    s.conversationUi = {
      activeConversationId: null,
      draftByConversationId: {},
      scrollByConversationId: {},
      selectedVehicleByConversationId: {},
      returnView: null,
      drivingInteractionMode: "unknown"
    };
  } else if (!["parked", "passenger", "moving", "unknown"].includes(s.conversationUi.drivingInteractionMode)) {
    s.conversationUi.drivingInteractionMode = "unknown";
  }

  if (!s.roadInsight || typeof s.roadInsight !== "object" || Array.isArray(s.roadInsight)) {
    s.roadInsight = {
      status: "no_data",
      generatedAt: null,
      sourceMessageCount: 0,
      trafficCount: 0,
      incidentCount: 0,
      hazardCount: 0,
      helpCount: 0,
      summaryText: "",
      confidence: null,
      dataSource: "local"
    };
  } else if (s.roadInsight.status === "ai_summary") {
    s.roadInsight.status = "local_summary";
  }

  if (!s.spatialChatUi || typeof s.spatialChatUi !== "object" || Array.isArray(s.spatialChatUi)) {
    s.spatialChatUi = { mode: null, peerId: null, gridId: null };
  }

  if (!s.profile || typeof s.profile !== "object" || Array.isArray(s.profile)) {
    s.profile = structuredClone(defaults.profile);
  }
  if (!s.location || typeof s.location !== "object" || Array.isArray(s.location)) {
    s.location = structuredClone(defaults.location);
  } else {
    const lat = Number(s.location.lat);
    const lng = Number(s.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      s.location = structuredClone(defaults.location);
    }
  }
  const bearing = Number(s.mapBearing);
  s.mapBearing = Number.isFinite(bearing) ? bearing : 0;
  s.hornEnabled = !!s.hornEnabled;
  if (!s.mapLayerPrefs || typeof s.mapLayerPrefs !== "object" || Array.isArray(s.mapLayerPrefs)) {
    s.mapLayerPrefs = {
      showVehicles: true,
      showPlaces: true,
      showLandmarks: true,
      showRoadLabels: true,
      showAreaLabels: true,
      showSpatial: true,
      filterMode: "all",
      placeCategoryFilter: "all",
      vehicleFilter: "all",
      labelsVisible: true
    };
  } else {
    s.mapLayerPrefs.showVehicles = s.mapLayerPrefs.showVehicles !== false;
    s.mapLayerPrefs.showPlaces = s.mapLayerPrefs.showPlaces !== false;
    s.mapLayerPrefs.showLandmarks = s.mapLayerPrefs.showLandmarks !== false;
    s.mapLayerPrefs.showRoadLabels = s.mapLayerPrefs.showRoadLabels !== false;
    s.mapLayerPrefs.showAreaLabels = s.mapLayerPrefs.showAreaLabels !== false;
    s.mapLayerPrefs.showSpatial = s.mapLayerPrefs.showSpatial !== false;
    s.mapLayerPrefs.labelsVisible = s.mapLayerPrefs.labelsVisible !== false;
    if (!["all", "vehicle", "place", "spatial"].includes(s.mapLayerPrefs.filterMode)) {
      s.mapLayerPrefs.filterMode = "all";
    }
  }
  return s;
}

function parseStateJson(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let parsed = parseStateJson(raw);
    let recoveredFromBackup = false;
    if (raw && !parsed) {
      try {
        localStorage.setItem(STORAGE_CORRUPT_KEY, raw);
      } catch (e) {
        console.warn("[VROO storage] 손상 데이터 격리 실패", e);
      }
      parsed = parseStateJson(localStorage.getItem(STORAGE_BACKUP_KEY));
      recoveredFromBackup = !!parsed;
    }
    if (parsed && !parsed.vehicleProgression) {
      parsed.vehicleProgression = progressionFromLegacyState(parsed);
    }
    const s = sanitizeState(merge(structuredClone(defaults), parsed || {}));
    s._schemaVersion = STORAGE_SCHEMA_VERSION;
    if (recoveredFromBackup) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        console.warn("[VROO storage] 주 저장소 손상으로 백업에서 복구했습니다.");
      } catch (e) {
        console.warn("[VROO storage] 복구 상태 재저장 실패", e);
      }
    }
    return s;
  } catch {
    const s = sanitizeState(structuredClone(defaults));
    s._schemaVersion = STORAGE_SCHEMA_VERSION;
    return s;
  }
}

export function saveState(state) {
  let serialized;
  try {
    state._schemaVersion = STORAGE_SCHEMA_VERSION;
    state.credits = normalizeCredits(state.credits);
    serialized = JSON.stringify(state);
  } catch (e) {
    console.error("[VROO storage] 저장 데이터 직렬화 실패", e);
    return false;
  }
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current && current !== serialized && parseStateJson(current)) {
      localStorage.setItem(STORAGE_BACKUP_KEY, current);
    }
  } catch (e) {
    console.warn("[VROO storage] 백업 저장 실패", e);
  }
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

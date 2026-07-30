import {emit} from "../core/events.js";

export const VOICE_ROLES = Object.freeze({
  HOST: "host",
  MODERATOR: "moderator",
  SPEAKER: "speaker",
  LISTENER: "listener"
});

export const VOICE_STATES = Object.freeze({
  IDLE: "idle",
  LISTENING: "listening",
  REQUESTING: "requesting",
  QUEUED: "queued",
  SPEAKING: "speaking",
  MUTED: "muted",
  RECONNECTING: "reconnecting",
  BLOCKED: "blocked"
});

export const VOICE_ROOM_MODES = Object.freeze({
  OPEN: "open",
  APPROVAL: "approval"
});

const VALID_STATES = new Set(Object.values(VOICE_STATES));
const VALID_ROLES = new Set(Object.values(VOICE_ROLES));
const VALID_MODES = new Set(Object.values(VOICE_ROOM_MODES));

function normalizedId(value) {
  return String(value || "").trim();
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizedId).filter(Boolean))];
}

function publicSnapshot(session) {
  return {
    roomId: session.roomId,
    role: session.role,
    state: session.state,
    mode: session.mode,
    hostId: session.hostId,
    moderatorIds: [...session.moderatorIds],
    speakerIds: [...session.speakerIds],
    requestQueue: [...session.requestQueue],
    mutedIds: [...session.mutedIds],
    blockedIds: [...session.blockedIds],
    transitionAt: session.transitionAt,
    reason: session.reason
  };
}

function notify(session, previousState) {
  try {
    emit("voice:sessionChanged", {
      ...publicSnapshot(session),
      previousState: previousState || null
    });
  } catch (error) {
    console.warn("[VROO voice] sessionChanged", error);
  }
}

export function createVoiceSession(options = {}) {
  const roomId = normalizedId(options.roomId);
  if (!roomId) throw new Error("voice roomId is required");

  const role = VALID_ROLES.has(options.role) ? options.role : VOICE_ROLES.LISTENER;
  const mode = VALID_MODES.has(options.mode) ? options.mode : VOICE_ROOM_MODES.APPROVAL;
  const hostId = normalizedId(options.hostId);
  const speakerIds = uniqueIds(options.speakerIds);
  const state = VALID_STATES.has(options.state) ? options.state : VOICE_STATES.IDLE;

  return {
    roomId,
    role,
    state,
    mode,
    hostId,
    moderatorIds: uniqueIds(options.moderatorIds),
    speakerIds,
    requestQueue: uniqueIds(options.requestQueue).filter((id) => !speakerIds.includes(id)),
    mutedIds: uniqueIds(options.mutedIds),
    blockedIds: uniqueIds(options.blockedIds),
    transitionAt: Number(options.transitionAt) || Date.now(),
    reason: normalizedId(options.reason)
  };
}

export function ensureVoiceSession(appState, roomId, options = {}) {
  if (!appState || typeof appState !== "object") {
    throw new Error("VROO app state is required");
  }
  if (!appState.voiceSessions || typeof appState.voiceSessions !== "object") {
    appState.voiceSessions = {};
  }

  const key = normalizedId(roomId);
  if (!key) throw new Error("voice roomId is required");

  const existing = appState.voiceSessions[key];
  const session = createVoiceSession({
    ...existing,
    ...options,
    roomId: key,
    moderatorIds: options.moderatorIds ?? existing?.moderatorIds,
    speakerIds: options.speakerIds ?? existing?.speakerIds,
    requestQueue: options.requestQueue ?? existing?.requestQueue,
    mutedIds: options.mutedIds ?? existing?.mutedIds,
    blockedIds: options.blockedIds ?? existing?.blockedIds
  });
  appState.voiceSessions[key] = session;
  return session;
}

export function transitionVoiceState(session, nextState, reason = "") {
  if (!session || typeof session !== "object") throw new Error("voice session is required");
  if (!VALID_STATES.has(nextState)) throw new Error(`invalid voice state: ${nextState}`);

  const previousState = session.state;
  session.state = nextState;
  session.reason = normalizedId(reason);
  session.transitionAt = Date.now();
  notify(session, previousState);
  return session;
}

export function setVoiceRole(session, role) {
  if (!session || typeof session !== "object") throw new Error("voice session is required");
  if (!VALID_ROLES.has(role)) throw new Error(`invalid voice role: ${role}`);
  session.role = role;
  session.transitionAt = Date.now();
  notify(session, session.state);
  return session;
}

export function requestToSpeak(session, userId) {
  const id = normalizedId(userId);
  if (!id || session.blockedIds.includes(id) || session.mutedIds.includes(id)) return false;
  if (session.speakerIds.includes(id) || session.requestQueue.includes(id)) return false;

  if (session.mode === VOICE_ROOM_MODES.OPEN) {
    session.speakerIds = uniqueIds([...session.speakerIds, id]);
  } else {
    session.requestQueue = uniqueIds([...session.requestQueue, id]);
  }
  session.transitionAt = Date.now();
  notify(session, session.state);
  return true;
}

export function approveSpeaker(session, userId, actorId) {
  const id = normalizedId(userId);
  const actor = normalizedId(actorId);
  const canModerate = actor && (actor === session.hostId || session.moderatorIds.includes(actor));
  if (!canModerate || !id || session.blockedIds.includes(id)) return false;

  session.requestQueue = session.requestQueue.filter((queuedId) => queuedId !== id);
  session.mutedIds = session.mutedIds.filter((mutedId) => mutedId !== id);
  session.speakerIds = uniqueIds([...session.speakerIds, id]);
  session.transitionAt = Date.now();
  notify(session, session.state);
  return true;
}

export function removeSpeaker(session, userId, actorId = userId) {
  const id = normalizedId(userId);
  const actor = normalizedId(actorId);
  const self = actor === id;
  const canModerate = actor && (actor === session.hostId || session.moderatorIds.includes(actor));
  if (!id || (!self && !canModerate)) return false;

  session.speakerIds = session.speakerIds.filter((speakerId) => speakerId !== id);
  session.requestQueue = session.requestQueue.filter((queuedId) => queuedId !== id);
  session.transitionAt = Date.now();
  notify(session, session.state);
  return true;
}

export function setParticipantMuted(session, userId, muted, actorId) {
  const id = normalizedId(userId);
  const actor = normalizedId(actorId);
  const self = actor === id;
  const canModerate = actor && (actor === session.hostId || session.moderatorIds.includes(actor));
  if (!id || (!self && !canModerate)) return false;

  session.mutedIds = muted
    ? uniqueIds([...session.mutedIds, id])
    : session.mutedIds.filter((mutedId) => mutedId !== id);
  session.transitionAt = Date.now();
  notify(session, session.state);
  return true;
}

export function setParticipantBlocked(session, userId, blocked, actorId) {
  const id = normalizedId(userId);
  const actor = normalizedId(actorId);
  const canModerate = actor && (actor === session.hostId || session.moderatorIds.includes(actor));
  if (!id || !canModerate || id === session.hostId) return false;

  session.blockedIds = blocked
    ? uniqueIds([...session.blockedIds, id])
    : session.blockedIds.filter((blockedId) => blockedId !== id);

  if (blocked) {
    session.speakerIds = session.speakerIds.filter((speakerId) => speakerId !== id);
    session.requestQueue = session.requestQueue.filter((queuedId) => queuedId !== id);
  }
  session.transitionAt = Date.now();
  notify(session, session.state);
  return true;
}

export function voiceSessionSnapshot(session) {
  return publicSnapshot(session);
}

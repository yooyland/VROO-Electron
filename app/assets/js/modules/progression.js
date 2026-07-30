export const PROGRESSION_SCHEMA_VERSION = 1;

export const VEHICLE_TIERS = Object.freeze([
  Object.freeze({id: "basic", label: "BASIC", minPoints: 0}),
  Object.freeze({id: "street", label: "STREET", minPoints: 1000}),
  Object.freeze({id: "sport", label: "SPORT", minPoints: 3500}),
  Object.freeze({id: "performance", label: "PERFORMANCE", minPoints: 8000}),
  Object.freeze({id: "heritage", label: "HERITAGE", minPoints: 15000})
]);

export const PROGRESSION_EVENT_POINTS = Object.freeze({
  driveKm: 10,
  gridVisit: 40,
  helpfulMessage: 25,
  missionComplete: 100,
  safeDrive: 80,
  connection: 30
});

const COUNTER_KEYS = Object.freeze({
  driveKm: "driveKm",
  gridVisit: "gridVisits",
  helpfulMessage: "helpfulMessages",
  missionComplete: "missionsCompleted",
  safeDrive: "safeDrives",
  connection: "connections"
});

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function tierForPoints(points) {
  const score = nonNegativeNumber(points);
  return [...VEHICLE_TIERS].reverse().find(tier => score >= tier.minPoints) || VEHICLE_TIERS[0];
}

export function createVehicleProgression() {
  return {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    tier: "basic",
    points: 0,
    counters: {
      driveKm: 0,
      gridVisits: 0,
      helpfulMessages: 0,
      missionsCompleted: 0,
      safeDrives: 0,
      connections: 0
    },
    completedEventIds: [],
    updatedAt: null
  };
}

export function progressionFromLegacyState(state = {}) {
  const level = Math.max(1, Math.floor(Number(state.level) || 1));
  const legacyTier = level >= 51
    ? "heritage"
    : level >= 31
      ? "performance"
      : level >= 16
        ? "sport"
        : level >= 6
          ? "street"
          : "basic";
  const tier = VEHICLE_TIERS.find(item => item.id === legacyTier) || VEHICLE_TIERS[0];
  return {
    ...createVehicleProgression(),
    tier: tier.id,
    points: tier.minPoints,
    updatedAt: Date.now()
  };
}

export function normalizeVehicleProgression(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const base = createVehicleProgression();
  const points = Math.floor(nonNegativeNumber(source.points));
  const counters = source.counters && typeof source.counters === "object" && !Array.isArray(source.counters)
    ? source.counters
    : {};

  base.points = points;
  base.tier = tierForPoints(points).id;
  for (const key of Object.keys(base.counters)) {
    base.counters[key] = nonNegativeNumber(counters[key]);
  }
  base.completedEventIds = Array.isArray(source.completedEventIds)
    ? [...new Set(source.completedEventIds.filter(value => value != null).map(String).filter(Boolean))].slice(-100)
    : [];
  base.updatedAt = Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : null;
  return base;
}

export function getProgressionSummary(value) {
  const progression = normalizeVehicleProgression(value);
  const tierIndex = VEHICLE_TIERS.findIndex(tier => tier.id === progression.tier);
  const currentTier = VEHICLE_TIERS[Math.max(0, tierIndex)];
  const nextTier = VEHICLE_TIERS[tierIndex + 1] || null;
  const tierStart = currentTier.minPoints;
  const tierSpan = nextTier ? nextTier.minPoints - tierStart : 0;
  const progress = nextTier
    ? Math.max(0, Math.min(100, Math.round(((progression.points - tierStart) / tierSpan) * 100)))
    : 100;

  return {
    ...progression,
    currentTier,
    nextTier,
    pointsToNext: nextTier ? Math.max(0, nextTier.minPoints - progression.points) : 0,
    progress
  };
}

export function recordProgressionEvent(value, event = {}) {
  const progression = normalizeVehicleProgression(value);
  const kind = String(event.kind || "");
  const pointRate = PROGRESSION_EVENT_POINTS[kind];
  if (!pointRate) return {progression, applied: false, reason: "unknown-event"};

  const eventId = event.id == null ? "" : String(event.id);
  if (eventId && progression.completedEventIds.includes(eventId)) {
    return {progression, applied: false, reason: "duplicate-event"};
  }

  const amount = Math.max(0, nonNegativeNumber(event.amount == null ? 1 : event.amount));
  if (!amount) return {progression, applied: false, reason: "empty-event"};

  const earnedPoints = Math.max(1, Math.round(pointRate * amount));
  const counterKey = COUNTER_KEYS[kind];
  progression.points += earnedPoints;
  progression.counters[counterKey] = nonNegativeNumber(progression.counters[counterKey]) + amount;
  if (eventId) progression.completedEventIds.push(eventId);
  progression.completedEventIds = progression.completedEventIds.slice(-100);
  progression.updatedAt = Number.isFinite(Number(event.at)) ? Number(event.at) : Date.now();
  progression.tier = tierForPoints(progression.points).id;

  return {
    progression,
    applied: true,
    earnedPoints,
    tierChanged: progression.tier !== normalizeVehicleProgression(value).tier
  };
}

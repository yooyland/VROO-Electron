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

export function vehicleTierById(tierId) {
  return VEHICLE_TIERS.find(tier => tier.id === tierId) || VEHICLE_TIERS[0];
}

export function vehicleTierFromLegacyLevel(level) {
  const normalized = Math.max(1, Math.floor(Number(level) || 1));
  const tierId = normalized >= 51
    ? "heritage"
    : normalized >= 31
      ? "performance"
      : normalized >= 16
        ? "sport"
        : normalized >= 6
          ? "street"
          : "basic";
  return vehicleTierById(tierId);
}

export function vehicleTierIndex(tierId) {
  const index = VEHICLE_TIERS.findIndex(tier => tier.id === tierId);
  return index >= 0 ? index + 1 : 1;
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
    driveTracker: {
      lat: null,
      lng: null,
      at: null,
      pendingKm: 0
    },
    completedEventIds: [],
    updatedAt: null
  };
}

export function progressionFromLegacyState(state = {}) {
  const tier = vehicleTierFromLegacyLevel(state.level);
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
  const driveTracker = source.driveTracker && typeof source.driveTracker === "object" && !Array.isArray(source.driveTracker)
    ? source.driveTracker
    : {};
  const lat = driveTracker.lat == null ? NaN : Number(driveTracker.lat);
  const lng = driveTracker.lng == null ? NaN : Number(driveTracker.lng);
  const trackerAt = driveTracker.at == null ? NaN : Number(driveTracker.at);
  base.driveTracker.lat = Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null;
  base.driveTracker.lng = Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null;
  base.driveTracker.at = Number.isFinite(trackerAt) ? trackerAt : null;
  base.driveTracker.pendingKm = Math.min(0.099999, nonNegativeNumber(driveTracker.pendingKm));
  base.completedEventIds = Array.isArray(source.completedEventIds)
    ? [...new Set(source.completedEventIds.filter(value => value != null).map(String).filter(Boolean))].slice(-100)
    : [];
  base.updatedAt = Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : null;
  return base;
}

function distanceKm(from, to) {
  const radians = value => value * Math.PI / 180;
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = radians(to.lng - from.lng);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const bounded = Math.max(0, Math.min(1, value));
  return 6371 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

export function recordDriveLocation(value, sample = {}) {
  const progression = normalizeVehicleProgression(value);
  const lat = Number(sample.lat);
  const lng = Number(sample.lng);
  const at = Number(sample.at);
  const accuracy = Number(sample.accuracy);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return {progression, changed: false, applied: false, reason: "invalid-location"};
  }
  if (Number.isFinite(accuracy) && accuracy > 100) {
    return {progression, changed: false, applied: false, reason: "low-accuracy"};
  }

  const tracker = progression.driveTracker;
  const timestamp = Number.isFinite(at) ? at : Date.now();
  const setBaseline = reason => {
    tracker.lat = lat;
    tracker.lng = lng;
    tracker.at = timestamp;
    return {progression, changed: true, applied: false, reason};
  };
  if (tracker.lat == null || tracker.lng == null) return setBaseline("baseline");
  if (tracker.at != null && timestamp <= tracker.at) {
    return {progression, changed: false, applied: false, reason: "stale-location"};
  }

  const travelledKm = distanceKm(tracker, {lat, lng});
  if (travelledKm > 10) {
    tracker.pendingKm = 0;
    return setBaseline("location-jump");
  }
  if (travelledKm < 0.02) {
    tracker.at = timestamp;
    return {progression, changed: true, applied: false, reason: "gps-jitter", distanceKm: travelledKm};
  }

  tracker.lat = lat;
  tracker.lng = lng;
  tracker.at = timestamp;
  const totalKm = tracker.pendingKm + travelledKm;
  const awardedUnits = Math.floor((totalKm + 1e-9) * 10);
  const awardedKm = awardedUnits / 10;
  tracker.pendingKm = totalKm - awardedKm;
  if (!awardedUnits) {
    return {progression, changed: true, applied: false, reason: "distance-pending", distanceKm: travelledKm};
  }

  const result = recordProgressionEvent(progression, {
    kind: "driveKm",
    amount: awardedKm,
    at: timestamp
  });
  result.progression.driveTracker = tracker;
  return {
    ...result,
    changed: true,
    reason: "drive-distance",
    distanceKm: travelledKm,
    awardedKm
  };
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

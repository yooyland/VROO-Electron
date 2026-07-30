export const PROGRESSION_SCHEMA_VERSION = 2;
export const PROGRESSION_SYNC_CONTRACT_VERSION = 1;

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

export const DAILY_MISSIONS = Object.freeze([
  Object.freeze({id: "daily-drive", kind: "driveKm", label: "오늘의 드라이브", description: "검증된 거리 1 km 주행", target: 1, unit: "km", rewardPoints: 100}),
  Object.freeze({id: "daily-grid", kind: "gridVisit", label: "새로운 GRID", description: "오늘 GRID 1곳 방문", target: 1, unit: "곳", rewardPoints: 100}),
  Object.freeze({id: "daily-help", kind: "helpfulMessage", label: "도로 위 도움", description: "도움·상황 메시지 1회 전송", target: 1, unit: "회", rewardPoints: 100})
]);

export const VEHICLE_EVOLUTION_PHASES = Object.freeze([
  Object.freeze({id: "core", label: "CORE FORM", description: "기본 차체와 V 엠블럼", minProgress: 0}),
  Object.freeze({id: "signature", label: "V SIGNATURE", description: "V 라이트 성장 신호", minProgress: 34}),
  Object.freeze({id: "flow", label: "GOLDEN FLOW", description: "골드 라인과 에어로 글로우", minProgress: 67})
]);

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

function localDayKey(value = Date.now()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "unknown";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function createDailyActivity(day = localDayKey()) {
  return {
    day,
    driveKm: 0,
    gridVisits: 0,
    helpfulMessages: 0,
    completedMissionIds: []
  };
}

function previousLocalDayKey(value) {
  const date = new Date(value);
  date.setDate(date.getDate() - 1);
  return localDayKey(date);
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
    dailyActivity: createDailyActivity(),
    streak: {
      current: 0,
      best: 0,
      lastCompletedDay: null
    },
    milestones: [],
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
  const dailyActivity = source.dailyActivity && typeof source.dailyActivity === "object" && !Array.isArray(source.dailyActivity)
    ? source.dailyActivity
    : {};
  base.dailyActivity.day = String(dailyActivity.day || localDayKey());
  base.dailyActivity.driveKm = nonNegativeNumber(dailyActivity.driveKm);
  base.dailyActivity.gridVisits = nonNegativeNumber(dailyActivity.gridVisits);
  base.dailyActivity.helpfulMessages = nonNegativeNumber(dailyActivity.helpfulMessages);
  base.dailyActivity.completedMissionIds = Array.isArray(dailyActivity.completedMissionIds)
    ? [...new Set(dailyActivity.completedMissionIds.map(String).filter(id => DAILY_MISSIONS.some(mission => mission.id === id)))]
    : [];
  const streak = source.streak && typeof source.streak === "object" && !Array.isArray(source.streak)
    ? source.streak
    : {};
  base.streak.current = Math.floor(nonNegativeNumber(streak.current));
  base.streak.best = Math.max(base.streak.current, Math.floor(nonNegativeNumber(streak.best)));
  base.streak.lastCompletedDay = /^\d{4}-\d{2}-\d{2}$/.test(String(streak.lastCompletedDay || ""))
    ? String(streak.lastCompletedDay)
    : null;
  const milestoneIds = new Set();
  base.milestones = Array.isArray(source.milestones)
    ? source.milestones
      .filter(item => item && typeof item === "object" && !Array.isArray(item))
      .map(item => ({
        id: String(item.id || "").trim(),
        type: ["mission", "evolution", "tier", "streak"].includes(String(item.type)) ? String(item.type) : "mission",
        label: String(item.label || "").trim(),
        tier: vehicleTierById(item.tier).id,
        phase: VEHICLE_EVOLUTION_PHASES.some(phase => phase.id === item.phase) ? String(item.phase) : null,
        at: Number.isFinite(Number(item.at)) ? Number(item.at) : null
      }))
      .filter(item => item.id && item.label && !milestoneIds.has(item.id) && milestoneIds.add(item.id))
      .slice(-50)
    : [];
  base.completedEventIds = Array.isArray(source.completedEventIds)
    ? [...new Set(source.completedEventIds.filter(value => value != null).map(String).filter(Boolean))].slice(-100)
    : [];
  base.updatedAt = Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : null;
  return base;
}

export function getDailyMissionSummary(value, at = Date.now()) {
  const progression = normalizeVehicleProgression(value);
  const day = localDayKey(at);
  const activity = progression.dailyActivity.day === day ? progression.dailyActivity : createDailyActivity(day);
  const counterByKind = {
    driveKm: activity.driveKm,
    gridVisit: activity.gridVisits,
    helpfulMessage: activity.helpfulMessages
  };
  const missions = DAILY_MISSIONS.map(mission => {
    const current = Math.min(mission.target, nonNegativeNumber(counterByKind[mission.kind]));
    const completed = activity.completedMissionIds.includes(mission.id);
    return {
      ...mission,
      current,
      completed,
      progress: Math.max(0, Math.min(100, Math.round((current / mission.target) * 100)))
    };
  });
  return {
    day,
    missions,
    completedCount: missions.filter(mission => mission.completed).length,
    totalCount: missions.length,
    rewardPoints: missions.filter(mission => mission.completed).reduce((sum, mission) => sum + mission.rewardPoints, 0)
  };
}

export function getVehicleEvolutionSummary(value) {
  const progression = getProgressionSummary(value);
  const phaseIndex = [...VEHICLE_EVOLUTION_PHASES]
    .reverse()
    .findIndex(phase => progression.progress >= phase.minProgress);
  const currentIndex = phaseIndex < 0 ? 0 : VEHICLE_EVOLUTION_PHASES.length - 1 - phaseIndex;
  const currentPhase = VEHICLE_EVOLUTION_PHASES[currentIndex];
  const nextPhase = VEHICLE_EVOLUTION_PHASES[currentIndex + 1] || null;
  const currentTierStart = progression.currentTier.minPoints;
  const tierSpan = progression.nextTier ? progression.nextTier.minPoints - currentTierStart : 0;
  const nextPhasePoints = nextPhase && tierSpan
    ? currentTierStart + Math.ceil((nextPhase.minProgress / 100) * tierSpan)
    : null;
  return {
    currentPhase,
    nextPhase,
    phaseNumber: currentIndex + 1,
    phaseCount: VEHICLE_EVOLUTION_PHASES.length,
    pointsToNextPhase: nextPhasePoints == null ? 0 : Math.max(0, nextPhasePoints - progression.points),
    phases: VEHICLE_EVOLUTION_PHASES.map((phase, index) => ({
      ...phase,
      unlocked: index <= currentIndex,
      active: index === currentIndex
    }))
  };
}

export function getProgressionMilestones(value) {
  return [...normalizeVehicleProgression(value).milestones]
    .sort((left, right) => (right.at || 0) - (left.at || 0));
}

export function getProgressionStreak(value, at = Date.now()) {
  const progression = normalizeVehicleProgression(value);
  const today = localDayKey(at);
  const active = progression.streak.lastCompletedDay === today
    || progression.streak.lastCompletedDay === previousLocalDayKey(at);
  return {
    current: active ? progression.streak.current : 0,
    best: progression.streak.best,
    lastCompletedDay: progression.streak.lastCompletedDay
  };
}

export function getWeeklyProgressionSummary(value, at = Date.now()) {
  const progression = normalizeVehicleProgression(value);
  const end = new Date(at);
  if (!Number.isFinite(end.getTime())) return getWeeklyProgressionSummary(progression, Date.now());
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({length: 7}, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      day: localDayKey(date),
      label: new Intl.DateTimeFormat("ko-KR", {weekday: "short"}).format(date),
      completedMissions: 0,
      loopCompleted: false
    };
  });
  const dayByKey = new Map(days.map(day => [day.day, day]));
  for (const milestone of progression.milestones) {
    if (!milestone.at || milestone.at < start.getTime() || milestone.at > end.getTime()) continue;
    const day = dayByKey.get(localDayKey(milestone.at));
    if (!day) continue;
    if (milestone.type === "mission") day.completedMissions = Math.min(DAILY_MISSIONS.length, day.completedMissions + 1);
    if (milestone.type === "streak") day.loopCompleted = true;
  }
  const completedMissions = days.reduce((sum, day) => sum + day.completedMissions, 0);
  const completedDays = days.filter(day => day.loopCompleted).length;
  const activeDays = days.filter(day => day.completedMissions > 0).length;
  const missionGoal = DAILY_MISSIONS.length * days.length;
  return {
    startDay: days[0].day,
    endDay: days[days.length - 1].day,
    days,
    completedMissions,
    completedDays,
    activeDays,
    missionGoal,
    progress: Math.round((completedMissions / missionGoal) * 100)
  };
}

export function buildProgressionSyncPayload(value, at = Date.now()) {
  const progression = normalizeVehicleProgression(value);
  const capturedAt = Number.isFinite(Number(at)) ? Number(at) : Date.now();
  const summary = getProgressionSummary(progression);
  const evolution = getVehicleEvolutionSummary(progression);
  return {
    contractVersion: PROGRESSION_SYNC_CONTRACT_VERSION,
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    capturedAt,
    revision: progression.updatedAt,
    vehicle: {
      tier: summary.currentTier.id,
      points: progression.points,
      evolutionPhase: evolution.currentPhase.id
    },
    counters: {...progression.counters},
    dailyActivity: {
      day: progression.dailyActivity.day,
      driveKm: progression.dailyActivity.driveKm,
      gridVisits: progression.dailyActivity.gridVisits,
      helpfulMessages: progression.dailyActivity.helpfulMessages,
      completedMissionIds: [...progression.dailyActivity.completedMissionIds]
    },
    streak: {...progression.streak},
    milestones: progression.milestones.map(item => ({...item})),
    completedEventIds: [...progression.completedEventIds]
  };
}

export function applyProgressionSyncPayload(localValue, payload) {
  const local = normalizeVehicleProgression(localValue);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {progression: local, applied: false, reason: "invalid-payload"};
  }
  if (Number(payload.contractVersion) !== PROGRESSION_SYNC_CONTRACT_VERSION) {
    return {progression: local, applied: false, reason: "unsupported-contract"};
  }
  if (Number(payload.schemaVersion) > PROGRESSION_SCHEMA_VERSION) {
    return {progression: local, applied: false, reason: "unsupported-schema"};
  }
  const revision = Number(payload.revision);
  if (!Number.isFinite(revision) || revision <= 0) {
    return {progression: local, applied: false, reason: "invalid-revision"};
  }
  if (local.updatedAt != null && revision <= local.updatedAt) {
    return {progression: local, applied: false, reason: "stale-revision"};
  }
  const vehicle = payload.vehicle && typeof payload.vehicle === "object" && !Array.isArray(payload.vehicle)
    ? payload.vehicle
    : {};
  const points = Number(vehicle.points);
  if (!Number.isFinite(points) || points < 0) {
    return {progression: local, applied: false, reason: "invalid-vehicle"};
  }
  const progression = normalizeVehicleProgression({
    points,
    counters: payload.counters,
    dailyActivity: payload.dailyActivity,
    streak: payload.streak,
    milestones: payload.milestones,
    completedEventIds: payload.completedEventIds,
    driveTracker: local.driveTracker,
    updatedAt: revision
  });
  return {progression, applied: true, reason: "remote-newer"};
}

export function getNextProgressionAction(value, at = Date.now()) {
  const daily = getDailyMissionSummary(value, at);
  const mission = daily.missions.find(item => !item.completed);
  if (!mission) {
    const evolution = getVehicleEvolutionSummary(value);
    return {
      id: "keep-driving",
      route: "road",
      eyebrow: "TODAY COMPLETE",
      title: evolution.nextPhase ? `${evolution.nextPhase.label} 진화 준비` : "다음 차량 등급 준비",
      description: evolution.nextPhase
        ? `오늘 미션을 모두 완료했습니다. ${evolution.pointsToNextPhase.toLocaleString("ko-KR")}P를 더 모으면 다음 성장 신호가 열립니다.`
        : "오늘 미션을 모두 완료했습니다. 계속 주행하며 다음 차량 등급을 준비하세요.",
      cta: "도로로 이동",
      completedToday: true
    };
  }
  const actions = {
    "daily-drive": {
      route: "road",
      title: "오늘의 드라이브",
      description: `도로에서 검증된 거리 ${(mission.target - mission.current).toFixed(1)}km를 더 주행하세요.`,
      cta: "도로로 이동"
    },
    "daily-grid": {
      route: "grid",
      title: "새로운 GRID 방문",
      description: "내 주변 GRID를 열어 오늘의 공간 방문을 완료하세요.",
      cta: "GRID 열기"
    },
    "daily-help": {
      route: "road-chat",
      title: "도로 위 도움",
      description: "도로 대화에서 도움 또는 상황 메시지를 한 번 보내세요.",
      cta: "도로 대화 열기"
    }
  };
  return {
    id: mission.id,
    eyebrow: "NEXT ACTION",
    completedToday: false,
    ...actions[mission.id]
  };
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
  const previousTier = progression.tier;
  const previousEvolutionPhase = getVehicleEvolutionSummary(progression).currentPhase;
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
  const eventDay = localDayKey(progression.updatedAt);
  if (progression.dailyActivity.day !== eventDay) progression.dailyActivity = createDailyActivity(eventDay);
  const dailyCounterKey = {
    driveKm: "driveKm",
    gridVisit: "gridVisits",
    helpfulMessage: "helpfulMessages"
  }[kind];
  const completedMissions = [];
  if (dailyCounterKey) {
    progression.dailyActivity[dailyCounterKey] += amount;
    for (const mission of DAILY_MISSIONS.filter(item => item.kind === kind)) {
      if (
        progression.dailyActivity[dailyCounterKey] >= mission.target
        && !progression.dailyActivity.completedMissionIds.includes(mission.id)
      ) {
        progression.dailyActivity.completedMissionIds.push(mission.id);
        progression.points += mission.rewardPoints;
        progression.counters.missionsCompleted += 1;
        completedMissions.push(mission);
      }
    }
  }
  progression.tier = tierForPoints(progression.points).id;
  const currentEvolutionPhase = getVehicleEvolutionSummary(progression).currentPhase;
  const tierChanged = progression.tier !== previousTier;
  const addMilestone = milestone => {
    if (!milestone.id || progression.milestones.some(item => item.id === milestone.id)) return;
    progression.milestones.push(milestone);
    progression.milestones = progression.milestones.slice(-50);
  };
  for (const mission of completedMissions) {
    addMilestone({
      id: `${eventDay}:mission:${mission.id}`,
      type: "mission",
      label: `${mission.label} 완료`,
      tier: progression.tier,
      phase: currentEvolutionPhase.id,
      at: progression.updatedAt
    });
  }
  if (previousEvolutionPhase.id !== currentEvolutionPhase.id) {
    addMilestone({
      id: `evolution:${progression.tier}:${currentEvolutionPhase.id}`,
      type: "evolution",
      label: `${vehicleTierById(progression.tier).label} · ${currentEvolutionPhase.label}`,
      tier: progression.tier,
      phase: currentEvolutionPhase.id,
      at: progression.updatedAt
    });
  }
  if (tierChanged) {
    addMilestone({
      id: `tier:${progression.tier}`,
      type: "tier",
      label: `${vehicleTierById(progression.tier).label} 등급 달성`,
      tier: progression.tier,
      phase: currentEvolutionPhase.id,
      at: progression.updatedAt
    });
  }
  const dailyLoopCompleted = DAILY_MISSIONS.every(mission =>
    progression.dailyActivity.completedMissionIds.includes(mission.id)
  );
  let streakCompleted = false;
  if (dailyLoopCompleted && progression.streak.lastCompletedDay !== eventDay) {
    progression.streak.current = progression.streak.lastCompletedDay === previousLocalDayKey(progression.updatedAt)
      ? progression.streak.current + 1
      : 1;
    progression.streak.best = Math.max(progression.streak.best, progression.streak.current);
    progression.streak.lastCompletedDay = eventDay;
    streakCompleted = true;
    addMilestone({
      id: `streak:${eventDay}`,
      type: "streak",
      label: `오늘의 미션 3/3 완료 · ${progression.streak.current}일 연속`,
      tier: progression.tier,
      phase: currentEvolutionPhase.id,
      at: progression.updatedAt
    });
  }

  return {
    progression,
    applied: true,
    earnedPoints: earnedPoints + completedMissions.reduce((sum, mission) => sum + mission.rewardPoints, 0),
    completedMissions,
    evolutionChanged: previousEvolutionPhase.id !== currentEvolutionPhase.id,
    previousEvolutionPhase,
    currentEvolutionPhase,
    streakCompleted,
    streak: {...progression.streak},
    tierChanged
  };
}

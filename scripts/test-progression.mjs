import assert from "node:assert/strict";
import {
  createVehicleProgression,
  getDailyMissionSummary,
  getProgressionSummary,
  getVehicleEvolutionSummary,
  normalizeVehicleProgression,
  progressionFromLegacyState,
  recordDriveLocation,
  recordProgressionEvent,
  vehicleTierById,
  vehicleTierFromLegacyLevel,
  vehicleTierIndex
} from "../app/assets/js/modules/progression.js";
import {
  gridVisitProgressionEvent,
  applyDriveLocation,
  helpfulMessageProgressionEvent,
  missionProgressionEvent
} from "../app/assets/js/modules/progression-controller.js";

const fresh = createVehicleProgression();
assert.equal(fresh.tier, "basic");
assert.equal(fresh.points, 0);

const firstDrive = recordProgressionEvent(fresh, {
  id: "drive:first",
  kind: "driveKm",
  amount: 10,
  at: 1000
});
assert.equal(firstDrive.applied, true);
assert.equal(firstDrive.earnedPoints, 200);
assert.equal(firstDrive.progression.counters.driveKm, 10);
assert.equal(firstDrive.progression.counters.missionsCompleted, 1);
assert.equal(firstDrive.completedMissions[0].id, "daily-drive");

const duplicateDrive = recordProgressionEvent(firstDrive.progression, {
  id: "drive:first",
  kind: "driveKm",
  amount: 10
});
assert.equal(duplicateDrive.applied, false);
assert.equal(duplicateDrive.reason, "duplicate-event");
assert.equal(duplicateDrive.progression.points, 200);

let growing = firstDrive.progression;
for (let index = 0; index < 9; index += 1) {
  growing = recordProgressionEvent(growing, {
    id: `mission:${index}`,
    kind: "missionComplete"
  }).progression;
}
assert.equal(growing.points, 1100);
assert.equal(growing.tier, "street");

const summary = getProgressionSummary(growing);
assert.equal(summary.currentTier.id, "street");
assert.equal(summary.nextTier.id, "sport");
assert.equal(summary.pointsToNext, 2400);

const malformed = normalizeVehicleProgression({
  points: -10,
  tier: "heritage",
  counters: {driveKm: -3},
  completedEventIds: ["same", "same", "", null]
});
assert.equal(malformed.tier, "basic");
assert.equal(malformed.points, 0);
assert.equal(malformed.counters.driveKm, 0);
assert.deepEqual(malformed.completedEventIds, ["same"]);

assert.equal(progressionFromLegacyState({level: 1}).tier, "basic");
assert.equal(progressionFromLegacyState({level: 18}).tier, "sport");
assert.equal(progressionFromLegacyState({level: 52}).tier, "heritage");
assert.equal(vehicleTierFromLegacyLevel(6).id, "street");
assert.equal(vehicleTierFromLegacyLevel(31).id, "performance");
assert.equal(vehicleTierById("not-a-tier").id, "basic");
assert.equal(vehicleTierIndex("heritage"), 5);
assert.equal(getVehicleEvolutionSummary(createVehicleProgression()).currentPhase.id, "core");
assert.equal(getVehicleEvolutionSummary({points: 340}).currentPhase.id, "signature");
assert.equal(getVehicleEvolutionSummary({points: 670}).currentPhase.id, "flow");
assert.equal(getVehicleEvolutionSummary({points: 670}).pointsToNextPhase, 0);

const today = new Date("2026-07-30T12:00:00+09:00").getTime();
let dailyProgression = createVehicleProgression();
dailyProgression = recordProgressionEvent(dailyProgression, {
  id: "grid:daily",
  kind: "gridVisit",
  at: today
}).progression;
dailyProgression = recordProgressionEvent(dailyProgression, {
  id: "help:daily",
  kind: "helpfulMessage",
  at: today
}).progression;
const dailySummary = getDailyMissionSummary(dailyProgression, today);
assert.equal(dailySummary.completedCount, 2);
assert.equal(dailySummary.rewardPoints, 200);
assert.equal(dailyProgression.counters.missionsCompleted, 2);
assert.equal(getDailyMissionSummary(dailyProgression, new Date("2026-07-31T12:00:00+09:00").getTime()).completedCount, 0);

const driveBaseline = recordDriveLocation(fresh, {
  lat: 37.5665,
  lng: 126.978,
  accuracy: 12,
  at: 1000
});
assert.equal(driveBaseline.reason, "baseline");
assert.equal(driveBaseline.progression.points, 0);

const driveJitter = recordDriveLocation(driveBaseline.progression, {
  lat: 37.56651,
  lng: 126.978,
  accuracy: 10,
  at: 2000
});
assert.equal(driveJitter.reason, "gps-jitter");
assert.equal(driveJitter.progression.points, 0);

const driven = recordDriveLocation(driveJitter.progression, {
  lat: 37.5675,
  lng: 126.978,
  accuracy: 10,
  at: 3000
});
assert.equal(driven.applied, true);
assert.equal(driven.awardedKm, 0.1);
assert.equal(driven.earnedPoints, 1);
assert.equal(driven.progression.counters.driveKm, 0.1);

const jumped = recordDriveLocation(driven.progression, {
  lat: 35.1796,
  lng: 129.0756,
  accuracy: 10,
  at: 4000
});
assert.equal(jumped.reason, "location-jump");
assert.equal(jumped.progression.points, 1);
assert.equal(recordDriveLocation(jumped.progression, {
  lat: 35.18,
  lng: 129.0756,
  accuracy: 150,
  at: 5000
}).reason, "low-accuracy");

const driveState = {vehicleProgression: createVehicleProgression()};
let driveSaves = 0;
applyDriveLocation(driveState, {
  lat: 37.5665,
  lng: 126.978,
  accuracy: 10,
  at: 1000
}, {save: () => { driveSaves += 1; }});
assert.equal(driveSaves, 1);

const visitEvent = gridVisitProgressionEvent(
  {gridId: "KR:L3:169:340", action: "location"},
  new Date("2026-07-30T12:00:00+09:00").getTime()
);
assert.equal(visitEvent.id, "grid-visit:KR:L3:169:340:2026-07-30");
assert.equal(gridVisitProgressionEvent({gridId: "g_my", action: "leave"}), null);

const helpfulEvent = helpfulMessageProgressionEvent({
  messageId: "road-help-1",
  senderId: "me",
  roomType: "road",
  purpose: "help",
  category: "help",
  createdAt: 2000
});
assert.equal(helpfulEvent.id, "helpful-message:road-help-1");
assert.equal(helpfulMessageProgressionEvent({
  messageId: "road-chat-1",
  senderId: "me",
  roomType: "road",
  purpose: "chat",
  category: "chat"
}), null);
assert.equal(missionProgressionEvent({missionId: ""}), null);
assert.equal(missionProgressionEvent({missionId: "daily-drive"}).id, "mission:daily-drive");

const values = new Map();
globalThis.localStorage = {
  getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
  removeItem(key) {
    values.delete(key);
  },
  clear() {
    values.clear();
  }
};

const {
  STORAGE_KEY,
  STORAGE_SCHEMA_VERSION,
  loadState
} = await import("../app/assets/js/core/storage.js");

const newUser = loadState();
assert.equal(newUser.profile.car, "basic");
assert.equal(newUser.vehicleProgression.tier, "basic");
assert.equal(newUser._schemaVersion, STORAGE_SCHEMA_VERSION);

localStorage.setItem(STORAGE_KEY, JSON.stringify({
  level: 18,
  profile: {
    nickname: "기존 사용자",
    plate: "12가 3456",
    car: "sport",
    status: "기존 상태"
  }
}));
const migratedUser = loadState();
assert.equal(migratedUser.profile.car, "sport");
assert.equal(migratedUser.vehicleProgression.tier, "sport");
assert.equal(migratedUser.vehicleProgression.points, 3500);

console.log("VROO_PROGRESSION_TEST_PASS");

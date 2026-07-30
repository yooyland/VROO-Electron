import assert from "node:assert/strict";
import {
  createVehicleProgression,
  getProgressionSummary,
  normalizeVehicleProgression,
  progressionFromLegacyState,
  recordProgressionEvent
} from "../app/assets/js/modules/progression.js";
import {
  gridVisitProgressionEvent,
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
assert.equal(firstDrive.earnedPoints, 100);
assert.equal(firstDrive.progression.counters.driveKm, 10);

const duplicateDrive = recordProgressionEvent(firstDrive.progression, {
  id: "drive:first",
  kind: "driveKm",
  amount: 10
});
assert.equal(duplicateDrive.applied, false);
assert.equal(duplicateDrive.reason, "duplicate-event");
assert.equal(duplicateDrive.progression.points, 100);

let growing = firstDrive.progression;
for (let index = 0; index < 9; index += 1) {
  growing = recordProgressionEvent(growing, {
    id: `mission:${index}`,
    kind: "missionComplete"
  }).progression;
}
assert.equal(growing.points, 1000);
assert.equal(growing.tier, "street");

const summary = getProgressionSummary(growing);
assert.equal(summary.currentTier.id, "street");
assert.equal(summary.nextTier.id, "sport");
assert.equal(summary.pointsToNext, 2500);

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

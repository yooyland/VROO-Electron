import {on} from "../core/events.js";
import {MY_USER_ID} from "./data.js";
import {getProgressionSummary, recordDriveLocation, recordProgressionEvent} from "./progression.js";

function dayKey(value = Date.now()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "unknown";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function gridVisitProgressionEvent(detail, at = Date.now()) {
  const gridId = String(detail?.gridId || "").trim();
  if (!gridId) return null;
  const validAction = ["join", "create", "setCurrent", "location"].includes(String(detail?.action || "location"));
  if (!validAction) return null;
  return {
    id: `grid-visit:${gridId}:${dayKey(at)}`,
    kind: "gridVisit",
    amount: 1,
    at
  };
}

export function helpfulMessageProgressionEvent(detail) {
  const senderId = String(detail?.senderId || "");
  const messageId = String(detail?.messageId || "").trim();
  const purpose = String(detail?.purpose || "");
  const category = String(detail?.category || "");
  const helpful = purpose === "help" || purpose === "situation" || (category && !["chat", "courtesy"].includes(category));
  if (senderId !== MY_USER_ID || !messageId || detail?.roomType !== "road" || !helpful) return null;
  return {
    id: `helpful-message:${messageId}`,
    kind: "helpfulMessage",
    amount: 1,
    at: detail?.createdAt
  };
}

export function missionProgressionEvent(detail) {
  const missionId = String(detail?.missionId || "").trim();
  if (!missionId) return null;
  return {
    id: `mission:${missionId}`,
    kind: "missionComplete",
    amount: 1,
    at: detail?.completedAt
  };
}

export function applyDriveLocation(state, detail, options = {}) {
  const before = getProgressionSummary(state.vehicleProgression);
  const result = recordDriveLocation(state.vehicleProgression, detail);
  if (!result.changed) return result;
  state.vehicleProgression = result.progression;
  if (typeof options.save === "function") options.save();
  const after = getProgressionSummary(result.progression);
  if (before.currentTier.id !== after.currentTier.id && typeof options.notify === "function") {
    options.notify(`차량 등급이 ${after.currentTier.label}(으)로 성장했습니다.`);
  }
  return result;
}

export function bindProgressionController(state, options = {}) {
  const save = typeof options.save === "function" ? options.save : () => {};
  const notify = typeof options.notify === "function" ? options.notify : () => {};

  const apply = event => {
    if (!event) return false;
    const before = getProgressionSummary(state.vehicleProgression);
    const result = recordProgressionEvent(state.vehicleProgression, event);
    if (!result.applied) return false;
    state.vehicleProgression = result.progression;
    save();
    const after = getProgressionSummary(result.progression);
    if (before.currentTier.id !== after.currentTier.id) {
      notify(`차량 등급이 ${after.currentTier.label}(으)로 성장했습니다.`);
    }
    return true;
  };

  const unbind = [
    on("grid:locationChanged", detail => apply(gridVisitProgressionEvent({...detail, action: "location"}))),
    on("grid:changed", detail => apply(gridVisitProgressionEvent(detail))),
    on("chat:messagePreview", detail => apply(helpfulMessageProgressionEvent(detail))),
    on("progression:missionComplete", detail => apply(missionProgressionEvent(detail)))
  ];

  return () => unbind.forEach(dispose => dispose());
}

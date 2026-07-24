export function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

export function safeJsonParse(raw, fallback = null) {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

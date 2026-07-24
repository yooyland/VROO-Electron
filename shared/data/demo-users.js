/** Console demo users — User App localStorage와 분리 (보안 경계) */
export const DEMO_USERS = [
  { id: "u1", nickname: "별빛드라이버", plate: "12가 3456", car: "sport", level: 12, status: "active", online: true, credits: 4200, joinedAt: "2026-01-12" },
  { id: "u2", nickname: "도로위여우", plate: "33나 8811", car: "sedan", level: 8, status: "active", online: true, credits: 1100, joinedAt: "2026-02-03" },
  { id: "u3", nickname: "서울라이더", plate: "77다 2200", car: "suv", level: 21, status: "suspended", online: false, credits: 50, joinedAt: "2025-11-20" },
  { id: "u4", nickname: "안전제일", plate: "19라 1004", car: "van", level: 5, status: "active", online: false, credits: 800, joinedAt: "2026-03-15" },
  { id: "u5", nickname: "밤길친구", plate: "45마 5566", car: "taxi", level: 15, status: "pending", online: true, credits: 2300, joinedAt: "2026-04-01" },
  { id: "u6", nickname: "구름택시", plate: "88바 9090", car: "classic", level: 3, status: "inactive", online: false, credits: 0, joinedAt: "2026-05-10" }
];

export const DEMO_VEHICLES = DEMO_USERS.map((u) => ({
  id: `v_${u.id}`,
  userId: u.id,
  nickname: u.nickname,
  plate: u.plate,
  car: u.car,
  level: u.level,
  status: u.status === "suspended" ? "suspended" : "active",
  online: u.online
}));

export const DEMO_GRIDS = [
  { id: "g_my", name: "MY GRID", members: 42, type: "community", status: "active", official: false },
  { id: "g_gangnam", name: "강남 드라이브", members: 318, type: "community", status: "active", official: false },
  { id: "g_safe", name: "안전운전", members: 205, type: "community", status: "active", official: true },
  { id: "g_event", name: "VROO 공식 이벤트", members: 522, type: "official", status: "active", official: true },
  { id: "KR:L3:demo", name: "Spatial L3 데모", members: 18, type: "spatial", status: "active", official: false }
];

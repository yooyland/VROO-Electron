/** Accident / emergency demos — 민감정보·외부 전송 없음 */
export const DEMO_INCIDENTS = [
  { id: "ac1", userId: "u2", status: "reported", location: "37.50,127.04", photoCount: 2, emergency: false, towing: false, createdAt: "2026-07-22T18:10:00", notes: "데모 접수" },
  { id: "ac2", userId: "u1", status: "assistanceRequested", location: "37.51,127.03", photoCount: 3, emergency: true, towing: true, createdAt: "2026-07-20T21:05:00", notes: "긴급출동 요청(데모)" },
  { id: "ac3", userId: "u5", status: "closed", location: "37.49,127.05", photoCount: 1, emergency: false, towing: false, createdAt: "2026-07-01T12:00:00", notes: "처리 완료 데모" }
];

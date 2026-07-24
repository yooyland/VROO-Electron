export const DEMO_SUPPORT_TICKETS = [
  { id: "t1", userId: "u1", subject: "채팅 알림이 오지 않아요", category: "app", status: "open", priority: "normal", createdAt: "2026-07-22T09:00:00" },
  { id: "t2", userId: "u3", subject: "계정 정지 사유 문의", category: "account", status: "pending", priority: "high", createdAt: "2026-07-21T14:20:00" },
  { id: "t3", userId: "u2", subject: "쿠폰 사용 오류", category: "commerce", status: "resolved", priority: "normal", createdAt: "2026-07-18T11:10:00" },
  { id: "t4", userId: "u4", subject: "GRID 참여가 안 됩니다", category: "grid", status: "open", priority: "normal", createdAt: "2026-07-23T08:40:00" }
];

export const DEMO_REPORTS = [
  { id: "r1", type: "chat", targetId: "u5", reporterId: "u2", reason: "스팸 메시지", status: "pending", createdAt: "2026-07-22" },
  { id: "r2", type: "post", targetId: "p12", reporterId: "u1", reason: "부적절한 게시글", status: "pending", createdAt: "2026-07-21" },
  { id: "r3", type: "user", targetId: "u3", reporterId: "u4", reason: "욕설", status: "resolved", createdAt: "2026-07-10" }
];

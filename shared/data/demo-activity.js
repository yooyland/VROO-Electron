/**
 * Ops activity + action queue + audit seed
 * Activity rows are derived from DEMO_AUDIT_LOGS (single source).
 */

const ACTION_LABELS = {
  "user.unsuspend": { area: "회원", action: "이용 제한 해제" },
  "benefit.approve": { area: "제휴사", action: "혜택 승인" },
  "support.reply": { area: "고객지원", action: "문의 답변" },
  "incident.acknowledge": { area: "사고", action: "긴급 접수 확인" },
  "product.review": { area: "상품", action: "상품 상태 검토" },
  "grid.notice": { area: "GRID", action: "공식 GRID 공지" },
  "settlement.review": { area: "정산", action: "정산 검토" },
  "partner.approve": { area: "제휴사", action: "제휴사 승인" }
};

const RESULT_LABELS = {
  success: "완료",
  approved: "승인",
  pending: "보류",
  failed: "실패",
  cancelled: "취소",
  in_progress: "보류"
};

/**
 * Audit log model seed
 * id, timestamp, actorId, actorName, actorRole, organizationId,
 * action, resourceType, resourceId, result, reason, source
 */
export const DEMO_AUDIT_LOGS = [
  {
    id: "aud-001",
    timestamp: "2026-07-24T14:32:00+09:00",
    actorId: "ops-op-001",
    actorName: "운영 담당",
    actorRole: "operator",
    organizationId: "org-vroo",
    action: "user.unsuspend",
    resourceType: "user",
    resourceId: "USR-10284",
    result: "success",
    reason: "이의 제기 검토 완료",
    source: "console"
  },
  {
    id: "aud-002",
    timestamp: "2026-07-24T14:18:00+09:00",
    actorId: "ops-sa-001",
    actorName: "운영 총괄",
    actorRole: "super_admin",
    organizationId: "org-vroo",
    action: "benefit.approve",
    resourceType: "benefit",
    resourceId: "PRT-004",
    result: "approved",
    reason: "계약 조건 확인",
    source: "console"
  },
  {
    id: "aud-003",
    timestamp: "2026-07-24T13:55:00+09:00",
    actorId: "cs-001",
    actorName: "고객지원 상담",
    actorRole: "cs_agent",
    organizationId: "org-vroo",
    action: "support.reply",
    resourceType: "ticket",
    resourceId: "TK-2218",
    result: "success",
    reason: null,
    source: "console"
  },
  {
    id: "aud-004",
    timestamp: "2026-07-24T13:20:00+09:00",
    actorId: "cs-001",
    actorName: "고객지원 상담",
    actorRole: "cs_agent",
    organizationId: "org-vroo",
    action: "incident.acknowledge",
    resourceType: "incident",
    resourceId: "AC-0192",
    result: "in_progress",
    reason: "현장 확인 요청",
    source: "console"
  },
  {
    id: "aud-005",
    timestamp: "2026-07-24T12:40:00+09:00",
    actorId: "ops-op-001",
    actorName: "운영 담당",
    actorRole: "operator",
    organizationId: "org-vroo",
    action: "product.review",
    resourceType: "product",
    resourceId: "PRD-088",
    result: "pending",
    reason: "카테고리 검수 대기",
    source: "console"
  },
  {
    id: "aud-006",
    timestamp: "2026-07-24T11:15:00+09:00",
    actorId: "ops-op-001",
    actorName: "운영 담당",
    actorRole: "operator",
    organizationId: "org-vroo",
    action: "grid.notice",
    resourceType: "grid",
    resourceId: "g_safe",
    result: "success",
    reason: null,
    source: "console"
  },
  {
    id: "aud-007",
    timestamp: "2026-07-24T10:05:00+09:00",
    actorId: "ops-sa-001",
    actorName: "운영 총괄",
    actorRole: "super_admin",
    organizationId: "org-vroo",
    action: "settlement.review",
    resourceType: "settlement",
    resourceId: "STL-031",
    result: "pending",
    reason: "금액 재확인 필요",
    source: "console"
  }
];

/** Map audit logs → dashboard activity rows (no duplicate seed) */
export function activityFromAudit(logs = DEMO_AUDIT_LOGS) {
  return logs.map((log) => {
    const meta = ACTION_LABELS[log.action] || {
      area: log.resourceType || "시스템",
      action: log.action
    };
    const d = new Date(log.timestamp);
    const time = Number.isNaN(d.getTime())
      ? "—"
      : d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    return {
      id: log.id,
      time,
      area: meta.area,
      action: meta.action,
      target: log.resourceId,
      actor: log.actorName,
      result: RESULT_LABELS[log.result] || log.result,
      resultKey: log.result,
      reason: log.reason,
      auditId: log.id
    };
  });
}

/** @deprecated use activityFromAudit — kept as derived export */
export const DEMO_ACTIVITY = activityFromAudit(DEMO_AUDIT_LOGS);

/**
 * Action queue — priority: urgent | high | medium | normal
 * slaMinutes: processing target; waitMinutes: oldest wait
 */
export const ACTION_QUEUE = [
  {
    id: "q1",
    type: "긴급 사고",
    count: 2,
    wait: "최장 대기 12분",
    waitMinutes: 12,
    priority: "urgent",
    team: "고객지원",
    sla: "목표 10분 이내",
    slaMinutes: 10,
    route: "incidents"
  },
  {
    id: "q2",
    type: "미처리 신고",
    count: 2,
    wait: "최장 대기 1일",
    waitMinutes: 1440,
    priority: "high",
    team: "운영",
    sla: "목표 24시간 이내",
    slaMinutes: 1440,
    route: "moderation"
  },
  {
    id: "q3",
    type: "미답변 문의",
    count: 3,
    wait: "최장 대기 4시간",
    waitMinutes: 240,
    priority: "high",
    team: "고객지원",
    sla: "목표 2시간 이내",
    slaMinutes: 120,
    route: "support"
  },
  {
    id: "q4",
    type: "승인 대기 제휴사",
    count: 1,
    wait: "최장 대기 2일",
    waitMinutes: 2880,
    priority: "medium",
    team: "파트너",
    sla: "목표 3일 이내",
    slaMinutes: 4320,
    route: "partners"
  },
  {
    id: "q5",
    type: "승인 대기 상품",
    count: 1,
    wait: "최장 대기 18시간",
    waitMinutes: 1080,
    priority: "medium",
    team: "커머스",
    sla: "목표 48시간 이내",
    slaMinutes: 2880,
    route: "products"
  },
  {
    id: "q6",
    type: "정산 검토",
    count: 2,
    wait: "최장 대기 3일",
    waitMinutes: 4320,
    priority: "medium",
    team: "커머스",
    sla: "목표 5일 이내",
    slaMinutes: 7200,
    route: "settlements"
  },
  {
    id: "q7",
    type: "시스템 경고",
    count: 1,
    wait: "데이터 소스 확인",
    waitMinutes: 0,
    priority: "normal",
    team: "엔지니어링",
    sla: "연동 전",
    slaMinutes: null,
    route: "system"
  }
];

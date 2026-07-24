import { DEMO_ANALYTICS } from "../../../shared/data/demo-analytics.js";
import { DEMO_USERS } from "../../../shared/data/demo-users.js";
import { DEMO_PARTNERS } from "../../../shared/data/demo-partners.js";
import { DEMO_SUPPORT_TICKETS, DEMO_REPORTS } from "../../../shared/data/demo-support.js";
import { DEMO_INCIDENTS } from "../../../shared/data/demo-incidents.js";
import {
  ACTION_QUEUE,
  DEMO_AUDIT_LOGS,
  activityFromAudit
} from "../../../shared/data/demo-activity.js";
import { listLocalAudit } from "./account-store.js";
import { DEMO_SETTLEMENTS } from "../../../shared/data/demo-products.js";
import {
  pageHeader,
  escapeHtml,
  formatNumber,
  formatDateTimeKo,
  resultBadge,
  SERVICE_STATUS,
  openModal,
  closeModal
} from "./console-ui.js";
import { scopePartners } from "./console-data.js";
import { iconSvg } from "./console-icons.js";

function spark(values = []) {
  const max = Math.max(...values, 1);
  return `<div class="spark" aria-hidden="true">${values.map((v, i) => {
    const h = Math.max(8, Math.round((v / max) * 36));
    return `<i class="${i === values.length - 1 ? "on" : ""}" style="height:${h}px"></i>`;
  }).join("")}</div>`;
}

function dataContextBar(aggregatedAt) {
  const at = formatDateTimeKo(aggregatedAt || Date.now());
  return `
    <div class="data-context" role="status" aria-label="데이터 기준">
      <div class="dc-item"><span class="dc-k">마지막 집계</span><span class="dc-v tabular" id="dashAggAt">${escapeHtml(at)}</span></div>
      <div class="dc-item"><span class="dc-k">데이터 소스</span><span class="dc-v">Local</span></div>
      <div class="dc-item"><span class="dc-k">자동 갱신</span><span class="dc-v">꺼짐</span></div>
      <button type="button" class="btn ghost" id="dashRefresh">${iconSvg("refresh", 14)} 새로고침</button>
    </div>`;
}

function metricCard({ label, value, delta, hint, accent, route }) {
  const deltaClass = delta?.startsWith("-") ? "down" : "up";
  const clickable = route
    ? `role="link" tabindex="0" data-goto="${escapeHtml(route)}" aria-label="${escapeHtml(label)} 상세"`
    : "";
  return `
    <article class="metric-card ${accent ? "accent" : ""} ${route ? "is-link" : ""}" ${clickable}>
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value tabular">${escapeHtml(String(value))}</div>
      ${delta ? `<div class="metric-delta ${deltaClass}">${escapeHtml(delta)}</div>` : ""}
      ${hint ? `<div class="metric-hint">${escapeHtml(hint)}</div>` : ""}
      ${route ? `<div class="metric-link">상세 보기</div>` : ""}
    </article>`;
}

function auxCard(label, value, hint) {
  return `
    <article class="aux-card">
      <div class="aux-label">${escapeHtml(label)}</div>
      <div class="aux-value tabular">${escapeHtml(String(value))}</div>
      ${hint ? `<div class="aux-hint">${escapeHtml(hint)}</div>` : ""}
    </article>`;
}

const PRIO_LABEL = {
  urgent: "긴급",
  high: "높음",
  medium: "보통",
  normal: "일반"
};

function actionQueueHtml(items) {
  const sorted = [...items].sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2, normal: 3 };
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  });
  return `
    <div class="section-card elevated">
      <h3>처리 필요 업무</h3>
      <div class="action-queue">
        ${sorted.map((q) => {
          const breached = q.slaMinutes != null && q.waitMinutes > q.slaMinutes;
          const prio = q.priority || "normal";
          const icon = prio === "urgent" || prio === "high" ? "alert" : "clock";
          return `
          <div class="action-item prio-${escapeHtml(prio)} ${breached ? "is-breached" : ""}">
            <div class="ai-indicator" aria-hidden="true"></div>
            <div class="ai-body">
              <div class="ai-top">
                <span class="ai-icon">${iconSvg(icon, 16)}</span>
                <span class="ai-type">${escapeHtml(q.type)}</span>
                <span class="prio prio-${escapeHtml(prio)}">${escapeHtml(PRIO_LABEL[prio] || prio)}</span>
                ${breached ? `<span class="breach-tag">처리 지연</span>` : ""}
              </div>
              <div class="ai-stats">
                <span class="tabular"><b>${q.count}</b>건</span>
                <span>${escapeHtml(q.wait)}</span>
                <span>${escapeHtml(q.team)}</span>
                <span>${escapeHtml(q.sla || "")}</span>
              </div>
            </div>
            <button type="button" class="btn ghost" data-goto="${escapeHtml(q.route)}" aria-label="${escapeHtml(q.type)} 확인">확인</button>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

function activityTable() {
  const seedRows = activityFromAudit(DEMO_AUDIT_LOGS);
  const localRows = listLocalAudit(20)
    .filter((a) => a.action === "session.role_switched")
    .map((a) => {
      const d = new Date(a.timestamp);
      const time = Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
      return {
        id: a.id,
        time,
        area: "세션",
        action: "역할 전환",
        target: `${a.previousRole || "—"} → ${a.nextRole || "—"}`,
        actor: a.actorDisplayName || "—",
        result: "완료",
        resultKey: "success",
        reason: a.reason,
        auditId: a.id
      };
    });
  const rows = [...localRows, ...seedRows].slice(0, 12);
  return `
    <div class="section-card elevated">
      <h3>최근 운영 활동</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>시간</th><th>영역</th><th>작업</th><th>대상</th><th>처리자</th><th>결과</th><th></th></tr></thead>
          <tbody>
            ${rows.map((a) => `
              <tr>
                <td class="tabular">${escapeHtml(a.time)}</td>
                <td>${escapeHtml(a.area)}</td>
                <td>${escapeHtml(a.action)}</td>
                <td><code title="${escapeHtml(a.target)}">${escapeHtml(a.target)}</code></td>
                <td>${escapeHtml(a.actor)}</td>
                <td>${resultBadge(a.result, a.resultKey)}</td>
                <td>${a.reason
                  ? `<button type="button" class="btn ghost btn-sm" data-audit="${escapeHtml(a.auditId)}" aria-label="사유 보기">사유</button>`
                  : `<span class="muted">—</span>`}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="muted table-footnote">감사 로그 seed 기준 · 서버 저장 연동 전</p>
    </div>`;
}

function serviceStatusPanel() {
  const rows = [
    { name: "User App", status: "unknown", detail: "별도 프로세스 상태를 확인할 수 없습니다." },
    { name: "Console", status: "operational", detail: "로컬 렌더러에서 실행 중입니다." },
    { name: "인증", status: "pending_integration", detail: "서버 인증이 아직 연결되지 않았습니다." },
    { name: "데이터 API", status: "pending_integration", detail: "서버 API가 아직 연결되지 않았습니다." },
    { name: "지도", status: "unknown", detail: "콘솔에서 지도 상태를 조회하지 않습니다." },
    { name: "위치 서비스", status: "unknown", detail: "상태 확인 연동 전입니다." },
    { name: "알림", status: "pending_integration", detail: "푸시·알림 채널이 연동되지 않았습니다." }
  ];
  return `
    <div class="section-card">
      <h3>서비스 상태</h3>
      <ul class="svc-list">
        ${rows.map((r) => {
          const meta = SERVICE_STATUS[r.status] || SERVICE_STATUS.unknown;
          return `
          <li class="svc-row ${meta.className}">
            <span class="svc-icon" aria-hidden="true">${iconSvg(meta.icon, 16)}</span>
            <div class="svc-text">
              <div class="svc-name">${escapeHtml(r.name)}</div>
              <div class="svc-detail">${escapeHtml(r.detail)}</div>
            </div>
            <span class="svc-label">${escapeHtml(meta.label)}</span>
          </li>`;
        }).join("")}
      </ul>
    </div>`;
}

function supportPanel(pendingTickets, openIncidents, urgentIncidents, slaOver = 1) {
  const summary = pendingTickets > 0
    ? `미답변 문의 ${pendingTickets}건 중 ${slaOver}건이 목표 응답시간을 초과했습니다.`
    : "현재 미답변 문의가 없습니다.";
  return `
    <div class="section-card">
      <h3>고객지원 현황</h3>
      <p class="panel-summary">${escapeHtml(summary)}</p>
      <ul class="status-list">
        <li><span>신규 문의</span><span class="tabular">${pendingTickets}</span></li>
        <li><span>미답변 문의</span><span class="tabular">${pendingTickets}</span></li>
        <li><span>평균 첫 응답</span><span>확인 불가</span></li>
        <li><span>SLA 초과</span><span class="tabular warn-num">${slaOver}</span></li>
        <li><span>사고 접수</span><span class="tabular">${openIncidents}</span></li>
        <li><span>긴급 사고</span><span class="tabular danger-num">${urgentIncidents}</span></li>
      </ul>
    </div>`;
}

function partnerPanel(partners, settlePending) {
  const active = partners.filter((p) => p.status === "active").length;
  const pending = partners.filter((p) => p.status === "pending");
  const productPending = partners.reduce((n, p) => n + (p.productApprovalsPending || 0), 0);
  const endingSoon = partners
    .filter((p) => p.contractEndDate)
    .sort((a, b) => String(a.contractEndDate).localeCompare(String(b.contractEndDate)))[0];
  const longestPending = pending.sort((a, b) => (b.pendingSinceDays || 0) - (a.pendingSinceDays || 0))[0];
  const noteParts = [];
  if (longestPending) {
    noteParts.push(`승인 대기 「${longestPending.name}」 최장 ${longestPending.pendingSinceDays || "—"}일`);
  }
  if (endingSoon) {
    noteParts.push(`가장 가까운 계약 종료 ${endingSoon.contractEndDate} (${endingSoon.name})`);
  }
  return `
    <div class="section-card">
      <h3>제휴사 현황</h3>
      ${noteParts.length ? `<p class="panel-summary">${escapeHtml(noteParts.join(" · "))}</p>` : ""}
      <ul class="status-list">
        <li><span>활성 제휴사</span><span class="tabular">${active}</span></li>
        <li><span>승인 대기</span><span class="tabular">${pending.length}</span></li>
        <li><span>계약 종료 예정</span><span class="tabular">${endingSoon ? endingSoon.contractEndDate : "—"}</span></li>
        <li><span>정산 검토</span><span class="tabular">${settlePending}</span></li>
        <li><span>신규 상품 승인 대기</span><span class="tabular">${productPending}</span></li>
      </ul>
    </div>`;
}

function bindGoto(root, ctx) {
  const go = (route) => ctx.goto?.(route);
  root.querySelectorAll("[data-goto]").forEach((el) => {
    const run = () => go(el.dataset.goto);
    if (el.tagName === "BUTTON") {
      el.onclick = run;
    } else {
      el.onclick = run;
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          run();
        }
      };
    }
  });
  root.querySelector("#dashRefresh")?.addEventListener("click", () => {
    renderDashboard(root, ctx);
  });
  root.querySelectorAll("[data-audit]").forEach((btn) => {
    btn.onclick = () => {
      const log = DEMO_AUDIT_LOGS.find((a) => a.id === btn.dataset.audit);
      if (!log) return;
      openModal({
        title: "작업 사유",
        bodyHtml: `
          <p><b>${escapeHtml(log.action)}</b> · <code>${escapeHtml(log.resourceId)}</code></p>
          <p>${escapeHtml(log.reason || "등록된 사유가 없습니다.")}</p>
          <p class="muted">감사 ID ${escapeHtml(log.id)} · 로컬 seed</p>`,
        actions: [{ label: "닫기", onClick: closeModal }]
      });
    };
  });
}

function renderSuperAdmin(root, ctx) {
  const a = DEMO_ANALYTICS;
  const pendingReports = DEMO_REPORTS.filter((r) => r.status === "pending").length;
  const pendingTickets = DEMO_SUPPORT_TICKETS.filter((t) => t.status !== "resolved").length;
  const openIncidents = DEMO_INCIDENTS.filter((i) => i.status !== "closed").length;
  const urgentIncidents = DEMO_INCIDENTS.filter((i) => i.emergency).length;
  const partners = DEMO_PARTNERS;
  const settlePending = DEMO_SETTLEMENTS.filter((s) => s.status === "pending").length;
  const slaOver = Math.min(1, pendingTickets);

  root.innerHTML = `
    ${pageHeader({
      title: "Dashboard",
      subtitle: "VROO 서비스의 운영 현황과 주요 업무를 확인합니다."
    })}
    ${dataContextBar(Date.now())}
    <div class="metric-grid">
      ${metricCard({ label: "활성 사용자", value: formatNumber(a.todayActiveUsers), delta: "전일 대비 +8.4%", hint: "최근 15분 기준 · 로컬 데이터", accent: true, route: "users" })}
      ${metricCard({ label: "온라인 차량", value: formatNumber(a.onlineVehicles), delta: "전일 대비 +3.1%", hint: "최근 집계 · 로컬 데이터", route: "vehicles" })}
      ${metricCard({ label: "활성 GRID", value: formatNumber(a.activeGrids), delta: "전일 대비 +2.2%", hint: "최근 집계", route: "grids" })}
      ${metricCard({ label: "오늘 거래액", value: `₩${formatNumber(a.demoRevenue)}`, delta: "전일 대비 +5.0%", hint: "금일 누적 · 로컬 데이터", route: "settlements" })}
    </div>
    <div class="aux-grid">
      ${auxCard("신규 가입", a.newSignups, "금일 누적")}
      ${auxCard("대기 신고", pendingReports, "처리 대기")}
      ${auxCard("대기 문의", pendingTickets, "처리 대기")}
      ${auxCard("사고 접수", openIncidents, "미종결")}
      ${auxCard("쿠폰 사용", a.couponUsesToday, "금일 누적")}
      ${auxCard("활성 제휴사", partners.filter((p) => p.status === "active").length, "최근 집계")}
      ${auxCard("정산 검토", settlePending, "처리 대기")}
      ${auxCard("시스템 알림", 1, "연동 전")}
    </div>
    <div class="dash-grid dash-balance">
      <div class="col-8 stack-gap">${actionQueueHtml(ACTION_QUEUE)}</div>
      <div class="col-4 stack-gap">
        ${serviceStatusPanel()}
        <div class="section-card">
          <h3>이용 추이 <span class="sub">7일 · 로컬</span></h3>
          ${spark(a.charts.users7d)}
          <p class="muted spark-caption">사용자 ${formatNumber(a.charts.users7d[0])} → ${formatNumber(a.charts.users7d.at(-1))}</p>
        </div>
      </div>
      <div class="col-8 stack-gap">${activityTable()}</div>
      <div class="col-4 stack-gap">
        ${supportPanel(pendingTickets, openIncidents, urgentIncidents, slaOver)}
        ${partnerPanel(partners, settlePending)}
      </div>
    </div>`;
  bindGoto(root, ctx);
}

function renderOperator(root, ctx) {
  root.innerHTML = `
    ${pageHeader({ title: "Dashboard", subtitle: "오늘 운영 업무와 회원·GRID 현황입니다." })}
    ${dataContextBar(Date.now())}
    <div class="metric-grid">
      ${metricCard({ label: "회원", value: DEMO_USERS.length, hint: "관리 대상 · 로컬", route: "users" })}
      ${metricCard({ label: "대기 신고", value: DEMO_REPORTS.filter((r) => r.status === "pending").length, hint: "처리 필요", route: "moderation" })}
      ${metricCard({ label: "대기 문의", value: DEMO_SUPPORT_TICKETS.filter((t) => t.status !== "resolved").length, route: "support" })}
      ${metricCard({ label: "온라인 차량", value: DEMO_ANALYTICS.onlineVehicles, hint: "최근 집계", route: "vehicles" })}
    </div>
    <div class="dash-grid">
      <div class="col-8">${actionQueueHtml(ACTION_QUEUE.filter((q) => ["moderation", "support", "incidents", "settlements", "products"].includes(q.route)))}</div>
      <div class="col-4">${activityTable()}</div>
    </div>`;
  bindGoto(root, ctx);
}

function renderPartner(root, ctx) {
  const partners = scopePartners(DEMO_PARTNERS, ctx.session);
  const p = partners[0];
  root.innerHTML = `
    ${pageHeader({
      title: "Dashboard",
      subtitle: `${ctx.session.organizationName || "제휴사"} 운영 현황`
    })}
    ${dataContextBar(Date.now())}
    <div class="metric-grid">
      ${metricCard({ label: "제휴사", value: p?.name || "—", hint: ctx.session.partnerId || "" })}
      ${metricCard({ label: "지점 수", value: p?.branches ?? "—", hint: "최근 집계" })}
      ${metricCard({ label: "계약", value: p?.contractStatus || "—" })}
      ${metricCard({ label: "정산", value: p?.settlementStatus || "—", route: "settlements" })}
    </div>
    <div class="dash-grid">
      <div class="col-6">
        <div class="section-card elevated">
          <h3>오늘 할 일</h3>
          <ul class="status-list">
            <li><span>상품·혜택 점검</span><button type="button" class="btn ghost" data-goto="products">이동</button></li>
            <li><span>쿠폰·혜택</span><button type="button" class="btn ghost" data-goto="benefits">이동</button></li>
            <li><span>정산 현황</span><button type="button" class="btn ghost" data-goto="settlements">이동</button></li>
          </ul>
        </div>
      </div>
      <div class="col-6">
        <div class="section-card">
          <h3>안내</h3>
          <p class="muted">표시되는 데이터는 소속 제휴사 범위로 제한됩니다. 데이터 소스: Local</p>
        </div>
      </div>
    </div>`;
  bindGoto(root, ctx);
}

function renderCs(root, ctx) {
  const open = DEMO_SUPPORT_TICKETS.filter((t) => t.status !== "resolved");
  const incidents = DEMO_INCIDENTS.filter((i) => i.status !== "closed");
  const urgent = DEMO_INCIDENTS.filter((i) => i.emergency).length;
  root.innerHTML = `
    ${pageHeader({ title: "Dashboard", subtitle: "상담·사고 대기열을 확인합니다." })}
    ${dataContextBar(Date.now())}
    <div class="metric-grid">
      ${metricCard({ label: "미답변 문의", value: open.length, hint: "처리 대기", route: "support" })}
      ${metricCard({ label: "사고 접수", value: incidents.length, route: "incidents" })}
      ${metricCard({ label: "긴급", value: urgent, hint: "우선 처리" })}
      ${metricCard({ label: "대기 신고", value: DEMO_REPORTS.filter((r) => r.status === "pending").length, route: "moderation" })}
    </div>
    <div class="dash-grid">
      <div class="col-8">${actionQueueHtml(ACTION_QUEUE.filter((q) => ["support", "incidents", "moderation"].includes(q.route)))}</div>
      <div class="col-4">${supportPanel(open.length, incidents.length, urgent, Math.min(1, open.length))}</div>
    </div>`;
  bindGoto(root, ctx);
}

function renderAnalyst(root, ctx) {
  const a = DEMO_ANALYTICS;
  root.innerHTML = `
    ${pageHeader({ title: "Dashboard", subtitle: "주요 지표 요약 · 읽기 전용" })}
    ${dataContextBar(Date.now())}
    <div class="metric-grid">
      ${metricCard({ label: "활성 사용자", value: formatNumber(a.todayActiveUsers), hint: "최근 집계 · 로컬", route: "analytics" })}
      ${metricCard({ label: "온라인 차량", value: formatNumber(a.onlineVehicles), hint: "최근 집계" })}
      ${metricCard({ label: "GRID", value: formatNumber(a.activeGrids), hint: "최근 집계" })}
      ${metricCard({ label: "쿠폰 사용", value: formatNumber(a.couponUsesToday), hint: "금일 누적" })}
    </div>
    <div class="dash-grid">
      <div class="col-12">
        <div class="section-card elevated">
          <h3>7일 사용자 추이</h3>
          ${spark(a.charts.users7d)}
          <p class="muted spark-caption">기간 비교·내보내기는 통계 메뉴에서 확인하세요.</p>
          <button type="button" class="btn ghost" data-goto="analytics">통계로 이동</button>
        </div>
      </div>
    </div>`;
  bindGoto(root, ctx);
}

function renderDeveloper(root, ctx) {
  root.innerHTML = `
    ${pageHeader({ title: "Dashboard", subtitle: "플랫폼 상태와 연동 정보를 확인합니다." })}
    ${dataContextBar(Date.now())}
    <div class="metric-grid">
      ${metricCard({ label: "세션 역할", value: ctx.session.activeRole || ctx.session.roleId, hint: "activeRole" })}
      ${metricCard({ label: "계정", value: ctx.session.displayName, hint: ctx.session.accountId })}
      ${metricCard({ label: "데이터 소스", value: "Local seed", hint: "서버 미연결" })}
      ${metricCard({ label: "인증", value: "연동 전", hint: "서버 인증 없음" })}
    </div>
    <div class="dash-grid">
      <div class="col-6">${serviceStatusPanel()}</div>
      <div class="col-6">
        <div class="section-card elevated">
          <h3>바로가기</h3>
          <ul class="status-list">
            <li><span>시스템 상태</span><button type="button" class="btn ghost" data-goto="system">열기</button></li>
            <li><span>권한 정보</span><button type="button" class="btn ghost" data-goto="permissions">열기</button></li>
          </ul>
        </div>
      </div>
    </div>`;
  bindGoto(root, ctx);
}

export function renderDashboard(root, ctx) {
  const role = ctx.session?.roleId;
  if (role === "operator") return renderOperator(root, ctx);
  if (role === "partner_admin" || role === "partner_staff") return renderPartner(root, ctx);
  if (role === "cs_agent") return renderCs(root, ctx);
  if (role === "analyst") return renderAnalyst(root, ctx);
  if (role === "developer") return renderDeveloper(root, ctx);
  return renderSuperAdmin(root, ctx);
}

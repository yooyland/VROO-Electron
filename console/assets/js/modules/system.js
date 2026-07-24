import { APP_VERSION, PLATFORM_MODE } from "../../../../shared/config/platform-modules.js";
import { FEATURE_STATUS_SUMMARY } from "../../../../shared/config/feature-status-summary.js";
import { DEMO_AUDIT_LOGS } from "../../../../shared/data/demo-activity.js";
import { APP_ENVIRONMENT } from "../../../../shared/data/demo-accounts.js";
import { pageHeader, statusBadge, escapeHtml, formatDate } from "../console-ui.js";

export function renderSystem(root, ctx) {
  const electron = window.vrooDesktop?.versions?.electron || "확인 불가";
  const chrome = window.vrooDesktop?.versions?.chrome || "확인 불가";
  const platform = window.vrooDesktop?.platform || "확인 불가";

  const featureRows = FEATURE_STATUS_SUMMARY.map((v) =>
    `<tr><td><code>${escapeHtml(v.id)}</code></td><td>${escapeHtml(v.label)}</td><td>${statusBadge(v.status)}</td></tr>`
  ).join("");

  root.innerHTML = `
    ${pageHeader({
      title: "시스템 상태",
      subtitle: "연동·데이터 소스·런타임 정보를 확인합니다."
    })}
    <div class="dash-grid">
      <div class="col-6">
        <div class="section-card">
          <h3>런타임</h3>
          <ul class="status-list">
            <li><span>App version</span><span>${escapeHtml(APP_VERSION)}</span></li>
            <li><span>Electron</span><span>${escapeHtml(String(electron))}</span></li>
            <li><span>Chrome</span><span>${escapeHtml(String(chrome))}</span></li>
            <li><span>OS</span><span>${escapeHtml(String(platform))}</span></li>
            <li><span>환경</span><span>${escapeHtml(APP_ENVIRONMENT)}</span></li>
            <li><span>모드</span><span>${escapeHtml(PLATFORM_MODE)}</span></li>
          </ul>
        </div>
      </div>
      <div class="col-6">
        <div class="section-card">
          <h3>데이터 소스</h3>
          <ul class="status-list">
            <li><span>현재 소스</span><span>Local seed data</span></li>
            <li><span>서버 연결</span><span>미연결</span></li>
            <li><span>인증</span><span>연동 전</span></li>
            <li><span>세션 저장</span><span>localStorage (콘솔 키)</span></li>
            <li><span>User App 저장소</span><span>미변경</span></li>
          </ul>
          <p class="muted" style="margin-top:10px">감사 로그·정산·알림은 서버 연동 후 영속화됩니다.</p>
        </div>
      </div>
      <div class="col-12">
        <div class="section-card">
          <h3>기능 상태</h3>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>이름</th><th>상태</th></tr></thead>
          <tbody>${featureRows}</tbody></table></div>
        </div>
      </div>
      <div class="col-12">
        <div class="section-card">
          <h3>감사 로그 (seed)</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>시간</th><th>행위자</th><th>작업</th><th>대상</th><th>결과</th><th>사유</th></tr></thead>
              <tbody>
                ${DEMO_AUDIT_LOGS.map((a) => `
                  <tr>
                    <td>${escapeHtml(formatDate(a.timestamp))}</td>
                    <td>${escapeHtml(a.actorName)} <span class="muted">(${escapeHtml(a.actorRole)})</span></td>
                    <td><code>${escapeHtml(a.action)}</code></td>
                    <td>${escapeHtml(a.resourceType)}/${escapeHtml(a.resourceId)}</td>
                    <td>${escapeHtml(a.result)}</td>
                    <td>${escapeHtml(a.reason || "—")}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}

export function renderPermissionsTool(root, ctx) {
  root.innerHTML = `
    ${pageHeader({ title: "권한 관리", subtitle: "현재 계정의 역할과 권한 목록입니다." })}
    <div class="section-card">
      <p><b>${escapeHtml(ctx.session.displayName)}</b> · ${escapeHtml(ctx.session.label)}</p>
      <p class="muted">${escapeHtml(ctx.session.organizationName)} · ${escapeHtml(ctx.session.department || "")}</p>
      <p class="muted">userId: <code>${escapeHtml(ctx.session.userId)}</code>
        ${ctx.session.partnerId ? ` · partnerId: <code>${escapeHtml(ctx.session.partnerId)}</code>` : ""}</p>
      <h3 style="margin-top:16px">permissions</h3>
      <ul class="simple-list">${ctx.session.permissions.map((p) =>
        `<li><code>${escapeHtml(p)}</code></li>`).join("")}</ul>
    </div>`;
}

export function renderNotifications(root) {
  root.innerHTML = `
    ${pageHeader({ title: "공지·알림", subtitle: "운영 공지와 푸시 발송을 관리합니다." })}
    <div class="section-card">
      <ul class="status-list">
        <li><span>시스템 점검 안내</span><span class="status-pill">대기</span></li>
        <li><span>시즌 이벤트 예고</span><span class="status-pill">준비 중</span></li>
      </ul>
      <p class="muted" style="margin-top:12px">실푸시 발송은 연동 전입니다. 발송 버튼은 제공하지 않습니다.</p>
    </div>`;
}

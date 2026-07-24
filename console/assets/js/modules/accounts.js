import { getRole } from "../../../../shared/config/roles.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import {
  pageHeader,
  escapeHtml,
  formatDateTimeKo,
  confirmDialog,
  toast,
  statusBadge
} from "../console-ui.js";
import {
  listAccounts,
  getAccount,
  assignRoleLocal,
  revokeRoleLocal,
  deactivateAccountLocal,
  canDeactivateAccount,
  hasRootManage,
  listLocalAudit,
  isWritableEnvironment,
  accountTypeLabel,
  countRootAuthorityAccounts
} from "../account-store.js";

function rolesLabel(account) {
  return (account.assignedRoles || [])
    .map((id) => getRole(id)?.label || id)
    .join(", ");
}

function renderDetail(root, ctx, accountId) {
  const account = getAccount(accountId);
  if (!account) {
    root.innerHTML = `${pageHeader({ title: "계정 상세" })}<div class="empty-state">계정을 찾을 수 없습니다.</div>`;
    return;
  }
  const canManage = hasRootManage(ctx.session);
  const writable = isWritableEnvironment();
  const audits = listLocalAudit(30).filter(
    (a) => a.targetAccountId === account.id || a.actorAccountId === account.id
  );
  const effectiveHint = (account.assignedRoles || [])
    .map((rid) => {
      const r = getRole(rid);
      return `<li><b>${escapeHtml(r?.label || rid)}</b> — ${escapeHtml(r?.description || "")}</li>`;
    })
    .join("");

  root.innerHTML = `
    ${pageHeader({
      title: account.displayName,
      subtitle: "계정 상세 · 보유 역할과 권한",
      actionsHtml: `<button type="button" class="btn ghost" id="backAccounts">목록</button>`
    })}
    <p class="panel-summary">최소 1개의 최종 권한 관리자 계정은 유지되어야 합니다. (현재 ${countRootAuthorityAccounts()}개)</p>
    <div class="dash-grid">
      <div class="col-6">
        <div class="section-card elevated">
          <h3>기본 정보</h3>
          <dl class="info-dl">
            <dt>대화명</dt><dd>${escapeHtml(account.displayName)}</dd>
            <dt>이름</dt><dd>${escapeHtml(account.legalName || "—")}</dd>
            <dt>이메일</dt><dd>${escapeHtml(account.email)}</dd>
            <dt>계정 유형</dt><dd>${escapeHtml(accountTypeLabel(account.accountType))}</dd>
            <dt>조직</dt><dd>${escapeHtml(account.organizationName)}</dd>
            <dt>부서</dt><dd>${escapeHtml(account.department || "—")}</dd>
            <dt>계정 상태</dt><dd>${escapeHtml(account.status === "active" ? "활성" : "비활성")}</dd>
            <dt>최근 로그인</dt><dd>${account.lastLoginAt ? escapeHtml(formatDateTimeKo(account.lastLoginAt)) : "—"}</dd>
          </dl>
        </div>
      </div>
      <div class="col-6">
        <div class="section-card">
          <h3>보유 역할</h3>
          <ul class="simple-list">${effectiveHint || "<li>없음</li>"}</ul>
          <p class="muted" style="margin-top:10px">기본 역할: ${escapeHtml(getRole(account.defaultRole)?.label || account.defaultRole)}</p>
        </div>
        <div class="section-card" style="margin-top:14px">
          <h3>직접 부여 권한</h3>
          ${(account.directPermissions || []).length
            ? `<ul class="simple-list">${account.directPermissions.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join("")}</ul>`
            : `<p class="muted">없음</p>`}
          <h3 style="margin-top:16px">최종 계산 권한</h3>
          <p class="muted">활성 역할 기준 권한 + 직접 부여 + (해당 시) 최종 권한 관리자 권한으로 계산됩니다. 역할 전환 시 재계산됩니다.</p>
        </div>
      </div>
      ${canManage ? `
      <div class="col-12">
        <div class="section-card elevated">
          <h3>권한 부여 · 회수</h3>
          ${!writable ? `<p class="muted">현재 환경에서는 읽기 전용입니다. 서버 연결 후 저장됩니다.</p>` : `
          <p class="muted">development 로컬 상태만 변경됩니다. 서버에 기록되지 않습니다.</p>
          <div class="filter-bar" style="margin-top:10px">
            <label class="filter-label">역할
              <select id="rolePick">
                ${["super_admin", "operator", "analyst", "developer", "cs_agent", "partner_admin", "partner_staff"]
                  .filter((id) => !(account.assignedRoles || []).includes(id) || true)
                  .map((id) => `<option value="${id}">${escapeHtml(getRole(id)?.label || id)}</option>`).join("")}
              </select>
            </label>
            <label class="filter-label">사유
              <input type="text" id="roleReason" placeholder="변경 사유">
            </label>
            <button type="button" class="btn primary" id="btnAssign">역할 부여</button>
            <button type="button" class="btn ghost" id="btnRevoke">역할 회수</button>
            <button type="button" class="btn ghost" id="btnDeactivate">계정 비활성화</button>
          </div>`}
        </div>
      </div>` : ""}
      <div class="col-12">
        <div class="section-card">
          <h3>권한 변경 이력</h3>
          ${audits.length ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>시간</th><th>작업</th><th>행위자</th><th>결과</th><th>사유</th></tr></thead>
              <tbody>
                ${audits.map((a) => `
                  <tr>
                    <td class="tabular">${escapeHtml(formatDateTimeKo(a.timestamp))}</td>
                    <td><code>${escapeHtml(a.action)}</code></td>
                    <td>${escapeHtml(a.actorDisplayName || "—")}</td>
                    <td>${escapeHtml(a.result || "—")}</td>
                    <td>${escapeHtml(a.reason || "—")}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>` : `<p class="muted">로컬 이력이 없습니다.</p>`}
        </div>
      </div>
    </div>`;

  root.querySelector("#backAccounts").onclick = () => renderAccounts(root, ctx);

  if (canManage && writable) {
    root.querySelector("#btnAssign").onclick = () => {
      const roleId = root.querySelector("#rolePick").value;
      const reason = root.querySelector("#roleReason").value;
      const res = assignRoleLocal(ctx.session, account.id, roleId, reason);
      toast(res.message || (res.ok ? "완료" : "실패"), res.ok ? "info" : "error");
      if (res.ok) renderDetail(root, ctx, account.id);
    };
    root.querySelector("#btnRevoke").onclick = () => {
      const roleId = root.querySelector("#rolePick").value;
      const reason = root.querySelector("#roleReason").value;
      confirmDialog({
        title: "역할 회수",
        message: `${getRole(roleId)?.label || roleId} 역할을 회수할까요?`,
        onConfirm: () => {
          const res = revokeRoleLocal(ctx.session, account.id, roleId, reason);
          toast(res.message || (res.ok ? "완료" : "실패"), res.ok ? "info" : "error");
          if (res.ok) renderDetail(root, ctx, account.id);
        }
      });
    };
    root.querySelector("#btnDeactivate").onclick = () => {
      const reason = root.querySelector("#roleReason").value;
      const gate = canDeactivateAccount(ctx.session, account.id);
      if (!gate.ok) {
        toast(gate.message, "error");
        return;
      }
      confirmDialog({
        title: "계정 비활성화",
        message: "이 계정을 비활성화할까요?",
        onConfirm: () => {
          const res = deactivateAccountLocal(ctx.session, account.id, reason);
          toast(res.message || (res.ok ? "완료" : "실패"), res.ok ? "info" : "error");
          if (res.ok) renderAccounts(root, ctx);
        }
      });
    };
  }
}

export function renderAccounts(root, ctx) {
  if (!hasPermission(ctx.session, "accounts.view")) {
    root.innerHTML = `${pageHeader({ title: "계정·역할 관리" })}
      <div class="empty-state"><b>권한이 없습니다.</b><p class="muted">최종 권한 관리자 계정만 접근할 수 있습니다.</p></div>`;
    return;
  }

  const accounts = listAccounts();
  root.innerHTML = `
    ${pageHeader({
      title: "계정·역할 관리",
      subtitle: "운영 계정과 보유 역할을 확인합니다."
    })}
    <p class="panel-summary">최소 1개의 최종 권한 관리자 계정은 유지되어야 합니다. · ${isWritableEnvironment() ? "development 로컬 변경 가능" : "읽기 전용"}</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>대화명</th><th>이름</th><th>이메일</th><th>조직</th>
            <th>보유 역할</th><th>활성 상태</th><th>최근 로그인</th><th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${accounts.map((a) => `
            <tr>
              <td><b>${escapeHtml(a.displayName)}</b>
                ${a.accountType === "root_authority" ? `<span class="status-badge status-ok">최종 권한 관리자</span>` : ""}
              </td>
              <td>${escapeHtml(a.legalName || "—")}</td>
              <td title="${escapeHtml(a.email)}">${escapeHtml(a.email)}</td>
              <td>${escapeHtml(a.organizationName)}</td>
              <td>${escapeHtml(rolesLabel(a))}</td>
              <td>${a.status === "active" ? statusBadge("active") : statusBadge("inactive")}</td>
              <td class="tabular">${a.lastLoginAt ? escapeHtml(formatDateTimeKo(a.lastLoginAt)) : "—"}</td>
              <td><button type="button" class="btn ghost btn-sm" data-acc-detail="${escapeHtml(a.id)}">상세</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  root.querySelectorAll("[data-acc-detail]").forEach((btn) => {
    btn.onclick = () => renderDetail(root, ctx, btn.dataset.accDetail);
  });
}

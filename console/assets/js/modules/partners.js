import { DEMO_PARTNERS, DEMO_BRANCHES } from "../../../../shared/data/demo-partners.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { scopePartners, scopeByPartner } from "../console-data.js";
import { pageHeader, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_PARTNERS.map((p) => ({ ...p }));

export function renderPartners(root, ctx) {
  const canManage = hasPermission(ctx.session, "partners.manage");
  const partners = scopePartners(store, ctx.session);
  const branches = scopeByPartner(DEMO_BRANCHES, ctx.session);

  const paint = () => {
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "partnerId" },
        { key: "name", label: "이름" },
        { key: "category", label: "카테고리" },
        { key: "branches", label: "지점수" },
        { key: "contractStatus", label: "계약", render: (r) => statusBadge(r.contractStatus) },
        { key: "settlementStatus", label: "정산", render: (r) => statusBadge(r.settlementStatus) },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows: partners,
      emptyMessage: "표시할 제휴사가 없습니다."
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const p = store.find((x) => x.id === btn.dataset.id);
        if (!p) return;
        openModal({
          title: p.name,
          bodyHtml: `
            <p>ID: <code>${escapeHtml(p.id)}</code></p>
            <p>카테고리: ${escapeHtml(p.category)}</p>
            <p class="muted">소속 제휴사 범위의 데이터만 표시됩니다.</p>
            ${canManage ? `<label>상태<select id="ptStatus"><option>active</option><option>pending</option><option>inactive</option></select></label>` : ""}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canManage ? [{
              label: "저장", className: "primary",
              onClick: () => {
                p.status = document.querySelector("#ptStatus")?.value || p.status;
                closeModal(); toast("제휴사 상태가 변경되었습니다. (로컬)"); paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({
      title: "제휴사 관리",
      subtitle: ctx.session.partnerId ? `자기 제휴사만 표시 · ${ctx.session.partnerId}` : "전체 제휴사" })}
    <div id="tableHost"></div>
    <div class="card"><h3>지점</h3>
      <ul class="simple-list">${branches.map((b) =>
        `<li>${escapeHtml(b.name)} · ${escapeHtml(b.region)} · ${statusBadge(b.status)}</li>`
      ).join("") || "<li class=\"muted\">지점 없음</li>"}</ul>
    </div>`;
  paint();
}

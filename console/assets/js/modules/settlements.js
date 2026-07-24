import { DEMO_SETTLEMENTS } from "../../../../shared/data/demo-products.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { scopeByPartner } from "../console-data.js";
import { pageHeader, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml, formatNumber } from "../console-ui.js";

let store = DEMO_SETTLEMENTS.map((s) => ({ ...s }));

export function renderSettlements(root, ctx) {
  const canManage = hasPermission(ctx.session, "settlements.manage");
  /* partner_staff: view only — manage 없음 */
  const rows = scopeByPartner(store, ctx.session).map((s) => s);
  const list = ctx.session.partnerId ? rows : store.slice();

  const paint = () => {
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "정산ID" },
        { key: "partnerId", label: "partnerId" },
        { key: "period", label: "기간" },
        { key: "amount", label: "금액", render: (r) => `₩${formatNumber(r.amount)}` },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows: list
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const s = store.find((x) => x.id === btn.dataset.id);
        if (!s) return;
        openModal({
          title: `정산 ${s.period}`,
          bodyHtml: `<p>${escapeHtml(s.note)}</p><p>₩${formatNumber(s.amount)}</p>
            <p class="muted">실정산·실이체가 아닙니다.</p>
            ${canManage ? `<label>상태<select id="stStatus"><option>pending</option><option>approved</option><option>rejected</option></select></label>` : "<p class=\"muted\">변경 권한 없음</p>"}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canManage ? [{
              label: "저장", className: "primary",
              onClick: () => {
                s.status = document.querySelector("#stStatus")?.value || s.status;
                closeModal(); toast("정산 상태가 변경되었습니다. (로컬)"); paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({ title: "정산 관리", subtitle: "정산 검토 현황입니다." })}
    <div id="tableHost"></div>`;
  paint();
}

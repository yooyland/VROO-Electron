import { DEMO_PRODUCTS } from "../../../../shared/data/demo-products.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { scopeByPartner } from "../console-data.js";
import { pageHeader, filterBar, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_PRODUCTS.map((p) => ({ ...p }));

export function renderProducts(root, ctx) {
  const canManage = hasPermission(ctx.session, "products.manage");
  const paint = () => {
    const q = (root.querySelector("#q")?.value || "").trim().toLowerCase();
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = ctx.session.partnerId
      ? scopeByPartner(store, ctx.session)
      : store.slice();
    if (st !== "all") rows = rows.filter((p) => p.status === st);
    if (q) rows = rows.filter((p) => `${p.title} ${p.id} ${p.category}`.toLowerCase().includes(q));
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "상품ID" },
        { key: "title", label: "상품명" },
        { key: "category", label: "카테고리" },
        { key: "partnerId", label: "partnerId", render: (r) => escapeHtml(r.partnerId || "—") },
        { key: "price", label: "가격" },
        { key: "stock", label: "재고" },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const p = store.find((x) => x.id === btn.dataset.id);
        if (!p) return;
        if (ctx.session.partnerId && p.partnerId !== ctx.session.partnerId) {
          toast("다른 제휴사 상품입니다.", "error");
          return;
        }
        openModal({
          title: p.title,
          bodyHtml: `<p>${escapeHtml(p.category)} · ${statusBadge(p.status)}</p>
            ${canManage ? `<label>상태<select id="prdStatus"><option>active</option><option>pending</option><option>inactive</option></select></label>` : "<p class=\"muted\">읽기 전용</p>"}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canManage ? [{
              label: "저장", className: "primary",
              onClick: () => {
                p.status = document.querySelector("#prdStatus")?.value || p.status;
                closeModal(); toast("상품 상태가 변경되었습니다. (로컬)"); paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({
      title: "상품 관리",
      subtitle: ctx.session.partnerId ? `제휴사 격리: ${ctx.session.partnerId}` : "전체 상품" })}
    ${filterBar({
      placeholder: "상품명·ID·카테고리",
      filters: [{
        id: "statusFilter", label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "active", label: "active" },
          { value: "pending", label: "pending" },
          { value: "inactive", label: "inactive" }
        ]
      }]
    })}
    <div id="tableHost"></div>`;
  root.querySelector("#q")?.addEventListener("input", paint);
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  paint();
}

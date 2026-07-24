import { DEMO_BENEFITS, DEMO_COUPON_USES } from "../../../../shared/data/demo-benefits.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { scopeByPartner } from "../console-data.js";
import { pageHeader, filterBar, dataTable, statusBadge, plannedNotice, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_BENEFITS.map((b) => ({ ...b }));

export function renderBenefits(root, ctx) {
  const canManage = hasPermission(ctx.session, "benefits.manage");
  const paint = () => {
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = ctx.session.partnerId ? scopeByPartner(store, ctx.session) : store.slice();
    if (st !== "all") rows = rows.filter((b) => b.status === st);
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "혜택ID" },
        { key: "title", label: "제목" },
        { key: "category", label: "카테고리" },
        { key: "partnerId", label: "partnerId", render: (r) => escapeHtml(r.partnerId || "—") },
        { key: "stock", label: "재고", render: (r) => escapeHtml(r.stock ?? "—") },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const b = store.find((x) => x.id === btn.dataset.id);
        if (!b) return;
        if (b.status === "planned") {
          openModal({
            title: b.title,
            bodyHtml: plannedNotice("혜택 발급"),
            actions: [{ label: "닫기", onClick: closeModal }]
          });
          return;
        }
        openModal({
          title: b.title,
          bodyHtml: `${statusBadge(b.status)}
            ${canManage ? `<label>상태<select id="bfStatus"><option>active</option><option>pending</option><option>inactive</option></select></label>` : ""}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canManage ? [{
              label: "저장", className: "primary",
              onClick: () => {
                b.status = document.querySelector("#bfStatus")?.value || b.status;
                closeModal(); toast("혜택 상태가 변경되었습니다. (로컬)"); paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  const uses = ctx.session.partnerId
    ? DEMO_COUPON_USES.filter((c) => c.partnerId === ctx.session.partnerId)
    : DEMO_COUPON_USES;

  root.innerHTML = `
    ${pageHeader({ title: "혜택·쿠폰", subtitle: "혜택과 쿠폰을 관리합니다." })}
    ${filterBar({
      placeholder: "상태 필터",
      filters: [{
        id: "statusFilter", label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "active", label: "active" },
          { value: "pending", label: "pending" },
          { value: "inactive", label: "inactive" },
          { value: "planned", label: "planned" }
        ]
      }]
    })}
    <div id="tableHost"></div>
    <div class="card"><h3>쿠폰 사용 내역</h3>
      <ul class="simple-list">${uses.map((u) =>
        `<li><code>${escapeHtml(u.id)}</code> · ${escapeHtml(u.benefitId)} · ${escapeHtml(u.userId)} · ${statusBadge(u.status)}</li>`
      ).join("") || "<li class=\"muted\">없음</li>"}</ul>
    </div>`;
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  paint();
}

export function renderMemberships(root) {
  root.innerHTML = `
    ${pageHeader({ title: "멤버십", subtitle: "멤버십 상품을 관리합니다." })}
    ${plannedNotice("멤버십 관리")}`;
}

export function renderOrders(root) {
  root.innerHTML = `
    ${pageHeader({ title: "주문·이용 내역", subtitle: "주문과 이용 내역을 확인합니다." })}
    ${plannedNotice("주문·결제 내역")}`;
}

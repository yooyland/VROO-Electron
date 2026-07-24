import { DEMO_SUPPORT_TICKETS } from "../../../../shared/data/demo-support.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { pageHeader, filterBar, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_SUPPORT_TICKETS.map((t) => ({ ...t }));

export function renderSupport(root, ctx) {
  const canRespond = hasPermission(ctx.session, "support.respond");
  const paint = () => {
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = store.slice();
    if (st !== "all") rows = rows.filter((t) => t.status === st);
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "티켓" },
        { key: "userId", label: "userId" },
        { key: "subject", label: "제목" },
        { key: "category", label: "분류" },
        { key: "priority", label: "우선순위" },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const t = store.find((x) => x.id === btn.dataset.id);
        if (!t) return;
        openModal({
          title: t.subject,
          bodyHtml: `<p>작성자: <code>${escapeHtml(t.userId)}</code></p>${statusBadge(t.status)}
            ${canRespond ? `<label>상담 메모<textarea id="csNote" rows="3" placeholder="민감정보 입력 금지"></textarea></label>
              <label>상태<select id="tkStatus"><option>open</option><option>pending</option><option>resolved</option></select></label>` : ""}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canRespond ? [{
              label: "저장", className: "primary",
              onClick: () => {
                t.status = document.querySelector("#tkStatus")?.value || t.status;
                closeModal(); toast("상담 기록이 저장되었습니다. (로컬)"); paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({ title: "고객 문의", subtitle: "고객 문의를 처리합니다." })}
    ${filterBar({
      placeholder: "상태 필터",
      filters: [{
        id: "statusFilter", label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "open", label: "open" },
          { value: "pending", label: "pending" },
          { value: "resolved", label: "resolved" }
        ]
      }]
    })}
    <div id="tableHost"></div>`;
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  paint();
}

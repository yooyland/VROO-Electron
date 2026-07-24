import { DEMO_REPORTS } from "../../../../shared/data/demo-support.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { pageHeader, filterBar, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_REPORTS.map((r) => ({ ...r }));

export function renderModeration(root, ctx) {
  const canProcess = hasPermission(ctx.session, "reports.process");
  const paint = () => {
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = store.slice();
    if (st !== "all") rows = rows.filter((r) => r.status === st);
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "신고ID" },
        { key: "type", label: "유형" },
        { key: "targetId", label: "대상" },
        { key: "reporterId", label: "신고자" },
        { key: "reason", label: "사유" },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const r = store.find((x) => x.id === btn.dataset.id);
        if (!r) return;
        openModal({
          title: `신고 ${r.id}`,
          bodyHtml: `<p>${escapeHtml(r.reason)}</p><p>유형: ${escapeHtml(r.type)}</p>${statusBadge(r.status)}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canProcess && r.status === "pending" ? [{
              label: "해결 처리", className: "primary",
              onClick: () => { r.status = "resolved"; closeModal(); toast("신고가 처리되었습니다. (로컬)"); paint(); }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({ title: "커뮤니티·신고", subtitle: "신고와 커뮤니티 이슈를 처리합니다." })}
    ${filterBar({
      placeholder: "검색 미사용 — 상태 필터",
      filters: [{
        id: "statusFilter", label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "pending", label: "pending" },
          { value: "resolved", label: "resolved" }
        ]
      }]
    })}
    <div id="tableHost"></div>`;
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  paint();
}

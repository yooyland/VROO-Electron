import { DEMO_GRIDS } from "../../../../shared/data/demo-users.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { pageHeader, filterBar, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_GRIDS.map((g) => ({ ...g }));

export function renderGrids(root, ctx) {
  const canManage = hasPermission(ctx.session, "grids.manage");
  const paint = () => {
    const q = (root.querySelector("#q")?.value || "").trim().toLowerCase();
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = store.slice();
    if (st !== "all") rows = rows.filter((g) => g.status === st);
    if (q) rows = rows.filter((g) => `${g.name} ${g.id} ${g.type}`.toLowerCase().includes(q));
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "grid.id" },
        { key: "name", label: "이름" },
        { key: "type", label: "유형" },
        { key: "members", label: "참가자" },
        { key: "official", label: "공식", render: (r) => (r.official ? "Y" : "N") },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const g = store.find((x) => x.id === btn.dataset.id);
        if (!g) return;
        openModal({
          title: g.name,
          bodyHtml: `<p>ID: <code>${escapeHtml(g.id)}</code></p><p>유형: ${escapeHtml(g.type)}</p>${statusBadge(g.status)}
            ${canManage ? `<label>상태<select id="gridStatus"><option>active</option><option>inactive</option></select></label>` : ""}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canManage ? [{
              label: "저장", className: "primary",
              onClick: () => {
                g.status = document.querySelector("#gridStatus")?.value || g.status;
                closeModal(); toast("GRID 상태가 변경되었습니다. (로컬)"); paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({ title: "GRID 관리", subtitle: "community / spatial / official" })}
    ${filterBar({
      placeholder: "이름·ID·유형",
      filters: [{
        id: "statusFilter", label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "active", label: "active" },
          { value: "inactive", label: "inactive" }
        ]
      }]
    })}
    <div id="tableHost"></div>`;
  root.querySelector("#q")?.addEventListener("input", paint);
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  paint();
}

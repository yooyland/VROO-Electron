import { DEMO_VEHICLES } from "../../../../shared/data/demo-users.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { pageHeader, filterBar, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_VEHICLES.map((v) => ({ ...v }));

export function renderVehicles(root, ctx) {
  const canManage = hasPermission(ctx.session, "vehicles.manage");

  const paint = () => {
    const q = (root.querySelector("#q")?.value || "").trim().toLowerCase();
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = store.slice();
    if (st !== "all") rows = rows.filter((v) => v.status === st);
    if (q) rows = rows.filter((v) => `${v.plate} ${v.nickname} ${v.car}`.toLowerCase().includes(q));
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "차량ID" },
        { key: "userId", label: "userId" },
        { key: "nickname", label: "닉네임" },
        { key: "plate", label: "번호판" },
        { key: "car", label: "차종" },
        { key: "level", label: "레벨" },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const v = store.find((x) => x.id === btn.dataset.id);
        if (!v) return;
        openModal({
          title: `차량 ${v.plate}`,
          bodyHtml: `<p>소유자 userId: <code>${escapeHtml(v.userId)}</code></p><p>${statusBadge(v.status)}</p>
            ${canManage ? `<label>상태<select id="vehStatus"><option value="active">active</option><option value="suspended">suspended</option></select></label>` : ""}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canManage ? [{
              label: "저장",
              className: "primary",
              onClick: () => {
                v.status = document.querySelector("#vehStatus")?.value || v.status;
                closeModal();
                toast("차량 상태가 변경되었습니다. (로컬)");
                paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({ title: "차량 관리", subtitle: "등록 차량 목록" })}
    ${filterBar({
      placeholder: "번호판·닉네임·차종",
      filters: [{
        id: "statusFilter", label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "active", label: "active" },
          { value: "suspended", label: "suspended" }
        ]
      }]
    })}
    <div id="tableHost"></div>`;
  root.querySelector("#q")?.addEventListener("input", paint);
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  paint();
}

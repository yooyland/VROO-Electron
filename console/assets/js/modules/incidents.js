import { DEMO_INCIDENTS } from "../../../../shared/data/demo-incidents.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { pageHeader, filterBar, dataTable, statusBadge, openModal, closeModal, toast, escapeHtml } from "../console-ui.js";

let store = DEMO_INCIDENTS.map((i) => ({ ...i }));

export function renderIncidents(root, ctx) {
  const canManage = hasPermission(ctx.session, "incidents.manage");
  const paint = () => {
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = store.slice();
    if (st !== "all") rows = rows.filter((i) => i.status === st);
    const host = root.querySelector("#tableHost");
    host.innerHTML = dataTable({
      columns: [
        { key: "id", label: "사고ID" },
        { key: "userId", label: "userId" },
        { key: "location", label: "위치" },
        { key: "photoCount", label: "사진수" },
        { key: "emergency", label: "긴급", render: (r) => (r.emergency ? "Y" : "N") },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) }
      ],
      rows
    });
    host.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const i = store.find((x) => x.id === btn.dataset.id);
        if (!i) return;
        openModal({
          title: `사고 ${i.id}`,
          bodyHtml: `<p>${escapeHtml(i.notes)}</p><p class="muted">외부 보험사 전송·민감정보 없음</p>${statusBadge(i.status)}
            ${canManage ? `<label>상태<select id="acStatus">
              <option>reported</option><option>assistanceRequested</option><option>towing</option><option>repair</option><option>closed</option>
            </select></label>` : ""}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canManage ? [{
              label: "저장", className: "primary",
              onClick: () => {
                i.status = document.querySelector("#acStatus")?.value || i.status;
                closeModal(); toast("사고 상태가 변경되었습니다. (로컬)"); paint();
              }
            }] : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({ title: "사고 접수", subtitle: "사고 접수 현황을 관리합니다." })}
    ${filterBar({
      placeholder: "상태",
      filters: [{
        id: "statusFilter", label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "reported", label: "reported" },
          { value: "assistanceRequested", label: "assistanceRequested" },
          { value: "closed", label: "closed" }
        ]
      }]
    })}
    <div id="tableHost"></div>`;
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  paint();
}

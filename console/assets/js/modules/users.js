import { DEMO_USERS } from "../../../../shared/data/demo-users.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import {
  pageHeader, filterBar, dataTable, statusBadge, openModal, closeModal,
  confirmDialog, toast, escapeHtml
} from "../console-ui.js";

let store = DEMO_USERS.map((u) => ({ ...u }));

export function renderUsers(root, ctx) {
  const canManage = hasPermission(ctx.session, "users.manage");
  const canSuspend = hasPermission(ctx.session, "users.suspend");

  const paint = () => {
    const q = (root.querySelector("#q")?.value || "").trim().toLowerCase();
    const st = root.querySelector("#statusFilter")?.value || "all";
    let rows = store.slice();
    if (st !== "all") rows = rows.filter((u) => u.status === st);
    if (q) rows = rows.filter((u) =>
      `${u.nickname} ${u.plate} ${u.id}`.toLowerCase().includes(q)
    );

    const tableHost = root.querySelector("#tableHost");
    if (!tableHost) return;
    tableHost.innerHTML = dataTable({
      columns: [
        { key: "id", label: "ID" },
        { key: "nickname", label: "닉네임" },
        { key: "plate", label: "번호판" },
        { key: "level", label: "레벨" },
        { key: "credits", label: "크레딧" },
        { key: "status", label: "상태", render: (r) => statusBadge(r.status) },
        { key: "online", label: "온라인", render: (r) => (r.online ? "Y" : "N") }
      ],
      rows,
      emptyMessage: "검색 결과가 없습니다."
    });

    tableHost.querySelectorAll("[data-action=detail]").forEach((btn) => {
      btn.onclick = () => {
        const u = store.find((x) => x.id === btn.dataset.id);
        if (!u) return;
        openModal({
          title: `회원 ${u.nickname}`,
          bodyHtml: `
            <p>ID: <code>${escapeHtml(u.id)}</code></p>
            <p>상태: ${statusBadge(u.status)}</p>
            <p class="muted">닉네임은 고유키가 아닙니다. 식별자는 user.id 입니다.</p>
            ${canManage || canSuspend ? `<label>상태 변경
              <select id="userStatusSelect">
                ${["active","inactive","pending","suspended"].map((s) =>
                  `<option value="${s}" ${s === u.status ? "selected" : ""}>${s}</option>`).join("")}
              </select></label>` : "<p class=\"muted\">읽기 전용</p>"}`,
          actions: [
            { label: "닫기", onClick: closeModal },
            ...(canSuspend || canManage
              ? [{
                  label: "상태 저장",
                  className: "primary",
                  onClick: () => {
                    const next = document.querySelector("#userStatusSelect")?.value;
                    if (!next) return;
                    if (next === "suspended" && !canSuspend) {
                      toast("정지 권한이 없습니다.", "error");
                      return;
                    }
                    u.status = next;
                    closeModal();
                    toast("상태가 변경되었습니다. (로컬)");
                    paint();
                  }
                }]
              : [])
          ]
        });
      };
    });
  };

  root.innerHTML = `
    ${pageHeader({ title: "회원 관리", subtitle: "회원 계정과 상태를 관리합니다." })}
    ${filterBar({
      placeholder: "닉네임·번호판·ID",
      filters: [{
        id: "statusFilter",
        label: "상태",
        options: [
          { value: "all", label: "전체" },
          { value: "active", label: "active" },
          { value: "pending", label: "pending" },
          { value: "suspended", label: "suspended" },
          { value: "inactive", label: "inactive" }
        ]
      }],
      extra: canSuspend
        ? `<button type="button" class="btn ghost" id="bulkHint">정지 안내</button>`
        : ""
    })}
    <div id="tableHost"></div>`;

  root.querySelector("#q")?.addEventListener("input", paint);
  root.querySelector("#statusFilter")?.addEventListener("change", paint);
  root.querySelector("#bulkHint")?.addEventListener("click", () => {
    confirmDialog({
      title: "안내",
      message: "서버 미연결 환경에서는 화면 상태만 변경됩니다.",
      onConfirm: () => toast("확인됨")
    });
  });
  paint();
}

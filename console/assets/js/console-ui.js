import { escapeHtml, formatNumber, formatDate, statusLabel as baseStatusLabel } from "../../../shared/utils/format.js";

export function toast(message, type = "info") {
  let host = document.querySelector("#consoleToastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "consoleToastHost";
    host.className = "console-toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `console-toast console-toast-${type}`;
  el.setAttribute("role", "status");
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

export function pageHeader({ title, subtitle, actionsHtml = "" }) {
  return `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-desc">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      <div class="page-header-actions">${actionsHtml}</div>
    </div>`;
}

/** Operational status badges — avoid exposing prototype/planned on main screens */
export function statusBadge(status) {
  const s = status || "neutral";
  const map = {
    prototype: "운영 데이터",
    planned: "준비 중",
    ready: "사용 중"
  };
  const label = map[s] || baseStatusLabel(s) || s;
  return `<span class="status-badge status-${escapeHtml(s)}" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

export function plannedNotice(featureName = "이 기능") {
  return `
    <div class="empty-state planned-notice" role="status">
      <b>${escapeHtml(featureName)}은(는) 준비 중입니다.</b>
      <p class="muted">연동 후 이용할 수 있습니다. 현재는 저장·전송이 수행되지 않습니다.</p>
    </div>`;
}

export function emptyState(message = "표시할 항목이 없습니다.") {
  return `<div class="empty-state" role="status"><p>${escapeHtml(message)}</p></div>`;
}

export function statCards(items = []) {
  return `<div class="aux-grid">${items.map((it) => `
    <article class="aux-card">
      <div class="aux-label">${escapeHtml(it.label)}</div>
      <div class="aux-value tabular">${escapeHtml(String(it.value))}</div>
      ${it.hint ? `<div class="muted" style="margin-top:4px">${escapeHtml(it.hint)}</div>` : ""}
    </article>`).join("")}</div>`;
}

export function filterBar({ searchId = "q", placeholder = "검색", filters = [], extra = "" }) {
  return `
    <div class="filter-bar" role="search">
      <input type="search" id="${escapeHtml(searchId)}" class="filter-search" placeholder="${escapeHtml(placeholder)}" aria-label="검색">
      ${filters.map((f) => `
        <label class="filter-label">${escapeHtml(f.label)}
          <select id="${escapeHtml(f.id)}" aria-label="${escapeHtml(f.label)}">
            ${f.options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("")}
          </select>
        </label>`).join("")}
      ${extra}
    </div>`;
}

export function dataTable({ columns, rows, rowIdKey = "id", emptyMessage }) {
  if (!rows?.length) return emptyState(emptyMessage || "결과가 없습니다.");
  return `
    <div class="table-wrap" role="region" aria-label="데이터 표" tabindex="0">
      <table class="data-table">
        <thead><tr>${columns.map((c) => `<th scope="col">${escapeHtml(c.label)}</th>`).join("")}<th scope="col">동작</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr data-id="${escapeHtml(row[rowIdKey])}">
              ${columns.map((c) => `<td>${c.render ? c.render(row) : escapeHtml(row[c.key])}</td>`).join("")}
              <td class="row-actions">
                <button type="button" class="btn ghost" data-action="detail" data-id="${escapeHtml(row[rowIdKey])}">상세</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p class="pagination-placeholder">페이지 ${formatNumber(1)} · 표시 ${formatNumber(rows.length)}건</p>`;
}

let modalPrevFocus = null;

export function openModal({ title, bodyHtml, actions = [] }) {
  const backdrop = document.querySelector("#consoleModal");
  const titleEl = document.querySelector("#consoleModalTitle");
  const bodyEl = document.querySelector("#consoleModalBody");
  const actionsEl = document.querySelector("#consoleModalActions");
  if (!backdrop || !titleEl || !bodyEl || !actionsEl) return;
  modalPrevFocus = document.activeElement;
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  actionsEl.innerHTML = "";
  actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${a.className || "ghost"}`;
    btn.textContent = a.label;
    btn.onclick = () => a.onClick?.();
    actionsEl.appendChild(btn);
  });
  backdrop.classList.add("open");
  backdrop.setAttribute("aria-hidden", "false");
  document.querySelector("#consoleModalClose")?.focus();
}

export function closeModal() {
  const backdrop = document.querySelector("#consoleModal");
  if (!backdrop) return;
  backdrop.classList.remove("open");
  backdrop.setAttribute("aria-hidden", "true");
  if (modalPrevFocus && typeof modalPrevFocus.focus === "function") modalPrevFocus.focus();
  modalPrevFocus = null;
}

export function bindModalChrome() {
  const backdrop = document.querySelector("#consoleModal");
  document.querySelector("#consoleModalClose")?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop?.classList.contains("open")) closeModal();
  });
}

export function confirmDialog({ title, message, onConfirm }) {
  openModal({
    title,
    bodyHtml: `<p>${escapeHtml(message)}</p><p class="muted">서버 미연결 환경에서는 로컬 화면 상태만 변경됩니다.</p>`,
    actions: [
      { label: "취소", onClick: closeModal },
      {
        label: "확인",
        className: "primary",
        onClick: () => {
          closeModal();
          onConfirm?.();
        }
      }
    ]
  });
}

/** Service status model — operational | degraded | disconnected | unavailable | unknown | pending_integration */
export const SERVICE_STATUS = Object.freeze({
  operational: { label: "정상", icon: "check", className: "svc-ok" },
  degraded: { label: "일부 제한", icon: "warn", className: "svc-warn" },
  disconnected: { label: "연결 끊김", icon: "unlink", className: "svc-danger" },
  unavailable: { label: "사용 불가", icon: "x", className: "svc-danger" },
  unknown: { label: "확인 불가", icon: "help", className: "svc-muted" },
  pending_integration: { label: "연동 전", icon: "pending", className: "svc-pending" }
});

export function formatDateTimeKo(ts = Date.now()) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}`;
}

export function resultBadge(resultLabel, resultKey) {
  const key = resultKey || resultLabel || "neutral";
  const map = {
    success: "완료",
    approved: "승인",
    pending: "보류",
    in_progress: "보류",
    failed: "실패",
    cancelled: "취소",
    완료: "완료",
    승인: "승인",
    보류: "보류",
    실패: "실패",
    취소: "취소"
  };
  const label = map[key] || resultLabel || String(key);
  const cls = ["완료", "승인", "success", "approved"].includes(key) || label === "완료" || label === "승인"
    ? "status-ok"
    : ["실패", "취소", "failed", "cancelled"].includes(key) || label === "실패" || label === "취소"
      ? "status-bad"
      : "status-wait";
  return `<span class="status-badge ${cls}">${escapeHtml(label)}</span>`;
}

export { escapeHtml, formatNumber, formatDate, baseStatusLabel as statusLabel };

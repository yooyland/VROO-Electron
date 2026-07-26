import { ensureMyGarage, escapeHtml, userSummary, weekDistanceSeries } from "./my-data.js";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** Catmull-Rom → cubic Bezier path (부드러운 선) */
function smoothLinePath(pts) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function healthLineChart(series, labels, safeScore) {
  const w = 320;
  const h = 148;
  const padL = 10;
  const padR = 10;
  const padT = 18;
  const padB = 30;
  const vals = series.map((n) => Math.max(0, Number(n) || 0));
  const max = Math.max(1, ...vals);
  const n = vals.length;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const pts = vals.map((v, i) => {
    const x = padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padT + innerH - (v / max) * innerH;
    return [x, y];
  });
  const line = smoothLinePath(pts);
  const area = `${line} L ${pts[pts.length - 1][0]} ${padT + innerH} L ${pts[0][0]} ${padT + innerH} Z`;
  const dots = pts
    .map(
      ([x, y], i) =>
        `<circle class="my-chart-dot" cx="${x}" cy="${y}" r="5" data-day="${escapeHtml(labels[i])}" data-km="${vals[i]}" data-safe="${safeScore ?? ""}" tabindex="0" role="button" aria-label="${escapeHtml(labels[i])} ${vals[i]}km"/>`
    )
    .join("");
  const dayLabels = labels
    .map((lb, i) => {
      const x = pts[i]?.[0] ?? 0;
      return `<text class="my-chart-axis" x="${x}" y="${h - 6}" text-anchor="middle">${escapeHtml(lb)}</text>`;
    })
    .join("");

  return `<div class="my-chart-wrap">
    <div class="my-chart-tooltip" id="myChartTip" hidden></div>
    <svg class="my-health-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="주간 주행 선 그래프">
      <defs>
        <linearGradient id="myHealthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c9a227" stop-opacity=".35"/>
          <stop offset="100%" stop-color="#c9a227" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="my-chart-area" d="${area}" fill="url(#myHealthFill)"/>
      <path class="my-chart-line" d="${line}" fill="none" stroke="#f0d78c" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${dayLabels}
    </svg>
  </div>`;
}

function glowBarChart(bars) {
  return `<div class="my-glow-bars" aria-label="주행 비교">
    ${bars
      .map(([label, val, max]) => {
        const pct = Math.max(4, Math.round((val / Math.max(0.1, max)) * 100));
        return `<div class="my-glow-col">
          <div class="my-glow-track">
            <div class="my-glow-fill" style="height:${pct}%"></div>
          </div>
          <span class="my-glow-val">${escapeHtml(String(val))}</span>
          <span class="muted">${escapeHtml(label)}</span>
        </div>`;
      })
      .join("")}
  </div>`;
}

export function renderRecordsView(host, state) {
  const g = ensureMyGarage(state);
  const r = g.records || {};
  const summary = userSummary(state);
  const series = weekDistanceSeries(r);
  const week = Math.max(0.1, Number(r.weekDistanceKm) || 1);
  const bars = [
    ["오늘", Number(r.todayDistanceKm) || 0, Math.max(week / 3, 5)],
    ["주간", Number(r.weekDistanceKm) || 0, Math.max(week, 40)],
    ["안전", Number(r.safeDriveScore) || 0, 100]
  ];

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>기록</b>
        <div class="muted">로컬 요약 · Apple Health 스타일 곡선</div>
      </div>
    </div>
    <div class="my-record-grid">
      <div class="card my-record-card">
        <div class="my-record-card-head">
          <b>주간 주행</b>
          <span class="muted">${r.weekDistanceKm ?? "—"} km</span>
        </div>
        ${healthLineChart(series, DAY_LABELS, r.safeDriveScore)}
        <div class="my-summary-grid my-summary-grid--compact">
          <div><span class="muted">총</span><div>${r.totalDistanceKm ?? "—"} km</div></div>
          <div><span class="muted">오늘</span><div>${r.todayDistanceKm ?? "—"} km</div></div>
          <div><span class="muted">안전 점수</span><div>${r.safeDriveScore ?? "—"}</div></div>
        </div>
      </div>
      <div class="card my-record-card">
        <div class="my-record-card-head">
          <b>비교</b>
          <span class="muted">Glow bars</span>
        </div>
        ${glowBarChart(bars)}
      </div>
      <div class="card my-record-card">
        <b>활동</b>
        <div class="my-summary-grid">
          <div><span class="muted">방문 지역</span><div>${r.visitedAreas ?? "—"}</div></div>
          <div><span class="muted">GRID</span><div>${r.gridJoins ?? summary.gridCount}</div></div>
          <div><span class="muted">도로 대화</span><div>${r.roadMessages ?? 0}</div></div>
          <div><span class="muted">주변 상호작용</span><div>${r.nearbyInteractions ?? "—"}</div></div>
          <div><span class="muted">감사</span><div>${r.thanks ?? "—"}</div></div>
          <div><span class="muted">신고 정확도</span><div>${r.reportAccuracy == null ? "—" : r.reportAccuracy}</div></div>
        </div>
      </div>
    </div>`;

  const tip = host.querySelector("#myChartTip");
  const showTip = (dot, clientX, clientY) => {
    if (!tip || !dot) return;
    const day = dot.getAttribute("data-day");
    const km = dot.getAttribute("data-km");
    const safe = dot.getAttribute("data-safe");
    const parts = [`${day}`, `${km} km`];
    if (safe !== "" && safe != null) parts.push(`안전 ${safe}`);
    tip.textContent = parts.join(" · ");
    tip.hidden = false;
    const wrap = tip.parentElement;
    const rect = wrap.getBoundingClientRect();
    tip.style.left = `${Math.min(rect.width - 20, Math.max(20, clientX - rect.left))}px`;
    tip.style.top = `${Math.max(18, clientY - rect.top)}px`;
    host.querySelectorAll(".my-chart-dot").forEach((d) => d.classList.toggle("is-active", d === dot));
  };
  host.querySelectorAll(".my-chart-dot").forEach((dot) => {
    dot.addEventListener("click", (e) => showTip(dot, e.clientX, e.clientY));
    dot.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const r = dot.getBoundingClientRect();
        showTip(dot, r.left + r.width / 2, r.top);
      }
    });
  });
}

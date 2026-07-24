import { DEMO_ANALYTICS } from "../../../../shared/data/demo-analytics.js";
import { hasPermission } from "../../../../shared/utils/permission.js";
import { pageHeader, statCards, statusBadge, toast } from "../console-ui.js";

export function renderAnalytics(root, ctx) {
  const canExport = hasPermission(ctx.session, "analytics.export");
  const a = DEMO_ANALYTICS;
  root.innerHTML = `
    ${pageHeader({
      title: "통계",
      subtitle: "주요 지표 요약 · 읽기 전용",
      actionsHtml: canExport
        ? `<button type="button" class="btn ghost" id="exportBtn">내보내기</button>`
        : ""
    })}
    ${statCards([
      { label: "활성 사용자", value: a.todayActiveUsers },
      { label: "온라인 차량", value: a.onlineVehicles },
      { label: "GRID", value: a.activeGrids },
      { label: "쿠폰 사용", value: a.couponUsesToday },
      { label: "거래액", value: `₩${a.demoRevenue.toLocaleString("ko-KR")}` },
      { label: "제휴사", value: a.partnerCount }
    ])}
    <div class="card">
      <h3>7일 추이 (placeholder)</h3>
      <p class="muted">users: ${a.charts.users7d.join(" → ")}</p>
      <p class="muted">coupons: ${a.charts.coupons7d.join(" → ")}</p>
      <p class="muted">grids: ${a.charts.grids7d.join(" → ")}</p>
      <p class="muted">차트 라이브러리 없음 · 숫자만 표시. 데이터 변경 UI 없음.</p>
    </div>`;
  root.querySelector("#exportBtn")?.addEventListener("click", () => {
    toast("서버 미연결로 파일을 내보낼 수 없습니다.");
  });
}

import {carInfo} from "./data.js";
import {getDailyMissionSummary, getNextProgressionAction, getProgressionStreak, getProgressionSummary, VEHICLE_TIERS} from "./progression.js";
import {emit} from "../core/events.js";
import {growthUpgradeCost,formatCredits,canAfford,spendCredits} from "../core/storage.js";
import {showSystemMessage} from "../core/ui.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function renderGrowth(panel,state){
  const cost=growthUpgradeCost(state.level);
  const level=Math.max(1,Number(state.level)||1);
  const xp=clamp(state.xp,0,100);
  const mileage=clamp(state.weekMileage,0,9999);
  const vehicle=carInfo(state.profile.car);
  const progression=getProgressionSummary(state.vehicleProgression);
  const daily=getDailyMissionSummary(state.vehicleProgression);
  const nextAction=getNextProgressionAction(state.vehicleProgression);
  const streak=getProgressionStreak(state.vehicleProgression);
  let busy=false;

  panel.innerHTML=`
    <div class="play-shell">
      <section class="play-hero">
        <div class="play-avatar" aria-label="${vehicle.name}">${vehicle.emoji}</div>
        <div class="play-hero-copy">
          <span>VROO PLAY · ${progression.currentTier.label}</span>
          <h3>${state.profile.nickname} · ${vehicle.name}</h3>
          <p>주행·GRID·안전 운전 미션으로 차량과 계정을 성장시킵니다.</p>
          <div class="progress" aria-label="${progression.currentTier.label} 성장 진행률"><i style="width:${progression.progress}%"></i></div>
          <small>${progression.nextTier
            ? `${progression.nextTier.label}까지 ${progression.pointsToNext.toLocaleString("ko-KR")}P`
            : "HERITAGE 완성"}</small>
        </div>
        <button type="button" class="secondary" id="openGarageFromPlay">MY CAR · 차고</button>
      </section>

      <section class="play-summary" aria-label="PLAY 요약">
        <article><small>현재 차량 등급</small><b>${progression.currentTier.label}</b></article>
        <article><small>성장 포인트</small><b>${progression.points.toLocaleString("ko-KR")} P</b></article>
        <article><small>주간 주행</small><b>${mileage.toLocaleString("ko-KR")} km</b></article>
        <article><small>계정 레벨</small><b>LV.${level} · ${xp}%</b></article>
      </section>

      <section class="play-tier-roadmap" aria-label="차량 성장 단계">
        ${VEHICLE_TIERS.map(tier => {
          const active=tier.id===progression.currentTier.id;
          const completed=progression.points>=tier.minPoints && !active;
          return `<div class="${active?"active":completed?"completed":""}">
            <i></i><b>${tier.label}</b><small>${tier.minPoints.toLocaleString("ko-KR")}P</small>
          </div>`;
        }).join("")}
      </section>

      <button type="button" class="progression-next-action ${nextAction.completedToday?"is-complete":""}" data-next-progression-action="${nextAction.route}">
        <div><span>${nextAction.eyebrow}</span><b>${nextAction.title}</b><small>${nextAction.description}</small></div>
        <strong>${nextAction.cta} →</strong>
      </button>

      <section class="play-grid">
        <div class="play-missions">
          <div class="play-section-head"><div><span>DAILY MISSION · ${daily.day}</span><h3>오늘의 미션</h3></div><small>🔥 ${streak.current}일 연속 · 최고 ${streak.best}일 · ${daily.completedCount}/${daily.totalCount} 완료</small></div>
          ${daily.missions.map(mission=>`
            <article class="play-mission-card ${mission.completed?"is-completed":""}">
              <div><b>${mission.completed?"✓ ":""}${mission.label}</b><small>${mission.description} · 보상 +${mission.rewardPoints}P</small></div>
              <strong>${mission.current.toFixed(mission.kind==="driveKm"?1:0)} / ${mission.target} ${mission.unit}</strong>
              <i><span style="width:${mission.progress}%"></span></i>
            </article>
          `).join("")}
        </div>

        <aside class="play-upgrade-card">
          <span>ACCOUNT LEVEL</span>
          <h3>계정 업그레이드</h3>
          <p>차량 등급은 일상 활동으로 성장합니다. 크레딧 업그레이드는 계정 레벨과 별도로 유지됩니다.</p>
          <div class="play-cost">LV.${level+1} 필요 크레딧 <b>🪙 ${formatCredits(cost)}</b></div>
          <button class="primary" id="levelUp" type="button">계정 레벨 올리기</button>
        </aside>
      </section>
    </div>`;

  panel.querySelector("#openGarageFromPlay").onclick=()=>emit("growth:openGarage");
  panel.querySelector("[data-next-progression-action]").onclick=()=>emit("growth:nextAction",nextAction);
  panel.querySelector("#levelUp").onclick=()=>{
    if(busy)return;
    if(!canAfford(state,cost)){
      showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(cost)})`);
      return;
    }
    busy=true;
    const paid=spendCredits(state,cost);
    if(!paid.ok){
      busy=false;
      showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(cost)})`);
      return;
    }
    state.level++;
    state.xp=0;
    emit("state:save");
    renderGrowth(panel,state);
  };
}

import {carInfo} from "./data.js";
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
  const driveProgress=Math.min(100,Math.round((mileage/10)*100));
  const visited=Math.min(3,Math.max(0,Number(state.visitedGridCount)||0));
  let busy=false;

  panel.innerHTML=`
    <div class="play-shell">
      <section class="play-hero">
        <div class="play-avatar">${carInfo(state.profile.car).emoji}</div>
        <div class="play-hero-copy">
          <span>VROO PLAY</span>
          <h3>${state.profile.nickname} · LV.${level}</h3>
          <p>주행·GRID·안전 운전 미션으로 차량과 계정을 성장시킵니다.</p>
          <div class="progress" aria-label="레벨 경험치"><i style="width:${xp}%"></i></div>
          <small>EXP ${xp}%</small>
        </div>
        <button type="button" class="secondary" id="openGarageFromPlay">MY CAR · 차고</button>
      </section>

      <section class="play-summary" aria-label="PLAY 요약">
        <article><small>현재 레벨</small><b>LV.${level}</b></article>
        <article><small>주간 주행</small><b>${mileage.toLocaleString("ko-KR")} km</b></article>
        <article><small>다음 업그레이드</small><b>🪙 ${formatCredits(cost)}</b></article>
      </section>

      <section class="play-grid">
        <div class="play-missions">
          <div class="play-section-head"><div><span>DAILY MISSION</span><h3>오늘의 미션</h3></div><small>로컬 진행 상태</small></div>
          <article class="play-mission-card">
            <div><b>오늘의 드라이브</b><small>10 km 주행</small></div>
            <strong>${Math.min(10,mileage).toFixed(1)} / 10 km</strong>
            <i><span style="width:${driveProgress}%"></span></i>
          </article>
          <article class="play-mission-card">
            <div><b>GRID 방문</b><small>서로 다른 GRID 3곳 방문</small></div>
            <strong>${visited} / 3</strong>
            <i><span style="width:${Math.round((visited/3)*100)}%"></span></i>
          </article>
          <article class="play-mission-card is-planned">
            <div><b>안전 운전 연속 기록</b><small>실제 센서 연동 전</small></div>
            <strong>준비 중</strong>
          </article>
        </div>

        <aside class="play-upgrade-card">
          <span>LEVEL UP</span>
          <h3>차량 성장</h3>
          <p>레벨을 올리면 탐색 범위와 소셜 기능이 단계적으로 확장됩니다.</p>
          <div class="play-cost">필요 크레딧 <b>🪙 ${formatCredits(cost)}</b></div>
          <button class="primary" id="levelUp" type="button">업그레이드</button>
        </aside>
      </section>
    </div>`;

  panel.querySelector("#openGarageFromPlay").onclick=()=>emit("growth:openGarage");
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

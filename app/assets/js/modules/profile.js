import {carInfo, cars} from "./data.js";
import {emit} from "../core/events.js";

/** Content Workspace용 MY PAGE 렌더 */
export function renderMyPage(panel, state) {
  if (!panel) return;
  panel.innerHTML = `
    <div class="card row">
      <div class="avatar" style="font-size:70px">${carInfo(state.profile.car).emoji}</div>
      <div>
        <h3>${state.profile.nickname}</h3>
        <div class="muted">${state.profile.plate}</div>
        <div class="muted">${state.profile.status}</div>
      </div>
    </div>
    <div class="card">
      <label>닉네임</label>
      <input id="pNick" value="${state.profile.nickname}">
      <label>번호판</label>
      <input id="pPlate" value="${state.profile.plate}">
      <label>상태</label>
      <input id="pStatus" value="${state.profile.status}">
      <label>MY CAR</label>
      <select id="pCar">${cars.map(c =>
        `<option value="${c[0]}" ${c[0] === state.profile.car ? "selected" : ""}>${c[2]} ${c[1]}</option>`
      ).join("")}</select>
      <div class="row" style="margin-top:14px;justify-content:flex-end;gap:8px">
        <button type="button" class="secondary" id="myPageCancel">닫기</button>
        <button type="button" class="primary" id="myPageSave">저장</button>
      </div>
    </div>`;

  panel.querySelector("#myPageCancel").onclick = () => emit("workspace:spatialHome");
  panel.querySelector("#myPageSave").onclick = () => {
    state.profile.nickname = document.querySelector("#pNick").value || state.profile.nickname;
    state.profile.plate = document.querySelector("#pPlate").value || state.profile.plate;
    state.profile.status = document.querySelector("#pStatus").value;
    state.profile.car = document.querySelector("#pCar").value;
    emit("state:save");
    emit("workspace:spatialHome");
  };
}

/** @deprecated 호환 — Content Workspace의 renderMyPage 사용 */
export function openMyPage(state) {
  emit("mypage:open", state);
}

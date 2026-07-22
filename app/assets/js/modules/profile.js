import {carInfo, cars} from "./data.js";
import {openModal, closeModal} from "../core/ui.js";
import {emit} from "../core/events.js";

/** 내 프로필 편집 — 다른 사용자 상세(openUserDetail)와 분리 */
export function openMyPage(state) {
  openModal(
    "MY PAGE",
    `<div class="card row"><div class="avatar" style="font-size:70px">${carInfo(state.profile.car).emoji}</div><div><h3>${state.profile.nickname}</h3><div class="muted">${state.profile.plate}</div><div class="muted">${state.profile.status}</div></div></div><div class="card"><label>닉네임</label><input id="pNick" value="${state.profile.nickname}"><label>번호판</label><input id="pPlate" value="${state.profile.plate}"><label>상태</label><input id="pStatus" value="${state.profile.status}"><label>MY CAR</label><select id="pCar">${cars.map(c => `<option value="${c[0]}" ${c[0] === state.profile.car ? "selected" : ""}>${c[2]} ${c[1]}</option>`).join("")}</select></div>`,
    [
      {label: "닫기", onClick: closeModal},
      {
        label: "저장",
        className: "primary",
        onClick: () => {
          state.profile.nickname = document.querySelector("#pNick").value || state.profile.nickname;
          state.profile.plate = document.querySelector("#pPlate").value || state.profile.plate;
          state.profile.status = document.querySelector("#pStatus").value;
          state.profile.car = document.querySelector("#pCar").value;
          emit("state:save");
          closeModal();
        }
      }
    ]
  );
}

import { cars } from "../data.js";
import { ensureMyGarage, escapeHtml, setActiveVehicle } from "./my-data.js";
import { emit } from "../../core/events.js";
import { showSystemMessage } from "../../core/ui.js";

export function renderProfileView(host, state, refresh) {
  const g = ensureMyGarage(state);
  const p = state.profile || {};
  const draft = g.profileDraft || {
    nickname: p.nickname || "",
    plate: p.plate || "",
    status: p.status || "",
    car: p.car || "sport",
    intro: p.intro || "",
    platePublic: p.platePublic !== false,
    regionPublic: p.regionPublic !== false
  };
  g.profileDraft = draft;

  host.innerHTML = `
    <div class="my-view-head">
      <div>
        <b>프로필</b>
        <div class="muted">계정·공개 설정 · Garage 메인과 분리된 편집 화면</div>
      </div>
    </div>
    <div class="card my-profile-form">
      <label>닉네임</label>
      <input id="myPNick" value="${escapeHtml(draft.nickname)}" maxlength="24">
      <label>소개</label>
      <input id="myPIntro" value="${escapeHtml(draft.intro)}" maxlength="80" placeholder="한 줄 소개">
      <label>대화명 / 상태 메시지</label>
      <input id="myPStatus" value="${escapeHtml(draft.status)}" maxlength="60">
      <label>번호판</label>
      <input id="myPPlate" value="${escapeHtml(draft.plate)}" maxlength="20">
      <label>대표 차량</label>
      <select id="myPCar">${cars
        .map(
          (c) =>
            `<option value="${c[0]}" ${draft.car === c[0] ? "selected" : ""}>${escapeHtml(c[1])}</option>`
        )
        .join("")}</select>
      <label class="my-check"><input type="checkbox" id="myPPlatePub" ${draft.platePublic ? "checked" : ""}> 번호판 공개 허용</label>
      <label class="my-check"><input type="checkbox" id="myPRegionPub" ${draft.regionPublic ? "checked" : ""}> 지역 공개 허용</label>
      <div class="muted" style="margin-top:8px">알림 설정·계정 보안은 서버 연동 후 제공됩니다.</div>
      <div class="my-garage-actions" style="margin-top:14px">
        <button type="button" class="secondary" id="myPCancel">취소</button>
        <button type="button" class="primary" id="myPSave">저장</button>
      </div>
    </div>`;

  const readDraft = () => {
    draft.nickname = host.querySelector("#myPNick").value;
    draft.intro = host.querySelector("#myPIntro").value;
    draft.status = host.querySelector("#myPStatus").value;
    draft.plate = host.querySelector("#myPPlate").value;
    draft.car = host.querySelector("#myPCar").value;
    draft.platePublic = host.querySelector("#myPPlatePub").checked;
    draft.regionPublic = host.querySelector("#myPRegionPub").checked;
  };

  host.querySelector("#myPCancel").onclick = () => {
    g.profileDraft = null;
    emit("state:save");
    g.activeMyView = "garage";
    refresh();
  };
  host.querySelector("#myPSave").onclick = () => {
    readDraft();
    state.profile.nickname = draft.nickname.trim() || state.profile.nickname;
    state.profile.plate = draft.plate.trim() || state.profile.plate;
    state.profile.status = draft.status;
    state.profile.intro = draft.intro;
    state.profile.platePublic = draft.platePublic;
    state.profile.regionPublic = draft.regionPublic;
    state.profile.car = draft.car;
    const veh = g.vehicles.find((v) => v.catalogType === draft.car && v.owned);
    if (veh) setActiveVehicle(state, veh.id);
    else state.profile.car = draft.car;
    g.profileDraft = null;
    emit("state:save");
    emit("ui:refreshAccount");
    showSystemMessage("프로필을 저장했습니다.");
    g.activeMyView = "garage";
    refresh();
  };
}

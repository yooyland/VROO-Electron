import {loadState,saveState,formatCredits} from "./core/storage.js";
import {on} from "./core/events.js";
import {showSystemMessage,openModal,closeModal} from "./core/ui.js";
import {initMap,setLocation,setMapView,invalidateMaps,rotateMap,getUsers,setSpatialGridVisible,drawUsers} from "./modules/map.js";
import {initRoad,startRoad,stopRoad,pauseRoad,resumeRoad,setEnvironment,mountRoadStage,resizeRoad} from "./modules/road.js";
import {renderNearby,openUserDetail,renderAllViewSummary} from "./modules/nearby.js";
import {renderGrid, beginCreateGrid, syncGridHeader, openSpatialGridDetail} from "./modules/grid.js";
import {renderRooms,openChatWith,openGridChat,refreshChatBadge,pauseChatVoice,openConversationById} from "./modules/chat.js";
import {
  renderRoadChatPanel,
  ensureRoadChatDock,
  syncRoadChatOnView,
  captureRoadChatUi,
  pauseRoadVoiceForWorkspace,
  clearWorkspaceVoicePauseFlag,
  bindRoadChatBoot,
  ensureRoadChat,
  syncRoadNavigationHud
} from "./modules/road-chat.js";
import {ensureNearbyChat,ensureNavigation,ensureConversationUi,ensureRoadInsight} from "./modules/conversation-store.js";
import {playHornThrottled} from "./modules/sound.js";
import {renderGrowth} from "./modules/growth.js";
import {renderShop} from "./modules/shop.js";
import {renderCommunity} from "./modules/community.js";
import {renderGarage} from "./modules/garage.js";

const state=loadState();
ensureRoadChat(state);
ensureNearbyChat(state);
ensureNavigation(state);
ensureConversationUi(state);
ensureRoadInsight(state);
const spatialPanel=document.querySelector("#panelContent");
const contentPanel=document.querySelector("#contentPanel");
const spatialWs=document.querySelector("#spatialWorkspace");
const contentWs=document.querySelector("#contentWorkspace");

/** Spatial: 지도·도로·GRID·공간 대화 / Content: 상점·성장·커뮤니티·대화방·MY */
const SPATIAL_SCREENS=new Set(["nearby","grid"]);
const CONTENT_SCREENS=new Set(["shop","growth","community","chat","my"]);
const CONTENT_TITLES={
  shop:["상점","STORE · 차량·혜택 상품"],
  growth:["성장","PLAY · 레벨·크레딧"],
  community:["커뮤니티","SOCIAL · 게시판"],
  chat:["대화방","SOCIAL · 공간·1:1·일반 대화"],
  my:["MY","내 차량 · 프로필"]
};

let currentScreen=state.currentScreen||"nearby";
let currentView=state.currentView||"near";
let currentWorkspace=SPATIAL_SCREENS.has(currentScreen)?"spatial":"content";
if(currentScreen==="my")currentWorkspace="content";
if(!SPATIAL_SCREENS.has(currentScreen)&&!CONTENT_SCREENS.has(currentScreen)){
  currentScreen="nearby";
  currentWorkspace="spatial";
}

function save(){state.currentScreen=currentScreen;state.currentView=currentView;saveState(state);syncHeader()}
function syncHeader(){document.querySelector("#creditText").textContent=formatCredits(state.credits);document.querySelector("#levelText").textContent=state.level;syncGridHeader(state)}

function restoreSpatialChatUi(){
  const ui=state.spatialChatUi||{};
  if(ui.mode==="direct"&&ui.peerId){
    openChatWith(spatialPanel,state,ui.peerId);
    return;
  }
  if(ui.mode==="grid"&&ui.gridId){
    openGridChat(spatialPanel,state,ui.gridId);
    return;
  }
  if(ui.mode==="road"||currentView==="road"||currentView==="all"){
    renderRoadChatPanel(spatialPanel,state);
    ensureRoadChatDock(state);
    return;
  }
  if(currentScreen==="grid")renderGrid(spatialPanel,state);
  else renderNearby(spatialPanel,state);
}

function setWorkspace(mode){
  const next=mode==="content"?"content":"spatial";
  const prev=currentWorkspace;
  currentWorkspace=next;
  document.body.dataset.workspace=next;

  if(next==="spatial"){
    spatialWs?.classList.remove("workspace-hidden");
    contentWs?.classList.add("workspace-hidden");
    spatialWs?.setAttribute("aria-hidden","false");
    contentWs?.setAttribute("aria-hidden","true");
  }else{
    contentWs?.classList.remove("workspace-hidden");
    spatialWs?.classList.add("workspace-hidden");
    contentWs?.setAttribute("aria-hidden","false");
    spatialWs?.setAttribute("aria-hidden","true");
  }

  if(next==="content"){
    captureRoadChatUi(state);
    pauseRoadVoiceForWorkspace();
    pauseChatVoice();
    pauseRoad();
  }else if(prev==="content"){
    clearWorkspaceVoicePauseFlag();
    requestAnimationFrame(()=>{
      try{
        invalidateMaps();
        if(currentView==="road"||currentView==="all"){
          mountRoadStage(currentView==="all"?"all":"road");
          resumeRoad();
          ensureRoadChatDock(state);
        }else{
          mountRoadStage("road");
          pauseRoad();
        }
        resizeRoad();
        restoreSpatialChatUi();
      }catch(e){console.warn("[VROO] workspace restore",e)}
    });
  }
}

function setContentTitle(name){
  const pair=CONTENT_TITLES[name];
  const titleEl=document.querySelector("#contentWorkspaceTitle");
  const subEl=document.querySelector("#contentWorkspaceSub");
  if(titleEl)titleEl.textContent=pair?pair[0]:"서비스";
  if(subEl)subEl.textContent=pair?pair[1]:"";
}

function setScreen(name){
  if(CONTENT_SCREENS.has(name)){
    setWorkspace("content");
    setContentTitle(name);
  }else{
    if(!SPATIAL_SCREENS.has(name))name="nearby";
    setWorkspace("spatial");
  }

  currentScreen=name;
  document.querySelectorAll("[data-screen]").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));
  if(name==="my"){
    document.querySelectorAll("[data-screen]").forEach(b=>b.classList.remove("active"));
  }

  try{setSpatialGridVisible(name==="grid"&&currentWorkspace==="spatial")}catch(e){console.warn("[VROO] spatial grid visibility",e)}

  const r={
    nearby:()=>{
      if(currentView==="all"){
        renderAllViewSummary(spatialPanel,state);
        ensureRoadChatDock(state);
      }else if(currentView==="road"){
        if(!state.spatialChatUi)state.spatialChatUi={};
        if(state.spatialChatUi.mode!=="direct"&&state.spatialChatUi.mode!=="grid"){
          state.spatialChatUi.mode="road";
          renderRoadChatPanel(spatialPanel,state);
        }
        ensureRoadChatDock(state);
      }else{
        if(state.spatialChatUi)state.spatialChatUi.mode=null;
        renderNearby(spatialPanel,state);
      }
    },
    grid:()=>renderGrid(spatialPanel,state),
    chat:()=>renderRooms(contentPanel,state),
    growth:()=>renderGrowth(contentPanel,state),
    shop:()=>renderShop(contentPanel,state),
    community:()=>renderCommunity(contentPanel,state),
    my:()=>renderGarage(contentPanel,state)
  };
  try{
    r[name]?.();
  }catch(e){
    console.error(e);
    showSystemMessage("화면을 표시하지 못했습니다.");
    const fallback=CONTENT_SCREENS.has(name)?contentPanel:spatialPanel;
    if(fallback)fallback.innerHTML='<div class="card">화면을 다시 선택해 주세요.</div>';
  }
  save();
}

function setView(name){
  currentView=name;
  document.body.dataset.mapView=name;
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  document.querySelectorAll(".view-layer").forEach(x=>x.classList.remove("active"));
  document.querySelector(name==="near"?"#mapView":name==="road"?"#roadView":"#allView").classList.add("active");
  if(currentWorkspace!=="spatial"){
    pauseRoad();
    setMapView(name);
    save();
    return;
  }
  if(name==="road"||name==="all"){
    mountRoadStage(name==="all"?"all":"road");
    startRoad();
    syncRoadChatOnView(state,name);
    syncRoadNavigationHud(state);
    if(currentScreen==="nearby"||!SPATIAL_SCREENS.has(currentScreen)){
      if(!state.spatialChatUi)state.spatialChatUi={};
      if(state.spatialChatUi.mode!=="direct"&&state.spatialChatUi.mode!=="grid"){
        if(name==="all")renderAllViewSummary(spatialPanel,state);
        else{
          state.spatialChatUi.mode="road";
          renderRoadChatPanel(spatialPanel,state);
        }
      }
    }
  }else{
    stopRoad();
    mountRoadStage("road");
    if(currentScreen==="nearby")renderNearby(spatialPanel,state);
  }
  setMapView(name);
  invalidateMaps();
  requestAnimationFrame(()=>{try{resizeRoad()}catch(e){}});
  save();
}

function openSpatialDirect(payload){
  setWorkspace("spatial");
  if(currentView!=="road"&&currentView!=="all"&&currentView!=="near"){
    /* keep view */
  }
  currentScreen="nearby";
  document.querySelectorAll("[data-screen]").forEach(b=>b.classList.toggle("active",b.dataset.screen==="nearby"));
  openChatWith(spatialPanel,state,payload);
  save();
}

function openSpatialGridChat(gridId){
  setWorkspace("spatial");
  currentScreen="grid";
  document.querySelectorAll("[data-screen]").forEach(b=>b.classList.toggle("active",b.dataset.screen==="grid"));
  try{setSpatialGridVisible(true)}catch(e){}
  openGridChat(spatialPanel,state,gridId);
  save();
}

function openRoadConversation(){
  setWorkspace("spatial");
  setView(currentView==="all"?"all":"road");
  currentScreen="nearby";
  document.querySelectorAll("[data-screen]").forEach(b=>b.classList.toggle("active",b.dataset.screen==="nearby"));
  if(!state.spatialChatUi)state.spatialChatUi={};
  state.spatialChatUi.mode="road";
  state.spatialChatUi.peerId=null;
  state.spatialChatUi.gridId=null;
  clearWorkspaceVoicePauseFlag();
  renderRoadChatPanel(spatialPanel,state);
  ensureRoadChatDock(state);
  /* 스크롤·draft는 state.roadChat에서 복원. 마이크는 자동 재활성화하지 않음 */
  save();
}

function createPost(){openModal("새 게시글",`<label>게시판</label><select id="postCat"><option>공지</option><option>자유</option><option>뽐내기</option><option>Q&A</option><option>고객센터</option></select><label>제목</label><input id="postTitle"><label>내용</label><textarea id="postBody" style="min-height:150px"></textarea><label>공개 범위</label><select id="postScope"><option value="all">전체 공개</option><option value="grid">내 GRID</option><option value="500m">주변 500m</option><option value="1km">주변 1km</option><option value="5km">주변 5km</option><option value="private">나만 보기</option></select>`,[{label:"취소",onClick:closeModal},{label:"게시하기",className:"primary",onClick:()=>{const title=document.querySelector("#postTitle").value.trim(),body=document.querySelector("#postBody").value.trim();if(!title||!body)return;state.posts.unshift({id:"p"+Date.now(),category:document.querySelector("#postCat").value,title,body,author:state.profile.nickname,scope:document.querySelector("#postScope").value,createdAt:Date.now(),likes:0,comments:[]});state.communityCategory=document.querySelector("#postCat").value;closeModal();save();setScreen("community")}}])}

on("state:save",save);
on("user:open",payload=>openUserDetail(state,payload));
on("user:profile",payload=>openUserDetail(state,payload));
on("mypage:open",()=>setScreen("my"));
on("garage:openGrowth",()=>setScreen("growth"));
on("workspace:spatialHome",()=>{setScreen("nearby");setView(currentView||"near")});
on("place:open", place => {
  const kind = place.kind || place.type || "place";
  const kindText =
    kind === "landmark" ? "주요 이정표" :
    kind === "road_label" ? "도로 정보" :
    kind === "area_label" ? "지역 정보" :
    "등록지점";
  openModal(
    place.name,
    `<div class="card map-place-detail">
      <div class="muted">${kindText}${place.category ? ` · ${place.category}` : ""}</div>
      <h3>${place.name}</h3>
      <div class="muted">${place.subtitle || "VROO 지명 정보"}</div>
      <p>VROO 자체 지명 레이어에 등록된 장소입니다. 차량 대화와는 별도입니다.</p>
      <div class="muted">위도 ${Number(place.lat).toFixed(5)} · 경도 ${Number(place.lng).toFixed(5)}</div>
      <div class="convo-actions" style="margin-top:10px">
        <button type="button" class="primary" id="placeModalRoute">길찾기</button>
        <button type="button" class="secondary" id="placeModalFav">즐겨찾기</button>
      </div>
    </div>`,
    [{label:"닫기",onClick:closeModal}]
  );
  setTimeout(() => {
    document.querySelector("#placeModalRoute")?.addEventListener("click", () => {
      showSystemMessage("길찾기는 경로 API 연동 후 이용할 수 있습니다.");
    });
    document.querySelector("#placeModalFav")?.addEventListener("click", () => {
      showSystemMessage("즐겨찾기는 로컬 저장 연동 준비 중입니다.");
    });
  }, 0);
});
/** 차량 1:1·공간 대화는 Content로 보내지 않음 */
on("chat:open",payload=>openSpatialDirect(payload));
on("grid:chatOpen",({gridId})=>openSpatialGridChat(gridId));
on("grid:spatialOpen",({gridId})=>{setScreen("grid");openSpatialGridDetail(spatialPanel,state,gridId)});
on("grid:create",()=>beginCreateGrid(spatialPanel,state));
on("roadchat:requestOpen",()=>openRoadConversation());
on("chat:openMenu",()=>setScreen("chat"));
on("chat:openConversation",({conversationId,returnView})=>{
  const ui=ensureConversationUi(state);
  if(returnView)ui.returnView=returnView;
  ui.activeConversationId=conversationId||null;
  setScreen("chat");
  openConversationById(contentPanel,state,conversationId);
});
on("spatialOverlay:changed",()=>{
  try{drawUsers(currentView==="all"?"all":"near")}catch(e){}
  refreshChatBadge(state);
});
on("user:horn",({id})=>{
  try{playHornThrottled(state.hornEnabled)}catch(e){}
  showSystemMessage(id?"빵빵 신호를 보냈습니다. (로컬)":"빵빵");
});
on("roadchat:contentBack",()=>{
  if(currentWorkspace==="content"&&currentScreen==="chat")renderRooms(contentPanel,state);
});
on("roadchat:changed",()=>{
  refreshChatBadge(state);
  if(currentWorkspace==="content"&&currentScreen==="chat"){
    const detail=contentPanel?.querySelector?.("[data-road-content-detail],[data-nearby-content-detail]");
    if(!detail&&!contentPanel?.querySelector?.(".chat-shell"))renderRooms(contentPanel,state);
  }
});
on("roadchat:openPanel",()=>{
  if(currentWorkspace!=="spatial")return;
  if(!state.spatialChatUi)state.spatialChatUi={};
  state.spatialChatUi.mode="road";
  if(state.roadChat){
    if(state.roadChat.dockMode==="collapsed")state.roadChat.dockMode="compact";
    state.roadChat.panelMinimized=false;
  }
  if(currentView==="all")renderAllViewSummary(spatialPanel,state);
  else renderRoadChatPanel(spatialPanel,state);
  ensureRoadChatDock(state);
});
on("spatialChat:back",()=>{
  if(currentWorkspace==="content"){
    const ui=ensureConversationUi(state);
    if(ui.returnView){
      setWorkspace("spatial");
      setView(ui.returnView==="all"||ui.returnView==="road"||ui.returnView==="near"?ui.returnView:"near");
      ui.returnView=null;
      save();
      return;
    }
    renderRooms(contentPanel,state);
    return;
  }
  if(currentView==="all")renderAllViewSummary(spatialPanel,state);
  else if(currentView==="road")openRoadConversation();
  else if(currentScreen==="grid")renderGrid(spatialPanel,state);
  else renderNearby(spatialPanel,state);
});
on("post:create",createPost);
on("post:view",p=>openModal(p.title,`<div class="card"><b>${p.author}</b><div class="muted">${p.scope}</div><p>${p.body}</p></div>`,[{label:"닫기",onClick:closeModal}]));
on("map:rotate",d=>{state.mapBearing=(state.mapBearing+d+360)%360;rotateMap(state.mapBearing);save()});
on("map:north",()=>{state.mapBearing=0;rotateMap(0);save()});

document.querySelectorAll("[data-screen]").forEach(b=>b.onclick=()=>setScreen(b.dataset.screen));
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelector("#homeButton").onclick=()=>{setScreen("nearby");setView("near")};
document.querySelector("#myPageButton").onclick=()=>setScreen("my");
document.querySelector("#modalClose").onclick=closeModal;
document.querySelector("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
document.querySelector("#environmentSelect").onchange=e=>setEnvironment(e.target.value);
document.querySelector("#gridSelector").onclick=()=>setScreen("grid");

(function boot(){
  try{
    bindRoadChatBoot();
    try{initMap(state)}catch(e){console.error(e);showSystemMessage(e.message||"지도를 불러오지 못했습니다. 나머지 기능은 사용할 수 있습니다.")}
    try{initRoad(state,getUsers())}catch(e){console.error(e);showSystemMessage(e.message||"도로 모드를 불러오지 못했습니다. 지도와 패널은 사용할 수 있습니다.")}
    rotateMap(state.mapBearing||0);
    syncHeader();
    refreshChatBadge(state);
    setScreen(currentScreen);
    if(currentWorkspace==="spatial")setView(currentView);
    else{
      document.body.dataset.mapView=currentView;
      pauseRoad();
    }
    if(navigator.geolocation){
      navigator.geolocation.watchPosition(
        p=>{
          const loc={lat:p.coords.latitude,lng:p.coords.longitude};
          setLocation(loc);
          const gpsEl=document.querySelector("#gpsStatus");
          if(gpsEl)gpsEl.textContent=`GPS 연결 · 오차 ${Math.round(p.coords.accuracy)}m`;
          save();
        },
        ()=>{
          const gpsEl=document.querySelector("#gpsStatus");
          if(gpsEl)gpsEl.textContent="GPS 미허용 · 예시 위치";
        },
        {enableHighAccuracy:true,maximumAge:4000,timeout:10000}
      );
    }
    window.__VROO_BOOT_OK=true;
    setTimeout(()=>document.querySelector("#boot")?.classList.add("hidden"),300);
    setTimeout(()=>document.querySelector("#boot")?.remove(),700);
  }catch(e){
    console.error(e);
    showSystemMessage(e.message||"앱을 시작하지 못했습니다.");
  }
})();

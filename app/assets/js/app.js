
import {loadState,saveState,GRID_CREATE_COST,formatCredits,canAfford,spendCredits} from "./core/storage.js";
import {on} from "./core/events.js";
import {showSystemMessage,openModal,closeModal} from "./core/ui.js";
import {initMap,setLocation,setMapView,invalidateMaps,rotateMap,getUsers} from "./modules/map.js";
import {initRoad,startRoad,stopRoad,setEnvironment} from "./modules/road.js";
import {renderNearby} from "./modules/nearby.js";
import {renderGrid} from "./modules/grid.js";
import {renderRooms,openChatWith} from "./modules/chat.js";
import {renderGrowth} from "./modules/growth.js";
import {renderShop} from "./modules/shop.js";
import {renderCommunity} from "./modules/community.js";
import {openMyPage,openUserProfile} from "./modules/profile.js";
const state=loadState(),panel=document.querySelector("#panelContent");
let currentScreen=state.currentScreen||"nearby",currentView=state.currentView||"near";
function save(){state.currentScreen=currentScreen;state.currentView=currentView;saveState(state);syncHeader()}
function syncHeader(){document.querySelector("#creditText").textContent=formatCredits(state.credits);document.querySelector("#levelText").textContent=state.level;document.querySelector("#gridSelector").textContent=`${state.currentGrid} ▼`}
function setScreen(name){currentScreen=name;document.querySelectorAll("[data-screen]").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));const r={nearby:()=>renderNearby(panel,state),grid:()=>renderGrid(panel,state),chat:()=>renderRooms(panel,state),growth:()=>renderGrowth(panel,state),shop:()=>renderShop(panel,state),community:()=>renderCommunity(panel,state)};try{r[name]?.()}catch(e){console.error(e);showSystemMessage("화면을 표시하지 못했습니다.");panel.innerHTML='<div class="card">화면을 다시 선택해 주세요.</div>'}save()}
function setView(name){currentView=name;document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));document.querySelectorAll(".view-layer").forEach(x=>x.classList.remove("active"));document.querySelector(name==="near"?"#mapView":name==="road"?"#roadView":"#allView").classList.add("active");if(name==="road")startRoad();else stopRoad();setMapView(name);invalidateMaps();save()}
function createGrid(){
  let busy=false;
  openModal(
    "새 GRID 만들기",
    `<label>GRID 이름</label><input id="newGridName"><label>유형</label><select><option>공개 GRID</option><option>비공개 GRID</option><option>차량모임 GRID</option><option>이벤트 GRID</option></select><div class="card"><b>예상 비용</b><div>🪙 ${formatCredits(GRID_CREATE_COST)}</div></div>`,
    [
      {label:"취소",onClick:closeModal},
      {label:"생성",className:"primary",onClick:()=>{
        if(busy)return;
        const n=document.querySelector("#newGridName").value.trim();
        if(!n){showSystemMessage("GRID 이름을 입력해 주세요.");return;}
        if(!canAfford(state,GRID_CREATE_COST)){
          showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(GRID_CREATE_COST)})`);
          return;
        }
        busy=true;
        const paid=spendCredits(state,GRID_CREATE_COST);
        if(!paid.ok){
          busy=false;
          showSystemMessage(`크레딧이 부족합니다. (필요 ${formatCredits(GRID_CREATE_COST)})`);
          return;
        }
        state.joinedGrids.push(n);
        state.currentGrid=n;
        closeModal();
        save();
        setScreen("grid");
      }}
    ]
  );
}
function createPost(){openModal("새 게시글",`<label>게시판</label><select id="postCat"><option>공지</option><option>자유</option><option>뽐내기</option><option>Q&A</option><option>고객센터</option></select><label>제목</label><input id="postTitle"><label>내용</label><textarea id="postBody" style="min-height:150px"></textarea><label>공개 범위</label><select id="postScope"><option value="all">전체 공개</option><option value="grid">내 GRID</option><option value="500m">주변 500m</option><option value="1km">주변 1km</option><option value="5km">주변 5km</option><option value="private">나만 보기</option></select>`,[{label:"취소",onClick:closeModal},{label:"게시하기",className:"primary",onClick:()=>{const title=document.querySelector("#postTitle").value.trim(),body=document.querySelector("#postBody").value.trim();if(!title||!body)return;state.posts.unshift({id:"p"+Date.now(),category:document.querySelector("#postCat").value,title,body,author:state.profile.nickname,scope:document.querySelector("#postScope").value,createdAt:Date.now(),likes:0,comments:[]});state.communityCategory=document.querySelector("#postCat").value;closeModal();save();setScreen("community")}}])}
on("state:save",save);on("user:profile",openUserProfile);
on("place:open", place => openModal(
  place.name,
  `<div class="card">
    <div style="font-size:38px">${place.icon || "📍"}</div>
    <h3>${place.name}</h3>
    <div class="muted">${place.subtitle || "VROO 지명 정보"}</div>
    <p>VROO 자체 지명 레이어에 등록된 장소입니다.</p>
    <div class="muted">위도 ${place.lat.toFixed(5)} · 경도 ${place.lng.toFixed(5)}</div>
  </div>`,
  [{label:"닫기",onClick:closeModal}]
));on("chat:open",u=>{setScreen("chat");openChatWith(panel,state,u)});on("grid:create",createGrid);on("post:create",createPost);on("post:view",p=>openModal(p.title,`<div class="card"><b>${p.author}</b><div class="muted">${p.scope}</div><p>${p.body}</p></div>`,[{label:"닫기",onClick:closeModal}]));on("map:rotate",d=>{state.mapBearing=(state.mapBearing+d+360)%360;rotateMap(state.mapBearing);save()});on("map:north",()=>{state.mapBearing=0;rotateMap(0);save()});
document.querySelectorAll("[data-screen]").forEach(b=>b.onclick=()=>setScreen(b.dataset.screen));document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelector("#homeButton").onclick=()=>{setScreen("nearby");setView("near")};document.querySelector("#myPageButton").onclick=()=>openMyPage(state);document.querySelector("#modalClose").onclick=closeModal;document.querySelector("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};document.querySelector("#environmentSelect").onchange=e=>setEnvironment(e.target.value);document.querySelector("#gridSelector").onclick=()=>setScreen("grid");
(function boot(){
  try{
    try{initMap(state)}catch(e){console.error(e);showSystemMessage(e.message||"지도를 불러오지 못했습니다. 나머지 기능은 사용할 수 있습니다.")}
    try{initRoad(state,getUsers())}catch(e){console.error(e);showSystemMessage(e.message||"도로 모드를 불러오지 못했습니다. 지도와 패널은 사용할 수 있습니다.")}
    rotateMap(state.mapBearing||0);
    syncHeader();
    setScreen(currentScreen);
    setView(currentView);
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
    showSystemMessage(e.message||"초기화 오류가 발생했습니다.");
    document.querySelector("#boot")?.classList.add("hidden");
  }
})();
window.addEventListener("beforeunload",save);

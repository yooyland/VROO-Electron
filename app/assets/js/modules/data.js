export const cars=[["sport","스포츠카","🏎️"],["sedan","세단","🚗"],["suv","SUV","🚙"],["taxi","택시","🚕"],["van","밴","🚐"],["truck","픽업","🛻"],["bus","미니버스","🚎"],["delivery","배송차","🚚"],["classic","클래식","🚘"]];
const names=["별빛드라이버","도로위여우","노란번개","서울라이더","바람소리","달리는곰","안전제일","푸른고래","밤길친구","커피트럭","행복운전","구름택시"];

/** 내 계정 id (채팅 senderId "me"와 동일) */
export const MY_USER_ID = "me";

export function carInfo(id){
  const f=cars.find(x=>x[0]===id)||cars[0];
  return{id:f[0],name:f[1],emoji:f[2]};
}

function offsetLatLng(center,index){
  const a=index*.78;
  const d=100+(index%8)*115;
  const cos=Math.cos(center.lat*Math.PI/180)||1;
  return{
    lat:center.lat+(Math.sin(a)*d)/111320,
    lng:center.lng+(Math.cos(a)*d)/(111320*cos)
  };
}

export function makeDemoUsers(center){
  return Array.from({length:24},(_,i)=>{
    const pos=offsetLatLng(center,i);
    return{
      id:`u${i}`,
      nickname:names[i%names.length]+(i>=names.length?"2":""),
      plate:`${11+(i%8)*11}가 ${1000+i*173}`,
      car:cars[(i+1)%cars.length][0],
      level:1+(i*7)%45,
      online:i%5!==0,
      lat:pos.lat,
      lng:pos.lng
    };
  });
}

export function updateDemoUserPositions(users,center){
  if(!Array.isArray(users)||!users.length)return makeDemoUsers(center);
  for(let i=0;i<users.length;i++){
    const pos=offsetLatLng(center,i);
    users[i].lat=pos.lat;
    users[i].lng=pos.lng;
  }
  return users;
}

/** 시드 GRID — id가 고유키, name은 표시용 */
export const SEED_GRIDS = [
  {id:"g_my",name:"MY GRID",ownerId:MY_USER_ID,memberIds:[MY_USER_ID],people:42,mine:true,visibility:"public",ad:false,radiusM:800},
  {id:"g_gangnam",name:"강남 드라이브",ownerId:"vroo",memberIds:[],people:318,visibility:"public",ad:false,radiusM:1200},
  {id:"g_safe",name:"안전운전",ownerId:"vroo",memberIds:[],people:205,visibility:"public",ad:false,radiusM:900},
  {id:"g_night",name:"야간 드라이브",ownerId:"vroo",memberIds:[],people:94,visibility:"public",ad:false,radiusM:1000},
  {id:"g_event",name:"VROO 공식 이벤트",ownerId:"vroo",memberIds:[],people:522,visibility:"public",ad:true,radiusM:1500},
  {id:"g_insure",name:"자동차 보험 혜택",ownerId:"vroo",memberIds:[],people:180,visibility:"public",ad:true,radiusM:900}
];

/** 구버전 joinedGrids/currentGrid 이름 → id */
export const GRID_LEGACY_NAME_TO_ID = {
  "MY GRID": "g_my",
  "강남 드라이브": "g_gangnam",
  "안전운전": "g_safe",
  "야간 드라이브": "g_night",
  "VROO 공식 이벤트": "g_event",
  "자동차 보험 혜택": "g_insure"
};

/** @deprecated 표시 호환 — SEED_GRIDS 사용 권장 */
export const grids = SEED_GRIDS.map(g => ({id: g.id, name: g.name, people: g.people, mine: g.mine, ad: g.ad}));

export function gridChatRoomId(gridId) {
  return `grid:${gridId}`;
}

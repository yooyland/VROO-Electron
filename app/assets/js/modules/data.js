export const cars=[["sport","스포츠카","🏎️"],["sedan","세단","🚗"],["suv","SUV","🚙"],["taxi","택시","🚕"],["van","밴","🚐"],["truck","픽업","🛻"],["bus","미니버스","🚎"],["delivery","배송차","🚚"],["classic","클래식","🚘"]];
const names=["별빛드라이버","도로위여우","노란번개","서울라이더","바람소리","달리는곰","안전제일","푸른고래","밤길친구","커피트럭","행복운전","구름택시"];

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

/** 최초 데모 사용자 목록 생성 (고정 id: u0…) */
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

/**
 * 기존 사용자 객체를 유지한 채 위치만 갱신 (동일 배열·동일 id 참조).
 * 목록이 비어 있으면 makeDemoUsers로 생성.
 */
export function updateDemoUserPositions(users,center){
  if(!Array.isArray(users)||!users.length)return makeDemoUsers(center);
  for(let i=0;i<users.length;i++){
    const pos=offsetLatLng(center,i);
    users[i].lat=pos.lat;
    users[i].lng=pos.lng;
  }
  return users;
}

export const grids=[{id:"MY GRID",people:42,mine:true},{id:"강남 드라이브",people:318},{id:"안전운전",people:205},{id:"야간 드라이브",people:94},{id:"VROO 공식 이벤트",people:522,ad:true},{id:"자동차 보험 혜택",people:180,ad:true}];

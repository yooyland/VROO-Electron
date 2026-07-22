import {emit} from "../core/events.js";

const categories=["공지","자유","뽐내기","Q&A","고객센터"];

const SEED_POSTS=[
  {id:"p1",category:"공지",title:"VROO 1.1.0-beta.1 이용 안내",body:"안전운전과 상호 존중을 지켜주세요.",author:"VROO 운영팀",scope:"all",createdAt:Date.now()-3600000,likes:12,comments:[]},
  {id:"p2",category:"자유",title:"오늘 도심 교통이 혼잡합니다",body:"안전거리 유지하세요.",author:"도로위여우",scope:"all",createdAt:Date.now()-7200000,likes:8,comments:[]}
];

function seed(state){
  if(!Array.isArray(state.posts))state.posts=[];
  const ids=new Set(state.posts.map(p=>p&&p.id).filter(Boolean));
  let added=false;
  for(const post of SEED_POSTS){
    if(ids.has(post.id))continue;
    state.posts.push({...post,comments:Array.isArray(post.comments)?[...post.comments]:[]});
    ids.add(post.id);
    added=true;
  }
  if(added)emit("state:save");
}

export function renderCommunity(panel,state){
  seed(state);
  const current=state.communityCategory||"공지";
  const posts=state.posts.filter(p=>p.category===current);
  panel.innerHTML=`<div class="tabs">${categories.map(c=>`<button class="${c===current?"active":""}" data-cat="${c}">${c}</button>`).join("")}</div><div class="tabs"><button class="active">최신</button><button>HOT</button><button>전체</button><button>내 글</button></div><div>${posts.map(p=>`<div class="card post-row"><div class="avatar">📝</div><div><b>${p.title}</b><div class="muted">${p.body}</div></div><button class="secondary" data-post="${p.id}">보기</button></div>`).join("")||'<div class="card muted">게시글이 없습니다.</div>'}</div><button class="fab" id="newPost">＋</button>`;
  panel.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{state.communityCategory=b.dataset.cat;emit("state:save");renderCommunity(panel,state)});
  panel.querySelector("#newPost").onclick=()=>emit("post:create");
  panel.querySelectorAll("[data-post]").forEach(b=>b.onclick=()=>emit("post:view",state.posts.find(p=>p.id===b.dataset.post)));
}

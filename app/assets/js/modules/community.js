import {emit} from "../core/events.js";

const categories = ["공지", "자유", "뽐내기", "Q&A", "고객센터"];

const SORT_OPTIONS = [
  {id: "latest", label: "최신순"},
  {id: "hot", label: "HOT순"}
];
const AUTHOR_OPTIONS = [
  {id: "all", label: "전체 글"},
  {id: "mine", label: "내 글"}
];

let docListenersBound = false;
let openDropdownId = null;
let activePanel = null;

const SEED_POSTS = [
  {
    id: "p1",
    category: "공지",
    title: "VROO 1.1.0-beta.1 이용 안내",
    body: "안전운전과 상호 존중을 지켜주세요.",
    author: "VROO 운영팀",
    scope: "all",
    createdAt: Date.now() - 3600000,
    likes: 12,
    comments: []
  },
  {
    id: "p2",
    category: "자유",
    title: "오늘 도심 교통이 혼잡합니다",
    body: "안전거리 유지하세요.",
    author: "도로위여우",
    scope: "all",
    createdAt: Date.now() - 7200000,
    likes: 8,
    comments: []
  }
];

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function seed(state) {
  if (!Array.isArray(state.posts)) state.posts = [];
  const ids = new Set(state.posts.map(p => p && p.id).filter(Boolean));
  let added = false;
  for (const post of SEED_POSTS) {
    if (ids.has(post.id)) continue;
    state.posts.push({
      ...post,
      comments: Array.isArray(post.comments) ? [...post.comments] : []
    });
    ids.add(post.id);
    added = true;
  }
  if (added) emit("state:save");
}

function resolveFilters(state) {
  const category = categories.includes(state.communityCategory)
    ? state.communityCategory
    : "공지";
  const sortMode = state.communitySortMode === "hot" ? "hot" : "latest";
  const authorScope = state.communityAuthorScope === "mine" ? "mine" : "all";
  state.communityCategory = category;
  state.communitySortMode = sortMode;
  state.communityAuthorScope = authorScope;
  return {category, sortMode, authorScope};
}

function optionButtonLabel(sortMode, authorScope) {
  const sortText = sortMode === "hot" ? "HOT순" : "최신순";
  if (authorScope === "mine") return `${sortText} · 내 글`;
  return sortText;
}

function closeAllDropdowns() {
  openDropdownId = null;
  if (!activePanel) return;
  activePanel.querySelectorAll(".community-dropdown").forEach(el => {
    el.classList.remove("open");
    const btn = el.querySelector(".community-dropdown-toggle");
    if (btn) btn.setAttribute("aria-expanded", "false");
    const menu = el.querySelector(".community-dropdown-menu");
    if (menu) menu.hidden = true;
  });
}

function toggleDropdown(id) {
  if (!activePanel) return;
  const root = activePanel.querySelector(`[data-dropdown="${id}"]`);
  if (!root) return;
  const willOpen = !root.classList.contains("open");
  closeAllDropdowns();
  if (!willOpen) return;
  openDropdownId = id;
  root.classList.add("open");
  const btn = root.querySelector(".community-dropdown-toggle");
  if (btn) btn.setAttribute("aria-expanded", "true");
  const menu = root.querySelector(".community-dropdown-menu");
  if (menu) menu.hidden = false;
}

function bindDocListenersOnce() {
  if (docListenersBound) return;
  docListenersBound = true;
  document.addEventListener("click", e => {
    if (!activePanel || !openDropdownId) return;
    if (activePanel.contains(e.target) && e.target.closest?.(".community-dropdown")) return;
    closeAllDropdowns();
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!openDropdownId) return;
    closeAllDropdowns();
  });
}

function filterPosts(state, category, sortMode, authorScope) {
  let posts = (state.posts || []).filter(p => p && p.category === category);
  if (authorScope === "mine") {
    const me = state.profile?.nickname || "";
    posts = posts.filter(p => p.author === me);
  }
  posts = [...posts];
  if (sortMode === "hot") {
    posts.sort((a, b) => (b.likes || 0) - (a.likes || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  } else {
    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  return posts;
}

function boardMenuHtml(current) {
  return categories
    .map(c => {
      const active = c === current;
      return `<button type="button" class="community-menu-item${active ? " active" : ""}" role="menuitem" data-cat="${escapeHtml(c)}" ${active ? 'aria-current="true"' : ""}>${active ? "✓ " : ""}${escapeHtml(c)}</button>`;
    })
    .join("");
}

function optionMenuHtml(sortMode, authorScope) {
  const sortGroup = SORT_OPTIONS.map(o => {
    const active = o.id === sortMode;
    return `<button type="button" class="community-menu-item${active ? " active" : ""}" role="menuitemradio" data-sort="${o.id}" ${active ? 'aria-checked="true"' : 'aria-checked="false"'}>${active ? "✓ " : ""}${o.label}</button>`;
  }).join("");
  const authorGroup = AUTHOR_OPTIONS.map(o => {
    const active = o.id === authorScope;
    return `<button type="button" class="community-menu-item${active ? " active" : ""}" role="menuitemradio" data-author="${o.id}" ${active ? 'aria-checked="true"' : 'aria-checked="false"'}>${active ? "✓ " : ""}${o.label}</button>`;
  }).join("");
  return `<div class="community-menu-group"><div class="community-menu-label">정렬</div>${sortGroup}</div><div class="community-menu-group"><div class="community-menu-label">글 범위</div>${authorGroup}</div>`;
}

function postListHtml(posts) {
  if (!posts.length) return '<div class="card muted">게시글이 없습니다.</div>';
  return posts
    .map(
      p => `<div class="card post-row"><div class="avatar">📝</div><div><b>${escapeHtml(p.title)}</b><div class="muted">${escapeHtml(p.body)}</div></div><button type="button" class="secondary" data-post="${escapeHtml(p.id)}">보기</button></div>`
    )
    .join("");
}

export function renderCommunity(panel, state) {
  seed(state);
  bindDocListenersOnce();
  activePanel = panel;
  openDropdownId = null;

  const {category, sortMode, authorScope} = resolveFilters(state);
  const posts = filterPosts(state, category, sortMode, authorScope);
  const boardBtn = category;
  const optionBtn = optionButtonLabel(sortMode, authorScope);

  panel.innerHTML = `<div class="community-filterbar">
  <div class="community-dropdown board-dropdown" data-dropdown="board">
    <button type="button" class="community-dropdown-toggle" aria-haspopup="menu" aria-expanded="false" data-toggle="board">
      <span class="community-dropdown-text">${escapeHtml(boardBtn)}</span>
      <span class="community-dropdown-caret" aria-hidden="true">▼</span>
    </button>
    <div class="community-dropdown-menu" role="menu" hidden data-menu="board">
      ${boardMenuHtml(category)}
    </div>
  </div>
  <div class="community-dropdown option-dropdown" data-dropdown="option">
    <button type="button" class="community-dropdown-toggle" aria-haspopup="menu" aria-expanded="false" data-toggle="option">
      <span class="community-dropdown-text">${escapeHtml(optionBtn)}</span>
      <span class="community-dropdown-caret" aria-hidden="true">▼</span>
    </button>
    <div class="community-dropdown-menu community-dropdown-menu-end" role="menu" hidden data-menu="option">
      ${optionMenuHtml(sortMode, authorScope)}
    </div>
  </div>
</div>
<div class="community-post-list">${postListHtml(posts)}</div>
<button type="button" class="fab" id="newPost">＋</button>`;

  panel.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      toggleDropdown(btn.dataset.toggle);
    };
  });

  panel.querySelectorAll("[data-cat]").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      state.communityCategory = btn.dataset.cat;
      emit("state:save");
      renderCommunity(panel, state);
    };
  });

  panel.querySelectorAll("[data-sort]").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      state.communitySortMode = btn.dataset.sort === "hot" ? "hot" : "latest";
      emit("state:save");
      renderCommunity(panel, state);
    };
  });

  panel.querySelectorAll("[data-author]").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      state.communityAuthorScope = btn.dataset.author === "mine" ? "mine" : "all";
      emit("state:save");
      renderCommunity(panel, state);
    };
  });

  panel.querySelector("#newPost").onclick = () => emit("post:create");
  panel.querySelectorAll("[data-post]").forEach(btn => {
    btn.onclick = () =>
      emit(
        "post:view",
        state.posts.find(p => p.id === btn.dataset.post)
      );
  });
}

import { getRole } from "../../../shared/config/roles.js";
import { CONSOLE_NAV_GROUPS } from "../../../shared/config/console-navigation.js";
import { getVisibleNavItems } from "../../../shared/config/console-navigation.js";
import { filterNavByPermissions } from "../../../shared/utils/permission.js";
import { escapeHtml } from "../../../shared/utils/format.js";
import { getDevelopmentAccounts } from "../../../shared/data/demo-accounts.js";
import {
  loadSession,
  saveSessionForAccount,
  switchActiveRole,
  logout,
  loadSavedRoute,
  loadNavCollapse,
  saveNavCollapse,
  getAssignedRoleOptions
} from "./console-auth.js";
import { resetAccountsToSeed } from "./account-store.js";
import { bindModalChrome, toast, openModal, closeModal, formatDateTimeKo, confirmDialog } from "./console-ui.js";
import { navigate } from "./console-router.js";
import { iconSvg } from "./console-icons.js";
import { getNavItemByRoute } from "../../../shared/config/console-navigation.js";

console.log("Console App Started");

const ctx = { session: null, route: null };
const PAGE_META = {
  dashboard: { title: "Dashboard", crumb: "개요" },
  users: { title: "회원 관리", crumb: "운영 관리" },
  vehicles: { title: "차량 관리", crumb: "운영 관리" },
  grids: { title: "GRID 관리", crumb: "운영 관리" },
  moderation: { title: "커뮤니티·신고", crumb: "운영 관리" },
  notifications: { title: "공지·알림", crumb: "운영 관리" },
  products: { title: "상품 관리", crumb: "커머스" },
  benefits: { title: "혜택·쿠폰", crumb: "커머스" },
  memberships: { title: "멤버십", crumb: "커머스" },
  orders: { title: "주문·이용 내역", crumb: "커머스" },
  settlements: { title: "정산 관리", crumb: "커머스" },
  partners: { title: "제휴사", crumb: "제휴사" },
  support: { title: "고객 문의", crumb: "고객지원" },
  incidents: { title: "사고 접수", crumb: "고객지원" },
  analytics: { title: "통계", crumb: "분석" },
  system: { title: "시스템 상태", crumb: "시스템" },
  accounts: { title: "계정·역할 관리", crumb: "시스템" },
  permissions: { title: "권한 정보", crumb: "시스템" }
};

function loginAsAccount(accountId) {
  ctx.session = saveSessionForAccount(accountId);
  mountShell();
  go(ctx.session.defaultRoute);
  toast(`${ctx.session.displayName} 접속`);
}

function showLogin() {
  document.body.dataset.consoleView = "login";
  const app = document.getElementById("consoleApp");
  const devAccounts = getDevelopmentAccounts();
  app.innerHTML = `
    <section class="login-screen" aria-label="로그인">
      <div class="login-layout">
        <div class="login-card">
          <div class="login-brand-block">
            <div class="brand-name">VROO <span>CONSOLE</span></div>
            <div class="brand-sub">Mobility Operations</div>
          </div>
          <h1>운영 계정 로그인</h1>
          <p class="muted">조직 운영 콘솔에 접속합니다.</p>
          <div class="login-field">
            <label for="loginId">이메일 또는 운영 ID</label>
            <input id="loginId" type="text" autocomplete="username" placeholder="name@organization">
          </div>
          <div class="login-field">
            <label for="loginPw">비밀번호</label>
            <input id="loginPw" type="password" autocomplete="current-password" placeholder="••••••••">
          </div>
          <div class="login-row">
            <label><input type="checkbox" id="loginKeep"> 로그인 유지</label>
            <span>비밀번호 찾기 · 관리자 문의</span>
          </div>
          <div class="login-actions">
            <button type="button" class="btn primary" id="loginSubmit">로그인</button>
          </div>
          <p class="login-note" id="loginError" hidden></p>
          <p class="login-note">서버 인증 연동 전입니다. 비밀번호 검증은 수행되지 않습니다. 아래 Development access에서 테스트 계정을 선택하세요.</p>
        </div>
        <details class="dev-access">
          <summary>Development access</summary>
          <p class="muted" style="margin:8px 0 10px;font-size:12px">테스트 계정을 선택합니다. 역할이 아니라 계정 단위로 접속합니다.</p>
          <div class="dev-role-list">
            ${devAccounts.map((a) => `
              <button type="button" class="dev-role-btn" data-account="${escapeHtml(a.id)}">
                <b>${escapeHtml(a.displayName)}</b>
                <span>${escapeHtml(a.devLabel)} · ${escapeHtml(a.email)}</span>
              </button>`).join("")}
          </div>
        </details>
      </div>
    </section>`;

  document.getElementById("loginSubmit").onclick = () => {
    const err = document.getElementById("loginError");
    err.hidden = false;
    err.textContent = "서버 인증이 연결되지 않았습니다. Development access에서 테스트 계정을 선택하세요.";
  };

  app.querySelectorAll("[data-account]").forEach((btn) => {
    btn.onclick = () => {
      try {
        loginAsAccount(btn.dataset.account);
      } catch (e) {
        toast(e.message || "접속 실패", "error");
      }
    };
  });
}

function buildNavHtml(session, activeRoute) {
  const allowed = filterNavByPermissions(getVisibleNavItems(), session);
  const collapse = loadNavCollapse();
  const activeItem = getNavItemByRoute(activeRoute);
  const activeGroup = activeItem?.group;

  return CONSOLE_NAV_GROUPS.map((g) => {
    const items = allowed.filter((i) => i.group === g.id);
    if (!items.length) return "";
    const collapsed = collapse[g.id] === true && g.id !== activeGroup;
    return `
      <div class="nav-group ${collapsed ? "collapsed" : ""}" data-group="${escapeHtml(g.id)}">
        <button type="button" class="nav-group-toggle" aria-expanded="${collapsed ? "false" : "true"}" data-group-toggle="${escapeHtml(g.id)}">
          <span>${escapeHtml(g.label)}</span>
          <span class="chev">${iconSvg("chevron", 14)}</span>
        </button>
        <div class="nav-group-items">
          ${items.map((i) => `
            <button type="button" class="console-nav-link ${i.route === activeRoute ? "active" : ""}" data-route="${escapeHtml(i.route)}" aria-label="${escapeHtml(i.label)}" ${i.route === activeRoute ? 'aria-current="page"' : ""}>
              ${iconSvg(i.icon, 18)}
              <span class="nav-label">${escapeHtml(i.label)}</span>
            </button>`).join("")}
        </div>
      </div>`;
  }).join("");
}

function updateTopbar(route) {
  const meta = PAGE_META[route] || { title: "Console", crumb: "VROO" };
  const crumb = document.getElementById("topbarCrumb");
  const title = document.getElementById("topbarTitle");
  if (crumb) crumb.textContent = `VROO Console / ${meta.crumb}`;
  if (title) title.textContent = meta.title;
}

function go(route) {
  navigate(route, ctx);
  updateTopbar(route);
  const nav = document.getElementById("consoleNav");
  if (nav && ctx.session) {
    nav.innerHTML = buildNavHtml(ctx.session, route);
    bindNav(nav);
  }
}

function bindNav(nav) {
  nav.querySelectorAll("[data-route]").forEach((btn) => {
    btn.onclick = () => go(btn.dataset.route);
  });
  nav.querySelectorAll("[data-group-toggle]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.groupToggle;
      const group = nav.querySelector(`[data-group="${id}"]`);
      if (!group) return;
      group.classList.toggle("collapsed");
      const open = !group.classList.contains("collapsed");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      const map = loadNavCollapse();
      map[id] = !open;
      saveNavCollapse(map);
    };
  });
}

function openRoleSwitchModal() {
  const s = ctx.session;
  const options = getAssignedRoleOptions(s);
  openModal({
    title: "역할 전환",
    bodyHtml: `
      <p class="muted">현재 계정에 부여된 역할만 선택할 수 있습니다.</p>
      <div class="role-switch-list" role="listbox" aria-label="보유 역할">
        ${options.map((r) => `
          <button type="button" class="role-switch-item ${r.active ? "is-active" : ""}" data-role-pick="${escapeHtml(r.id)}" ${r.active ? "disabled" : ""}>
            <div class="rsi-top">
              <b>${escapeHtml(r.label)}</b>
              ${r.active ? `<span class="status-badge status-ok">사용 중</span>` : ""}
            </div>
            <div class="rsi-desc">${escapeHtml(r.description || "")}</div>
            <div class="rsi-org muted">${escapeHtml(r.organizationName || s.organizationName || "")}</div>
          </button>`).join("")}
      </div>`,
    actions: [{ label: "닫기", onClick: closeModal }]
  });

  document.querySelectorAll("[data-role-pick]").forEach((btn) => {
    btn.onclick = () => {
      const nextId = btn.dataset.rolePick;
      const nextLabel = getRole(nextId)?.label || nextId;
      closeModal();
      confirmDialog({
        title: "역할 전환 확인",
        message: `활성 역할을 ${nextLabel}(으)로 전환하시겠습니까?\n메뉴와 접근 권한이 해당 역할 기준으로 변경됩니다.`,
        onConfirm: () => {
          const res = switchActiveRole(ctx.session, nextId);
          if (!res.ok) {
            toast(res.message || "전환할 수 없습니다.", "error");
            return;
          }
          ctx.session = res.session;
          mountShell();
          go(ctx.session.defaultRoute);
          toast(`${ctx.session.label} 역할로 전환되었습니다.`);
        }
      });
    };
  });
}

let shellDocHandlersBound = false;

function mountShell() {
  document.body.dataset.consoleView = "shell";
  document.body.classList.remove("sidebar-collapsed");
  const s = ctx.session;
  const initial = (s.displayName || "?").slice(0, 1);
  const isDev = s.environment === "development";
  const lastLogin = formatDateTimeKo(s.lastLoginAt);
  const canSwitchRole = (s.assignedRoles || []).length >= 2;
  const app = document.getElementById("consoleApp");
  app.innerHTML = `
    <div class="console-shell">
      <header class="console-topbar">
        <button type="button" class="icon-btn" id="sidebarToggle" aria-label="메뉴 접기/펼치기">${iconSvg("menu", 18)}</button>
        <div class="topbar-left">
          <div class="topbar-crumb" id="topbarCrumb">VROO Console</div>
          <h1 class="topbar-title" id="topbarTitle">Dashboard</h1>
        </div>
        <div class="topbar-right">
          <button type="button" class="icon-btn" id="notifyBtn" aria-label="알림">${iconSvg("bell", 18)}</button>
          <div class="account-wrap">
            <button type="button" class="account-trigger" id="accountBtn" aria-haspopup="menu" aria-expanded="false" aria-label="계정 메뉴">
              <span class="account-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
              <span class="account-text">
                <b>${escapeHtml(s.displayName)}</b>
                <span>${escapeHtml(s.label)}</span>
                <span class="account-org">${escapeHtml(s.organizationName)}</span>
              </span>
            </button>
            <div class="account-menu" id="accountMenu" role="menu" hidden>
              <div class="account-menu-head">
                <b>${escapeHtml(s.displayName)}</b>
                <span>현재 역할: ${escapeHtml(s.label)}</span>
                <span>${escapeHtml(s.organizationName)}</span>
              </div>
              <button type="button" data-acc="profile" role="menuitem">내 정보</button>
              <button type="button" data-acc="perms" role="menuitem">권한 정보</button>
              <button type="button" data-acc="env" role="menuitem">운영 환경</button>
              <div class="sep"></div>
              <div class="account-menu-note muted">현재 역할 · ${escapeHtml(s.label)}</div>
              ${canSwitchRole ? `<button type="button" data-acc="role-switch" role="menuitem">역할 전환</button>` : ""}
              <div class="sep"></div>
              ${isDev ? `
              <div class="dev-block" role="group" aria-label="개발 도구">
                <div class="dev-label">Development</div>
                <button type="button" data-acc="dev-accounts" role="menuitem">테스트 계정 전환</button>
                <button type="button" data-acc="dev-reset" role="menuitem">데이터 초기화</button>
              </div>
              <div class="sep"></div>` : ""}
              <button type="button" data-acc="logout" role="menuitem">로그아웃</button>
            </div>
          </div>
        </div>
      </header>
      <div class="console-body">
        <aside class="console-sidebar" id="consoleSidebar" aria-label="콘솔 메뉴">
          <div class="sidebar-brand">
            <div class="brand-mark">VROO <em>CONSOLE</em></div>
            <div class="brand-caption">Mobility Operations</div>
          </div>
          <nav class="sidebar-nav" id="consoleNav">${buildNavHtml(s, s.defaultRoute)}</nav>
          <div class="sidebar-foot">
            <div class="sidebar-foot-meta">
              <div class="conn"><span class="conn-dot" aria-hidden="true"></span> 연결: 확인 불가</div>
              <div>v1.1.0-beta.1</div>
            </div>
            <button type="button" class="btn ghost" id="sidebarCollapseBtn" aria-label="사이드바 접기">${iconSvg("menu", 16)} <span class="nav-label">메뉴 접기</span></button>
          </div>
        </aside>
        <main class="console-content" id="consoleMain" tabindex="-1"></main>
      </div>
    </div>`;

  bindNav(document.getElementById("consoleNav"));

  const toggle = () => document.body.classList.toggle("sidebar-collapsed");
  document.getElementById("sidebarToggle").onclick = toggle;
  document.getElementById("sidebarCollapseBtn").onclick = toggle;

  document.getElementById("notifyBtn").onclick = () => {
    toast("알림 서비스가 연동되지 않았습니다.");
  };

  const accountBtn = document.getElementById("accountBtn");
  const accountMenu = document.getElementById("accountMenu");
  const setMenuOpen = (open) => {
    accountMenu.classList.toggle("open", open);
    accountMenu.hidden = !open;
    accountBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  accountBtn.onclick = (e) => {
    e.stopPropagation();
    setMenuOpen(accountMenu.hidden);
  };

  if (!shellDocHandlersBound) {
    shellDocHandlersBound = true;
    document.addEventListener("click", (e) => {
      const menu = document.getElementById("accountMenu");
      const btn = document.getElementById("accountBtn");
      if (!menu || !btn) return;
      if (!e.target.closest(".account-wrap")) {
        menu.classList.remove("open");
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const menu = document.getElementById("accountMenu");
      const btn = document.getElementById("accountBtn");
      if (!menu || !btn) return;
      menu.classList.remove("open");
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });
  }

  accountMenu.onclick = (e) => {
    const btn = e.target.closest("[data-acc]");
    if (!btn) return;
    const act = btn.dataset.acc;
    setMenuOpen(false);
    if (act === "logout") {
      logout();
      ctx.session = null;
      showLogin();
      return;
    }
    if (act === "perms") {
      go("permissions");
      return;
    }
    if (act === "role-switch") {
      openRoleSwitchModal();
      return;
    }
    if (act === "profile") {
      openModal({
        title: "내 정보",
        bodyHtml: `
          <dl class="info-dl">
            <dt>대화명</dt><dd>${escapeHtml(s.displayName)}</dd>
            <dt>이름</dt><dd>${escapeHtml(s.legalName || "—")}</dd>
            <dt>이메일</dt><dd>${escapeHtml(s.email || "—")}</dd>
            <dt>계정 유형</dt><dd>${escapeHtml(s.accountTypeLabel || s.accountType)}</dd>
            <dt>현재 역할</dt><dd>${escapeHtml(s.label)}</dd>
            <dt>보유 역할</dt><dd>${escapeHtml((s.assignedRoles || []).map((id) => getRole(id)?.label || id).join(", "))}</dd>
            <dt>조직</dt><dd>${escapeHtml(s.organizationName)}</dd>
            <dt>부서</dt><dd>${escapeHtml(s.department || "—")}</dd>
            <dt>최근 접속</dt><dd>${escapeHtml(lastLogin)}</dd>
          </dl>
          <p class="muted">서버 프로필 연동 전 로컬 계정입니다.</p>`,
        actions: [{ label: "닫기", onClick: closeModal }]
      });
      return;
    }
    if (act === "env") {
      openModal({
        title: "운영 환경",
        bodyHtml: `
          <dl class="info-dl">
            <dt>환경</dt><dd>${escapeHtml(s.environment || "development")}</dd>
            <dt>데이터 소스</dt><dd>Local seed</dd>
            <dt>인증</dt><dd>연동 전</dd>
            <dt>계정 ID</dt><dd><code>${escapeHtml(s.accountId)}</code></dd>
            <dt>조직 ID</dt><dd><code>${escapeHtml(s.organizationId || "—")}</code></dd>
            <dt>partnerId</dt><dd><code>${escapeHtml(s.partnerId || "없음")}</code></dd>
          </dl>
          <p class="muted">상세 연동 상태는 System 메뉴에서 확인하세요.</p>`,
        actions: [
          { label: "시스템 상태", className: "ghost", onClick: () => { closeModal(); go("system"); } },
          { label: "닫기", onClick: closeModal }
        ]
      });
      return;
    }
    if (act === "dev-reset" && isDev) {
      openModal({
        title: "데이터 초기화",
        bodyHtml: `<p>로컬 콘솔 세션·계정 오버레이·감사 로그·경로 상태를 초기화합니다. User App 데이터는 변경되지 않습니다.</p>`,
        actions: [
          { label: "취소", onClick: closeModal },
          {
            label: "초기화",
            className: "primary",
            onClick: () => {
              try {
                resetAccountsToSeed();
                localStorage.removeItem("vroo.console.session");
                localStorage.removeItem("vroo.console.role");
                localStorage.removeItem("vroo.console.route");
                localStorage.removeItem("vroo.console.navCollapse");
              } catch { /* ignore */ }
              closeModal();
              logout();
              ctx.session = null;
              showLogin();
              toast("로컬 콘솔 상태를 초기화했습니다.");
            }
          }
        ]
      });
      return;
    }
    if (act === "dev-accounts" && isDev) {
      const list = getDevelopmentAccounts();
      openModal({
        title: "테스트 계정 전환",
        bodyHtml: `<p class="muted">Development 전용입니다. 계정 단위로 전환합니다.</p>
          <div class="dev-role-list" style="margin-top:10px">
            ${list.map((a) => `
              <button type="button" class="dev-role-btn" data-switch-acc="${escapeHtml(a.id)}">
                <b>${escapeHtml(a.displayName)}</b>
                <span>${escapeHtml(a.devLabel)} · ${escapeHtml(a.email)}</span>
              </button>`).join("")}
          </div>`,
        actions: [{ label: "닫기", onClick: closeModal }]
      });
      document.querySelectorAll("[data-switch-acc]").forEach((b) => {
        b.onclick = () => {
          try {
            closeModal();
            loginAsAccount(b.dataset.switchAcc);
          } catch (err) {
            toast(err.message || "전환 실패", "error");
          }
        };
      });
    }
  };
}

function bootstrap() {
  bindModalChrome();
  let session = null;
  try {
    session = loadSession();
  } catch (e) {
    console.error(e);
    session = null;
  }
  ctx.session = session;
  if (!ctx.session) {
    showLogin();
    return;
  }
  mountShell();
  go(loadSavedRoute(ctx.session.defaultRoute || "dashboard"));
}

if (typeof document !== "undefined") {
  try {
    bootstrap();
  } catch (e) {
    console.error(e);
    const app = document.getElementById("consoleApp");
    if (app) app.innerHTML = `<pre style="color:red;padding:20px;white-space:pre-wrap">${e && e.stack ? e.stack : e}</pre>`;
  }
}

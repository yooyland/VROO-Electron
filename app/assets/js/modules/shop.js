import { cars } from "./data.js";
import { emit } from "../core/events.js";
import { statusBadgeText } from "../config/feature-status.js";
import { BENEFIT_PRODUCTS } from "../data/benefit-products.js";

/** 기존 프로토타입 카테고리 + 상업화 planned 카테고리 */
const SHOP_CATEGORIES = [
  { id: "all", label: "전체상품", status: "prototype", kind: "cars" },
  { id: "car", label: "자동차", status: "prototype", kind: "cars" },
  { id: "gift", label: "선물", status: "prototype", kind: "gifts" },
  { id: "feature", label: "기능", status: "prototype", kind: "notice" },
  { id: "maintain", label: "유지관리", status: "prototype", kind: "notice" },
  { id: "event", label: "이벤트", status: "prototype", kind: "notice" },
  { id: "benefits", label: "혜택·쿠폰", status: "planned", kind: "benefits" },
  { id: "partner", label: "제휴상품", status: "planned", kind: "benefits" },
  { id: "care", label: "CARE 연계", status: "planned", kind: "notice" }
];

function badge(status) {
  return `<span class="muted" style="font-size:11px;margin-left:6px">[${statusBadgeText(status)}]</span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[ch]);
}

export function renderShop(panel, state) {
  const initialCategory = SHOP_CATEGORIES.some((c) => c.id === state.shopCategory)
    ? state.shopCategory
    : "all";
  panel.innerHTML = `
    <div class="card muted" style="margin-bottom:10px;font-size:12px">
      STORE 프로토타입입니다. <b>준비 중</b> 카테고리는 미리보기만 가능하며 결제·발급이 없습니다.
    </div>
    <div class="tabs shop-category-tabs" aria-label="상점 카테고리">${SHOP_CATEGORIES.map((c) =>
      `<button class="${c.id === initialCategory ? "active" : ""}" data-cat="${c.id}">${c.label}${c.status === "planned" ? " ·" : ""}</button>`
    ).join("")}</div>
    <div id="shopList"></div>
    <div id="shopDetailOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="shopDetailTitle" tabindex="-1" style="position:fixed;inset:0;z-index:1200;background:rgba(4,7,13,.78);display:none;align-items:center;justify-content:center;padding:24px">
      <section class="card" style="width:min(560px,92vw);max-height:82vh;overflow:auto;border:1px solid rgba(212,175,55,.55);box-shadow:0 22px 70px rgba(0,0,0,.6)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div><div class="muted" id="shopDetailCategory"></div><h2 id="shopDetailTitle" style="margin:4px 0 0"></h2></div>
          <button type="button" id="shopDetailClose" aria-label="상품 상세 닫기">×</button>
        </div>
        <p class="muted" id="shopDetailDescription"></p>
        <div class="card" id="shopDetailRecipient" hidden></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
          <button type="button" id="shopDetailCancel">취소</button>
          <button type="button" class="primary" id="shopDetailConfirm">확인</button>
        </div>
      </section>
    </div>`;

  const list = panel.querySelector("#shopList");
  const overlay = panel.querySelector("#shopDetailOverlay");
  const detailTitle = panel.querySelector("#shopDetailTitle");
  const detailCategory = panel.querySelector("#shopDetailCategory");
  const detailDescription = panel.querySelector("#shopDetailDescription");
  const detailRecipient = panel.querySelector("#shopDetailRecipient");
  const detailConfirm = panel.querySelector("#shopDetailConfirm");
  let restoreScrollTop = 0;

  const closeDetail = () => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    overlay.style.display = "none";
    detailConfirm.onclick = null;
    requestAnimationFrame(() => { panel.scrollTop = restoreScrollTop; });
  };

  const openDetail = ({ title, category, description, status = "prototype", recipient = "", confirmLabel = "확인", onConfirm = null }) => {
    restoreScrollTop = panel.scrollTop;
    detailTitle.textContent = title;
    detailCategory.textContent = category + " · " + statusBadgeText(status);
    detailDescription.textContent = description;
    detailRecipient.hidden = !recipient;
    detailRecipient.textContent = recipient ? "받는 차량: " + recipient : "";
    detailConfirm.textContent = status === "planned" ? "준비 중" : confirmLabel;
    detailConfirm.disabled = status === "planned" || typeof onConfirm !== "function";
    detailConfirm.onclick = () => {
      if (typeof onConfirm !== "function") return;
      onConfirm();
      closeDetail();
    };
    overlay.hidden = false;
    overlay.style.display = "flex";
    overlay.focus();
  };

  panel.querySelector("#shopDetailClose").onclick = closeDetail;
  panel.querySelector("#shopDetailCancel").onclick = closeDetail;
  overlay.onclick = (event) => { if (event.target === overlay) closeDetail(); };
  overlay.onkeydown = (event) => { if (event.key === "Escape") closeDetail(); };

  const renderCars = (catLabel) => {
    list.innerHTML = cars.map((c) =>
      `<div class="card product-row"><div class="avatar">${c[2]}</div><div><b>${c[1]}</b><div class="muted">${catLabel} 상품 ${badge("prototype")}</div></div><button class="primary" data-car="${c[0]}">상세</button></div>`
    ).join("");
    list.querySelectorAll("[data-car]").forEach((b) => {
      b.onclick = () => {
        const car = cars.find((item) => String(item[0]) === String(b.dataset.car));
        if (!car) return;
        openDetail({
          title: car[1],
          category: "자동차",
          description: "현재 내 차량으로 선택합니다. 적용 전 선택 내용을 확인하세요.",
          status: "prototype",
          confirmLabel: "이 차량 선택",
          onConfirm: () => {
            state.profile.car = car[0];
            emit("state:save");
            render(state.shopCategory || "all");
          }
        });
      };
    });
  };

  const renderBenefits = () => {
    list.innerHTML = BENEFIT_PRODUCTS.map((p) =>
      `<div class="card product-row"><div class="avatar">🎁</div><div><b>${p.title}</b><div class="muted">${p.category} · ${p.description}${badge(p.status)}</div></div><button type="button" data-benefit="${escapeHtml(p.id || p.title)}">상세</button></div>`
    ).join("") || `<div class="card muted">등록된 혜택 상품이 없습니다.</div>`;
    list.querySelectorAll("[data-benefit]").forEach((button) => {
      button.onclick = () => {
        const product = BENEFIT_PRODUCTS.find((item) => String(item.id || item.title) === String(button.dataset.benefit));
        if (!product) return;
        openDetail({
          title: product.title,
          category: product.category || "혜택·쿠폰",
          description: product.description || "상세 정보가 준비 중입니다.",
          status: product.status || "planned"
        });
      };
    });
  };

  const renderGifts = () => {
    const recipient = state.shopGiftRecipient;
    const recipientHtml = recipient?.id
      ? `<div class="card"><b>받는 차량</b><div class="muted">${escapeHtml(recipient.nickname || recipient.id)} · 선물 대상이 연결되었습니다.</div></div>`
      : `<div class="card muted">주변 차량에서 선물 버튼을 누르면 받는 차량이 이곳에 연결됩니다.</div>`;
    list.innerHTML = `${recipientHtml}
      <div class="card product-row"><div class="avatar">📯</div><div><b>빵빵 사운드 선물</b><div class="muted">차량 소셜 아이템 ${badge("prototype")}</div></div><button disabled title="서버 연동 전">준비 중</button></div>
      <div class="card product-row"><div class="avatar">🎁</div><div><b>VROO 드라이브 선물</b><div class="muted">쿠폰·혜택 선물 ${badge("planned")}</div></div><button disabled title="서버 연동 전">준비 중</button></div>`;
  };

  const renderVehicleFeatures = () => {
    list.innerHTML = `
      <div class="card"><b>내 차량 커스터마이즈</b>${badge("prototype")}<p class="muted">Garage에서 선택한 차량에 적용할 외관과 파츠를 이곳에서 확인합니다.</p></div>
      <div class="card product-row"><div class="avatar">◉</div><div><b>라이트</b><div class="muted">차량 시그니처 조명 ${badge("prototype")}</div></div><button disabled title="파츠 적용 준비 중">준비 중</button></div>
      <div class="card product-row"><div class="avatar">✦</div><div><b>휠 · 스포일러 · 배기</b><div class="muted">외관 파츠 ${badge("planned")}</div></div><button disabled title="파츠 적용 준비 중">준비 중</button></div>`;
  };

  const renderCareNotice = () => {
    list.innerHTML = `<div class="card">
      <b>CARE 연계 상품</b>${badge("planned")}
      <p class="muted">보험 상담·사고처리·긴급출동은 CARE 축에서 제공될 예정입니다. 가입 확정·외부 전송은 이 프로토타입에 없습니다.</p>
      <p class="muted">스키마: insurance-products.js · docs/PRODUCT_VISION.md</p>
    </div>`;
  };

  const render = (catId) => {
    const cat = SHOP_CATEGORIES.find((c) => c.id === catId) || SHOP_CATEGORIES[0];
    if (cat.kind === "benefits") renderBenefits();
    else if (cat.kind === "gifts") renderGifts();
    else if (cat.id === "feature") renderVehicleFeatures();
    else if (cat.id === "care") renderCareNotice();
    else if (cat.kind === "notice") {
      list.innerHTML = `<div class="card"><b>${escapeHtml(cat.label)}</b>${badge(cat.status)}<p class="muted">이 카테고리는 준비 중이며 자동차 선택과 중복되지 않습니다.</p></div>`;
    }
    else renderCars(cat.label);
  };

  panel.querySelectorAll("[data-cat]").forEach((b) => {
    b.onclick = () => {
      panel.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("active", x === b));
      state.shopCategory = b.dataset.cat;
      emit("state:save");
      render(b.dataset.cat);
    };
  });
  render(initialCategory);
}

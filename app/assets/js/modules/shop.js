import { cars } from "./data.js";
import { emit } from "../core/events.js";
import { statusBadgeText } from "../config/feature-status.js";
import { BENEFIT_PRODUCTS } from "../data/benefit-products.js";

/** 기존 프로토타입 카테고리 + 상업화 planned 카테고리 */
const SHOP_CATEGORIES = [
  { id: "all", label: "전체상품", status: "prototype", kind: "cars" },
  { id: "car", label: "자동차", status: "prototype", kind: "cars" },
  { id: "gift", label: "선물", status: "prototype", kind: "cars" },
  { id: "feature", label: "기능", status: "prototype", kind: "cars" },
  { id: "maintain", label: "유지관리", status: "prototype", kind: "cars" },
  { id: "event", label: "이벤트", status: "prototype", kind: "cars" },
  { id: "benefits", label: "혜택·쿠폰", status: "planned", kind: "benefits" },
  { id: "partner", label: "제휴상품", status: "planned", kind: "benefits" },
  { id: "care", label: "CARE 연계", status: "planned", kind: "notice" }
];

function badge(status) {
  return `<span class="muted" style="font-size:11px;margin-left:6px">[${statusBadgeText(status)}]</span>`;
}

export function renderShop(panel, state) {
  panel.innerHTML = `
    <div class="card muted" style="margin-bottom:10px;font-size:12px">
      STORE 프로토타입입니다. <b>준비 중</b> 카테고리는 미리보기만 가능하며 결제·발급이 없습니다.
    </div>
    <div class="tabs">${SHOP_CATEGORIES.map((c, i) =>
      `<button class="${i === 0 ? "active" : ""}" data-cat="${c.id}">${c.label}${c.status === "planned" ? " ·" : ""}</button>`
    ).join("")}</div>
    <div id="shopList"></div>`;

  const list = panel.querySelector("#shopList");

  const renderCars = (catLabel) => {
    list.innerHTML = cars.map((c) =>
      `<div class="card product-row"><div class="avatar">${c[2]}</div><div><b>${c[1]}</b><div class="muted">${catLabel} 상품 ${badge("prototype")}</div></div><button class="primary" data-car="${c[0]}">선택</button></div>`
    ).join("");
    list.querySelectorAll("[data-car]").forEach((b) => {
      b.onclick = () => {
        state.profile.car = b.dataset.car;
        emit("state:save");
      };
    });
  };

  const renderBenefits = () => {
    list.innerHTML = BENEFIT_PRODUCTS.map((p) =>
      `<div class="card product-row"><div class="avatar">🎁</div><div><b>${p.title}</b><div class="muted">${p.category} · ${p.description}${badge(p.status)}</div></div><button disabled title="미구현">준비 중</button></div>`
    ).join("") || `<div class="card muted">등록된 혜택 상품이 없습니다.</div>`;
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
    else if (cat.kind === "notice") renderCareNotice();
    else renderCars(cat.label);
  };

  panel.querySelectorAll("[data-cat]").forEach((b) => {
    b.onclick = () => {
      panel.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("active", x === b));
      render(b.dataset.cat);
    };
  });
  render("all");
}

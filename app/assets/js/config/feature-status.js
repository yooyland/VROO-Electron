/**
 * VROO feature status registry
 * implemented | prototype | planned
 * docs/FEATURE_STATUS.md 와 동기화 유지
 */

export const STATUS = Object.freeze({
  IMPLEMENTED: "implemented",
  PROTOTYPE: "prototype",
  PLANNED: "planned"
});

export const STATUS_LABEL = Object.freeze({
  implemented: "구현됨",
  prototype: "프로토타입",
  planned: "준비 중"
});

export const LIFECYCLE = Object.freeze({
  KEEP: "keep",
  HIDE: "hide",
  BACKEND_READY: "backend-ready",
  REVIEW_FOR_DELETE: "review-for-delete"
});

export const LIFECYCLE_LABEL = Object.freeze({
  keep: "유지",
  hide: "숨김",
  "backend-ready": "백엔드 전환 준비",
  "review-for-delete": "삭제 검토"
});

/** @type {Record<string, { status: string, lifecycle?: string, axis: string, label: string }>} */
export const FEATURES = {
  "drive.near": { status: "prototype", lifecycle: "keep", axis: "drive", label: "주변 지도" },
  "drive.road": { status: "prototype", lifecycle: "keep", axis: "drive", label: "도로 모드" },
  "drive.all": { status: "prototype", axis: "drive", label: "전체 화면" },
  "drive.realtime": { status: "planned", axis: "drive", label: "실시간 위치" },
  "social.dm": { status: "prototype", lifecycle: "backend-ready", axis: "social", label: "1:1 채팅" },
  "social.gridChat": { status: "prototype", lifecycle: "backend-ready", axis: "social", label: "GRID 단체채팅" },
  "social.voice": { status: "prototype", lifecycle: "backend-ready", axis: "social", label: "음성 입력" },
  "social.grid": { status: "prototype", axis: "social", label: "Spatial GRID" },
  "social.community": { status: "prototype", axis: "social", label: "커뮤니티" },
  "social.friends": { status: "planned", axis: "social", label: "친구" },
  "social.party": { status: "planned", axis: "social", label: "드라이브 파티" },
  "store.basic": { status: "prototype", axis: "store", label: "상점 기본" },
  "store.cosmetics": { status: "planned", axis: "store", label: "스킨·휠·LED" },
  "store.benefits": { status: "planned", axis: "store", label: "쿠폰·제휴상품" },
  "store.payment": { status: "planned", axis: "store", label: "실결제" },
  "benefits.coupons": { status: "planned", axis: "benefits", label: "생활 쿠폰" },
  "benefits.membership": { status: "planned", axis: "benefits", label: "멤버십" },
  "care.insurance": { status: "planned", axis: "care", label: "보험" },
  "care.accident": { status: "planned", axis: "care", label: "사고처리" },
  "care.emergency": { status: "planned", axis: "care", label: "긴급출동" },
  "local.places": { status: "prototype", axis: "local", label: "지명 레이어" },
  "local.offers": { status: "planned", axis: "local", label: "GRID 혜택" },
  "play.growth": { status: "prototype", lifecycle: "keep", axis: "play", label: "성장·크레딧" },
  "play.season": { status: "planned", axis: "play", label: "시즌·미션" },
  "my.car": { status: "prototype", lifecycle: "keep", axis: "my", label: "MY CAR" },
  "my.wallet": { status: "planned", axis: "my", label: "쿠폰·결제" },
  "platform.localStorage": { status: "prototype", axis: "platform", label: "localStorage" },
  "platform.server": { status: "planned", axis: "platform", label: "서버·실시간" },
  "platform.admin": { status: "planned", axis: "platform", label: "Admin Console" },
  "platform.partner": { status: "planned", axis: "platform", label: "Partner Console" }
};

export function getFeatureStatus(featureId) {
  return FEATURES[featureId]?.status || STATUS.PLANNED;
}

export function isUsable(featureId) {
  const s = getFeatureStatus(featureId);
  return s === STATUS.IMPLEMENTED || s === STATUS.PROTOTYPE;
}

export function statusBadgeText(status) {
  return STATUS_LABEL[status] || STATUS_LABEL.planned;
}

export function listByStatus(status) {
  return Object.entries(FEATURES)
    .filter(([, v]) => v.status === status)
    .map(([id, v]) => ({ id, ...v }));
}

export function getFeatureLifecycle(featureId) {
  return FEATURES[featureId]?.lifecycle || LIFECYCLE.KEEP;
}

export function listByLifecycle(lifecycle) {
  return Object.entries(FEATURES)
    .filter(([id]) => getFeatureLifecycle(id) === lifecycle)
    .map(([id, value]) => ({id, ...value, lifecycle: getFeatureLifecycle(id)}));
}

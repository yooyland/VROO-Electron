/**
 * VROO product navigation — 상업화 1차 메뉴 확장 구조
 * 현재 HTML 상단 메뉴는 변경하지 않는다. UI 전환 시 이 설정을 단일 소스로 사용.
 *
 * status: implemented | prototype | planned
 */

export const FEATURE_STATUS = {
  IMPLEMENTED: "implemented",
  PROTOTYPE: "prototype",
  PLANNED: "planned"
};

/** 현재 상단 메뉴 (기존 UI 유지) */
export const CURRENT_TOP_MENU = [
  { id: "nearby", label: "주변차량", screen: "nearby", axis: "drive", status: "prototype" },
  { id: "grid", label: "그리드", screen: "grid", axis: "social", status: "prototype" },
  { id: "chat", label: "대화방", screen: "chat", axis: "social", status: "prototype" },
  { id: "growth", label: "성장", screen: "growth", axis: "play", status: "prototype" },
  { id: "shop", label: "상점", screen: "shop", axis: "store", status: "prototype" },
  { id: "community", label: "커뮤니티", screen: "community", axis: "social", status: "prototype" }
];

/** 향후 1차 메뉴 (8축) — 화면 전환에 아직 연결하지 않음 */
export const PRODUCT_NAVIGATION = [
  {
    id: "drive",
    label: "DRIVE",
    status: "prototype",
    legacyScreens: ["nearby"],
    legacyViews: ["near", "road", "all"],
    items: [
      { id: "near", label: "주변", status: "prototype" },
      { id: "road", label: "도로", status: "prototype" },
      { id: "all", label: "전체", status: "prototype" },
      { id: "my-car-drive", label: "내 차량", status: "prototype" },
      { id: "drive-status", label: "주행 상태", status: "planned" },
      { id: "nearby-vehicles", label: "위치 기반 차량 표시", status: "prototype" }
    ]
  },
  {
    id: "social",
    label: "SOCIAL",
    status: "prototype",
    legacyScreens: ["grid", "chat", "community", "nearby"],
    items: [
      { id: "dm", label: "1:1 채팅", status: "prototype" },
      { id: "grid-chat", label: "GRID 단체채팅", status: "prototype" },
      { id: "friends", label: "친구", status: "planned" },
      { id: "drive-party", label: "드라이브 파티", status: "planned" },
      { id: "community", label: "커뮤니티", status: "prototype" },
      { id: "grid", label: "GRID", status: "prototype" }
    ]
  },
  {
    id: "store",
    label: "STORE",
    status: "prototype",
    legacyScreens: ["shop"],
    items: [
      { id: "car-items", label: "차량 아이템", status: "planned" },
      { id: "skins", label: "차량 스킨", status: "planned" },
      { id: "wheels", label: "휠", status: "planned" },
      { id: "spoiler", label: "스포일러", status: "planned" },
      { id: "led", label: "LED", status: "planned" },
      { id: "bubbles", label: "말풍선", status: "planned" },
      { id: "beams", label: "광선", status: "planned" },
      { id: "coupons", label: "쿠폰", status: "planned" },
      { id: "partner-goods", label: "제휴상품", status: "planned" },
      { id: "point-mall", label: "포인트몰", status: "planned" },
      { id: "car-select", label: "차량 선택(데모)", status: "prototype" }
    ]
  },
  {
    id: "benefits",
    label: "BENEFITS",
    status: "planned",
    legacyScreens: [],
    items: [
      { id: "fuel-coupon", label: "주유 쿠폰", status: "planned" },
      { id: "coffee-coupon", label: "커피 쿠폰", status: "planned" },
      { id: "convenience-coupon", label: "편의점 쿠폰", status: "planned" },
      { id: "carwash", label: "세차 할인", status: "planned" },
      { id: "food-coupon", label: "외식 쿠폰", status: "planned" },
      { id: "membership", label: "멤버십 혜택", status: "planned" },
      { id: "signup-benefit", label: "가입 혜택", status: "planned" },
      { id: "season-event", label: "시즌 이벤트", status: "planned" }
    ]
  },
  {
    id: "care",
    label: "CARE",
    status: "planned",
    legacyScreens: [],
    items: [
      { id: "insurance", label: "보험", status: "planned" },
      { id: "driver-insurance", label: "운전자 보험", status: "planned" },
      { id: "insurance-compare", label: "보험 비교", status: "planned" },
      { id: "insurance-renew", label: "보험 갱신", status: "planned" },
      { id: "insurance-new", label: "신규 가입 상담", status: "planned" },
      { id: "accident", label: "사고처리", status: "planned" },
      { id: "accident-photo", label: "사고 사진", status: "planned" },
      { id: "accident-gps", label: "GPS 사고 위치", status: "planned" },
      { id: "emergency", label: "긴급출동", status: "planned" },
      { id: "towing", label: "견인", status: "planned" },
      { id: "fuel-emergency", label: "비상급유", status: "planned" },
      { id: "battery", label: "배터리", status: "planned" },
      { id: "tire", label: "타이어", status: "planned" },
      { id: "repair", label: "정비", status: "planned" },
      { id: "inspection", label: "검사 예약", status: "planned" }
    ]
  },
  {
    id: "local",
    label: "LOCAL",
    status: "planned",
    legacyScreens: [],
    items: [
      { id: "grid-offers", label: "GRID 지역 혜택", status: "planned" },
      { id: "gas-station", label: "주변 주유소", status: "planned" },
      { id: "cafe", label: "카페", status: "planned" },
      { id: "restaurant", label: "맛집", status: "planned" },
      { id: "carwash-local", label: "세차장", status: "planned" },
      { id: "garage", label: "정비소", status: "planned" },
      { id: "tourism", label: "관광", status: "planned" },
      { id: "local-event", label: "지역 이벤트", status: "planned" },
      { id: "official-grid", label: "공식 GRID", status: "planned" }
    ]
  },
  {
    id: "play",
    label: "PLAY",
    status: "prototype",
    legacyScreens: ["growth"],
    items: [
      { id: "growth", label: "차량 성장", status: "prototype" },
      { id: "mission", label: "미션", status: "planned" },
      { id: "ranking", label: "랭킹", status: "planned" },
      { id: "season", label: "시즌", status: "planned" },
      { id: "event", label: "이벤트", status: "planned" },
      { id: "attendance", label: "출석", status: "planned" },
      { id: "drive-reward", label: "주행 보상", status: "planned" }
    ]
  },
  {
    id: "my",
    label: "MY",
    status: "prototype",
    legacyScreens: [],
    legacyEntry: "mypage",
    items: [
      { id: "my-car", label: "내 차량", status: "prototype" },
      { id: "my-points", label: "내 포인트", status: "planned" },
      { id: "my-coupons", label: "내 쿠폰", status: "planned" },
      { id: "my-products", label: "가입 상품", status: "planned" },
      { id: "my-insurance", label: "보험 현황", status: "planned" },
      { id: "payments", label: "결제 내역", status: "planned" },
      { id: "notifications", label: "알림", status: "planned" },
      { id: "settings", label: "설정", status: "planned" }
    ]
  }
];

export function getAxisById(axisId) {
  return PRODUCT_NAVIGATION.find((a) => a.id === axisId) || null;
}

export function listPlannedAxes() {
  return PRODUCT_NAVIGATION.filter((a) => a.status === FEATURE_STATUS.PLANNED);
}

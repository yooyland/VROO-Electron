/**
 * VROO 지도 객체 — 장소·이정표·도로·지역 라벨
 * vehicle / my_location / spatial_message 는 map.js 에서 별도 렌더
 */

/** @typedef {"vehicle"|"place"|"landmark"|"road_label"|"area_label"|"my_location"|"spatial_message"} MapObjectKind */

export const PLACE_CATEGORIES = Object.freeze([
  { id: "park", label: "공원", group: "park" },
  { id: "heritage", label: "문화유산", group: "heritage" },
  { id: "station", label: "교통", group: "transit" },
  { id: "parking", label: "주차", group: "parking" },
  { id: "repair", label: "정비", group: "repair" },
  { id: "fuel", label: "주유", group: "fuel" },
  { id: "restaurant", label: "음식", group: "food" },
  { id: "cafe", label: "카페", group: "food" },
  { id: "office", label: "사무실", group: "office" },
  { id: "store", label: "상점", group: "store" },
  { id: "hospital", label: "의료", group: "hospital" },
  { id: "favorite", label: "즐겨찾기", group: "favorite" },
  { id: "other", label: "기타", group: "other" }
]);

/** 인라인 SVG — 이모지 대체 */
export const PLACE_CATEGORY_SVG = Object.freeze({
  park: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c-2.2 2.4-3.5 4.6-3.5 6.8A3.5 3.5 0 0 0 12 13.3a3.5 3.5 0 0 0 3.5-3.5C15.5 7.6 14.2 5.4 12 3zm-1 11.2h2V21h-2v-6.8z"/></svg>`,
  heritage: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 20V9l8-5 8 5v11h-3v-7H7v7H4zm5 0h6v-2H9v2z"/></svg>`,
  station: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c-4 0-7 1.5-7 5v7c0 2.2 1.3 3.5 3 4.2V21h2.2v-2h3.6v2H16v-2.8c1.7-.7 3-2 3-4.2V7c0-3.5-3-5-7-5zm-3.2 12.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm6.4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zM7.5 8.2h9V6.4h-9v1.8z"/></svg>`,
  parking: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h7.2A4.8 4.8 0 0 1 19 7.8 4.8 4.8 0 0 1 14.2 12.6H10.5V21H7V3zm3.5 6.6h3.4c1.3 0 2.1-.8 2.1-2s-.8-2-2.1-2h-3.4v4z"/></svg>`,
  repair: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 19.1 12.9 10A5.5 5.5 0 0 0 4.1 4.2l3.5 3.5-2 2-3.5-3.4A5.5 5.5 0 0 0 10 12.9l9.1 9.1 2.9-2.9z"/></svg>`,
  fuel: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 3h10v12H4V3zm2 2v8h6V5H6zm12 1.5 2 2V17a2 2 0 1 1-2.8.2V9.9l-1.2-1.2L17.4 7 18 6.5zM6 17h8v4H6v-4z"/></svg>`,
  restaurant: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2v8a2 2 0 0 0 2 2v10h2V2H7zm8 0c0 3 1.5 4.5 1.5 7V22h2V9c0-2.5 1.5-4 1.5-7h-5z"/></svg>`,
  cafe: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V5zm12 2h2a3 3 0 0 1 0 6h-2V7zM6 18h10v2H6v-2z"/></svg>`,
  office: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 21V3h10v6h6v12H4zm2-2h2v-2H6v2zm0-4h2v-2H6v2zm0-4h2V9H6v2zm0-4h2V5H6v2zm4 12h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V9h-2v2zm0-4h2V5h-2v2zm4 12h4v-2h-2v-2h2v-2h-2v-2h2V9h-4v10z"/></svg>`,
  store: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6 3 3h18l-1 3H4zm0 2h16v13H4V8zm3 2v3h10v-3H7z"/></svg>`,
  hospital: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 3h4v5h5v4h-5v5h-4v-5H5V8h5V3z"/></svg>`,
  favorite: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3 2.5 6.5L21 10l-5 4.2L17.5 21 12 17.4 6.5 21 8 14.2 3 10l6.5-.5L12 3z"/></svg>`,
  other: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5A2.5 2.5 0 1 0 12 12a2.5 2.5 0 0 0 0-5.5z"/></svg>`,
  road: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 3h8l2 18H6L8 3zm3 3v3h2V6h-2zm0 5v3h2v-3h-2zm0 5v3h2v-3h-2z"/></svg>`,
  area: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm2 4h12v2H6v-2zm2 4h8v2H8v-2zm2 4h4v2h-4v-2z"/></svg>`,
  vehicle: `<svg class="vroo-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 11 6.5 6.5h11L19 11H5zm-1.5 1.5h17l-.5 2.5H4l-.5-2.5zM6 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm12 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`
});

export function categoryLabel(catId) {
  return PLACE_CATEGORIES.find((c) => c.id === catId)?.label || "장소";
}

export function categorySvg(catId) {
  return PLACE_CATEGORY_SVG[catId] || PLACE_CATEGORY_SVG.other;
}

export function kindLabel(kind) {
  const map = {
    vehicle: "차량",
    place: "등록지점",
    landmark: "주요 이정표",
    road_label: "도로 정보",
    area_label: "지역 정보",
    my_location: "내 위치",
    spatial_message: "공간 메시지"
  };
  return map[kind] || "지도 객체";
}

/** 레거시 type → kind / category 정규화 */
export function normalizePlaceMeta(place) {
  if (!place || typeof place !== "object") return null;
  let kind = place.kind;
  let category = place.category;
  const type = place.type;
  if (!kind) {
    if (type === "road") kind = "road_label";
    else if (type === "district") kind = "area_label";
    else if (type === "heritage" || type === "park") kind = "landmark";
    else if (type === "station") kind = "place";
    else kind = "place";
  }
  if (!category) {
    if (type === "road") category = "other";
    else if (type === "district") category = "other";
    else if (type === "heritage") category = "heritage";
    else if (type === "park") category = "park";
    else if (type === "station") category = "station";
    else category = "other";
  }
  return { ...place, kind, category, type: type || category };
}

export const VROO_PLACES = [
  {
    id: "seonjeongneung",
    name: "선정릉공원",
    subtitle: "선릉과 정릉이 있는 공원",
    kind: "landmark",
    category: "park",
    type: "heritage",
    lat: 37.50889,
    lng: 127.04944,
    minZoom: 13,
    priority: 100
  },
  {
    id: "seolleung",
    name: "선릉",
    subtitle: "성종·정현왕후 능",
    kind: "landmark",
    category: "heritage",
    type: "heritage",
    lat: 37.50955,
    lng: 127.04782,
    minZoom: 16,
    priority: 90
  },
  {
    id: "jeongneung",
    name: "정릉",
    subtitle: "중종 능",
    kind: "landmark",
    category: "heritage",
    type: "heritage",
    lat: 37.50697,
    lng: 127.05125,
    minZoom: 16,
    priority: 90
  },
  {
    id: "seolleung-station",
    name: "선릉역",
    subtitle: "2호선·수인분당선",
    kind: "place",
    category: "station",
    type: "station",
    lat: 37.5045,
    lng: 127.049,
    minZoom: 14,
    priority: 85
  },
  {
    id: "seonjeongneung-station",
    name: "선정릉역",
    subtitle: "9호선·수인분당선",
    kind: "place",
    category: "station",
    type: "station",
    lat: 37.51098,
    lng: 127.04362,
    minZoom: 14,
    priority: 84
  },
  {
    id: "teheran-ro",
    name: "테헤란로",
    subtitle: "강남 주요 간선도로",
    kind: "road_label",
    category: "other",
    type: "road",
    lat: 37.50455,
    lng: 127.0522,
    minZoom: 15,
    priority: 70
  },
  {
    id: "seolleung-ro",
    name: "선릉로",
    subtitle: "강남 주요 도로",
    kind: "road_label",
    category: "other",
    type: "road",
    lat: 37.5072,
    lng: 127.04705,
    minZoom: 16,
    priority: 65
  },
  {
    id: "samseong-community",
    name: "삼성동",
    subtitle: "서울 강남구",
    kind: "area_label",
    category: "other",
    type: "district",
    lat: 37.51025,
    lng: 127.0551,
    minZoom: 14,
    maxZoom: 17,
    priority: 55
  }
];

export const VROO_LABEL_CORRECTIONS = {
  삼른공원: "선정릉공원",
  삼릉공원: "선정릉공원",
  선릉공원: "선정릉공원",
  선릉릉공원: "선정릉공원",
  "선정릉 공원": "선정릉공원",
  "서울 선릉과 정릉": "선정릉공원"
};

export function normalizePlaceName(name) {
  const clean = String(name || "").trim();
  return VROO_LABEL_CORRECTIONS[clean] || clean;
}

export function placesForZoom(zoom) {
  return VROO_PLACES.map(normalizePlaceMeta)
    .filter(Boolean)
    .filter((place) => zoom >= (place.minZoom ?? 0))
    .filter((place) => place.maxZoom == null || zoom <= place.maxZoom)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/** 낮은 zoom: 주요 이정표·지역만 */
export function placesForZoomDetail(zoom) {
  const list = placesForZoom(zoom);
  if (zoom < 14) {
    return list.filter(
      (p) =>
        p.kind === "landmark" ||
        p.kind === "area_label" ||
        (p.kind === "place" && (p.priority || 0) >= 90)
    );
  }
  return list;
}

export function defaultMapLayerPrefs() {
  return {
    showVehicles: true,
    showPlaces: true,
    showLandmarks: true,
    showRoadLabels: true,
    showAreaLabels: true,
    showSpatial: true,
    filterMode: "all",
    placeCategoryFilter: "all",
    vehicleFilter: "all",
    labelsVisible: true
  };
}

export function sanitizeMapLayerPrefs(raw) {
  const base = defaultMapLayerPrefs();
  if (!raw || typeof raw !== "object") return base;
  return {
    showVehicles: raw.showVehicles !== false,
    showPlaces: raw.showPlaces !== false,
    showLandmarks: raw.showLandmarks !== false,
    showRoadLabels: raw.showRoadLabels !== false,
    showAreaLabels: raw.showAreaLabels !== false,
    showSpatial: raw.showSpatial !== false,
    filterMode: ["all", "vehicle", "place", "spatial"].includes(raw.filterMode)
      ? raw.filterMode
      : "all",
    placeCategoryFilter:
      typeof raw.placeCategoryFilter === "string" ? raw.placeCategoryFilter : "all",
    vehicleFilter: ["all", "online", "same_direction", "friends", "chatting"].includes(
      raw.vehicleFilter
    )
      ? raw.vehicleFilter
      : "all",
    labelsVisible: raw.labelsVisible !== false
  };
}

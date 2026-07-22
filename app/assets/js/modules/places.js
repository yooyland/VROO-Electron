export const VROO_PLACES = [
  {
    id: "seonjeongneung",
    name: "선정릉공원",
    subtitle: "선릉과 정릉이 있는 선정릉공원",
    type: "heritage",
    icon: "🌳",
    lat: 37.50889,
    lng: 127.04944,
    minZoom: 13,
    priority: 100
  },
  {
    id: "seolleung",
    name: "선릉",
    subtitle: "성종·정현왕후 능",
    type: "heritage",
    icon: "🏛️",
    lat: 37.50955,
    lng: 127.04782,
    minZoom: 16,
    priority: 90
  },
  {
    id: "jeongneung",
    name: "정릉",
    subtitle: "중종 능",
    type: "heritage",
    icon: "🏛️",
    lat: 37.50697,
    lng: 127.05125,
    minZoom: 16,
    priority: 90
  },
  {
    id: "seolleung-station",
    name: "선릉역",
    subtitle: "2호선·수인분당선",
    type: "station",
    icon: "🚇",
    lat: 37.50450,
    lng: 127.04900,
    minZoom: 14,
    priority: 85
  },
  {
    id: "seonjeongneung-station",
    name: "선정릉역",
    subtitle: "9호선·수인분당선",
    type: "station",
    icon: "🚇",
    lat: 37.51098,
    lng: 127.04362,
    minZoom: 14,
    priority: 84
  },
  {
    id: "teheran-ro",
    name: "테헤란로",
    subtitle: "강남 주요 간선도로",
    type: "road",
    icon: "🛣️",
    lat: 37.50455,
    lng: 127.05220,
    minZoom: 15,
    priority: 70
  },
  {
    id: "seolleung-ro",
    name: "선릉로",
    subtitle: "강남 주요 도로",
    type: "road",
    icon: "🛣️",
    lat: 37.50720,
    lng: 127.04705,
    minZoom: 16,
    priority: 65
  },
  {
    id: "samseong-community",
    name: "삼성동",
    subtitle: "서울 강남구",
    type: "district",
    icon: "📍",
    lat: 37.51025,
    lng: 127.05510,
    minZoom: 14,
    maxZoom: 17,
    priority: 55
  }
];

export const VROO_LABEL_CORRECTIONS = {
  "삼른공원": "선정릉공원",
  "삼릉공원": "선정릉공원",
  "선릉공원": "선정릉공원",
  "선릉릉공원": "선정릉공원",
  "선정릉 공원": "선정릉공원",
  "서울 선릉과 정릉": "선정릉공원"
};

export function normalizePlaceName(name) {
  const clean = String(name || "").trim();
  return VROO_LABEL_CORRECTIONS[clean] || clean;
}

export function placesForZoom(zoom) {
  return VROO_PLACES
    .filter(place => zoom >= (place.minZoom ?? 0))
    .filter(place => place.maxZoom == null || zoom <= place.maxZoom)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

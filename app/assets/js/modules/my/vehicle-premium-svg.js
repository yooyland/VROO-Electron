/**
 * VROO 프리미엄 차량 실루엣 (path 기반 · 인터랙션 레이어 분리)
 * catalogType별 실루엣·비율을 구분 — 동일 SVG 복붙 표시 방지
 * 특정 실존 브랜드 복제 금지 — VROO 독립 실루엣
 */
import { escapeHtml } from "./my-data.js";

function typeTune(type) {
  switch (type) {
    case "suv":
      return { scaleY: 1.14, roofLift: -8, length: 1, label: "SUV" };
    case "sedan":
      return { scaleY: 1.02, roofLift: 0, length: 1.04, label: "SEDAN" };
    case "classic":
      return { scaleY: 0.96, roofLift: 4, length: 0.98, label: "HERITAGE" };
    case "sport":
    default:
      return { scaleY: 1, roofLift: -2, length: 1, label: "SPORT" };
  }
}

/**
 * @param {string} [type]
 * @param {string} [color]
 */
export function vehiclePremiumSvg(type = "sport", color = "#1a1f28") {
  const body = escapeHtml(color || "#1a1f28");
  const gold = "#c9a227";
  const tune = typeTune(type);
  const roof = tune.roofLift;
  return `<svg class="my-car-svg my-car-svg--premium" data-car-type="${escapeHtml(type)}" viewBox="0 0 560 220" aria-hidden="true">
    <defs>
      <linearGradient id="vrooBodyGrad-${escapeHtml(type)}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2a3140"/>
        <stop offset="45%" stop-color="${body}"/>
        <stop offset="100%" stop-color="#0a0c10"/>
      </linearGradient>
      <linearGradient id="vrooGlassGrad-${escapeHtml(type)}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#9ec9e8" stop-opacity=".55"/>
        <stop offset="100%" stop-color="#1a3048" stop-opacity=".85"/>
      </linearGradient>
      <linearGradient id="vrooFloorReflect-${escapeHtml(type)}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${body}" stop-opacity=".28"/>
        <stop offset="100%" stop-color="${body}" stop-opacity="0"/>
      </linearGradient>
      <filter id="vrooSoftGlow-${escapeHtml(type)}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g class="vehicle-reflection" transform="translate(0,198) scale(1,-0.22)" opacity=".55" aria-hidden="true">
      <ellipse cx="280" cy="188" rx="210" ry="18" fill="url(#vrooFloorReflect-${escapeHtml(type)})"/>
    </g>
    <ellipse class="vehicle-shadow" cx="280" cy="188" rx="200" ry="16" fill="#000" opacity=".55"/>
    <g class="vehicle-root" transform="translate(${(1 - tune.length) * 140},0) scale(${tune.length},${tune.scaleY})" style="transform-origin:280px 110px">
      <g class="vehicle-body my-car-body">
        <path fill="url(#vrooBodyGrad-${escapeHtml(type)})" d="M72 148
          C78 118 96 98 128 88
          L188 ${72 + roof} C230 ${58 + roof} 270 ${48 + roof} 318 ${48 + roof}
          L372 ${52 + roof} C410 ${56 + roof} 448 72 478 96
          L512 128 C520 138 522 148 516 156
          L72 156 Z"/>
        <path fill="#0d1118" opacity=".55" d="M140 148 L500 148 L492 156 L148 156 Z"/>
        <path class="vehicle-gold-accent" fill="none" stroke="${gold}" stroke-width="3" stroke-linecap="round"
          d="M132 92 C200 70 300 62 390 74 C430 80 460 92 488 112"/>
        <path fill="#121820" d="M96 138 C110 128 130 122 150 122 L200 122 L210 148 L100 148 Z"/>
        <path fill="#121820" d="M430 128 L500 128 C508 136 510 146 502 152 L430 152 Z"/>
      </g>
      <g class="vehicle-glass">
        <path fill="url(#vrooGlassGrad-${escapeHtml(type)})" d="M210 ${78 + roof} L318 ${58 + roof} L368 ${62 + roof} L352 ${96 + roof} L248 ${108 + roof} Z"/>
        <path fill="url(#vrooGlassGrad-${escapeHtml(type)})" opacity=".85" d="M248 ${108 + roof} L352 ${96 + roof} L348 ${118 + roof} L236 ${124 + roof} Z"/>
      </g>
      <g class="my-car-doors">
        <g class="my-car-door my-car-door--l vehicle-door" style="transform-origin:236px 118px">
          <path fill="${body}" stroke="#000" stroke-opacity=".25" d="M236 100 L300 92 L308 142 L240 148 Z"/>
          <path fill="none" stroke="${gold}" stroke-width="1.5" opacity=".7" d="M244 118 H300"/>
        </g>
        <g class="my-car-door my-car-door--r vehicle-door" style="transform-origin:308px 118px">
          <path fill="${body}" stroke="#000" stroke-opacity=".2" opacity=".9" d="M308 92 L348 88 L352 140 L308 142 Z"/>
        </g>
      </g>
      <g class="my-car-lights vehicle-front-light" opacity=".35">
        <ellipse cx="498" cy="128" rx="18" ry="8" fill="#fff8d0" filter="url(#vrooSoftGlow-${escapeHtml(type)})"/>
        <ellipse cx="478" cy="122" rx="10" ry="5" fill="#ffe9a0"/>
        <ellipse class="my-car-beam" cx="530" cy="128" rx="36" ry="14" fill="#ffe9a0" opacity=".35"/>
      </g>
      <g class="vehicle-rear-light">
        <rect x="78" y="122" width="22" height="8" rx="3" fill="#ff3355" opacity=".85"/>
      </g>
      <g class="vehicle-wheel-front">
        <circle cx="420" cy="156" r="34" fill="#0a0a0a"/>
        <circle cx="420" cy="156" r="22" fill="#2a3038" stroke="${gold}" stroke-width="2"/>
        <circle cx="420" cy="156" r="8" fill="#c5ced8"/>
      </g>
      <g class="vehicle-wheel-rear">
        <circle cx="168" cy="156" r="${type === "suv" ? 38 : 36}" fill="#0a0a0a"/>
        <circle cx="168" cy="156" r="23" fill="#2a3038" stroke="${gold}" stroke-width="2"/>
        <circle cx="168" cy="156" r="8" fill="#c5ced8"/>
      </g>
    </g>
  </svg>`;
}

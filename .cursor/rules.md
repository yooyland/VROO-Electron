# 프로젝트명 : VROO Electron

## 작업 범위

- 이 프로젝트 외의 코드와 구조를 참조하지 않는다.
- App-YooYLand의 구조를 사용하지 않는다.
- OpenStudio의 구조를 사용하지 않는다.
- YooY / YooYLand / React Native / Expo 패턴을 가져오지 않는다.
- 모든 수정은 `D:\VROO_Electron` 기준으로 한다.

## 기술 스택 (이 프로젝트만)

- Electron 데스크톱 앱
- `main.js` / `preload.js` / `app/index.html`
- 프론트: 바닐라 JS ES modules (`app/assets/js/`)
- 지도: Leaflet, 도로모드: Three.js
- 로컬 상태: `localStorage` (서버 없이 `npm start`로 실행)

## 작업 원칙

- 대규모 리팩토링·파일 구조 변경은 요청 없이 하지 않는다.
- 기존 UI 디자인과 기능을 유지한다.
- 변경 파일을 최소화한다.
- 추측으로 다른 프로젝트 구조를 제안하지 않는다.
- 응답은 한국어로 한다.

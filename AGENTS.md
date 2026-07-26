# AGENTS.md

## Cursor Cloud specific instructions

VROO는 백엔드가 없는 **Electron 데스크톱 GUI 앱**입니다. 서버·DB·마이그레이션이 없고, 상태는 `localStorage`에 저장됩니다. 표준 명령은 `package.json` scripts와 `README.md`를 참고하세요.

### 실행 (GUI 필수)
- Electron 앱이므로 실행하려면 X 디스플레이가 필요합니다. Cloud VM에는 `DISPLAY=:1` 데스크톱이 이미 떠 있습니다.
- 사용자 앱: `DISPLAY=:1 npm start`
- 콘솔: `DISPLAY=:1 npm run console` / 동시: `DISPLAY=:1 npm run dev:platform`
- 창은 자동으로 maximize 되어 뜹니다. 확인/조작은 computer use(데스크톱)로 하세요.

### 알려진 비치명적 로그 (무시해도 됨)
- `Failed to connect to the bus` (dbus), `NetworkManager ... ServiceUnknown` — 헤드리스 VM에 해당 서비스가 없어서 나는 것이며 앱 동작에 영향 없음.
- `WebGL1/WebGL2 blocklisted` — 헤드리스 GPU에서 WebGL이 차단됨. 지도(Leaflet)·일반 UI·채팅은 정상 동작하지만, **Three.js 기반 "도로" 3D 뷰는 렌더링되지 않을 수 있음**. 도로 뷰를 테스트하려면 소프트웨어 WebGL 플래그가 필요할 수 있음(예: `ELECTRON_OZONE_PLATFORM_HINT` 등 electron 실행 플래그). 코드 수정 없이 map/social 흐름 검증은 가능.

### 네트워크 의존성
- Leaflet 1.9 / Three.js r160을 **CDN**에서 로드하므로 지도 타일·3D를 보려면 **인터넷 연결**이 필요합니다.

### 검증
- 문법 체크: `node --check main.js`, `node --check preload.js` (별도 린터/테스트 스위트는 없음).
- 핵심 흐름 확인: 앱 실행 → 우측 "주변 차량" 목록에서 `열기` → `1:1 대화` → 메시지 전송(자동 응답 확인).

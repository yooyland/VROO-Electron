# VROO Electron 연동 안내

## 1. 위치
압축을 풀면 다음 경로가 되어야 합니다.

`D:\VROO_Electron\Character\`

## 2. 테스트
개발 서버를 실행한 뒤 아래 파일을 엽니다.

`Character/Integration/examples/garage-character-demo.html`

file:// 직접 열기보다 기존 VROO 로컬 서버에서 확인하세요. JSON fetch는 서버 환경이 필요합니다.

## 3. 기존 Garage에 연결
```js
import { VrooCharacterLoader } from "../../Character/Integration/js/vroo-character-loader.js";

const characters = new VrooCharacterLoader({
  baseUrl: "../../Character"
});

await characters.loadManifest();
characters.renderInto("#garageVehicleStage", "vroo-heritage");
```

HTML:
```html
<div id="garageVehicleStage" class="vroo-character-stage"></div>
```

CSS:
```html
<link rel="stylesheet" href="../../Character/Integration/css/vroo-character.css">
```

프로젝트의 실제 상대경로에 맞게 `../../Character` 부분만 조정하세요.

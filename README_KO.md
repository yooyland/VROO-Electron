# VROO Desktop 1.1.0-beta.1

기존 Web Prototype의 localhost·PowerShell 서버 방식을 제거하고 Electron 데스크톱 앱으로 전환한 프로젝트입니다.

## 핵심 변화

- localhost 서버 불필요
- PowerShell 서버 불필요
- Python 불필요
- Electron 창에서 로컬 앱 직접 실행
- `VROO.exe`와 Windows 설치파일 제작 가능
- 지도, GPS, GRID, 3D 도로, 채팅, 음성, 성장, 상점, 커뮤니티, MY PAGE 모듈 유지
- `contextIsolation`, `sandbox`, `nodeIntegration: false` 적용

Electron은 웹 기술을 데스크톱 앱으로 패키징하고 배포할 수 있는 구조를 제공합니다. 공식 문서도 기본 앱 구성과 배포 과정을 안내합니다.

## 처음 한 번 실행

1. Node.js LTS가 설치되어 있어야 합니다.
2. `01_INSTALL_AND_RUN.cmd`를 실행합니다.
3. 인터넷을 통해 Electron 패키지가 설치됩니다.
4. 설치가 끝나면 VROO 데스크톱 앱이 바로 열립니다.

## 다음 실행

`02_RUN_VROO.cmd`

또는 프로젝트 루트에서:

```bash
npm start
```

## VROO.exe 만들기

`03_BUILD_EXE.cmd`

빌드가 끝나면 `dist` 폴더에 다음 파일이 만들어집니다.

- Windows 설치파일
- Portable VROO.exe

## 중요

이 전달 파일에는 Electron 실행 바이너리가 포함되어 있지 않습니다. Electron 패키지는 용량이 크고 현재 작업 환경에서 npm 다운로드가 완료되지 않아, 사용자 PC에서 `npm install` 후 빌드하도록 구성했습니다.

지도와 Three.js CDN은 현재 인터넷 연결을 사용합니다. 다음 단계에서 지도·3D 라이브러리까지 앱에 내장하면 오프라인 실행 구조로 전환할 수 있습니다.

### 미사용 파일: `app/assets/server/server.ps1`

이전 Web Prototype용 로컬 정적 파일 서버입니다. **Electron 데스크톱 앱에서는 사용하지 않습니다.**  
정상 실행은 PowerShell 서버 없이 `npm start`만으로 가능합니다. 참고용으로만 남겨 두었으며, 일반 실행 경로에 포함하지 마세요.


## Desktop 1.1.0-beta.1 — VROO 자체 지명 레이어

- 글자가 포함되지 않은 CARTO Voyager No Labels 베이스맵 사용
- 지도 타일의 한글 표기에 의존하지 않음
- VROO가 장소명·도로명·역명·문화유산명을 별도 레이어로 표시
- 확대 단계에 따라 지명을 자동 표시·숨김
- `지명 ON/OFF` 버튼 추가
- 잘못 알려진 명칭을 정정하는 이름 보정 사전 추가
- `삼른공원`, `삼릉공원`, `선릉공원`은 `선정릉공원`으로 정규화
- 선정릉공원 설명: `선릉과 정릉이 있는 선정릉공원`
- 현재 기본 등록:
  - 선정릉공원
  - 선릉
  - 정릉
  - 선릉역
  - 선정릉역
  - 테헤란로
  - 선릉로
  - 삼성동

장소 데이터는 `app/assets/js/modules/places.js`에서 독립적으로 관리합니다.
향후 서버의 전국 POI 데이터와 연결해도 지도 모듈을 수정하지 않도록 분리했습니다.

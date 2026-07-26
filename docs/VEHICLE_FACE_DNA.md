# Vehicle Face DNA

**Completion Status:** `Draft`  
**Issue:** [#2](https://github.com/yooyland/VROO-Electron/issues/2)  
**Scope:** 설계 문서만 (구현·에셋 생성·기존 UI 교체 없음)

> Completion System: **Draft → Review → Complete → Bible**  
> 본 문서는 Draft다. Complete / Bible 승격은 최종 승인 전까지 금지한다.

---

## 1. 목적

VROO에서 **차량 = 사용자 아바타**다 (`docs/PRODUCT_VISION.md`).  
Vehicle Face DNA는 그 아바타가 **전면(페이스)에서 한눈에 구분·기억·성장 표현**되도록 하는 **시각 정체성 설계의 출발점**이다.

이 문서는 다음을 한다.

- 현재 프로토타입에서 Face가 어떻게 표현되는지 정리
- Face DNA가 다뤄야 할 축(초안) 제안
- 화면별 적용 경계와 금지 사항 명시
- 이슈 본문을 확인하지 못한 채 남는 **확인 필요 항목** 기록

이 문서는 다음을 하지 않는다.

- 앱 코드·에셋·상점 UI 구현
- 최종 아트 확정
- 미구현 기능을 완료처럼 표시

---

## 2. 제품 근거 (기존 문서)

| 근거 | 내용 |
|------|------|
| 제품 정의 | 위치 위에서 차량을 아바타로 사용 |
| 핵심 가치 | 외관·레벨·아이템이 정체성 |
| STORE | 차량 스킨·휠·LED 등 planned |
| MY | MY CAR / 프로필 prototype |
| 디자인 | Black & Gold · 고급 자동차 UI · 버튼 최소화 |
| 상태 표기 | `implemented` / `prototype` / `planned`만 사용 |

관련 상태표: [FEATURE_STATUS.md](./FEATURE_STATUS.md)

---

## 3. 현재 구현 인벤토리 (main 기준, 코드 확인)

### 3.1 리스트·프로필 UI (2D)

| 위치 | 표현 | 상태 |
|------|------|------|
| `app/assets/js/modules/data.js` | 차종 카탈로그 `cars` — id / 표시명 / emoji | prototype |
| nearby / grid / growth / profile / shop | `.avatar`에 emoji 표시 | prototype |
| 번호판 | 마스킹·크레딧 공개 규칙 존재 | prototype |

Face DNA와 별개로, **현재 2D 페르소나 신호는 사실상 emoji + 닉네임 + 레벨**이다.

### 3.2 도로 뷰 (3D procedural)

`app/assets/js/modules/road.js` 의 `createCarGroup` / `applyCarAppearance`:

- 외부 GLTF 없이 Geometry 조합
- 레벨 → `carTier` 로 차체 비율·휠·스포일러·언더글로우 등 단계 변화
- 전면 신호: front bumper + 좌/우 headlight (`headL` / `headR`)
- 후면 신호: tail light
- 내 차량 강조색 / 타 사용자 `user.id` 기반 body color
- 단일 renderer · 단일 animation loop 유지 (기존 개발 원칙)

즉 **도로 Face의 프로토타입 DNA는 “헤드라이트 쌍 + 범퍼 + 차체색 + 티어 실루엣”** 이다.

### 3.3 지도 마커

지도는 차량/장소 마커를 구분한다. Face DNA의 정면 초상화와는 해상도·목적이 다르다.  
지도에서는 **식별 가능·시인성**이 우선이며, 도로/MY CAR 페이스와 1:1 픽셀 복제를 요구하지 않는다(초안 원칙).

### 3.4 아직 없는 것 (planned / 미존재)

- 차량 스킨·휠·LED 상점 판매 (`feature-status`: planned)
- 승인된 캐릭터 아트 파이프라인 문서 (main에 Character Bible / Face DNA 선행 문서 없음)
- `docs/UI_BIBLE.md`, `docs/AUTOMOTIVE_BIBLE.md` 등 공식 Bible 파일 (현재 저장소에 없음)

---

## 4. Face DNA 초안 정의

### 4.1 한 줄 정의

**Vehicle Face DNA** = 차량 아바타의 **전면 시그니처**를 구성하는 불변·가변 요소의 규칙 집합.  
멀리서도 “VROO 차량 캐릭터”로 읽히고, 가까이서는 레벨·아이템·개성이 읽혀야 한다.

### 4.2 DNA 축 (Draft — 확정 아님)

| 축 | 역할 | 현재 대응 | 향후(planned, 미구현) |
|----|------|-----------|------------------------|
| **Silhouette** | 차체 비율·전고·전폭 | 3D tier 박스 비율 | 차종별 실루엣 프리셋 |
| **Light Signature** | 헤드라이트 형태·간격·발광 | 좌우 box light | 스킨/LED 시그니처 |
| **Mouth / Grille** | 전면 하단 성격 | front bumper 단순형 | 그릴·인테이크 스타일 |
| **Eyes / Gaze** | 시선·온라인감 | light intensity by tier | 상태(온라인/주행/대기) |
| **Accent** | 브랜드·성장 강조 | Black & Gold / me color | 시즌·멤버십 악센트(표현만) |
| **Identity Bind** | 사용자와 차량 연결 | `user.id`, nickname, car id | 스킨·아이템 장착 슬롯 |

### 4.3 화면별 적용 경계 (Draft)

| 표면 | Face DNA 목표 | 비고 |
|------|----------------|------|
| 도로 (Three.js) | 가장 풍부한 Face | procedural 유지 가능, 에셋 교체는 별도 승인 |
| MY CAR / 상세 | 중해상도 전면 초상 | emoji-only에서 단계적 이전(planned) |
| 주변 목록·채팅 | 소형 페이스 썸네일 | 가독성·성능 우선 |
| 지도 마커 | 축소 시인성 아이콘 | Face 전체 복제 금지 |
| STORE 스킨 프리뷰 | DNA 축을 건드리는 미리보기 | 실결제 문구·완료 위장 금지 |

---

## 5. 설계 원칙 (Draft)

1. **차량이 주인공** — 닉네임·배지보다 Face/실루엣이 먼저 읽혀야 한다.
2. **성장이 눈에 보여야 한다** — 레벨/티어 변화가 Face·실루엣에 반영된다 (현재 3D tier가 선례).
3. **동일 DNA, 해상도만 다름** — 목록/지도/도로가 서로 다른 자산이어도 시그니처 축은 공유한다.
4. **Black & Gold 유지** — 기본 팔레트·고급 자동차 톤을 깨는 무지개/과한 네온 남발을 피한다. 언더글로우 등은 tier 보상으로만.
5. **운전 방해 최소화** — 도로·지도에서 Face 애니/이펙트는 절제한다.
6. **상태 정직** — 스킨·LED·캐릭터 아트가 없으면 `planned` / prototype 표시. 완료처럼 포장하지 않는다.
7. **기존 아키텍처 보호** — Animation Loop 하나, Renderer 중복 생성 금지, 이벤트 중복 등록 금지.
8. **번호판 ≠ Face** — 번호판은 프라이버시·공개 규칙 영역. Face DNA에 번호판 텍스트를 심지 않는다.

---

## 6. 데이터·식별자 경계 (초안)

기존 식별자 규칙을 유지한다.

| 키 | 용도 |
|----|------|
| `user.id` | 사용자 키 (닉네임 ≠ 키) |
| `profile.car` / `user.car` | 차종 카탈로그 id (`data.js`) |
| `level` → tier | 성장 표현 |
| (향후) skin / parts ids | STORE planned — 스키마는 별도 승인 후 |

**금지 (현재 단계):** 실결제, 실보험 확정, 외부 사고 전송, 민감정보 필드, 서버 임의 추가.

Face DNA 설계는 **로컬 프로토타입의 표현 규칙**에 한정한다. 서버 동기화·유료 스킨 확정은 범위 밖이다.

---

## 7. Completion 경로

| 단계 | 의미 | 본 문서 |
|------|------|---------|
| **Draft** | 설계 시작, 리뷰 대기 | ← 현재 |
| Review | 제품 오너/디렉터 피드백 반영 | 대기 |
| Complete | 구현 착수 가능한 합의본 | 승인 전 금지 |
| Bible | 공식 Automotive/UI Bible로 편입 | 승인 전 금지 |

관련 후속(참고): 캐릭터/에셋 명명·뷰포인트·폴백 등은 Face DNA가 Review를 통과한 뒤 Automotive Character Bible 계열 문서로 확장할 수 있다.  
main에는 해당 Bible 파일이 아직 없다.

---

## 8. 확인 필요 (Ambiguity)

GitHub Issue #2 본문은 이 실행 환경의 integration 토큰으로 **조회 불가**(Issues API 403)였다.  
트리거 코멘트만으로 확인된 지시:

- 협업명령: **Vehicle Face DNA 설계 시작**
- **문서 작업만** 수행
- 전용 브랜치 + Draft PR

아래는 **가정하면 안 되는 항목**이므로 승인을 요청한다.

1. Issue #2 본문에 지정된 **필수 산출물 파일명·목차**가 있는가?
2. Face DNA가 **2D 일러스트 / 3D procedural / 둘 다** 중 어디를 1차 타깃으로 하는가?
3. 기존 emoji 차종 카탈로그를 **유지한 채 보강**인가, **교체 로드맵**인가?
4. STORE 스킨·LED를 이번 DNA 초안에 **슬롯 수준까지** 넣을 것인가, Face 시그니처만 다룰 것인가?
5. 공식 문서군(`UI_BIBLE`, `AUTOMOTIVE_BIBLE` 등)이 추가될 때 Face DNA를 **독립 문서 유지** vs **Bible 챕터로 흡수** 중 어느 쪽인가?
6. 승인 아트 소스(외부 캐릭터 팩 등)가 이미 있다면 **경로·라이선스·승인 상태**는?

위 항목 확인 전까지는 구현 착수·에셋 교체·Complete 표기를 하지 않는다.

---

## 9. 다음 허용 작업 (승인 후)

문서 Review 통과 시에만 검토:

1. DNA 축별 토큰(색·비율·라이트 간격) 표 확정
2. 화면별 폴백 행렬 (에셋 없음 → procedural / emoji)
3. STORE planned 아이템이 건드리는 DNA 축 매핑
4. (별도 이슈) Automotive Character Bible 초안과의 목차 정렬

---

## 10. 변경 이력

| 날짜 | 내용 | 상태 |
|------|------|------|
| 2026-07-26 | Issue #2 협업명령에 따라 설계 문서 최초 작성 | Draft |

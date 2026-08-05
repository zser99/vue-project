# 오늘의 날씨 — Vue 3 날씨 앱 (수업 과제)

Vue 3(Composition API) + Vite + Pinia + Vue Router + three.js. 홈은 풀스크린 3D 지구본,
Apple 스타일 다크 글래스 디자인. **`src/components/weather/체크리스트.md`(과제 요구사항)를 반드시 지킬 것**
— Axios 사용, Router(목록↔상세, 지연로딩, catch-all), Pinia, Element Plus(목록/상세 페이지만), 최종 정적 배포 + Public 저장소.

## 실행/검증

- `npm run dev` → http://localhost:5173 (백그라운드로 띄워두고 작업)
- `npm run build` 로 컴파일 확인 (three.js는 GlobeView 청크로 분리됨, 550KB 경고는 정상)
- **화면 검증**: Playwright + 헤드리스 크롬 설치되어 있음 (devDependency).
  스크래치 디렉토리에 스크립트 작성 →
  `import { chromium } from '<프로젝트>/node_modules/playwright/index.mjs'`,
  `chromium.launch({ args: ['--use-gl=angle'] })` (WebGL 필요), 스크린샷으로 확인.
  인트로 비행이 있어서 페이지 로드 후 ~3초 대기 필요.

## 구조 (전부 현역, 죽은 코드 없음)

- `src/views/GlobeView.vue` — 홈(`/`). 지구본 + 글래스 오버레이(검색/카드/단위전환/☢버튼) 조립
- `src/views/WeatherListView.vue` (`/list`), `WeatherDetailView.vue` (`/city/:cityId`), `NotFoundView.vue` (catch-all)
- `src/three/globe/` — Vue 무관 순수 three.js 모듈:
  - `createGlobeApp.js` 조립+프레임루프+dispose, `Earth.js` 커스텀 셰이더 지구,
    `shaders.js`(낮/밤 블렌딩·바다 스페큘러·림), `Atmosphere/Clouds/Starfield.js`
  - `GlobeControls.js` 커스텀 카메라 컨트롤 (구면좌표 damping, 커서 방향 줌,
    flyTo 는 easeInOutCubic + 거리비례 고도 아크 비행, 사용자 입력 시 비행 인터럽트)
  - `Markers.js` 도시 마커(수도=블루/관광=골드), `Borders.js` 국경선+국가 강조(point-in-polygon),
    `CountryLabels.js` 나라 이름 라벨(면적 LOD), `geoMath.js` 좌표 변환+태양 직하점
  - 이스터에그: `FleetBattle.js`(줌아웃 4.3R+ 시 우주 함대전), `IcbmStrike.js`(☢버튼 → 수도 간 ICBM+버섯구름)
- `src/composables/useGlobeScene.js` — Vue↔three 브리지 (three 객체는 절대 reactive 에 넣지 않음)
- `src/api/weatherApi.js` — Axios. OpenWeather(`.env` 의 `VITE_OWM_API_KEY`) + Nominatim
- `src/stores/` — `configStore`(℃/℉), `weatherCacheStore`(화면 간 날씨 재사용, 키: cityId 또는 `coordKey(lat,lon)`)
- `src/data/majorCities.js`(목록 페이지 8개), `worldCities.js`(지구본 마커 61개 + `countryToCityId` 나라→수도 매핑)
- `public/textures/earth/`(day/night 4K, clouds, water — NASA 계열), `public/geo/countries.geojson`
  (Natural Earth 110m, properties: `n`=한국어명, `c`=[lat,lon] 라벨 앵커, `a`=면적)

## 핵심 규약/함정 (어기면 고생)

1. **지구 메시는 절대 회전 금지** (연출은 카메라가 담당). 좌표 변환 규약:
   그리니치=+x, 동경90°=-z, 북극=+y. `latLonToVector3`/`vector3ToLatLon` (geoMath.js) 만 사용.
2. **검색 폴백 순서**: worldCities 도시명 → `countryToCityId`(나라→수도) →
   한글이면 Nominatim 우선/영문이면 OWM 우선. **OWM 지오코딩은 한글에 부정확**
   ('몽골'→인도네시아 Monggol 마을 오답 전력). `data/2.5/weather?q=` 한글 미지원.
3. **라벨/스프라이트는 depthTest:false + renderOrder** — 곡면 가장자리에서 지구에 파고들어 잘림.
   뒷면 숨김은 horizon 코사인 페이드로 처리 (Markers/CountryLabels 참조).
4. **raycast 제외 대상은 `obj.raycast = () => {}`** (구름/대기/별/라벨/함대). 픽킹 우선순위: 마커 히트구 → 지구 표면.
   raycast 교차 결과에서 userData 는 `hit.object.userData` (hit.userData 아님 — 과거 버그).
5. **카드 토글**: 카드 떠 있을 때 지구본 클릭 = 닫기 (새 카드 X). 검색은 교체.
6. **상세 페이지 라우팅**: majorCities 8개는 `/city/:cityId`, 그 외는
   `/city/search?lat&lon&name` 쿼리 방식. 캐시 키도 동일 규칙.
7. 디자인 토큰은 `src/assets/theme.css` (`--glass-*`, `--bg-space`, `.glass-pill/.glass-panel`).
   Element Plus 는 항상 다크(html.dark 고정), 지구본 화면엔 EP 쓰지 말 것 (커스텀 글래스만).
8. dispose 철저히: 라우트 이탈 시 geometry/material/texture dispose + `forceContextLoss()` (createGlobeApp 참조).
9. `.env` 는 커밋해도 되는 공개 무료 키. 새 API 키 필요 없음 (reverse geocode 도 같은 키, Nominatim 은 키 불필요).

## 남은 체크리스트 항목 (4일차)

- [ ] `npm run build` + base 경로 확인 → Vercel/Netlify/GitHub Pages 정적 배포
- [ ] 저장소 Public 확인 (시크릿 창으로 검증) — **현재 git 저장소 아님, `git init` 부터 필요**
- [ ] 제출 전 회귀: 지구본 클릭/검색(한글·나라이름)/마커 → 카드 → 상세 왕복, /list 검색, 404, 이스터에그 2종

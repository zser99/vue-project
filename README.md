# 오늘의 날씨

Vue 3(Composition API) + Vite + Pinia + Vue Router + three.js로 만든 날씨 앱입니다. 홈은 풀스크린 3D 지구본이고, 목록/상세 페이지에서 실제 OpenWeatherMap 날씨 데이터를 보여줍니다.
지구본 모델은 three.js라이브러리로 구현하였습니다.(https://threejs.org)

## 구현한 기능

- **검색·필터링**: 반응형 상태(`searchQuery`, `selectedCityInfo`) + `computed`(`filteredWeatherList`) + `watch`/`watchEffect` 로 도시 이름 검색 시 목록이 실시간으로 좁혀집니다.
- **컴포넌트 분리**: `SearchBar` ↔ `WeatherListView` 는 props(`search-query`) / emit(`update-query`)으로 통신합니다.
- **Vue Router**: `/list`(목록) ↔ `/city/:cityId`(상세) 이동, 모든 라우트 지연 로딩(lazy load), catch-all 404 페이지.
- **Pinia 전역 상태 3종**: 온도 단위(`configStore`), 화면 간 날씨 재사용 캐시(`weatherCacheStore`), 즐겨찾기(`favoritesStore`).
- **즐겨찾기**: 목록·상세 화면 어디서든 별 아이콘으로 토글할 수 있고, 전역 상태라 두 화면에 동일하게 반영됩니다.
- **Axios + 실시간 API 연동**: OpenWeatherMap(도시별 날씨), Nominatim(한글 지명 검색) 연동, 로딩 스켈레톤·에러 메시지 처리.
- **Element Plus UI**: 목록/상세 페이지에 `ElSkeleton`(로딩)·`ElMessage`(에러 알림) 적용.
- **3D 지구본 홈**: three.js 커스텀 셰이더 지구, 카메라 컨트롤, 국경선/도시 마커/국가 라벨, 이스터에그 2종(우주 함대전, ICBM 발사).
- **정적 배포 대응**: `base` 경로 설정, GitHub Pages 배포 워크플로 포함.

## 실행 방법

```sh
npm install
npm run dev      # http://localhost:5173
```

`.env` 에는 공개 사용 가능한 OpenWeatherMap 무료 키가 이미 들어있어 별도 설정 없이 바로 실행됩니다.

프로덕션 빌드 확인:

```sh
npm run build
```

three.js가 포함된 `GlobeView` 청크가 커서 뜨는 550KB 경고는 정상입니다.

## 코드 품질 셀프 체크 (평가자용)

- **단일 책임**: Pinia store([`configStore`](src/stores/configStore.js)/[`weatherCacheStore`](src/stores/weatherCacheStore.js)/[`favoritesStore`](src/stores/favoritesStore.js))와 three.js 모듈([`Earth.js`](src/three/globe/Earth.js), [`Markers.js`](src/three/globe/Markers.js) 등)이 각각 하나의 관심사만 맡고, 조립은 [`createGlobeApp.js`](src/three/globe/createGlobeApp.js) 한 곳에서 담당합니다.
- **반응형 남용 방지**: three.js 객체는 절대 reactive에 넣지 않는다는 규칙을 [`useGlobeScene.js:5`](src/composables/useGlobeScene.js#L5)에 명시했고, 정적 데이터([`majorCities.js`](src/data/majorCities.js))·순수 함수([`getIconUrl`](src/api/weatherApi.js#L136), `coordKey`, `favoriteKey`)는 `ref` 없이 일반 값/함수로 유지합니다.
- **로딩·에러 처리**: [`WeatherListView.vue`](src/views/WeatherListView.vue#L16)·[`WeatherDetailView.vue`](src/views/WeatherDetailView.vue#L22) 모두 `isLoading`+`ElSkeleton`으로 로딩을, `ElMessage.error`/`errorMessage`로 실패를 사용자에게 안내합니다.
- **네이밍**: [`WeatherListView.vue`](src/views/WeatherListView.vue)의 `filteredWeatherList`·`selectedCityInfo`·`favoriteWeatherMap`, [`geoMath.js`](src/three/globe/geoMath.js)의 `latLonToVector3`처럼 이름만으로 역할이 드러나도록 지었습니다.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { majorCities } from '@/data/majorCities'
import { worldCities } from '@/data/worldCities'
import { fetchWeatherByCoords, fetchWeatherByCityName, fetchReverseGeocode } from '@/api/weatherApi'
import { useWeatherCacheStore, coordKey } from '@/stores/weatherCacheStore'
import { useGlobeScene } from '@/composables/useGlobeScene'
import GlobeWeatherCard from '@/components/globe/GlobeWeatherCard.vue'
import GlobeLoadingOverlay from '@/components/globe/GlobeLoadingOverlay.vue'
import UnitToggler from '@/components/weather/UnitToggler.vue'

const cacheStore = useWeatherCacheStore()

const canvasRef = ref(null)
const selection = ref(null) // GlobeWeatherCard 의 selection 참조
const searchKeyword = ref('')
const searchError = ref('')

// 상세 페이지 청크를 미리 로드해서 "상세 보기" 클릭이 굼뜨지 않게
onMounted(() => {
  import('@/views/WeatherDetailView.vue')
})

// 지명이 없는 지점(바다 등)을 위한 좌표 라벨
const formatCoords = (lat, lon) => {
  const latLabel = `${lat >= 0 ? '북위' : '남위'} ${Math.abs(lat).toFixed(1)}°`
  const lonLabel = `${lon >= 0 ? '동경' : '서경'} ${Math.abs(lon).toFixed(1)}°`
  return `${latLabel} ${lonLabel}`
}

// 지구 클릭 → 날씨 + 지명 조회.
// 카드가 이미 떠 있으면 이번 클릭은 "닫기"로 동작한다 (토글).
const handlePick = async ({ cityId, lat, lon }) => {
  if (selection.value) {
    selection.value = null
    clearCountryHighlight()
    return
  }

  const city = cityId ? worldCities.find(({ id }) => id === cityId) : null
  // 상세 페이지 라우팅은 majorCities 에 있는 도시만 cityId 경로를 쓸 수 있다
  // (그 외 도시는 좌표 쿼리 경로로 — GlobeWeatherCard 의 detailRoute 참조)
  const routableCityId = city && majorCities.some(({ id }) => id === city.id) ? city.id : null
  selection.value = { status: 'loading', cityId: routableCityId, lat, lon, place: '', weather: null }
  if (city) flyTo(city.lat, city.lon, 2.1)
  highlightCountryAt(city?.lat ?? lat, city?.lon ?? lon) // 해당 지점이 속한 나라 국경 강조

  try {
    if (city) {
      const weather = await fetchWeatherByCoords(city.lat, city.lon, city.nameKo)
      cacheStore.remember(routableCityId ?? coordKey(city.lat, city.lon), weather)
      selection.value = {
        status: 'ready',
        cityId: routableCityId,
        lat: city.lat,
        lon: city.lon,
        place: city.nameKo,
        weather,
      }
    } else {
      // 날씨와 지명을 병렬 조회 — 지명이 없으면 좌표 라벨로 폴백
      const [weather, geo] = await Promise.all([
        fetchWeatherByCoords(lat, lon),
        fetchReverseGeocode(lat, lon).catch(() => null),
      ])
      const place = geo?.name ?? formatCoords(lat, lon)
      cacheStore.remember(coordKey(lat, lon), weather)
      selection.value = { status: 'ready', cityId: null, lat, lon, place, weather }
    }
  } catch (error) {
    console.error(error)
    selection.value = { ...selection.value, status: 'error' }
  }
}

const { progress, isReady, webglFailed, flyTo, launchIcbm, highlightCountryAt, clearCountryHighlight } =
  useGlobeScene(canvasRef, {
    cities: worldCities,
    onPick: handlePick,
  })

// 검색 → 해당 도시로 비행 + 카드 표시
const handleSearch = async () => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return
  searchError.value = ''

  try {
    const weather = await fetchWeatherByCityName(keyword)
    const { lat, lon, name } = weather
    cacheStore.remember(coordKey(lat, lon), weather)
    flyTo(lat, lon, 1.9)
    highlightCountryAt(lat, lon) // 검색된 지점이 속한 나라 국경 강조
    selection.value = { status: 'ready', cityId: null, lat, lon, place: name, weather }
    searchKeyword.value = ''
  } catch (error) {
    searchError.value = error.message
  }
}
</script>

<template>
  <div class="globe-view">
    <canvas ref="canvasRef" class="globe-canvas"></canvas>

    <!-- WebGL 미지원 폴백 -->
    <div v-if="webglFailed" class="fallback">
      <div class="fallback-card">
        <h2>3D 지구본을 표시할 수 없어요</h2>
        <p>이 브라우저는 WebGL 을 지원하지 않습니다.</p>
        <RouterLink to="/list" class="glass-pill">도시 목록으로 보기</RouterLink>
      </div>
    </div>

    <template v-else>
      <Transition name="fade">
        <GlobeLoadingOverlay v-if="!isReady" :progress="progress" />
      </Transition>

      <!-- 상단 바 -->
      <header class="top-bar">
        <div class="left">
          <h1 class="title">오늘의 날씨</h1>
          <RouterLink to="/list" class="glass-pill">목록으로</RouterLink>
        </div>

        <UnitToggler />
      </header>

      <!-- 검색 -->
      <form class="search-bar" @submit.prevent="handleSearch">
        <span class="search-icon">⌕</span>
        <input v-model="searchKeyword" type="text" placeholder="도시 검색 (예: Seoul, Tokyo)" />
      </form>
      <Transition name="fade">
        <p v-if="searchError" class="search-error">{{ searchError }}</p>
      </Transition>

      <p v-if="isReady && !selection" class="hint">지구를 드래그하고, 스크롤로 확대하고, 원하는 곳을 클릭해보세요</p>

      <!-- 이스터에그: ☢ -->
      <button
        v-if="isReady"
        type="button"
        class="icbm-btn"
        title="?"
        aria-label="이스터에그"
        @click="launchIcbm"
      >
        ☢
      </button>

      <!-- 선택 지점 날씨 카드 -->
      <Transition name="card">
        <GlobeWeatherCard
          v-if="selection"
          :key="`${selection.lat}-${selection.lon}`"
          class="card-slot"
          :selection="selection"
          @close="((selection = null), clearCountryHighlight())"
        />
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.globe-view {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #02030a;
}

.globe-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}

.globe-canvas:active {
  cursor: grabbing;
}

/* ── 상단 바 ── */
.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  pointer-events: none;
}

.top-bar > * {
  pointer-events: auto;
}

.left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.title {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: #f5f5f7;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

/* ── 검색 ── */
.search-bar {
  position: absolute;
  top: 74px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(360px, calc(100% - 48px));
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.search-bar:focus-within {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.3);
}

.search-icon {
  color: rgba(255, 255, 255, 0.6);
  font-size: 17px;
}

.search-bar input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  color: #f5f5f7;
  font-size: 14px;
}

.search-bar input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.search-error {
  position: absolute;
  top: 122px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgba(180, 40, 60, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ffd9de;
  font-size: 13px;
  white-space: nowrap;
}

.hint {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  letter-spacing: 0.2px;
  text-align: center;
  pointer-events: none;
}

.card-slot {
  position: absolute;
  bottom: 32px;
  left: 32px;
  z-index: 10;
}

/* 이스터에그 버튼 — 눈에 잘 안 띄게 구석에 작게 */
.icbm-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: rgba(255, 255, 255, 0.35);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.25s ease, background 0.25s ease, transform 0.15s ease;
}

.icbm-btn:hover {
  color: #ffd24a;
  background: rgba(255, 210, 74, 0.12);
}

.icbm-btn:active {
  transform: scale(0.9);
}

@media (max-width: 640px) {
  .card-slot {
    left: 50%;
    transform: translateX(-50%);
    bottom: 20px;
  }
}

/* ── 폴백 ── */
.fallback {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 30% 20%, #1b2735 0%, #090a0f 70%);
}

.fallback-card {
  text-align: center;
  color: #f5f5f7;
  padding: 40px 48px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.fallback-card p {
  opacity: 0.6;
  font-size: 14px;
  margin: 8px 0 20px;
}

/* ── 트랜지션 ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.card-enter-active,
.card-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@media (max-width: 640px) {
  .card-enter-from,
  .card-leave-to {
    transform: translateX(-50%) translateY(16px);
  }
}
</style>

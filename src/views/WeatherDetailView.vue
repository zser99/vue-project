<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { ElSkeleton } from 'element-plus'
import { majorCities } from '@/data/majorCities'
import { fetchWeatherByCoords, getIconUrl } from '@/api/weatherApi'
import { useTemperature } from '@/composables/useTemperature'
import { useWeatherCacheStore, coordKey } from '@/stores/weatherCacheStore'

const route = useRoute()
// majorCities 에 없는 도시(검색 결과)는 route.query 에 실린 좌표로 임시 city 를 구성한다
const city = computed(() => {
  const known = majorCities.find((c) => c.id === route.params.cityId)
  if (known) return known
  const { lat, lon, name } = route.query
  if (lat && lon && name) return { nameKo: name, lat: Number(lat), lon: Number(lon) }
  return null
})

const weather = ref(null)
const isLoading = ref(true)
const errorMessage = ref('')

// OWM 아이콘 코드(맑음/구름/비/눈 등, d=낮/n=밤) → 7가지 유형으로 분류.
// CSS 그라디언트/애니메이션 대신 실제 사진(유리창 빗방울, 밤하늘 별, 번개 등)을 배경으로 쓴다.
const weatherKind = computed(() => {
  const icon = weather.value?.icon
  if (!icon) return null
  const code = icon.slice(0, 2)
  if (code === '01') return icon.endsWith('n') ? 'clear-night' : 'clear-day'
  if (['02', '03', '04'].includes(code)) return 'clouds'
  if (['09', '10'].includes(code)) return 'rain'
  if (code === '11') return 'thunderstorm'
  if (code === '13') return 'snow'
  if (code === '50') return 'mist'
  return 'clouds'
})

// public/images/weather/ — Wikimedia Commons CC0/CC-BY(-SA) 사진 (출처: 각 파일의 EXIF/설명 참조)
const WEATHER_PHOTOS = {
  'clear-day': 'clear-day.jpg',
  'clear-night': 'clear-night.jpg',
  clouds: 'clouds.jpg',
  rain: 'rain.jpg',
  thunderstorm: 'thunderstorm.jpg',
  snow: 'snow.jpg',
  mist: 'mist.jpg',
}
const weatherBackground = computed(() => {
  const kind = weatherKind.value
  if (!kind) return null
  return `url('${import.meta.env.BASE_URL}images/weather/${WEATHER_PHOTOS[kind]}')`
})

const { displayTemp, unitSymbol } = useTemperature(computed(() => weather.value?.tempC))
const { displayTemp: displayFeelsLike } = useTemperature(computed(() => weather.value?.feelsLikeC))
const { displayTemp: displayTempMin } = useTemperature(computed(() => weather.value?.tempMinC))
const { displayTemp: displayTempMax } = useTemperature(computed(() => weather.value?.tempMaxC))

// 초 단위 시각을 "오전 06:12" 같은 형태로 변환
const formatTime = (unixSeconds) => {
  if (!unixSeconds) return '-'
  return new Date(unixSeconds * 1000).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const cacheStore = useWeatherCacheStore()

onMounted(async () => {
  if (!city.value) {
    errorMessage.value = '존재하지 않는 도시입니다.'
    isLoading.value = false
    return
  }

  // 목록/지구본에서 이미 받아온 데이터가 있으면 스켈레톤 없이 즉시 표시
  const cityId = route.params.cityId
  const key = majorCities.some(({ id }) => id === cityId)
    ? cityId
    : coordKey(city.value.lat, city.value.lon)
  const cached = cacheStore.recall(key)
  if (cached) {
    weather.value = cached
    isLoading.value = false
  }

  try {
    // 캐시 유무와 관계없이 최신 데이터로 갱신 (캐시가 있으면 조용히 교체)
    weather.value = await fetchWeatherByCoords(city.value.lat, city.value.lon, city.value.nameKo)
    cacheStore.remember(key, weather.value)
  } catch (error) {
    if (!cached) errorMessage.value = '날씨 정보를 불러오지 못했습니다.'
    console.error(error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="weather-detail" :style="{ '--weather-bg': weatherBackground }">
    <div v-if="weatherKind" class="weather-fx" :class="`fx-${weatherKind}`" aria-hidden="true"></div>
    <RouterLink to="/list" class="back-link">← 목록으로</RouterLink>

    <ElSkeleton v-if="isLoading" :rows="8" animated />
    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-else class="detail-card">
      <h2>{{ city.nameKo }}</h2>
      <img :src="getIconUrl(weather.icon)" :alt="weather.description" />
      <p class="temp">{{ displayTemp }}{{ unitSymbol }}</p>
      <p class="desc">{{ weather.description }}</p>

      <ul class="detail-list">
        <li>
          <span>체감 온도</span>
          <span>{{ displayFeelsLike }}{{ unitSymbol }}</span>
        </li>
        <li>
          <span>최저 / 최고</span>
          <span>{{ displayTempMin }}{{ unitSymbol }} / {{ displayTempMax }}{{ unitSymbol }}</span>
        </li>
        <li>
          <span>습도</span>
          <span>{{ weather.humidity }}%</span>
        </li>
        <li>
          <span>기압</span>
          <span>{{ weather.pressure }} hPa</span>
        </li>
        <li>
          <span>풍속</span>
          <span>{{ weather.windSpeed }} m/s</span>
        </li>
        <li>
          <span>일출</span>
          <span>{{ formatTime(weather.sunrise) }}</span>
        </li>
        <li>
          <span>일몰</span>
          <span>{{ formatTime(weather.sunset) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.weather-detail {
  max-width: 480px;
  margin: 0 auto;
}

/* 현재 날씨(맑음/구름/비/눈 등)에 맞춰 바뀌는 전체 화면 배경.
   켄번즈 효과: 아주 느리게 확대+대각선 이동을 왕복해서 정지 사진에 생동감을 준다.
   position:fixed 라 확대되며 넘치는 부분은 뷰포트 밖으로 자연히 잘려서 별도 overflow 처리가 필요 없다. */
.weather-detail::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--weather-bg, var(--bg-space)) center / cover no-repeat;
  transition: background-image 0.6s ease;
  transform-origin: center center;
  animation: ken-burns 26s ease-in-out infinite alternate;
  will-change: transform;
}

@keyframes ken-burns {
  from {
    transform: scale(1) translate(0, 0);
  }
  to {
    transform: scale(1.12) translate(-1.5%, -1.5%);
  }
}

/* 사진 위 스크림 — 어떤 사진이든 카드/텍스트 대비가 항상 확보되도록 위는 옅게, 아래(카드 영역)는 짙게.
   뇌우만 사진이 정적이라 아쉬운 부분(번개)을 흰 플래시로 살려준다. */
.weather-fx {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(4, 6, 14, 0.1) 0%, rgba(4, 6, 14, 0.5) 100%);
}

.fx-thunderstorm::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  animation: lightning-flash 6s ease-in-out infinite;
}

@keyframes lightning-flash {
  0%,
  91%,
  94%,
  100% {
    opacity: 0;
  }
  92% {
    opacity: 0.5;
  }
  93% {
    opacity: 0.12;
  }
}

.back-link {
  display: inline-block;
  margin-bottom: 18px;
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s ease;
}

.back-link:hover {
  background: var(--glass-bg-hover);
}

.error {
  text-align: center;
  padding: 40px 0;
  color: var(--text-secondary);
}

.detail-card {
  /* 이 페이지만 더 밝은 글래스로 — 공용 --glass-bg-strong(어두운 톤)은 지구본 카드 등에서도 쓰이므로 건드리지 않는다 */
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: var(--radius-card);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  padding: 32px;
  text-align: center;
  animation: cardIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.detail-card h2 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.detail-card img {
  width: 96px;
  height: 96px;
  filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.4));
}

.temp {
  font-size: 52px;
  font-weight: 200;
  line-height: 1.1;
}

.desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 6px 0 16px;
}

.detail-list {
  list-style: none;
  padding: 0;
  margin-top: 16px;
  text-align: left;
}

.detail-list li {
  display: flex;
  justify-content: space-between;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 14px;
}

.detail-list li:last-child {
  border-bottom: none;
}

.detail-list li span:first-child {
  color: var(--text-tertiary);
}
</style>

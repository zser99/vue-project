<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { getIconUrl } from '@/api/weatherApi'
import { useTemperature } from '@/composables/useTemperature'
import { useFavoritesStore, favoriteKey } from '@/stores/favoritesStore'

const props = defineProps({
  city: { type: Object, required: true }, // majorCities 의 항목 (id, nameKo, query)
  weather: { type: Object, default: null }, // 정규화된 날씨 데이터, 로딩 전이면 null
  query: { type: Object, default: () => ({}) }, // majorCities 에 없는 도시(검색 결과)를 상세 페이지에서 다시 조회하기 위한 좌표
})

// 카드에는 간단한 정보만: 온도는 computed 로 단위에 맞게 변환
const tempCRef = computed(() => props.weather?.tempC)
const { displayTemp, unitSymbol } = useTemperature(tempCRef)

const favoritesStore = useFavoritesStore()
const lat = computed(() => props.city.lat ?? props.query.lat)
const lon = computed(() => props.city.lon ?? props.query.lon)
const key = computed(() => favoriteKey(props.city.id, lat.value, lon.value))

const toggleFavorite = () => {
  favoritesStore.toggleFavorite({
    key: key.value,
    cityId: props.city.id !== 'search' ? props.city.id : null,
    nameKo: props.city.nameKo,
    lat: lat.value,
    lon: lon.value,
  })
}
</script>

<template>
  <!-- 카드를 클릭하면 상세 페이지로 라우팅된다 -->
  <RouterLink
    :to="{ name: 'weather-detail', params: { cityId: city.id }, query }"
    class="weather-card"
  >
    <button
      class="favorite-btn"
      :class="{ active: favoritesStore.isFavorite(key) }"
      aria-label="즐겨찾기 토글"
      @click.stop.prevent="toggleFavorite"
    >
      {{ favoritesStore.isFavorite(key) ? '★' : '☆' }}
    </button>
    <h3>{{ city.nameKo }}</h3>

    <template v-if="weather">
      <img :src="getIconUrl(weather.icon)" :alt="weather.description" />
      <p class="temp">{{ displayTemp }}{{ unitSymbol }}</p>
      <p class="desc">{{ weather.description }}</p>
    </template>
    <p v-else class="loading">불러오는 중...</p>
  </RouterLink>
</template>

<style scoped>
.weather-card {
  display: block;
  position: relative;
  /* 목록 페이지만 더 밝은 글래스로 — 공용 --glass-bg 는 다른 화면(검색창·필 버튼 등)도 쓰므로 여기서만 override */
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 20px;
  padding: 18px 16px;
  text-align: center;
  text-decoration: none;
  color: var(--text-primary);
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.2s ease,
    border-color 0.2s ease;
}

.weather-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.36);
}

.weather-card h3 {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.weather-card img {
  width: 64px;
  height: 64px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
}

.temp {
  font-size: 26px;
  font-weight: 200;
  line-height: 1.1;
}

.desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.loading {
  color: var(--text-tertiary);
  padding: 20px 0;
  font-size: 13px;
}

.favorite-btn {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 10px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background 0.2s ease, color 0.2s ease;
}

.favorite-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.favorite-btn.active {
  color: #ffd60a;
}
</style>

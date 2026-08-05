<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { getIconUrl } from '@/api/weatherApi'
import { useTemperature } from '@/composables/useTemperature'

const props = defineProps({
  // { status: 'loading'|'ready'|'error', place, weather, cityId, lat, lon }
  selection: { type: Object, required: true },
})

defineEmits(['close'])

const { displayTemp, unitSymbol } = useTemperature(computed(() => props.selection.weather?.tempC))
const { displayTemp: displayFeelsLike } = useTemperature(
  computed(() => props.selection.weather?.feelsLikeC),
)

// 상세 페이지 링크: 주요 도시는 cityId 로, 그 외 지점은 좌표 쿼리로
const detailRoute = computed(() => {
  const { cityId, lat, lon, place } = props.selection
  if (cityId) return { name: 'weather-detail', params: { cityId } }
  return {
    name: 'weather-detail',
    params: { cityId: 'search' },
    query: { lat, lon, name: place },
  }
})
</script>

<template>
  <aside class="weather-card">
    <button class="close-btn" aria-label="닫기" @click="$emit('close')">✕</button>

    <template v-if="selection.status === 'loading'">
      <div class="skeleton-title"></div>
      <div class="skeleton-temp"></div>
      <p class="loading-text">날씨를 불러오는 중...</p>
    </template>

    <template v-else-if="selection.status === 'error'">
      <h2>앗</h2>
      <p class="desc">이 지점의 날씨를 불러오지 못했어요.</p>
    </template>

    <template v-else>
      <p class="place">{{ selection.place }}</p>
      <div class="main-row">
        <img :src="getIconUrl(selection.weather.icon)" :alt="selection.weather.description" />
        <p class="temp">{{ displayTemp }}<span class="unit">{{ unitSymbol }}</span></p>
      </div>
      <p class="desc">{{ selection.weather.description }}</p>

      <ul class="stats">
        <li>
          <span class="label">체감</span>
          <span>{{ displayFeelsLike }}{{ unitSymbol }}</span>
        </li>
        <li>
          <span class="label">습도</span>
          <span>{{ selection.weather.humidity }}%</span>
        </li>
        <li>
          <span class="label">바람</span>
          <span>{{ selection.weather.windSpeed }} m/s</span>
        </li>
      </ul>

      <RouterLink :to="detailRoute" class="detail-link">상세 보기</RouterLink>
    </template>
  </aside>
</template>

<style scoped>
.weather-card {
  position: relative;
  width: 300px;
  padding: 24px 24px 20px;
  border-radius: 24px;
  background: rgba(20, 25, 40, 0.55);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  color: #f5f5f7;
  animation: cardIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.close-btn {
  position: absolute;
  z-index: 2; /* 지명 텍스트가 클릭을 가로채지 않도록 */
  top: 14px;
  right: 14px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.place {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
  opacity: 0.9;
  padding-right: 28px;
}

.main-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0;
}

.main-row img {
  width: 64px;
  height: 64px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
}

.temp {
  font-size: 46px;
  font-weight: 200;
  line-height: 1;
}

.unit {
  font-size: 22px;
  font-weight: 300;
  opacity: 0.7;
}

.desc {
  font-size: 13px;
  opacity: 0.65;
  margin-bottom: 14px;
}

.stats {
  list-style: none;
  padding: 12px 0 0;
  margin: 0 0 16px;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.stats li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
}

.stats .label {
  font-size: 11px;
  opacity: 0.5;
}

.detail-link {
  display: block;
  text-align: center;
  padding: 10px 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f5f5f7;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s ease;
}

.detail-link:hover {
  background: rgba(255, 255, 255, 0.26);
}

/* 로딩 스켈레톤 */
.skeleton-title,
.skeleton-temp {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.18),
    rgba(255, 255, 255, 0.08)
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-title {
  width: 40%;
  height: 16px;
  margin-bottom: 14px;
}

.skeleton-temp {
  width: 65%;
  height: 46px;
  margin-bottom: 14px;
}

.loading-text {
  font-size: 12px;
  opacity: 0.5;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
</style>

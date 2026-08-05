import { ref } from 'vue'
import { defineStore } from 'pinia'

// 좌표를 캐시 키로 정규화 (소수 2자리 ≈ 1km 정밀도면 충분)
export const coordKey = (lat, lon) => `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`

// 화면 간 이동 시 이미 조회한 날씨를 재사용하기 위한 캐시.
// 목록/지구본에서 받아온 데이터를 상세 페이지가 즉시 보여주고,
// 백그라운드에서 최신 데이터로 조용히 갱신한다.
export const useWeatherCacheStore = defineStore('weatherCache', () => {
  const cache = ref({})

  const remember = (key, weather) => {
    if (key && weather) cache.value[key] = weather
  }

  const recall = (key) => cache.value[key] ?? null

  return { cache, remember, recall }
})

<script setup>
import { ref, computed, onMounted, watch, watchEffect } from 'vue'
import { ElSkeleton, ElMessage } from 'element-plus'
import { majorCities } from '@/data/majorCities'
import { fetchWeatherByCoords, fetchWeatherByCityName } from '@/api/weatherApi'
import { useWeatherCacheStore, coordKey } from '@/stores/weatherCacheStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import WeatherListCard from '@/components/weather/WeatherListCard.vue'
import SearchBar from '@/components/weather/SearchBar.vue'

const cacheStore = useWeatherCacheStore()
const favoritesStore = useFavoritesStore()

// cityId -> 정규화된 날씨 데이터
const weatherMap = ref({})
const isLoading = ref(true)

// SearchBar 가 들고 있던 입력 상태를 부모(여기)로 끌어올림 — searchQuery prop + update-query emit 으로 연결
const searchQuery = ref('')

// 입력하는 대로 주요 도시 카드 그리드를 실시간으로 좁혀 보여준다 (검색어가 비면 전체 목록)
const filteredWeatherList = computed(() => {
  const query = searchQuery.value.trim()
  if (!query) return majorCities
  return majorCities.filter((city) => city.nameKo.includes(query))
})

// 도시 이름으로 검색한 결과 (majorCities 에 없는 도시일 수 있음) — Enter 로 실제 API 조회
const searchResult = ref(null)

// 사용자가 마지막으로 눌러본 카드 (실제 이동은 WeatherListCard 의 RouterLink 가 담당)
const selectedCityInfo = ref(null)
const handleSelectCard = (city) => {
  selectedCityInfo.value = city
}

watch(selectedCityInfo, (city) => {
  console.log('[watch] 선택된 도시:', city?.nameKo ?? city)
})

watchEffect(() => {
  console.log('[watchEffect] 검색어:', searchQuery.value || '(비어 있음)')
})

// 즐겨찾기 도시의 날씨 — 이미 캐시된 게 있으면 재사용, 없으면 새로 조회
const favoriteWeatherMap = ref({})
const loadFavoriteWeather = async () => {
  await Promise.all(
    favoritesStore.favorites.map(async (fav) => {
      const cached = cacheStore.recall(fav.key)
      if (cached) {
        favoriteWeatherMap.value[fav.key] = cached
        return
      }
      try {
        const weather = await fetchWeatherByCoords(fav.lat, fav.lon, fav.nameKo)
        favoriteWeatherMap.value[fav.key] = weather
        cacheStore.remember(fav.key, weather)
      } catch (error) {
        console.error('즐겨찾기 날씨를 불러오지 못했습니다.', error)
      }
    }),
  )
}
watch(() => favoritesStore.favorites.length, loadFavoriteWeather, { immediate: true })

const handleSearch = async () => {
  const cityName = searchQuery.value.trim()
  if (!cityName) return

  try {
    const result = await fetchWeatherByCityName(cityName)
    searchResult.value = result
    cacheStore.remember(coordKey(result.lat, result.lon), result)
    searchQuery.value = ''
  } catch (error) {
    searchResult.value = null
    ElMessage.error(error.message)
  }
}

onMounted(async () => {
  // 상세 페이지 청크를 미리 로드해서 첫 카드 클릭이 굼뜨지 않게
  import('@/views/WeatherDetailView.vue')

  try {
    const results = await Promise.all(
      majorCities.map((city) => fetchWeatherByCoords(city.lat, city.lon, city.nameKo)),
    )
    majorCities.forEach((city, index) => {
      weatherMap.value[city.id] = results[index]
      cacheStore.remember(city.id, results[index]) // 상세 페이지가 즉시 재사용
    })
  } catch (error) {
    console.error('날씨 정보를 불러오지 못했습니다.', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="weather-list">
    <SearchBar
      :search-query="searchQuery"
      @update-query="searchQuery = $event"
      @keyup.enter="handleSearch"
    />

    <div v-if="favoritesStore.favorites.length" class="favorites-section">
      <h3 class="section-title">⭐ 즐겨찾기</h3>
      <div class="card-grid">
        <WeatherListCard
          v-for="fav in favoritesStore.favorites"
          :key="fav.key"
          :city="{ id: fav.cityId ?? 'search', nameKo: fav.nameKo, lat: fav.lat, lon: fav.lon }"
          :weather="favoriteWeatherMap[fav.key] ?? null"
          :query="fav.cityId ? {} : { lat: fav.lat, lon: fav.lon, name: fav.nameKo }"
          @click="handleSelectCard(fav)"
        />
      </div>
    </div>

    <div v-if="searchResult" class="search-result">
      <h3 class="section-title">검색 결과</h3>
      <div class="card-grid">
        <WeatherListCard
          :city="{ id: 'search', nameKo: searchResult.name }"
          :weather="searchResult"
          :query="{ lat: searchResult.lat, lon: searchResult.lon, name: searchResult.name }"
          @click="handleSelectCard({ nameKo: searchResult.name })"
        />
      </div>
    </div>

    <h3 v-if="searchResult" class="section-title">주요 도시</h3>
    <ElSkeleton v-if="isLoading" :rows="6" animated />
    <p v-else-if="!filteredWeatherList.length" class="empty">검색 결과가 없어요.</p>
    <div v-else class="card-grid">
      <WeatherListCard
        v-for="city in filteredWeatherList"
        :key="city.id"
        :city="city"
        :weather="weatherMap[city.id] ?? null"
        @click="handleSelectCard(city)"
      />
    </div>
  </div>
</template>

<style scoped>
.weather-list {
  max-width: 900px;
  margin: 0 auto;
}

/* 지구본 홈과 통일감을 주는 우주 배경 — 채도 높은 성운 블롭 여러 개 + 별 점.
   베이스 컬러를 밝은 톤으로 올리고, 중앙 전체를 덮는 큰 와시 레이어 + 블롭 알파를 더 키워서
   구석에만 살짝 비치던 색이 화면 전체를 밝게 채우도록 했다. */
.weather-list::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background-color: #10182e;
  background-image:
    radial-gradient(ellipse 1300px 950px at 50% -10%, rgba(120, 130, 255, 0.4), transparent 68%),
    radial-gradient(ellipse 1000px 750px at 6% -8%, rgba(120, 122, 255, 0.65), transparent 62%),
    radial-gradient(ellipse 850px 700px at 100% 8%, rgba(255, 100, 180, 0.5), transparent 60%),
    radial-gradient(ellipse 800px 750px at 88% 100%, rgba(56, 235, 200, 0.5), transparent 60%),
    radial-gradient(ellipse 700px 650px at 2% 96%, rgba(190, 110, 255, 0.52), transparent 62%),
    radial-gradient(1.5px 1.5px at 12% 22%, rgba(255, 255, 255, 0.95), transparent 60%),
    radial-gradient(1.5px 1.5px at 78% 8%, rgba(255, 255, 255, 0.75), transparent 60%),
    radial-gradient(1px 1px at 45% 62%, rgba(255, 255, 255, 0.85), transparent 60%),
    radial-gradient(1px 1px at 88% 48%, rgba(255, 255, 255, 0.65), transparent 60%),
    radial-gradient(1.5px 1.5px at 30% 85%, rgba(255, 255, 255, 0.75), transparent 60%),
    radial-gradient(1px 1px at 60% 30%, rgba(255, 255, 255, 0.6), transparent 60%),
    radial-gradient(1px 1px at 5% 70%, rgba(255, 255, 255, 0.7), transparent 60%),
    radial-gradient(1.5px 1.5px at 95% 78%, rgba(255, 255, 255, 0.8), transparent 60%);
  animation: mesh-glow 9s ease-in-out infinite alternate;
}

@keyframes mesh-glow {
  from {
    opacity: 0.9;
    filter: saturate(1.1) brightness(1);
  }
  to {
    opacity: 1;
    filter: saturate(1.3) brightness(1.08);
  }
}

.section-title {
  margin: 24px 0 12px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--text-secondary);
}

.favorites-section,
.search-result {
  margin-bottom: 8px;
}

.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
</style>

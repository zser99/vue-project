import { ref } from 'vue'
import { defineStore } from 'pinia'
import { coordKey } from './weatherCacheStore'

// majorCities 는 cityId 를, 검색으로 찾은 도시는 좌표를 키로 사용 (weatherCacheStore 와 동일 규칙)
export const favoriteKey = (cityId, lat, lon) =>
  cityId && cityId !== 'search' ? cityId : coordKey(lat, lon)

// 즐겨찾기한 도시를 목록/상세 화면이 공유하는 전역 상태
export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref([]) // { key, cityId, nameKo, lat, lon }[]

  const isFavorite = (key) => favorites.value.some((f) => f.key === key)

  const toggleFavorite = (info) => {
    const index = favorites.value.findIndex((f) => f.key === info.key)
    if (index === -1) favorites.value.push(info)
    else favorites.value.splice(index, 1)
  }

  return { favorites, isFavorite, toggleFavorite }
})

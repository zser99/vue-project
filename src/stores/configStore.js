import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// 앱 전역에서 공유하는 온도 단위 설정 ('C' | 'F')
export const useConfigStore = defineStore('config', () => {
  const unit = ref('C')

  const unitSymbol = computed(() => `°${unit.value}`)

  const toggleUnit = () => {
    unit.value = unit.value === 'C' ? 'F' : 'C'
  }

  // 섭씨 온도를 현재 선택된 단위 값으로 변환
  const convertFromCelsius = (celsius) => {
    if (celsius === undefined || celsius === null) return null
    return unit.value === 'C' ? celsius : (celsius * 9) / 5 + 32
  }

  return { unit, unitSymbol, toggleUnit, convertFromCelsius }
})

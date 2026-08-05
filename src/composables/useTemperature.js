import { computed } from 'vue'
import { useConfigStore } from '@/stores/configStore'

// tempCRef: 섭씨 온도를 담은 ref 또는 computed
export function useTemperature(tempCRef) {
  const configStore = useConfigStore()

  const displayTemp = computed(() => {
    const converted = configStore.convertFromCelsius(tempCRef.value)
    return converted === null ? '-' : Math.round(converted)
  })

  const unitSymbol = computed(() => configStore.unitSymbol)

  return { displayTemp, unitSymbol }
}

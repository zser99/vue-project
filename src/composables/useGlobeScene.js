import { ref, onMounted, onUnmounted } from 'vue'
import { createGlobeApp } from '@/three/globe/createGlobeApp'

// Vue ↔ three.js 브리지.
// three 객체는 절대 reactive 상태에 넣지 않는다 (Proxy 래핑 시 성능·dispose 문제).
export function useGlobeScene(canvasRef, { cities, onPick }) {
  const progress = ref(0)
  const isReady = ref(false)
  const webglFailed = ref(false)

  let app = null

  onMounted(() => {
    try {
      app = createGlobeApp({
        canvas: canvasRef.value,
        cities,
        onPick,
        onProgress: (value) => {
          progress.value = value
        },
        onReady: () => {
          isReady.value = true
        },
      })
    } catch (error) {
      // WebGL 컨텍스트 생성 실패 등 — 폴백 UI 로 전환
      console.error('지구본을 초기화하지 못했습니다.', error)
      webglFailed.value = true
    }
  })

  onUnmounted(() => {
    app?.dispose()
    app = null
  })

  return {
    progress,
    isReady,
    webglFailed,
    flyTo: (lat, lon, dist) => app?.flyTo(lat, lon, dist),
    launchIcbm: () => app?.launchIcbmVolley(),
    highlightCountryAt: (lat, lon) => app?.highlightCountryAt(lat, lon),
    clearCountryHighlight: () => app?.clearCountryHighlight(),
  }
}

import * as THREE from 'three'
import { earthVertexShader, earthFragmentShader } from './shaders'
import { getSunDirection } from './geoMath'

export const EARTH_RADIUS = 1

// 지구 본체: 커스텀 ShaderMaterial (낮/밤 블렌딩은 shaders.js 참조)
export function createEarth({ dayMap, nightMap, waterMask }) {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96)

  const material = new THREE.ShaderMaterial({
    vertexShader: earthVertexShader,
    fragmentShader: earthFragmentShader,
    uniforms: {
      uDayMap: { value: dayMap },
      uNightMap: { value: nightMap },
      uWaterMask: { value: waterMask },
      uSunDir: { value: getSunDirection() },
    },
  })

  const mesh = new THREE.Mesh(geometry, material)

  // 태양 방향은 1분에 한 번만 갱신해도 충분 (경도 0.25°/분 이동)
  let lastSunUpdate = 0
  const updateSun = (elapsed) => {
    if (elapsed - lastSunUpdate < 60) return
    lastSunUpdate = elapsed
    material.uniforms.uSunDir.value.copy(getSunDirection())
  }

  return { mesh, material, updateSun }
}

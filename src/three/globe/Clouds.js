import * as THREE from 'three'
import { EARTH_RADIUS } from './Earth'

// 구름 레이어: 알파 채널을 가진 텍스처를 지구보다 살짝 큰 구에 씌우고 천천히 자전
export function createClouds(cloudsMap) {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.006, 64, 64)
  const material = new THREE.MeshLambertMaterial({
    map: cloudsMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  })

  const mesh = new THREE.Mesh(geometry, material)
  // 구름이 지구 표면 클릭 판정을 가로채지 않도록
  mesh.raycast = () => {}

  const update = (dt) => {
    mesh.rotation.y += 0.006 * dt
  }

  return { mesh, update }
}

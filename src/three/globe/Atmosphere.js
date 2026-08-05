import * as THREE from 'three'
import { atmosphereVertexShader, atmosphereFragmentShader } from './shaders'
import { EARTH_RADIUS } from './Earth'

// 지구를 감싸는 푸른 대기 글로우 (프레넬, 뒷면 렌더 + 가산 블렌딩)
export function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.13, 64, 64)

  const material = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  // 글로우는 클릭 판정 대상이 아니다
  mesh.raycast = () => {}
  return mesh
}

import * as THREE from 'three'

// 프로시저럴 별 배경 — 텍스처 없이 즉시 렌더 가능
export function createStarfield({ count = 4000, radius = 50 } = {}) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()

  for (let i = 0; i < count; i += 1) {
    // 구면 위 균일 분포
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = radius * (0.7 + Math.random() * 0.3)
    positions.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3)

    // 살짝 푸른/노란 색 편차로 자연스럽게
    color.setHSL(Math.random() < 0.85 ? 0.6 : 0.12, 0.3, 0.55 + Math.random() * 0.35)
    colors.set([color.r, color.g, color.b], i * 3)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    depthWrite: false,
  })

  const points = new THREE.Points(geometry, material)
  points.raycast = () => {}
  return points
}

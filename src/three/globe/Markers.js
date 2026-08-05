import * as THREE from 'three'
import { latLonToVector3 } from './geoMath'
import { EARTH_RADIUS } from './Earth'

// 발광 점 스프라이트용 텍스처를 캔버스로 생성 (외부 이미지 불필요)
function createGlowTexture([r, g, b]) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.9)`)
  gradient.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.35)`)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// 도시 목록 → { group(스프라이트), hitMeshes(픽킹용 투명 구), update(뒷면 페이드) }
// type: 'capital' = 차가운 블루, 'city'(관광 도시) = 따뜻한 골드
export function createMarkers(cities) {
  const group = new THREE.Group()
  const textures = {
    capital: createGlowTexture([140, 195, 255]),
    city: createGlowTexture([255, 200, 120]),
  }
  const hitGeometry = new THREE.SphereGeometry(0.018, 8, 8)
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false })

  const baseScale = 0.038
  const hitMeshes = []
  const entries = cities.map((city) => {
    const position = latLonToVector3(city.lat, city.lon, EARTH_RADIUS * 1.006)

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures[city.type] ?? textures.city,
        transparent: true,
        depthWrite: false,
        opacity: 0.95,
      }),
    )
    sprite.position.copy(position)
    sprite.scale.setScalar(baseScale)
    sprite.raycast = () => {} // 픽킹은 히트 구가 담당

    const hit = new THREE.Mesh(hitGeometry, hitMaterial)
    hit.position.copy(position)
    hit.userData.cityId = city.id

    group.add(sprite, hit)
    hitMeshes.push(hit)
    return { sprite, direction: position.clone().normalize() }
  })

  // 지구 뒤로 넘어간 마커는 페이드 아웃 + 살짝 펄스
  const camDir = new THREE.Vector3()
  const update = (elapsed, camera) => {
    camDir.copy(camera.position).normalize()
    const horizonCos = EARTH_RADIUS / camera.position.length()

    entries.forEach(({ sprite, direction }, i) => {
      const facing = direction.dot(camDir)
      const visibility = THREE.MathUtils.smoothstep(facing, horizonCos - 0.05, horizonCos + 0.15)
      sprite.material.opacity = visibility * 0.95
      const pulse = 1 + Math.sin(elapsed * 2 + i * 1.3) * 0.08
      sprite.scale.setScalar(baseScale * pulse)
    })
  }

  const dispose = () => {
    Object.values(textures).forEach((t) => t.dispose())
    hitGeometry.dispose()
    hitMaterial.dispose()
    entries.forEach(({ sprite }) => sprite.material.dispose())
  }

  return { group, hitMeshes, update, dispose }
}

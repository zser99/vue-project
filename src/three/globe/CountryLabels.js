import * as THREE from 'three'
import { latLonToVector3 } from './geoMath'
import { EARTH_RADIUS } from './Earth'

// 나라 이름 라벨.
// - 각 나라의 본토 중심(geojson properties.c)에 캔버스 텍스트 스프라이트 배치
// - LOD: 면적(properties.a)이 큰 나라일수록 멀리서도 보이고,
//   작은 나라는 줌인해야 나타난다 (지도 앱과 같은 단계적 표시)
// - 지구 뒷면으로 넘어가면 페이드 아웃, 크기는 화면 기준 일정하게 유지
const LABEL_RADIUS = EARTH_RADIUS * 1.012

function createLabelTexture(text) {
  const font = '600 34px -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  const height = 48
  const padding = 10

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(text).width) + padding * 2
  canvas.height = height

  // 캔버스 크기 변경 시 컨텍스트가 리셋되므로 다시 설정
  const draw = canvas.getContext('2d')
  draw.font = font
  draw.textBaseline = 'middle'
  draw.shadowColor = 'rgba(0, 0, 0, 0.85)'
  draw.shadowBlur = 7
  draw.fillStyle = 'rgba(255, 255, 255, 0.95)'
  draw.fillText(text, padding, height / 2 + 1)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, aspect: canvas.width / height }
}

export function createCountryLabels(features) {
  const group = new THREE.Group()

  const entries = features.map(({ properties }) => {
    const { n: name, c: [lat, lon] = [0, 0], a: area = 1 } = properties ?? {}
    const { texture, aspect } = createLabelTexture(name ?? '')

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        // 곡면 가장자리에서 빌보드가 지구에 파고들어 잘리지 않도록 깊이 테스트 제외
        // (뒷면 라벨은 update 의 horizon 페이드가 숨긴다)
        depthTest: false,
        opacity: 0,
      }),
    )
    sprite.renderOrder = 10 // 지구/대기 위에 그려지도록
    sprite.position.copy(latLonToVector3(lat, lon, LABEL_RADIUS))
    sprite.raycast = () => {} // 라벨은 클릭 판정 대상이 아님

    group.add(sprite)
    return {
      sprite,
      texture,
      aspect,
      direction: sprite.position.clone().normalize(),
      // 면적이 클수록 더 먼 거리에서부터 표시 (작은 나라는 줌인해야 등장)
      visibleDist: THREE.MathUtils.clamp(1.35 + Math.sqrt(area) * 0.16, 1.45, 7),
    }
  })

  const camDir = new THREE.Vector3()

  const update = (camera, camDist) => {
    camDir.copy(camera.position).normalize()
    const horizonCos = EARTH_RADIUS / camDist
    const labelHeight = camDist * 0.013 // 화면 기준 일정한 크기

    entries.forEach(({ sprite, aspect, direction, visibleDist }) => {
      const facing = direction.dot(camDir)
      // depthTest 를 껐으므로 뒷면/가장자리 라벨은 페이드로 확실히 숨긴다
      const backVisibility = THREE.MathUtils.smoothstep(facing, horizonCos + 0.05, horizonCos + 0.25)
      // 카메라가 visibleDist 안으로 들어오면 서서히 등장
      const lodVisibility =
        1 - THREE.MathUtils.smoothstep(camDist, visibleDist * 0.9, visibleDist * 1.1)

      sprite.material.opacity = 0.8 * backVisibility * lodVisibility
      sprite.visible = sprite.material.opacity > 0.01
      if (sprite.visible) sprite.scale.set(labelHeight * aspect, labelHeight, 1)
    })
  }

  const dispose = () => {
    entries.forEach(({ sprite, texture }) => {
      texture.dispose()
      sprite.material.dispose()
    })
  }

  return { group, update, dispose }
}

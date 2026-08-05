import * as THREE from 'three'
import { latLonToVector3 } from './geoMath'
import { EARTH_RADIUS } from './Earth'

// 국경선을 지구 표면 바로 위(1.0015R)에 하나의 LineSegments 로 그린다.
// GeoJSON(Natural Earth 110m, 퍼블릭 도메인)을 런타임에 fetch — 텍스처와 별개로
// 비동기 로드되므로 지구 렌더를 막지 않는다.
// 추가로 특정 좌표가 속한 나라를 찾아(point-in-polygon) 그 나라 국경만
// 밝게 강조하는 하이라이트 레이어를 제공한다.
const BORDER_RADIUS = EARTH_RADIUS * 1.0015
const HIGHLIGHT_RADIUS = EARTH_RADIUS * 1.0025 // 기본 선 위에 그려지도록 살짝 높게
const MAX_SEGMENT_RAD = (2 * Math.PI) / 180 // 2° 이상 긴 변은 대원을 따라 분할

// ── point-in-polygon (ray casting, [lon, lat] 좌표계) ──
const pointInRing = (lon, lat, ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// Polygon: coordinates[0] = 외곽, 나머지 = 구멍(내해 등)
const pointInPolygon = (lon, lat, coordinates) => {
  if (!pointInRing(lon, lat, coordinates[0])) return false
  return !coordinates.slice(1).some((hole) => pointInRing(lon, lat, hole))
}

const pointInFeature = (lon, lat, geometry) => {
  if (geometry.type === 'Polygon') return pointInPolygon(lon, lat, geometry.coordinates)
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon))
  return false
}

// 링 하나를 선분 좌표 배열로 변환 (긴 변은 대원 분할)
const ringToSegments = (ring, radius, out) => {
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lonA, latA] = ring[i]
    const [lonB, latB] = ring[i + 1]
    const a = latLonToVector3(latA, lonA, radius)
    const b = latLonToVector3(latB, lonB, radius)

    const steps = Math.max(1, Math.ceil(a.angleTo(b) / MAX_SEGMENT_RAD))
    let prev = a
    for (let s = 1; s <= steps; s += 1) {
      const p = a
        .clone()
        .lerp(b, s / steps)
        .normalize()
        .multiplyScalar(radius)
      out.push(prev.x, prev.y, prev.z, p.x, p.y, p.z)
      prev = p
    }
  }
}

const featureToSegments = (geometry, radius) => {
  const positions = []
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => ringToSegments(ring, radius, positions))
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) =>
      polygon.forEach((ring) => ringToSegments(ring, radius, positions)),
    )
  }
  return positions
}

export async function loadBorders(url) {
  const response = await fetch(url)
  const { features } = await response.json()

  // 기본 국경선 (전체를 하나의 지오메트리로)
  const allPositions = []
  features.forEach(({ geometry }) => {
    allPositions.push(...featureToSegments(geometry, BORDER_RADIUS))
  })

  const baseGeometry = new THREE.BufferGeometry()
  baseGeometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3))
  const baseMaterial = new THREE.LineBasicMaterial({
    color: 0x9fc2e8,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  })
  const lines = new THREE.LineSegments(baseGeometry, baseMaterial)
  lines.raycast = () => {}

  // 하이라이트 레이어 (선택된 나라의 국경만, 밝고 진하게)
  const highlightGeometry = new THREE.BufferGeometry()
  const highlightMaterial = new THREE.LineBasicMaterial({
    color: 0xe8f4ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const highlightLines = new THREE.LineSegments(highlightGeometry, highlightMaterial)
  highlightLines.raycast = () => {}
  highlightLines.frustumCulled = false

  let highlightOpacityTarget = 0

  const clearHighlight = () => {
    highlightOpacityTarget = 0
  }

  // 좌표가 속한 나라를 찾아 강조. 나라를 못 찾으면(바다 등) 강조 해제.
  const highlightAt = (lat, lon) => {
    const feature = features.find(({ geometry }) => pointInFeature(lon, lat, geometry))
    if (!feature) {
      clearHighlight()
      return false
    }
    const positions = featureToSegments(feature.geometry, HIGHLIGHT_RADIUS)
    highlightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    highlightOpacityTarget = 0.95
    return true
  }

  // 부드러운 페이드 (프레임 루프에서 호출)
  const update = (dt) => {
    const { opacity } = highlightMaterial
    highlightMaterial.opacity += (highlightOpacityTarget - opacity) * (1 - Math.exp(-8 * dt))
  }

  const dispose = () => {
    baseGeometry.dispose()
    baseMaterial.dispose()
    highlightGeometry.dispose()
    highlightMaterial.dispose()
  }

  return { lines, highlightLines, highlightAt, clearHighlight, update, dispose, features }
}

import * as THREE from 'three'

// ── 좌표 규약 ─────────────────────────────────────────────────────────
// 지구 메시는 절대 회전시키지 않는다 (연출용 회전은 카메라가 담당).
// three.js SphereGeometry 에 표준 equirectangular 텍스처를 입혔을 때:
//   경도 0°(그리니치) = +x 축, 동경 90° = -z 축, 북극 = +y 축
// 이 규약 아래에서 아래 두 변환이 성립한다.
// ────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180

// 위도/경도(도) → 반지름 r 구면 위의 3D 좌표
export const latLonToVector3 = (lat, lon, r = 1) =>
  new THREE.Vector3(
    r * Math.cos(lat * DEG) * Math.cos(lon * DEG),
    r * Math.sin(lat * DEG),
    -r * Math.cos(lat * DEG) * Math.sin(lon * DEG),
  )

// 구면 위 3D 좌표(지구 로컬) → { lat, lon } (도)
export const vector3ToLatLon = (v) => {
  const n = v.clone().normalize()
  return {
    lat: Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) / DEG,
    lon: -Math.atan2(n.z, n.x) / DEG,
  }
}

// 현재 UTC 시각 기준 태양 직하점(subsolar point) 근사 계산.
// 균시차는 무시 — 시각적 낮/밤 표현에는 충분한 정밀도.
export const getSunDirection = (date = new Date()) => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayOfYear = (date.getTime() - start) / 86400000
  const declination = -23.44 * Math.cos(((dayOfYear + 10) / 365.25) * 2 * Math.PI)

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const subsolarLon = (12 - utcHours) * 15

  return latLonToVector3(declination, subsolarLon, 1)
}

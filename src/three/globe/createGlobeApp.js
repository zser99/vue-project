import * as THREE from 'three'
import { createEarth, EARTH_RADIUS } from './Earth'
import { createAtmosphere } from './Atmosphere'
import { createClouds } from './Clouds'
import { createStarfield } from './Starfield'
import { createMarkers } from './Markers'
import { createFleetBattle } from './FleetBattle'
import { createIcbmStrike } from './IcbmStrike'
import { loadBorders } from './Borders'
import { createCountryLabels } from './CountryLabels'
import { GlobeControls } from './GlobeControls'
import { vector3ToLatLon, getSunDirection } from './geoMath'

const TEXTURE_BASE = `${import.meta.env.BASE_URL}textures/earth/`
const BORDERS_URL = `${import.meta.env.BASE_URL}geo/countries.geojson`

// three.js 씬 전체를 조립하는 팩토리. Vue 와는 콜백으로만 통신한다.
// 반환: { flyTo, dispose }
export function createGlobeApp({ canvas, cities, onPick, onProgress, onReady }) {
  // ── 렌더러 / 카메라 / 씬 ──────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x02030a)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200)
  // 인트로: 멀리서 시작해 onReady 후 flyTo 로 다가온다
  camera.position.setFromSphericalCoords(EARTH_RADIUS * 5.2, Math.PI / 2.6, Math.PI / 2)
  camera.lookAt(0, 0, 0)

  // ── 텍스처 로딩 ──────────────────────────────────────────────────
  const manager = new THREE.LoadingManager()
  manager.onProgress = (_url, loaded, total) => onProgress?.(loaded / total)

  const loader = new THREE.TextureLoader(manager)
  const loadTexture = (file, { srgb = true } = {}) => {
    const texture = loader.load(TEXTURE_BASE + file)
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    return texture
  }

  const dayMap = loadTexture('day.jpg')
  const nightMap = loadTexture('night.jpg')
  const waterMask = loadTexture('water.png', { srgb: false })
  const cloudsMap = loadTexture('clouds.png')

  // ── 씬 구성 ──────────────────────────────────────────────────────
  const earthGroup = new THREE.Group()
  const earth = createEarth({ dayMap, nightMap, waterMask })
  const clouds = createClouds(cloudsMap)
  const markers = createMarkers(cities)
  earthGroup.add(earth.mesh, clouds.mesh, markers.group)

  const atmosphere = createAtmosphere()
  const stars = createStarfield()
  // 이스터에그: 충분히 줌아웃하면 우주에서 함대전이 벌어진다
  const fleetBattle = createFleetBattle()
  // 이스터에그: ☢ 버튼으로 수도 간 ICBM 발사
  const icbmStrike = createIcbmStrike(cities)
  earthGroup.add(icbmStrike.group)
  scene.add(earthGroup, atmosphere, stars, fleetBattle.group)

  // 국경선은 비동기 로드 — 준비되는 대로 씬에 합류 (실패해도 지구본은 정상 동작)
  let borders = null
  let countryLabels = null
  let pendingHighlight = null // 로드 전에 들어온 강조 요청을 기억해뒀다 적용
  let disposed = false
  loadBorders(BORDERS_URL)
    .then((loaded) => {
      if (disposed) return
      borders = loaded
      countryLabels = createCountryLabels(loaded.features)
      earthGroup.add(borders.lines, borders.highlightLines, countryLabels.group)
      if (pendingHighlight) borders.highlightAt(...pendingHighlight)
    })
    .catch((error) => console.warn('국경선 데이터를 불러오지 못했습니다.', error))

  const highlightCountryAt = (lat, lon) => {
    if (borders) borders.highlightAt(lat, lon)
    else pendingHighlight = [lat, lon]
  }

  const clearCountryHighlight = () => {
    pendingHighlight = null
    borders?.clearHighlight()
  }

  // 구름(Lambert)용 조명 — 지구 셰이더와 같은 태양 방향으로 정렬
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2)
  sunLight.position.copy(getSunDirection()).multiplyScalar(10)
  const ambient = new THREE.AmbientLight(0x334466, 0.5)
  scene.add(sunLight, ambient)

  // ── 컨트롤 + 픽킹 ────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster()
  const controls = new GlobeControls(camera, canvas, {
    onClick: (ndc) => {
      raycaster.setFromCamera(ndc, camera)

      // 1순위: 도시 마커
      const [markerHit] = raycaster.intersectObjects(markers.hitMeshes)
      if (markerHit) {
        const { cityId } = markerHit.object.userData
        const { lat, lon } = vector3ToLatLon(earth.mesh.worldToLocal(markerHit.point.clone()))
        onPick?.({ cityId, lat, lon })
        return
      }

      // 2순위: 지구 표면 → 위경도
      const [earthHit] = raycaster.intersectObject(earth.mesh)
      if (earthHit) {
        const { lat, lon } = vector3ToLatLon(earth.mesh.worldToLocal(earthHit.point.clone()))
        onPick?.({ lat, lon })
      }
    },
  })
  controls.earthMesh = earth.mesh

  // ── 인트로 연출 ──────────────────────────────────────────────────
  earthGroup.scale.setScalar(0.92)
  manager.onLoad = () => {
    onReady?.()
    controls.flyTo(30, 127, EARTH_RADIUS * 2.6) // 한국이 보이는 아시아 시점으로 진입
  }

  // ── 프레임 루프 ──────────────────────────────────────────────────
  const timer = new THREE.Timer()
  let rafId = 0
  let running = true

  const frame = () => {
    rafId = requestAnimationFrame(frame)
    timer.update()
    const dt = Math.min(timer.getDelta(), 0.1)
    const elapsed = timer.getElapsed()

    controls.update(dt)
    clouds.update(dt)
    markers.update(elapsed, camera)
    earth.updateSun(elapsed)
    fleetBattle.update(dt, elapsed, controls.current.dist)
    icbmStrike.update(dt)
    borders?.update(dt)
    countryLabels?.update(camera, controls.current.dist)

    // 등장 스케일 보간 (0.92 → 1)
    const s = earthGroup.scale.x
    if (s < 0.9995) earthGroup.scale.setScalar(s + (1 - s) * (1 - Math.exp(-2.5 * dt)))

    renderer.render(scene, camera)
  }

  const onVisibility = () => {
    if (document.hidden) {
      running = false
      cancelAnimationFrame(rafId)
    } else if (!running) {
      running = true
      timer.update() // 숨어있던 시간이 dt 로 튀지 않게 리셋
      frame()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ── 리사이즈 ─────────────────────────────────────────────────────
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  frame()

  // ── 정리 ─────────────────────────────────────────────────────────
  const dispose = () => {
    disposed = true
    cancelAnimationFrame(rafId)
    document.removeEventListener('visibilitychange', onVisibility)
    observer.disconnect()
    controls.dispose()
    markers.dispose()
    fleetBattle.dispose()
    icbmStrike.dispose()
    borders?.dispose()
    countryLabels?.dispose()

    scene.traverse((obj) => {
      obj.geometry?.dispose()
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach((m) => m?.dispose())
    })
    ;[dayMap, nightMap, waterMask, cloudsMap].forEach((t) => t.dispose())

    renderer.dispose()
    renderer.forceContextLoss()
  }

  return {
    flyTo: (lat, lon, dist) => controls.flyTo(lat, lon, dist),
    launchIcbmVolley: () => icbmStrike.launchVolley(),
    highlightCountryAt,
    clearCountryHighlight,
    dispose,
  }
}

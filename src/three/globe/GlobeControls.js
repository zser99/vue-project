import * as THREE from 'three'
import { EARTH_RADIUS } from './Earth'
import { latLonToVector3 } from './geoMath'

// 지구본 전용 카메라 컨트롤.
// - target 은 항상 지구 중심: 구면 좌표 {theta, phi, dist} 만 움직인다
// - 휠 줌: 커서가 가리키는 지점이 화면 중앙으로 수렴 (구글어스 감각)
// - 드래그 회전: 고도(줌 레벨)에 비례하는 감도
// - goal → current 지수 감쇠 보간으로 모든 움직임에 관성 부여
export class GlobeControls {
  constructor(camera, domElement, { onClick } = {}) {
    this.camera = camera
    this.domElement = domElement
    this.onClick = onClick

    this.minDist = EARTH_RADIUS * 1.15
    this.maxDist = EARTH_RADIUS * 6

    const initial = new THREE.Spherical().setFromVector3(camera.position)
    this.goal = { theta: initial.theta, phi: initial.phi, dist: initial.radius }
    this.current = { ...this.goal }
    this.flight = null // flyTo 타임라인 애니메이션 상태

    this.raycaster = new THREE.Raycaster()
    this.earthMesh = null // createGlobeApp 이 주입

    this.pointer = { down: false, x: 0, y: 0, startX: 0, startY: 0, startTime: 0 }

    this._onWheel = this.handleWheel.bind(this)
    this._onDown = this.handlePointerDown.bind(this)
    this._onMove = this.handlePointerMove.bind(this)
    this._onUp = this.handlePointerUp.bind(this)

    domElement.addEventListener('wheel', this._onWheel, { passive: false })
    domElement.addEventListener('pointerdown', this._onDown)
    domElement.addEventListener('pointermove', this._onMove)
    domElement.addEventListener('pointerup', this._onUp)
    domElement.addEventListener('pointerleave', this._onUp)
  }

  toNdc(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect()
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
  }

  raycastEarth(ndc) {
    if (!this.earthMesh) return null
    this.raycaster.setFromCamera(ndc, this.camera)
    const [hit] = this.raycaster.intersectObject(this.earthMesh)
    return hit ?? null
  }

  handleWheel(event) {
    event.preventDefault()
    this.cancelFlight()

    const scale = Math.exp(-event.deltaY * 0.0012)
    const newDist = THREE.MathUtils.clamp(this.goal.dist / scale, this.minDist, this.maxDist)

    // 줌인일 때만 커서 아래 지점을 향해 시점을 끌어당긴다
    if (newDist < this.goal.dist) {
      const hit = this.raycastEarth(this.toNdc(event.clientX, event.clientY))
      if (hit) {
        const hitSph = new THREE.Spherical().setFromVector3(
          this.earthMesh.worldToLocal(hit.point.clone()).normalize(),
        )
        const t = 1 - newDist / this.goal.dist // 이번 스텝에서 줄어드는 거리 비율

        // theta 는 ±π 랩어라운드가 있으므로 최단 각도 차이로
        let dTheta = hitSph.theta - this.goal.theta
        dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta))
        this.goal.theta += dTheta * t
        this.goal.phi += (hitSph.phi - this.goal.phi) * t
        this.clampPhi()
      }
    }
    this.goal.dist = newDist
  }

  handlePointerDown(event) {
    this.cancelFlight()
    this.pointer.down = true
    this.pointer.x = this.pointer.startX = event.clientX
    this.pointer.y = this.pointer.startY = event.clientY
    this.pointer.startTime = performance.now()
    this.domElement.setPointerCapture?.(event.pointerId)
  }

  handlePointerMove(event) {
    if (!this.pointer.down) return
    const dx = event.clientX - this.pointer.x
    const dy = event.clientY - this.pointer.y
    this.pointer.x = event.clientX
    this.pointer.y = event.clientY

    // 줌인할수록 감도를 낮춰 미세 조작이 가능하게
    const altitude = (this.current.dist - EARTH_RADIUS) / EARTH_RADIUS
    const speed = ((2 * Math.PI) / this.domElement.clientHeight) * Math.min(altitude * 0.6, 1)

    this.goal.theta -= dx * speed
    this.goal.phi -= dy * speed
    this.clampPhi()
  }

  handlePointerUp(event) {
    if (!this.pointer.down) return
    this.pointer.down = false

    const moved = Math.hypot(
      event.clientX - this.pointer.startX,
      event.clientY - this.pointer.startY,
    )
    const elapsed = performance.now() - this.pointer.startTime
    if (moved < 5 && elapsed < 300) {
      this.onClick?.(this.toNdc(event.clientX, event.clientY))
    }
  }

  clampPhi() {
    this.goal.phi = THREE.MathUtils.clamp(this.goal.phi, 0.05, Math.PI - 0.05)
  }

  // 특정 위경도가 화면 중앙에 오도록 비행.
  // 즉시 goal 을 바꾸는 대신 타임라인 애니메이션(flight)으로:
  //   - easeInOutCubic 으로 가속 → 순항 → 감속 (모멘텀 느낌)
  //   - 장거리일수록 중간에 고도를 올렸다 내려앉는 아크 (구글어스 스타일)
  flyTo(lat, lon, dist = EARTH_RADIUS * 1.9) {
    const targetSph = new THREE.Spherical().setFromVector3(latLonToVector3(lat, lon, 1))
    const from = { ...this.current }

    // theta 는 최단 방향으로 언랩
    let dTheta = targetSph.theta - from.theta
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta))
    const target = {
      theta: from.theta + dTheta,
      phi: THREE.MathUtils.clamp(targetSph.phi, 0.05, Math.PI - 0.05),
      dist: THREE.MathUtils.clamp(dist, this.minDist, this.maxDist),
    }

    // 시점 간 각거리 → 비행 시간(0.7s ~ 2.4s)과 중간 고도 결정
    const fromDir = new THREE.Vector3().setFromSphericalCoords(1, from.phi, from.theta)
    const targetDir = new THREE.Vector3().setFromSphericalCoords(1, target.phi, target.theta)
    const angular = fromDir.angleTo(targetDir)

    const duration = THREE.MathUtils.clamp(0.6 + angular * 0.75, 0.7, 2.4)
    const peak = Math.min(
      this.maxDist,
      Math.max(from.dist, target.dist) + angular * EARTH_RADIUS * 0.7,
    )

    this.flight = { from, target, duration, peak, t: 0 }
    this.goal = { ...target } // 비행 종료 후 damping 이 이어받을 목표
  }

  // 사용자 입력(드래그/휠)이 들어오면 비행을 즉시 중단하고 조작권을 넘긴다
  cancelFlight() {
    if (!this.flight) return
    this.flight = null
    this.goal = { ...this.current }
  }

  update(dt) {
    if (this.flight) {
      const flight = this.flight
      flight.t += dt
      const p = Math.min(flight.t / flight.duration, 1)
      // easeInOutCubic: 천천히 출발 → 순항 → 천천히 도착
      const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2

      const { from, target, peak } = flight
      this.current.theta = THREE.MathUtils.lerp(from.theta, target.theta, e)
      this.current.phi = THREE.MathUtils.lerp(from.phi, target.phi, e)

      // 고도: 기본 보간 위에 sin 곡선으로 아크를 얹는다 (중간 지점에서 최고 고도)
      const baseDist = THREE.MathUtils.lerp(from.dist, target.dist, e)
      const lift = Math.sin(Math.PI * e) * Math.max(0, peak - Math.max(from.dist, target.dist))
      this.current.dist = baseDist + lift

      if (p >= 1) {
        this.flight = null
        this.current = { ...this.goal }
      }
    } else {
      // 프레임레이트 독립 지수 감쇠 (damping)
      const k = 1 - Math.exp(-6 * dt)
      let dTheta = this.goal.theta - this.current.theta
      dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta))
      this.current.theta += dTheta * k
      this.current.phi += (this.goal.phi - this.current.phi) * k
      this.current.dist += (this.goal.dist - this.current.dist) * k
    }

    this.camera.position.setFromSphericalCoords(
      this.current.dist,
      this.current.phi,
      this.current.theta,
    )
    this.camera.lookAt(0, 0, 0)
  }

  dispose() {
    const el = this.domElement
    el.removeEventListener('wheel', this._onWheel)
    el.removeEventListener('pointerdown', this._onDown)
    el.removeEventListener('pointermove', this._onMove)
    el.removeEventListener('pointerup', this._onUp)
    el.removeEventListener('pointerleave', this._onUp)
  }
}

import * as THREE from 'three'
import { latLonToVector3 } from './geoMath'
import { EARTH_RADIUS } from './Earth'

// ── 이스터에그: ICBM 타격 ────────────────────────────────────────────
// 무작위 수도에서 다른 수도로 탄도 미사일을 발사한다.
// 착탄 시 실제 핵폭발의 시각적 단계를 고증한 이펙트:
//   1) 섬광(플래시)          — 수 밀리초의 백색광
//   2) 화구(파이어볼)        — 팽창하며 상승하는 백열 구체
//   3) 충격파 응축 링        — 지표를 따라 퍼지는 원형 파면
//   4) 버섯구름              — 상승 기둥(stem) + 캡, 백열 주황 → 냉각되며 회갈색
//   5) 소산                  — 구름이 천천히 흐려지며 사라짐
// ────────────────────────────────────────────────────────────────────

const R = EARTH_RADIUS
const MISSILE_POOL = 10
const EXPLOSION_POOL = 8
const EXPLOSION_DURATION = 8 // 초
const LUMP_COUNT = 6 // 버섯구름 캡을 이루는 뭉치 개수 (매끈한 구 하나 대신 울퉁불퉁하게)
const DEBRIS_COUNT = 24 // 폭심에서 튀는 파편 스파크 개수

// 구면 위 대원(great circle) 보간 — 탄도 궤적의 지상 트랙
const slerpDir = (a, b, t, out) => {
  const angle = a.angleTo(b)
  if (angle < 1e-4) return out.copy(a)
  const sinAngle = Math.sin(angle)
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
    .addScaledVector(b, Math.sin(t * angle) / sinAngle)
}

function createGlowTexture(stops) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createIcbmStrike(cities) {
  const capitals = cities.filter(({ type }) => type === 'capital')
  const group = new THREE.Group()

  const flashTexture = createGlowTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.4, 'rgba(255,250,230,0.9)'],
    [1, 'rgba(255,240,200,0)'],
  ])
  const fireTexture = createGlowTexture([
    [0, 'rgba(255,255,240,1)'],
    [0.25, 'rgba(255,190,90,0.95)'],
    [0.6, 'rgba(255,110,40,0.5)'],
    [1, 'rgba(200,60,20,0)'],
  ])

  // ── 미사일 풀 ──
  const missileGeometry = new THREE.ConeGeometry(0.008, 0.035, 6)
  missileGeometry.rotateX(Math.PI / 2) // +z 가 진행 방향
  const missileMaterial = new THREE.MeshBasicMaterial({ color: 0xdddddd })
  const TRAIL_POINTS = 90

  const missiles = Array.from({ length: MISSILE_POOL }, () => {
    const mesh = new THREE.Mesh(missileGeometry, missileMaterial)
    mesh.visible = false

    const trailPositions = new Float32Array(TRAIL_POINTS * 3)
    const trailGeometry = new THREE.BufferGeometry()
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
    trailGeometry.setDrawRange(0, 0)
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
    const trail = new THREE.Line(trailGeometry, trailMaterial)
    trail.visible = false
    trail.frustumCulled = false

    group.add(mesh, trail)
    return {
      active: false,
      delay: 0,
      t: 0,
      duration: 5,
      apogee: 0.3,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      mesh,
      trail,
      trailGeometry,
      trailMaterial,
      trailCount: 0,
      fading: false,
    }
  })

  // ── 폭발 풀 ──
  const stemGeometry = new THREE.CylinderGeometry(0.35, 0.5, 1, 12, 1, true)
  const lumpGeometry = new THREE.SphereGeometry(1, 10, 8) // 캡을 이루는 뭉치 하나의 저폴리 구 (여러 개 겹쳐 울퉁불퉁하게)
  const ringGeometry = new THREE.RingGeometry(0.8, 1, 32)
  ringGeometry.rotateX(-Math.PI / 2) // 로컬 xz 평면(지표 접평면)에 눕힘

  const HOT = new THREE.Color(0xffb060) // 백열 주황
  const COOL = new THREE.Color(0x9a938a) // 냉각된 회갈색 연기
  const HOT_EMISSIVE = new THREE.Color(0xff5a18) // 초기 내부 발광
  const NO_EMISSIVE = new THREE.Color(0x000000)

  const explosions = Array.from({ length: EXPLOSION_POOL }, () => {
    const root = new THREE.Group()
    root.visible = false

    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    const fire = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fireTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xfff2dd,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    // 흙먼지 링: 백열 충격파(ring)보다 늦게, 느리게, 더 멀리 퍼지는 2차 파면
    const ring2 = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xcbb89a,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0,
      }),
    )
    const stem = new THREE.Mesh(
      stemGeometry,
      new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false }),
    )

    // 버섯구름 캡: 매끈한 구 하나 대신, 뭉치 여러 개를 무작위 오프셋으로 겹쳐 울퉁불퉁한 실루엣을 만든다.
    // 색상/발광은 전부 같은 타임라인을 타므로 머티리얼 하나를 뭉치들이 공유한다.
    const capMaterial = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false })
    const capGroup = new THREE.Group()
    for (let i = 0; i < LUMP_COUNT; i += 1) {
      const lump = new THREE.Mesh(lumpGeometry, capMaterial)
      if (i > 0) {
        const angle = Math.random() * Math.PI * 2
        const radius = 0.4 + Math.random() * 0.45
        lump.position.set(Math.cos(angle) * radius, -0.15 + Math.random() * 0.4, Math.sin(angle) * radius)
        lump.scale.setScalar(0.5 + Math.random() * 0.5)
      }
      capGroup.add(lump)
    }

    // 파편 스파크: 착탄 순간 사방으로 흩어지는 점 입자. 위치는 t 의 함수가 아니라 매 프레임 속도 적분이 필요하다.
    const debrisPositions = new Float32Array(DEBRIS_COUNT * 3)
    const debrisGeometry = new THREE.BufferGeometry()
    debrisGeometry.setAttribute('position', new THREE.BufferAttribute(debrisPositions, 3))
    const debrisMaterial = new THREE.PointsMaterial({
      map: flashTexture,
      color: 0xffcf8a,
      size: 0.006,
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const debris = new THREE.Points(debrisGeometry, debrisMaterial)
    const debrisVel = new Float32Array(DEBRIS_COUNT * 3)

    root.add(flash, fire, ring, ring2, stem, capGroup, debris)
    group.add(root)
    return {
      root,
      flash,
      fire,
      ring,
      ring2,
      stem,
      capGroup,
      capMaterial,
      debris,
      debrisGeometry,
      debrisMaterial,
      debrisVel,
      magnitude: 1,
      active: false,
      t: 0,
    }
  })

  // 섬광용 공유 포인트 라이트 (가장 최근 폭발 위치로 이동)
  const flashLight = new THREE.PointLight(0xfff0dd, 0, R * 2)
  group.add(flashLight)

  const detonate = (surfaceDir) => {
    const explosion = explosions.find(({ active }) => !active)
    if (!explosion) return

    explosion.active = true
    explosion.t = 0
    // 폭발마다 규모(위력)를 다르게 뽑는다 — 버섯구름/화구/충격파 크기가 매번 제각각으로 보이도록
    explosion.magnitude = 0.55 + Math.random() * 1.05
    explosion.root.position.copy(surfaceDir).multiplyScalar(R)
    // 로컬 +y 를 지표 법선 방향으로
    explosion.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceDir)
    explosion.root.visible = true

    // 파편 궤적을 매 착탄마다 새로 흩뿌린다 (위치는 원점 리셋, 속도는 위쪽으로 편향된 무작위 반구)
    const positions = explosion.debrisGeometry.attributes.position
    for (let i = 0; i < DEBRIS_COUNT; i += 1) {
      positions.array[i * 3] = 0
      positions.array[i * 3 + 1] = 0
      positions.array[i * 3 + 2] = 0
      const theta = Math.random() * Math.PI * 2
      const up = 0.3 + Math.random() * 0.55
      const spread = Math.sqrt(Math.max(0, 1 - up * up))
      const speed = (0.1 + Math.random() * 0.16) * explosion.magnitude
      explosion.debrisVel[i * 3] = Math.cos(theta) * spread * speed
      explosion.debrisVel[i * 3 + 1] = up * speed
      explosion.debrisVel[i * 3 + 2] = Math.sin(theta) * spread * speed
    }
    positions.needsUpdate = true
    explosion.debrisMaterial.opacity = 1

    flashLight.position.copy(surfaceDir).multiplyScalar(R * 1.05)
    flashLight.intensity = 30
  }

  // ── 발사 ──
  const launch = (fromCity, toCity, delay) => {
    const missile = missiles.find(({ active }) => !active)
    if (!missile) return

    missile.from.copy(latLonToVector3(fromCity.lat, fromCity.lon, 1))
    missile.to.copy(latLonToVector3(toCity.lat, toCity.lon, 1))

    const angle = missile.from.angleTo(missile.to)
    missile.active = true
    missile.fading = false
    missile.delay = delay
    missile.t = 0
    missile.duration = 2.5 + angle * 1.6 // 사거리 비례 비행시간
    missile.apogee = 0.12 + angle * 0.14 // 사거리 비례 최고 고도 (실제 ICBM 고증)
    missile.trailCount = 0
    missile.trailGeometry.setDrawRange(0, 0)
    missile.trailMaterial.opacity = 0.35
  }

  const launchVolley = () => {
    if (capitals.length < 2) return
    const count = 6 + Math.floor(Math.random() * 3) // 6~8발
    for (let i = 0; i < count; i += 1) {
      const from = capitals[Math.floor(Math.random() * capitals.length)]
      const candidates = capitals.filter((c) => {
        if (c.id === from.id) return false
        // 정반대 지점(대원 보간 특이점)은 제외
        const angle = latLonToVector3(from.lat, from.lon, 1).angleTo(latLonToVector3(c.lat, c.lon, 1))
        return angle < 2.8
      })
      if (!candidates.length) continue
      const to = candidates[Math.floor(Math.random() * candidates.length)]
      launch(from, to, i * (0.35 + Math.random() * 0.4))
    }
  }

  // ── 프레임 업데이트 ──
  const position = new THREE.Vector3()
  const positionNext = new THREE.Vector3()
  const dir = new THREE.Vector3()

  const update = (dt) => {
    // 섬광 라이트 감쇠
    if (flashLight.intensity > 0.01) flashLight.intensity *= Math.exp(-6 * dt)
    else flashLight.intensity = 0

    // 미사일
    missiles.forEach((missile) => {
      if (!missile.active) return

      // 궤적 페이드아웃 단계 (착탄 후 잔류 항적)
      if (missile.fading) {
        missile.trailMaterial.opacity -= dt * 0.4
        if (missile.trailMaterial.opacity <= 0) {
          missile.active = false
          missile.trail.visible = false
        }
        return
      }

      if (missile.delay > 0) {
        missile.delay -= dt
        return
      }

      missile.t += dt / missile.duration
      if (missile.t >= 1) {
        missile.mesh.visible = false
        missile.fading = true
        detonate(missile.to)
        return
      }

      // 탄도 고도: 대원 트랙 위에 sin 곡선 아치
      const altitude = R + missile.apogee * Math.sin(Math.PI * missile.t)
      slerpDir(missile.from, missile.to, missile.t, dir)
      position.copy(dir).multiplyScalar(altitude)

      const tNext = Math.min(missile.t + 0.01, 1)
      const altitudeNext = R + missile.apogee * Math.sin(Math.PI * tNext)
      slerpDir(missile.from, missile.to, tNext, dir)
      positionNext.copy(dir).multiplyScalar(altitudeNext)

      missile.mesh.position.copy(position)
      missile.mesh.lookAt(positionNext)
      missile.mesh.visible = true
      missile.trail.visible = true

      // 항적: 일정 간격마다 점 추가
      const { trailCount } = missile
      const positions = missile.trailGeometry.attributes.position
      const lastIndex = (trailCount - 1) * 3
      const farEnough =
        trailCount === 0 ||
        position.distanceToSquared(
          new THREE.Vector3(
            positions.array[lastIndex],
            positions.array[lastIndex + 1],
            positions.array[lastIndex + 2],
          ),
        ) > 0.0004
      if (farEnough && trailCount < TRAIL_POINTS) {
        positions.array.set([position.x, position.y, position.z], trailCount * 3)
        missile.trailCount += 1
        missile.trailGeometry.setDrawRange(0, missile.trailCount)
        positions.needsUpdate = true
      }
    })

    // 폭발 — 단계별 타임라인 (t: 0~1, 총 8초)
    explosions.forEach((explosion) => {
      if (!explosion.active) return
      explosion.t += dt / EXPLOSION_DURATION
      const t = explosion.t
      if (t >= 1) {
        explosion.active = false
        explosion.root.visible = false
        return
      }

      const {
        flash,
        fire,
        ring,
        ring2,
        stem,
        capGroup,
        capMaterial,
        debris,
        debrisGeometry,
        debrisMaterial,
        debrisVel,
        magnitude,
      } = explosion

      // 1) 섬광: 0 ~ 0.04 — 급팽창 후 즉시 소멸
      if (t < 0.04) {
        const k = t / 0.04
        flash.visible = true
        flash.scale.setScalar((0.02 + k * 0.16) * magnitude)
        flash.material.opacity = 1 - k
      } else {
        flash.visible = false
      }

      // 2) 화구: 0 ~ 0.3 — 상승하며 팽창, 서서히 소멸
      if (t < 0.3) {
        const k = t / 0.3
        fire.visible = true
        fire.position.y = 0.01 + k * 0.05
        fire.scale.setScalar((0.02 + k * 0.08) * magnitude)
        fire.material.opacity = 1 - k * k
      } else {
        fire.visible = false
      }

      // 3) 충격파 응축 링: 0.01 ~ 0.3 — 지표를 따라 확산
      if (t > 0.01 && t < 0.3) {
        const k = (t - 0.01) / 0.29
        ring.visible = true
        ring.scale.setScalar((0.01 + k * 0.2) * magnitude)
        ring.material.opacity = 0.7 * (1 - k)
      } else {
        ring.visible = false
      }

      // 3b) 흙먼지 링: 주 충격파보다 늦게 시작해 더 느리게, 더 멀리, 더 오래 퍼진다
      if (t > 0.03 && t < 0.55) {
        const k = (t - 0.03) / 0.52
        ring2.visible = true
        ring2.scale.setScalar((0.02 + k * 0.42) * magnitude)
        ring2.material.opacity = 0.4 * (1 - k * k)
      } else {
        ring2.visible = false
      }

      // 3c) 파편 스파크: 0 ~ 0.42 — 속도 적분 + 항력 감쇠로 사방에 흩날린다
      if (t < 0.42) {
        debris.visible = true
        const positions = debrisGeometry.attributes.position
        const drag = Math.max(0, 1 - dt * 1.4)
        for (let i = 0; i < DEBRIS_COUNT; i += 1) {
          const idx = i * 3
          debrisVel[idx] *= drag
          debrisVel[idx + 1] *= drag
          debrisVel[idx + 2] *= drag
          positions.array[idx] += debrisVel[idx] * dt
          positions.array[idx + 1] += debrisVel[idx + 1] * dt
          positions.array[idx + 2] += debrisVel[idx + 2] * dt
        }
        positions.needsUpdate = true
        debrisMaterial.opacity = 1 - (t / 0.42) ** 2
      } else {
        debris.visible = false
      }

      // 4) 버섯구름: 0.05 부터 성장, 0.7 이후 소산 — 전체 크기는 폭발마다의 magnitude 를 따른다
      const grow = THREE.MathUtils.clamp((t - 0.05) / 0.4, 0, 1)
      const growEase = 1 - (1 - grow) ** 2
      const dissipate = THREE.MathUtils.clamp((t - 0.7) / 0.3, 0, 1)
      const cloudOpacity = 0.9 * (1 - dissipate)
      const stemHeight = 0.075 * growEase * magnitude
      const stemRadius = (0.011 + growEase * 0.007) * magnitude
      const capScale = (0.01 + growEase * 0.028) * magnitude

      stem.visible = grow > 0
      stem.position.y = stemHeight / 2
      stem.scale.set(stemRadius, Math.max(stemHeight, 0.001), stemRadius)
      stem.material.opacity = cloudOpacity * 0.85

      capGroup.visible = grow > 0
      capGroup.position.y = stemHeight
      capGroup.scale.set(capScale, (0.007 + growEase * 0.015) * magnitude, capScale)
      capMaterial.opacity = cloudOpacity

      // 백열 주황 → 냉각된 회갈색, 내부 발광도 함께 식는다 (0.1 ~ 0.45 구간)
      const cool = THREE.MathUtils.clamp((t - 0.1) / 0.35, 0, 1)
      capMaterial.color.lerpColors(HOT, COOL, cool)
      capMaterial.emissive.lerpColors(HOT_EMISSIVE, NO_EMISSIVE, cool)
      stem.material.color.lerpColors(HOT, COOL, Math.min(1, cool * 1.3))
      stem.material.emissive.lerpColors(HOT_EMISSIVE, NO_EMISSIVE, Math.min(1, cool * 1.3))
    })
  }

  const dispose = () => {
    flashTexture.dispose()
    fireTexture.dispose()
    missileGeometry.dispose()
    missileMaterial.dispose()
    stemGeometry.dispose()
    lumpGeometry.dispose()
    ringGeometry.dispose()
    missiles.forEach(({ trailGeometry, trailMaterial }) => {
      trailGeometry.dispose()
      trailMaterial.dispose()
    })
    explosions.forEach(({ flash, fire, ring, ring2, stem, capMaterial, debrisGeometry, debrisMaterial }) => {
      flash.material.dispose()
      fire.material.dispose()
      ring.material.dispose()
      ring2.material.dispose()
      stem.material.dispose()
      capMaterial.dispose()
      debrisGeometry.dispose()
      debrisMaterial.dispose()
    })
  }

  return { group, launchVolley, update, dispose }
}

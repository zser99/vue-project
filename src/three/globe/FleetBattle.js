import * as THREE from 'three'
import { EARTH_RADIUS } from './Earth'

// ── 이스터에그: 우주 함대전 ──────────────────────────────────────────
// 충분히 줌아웃하면(지구 반지름의 ~4.3배 이상) 지구 옆 우주 공간에서
// 골드 크리스탈 함대(프로토스 풍)와 강철 블록 함대(테란 풍)가 교전한다.
// 게임 에셋이 아닌 프리미티브 조합으로 만든 오리지널 로우폴리 오마주.
// ────────────────────────────────────────────────────────────────────

const R = EARTH_RADIUS
const SHOW_START = R * 4.3 // 이 거리부터 서서히 등장
const SHOW_FULL = R * 5.3 // 이 거리에서 완전히 보임
const SHIP_SCALE = 0.5

const PROTOSS_CENTER = new THREE.Vector3(4.6 * R, 1.4 * R, -3.6 * R)
const TERRAN_CENTER = new THREE.Vector3(7.6 * R, 0.9 * R, -5.8 * R)

// 폭발/탄환용 발광 텍스처 (캔버스 생성)
function createBlastTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.3, 'rgba(255, 200, 120, 0.9)')
  gradient.addColorStop(0.65, 'rgba(255, 120, 50, 0.4)')
  gradient.addColorStop(1, 'rgba(255, 80, 30, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// 골드 크리스탈 함선: 납작한 곡면 선체 + 뻗은 날개 + 청록 발광 코어
function buildProtossShip(materials) {
  const ship = new THREE.Group()

  const hull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), materials.gold)
  hull.scale.set(1, 0.2, 0.72)

  const wingGeometry = new THREE.BoxGeometry(0.72, 0.05, 0.16)
  const wingLeft = new THREE.Mesh(wingGeometry, materials.gold)
  wingLeft.position.set(0.34, 0, 0.34)
  wingLeft.rotation.y = 0.55
  const wingRight = new THREE.Mesh(wingGeometry, materials.gold)
  wingRight.position.set(0.34, 0, -0.34)
  wingRight.rotation.y = -0.55

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), materials.plasmaCore)
  core.position.set(-0.1, 0.1, 0)

  ship.add(hull, wingLeft, wingRight, core)
  return ship
}

// 강철 블록 함선: 각진 선체 + 함교 + 포신 + 주황 엔진 불빛
function buildTerranShip(materials) {
  const ship = new THREE.Group()

  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.4), materials.steel)

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.28), materials.steel)
  bridge.position.set(-0.32, 0.2, 0)

  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.55, 8), materials.steel)
  cannon.rotation.z = Math.PI / 2
  cannon.position.set(0.7, 0, 0)

  const engineGeometry = new THREE.SphereGeometry(0.07, 8, 8)
  const engineTop = new THREE.Mesh(engineGeometry, materials.engineGlow)
  engineTop.position.set(-0.58, 0, 0.12)
  const engineBottom = new THREE.Mesh(engineGeometry, materials.engineGlow)
  engineBottom.position.set(-0.58, 0, -0.12)

  ship.add(hull, bridge, cannon, engineTop, engineBottom)
  return ship
}

export function createFleetBattle() {
  const group = new THREE.Group()
  group.visible = false

  // 페이드를 위해 모든 머티리얼을 transparent 로 만들고 목록으로 관리
  const materials = {
    gold: new THREE.MeshStandardMaterial({
      color: 0xd9b36c,
      metalness: 0.75,
      roughness: 0.35,
      transparent: true,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: 0x8a94a6,
      metalness: 0.6,
      roughness: 0.5,
      transparent: true,
    }),
    plasmaCore: new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true }),
    engineGlow: new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true }),
    plasmaBolt: new THREE.MeshBasicMaterial({
      color: 0x55ccff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    shellBolt: new THREE.MeshBasicMaterial({
      color: 0xff7744,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  }
  const materialList = Object.values(materials)

  // ── 함대 배치: 서로 마주 보는 두 편대 ──
  const forward = new THREE.Vector3().subVectors(TERRAN_CENTER, PROTOSS_CENTER).normalize()
  const buildFleet = (center, buildShip, facing, count = 6) => {
    const fleet = new THREE.Group()
    fleet.position.copy(center)
    fleet.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), facing)

    const ships = []
    for (let i = 0; i < count; i += 1) {
      const ship = buildShip(materials)
      // 지그재그 편대 + 랜덤 지터
      const base = new THREE.Vector3(
        (i % 2) * -0.7 + (Math.random() - 0.5) * 0.4,
        ((i % 3) - 1) * 0.75 + (Math.random() - 0.5) * 0.4,
        (i - count / 2) * 0.85 + (Math.random() - 0.5) * 0.4,
      )
      ship.position.copy(base)
      ship.scale.setScalar(SHIP_SCALE)
      fleet.add(ship)
      ships.push({ ship, base, phase: Math.random() * Math.PI * 2 })
    }
    group.add(fleet)
    return { fleet, ships }
  }

  const protoss = buildFleet(PROTOSS_CENTER, buildProtossShip, forward)
  const terran = buildFleet(TERRAN_CENTER, buildTerranShip, forward.clone().negate())

  // ── 탄환 풀 ──
  const boltGeometry = new THREE.BoxGeometry(0.55, 0.045, 0.045)
  const bolts = Array.from({ length: 14 }, () => {
    const mesh = new THREE.Mesh(boltGeometry, materials.plasmaBolt)
    mesh.visible = false
    group.add(mesh)
    return { mesh, active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, travel: 1, target: null }
  })

  // ── 폭발 풀 ──
  const blastTexture = createBlastTexture()
  const blasts = Array.from({ length: 8 }, () => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: blastTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    sprite.visible = false
    group.add(sprite)
    return { sprite, active: false, t: 0 }
  })

  const worldPos = new THREE.Vector3()
  const fireBolt = () => {
    const bolt = bolts.find(({ active }) => !active)
    if (!bolt) return

    const protossFires = Math.random() < 0.5
    const attackers = protossFires ? protoss : terran
    const defenders = protossFires ? terran : protoss
    const attacker = attackers.ships[Math.floor(Math.random() * attackers.ships.length)]
    const defender = defenders.ships[Math.floor(Math.random() * defenders.ships.length)]

    attacker.ship.getWorldPosition(bolt.from)
    defender.ship.getWorldPosition(bolt.to)

    bolt.active = true
    bolt.t = 0
    bolt.travel = bolt.from.distanceTo(bolt.to) / (6 * R) // 속도 6R/s
    bolt.target = defender
    bolt.mesh.material = protossFires ? materials.plasmaBolt : materials.shellBolt
    bolt.mesh.position.copy(bolt.from)
    bolt.mesh.lookAt(bolt.to)
    bolt.mesh.rotateY(Math.PI / 2) // BoxGeometry 장축(x)을 진행 방향으로
    bolt.mesh.visible = true
  }

  const explodeAt = (position) => {
    const blast = blasts.find(({ active }) => !active)
    if (!blast) return
    blast.active = true
    blast.t = 0
    blast.sprite.position.copy(position)
    blast.sprite.visible = true
  }

  // ── 프레임 업데이트 ──
  let opacity = 0
  let fireCooldown = 0

  const update = (dt, elapsed, cameraDist) => {
    // 줌아웃 정도에 따라 페이드 인/아웃
    const target = THREE.MathUtils.clamp((cameraDist - SHOW_START) / (SHOW_FULL - SHOW_START), 0, 1)
    opacity += (target - opacity) * (1 - Math.exp(-4 * dt))
    group.visible = opacity > 0.02
    if (!group.visible) return

    materialList.forEach((material) => {
      material.opacity = opacity
    })

    // 함선 부유 모션
    const drift = (entries) => {
      entries.ships.forEach(({ ship, base, phase }) => {
        ship.position.set(
          base.x + Math.sin(elapsed * 0.6 + phase) * 0.1,
          base.y + Math.sin(elapsed * 0.8 + phase * 1.7) * 0.14,
          base.z + Math.cos(elapsed * 0.5 + phase) * 0.1,
        )
        ship.rotation.z = Math.sin(elapsed * 0.7 + phase) * 0.06
      })
    }
    drift(protoss)
    drift(terran)

    // 발사 스케줄
    fireCooldown -= dt
    if (fireCooldown <= 0) {
      fireBolt()
      fireCooldown = 0.18 + Math.random() * 0.35
    }

    // 탄환 이동 → 명중 시 폭발
    bolts.forEach((bolt) => {
      if (!bolt.active) return
      bolt.t += dt / bolt.travel
      if (bolt.t >= 1) {
        bolt.active = false
        bolt.mesh.visible = false
        bolt.target.ship.getWorldPosition(worldPos)
        explodeAt(worldPos)
        return
      }
      bolt.mesh.position.lerpVectors(bolt.from, bolt.to, bolt.t)
      bolt.mesh.material.opacity = opacity
    })

    // 폭발 확산 + 소멸
    blasts.forEach((blast) => {
      if (!blast.active) return
      blast.t += dt / 0.45
      if (blast.t >= 1) {
        blast.active = false
        blast.sprite.visible = false
        return
      }
      blast.sprite.scale.setScalar(0.15 + blast.t * 0.85)
      blast.sprite.material.opacity = (1 - blast.t) * opacity
    })
  }

  const dispose = () => {
    blastTexture.dispose()
    boltGeometry.dispose()
    materialList.forEach((material) => material.dispose())
    blasts.forEach(({ sprite }) => sprite.material.dispose())
    group.traverse((obj) => obj.geometry?.dispose())
  }

  return { group, update, dispose }
}

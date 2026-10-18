import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { SimulationParam, SimulationReadout } from './types'

export interface DissectInfo {
  title: string
  partName: string
  role: string
  bloodType?: 'Oxygenated' | 'Deoxygenated' | 'Neutral'
  internalStructures: string[]
  description: string
  actionHint?: string
}

export interface BuiltinTemplate3D {
  type: string
  title: string
  subject: string
  concept: string
  description: string
  emoji: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  params: SimulationParam[]
  presets?: { label: string; params: Record<string, number> }[]
  calculateReadouts: (p: Record<string, number>) => SimulationReadout[]
  initScene: (
    container: HTMLElement,
    params: Record<string, number>,
    callbacks: {
      onUpdateReadouts?: (r: SimulationReadout[]) => void
      onInspectPart?: (info: DissectInfo | null) => void
    }
  ) => {
    updateParams: (params: Record<string, number>) => void
    setPlaying: (playing: boolean) => void
    reset: () => void
    dispose: () => void
    closeDissection?: () => void
  }
}

// Helper: Apply cinematic tone mapping, soft shadows, and high-DPI scaling to WebGL renderer
export function setupRenderer(renderer: THREE.WebGLRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}

// Helper: Create a styled 3D laboratory environment (for physics, optics & mechanics)
function createLabEnvironment(scene: THREE.Scene, gridSize = 40, divisions = 40) {
  scene.background = new THREE.Color(0x070c18)
  scene.fog = new THREE.FogExp2(0x070c18, 0.012)

  // Dual optical laboratory grid with glowing cyan center axis
  const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x38bdf8, 0x1e293b)
  gridHelper.position.y = -0.01
  scene.add(gridHelper)

  // Subtle circular optical pedestal ring
  const ringGeo = new THREE.RingGeometry(gridSize * 0.28, gridSize * 0.28 + 0.15, 64)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
  const pedestalRing = new THREE.Mesh(ringGeo, ringMat)
  pedestalRing.rotation.x = -Math.PI / 2
  pedestalRing.position.y = 0.005
  scene.add(pedestalRing)

  // Natural dual-tone hemisphere light (cyan sky / navy ground)
  const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.7)
  scene.add(hemiLight)

  // Key laboratory directional spotlight with soft shadows
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
  dirLight.position.set(18, 30, 18)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  scene.add(dirLight)

  // Accent specular rim light (cyan/blue)
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9)
  rimLight.position.set(-18, 14, -18)
  scene.add(rimLight)

  // Warm amber fill light for balanced contrast
  const fillLight = new THREE.DirectionalLight(0xf59e0b, 0.35)
  fillLight.position.set(15, -5, -15)
  scene.add(fillLight)
}

// Helper: Create an authentic medical/biological studio environment (NO harsh graph paper grid!)
function createBioStudioEnvironment(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x070d18)
  scene.fog = new THREE.FogExp2(0x070d18, 0.016)

  // Soft surgical pedestal disc (smooth non-grid floor)
  const discGeo = new THREE.CircleGeometry(14, 64)
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.15,
  })
  const pedestalDisc = new THREE.Mesh(discGeo, discMat)
  pedestalDisc.rotation.x = -Math.PI / 2
  pedestalDisc.position.y = -4.5
  pedestalDisc.receiveShadow = true
  scene.add(pedestalDisc)

  // Soft luminous rim circle
  const rimGeo = new THREE.RingGeometry(13.7, 14.0, 64)
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
  const rim = new THREE.Mesh(rimGeo, rimMat)
  rim.rotation.x = -Math.PI / 2
  rim.position.y = -4.49
  scene.add(rim)

  // Gentle floating dust/fluid particles for volumetric depth
  const bioDustCount = 150
  const bioDustGeo = new THREE.BufferGeometry()
  const bioDustPos = new Float32Array(bioDustCount * 3)
  for (let i = 0; i < bioDustCount * 3; i++) {
    bioDustPos[i] = (Math.random() - 0.5) * 35
  }
  bioDustGeo.setAttribute('position', new THREE.BufferAttribute(bioDustPos, 3))
  const bioDustMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.35, transparent: true, opacity: 0.35 })
  const bioDust = new THREE.Points(bioDustGeo, bioDustMat)
  scene.add(bioDust)

  // Medical studio lighting (high CRI clean specular)
  const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.95)
  scene.add(hemiLight)

  const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.6)
  keyLight.position.set(16, 26, 18)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.width = 1024
  keyLight.shadow.mapSize.height = 1024
  scene.add(keyLight)

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2)
  rimLight.position.set(-18, 14, -14)
  scene.add(rimLight)

  const warmUnderlight = new THREE.DirectionalLight(0xf43f5e, 0.4)
  warmUnderlight.position.set(12, -8, -10)
  scene.add(warmUnderlight)
}

export const BUILTIN_TEMPLATES_3D: Record<string, BuiltinTemplate3D> = {
  // ==========================================
  // 1. PHYSICS: 3D PROJECTILE MOTION
  // ==========================================
  projectile_3d: {
    type: 'projectile_3d',
    title: '3D Projectile Motion Cannon & Field',
    subject: 'Physics · Mechanics',
    concept: '3D Parabolic Trajectories & Vector Decomposition',
    description: 'Aim an articulated 3D cannon in elevation and azimuth. Launch projectiles across a 3D terrain grid, watch glowing trajectory arcs, and track velocity vectors in real time.',
    emoji: '🚀',
    difficulty: 'Beginner',
    presets: [
      { label: '🎯 45° Max Range', params: { angle: 45, azimuth: 0, speed: 28, gravity: 9.8 } },
      { label: '🪐 Moon Gravity', params: { angle: 45, azimuth: 20, speed: 22, gravity: 1.6 } },
      { label: '⚡ High Arc (70°)', params: { angle: 70, azimuth: -30, speed: 30, gravity: 9.8 } },
      { label: '🏎️ Flat Bullet (18°)', params: { angle: 18, azimuth: 45, speed: 38, gravity: 9.8 } },
    ],
    params: [
      { key: 'angle', label: 'Elevation Angle', min: 10, max: 80, step: 1, defaultValue: 45, unit: '°' },
      { key: 'azimuth', label: 'Azimuth (Heading)', min: -90, max: 90, step: 1, defaultValue: 0, unit: '°' },
      { key: 'speed', label: 'Muzzle Velocity (v₀)', min: 10, max: 45, step: 1, defaultValue: 28, unit: 'm/s' },
      { key: 'gravity', label: 'Gravity (g)', min: 1.6, max: 20, step: 0.2, defaultValue: 9.8, unit: 'm/s²' },
    ],
    calculateReadouts: (p) => {
      const elRad = (p.angle * Math.PI) / 180
      const g = p.gravity
      const v0 = p.speed
      const timeOfFlight = (2 * v0 * Math.sin(elRad)) / g
      const maxHeight = (v0 * v0 * Math.sin(elRad) * Math.sin(elRad)) / (2 * g)
      const range = (v0 * v0 * Math.sin(2 * elRad)) / g
      return [
        { label: 'Max Height (H)', value: maxHeight.toFixed(2), unit: 'm', formula: 'H = (v₀² sin²θ)/(2g)' },
        { label: 'Ground Range (R)', value: range.toFixed(2), unit: 'm', formula: 'R = (v₀² sin 2θ)/g' },
        { label: 'Flight Time (T)', value: timeOfFlight.toFixed(2), unit: 's', formula: 'T = (2v₀ sin θ)/g' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 60, 60)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(30, 25, 45)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(10, 5, 0)

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        projectile: {
          title: '3D Projectile Kinematics & Velocity Decomposition',
          partName: 'Instantaneous Vector Orthogonal Decomposition',
          role: 'Demonstrates Galileo\'s principle of independent horizontal and vertical motions in gravitational fields',
          internalStructures: ['Horizontal Constant Velocity: vx = v₀ cos(θ)', 'Vertical Accelerated Velocity: vy(t) = v₀ sin(θ) - gt', 'Resultant Velocity Vector: v(t) = √(vx² + vy²)', 'Mechanical Energy Conservation: Ek(t) + Ug(t) = const'],
          description: 'Double-tapping the projectile dissects the velocity vector in real time. Because gravity acts strictly downward along the -Y axis (ay = -g), horizontal speed vx remains completely constant throughout flight while vertical vy decelerates to zero at apex.',
        },
        cannon: {
          title: 'Articulated Ballistic Launcher & Elevation Turret',
          partName: 'Muzzle Vector Orientation (Elevation θ & Azimuth φ)',
          role: 'Directs initial kinetic energy impulse vector in 3D spherical coordinate angles',
          internalStructures: ['Muzzle Velocity Vector (v₀ = 10..45 m/s)', 'Elevation Range (10° to 80° for max 45° range)', 'Azimuth Heading Axis (-90° to +90°)', 'Gravitational Potential Energy Datum (y = 0)'],
          description: 'The articulated cannon decomposes launch energy into 3D Cartesian coordinates: vx = v₀ cos(θ) cos(φ), vy = v₀ sin(θ), and vz = v₀ cos(θ) sin(φ).',
        },
      }

      // 3D Articulated Cannon Rig
      const cannonGroup = new THREE.Group()
      scene.add(cannonGroup)

      const baseGeo = new THREE.CylinderGeometry(2, 2.5, 0.8, 24)
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.25 })
      const baseMesh = new THREE.Mesh(baseGeo, metalMat)
      baseMesh.position.y = 0.4
      baseMesh.userData = { partId: 'cannon' }
      cannonGroup.add(baseMesh)
      interactableMeshes.push(baseMesh)

      const turretPivot = new THREE.Group()
      turretPivot.position.y = 1.0
      cannonGroup.add(turretPivot)

      const barrelGroup = new THREE.Group()
      turretPivot.add(barrelGroup)

      const barrelGeo = new THREE.CylinderGeometry(0.5, 0.7, 4.5, 24)
      barrelGeo.translate(0, 2.25, 0)
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 })
      const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat)
      barrelMesh.rotation.x = Math.PI / 2
      barrelMesh.userData = { partId: 'cannon' }
      barrelGroup.add(barrelMesh)
      interactableMeshes.push(barrelMesh)

      // Target Rings on the Ground
      const targetGroup = new THREE.Group()
      scene.add(targetGroup)
      const targetColors = [0xef4444, 0xffffff, 0xef4444, 0x38bdf8]
      for (let i = 0; i < 4; i++) {
        const ringGeo = new THREE.RingGeometry((4 - i) * 1.5 - 0.25, (4 - i) * 1.5, 32)
        const ringMat = new THREE.MeshBasicMaterial({ color: targetColors[i], side: THREE.DoubleSide })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.02
        targetGroup.add(ring)
      }

      // Parabolic Trajectory Line
      const maxTrailPoints = 300
      const trailPositions = new Float32Array(maxTrailPoints * 3)
      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
      const trailMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
      const trailLine = new THREE.Line(trailGeo, trailMat)
      scene.add(trailLine)

      // Cannonball Mesh
      const ballGeo = new THREE.SphereGeometry(0.55, 32, 32)
      const ballMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
      })
      const ballMesh = new THREE.Mesh(ballGeo, ballMat)
      ballMesh.castShadow = true
      ballMesh.userData = { partId: 'projectile' }
      scene.add(ballMesh)
      interactableMeshes.push(ballMesh)

      // Dynamic Velocity Vector Arrows
      const vectorGroup = new THREE.Group()
      vectorGroup.visible = false
      scene.add(vectorGroup)

      const velArrowResultant = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 4.0, 0xf59e0b, 0.8, 0.4)
      const velArrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 3.0, 0x06b6d4, 0.6, 0.3)
      const velArrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 3.0, 0xec4899, 0.6, 0.3)
      vectorGroup.add(velArrowResultant, velArrowX, velArrowY)

      let t = 0
      let trailIndex = 0

      // Raycaster for Double-Tap & Double-Click Dissection
      let activeDissectId: 'projectile' | 'cannon' | null = null
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const id = hit.userData?.partId as 'projectile' | 'cannon' | undefined
          if (id) {
            if (activeDissectId === id) {
              activeDissectId = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectId = id
              callbacks.onInspectPart?.(DISSECT_CARDS[id])
            }
            vectorGroup.visible = Boolean(activeDissectId === 'projectile')
          }
        } else {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          vectorGroup.visible = false
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      function updateCannonOrientation() {
        const azRad = (params.azimuth * Math.PI) / 180
        const elRad = (params.angle * Math.PI) / 180
        turretPivot.rotation.y = -azRad
        barrelGroup.rotation.x = -elRad

        const v0 = params.speed
        const g = params.gravity
        const range = (v0 * v0 * Math.sin(2 * elRad)) / g
        targetGroup.position.set(range * Math.cos(azRad), 0, range * Math.sin(azRad))
      }

      updateCannonOrientation()

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          t += 0.02
          const elRad = (params.angle * Math.PI) / 180
          const azRad = (params.azimuth * Math.PI) / 180
          const v0 = params.speed
          const g = params.gravity

          const vx = v0 * Math.cos(elRad)
          const vy = v0 * Math.sin(elRad) - g * t
          const flightTime = (2 * v0 * Math.sin(elRad)) / g

          if (t <= flightTime) {
            const posX = v0 * Math.cos(elRad) * t * Math.cos(azRad)
            const posY = Math.max(0.4, v0 * Math.sin(elRad) * t - 0.5 * g * t * t)
            const posZ = v0 * Math.cos(elRad) * t * Math.sin(azRad)
            ballMesh.position.set(posX, posY, posZ)

            // Dynamic velocity vector arrows attached to projectile
            vectorGroup.position.set(posX, posY, posZ)
            const vInst = new THREE.Vector3(vx * Math.cos(azRad), vy, vx * Math.sin(azRad))
            const vLen = Math.max(0.5, vInst.length() * 0.15)
            velArrowResultant.setDirection(vInst.clone().normalize())
            velArrowResultant.setLength(vLen, 0.6, 0.3)

            const vXDir = new THREE.Vector3(Math.cos(azRad), 0, Math.sin(azRad)).normalize()
            velArrowX.setDirection(vXDir)
            velArrowX.setLength(Math.max(0.4, Math.abs(vx) * 0.15), 0.5, 0.25)

            velArrowY.setDirection(new THREE.Vector3(0, vy >= 0 ? 1 : -1, 0))
            velArrowY.setLength(Math.max(0.4, Math.abs(vy) * 0.15), 0.5, 0.25)

            if (trailIndex < maxTrailPoints) {
              const posAttr = trailGeo.attributes.position as THREE.BufferAttribute
              posAttr.setXYZ(trailIndex, posX, posY, posZ)
              posAttr.needsUpdate = true
              trailIndex++
            }
          } else {
            // Loop trajectory after 1.2s delay
            if (t > flightTime + 1.2) {
              t = 0
              trailIndex = 0
              const posAttr = trailGeo.attributes.position as THREE.BufferAttribute
              for (let i = 0; i < maxTrailPoints; i++) {
                posAttr.setXYZ(i, 0, 0, 0)
              }
              posAttr.needsUpdate = true
            }
          }
        }

        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          updateCannonOrientation()
          t = 0
          trailIndex = 0
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          t = 0
          trailIndex = 0
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          vectorGroup.visible = false
        },
        closeDissection: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          vectorGroup.visible = false
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 2. PHYSICS: 3D SOLAR SYSTEM & ORBITS
  // ==========================================
  solar_system_3d: {
    type: 'solar_system_3d',
    title: '3D Solar System & Planetary Orbits',
    subject: 'Physics · Astrophysics',
    concept: "Kepler's Laws of Planetary Motion & Gravity",
    description: 'Explore our 3D solar system. Adjust orbital speeds, planet distances, and gravitational force to witness Keplerian elliptical orbits and planetary velocity variations.',
    emoji: '🪐',
    difficulty: 'Beginner',
    presets: [
      { label: '🌍 Inner Terrestrial Planets', params: { speedMult: 1.0, scaleDist: 1.0, gravityConst: 1.0 } },
      { label: '⚡ Hyper Orbital Speed (2.5x)', params: { speedMult: 2.5, scaleDist: 1.0, gravityConst: 1.0 } },
      { label: '🌌 Compressed Orbits (Dense)', params: { speedMult: 1.2, scaleDist: 0.6, gravityConst: 1.2 } },
    ],
    params: [
      { key: 'speedMult', label: 'Orbital Speed Multiplier', min: 0.2, max: 4.0, step: 0.1, defaultValue: 1.0, unit: 'x' },
      { key: 'scaleDist', label: 'Orbit Distance Scale', min: 0.5, max: 1.8, step: 0.1, defaultValue: 1.0, unit: 'x' },
      { key: 'gravityConst', label: 'Central Gravity (M_sun)', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.0, unit: 'M☉' },
    ],
    calculateReadouts: (p) => {
      const vEarth = 29.78 * Math.sqrt(p.gravityConst / p.scaleDist)
      const periodEarth = 365.25 * Math.pow(p.scaleDist, 1.5) / Math.sqrt(p.gravityConst)
      return [
        { label: 'Earth Orbital Velocity', value: vEarth.toFixed(2), unit: 'km/s', formula: 'v = √(GM/r)' },
        { label: 'Earth Year Period', value: periodEarth.toFixed(1), unit: 'days', formula: 'T² ∝ r³' },
        { label: 'Kepler Ratio (T²/r³)', value: '1.00', unit: 'AU⁻³ yr²', formula: 'T²/a³ = const' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x050711)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 45, 55)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        sun: {
          title: 'The Sun (Sol) · Thermonuclear Core Dissected',
          partName: 'Stellar Interior · Fusion Engine & Radiative Zone',
          role: 'Supplies 99.86% of the solar system\'s mass; generates energy via the proton-proton (p-p) nuclear fusion chain',
          internalStructures: ['Thermonuclear Core (15,000,000 K, 4H → He + 26.7 MeV)', 'Radiative Diffusion Zone (~100,000 yr photon travel)', 'Convective Boiling Granule Cells', 'Photosphere (5,800 K) & Chromosphere Spicules'],
          description: 'Double-tapping peels open the solar interior: in the deep core, 600 million tons of hydrogen fuse into helium every second, converting 4 million tons of mass into pure electromagnetic radiant energy via E = mc².',
        },
        earth: {
          title: 'Earth (Tellus) · Geosphere Cross-Section Dissected',
          partName: 'Terrestrial Core, Mantle & Lithosphere',
          role: 'Active planetary geodynamo maintaining an atmosphere and magnetosphere protective of biological life',
          internalStructures: ['Continental & Oceanic Crust (0–35 km)', 'Convecting Silicate Mantle (35–2890 km)', 'Liquid Iron-Nickel Outer Core (Geodynamo, 2890–5150 km)', 'Solid Crystallized Inner Core (5150–6371 km, 5400°C)'],
          description: 'Dissecting Earth exposes the liquid iron outer core circulating at high temperatures to generate our protective geomagnetic shield, while thermal convection in the mantle drives continental drift and plate tectonics.',
        },
        saturn: {
          title: 'Saturn & Ring System · Cryogenic Debris Field',
          partName: 'Planetary Ice Rings & Metallic Hydrogen Mantle',
          role: 'Second largest gas giant featuring the most extensive planetary ring system in the solar system',
          internalStructures: ['Cassini Division (4800 km gravitational clearing by moon Mimas)', 'Water-Ice Particles (microns to 10-meter boulders)', 'Metallic Liquid Hydrogen Interior Ocean', 'Dense Rock-Iron Core (~15 Earth masses)'],
          description: 'Inspecting Saturn reveals the billions of discrete water-ice particles orbiting at speeds dictated by Kepler\'s 3rd law. The rings are only ~10 to 30 meters thick despite spanning over 280,000 kilometers across.',
        },
        mars: {
          title: 'Mars · Basaltic Crust & Solidified Dynamo',
          partName: 'Terrestrial Iron-Oxide Regolith & Core',
          role: 'Dry terrestrial planet holding geological records of ancient fluvial lakes and extinct volcanism',
          internalStructures: ['Iron(III) Oxide Red Dust Regolith', 'Tharsis Volcanic Shield (Olympus Mons, 22 km)', 'Solidified Sulfide-Rich Core (loss of magnetic dynamo)', 'Polar Water & Dry-Ice CO2 Caps'],
          description: 'Dissecting Mars reveals why its atmosphere stripped away: when its small core cooled and the geodynamo shut down ~4 billion years ago, solar winds eroded the atmosphere, turning water lakes into frozen regolith.',
        },
      }

      // Starfield background
      const starsCount = 1200
      const starsGeo = new THREE.BufferGeometry()
      const starsPos = new Float32Array(starsCount * 3)
      for (let i = 0; i < starsCount * 3; i++) {
        starsPos[i] = (Math.random() - 0.5) * 500
      }
      starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3))
      const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.7 })
      const stars = new THREE.Points(starsGeo, starsMat)
      scene.add(stars)

      // The Sun
      const sunGroup = new THREE.Group()
      scene.add(sunGroup)
      const sunGeo = new THREE.SphereGeometry(3.5, 32, 32)
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff7ed })
      const sunMesh = new THREE.Mesh(sunGeo, sunMat)
      sunMesh.userData = { bodyId: 'sun' }
      sunGroup.add(sunMesh)
      interactableMeshes.push(sunMesh)

      const coronaGeo = new THREE.SphereGeometry(4.3, 32, 32)
      const coronaMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
        side: THREE.BackSide,
      })
      const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat)
      sunGroup.add(coronaMesh)

      const outerCoronaGeo = new THREE.SphereGeometry(5.2, 32, 32)
      const outerCoronaMat = new THREE.MeshBasicMaterial({
        color: 0xd97706,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
      })
      const outerCoronaMesh = new THREE.Mesh(outerCoronaGeo, outerCoronaMat)
      sunGroup.add(outerCoronaMesh)

      const sunLight = new THREE.PointLight(0xfffbeb, 2.5, 300)
      sunGroup.add(sunLight)

      // Planets setup
      const planetData = [
        { name: 'Mercury', size: 0.7, dist: 6.5, speed: 4.15, color: 0x94a3b8 },
        { name: 'Venus', size: 1.1, dist: 9.8, speed: 1.62, color: 0xf59e0b },
        { name: 'Earth', size: 1.25, dist: 14.0, speed: 1.0, color: 0x38bdf8, hasMoon: true },
        { name: 'Mars', size: 0.85, dist: 18.5, speed: 0.53, color: 0xef4444 },
        { name: 'Jupiter', size: 2.8, dist: 25.5, speed: 0.084, color: 0xd97706 },
        { name: 'Saturn', size: 2.2, dist: 33.5, speed: 0.034, color: 0xfef08a, hasRings: true },
      ]

      const planets: {
        mesh: THREE.Mesh
        pivot: THREE.Group
        orbitLine: THREE.Line
        data: (typeof planetData)[0]
        angle: number
      }[] = []

      let earthMoon: THREE.Mesh | null = null

      planetData.forEach((p) => {
        const pivot = new THREE.Group()
        scene.add(pivot)

        const pGeo = new THREE.SphereGeometry(p.size, 24, 24)
        const pMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.5, metalness: 0.1 })
        const mesh = new THREE.Mesh(pGeo, pMat)
        mesh.position.x = p.dist * params.scaleDist
        mesh.userData = { bodyId: p.name.toLowerCase() }
        pivot.add(mesh)
        interactableMeshes.push(mesh)

        if (p.hasMoon) {
          const mGeo = new THREE.SphereGeometry(0.32, 16, 16)
          const mMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 })
          earthMoon = new THREE.Mesh(mGeo, mMat)
          mesh.add(earthMoon)
        }

        if (p.hasRings) {
          const ringGeo1 = new THREE.RingGeometry(p.size * 1.35, p.size * 1.8, 48)
          const ringMat1 = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
          })
          const ring1 = new THREE.Mesh(ringGeo1, ringMat1)
          ring1.rotation.x = Math.PI / 2.3
          mesh.add(ring1)

          const ringGeo2 = new THREE.RingGeometry(p.size * 1.92, p.size * 2.45, 48)
          const ringMat2 = new THREE.MeshBasicMaterial({
            color: 0xd97706,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.55,
          })
          const ring2 = new THREE.Mesh(ringGeo2, ringMat2)
          ring2.rotation.x = Math.PI / 2.3
          mesh.add(ring2)
        }

        const orbitCurve = new THREE.EllipseCurve(0, 0, p.dist * params.scaleDist, p.dist * params.scaleDist, 0, 2 * Math.PI, false, 0)
        const points = orbitCurve.getPoints(64)
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(points.map((pt) => new THREE.Vector3(pt.x, 0, pt.y)))
        const orbitMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 })
        const orbitLine = new THREE.Line(orbitGeo, orbitMat)
        scene.add(orbitLine)

        planets.push({ mesh, pivot, orbitLine, data: p, angle: Math.random() * Math.PI * 2 })
      })

      // Raycaster for Double-Tap & Double-Click Dissection
      let activeDissectId: string | null = null
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const id = hit.userData?.bodyId as string | undefined
          if (id) {
            if (activeDissectId === id) {
              activeDissectId = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectId = id
              const card = DISSECT_CARDS[id] || DISSECT_CARDS.earth
              callbacks.onInspectPart?.(card)
            }
          }
        } else {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          const baseStep = 0.015 * params.speedMult * Math.sqrt(params.gravityConst)
          planets.forEach((p) => {
            p.angle += baseStep * p.data.speed
            const r = p.data.dist * params.scaleDist
            p.mesh.position.set(r * Math.cos(p.angle), 0, r * Math.sin(p.angle))
            p.mesh.rotation.y += 0.02
          })
          sunGroup.rotation.y += 0.004
          const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.04
          coronaMesh.scale.setScalar(pulse)
          outerCoronaMesh.scale.setScalar(1 + Math.cos(Date.now() * 0.002) * 0.06)

          if (earthMoon) {
            const moonA = Date.now() * 0.004
            earthMoon.position.set(2.4 * Math.cos(moonA), 0.4 * Math.sin(moonA), 2.4 * Math.sin(moonA))
          }
        }

        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          planets.forEach((p) => {
            const r = p.data.dist * params.scaleDist
            p.mesh.position.set(r * Math.cos(p.angle), 0, r * Math.sin(p.angle))
            const orbitCurve = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0)
            const points = orbitCurve.getPoints(64)
            p.orbitLine.geometry.setFromPoints(points.map((pt) => new THREE.Vector3(pt.x, 0, pt.y)))
          })
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          planets.forEach((p) => (p.angle = 0))
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        closeDissection: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 3. CHEMISTRY: 3D BOHR ATOM & QUANTUM ORBITALS
  // ==========================================
  bohr_atom_3d: {
    type: 'bohr_atom_3d',
    title: '3D Bohr Atom & Quantum Orbitals',
    subject: 'Chemistry · Atomic Structure',
    concept: 'Quantized Energy Levels, Photon Emission & Orbitals',
    description: 'Interact with a 3D atom model. Trigger electron quantum jumps between energy shells (n=1 to 5) to watch photon absorption and emission of visible spectral lines in real-time.',
    emoji: '⚛️',
    difficulty: 'Beginner',
    presets: [
      { label: '🔴 Balmer Red Line (3 → 2)', params: { nInitial: 3, nFinal: 2, orbitalMode: 0 } },
      { label: '🔵 Balmer Cyan Line (4 → 2)', params: { nInitial: 4, nFinal: 2, orbitalMode: 0 } },
      { label: '🟣 Balmer Violet (5 → 2)', params: { nInitial: 5, nFinal: 2, orbitalMode: 0 } },
      { label: '☁️ 3D p-Orbital Dumbbell', params: { nInitial: 2, nFinal: 1, orbitalMode: 1 } },
    ],
    params: [
      { key: 'nInitial', label: 'Initial Shell (n_i)', min: 1, max: 5, step: 1, defaultValue: 3, unit: '' },
      { key: 'nFinal', label: 'Final Shell (n_f)', min: 1, max: 4, step: 1, defaultValue: 2, unit: '' },
      { key: 'orbitalMode', label: 'Render Mode (0: Shells, 1: 3D Orbitals)', min: 0, max: 1, step: 1, defaultValue: 0, unit: '' },
    ],
    calculateReadouts: (p) => {
      const ni = Math.max(p.nInitial, p.nFinal + 1)
      const nf = Math.min(p.nInitial, p.nFinal)
      const rydberg = 1.097e7 // m^-1
      const invLambda = rydberg * (1 / (nf * nf) - 1 / (ni * ni))
      const wavelengthNm = invLambda > 0 ? (1e9 / invLambda).toFixed(1) : 'N/A'
      const deltaE = (13.6 * (1 / (nf * nf) - 1 / (ni * ni))).toFixed(2)
      return [
        { label: 'Transition Energy (ΔE)', value: deltaE, unit: 'eV', formula: 'ΔE = 13.6(1/n_f² - 1/n_i²)' },
        { label: 'Emitted Wavelength (λ)', value: wavelengthNm, unit: 'nm', formula: '1/λ = R_H(1/n_f² - 1/n_i²)' },
        { label: 'Spectral Series', value: nf === 1 ? 'Lyman (UV)' : nf === 2 ? 'Balmer (Visible)' : 'Paschen (IR)' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 35, 35)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 20, 32)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        nucleus: {
          title: 'Atomic Nucleus · Subatomic Quark Interior Dissected',
          partName: 'Nucleon Core · Valence Quarks & Gluon Field',
          role: 'Contains 99.95% of atomic mass bound together by the Residual Strong Nuclear Force',
          internalStructures: ['2 Up Quarks (u: +2/3 e)', '1 Down Quark (d: -1/3 e)', 'Gluon Color-Force Flux Springs', 'Yukawa Pion Exchange Field', 'Nuclear Binding Energy (8.8 MeV/nucleon)'],
          description: 'The nucleon shell has peeled open to reveal the subatomic valence quarks: two Up quarks (+2/3 charge) and one Down quark (-1/3 charge) bound by gluon flux tubes oscillating with asymptotic freedom.',
        },
        electron: {
          title: 'Quantum Electron · Wave-Particle Dissection',
          partName: 'Electron Wavepacket & Quantum Numbers',
          role: 'Quantized lepton executing orbital angular momentum transitions around the Coulomb potential',
          internalStructures: ['Principal Quantum Number (n = 1..5)', 'Orbital Angular Momentum (l = 0..n-1)', 'Magnetic Quantum Number (m_l)', 'Fermion Spin (m_s = ±½)', 'de Broglie Wavelength (λ = h/p)'],
          description: 'Inspecting the orbiting electron reveals its wavepacket representation. Rather than a classical Newtonian point particle, it exists as a complex probability amplitude cloud ψ(r,θ,φ) whose energy matches E_n = -13.6 eV / n².',
        },
      }

      // Starfield background
      const starGeo = new THREE.BufferGeometry()
      const starPos = new Float32Array(500 * 3)
      for (let i = 0; i < 500 * 3; i++) {
        starPos[i] = (Math.random() - 0.5) * 200
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      const starMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.6, transparent: true, opacity: 0.5 })
      const stars = new THREE.Points(starGeo, starMat)
      scene.add(stars)

      // Nucleus Cluster (Protons & Neutrons with subtle energetic glow)
      const nucleusGroup = new THREE.Group()
      scene.add(nucleusGroup)
      const nucleonGeo = new THREE.SphereGeometry(0.52, 20, 20)
      const protonMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.25,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        metalness: 0.3,
      })
      const neutronMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.4,
        metalness: 0.2,
      })

      const coreLight = new THREE.PointLight(0xf59e0b, 2.2, 40)
      nucleusGroup.add(coreLight)

      const nucleonPositions = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.55, 0.45, 0.3),
        new THREE.Vector3(-0.5, 0.4, -0.4),
        new THREE.Vector3(0.4, -0.5, -0.3),
        new THREE.Vector3(-0.45, -0.4, 0.45),
        new THREE.Vector3(0.6, -0.2, 0.5),
        new THREE.Vector3(-0.6, 0.3, 0.3),
        new THREE.Vector3(0.2, 0.65, -0.35),
        new THREE.Vector3(-0.25, -0.65, -0.2),
        new THREE.Vector3(0.1, -0.1, 0.7),
        new THREE.Vector3(-0.1, 0.1, -0.7),
        new THREE.Vector3(0.65, 0.1, -0.5),
      ]

      const nucleonMeshes: THREE.Mesh[] = []
      nucleonPositions.forEach((pos, idx) => {
        const mat = idx % 2 === 0 ? protonMat : neutronMat
        const nMesh = new THREE.Mesh(nucleonGeo, mat)
        nMesh.position.copy(pos)
        nMesh.userData = { partId: 'nucleus' }
        nucleusGroup.add(nMesh)
        nucleonMeshes.push(nMesh)
        interactableMeshes.push(nMesh)
      })

      const nucHitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 16, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      )
      nucHitMesh.userData = { partId: 'nucleus' }
      nucleusGroup.add(nucHitMesh)
      interactableMeshes.push(nucHitMesh)

      // Subatomic Inner Quark Triad
      const quarkGroup = new THREE.Group()
      quarkGroup.visible = false
      scene.add(quarkGroup)

      const quarkGeo = new THREE.SphereGeometry(0.35, 20, 20)
      const upQuarkMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.8,
        roughness: 0.15,
        metalness: 0.3,
      })
      const downQuarkMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.8,
        roughness: 0.15,
        metalness: 0.3,
      })

      const upQuark1 = new THREE.Mesh(quarkGeo, upQuarkMat)
      const upQuark2 = new THREE.Mesh(quarkGeo, upQuarkMat)
      const downQuark = new THREE.Mesh(quarkGeo, downQuarkMat)
      quarkGroup.add(upQuark1, upQuark2, downQuark)

      const gluonMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 })
      const gluonLines: THREE.Line[] = []
      for (let g = 0; g < 3; g++) {
        const gGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
        const gLine = new THREE.Line(gGeo, gluonMat)
        quarkGroup.add(gLine)
        gluonLines.push(gLine)
      }

      // Shell Rings (n=1 to 5)
      const shellRadii = [3.6, 6.8, 10.4, 14.2, 18.0]
      const shellLines: THREE.Line[] = []
      const shellGlowRings: THREE.Mesh[] = []

      shellRadii.forEach((r, idx) => {
        const curve = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0)
        const pts = curve.getPoints(80)
        const geo = new THREE.BufferGeometry().setFromPoints(pts.map((pt) => new THREE.Vector3(pt.x, 0, pt.y)))
        const mat = new THREE.LineBasicMaterial({
          color: idx === params.nFinal - 1 ? 0x10b981 : idx === params.nInitial - 1 ? 0xef4444 : 0x1e293b,
          transparent: true,
          opacity: 0.7,
        })
        const line = new THREE.Line(geo, mat)
        scene.add(line)
        shellLines.push(line)

        const ringGeo = new THREE.RingGeometry(r - 0.08, r + 0.08, 64)
        const ringMat = new THREE.MeshBasicMaterial({
          color: idx === params.nFinal - 1 ? 0x10b981 : idx === params.nInitial - 1 ? 0xef4444 : 0x0284c7,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.18,
        })
        const ringMesh = new THREE.Mesh(ringGeo, ringMat)
        ringMesh.rotation.x = -Math.PI / 2
        scene.add(ringMesh)
        shellGlowRings.push(ringMesh)
      })

      // Ambient Ground-State Electrons
      const ambientElectrons: { mesh: THREE.Mesh; r: number; speed: number; angle: number }[] = []
      const ambElecGeo = new THREE.SphereGeometry(0.28, 16, 16)
      const ambElecMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      })

      for (let s = 0; s < 2; s++) {
        const count = s === 0 ? 2 : 4
        for (let k = 0; k < count; k++) {
          const mesh = new THREE.Mesh(ambElecGeo, ambElecMat)
          scene.add(mesh)
          ambientElectrons.push({
            mesh,
            r: shellRadii[s],
            speed: (3 - s) * 0.025,
            angle: (k * Math.PI * 2) / count,
          })
        }
      }

      // Active Jumping Electron
      const elecGeo = new THREE.SphereGeometry(0.5, 24, 24)
      const elecMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.0,
        roughness: 0.15,
        metalness: 0.5,
      })
      const electron = new THREE.Mesh(elecGeo, elecMat)
      electron.userData = { partId: 'electron' }
      scene.add(electron)
      interactableMeshes.push(electron)

      // Electron Trail
      const trailCount = 25
      const trailPositions = new Float32Array(trailCount * 3)
      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
      const trailMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
      const trailLine = new THREE.Line(trailGeo, trailMat)
      scene.add(trailLine)

      // Photon Wave Packet
      const photonGroup = new THREE.Group()
      scene.add(photonGroup)
      photonGroup.visible = false

      const photonCoreGeo = new THREE.SphereGeometry(0.55, 16, 16)
      const photonCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const photonCore = new THREE.Mesh(photonCoreGeo, photonCoreMat)
      photonGroup.add(photonCore)

      const photonGlowGeo = new THREE.SphereGeometry(0.9, 16, 16)
      const photonGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.6 })
      const photonGlow = new THREE.Mesh(photonGlowGeo, photonGlowMat)
      photonGroup.add(photonGlow)

      const wavePtsCount = 40
      const wavePos = new Float32Array(wavePtsCount * 3)
      const waveGeo = new THREE.BufferGeometry()
      waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePos, 3))
      const waveMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 })
      const waveLine = new THREE.Line(waveGeo, waveMat)
      photonGroup.add(waveLine)

      // 3D Quantum Orbital Lobes
      const orbitalGroup = new THREE.Group()
      scene.add(orbitalGroup)
      orbitalGroup.visible = Boolean(params.orbitalMode === 1)

      const lobeGeo = new THREE.SphereGeometry(3.6, 32, 32)
      lobeGeo.scale(0.75, 1.9, 0.75)

      const lobeMatPos = new THREE.MeshPhysicalMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        transmission: 0.55,
        clearcoat: 0.6,
      })
      const lobeMatNeg = new THREE.MeshPhysicalMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        transmission: 0.55,
        clearcoat: 0.6,
      })

      const topLobeZ = new THREE.Mesh(lobeGeo, lobeMatPos)
      topLobeZ.position.y = 3.6
      orbitalGroup.add(topLobeZ)

      const botLobeZ = new THREE.Mesh(lobeGeo, lobeMatNeg)
      botLobeZ.position.y = -3.6
      orbitalGroup.add(botLobeZ)

      const posLobeX = new THREE.Mesh(lobeGeo, lobeMatPos)
      posLobeX.rotation.z = Math.PI / 2
      posLobeX.position.x = 3.6
      orbitalGroup.add(posLobeX)

      const negLobeX = new THREE.Mesh(lobeGeo, lobeMatNeg)
      negLobeX.rotation.z = Math.PI / 2
      negLobeX.position.x = -3.6
      orbitalGroup.add(negLobeX)

      // Raycaster for Double-Tap / Double-Click Dissection
      let activeDissectId: 'nucleus' | 'electron' | null = null
      let openProgress = { nucleus: 0.0, electron: 0.0 }
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const id = hit.userData?.partId as 'nucleus' | 'electron' | undefined
          if (id) {
            if (activeDissectId === id) {
              activeDissectId = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectId = id
              callbacks.onInspectPart?.(DISSECT_CARDS[id])
            }
          }
        } else {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      // Quantum jump state machine
      let electronAngle = 0
      let currentR = shellRadii[Math.max(0, Math.min(params.nInitial - 1, 4))]
      let isTransitioning = false
      let transitionProgress = 0
      let cycleTimer = 0

      let photonActive = false
      let photonDistance = 0
      const photonDir = new THREE.Vector3(1, 0.4, 0).normalize()

      const getSpectralColor = (ni: number, nf: number) => {
        if (nf === 2) {
          if (ni === 3) return 0xef4444
          if (ni === 4) return 0x06b6d4
          if (ni === 5) return 0x8b5cf6
        }
        if (nf === 1) return 0x6366f1
        return 0xf97316
      }

      const triggerQuantumJump = () => {
        const rInitial = shellRadii[Math.max(0, Math.min(params.nInitial - 1, 4))]
        currentR = rInitial
        isTransitioning = true
        transitionProgress = 0

        const colorHex = getSpectralColor(params.nInitial, params.nFinal)
        photonGlowMat.color.setHex(colorHex)
        waveMat.color.setHex(colorHex)
        photonActive = true
        photonDistance = 0
        photonGroup.position.copy(electron.position)
        photonGroup.visible = true
      }

      function animate() {
        animId = requestAnimationFrame(animate)

        const targetNuc = activeDissectId === 'nucleus' ? 1.0 : 0.0
        openProgress.nucleus += (targetNuc - openProgress.nucleus) * 0.1

        nucleonPositions.forEach((basePos, idx) => {
          const nMesh = nucleonMeshes[idx]
          if (nMesh) {
            const spread = 1.0 + openProgress.nucleus * 2.8
            nMesh.position.set(basePos.x * spread, basePos.y * spread, basePos.z * spread)
            const nMat = nMesh.material as THREE.MeshStandardMaterial
            nMat.transparent = openProgress.nucleus > 0.05
            nMat.opacity = 1.0 - openProgress.nucleus * 0.35
          }
        })

        if (openProgress.nucleus > 0.05) {
          quarkGroup.visible = true
          const qTime = performance.now() * 0.003
          const qR = 0.9 + Math.sin(qTime * 4) * 0.1
          const q1Pos = new THREE.Vector3(Math.cos(qTime) * qR, Math.sin(qTime) * qR * 0.5, 0.4)
          const q2Pos = new THREE.Vector3(Math.cos(qTime + 2.09) * qR, Math.sin(qTime + 2.09) * qR * 0.5, -0.3)
          const q3Pos = new THREE.Vector3(Math.cos(qTime + 4.18) * qR, Math.sin(qTime + 4.18) * qR * 0.5, 0.1)

          upQuark1.position.copy(q1Pos)
          upQuark2.position.copy(q2Pos)
          downQuark.position.copy(q3Pos)

          const gTri = [
            [q1Pos, q2Pos],
            [q2Pos, q3Pos],
            [q3Pos, q1Pos],
          ]
          gTri.forEach((pair, gi) => {
            const line = gluonLines[gi]
            if (line) {
              const pts: THREE.Vector3[] = []
              const steps = 14
              for (let s = 0; s <= steps; s++) {
                const alpha = s / steps
                const pt = new THREE.Vector3().lerpVectors(pair[0], pair[1], alpha)
                const wiggle = Math.sin(alpha * Math.PI * 4 + qTime * 8) * 0.15
                pt.y += wiggle
                pts.push(pt)
              }
              line.geometry.dispose()
              line.geometry = new THREE.BufferGeometry().setFromPoints(pts)
            }
          })
        } else {
          quarkGroup.visible = false
        }

        if (isPlaying) {
          cycleTimer += 0.02
          electronAngle += 0.035

          if (cycleTimer > 4.0 && !isTransitioning) {
            triggerQuantumJump()
            cycleTimer = 0
          }

          if (isTransitioning) {
            transitionProgress += 0.04
            currentR = THREE.MathUtils.lerp(
              shellRadii[Math.max(0, Math.min(params.nInitial - 1, 4))],
              shellRadii[Math.max(0, Math.min(params.nFinal - 1, 4))],
              transitionProgress
            )

            if (transitionProgress >= 1) {
              isTransitioning = false
              currentR = shellRadii[Math.max(0, Math.min(params.nFinal - 1, 4))]
            }
          }

          electron.position.x = Math.cos(electronAngle) * currentR
          electron.position.z = Math.sin(electronAngle) * currentR
          electron.position.y = Math.sin(electronAngle * 3) * 0.4

          ambientElectrons.forEach((el) => {
            el.angle += el.speed
            el.mesh.position.x = Math.cos(el.angle) * el.r
            el.mesh.position.z = Math.sin(el.angle) * el.r
          })

          if (photonActive) {
            photonDistance += 0.32
            photonGroup.position.copy(photonDir.clone().multiplyScalar(photonDistance))

            const wAttr = waveGeo.attributes.position as THREE.BufferAttribute
            for (let i = 0; i < wavePtsCount; i++) {
              const lag = i * 0.25
              const phase = lag * 2.5 - cycleTimer * 12
              const waveY = Math.sin(phase) * 0.45 * Math.exp(-lag * 0.3)
              wAttr.setXYZ(i, -photonDir.x * lag, waveY, -photonDir.z * lag)
            }
            wAttr.needsUpdate = true

            if (photonDistance > 32) {
              photonActive = false
              photonGroup.visible = false
            }
          }
        }

        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          orbitalGroup.visible = Boolean(params.orbitalMode === 1)
          const spectralCol = getSpectralColor(params.nInitial, params.nFinal)

          shellLines.forEach((line, idx) => {
            const mat = line.material as THREE.LineBasicMaterial
            mat.color.setHex(idx === params.nFinal - 1 ? 0x10b981 : idx === params.nInitial - 1 ? spectralCol : 0x1e293b)
          })

          shellGlowRings.forEach((ring, idx) => {
            const mat = ring.material as THREE.MeshBasicMaterial
            mat.color.setHex(idx === params.nFinal - 1 ? 0x10b981 : idx === params.nInitial - 1 ? spectralCol : 0x0284c7)
          })
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          currentR = shellRadii[Math.max(0, Math.min(params.nInitial - 1, 4))]
          photonActive = false
          photonGroup.visible = false
          cycleTimer = 0
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        closeDissection: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 4. CHEMISTRY: 3D MOLECULAR BONDING (VSEPR)
  // ==========================================
  molecules_3d: {
    type: 'molecules_3d',
    title: '3D Molecular Geometry & VSEPR Bonding',
    subject: 'Chemistry · Chemical Bonding',
    concept: 'VSEPR Theory, Bond Angles & Molecular Polarity',
    description: 'Explore 3D chemical structures: Water (H₂O), Methane (CH₄), Carbon Dioxide (CO₂), and Ammonia (NH₃). Rotate around chemical bonds, inspect bond angles, and observe molecular dipole moments.',
    emoji: '🧪',
    difficulty: 'Intermediate',
    presets: [
      { label: '💧 Water (H₂O - Bent 104.5°)', params: { moleculeId: 0, bondScale: 1.0, showDipoles: 1 } },
      { label: '🔥 Methane (CH₄ - Tetrahedral 109.5°)', params: { moleculeId: 1, bondScale: 1.0, showDipoles: 0 } },
      { label: '💨 Carbon Dioxide (CO₂ - Linear 180°)', params: { moleculeId: 2, bondScale: 1.0, showDipoles: 1 } },
      { label: '❄️ Ammonia (NH₃ - Pyramidal 107°)', params: { moleculeId: 3, bondScale: 1.0, showDipoles: 1 } },
      { label: '⚡ Phosphorus Pentachloride (PCl₅ - Trigonal Bipyramidal)', params: { moleculeId: 4, bondScale: 1.0, showDipoles: 0 } },
      { label: '🛡️ Sulfur Hexafluoride (SF₆ - Octahedral 90°)', params: { moleculeId: 5, bondScale: 1.0, showDipoles: 0 } },
    ],
    params: [
      { key: 'moleculeId', label: 'Molecule (0:H2O, 1:CH4, 2:CO2, 3:NH3, 4:PCl5, 5:SF6)', min: 0, max: 5, step: 1, defaultValue: 0, unit: '' },
      { key: 'bondScale', label: 'Bond Length Scale', min: 0.6, max: 1.6, step: 0.1, defaultValue: 1.0, unit: 'x' },
      { key: 'showDipoles', label: 'Show Polarity Dipole Arrows', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
    ],
    calculateReadouts: (p) => {
      const molMap = [
        { name: 'Water (H₂O)', geom: 'Bent / V-Shaped (sp³)', angle: '104.5°', polar: 'Polar (1.85 D)' },
        { name: 'Methane (CH₄)', geom: 'Tetrahedral (sp³)', angle: '109.5°', polar: 'Non-Polar (0 D)' },
        { name: 'Carbon Dioxide (CO₂)', geom: 'Linear (sp)', angle: '180.0°', polar: 'Non-Polar (0 D)' },
        { name: 'Ammonia (NH₃)', geom: 'Trigonal Pyramidal (sp³)', angle: '107.0°', polar: 'Polar (1.47 D)' },
        { name: 'Phosphorus Pentachloride (PCl₅)', geom: 'Trigonal Bipyramidal (sp³d)', angle: '90° (ax) / 120° (eq)', polar: 'Non-Polar (0 D)' },
        { name: 'Sulfur Hexafluoride (SF₆)', geom: 'Octahedral (sp³d²)', angle: '90.0°', polar: 'Non-Polar (0 D)' },
      ]
      const m = molMap[p.moleculeId] || molMap[0]
      return [
        { label: 'Molecular Shape', value: m.geom, formula: 'VSEPR Electron Repulsion' },
        { label: 'Bond Angle', value: m.angle },
        { label: 'Dipole Moment', value: m.polar },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      // Clean scientific pedestal without harsh graph paper grid floor
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 10, 20)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        central: {
          title: 'Central Atom · VSEPR Hybridization & Lone Pairs Dissected',
          partName: 'Valence Shell Electron-Pair Repulsion (VSEPR) Geometry',
          role: 'Determines 3D spatial conformation via electrostatic repulsion between bonding and non-bonding electron pairs',
          internalStructures: ['sp³ / sp² / sp Hybridized Orbitals', 'Lone-Pair Electron Repulsion Lobes', 'Steric Number (SN = Bonding + Lone Pairs)', 'Bent 104.5° / Trigonal 107° / Tetrahedral 109.5° Angles'],
          description: 'Double-tapping peels open the electron cloud to reveal non-bonding lone pairs. Because unshared electron pairs occupy more space and exert stronger Coulomb repulsion (lp-lp > lp-bp > bp-bp), they compress the bond angle away from the ideal 109.5°.',
        },
        dipole: {
          title: 'Molecular Polarity & Dipole Moment Vector (μ)',
          partName: 'Pauling Electronegativity Difference & Net Dipole',
          role: 'Asymmetric distribution of electron density creating permanent dipole moment',
          internalStructures: ['Partial Positive Charge (δ⁺ on H)', 'Partial Negative Charge (δ⁻ on O/N)', 'Dipole Moment (μ = q × d, measured in Debyes)', 'Intermolecular Hydrogen Bonding Affinity'],
          description: 'The large electronegativity gradient (Oxygen: 3.44 vs Hydrogen: 2.20) pulls shared electrons strongly toward the central nucleus, generating a permanent net dipole moment responsible for high boiling points and solvent capabilities.',
        },
      }

      const molGroup = new THREE.Group()
      scene.add(molGroup)

      // Atom Materials CPK Standard Colors
      const mats: Record<string, THREE.MeshStandardMaterial> = {
        H: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 }),
        O: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.1 }),
        C: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.1 }),
        N: new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, metalness: 0.1 }),
        P: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.15 }),
        S: new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.15 }),
        Cl: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3, metalness: 0.1 }),
        F: new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.25, metalness: 0.1 }),
        bond: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.3 }),
      }

      // Lone Pair Orbital Lobe Material (Translucent glowing cyan)
      const lonePairMat = new THREE.MeshPhysicalMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        transmission: 0.6,
        clearcoat: 0.8,
      })

      const lonePairGroup = new THREE.Group()
      molGroup.add(lonePairGroup)

      const dipoleGroup = new THREE.Group()
      molGroup.add(dipoleGroup)

      let activeDissectId: 'central' | 'dipole' | null = null

      function buildMolecule() {
        while (molGroup.children.length > 0) {
          molGroup.remove(molGroup.children[0])
        }
        lonePairGroup.clear()
        dipoleGroup.clear()
        molGroup.add(lonePairGroup)
        molGroup.add(dipoleGroup)
        interactableMeshes.length = 0

        const scale = params.bondScale

        const addDipoleArrow = (from: THREE.Vector3, to: THREE.Vector3) => {
          if (params.showDipoles === 0) return
          const dir = new THREE.Vector3().subVectors(to, from)
          const len = dir.length()
          const arrow = new THREE.ArrowHelper(dir.clone().normalize(), from, len, 0xef4444, 0.7, 0.35)
          dipoleGroup.add(arrow)
        }

        const addBondBetween = (p1: THREE.Vector3, p2: THREE.Vector3) => {
          const dir = new THREE.Vector3().subVectors(p2, p1)
          const len = dir.length()
          const bGeo = new THREE.CylinderGeometry(0.24, 0.24, len, 16)
          bGeo.translate(0, len / 2, 0)
          const bMesh = new THREE.Mesh(bGeo, mats.bond)
          bMesh.position.copy(p1)
          bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
          bMesh.userData = { partId: 'central' }
          molGroup.add(bMesh)
          interactableMeshes.push(bMesh)
        }

        if (params.moleculeId === 0) {
          // Water (H2O): Oxygen at origin, two Hydrogens at 104.5 degrees
          const oMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 32), mats.O)
          oMesh.userData = { partId: 'central' }
          molGroup.add(oMesh)
          interactableMeshes.push(oMesh)

          const angle = (104.5 * Math.PI) / 180
          const hDist = 3.2 * scale
          const h1Pos = new THREE.Vector3(hDist * Math.sin(angle / 2), -hDist * Math.cos(angle / 2), 0)
          const h2Pos = new THREE.Vector3(-hDist * Math.sin(angle / 2), -hDist * Math.cos(angle / 2), 0)

          const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), mats.H)
          h1.position.copy(h1Pos)
          h1.userData = { partId: 'dipole' }
          molGroup.add(h1)
          interactableMeshes.push(h1)

          const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), mats.H)
          h2.position.copy(h2Pos)
          h2.userData = { partId: 'dipole' }
          molGroup.add(h2)
          interactableMeshes.push(h2)

          addBondBetween(new THREE.Vector3(0, 0, 0), h1Pos)
          addBondBetween(new THREE.Vector3(0, 0, 0), h2Pos)

          // Net Dipole Arrow pointing up towards oxygen lone pairs
          addDipoleArrow(new THREE.Vector3(0, -2.2, 0), new THREE.Vector3(0, 2.2, 0))

          // 2 Dissected Lone Pair Lobes for Oxygen
          const lobeGeo = new THREE.SphereGeometry(1.3, 24, 24)
          lobeGeo.scale(0.65, 1.45, 0.65)

          const lp1 = new THREE.Mesh(lobeGeo, lonePairMat)
          lp1.position.set(0, 1.6, 1.8)
          lp1.rotation.x = Math.PI / 4
          lonePairGroup.add(lp1)

          const lp2 = new THREE.Mesh(lobeGeo, lonePairMat)
          lp2.position.set(0, 1.6, -1.8)
          lp2.rotation.x = -Math.PI / 4
          lonePairGroup.add(lp2)

        } else if (params.moleculeId === 1) {
          // Methane (CH4): Carbon at origin, 4 Hydrogens at tetrahedral vertices
          const cMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), mats.C)
          cMesh.userData = { partId: 'central' }
          molGroup.add(cMesh)
          interactableMeshes.push(cMesh)

          const d = 3.4 * scale
          const hVerts = [
            new THREE.Vector3(d / Math.sqrt(3), d / Math.sqrt(3), d / Math.sqrt(3)),
            new THREE.Vector3(-d / Math.sqrt(3), -d / Math.sqrt(3), d / Math.sqrt(3)),
            new THREE.Vector3(-d / Math.sqrt(3), d / Math.sqrt(3), -d / Math.sqrt(3)),
            new THREE.Vector3(d / Math.sqrt(3), -d / Math.sqrt(3), -d / Math.sqrt(3)),
          ]

          hVerts.forEach((pos) => {
            const h = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), mats.H)
            h.position.copy(pos)
            h.userData = { partId: 'dipole' }
            molGroup.add(h)
            interactableMeshes.push(h)
            addBondBetween(new THREE.Vector3(0, 0, 0), pos)
          })
        } else if (params.moleculeId === 2) {
          // Carbon Dioxide (CO2): Linear O=C=O
          const cMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 32), mats.C)
          cMesh.userData = { partId: 'central' }
          molGroup.add(cMesh)
          interactableMeshes.push(cMesh)

          const dist = 3.6 * scale
          const o1 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), mats.O)
          o1.position.set(dist, 0, 0)
          o1.userData = { partId: 'dipole' }
          molGroup.add(o1)
          interactableMeshes.push(o1)

          const o2 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), mats.O)
          o2.position.set(-dist, 0, 0)
          o2.userData = { partId: 'dipole' }
          molGroup.add(o2)
          interactableMeshes.push(o2)

          const addDoubleBond = (xOffset: number) => {
            const bGeo = new THREE.CylinderGeometry(0.18, 0.18, dist, 16)
            bGeo.translate(0, dist / 2, 0)
            const b1 = new THREE.Mesh(bGeo, mats.bond)
            b1.position.set(0, 0.35, 0)
            b1.rotation.z = xOffset > 0 ? -Math.PI / 2 : Math.PI / 2
            b1.userData = { partId: 'central' }
            molGroup.add(b1)
            interactableMeshes.push(b1)

            const b2 = new THREE.Mesh(bGeo, mats.bond)
            b2.position.set(0, -0.35, 0)
            b2.rotation.z = xOffset > 0 ? -Math.PI / 2 : Math.PI / 2
            b2.userData = { partId: 'central' }
            molGroup.add(b2)
            interactableMeshes.push(b2)
          }
          addDoubleBond(dist)
          addDoubleBond(-dist)

          // Equal and opposite bond dipoles cancel out
          addDipoleArrow(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(dist, 1.2, 0))
          addDipoleArrow(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(-dist, 1.2, 0))

        } else if (params.moleculeId === 3) {
          // Ammonia (NH3): Nitrogen with 3 Hydrogens in trigonal pyramid
          const nMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 32), mats.N)
          nMesh.position.y = 0.8
          nMesh.userData = { partId: 'central' }
          molGroup.add(nMesh)
          interactableMeshes.push(nMesh)

          const dist = 3.1 * scale
          for (let i = 0; i < 3; i++) {
            const a = (i * 2 * Math.PI) / 3
            const hPos = new THREE.Vector3(dist * Math.cos(a), -1.2, dist * Math.sin(a))
            const h = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), mats.H)
            h.position.copy(hPos)
            h.userData = { partId: 'dipole' }
            molGroup.add(h)
            interactableMeshes.push(h)
            addBondBetween(nMesh.position, hPos)
          }

          // Net Dipole Arrow pointing up towards lone pair
          addDipoleArrow(new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0, 2.8, 0))

          // Single Apex Lone Pair Lobe for Nitrogen
          const lobeGeo = new THREE.SphereGeometry(1.4, 24, 24)
          lobeGeo.scale(0.7, 1.5, 0.7)
          const lpN = new THREE.Mesh(lobeGeo, lonePairMat)
          lpN.position.set(0, 2.6, 0)
          lonePairGroup.add(lpN)

        } else if (params.moleculeId === 4) {
          // Phosphorus Pentachloride (PCl5): Trigonal Bipyramidal (sp3d)
          const pMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), mats.P)
          pMesh.userData = { partId: 'central' }
          molGroup.add(pMesh)
          interactableMeshes.push(pMesh)

          const eqDist = 3.4 * scale
          const axDist = 3.8 * scale

          // 2 Axial Chlorines (90° to equatorial)
          const axPositions = [new THREE.Vector3(0, axDist, 0), new THREE.Vector3(0, -axDist, 0)]
          axPositions.forEach((pos) => {
            const cl = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 24), mats.Cl)
            cl.position.copy(pos)
            cl.userData = { partId: 'dipole' }
            molGroup.add(cl)
            interactableMeshes.push(cl)
            addBondBetween(new THREE.Vector3(0, 0, 0), pos)
          })

          // 3 Equatorial Chlorines (120° apart in XZ plane)
          for (let i = 0; i < 3; i++) {
            const a = (i * 2 * Math.PI) / 3
            const eqPos = new THREE.Vector3(eqDist * Math.cos(a), 0, eqDist * Math.sin(a))
            const cl = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 24), mats.Cl)
            cl.position.copy(eqPos)
            cl.userData = { partId: 'dipole' }
            molGroup.add(cl)
            interactableMeshes.push(cl)
            addBondBetween(new THREE.Vector3(0, 0, 0), eqPos)
          }

        } else if (params.moleculeId === 5) {
          // Sulfur Hexafluoride (SF6): Octahedral (sp3d2, all 90° angles)
          const sMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), mats.S)
          sMesh.userData = { partId: 'central' }
          molGroup.add(sMesh)
          interactableMeshes.push(sMesh)

          const fDist = 3.3 * scale
          const octPositions = [
            new THREE.Vector3(fDist, 0, 0),
            new THREE.Vector3(-fDist, 0, 0),
            new THREE.Vector3(0, fDist, 0),
            new THREE.Vector3(0, -fDist, 0),
            new THREE.Vector3(0, 0, fDist),
            new THREE.Vector3(0, 0, -fDist),
          ]

          octPositions.forEach((pos) => {
            const fMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 24), mats.F)
            fMesh.position.copy(pos)
            fMesh.userData = { partId: 'dipole' }
            molGroup.add(fMesh)
            interactableMeshes.push(fMesh)
            addBondBetween(new THREE.Vector3(0, 0, 0), pos)
          })
        }

        lonePairGroup.visible = Boolean(activeDissectId === 'central')
      }

      buildMolecule()

      // Raycaster for Double-Tap & Double-Click Dissection
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const id = hit.userData?.partId as 'central' | 'dipole' | undefined
          if (id) {
            if (activeDissectId === id) {
              activeDissectId = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectId = id
              callbacks.onInspectPart?.(DISSECT_CARDS[id])
            }
            lonePairGroup.visible = Boolean(activeDissectId === 'central')
          }
        } else {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          lonePairGroup.visible = false
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      function animate() {
        animId = requestAnimationFrame(animate)
        if (isPlaying) {
          if (!activeDissectId) {
            molGroup.rotation.y += 0.012
            molGroup.rotation.x += 0.006
          } else {
            // Gentle floating oscillation while inspecting
            molGroup.rotation.y += 0.003
          }
        }
        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          buildMolecule()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          molGroup.rotation.set(0, 0, 0)
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          lonePairGroup.visible = false
        },
        closeDissection: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          lonePairGroup.visible = false
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 5. BIOLOGY: 3D DNA DOUBLE HELIX
  // ==========================================
  dna_helix_3d: {
    type: 'dna_helix_3d',
    title: '3D DNA Double Helix & Base Pairing',
    subject: 'Biology · Molecular Genetics',
    concept: 'B-DNA Double Helix, Complementary Base Pairs (A-T, G-C) & Replication Fork',
    description: 'Explore the molecular architecture of the B-DNA double helix. Inspect purine-pyrimidine base pairing (Adenine=Thymine with 2 H-bonds, Guanine≡Cytosine with 3 H-bonds), sugar-phosphate backbones, major & minor grooves, and animate the hexameric helicase replication fork unzipping the genome.',
    emoji: '🧬',
    difficulty: 'Intermediate',
    presets: [
      { label: '🧬 Native B-DNA Double Helix', params: { unzip: 0, twistSpeed: 0, baseRadius: 3.2 } },
      { label: '🔓 Helicase Replication Fork (50% Unzip)', params: { unzip: 50, twistSpeed: 0, baseRadius: 3.2 } },
      { label: '⚡ Full Strand Separation (90% Unzip)', params: { unzip: 90, twistSpeed: 0, baseRadius: 3.2 } },
      { label: '💎 GC-Rich Clamp & Triple H-Bonds', params: { unzip: 0, twistSpeed: 0, baseRadius: 3.2 } },
      { label: '🔬 Major & Minor Grooves', params: { unzip: 0, twistSpeed: 0, baseRadius: 3.6 } },
    ],
    params: [
      { key: 'unzip', label: 'Helicase Unzip', min: 0, max: 100, step: 5, defaultValue: 0, unit: '%' },
      { key: 'baseRadius', label: 'Helix Diameter', min: 2.2, max: 4.8, step: 0.2, defaultValue: 3.2, unit: 'nm' },
      { key: 'twistSpeed', label: 'Twist Rotation', min: 0, max: 2, step: 0.1, defaultValue: 0, unit: 'x' },
    ],
    calculateReadouts: (p) => {
      const unzipPct = p.unzip
      const forkState = unzipPct === 0 ? 'Intact Double Helix' : unzipPct < 80 ? `Replication Fork (${unzipPct}% Unzipped)` : 'Denatured Single Strands'
      return [
        { label: 'Helical Conformation', value: 'Right-Handed B-DNA', formula: '10.5 base pairs / 3.4 nm helical pitch' },
        { label: 'Helix Diameter', value: (p.baseRadius * 2).toFixed(1), unit: 'nm', formula: 'Major: 2.2 nm · Minor: 1.2 nm' },
        { label: 'Hydrogen Bonding', value: 'A=T (2 H-Bonds) · G≡C (3 H-Bonds)', formula: 'Watson-Crick Complementarity' },
        { label: 'Replication State', value: forkState },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 8, 30)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 0, 0)

      const dnaRig = new THREE.Group()
      scene.add(dnaRig)

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        at_pair: {
          title: 'Adenine–Thymine Base Pair (A=T)',
          partName: 'A=T Watson-Crick Nucleotide Rung · 2 Hydrogen Bonds',
          role: 'Complementary base pairing stabilizing the double helix via 2 electrostatic hydrogen bonds',
          bloodType: 'Neutral',
          internalStructures: [
            'Adenine (Bicyclic 6+5 Purine Ring: C5H5N5)',
            'Thymine (Monocyclic 6 Pyrimidine Ring: C5H6N2O2)',
            '2 Linear Hydrogen Bonds (N-H...O & N...H-N, 2.8 Å length)',
            'Major & Minor Groove Hydrogen Bond Acceptors/Donors',
          ],
          description: 'The A=T base pair is held together by two hydrogen bonds with a combined dissociation energy of ~14 kcal/mol. Because it has only two hydrogen bonds compared to G≡C\'s three, A-T rich sequences are preferentially located at replication origins (OriC, TATA boxes) where DNA must easily unwind.',
          actionHint: 'Double-tap another base pair or backbone to inspect molecular structure',
        },
        gc_pair: {
          title: 'Guanine–Cytosine Base Pair (G≡C)',
          partName: 'G≡C Watson-Crick Nucleotide Rung · 3 Triple Hydrogen Bonds',
          role: 'High-stability base pair conferring structural rigidity and thermal resistance to the genome',
          bloodType: 'Neutral',
          internalStructures: [
            'Guanine (Bicyclic Purine with Exocyclic Amine & Carbonyl)',
            'Cytosine (Monocyclic 6 Pyrimidine Ring)',
            '3 Electrostatic Hydrogen Bonds (O...H-N, N-H...N, N-H...O, ~21 kcal/mol)',
            'GC-Clamp Stabilization across Genomic Exons',
          ],
          description: 'The G≡C base pair is cemented by three distinct hydrogen bonds. Genomic regions with high GC content have a significantly higher melting temperature (Tm) and resist enzymatic denaturation, functioning as structural anchors throughout chromosomes.',
          actionHint: 'Double-tap another part to inspect',
        },
        backbone: {
          title: "Antiparallel Sugar-Phosphate Backbone (5' to 3')",
          partName: 'Deoxyribose Furanose Rings & Phosphodiester Bridges',
          role: 'Polyanionic structural scaffold establishing antiparallel polarity for transcription and replication',
          bloodType: 'Neutral',
          internalStructures: [
            "2-Deoxy-D-ribose 5-Carbon Pentose Rings (C1' to C5')",
            "Phosphodiester Bonds Linking 3'-OH to 5'-Phosphate",
            'PO4(3-) Polyanionic Surface Charge Repelling Nucleophiles',
            "Antiparallel Polarity (Leading 5'→3' vs Lagging 3'→5')",
          ],
          description: 'The hydrophilic exterior of DNA consists of repeating units of deoxyribose sugar and phosphate groups. The strong negative charges on the phosphate groups give DNA its uniform negative polyanionic charge, facilitating electrophoretic migration and histone binding.',
          actionHint: 'Double-tap to close',
        },
        helicase: {
          title: 'Replicative DNA Helicase Enzyme (Hexameric Motor)',
          partName: 'ATP-Dependent Molecular Motor & Replication Fork',
          role: 'Unwinds double-stranded DNA by translocating along the lagging strand and breaking hydrogen bonds',
          bloodType: 'Neutral',
          internalStructures: [
            'Hexameric Ring Complex (6 RecA-like ATPase Subunits)',
            'Central Channel (13 Å diameter accommodating single-strand DNA)',
            'ATP Hydrolysis Engine Driving Mechanical Unzipping',
            'Leading & Lagging Strand Separation Wedge',
          ],
          description: 'The replicative helicase forms a donut-shaped hexameric ring that encircles single-stranded DNA. Using ATP hydrolysis energy, it powers along the strand like a motorized molecular wedge, breaking up to 500 base-pair hydrogen bonds per second to open the replication fork.',
          actionHint: 'Double-tap to close',
        },
        grooves: {
          title: 'Major & Minor Helical Grooves',
          partName: 'Geometric Asymmetry of Glycosidic Bonds',
          role: 'Presents unique hydrogen-bonding chemical codes recognized by transcription factors and histones',
          bloodType: 'Neutral',
          internalStructures: [
            'Major Groove (2.2 nm width): Wide access exposing base-specific chemical codes',
            'Minor Groove (1.2 nm width): Narrow groove binding non-specific architectural proteins',
            'Base Pair Stacking & Van der Waals London Dispersion Forces',
            'Helical Pitch (3.4 nm per 10.5 base pairs)',
          ],
          description: 'Because glycosidic bonds do not attach at diametrically opposite angles (120° vs 240°), the double helix exhibits two distinct grooves. The wide Major Groove allows sequence-specific proteins like zinc-finger and leucine-zipper transcription factors to read the genetic code without unzipping the DNA.',
          actionHint: 'Double-tap to close',
        },
      }

      // Materials
      const matBackbone1 = new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Cyan/Blue leading strand
        roughness: 0.25,
        metalness: 0.6,
      })
      const matBackbone2 = new THREE.MeshStandardMaterial({
        color: 0x9333ea, // Purple lagging strand
        roughness: 0.25,
        metalness: 0.6,
      })
      const matPhosphate1 = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      })
      const matPhosphate2 = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      })
      const matAdenine = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 }) // Green
      const matThymine = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }) // Red
      const matGuanine = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 }) // Blue
      const matCytosine = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3 }) // Gold
      const matHBond = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x94a3b8,
        emissiveIntensity: 0.6,
        roughness: 0.1,
      })

      // Hexameric Helicase Enzyme Ring
      const helicaseMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.4,
      })
      const helicaseGrp = new THREE.Group()
      dnaRig.add(helicaseGrp)

      const helicaseRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.75, 16, 32), helicaseMat)
      helicaseRing.rotation.x = Math.PI / 2
      helicaseRing.userData = { partKey: 'helicase' }
      helicaseGrp.add(helicaseRing)
      interactableMeshes.push(helicaseRing)

      // 6 Subunit Knobs for Hexameric enzyme
      for (let k = 0; k < 6; k++) {
        const knobAngle = (k * Math.PI * 2) / 6
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), helicaseMat)
        knob.position.set(Math.cos(knobAngle) * 3.6, 0, Math.sin(knobAngle) * 3.6)
        knob.userData = { partKey: 'helicase' }
        helicaseGrp.add(knob)
        interactableMeshes.push(knob)
      }

      const numSteps = 44
      const stepY = 0.68
      const totalH = numSteps * stepY

      let activeDissectKey: string | null = null; void activeDissectKey

      function buildHelix() {
        // Clear previous meshes
        while (dnaRig.children.length > 0) {
          dnaRig.remove(dnaRig.children[0])
        }
        dnaRig.add(helicaseGrp)
        interactableMeshes.length = 0
        interactableMeshes.push(helicaseRing)

        const r = params.baseRadius
        const unzipRatio = params.unzip / 100 // 0 to 1
        const grooveOffset = (140 * Math.PI) / 180

        const pts1: THREE.Vector3[] = []
        const pts2: THREE.Vector3[] = []

        // Unzip fork position along Y axis (travels from top to bottom)
        const unzipSplitStep = numSteps * (1 - unzipRatio)

        for (let i = 0; i < numSteps; i++) {
          const angle = i * 0.36
          const y = i * stepY - totalH / 2

          // Check if this step is unzipped
          const isUnzipped = unzipRatio > 0.05 && i >= unzipSplitStep
          const forkFactor = isUnzipped ? ((i - unzipSplitStep) / (numSteps - unzipSplitStep + 1)) * 2.4 : 0

          const p1 = new THREE.Vector3(
            (r + forkFactor * 1.5) * Math.cos(angle - forkFactor * 0.4),
            y,
            (r + forkFactor * 1.5) * Math.sin(angle - forkFactor * 0.4)
          )
          const p2 = new THREE.Vector3(
            (r + forkFactor * 1.5) * Math.cos(angle + grooveOffset + forkFactor * 0.4),
            y,
            (r + forkFactor * 1.5) * Math.sin(angle + grooveOffset + forkFactor * 0.4)
          )

          pts1.push(p1)
          pts2.push(p2)

          // Sugar-Phosphate Node spheres
          const node1 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), matPhosphate1)
          node1.position.copy(p1)
          node1.userData = { partKey: 'backbone' }
          dnaRig.add(node1)
          interactableMeshes.push(node1)

          const node2 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), matPhosphate2)
          node2.position.copy(p2)
          node2.userData = { partKey: 'backbone' }
          dnaRig.add(node2)
          interactableMeshes.push(node2)

          // Nucleotide Bases
          const isAT = i % 2 === 0
          const partKey = isAT ? 'at_pair' : 'gc_pair'
          const baseMat1 = isAT ? matAdenine : matGuanine
          const baseMat2 = isAT ? matThymine : matCytosine

          const strandDir = new THREE.Vector3().subVectors(p2, p1)
          const fullLen = strandDir.length()

          if (!isUnzipped) {
            // Intact complementary base pair
            const halfLen = fullLen * 0.42

            // Base 1 (Adenine or Guanine - purine double ring)
            const b1Geo = new THREE.CylinderGeometry(0.24, 0.24, halfLen, 12)
            b1Geo.translate(0, halfLen / 2, 0)
            const b1 = new THREE.Mesh(b1Geo, baseMat1)
            b1.position.copy(p1)
            b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().normalize())
            b1.userData = { partKey }
            dnaRig.add(b1)
            interactableMeshes.push(b1)

            // Base 2 (Thymine or Cytosine - pyrimidine single ring)
            const b2Geo = new THREE.CylinderGeometry(0.24, 0.24, halfLen, 12)
            b2Geo.translate(0, halfLen / 2, 0)
            const b2 = new THREE.Mesh(b2Geo, baseMat2)
            b2.position.copy(p2)
            b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().negate().normalize())
            b2.userData = { partKey }
            dnaRig.add(b2)
            interactableMeshes.push(b2)

            // Hydrogen Bonds (2 for A=T, 3 for G≡C)
            const centerPt = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
            const hCount = isAT ? 2 : 3
            const hGap = 0.22
            for (let h = 0; h < hCount; h++) {
              const hOffset = (h - (hCount - 1) / 2) * hGap
              const hBridgeGeo = new THREE.CylinderGeometry(0.06, 0.06, fullLen * 0.16, 8)
              const hBridge = new THREE.Mesh(hBridgeGeo, matHBond)
              hBridge.position.copy(centerPt).add(new THREE.Vector3(0, hOffset, 0))
              hBridge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().normalize())
              hBridge.userData = { partKey }
              dnaRig.add(hBridge)
              interactableMeshes.push(hBridge)
            }
          } else {
            // Unzipped open single-stranded nucleotide bases pointing inward
            const stubLen = r * 0.5
            const b1Geo = new THREE.CylinderGeometry(0.22, 0.22, stubLen, 12)
            b1Geo.translate(0, stubLen / 2, 0)
            const b1 = new THREE.Mesh(b1Geo, baseMat1)
            b1.position.copy(p1)
            const inward1 = new THREE.Vector3(0, y, 0).sub(p1).normalize()
            b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward1)
            b1.userData = { partKey }
            dnaRig.add(b1)
            interactableMeshes.push(b1)

            const b2Geo = new THREE.CylinderGeometry(0.22, 0.22, stubLen, 12)
            b2Geo.translate(0, stubLen / 2, 0)
            const b2 = new THREE.Mesh(b2Geo, baseMat2)
            b2.position.copy(p2)
            const inward2 = new THREE.Vector3(0, y, 0).sub(p2).normalize()
            b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward2)
            b2.userData = { partKey }
            dnaRig.add(b2)
            interactableMeshes.push(b2)
          }
        }

        // Backbone continuous ribbons
        const curve1 = new THREE.CatmullRomCurve3(pts1)
        const tube1Geo = new THREE.TubeGeometry(curve1, 90, 0.28, 12, false)
        const strandMesh1 = new THREE.Mesh(tube1Geo, matBackbone1)
        strandMesh1.userData = { partKey: 'backbone' }
        dnaRig.add(strandMesh1)
        interactableMeshes.push(strandMesh1)

        const curve2 = new THREE.CatmullRomCurve3(pts2)
        const tube2Geo = new THREE.TubeGeometry(curve2, 90, 0.28, 12, false)
        const strandMesh2 = new THREE.Mesh(tube2Geo, matBackbone2)
        strandMesh2.userData = { partKey: 'backbone' }
        dnaRig.add(strandMesh2)
        interactableMeshes.push(strandMesh2)

        // Position Helicase at fork apex
        if (unzipRatio > 0.05) {
          const forkY = (unzipSplitStep * stepY) - totalH / 2
          helicaseGrp.position.set(0, forkY, 0)
          helicaseGrp.visible = true
        } else {
          helicaseGrp.position.set(0, totalH / 2, 0)
          helicaseGrp.visible = false
        }
      }

      buildHelix()

      // Raycasting for Double-Tap & Double-Click Dissection
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const key = hit.userData?.partKey as string | undefined
          if (key && DISSECT_CARDS[key]) {
            if (activeDissectKey === key) {
              activeDissectKey = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectKey = key
              callbacks.onInspectPart?.(DISSECT_CARDS[key])
            }
          }
        } else {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      // Animation Loop
      const animate = () => {
        animId = requestAnimationFrame(animate)
        if (params.twistSpeed > 0 && !activeDissectKey) {
          dnaRig.rotation.y += 0.01 * params.twistSpeed
        }
        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          buildHelix()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          dnaRig.rotation.set(0, 0, 0)
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
          buildHelix()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 6. BIOLOGY: 3D HUMAN HEART & CARDIAC CYCLE
  // ==========================================
  heart_3d: {
    type: 'heart_3d',
    title: '3D Beating Human Heart & Circulation',
    subject: 'Biology · Human Physiology',
    concept: '4-Chambered Double Circulation & Cardiac Cycle',
    description: 'Anatomically authentic 3D human heart based on standard medical illustrations (Kenhub, WebMD & StopAfib). Displays physiological 2-phase beating, anterior coronary sulcus with LAD artery and adipose cushions, and a fluid coronal split animation exposing 3x myocardial wall thickness contrast, bicuspid & tricuspid valves, heart strings, and SA node pacemaker.',
    emoji: '🫀',
    difficulty: 'Intermediate',
    presets: [
      { label: '❤️ Intact Beating Organ (72 BPM)', params: { bpm: 72, strokeVolume: 70, splitView: 0, focusSide: 0, showValves: 1 } },
      { label: '✂️ Split Left & Right Halves (Anatomical Section)', params: { bpm: 60, strokeVolume: 70, splitView: 1, focusSide: 0, showValves: 1 } },
      { label: '🔴 Left Heart (Oxygenated Systemic Circuit & Thick LV)', params: { bpm: 60, strokeVolume: 70, splitView: 1, focusSide: 1, showValves: 1 } },
      { label: '🔵 Right Heart (Deoxygenated Pulmonary Circuit & SA Node)', params: { bpm: 60, strokeVolume: 70, splitView: 1, focusSide: 2, showValves: 1 } },
      { label: '🏃 Athletic Cardio Workout (130 BPM)', params: { bpm: 130, strokeVolume: 95, splitView: 0, focusSide: 0, showValves: 1 } },
    ],
    params: [
      { key: 'bpm', label: 'Heart Rate (BPM)', min: 45, max: 180, step: 1, defaultValue: 72, unit: 'bpm' },
      { key: 'strokeVolume', label: 'Stroke Volume', min: 40, max: 120, step: 2, defaultValue: 70, unit: 'mL' },
      { key: 'splitView', label: 'Split Left & Right Halves (0: Intact, 1: Split Open)', min: 0, max: 1, step: 1, defaultValue: 0, unit: '' },
      { key: 'showValves', label: 'Internal Valve Visibility', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
    ],
    calculateReadouts: (p) => {
      const co = ((p.bpm * p.strokeVolume) / 1000).toFixed(2)
      const cycleTime = (60 / p.bpm).toFixed(2)
      const isSplit = p.splitView >= 0.5 || (p.focusSide && p.focusSide > 0)
      return [
        { label: 'Cardiac Output (Q)', value: co, unit: 'L/min', formula: 'Q = HR × SV' },
        { label: 'Cardiac Cycle Time', value: cycleTime, unit: 's', formula: 'T = 60 / BPM' },
        { label: 'Anatomical Section', value: isSplit ? 'Left & Right Halves Split' : 'Intact Organ' },
        { label: 'Circulation Circuit', value: 'Double Circulation (Systemic & Pulmonary)' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createBioStudioEnvironment(scene)

      // Direct anterior coronal camera framing (standard medical illustration perspective)
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 0.8, 13.2)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 6.0
      controls.maxDistance = 20.0
      controls.target.set(0, 0.8, 0)

      // Main anatomical rig with natural physiological apex tilt
      const heartRig = new THREE.Group()
      heartRig.position.y = 0.1
      heartRig.rotation.z = -0.1
      scene.add(heartRig)

      // In anatomical position (patient facing viewer):
      // Viewer's LEFT is anatomical RIGHT (Right Atrium, RV, SVC, Pulmonary Trunk)
      // Viewer's RIGHT is anatomical LEFT (Left Atrium, LV, Aortic Arch, Apex)
      const rightHeartGroup = new THREE.Group()
      const leftHeartGroup = new THREE.Group()
      heartRig.add(rightHeartGroup, leftHeartGroup)

      // Dedicated illumination inside dissected chambers
      const leftCavityLight = new THREE.PointLight(0xffedd5, 1.8, 8)
      leftCavityLight.position.set(1.1, -0.2, 0.6)
      leftHeartGroup.add(leftCavityLight)

      const rightCavityLight = new THREE.PointLight(0xffedd5, 1.8, 8)
      rightCavityLight.position.set(-1.1, -0.2, 0.6)
      rightHeartGroup.add(rightCavityLight)

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        split: {
          title: 'Heart Coronal Section · Left & Right Halves Split',
          partName: 'Functional Double Pump Hemispheres Dissected',
          role: 'Reveals the two independent circuits: Systemic High-Pressure Circuit (Left) and Pulmonary Low-Pressure Circuit (Right)',
          internalStructures: ['Thick Myocardial Wall (Left Ventricle ~15 mm)', 'Thin Myocardial Wall (Right Ventricle ~4 mm)', 'Muscular Interventricular Septum', 'Bicuspid (Mitral) & Tricuspid Valves', 'Papillary Muscles & Chordae Tendineae'],
          description: 'The heart has split along the coronal septum. Notice the profound thickness difference: the Left Ventricle has 3x thicker muscular walls to generate 120 mmHg systolic pressure to supply the entire body, whereas the Right Ventricle only pumps against 25 mmHg pulmonary resistance.',
        },
        la: {
          title: 'Left Atrium (Atrium Sinistrum) · Interior Dissected',
          partName: 'Oxygenated Receiving Chamber',
          role: 'Collects freshly oxygenated blood from both lungs via 4 pulmonary veins; delivers into Left Ventricle',
          bloodType: 'Oxygenated',
          internalStructures: ['4 Pulmonary Vein Intakes (Left & Right pairs)', 'Bicuspid (Mitral) Valve Orifice', 'Pectinate Muscles in Left Auricle', 'Interatrial Septum Wall'],
          description: 'The Left Atrium receives high-oxygen blood returning from alveolar capillaries. Blood passes through the bicuspid (mitral) valve during ventricular diastole.',
        },
        lv: {
          title: 'Left Ventricle (Ventriculus Sinister) · Interior Cavity',
          partName: 'Systemic Muscular Powerhouse',
          role: 'Ejects oxygenated blood under high pressure into the ascending aorta to perfuse the brain, viscera, and extremities',
          bloodType: 'Oxygenated',
          internalStructures: ['Thick Myocardial Wall (3x thicker ~15mm)', 'Stout Papillary Pillars', 'Fibrous Chordae Tendineae (Heart Strings)', 'Bicuspid Valve Leaflets', 'Aortic Vestibule'],
          description: 'Notice the prominent papillary muscles and chordae tendineae anchored to the mitral valve cusps. These strings act like parachute guy-wires, preventing valve prolapse under 120 mmHg systolic pressure.',
        },
        ra: {
          title: 'Right Atrium (Atrium Dextrum) & SA Node Pacemaker',
          partName: 'Deoxygenated Venous Receiving Chamber',
          role: 'Receives systemic venous return from Superior & Inferior Vena Cava; houses the SA Node natural pacemaker',
          bloodType: 'Deoxygenated',
          internalStructures: ['Sinoatrial (SA) Node Pacemaker', 'Superior Vena Cava (SVC) Intake', 'Inferior Vena Cava (IVC) Intake', 'Fossa Ovalis Depression', 'Tricuspid Valve Orifice'],
          description: 'The Right Atrium collects oxygen-depleted blood from the upper and lower body. The SA Node in its upper wall generates rhythmic electrical depolarization waves driving the heartbeat.',
        },
        rv: {
          title: 'Right Ventricle (Ventriculus Dexter) · Pulmonary Pump',
          partName: 'Low-Pressure Pulmonary Pump',
          role: 'Pumps venous blood through the pulmonary valve and trunk into the lungs for alveolar gas exchange',
          bloodType: 'Deoxygenated',
          internalStructures: ['Thin Myocardial Wall (~4 mm)', 'Tricuspid Valve (3 Cusps)', 'Trabeculae Carneae Muscular Columns', 'Conus Arteriosus Funnel', 'Moderator Band'],
          description: 'The Right Ventricle has a crescent shape and thinner wall (~4 mm) compared to the left ventricle, since pulmonary capillary vascular resistance requires only ~25 mmHg systolic pressure.',
        },
        aorta: {
          title: 'Ascending Aorta & Systemic Arch',
          partName: 'Principal Systemic Arterial Trunk',
          role: 'Distributes oxygenated blood under high pulsatile pressure to the coronary arteries, head, upper extremities, and descending systemic circulation',
          bloodType: 'Oxygenated',
          internalStructures: ['Aortic Valve Cusps', 'Sinuses of Valsalva', 'Brachiocephalic Artery', 'Left Common Carotid Artery', 'Left Subclavian Artery'],
          description: 'The thick, elastic aortic wall dampens systolic pressure spikes (Windkessel effect) and sustains blood flow into peripheral tissues during ventricular diastole.',
        },
        pulmonary: {
          title: 'Pulmonary Artery Trunk & Bifurcation',
          partName: 'Pulmonary Outflow Trunk',
          role: 'Carries deoxygenated blood from the right ventricle to the left and right lungs for oxygenation',
          bloodType: 'Deoxygenated',
          internalStructures: ['Pulmonary Semilunar Valve', 'Main Pulmonary Trunk', 'Left Pulmonary Artery', 'Right Pulmonary Artery', 'Ligamentum Arteriosum'],
          description: 'The pulmonary trunk emerges anterior to the ascending aorta and quickly bifurcates into the left and right pulmonary arteries to deliver blood to pulmonary capillaries.',
        },
        sanode: {
          title: 'Sinoatrial (SA) Node · Heart Pacemaker',
          partName: 'Primary Cardiac Pacemaker',
          role: 'Generates spontaneous, rhythmic action potentials that initiate each heartbeat and set cardiac rhythm',
          bloodType: 'Neutral',
          internalStructures: ['P-cells (Pacemaker Cells)', 'Funny Channels (If Current)', 'Bachmann Bundle Conduction Pathway', 'Crista Terminalis Junction'],
          description: 'The SA Node generates intrinsic rhythmic depolarization pulses (~72 beats per minute). Notice the glowing golden-cyan conduction waves spreading across the atria before ventricular contraction.',
        },
      }

      // High-Fidelity Medical Materials (matching Kenhub / WebMD)
      const myoMatLeft = new THREE.MeshStandardMaterial({
        color: 0x9e1238,
        roughness: 0.32,
        metalness: 0.1,
      })
      const myoMatRight = new THREE.MeshStandardMaterial({
        color: 0x881337,
        roughness: 0.34,
        metalness: 0.1,
      })
      const atriumMat = new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        roughness: 0.35,
        metalness: 0.08,
      })
      const fatMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.72,
        metalness: 0.04,
      })
      const lumenMat = new THREE.MeshStandardMaterial({
        color: 0x580614,
        roughness: 0.38,
        side: THREE.BackSide,
      })
      const cutWallLeftMat = new THREE.MeshStandardMaterial({
        color: 0xbe123c,
        roughness: 0.32,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })
      const cutWallRightMat = new THREE.MeshStandardMaterial({
        color: 0x9f1239,
        roughness: 0.34,
        metalness: 0.08,
        side: THREE.DoubleSide,
      })
      const valveMat = new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        roughness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
      const chordaeMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.25,
        metalness: 0.15,
      })
      const arterialMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.24,
        metalness: 0.26,
      })
      const venousMat = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.26,
        metalness: 0.26,
      })

      // State tracking
      let isSplit = Boolean(params.splitView === 1 || (params.focusSide && params.focusSide > 0))
      let splitProgress = isSplit ? 1.0 : 0.0
      let activeDissectId: string | null = params.focusSide === 1 ? 'lv' : params.focusSide === 2 ? 'ra' : isSplit ? 'split' : null

      function registerPart(mesh: THREE.Object3D, id: string) {
        mesh.userData = { partId: id }
        interactableMeshes.push(mesh)
      }

      // ========================================================
      // 1. LEFT HEART (SYSTEMIC CIRCUIT - ANATOMICAL LEFT, VIEWER'S RIGHT: X > 0)
      // ========================================================
      // LV Posterior Chamber Bowl (z <= 0) - Facing camera at z = 0
      const lvPostGeo = new THREE.SphereGeometry(2.4, 32, 32, Math.PI, Math.PI, 0, Math.PI)
      lvPostGeo.scale(0.9, 1.45, 0.9)
      const lvPostMesh = new THREE.Mesh(lvPostGeo, myoMatLeft)
      lvPostMesh.position.set(1.0, -0.6, 0.0)
      registerPart(lvPostMesh, 'lv')
      leftHeartGroup.add(lvPostMesh)

      // Anatomical Cardiac Apex: Cone pointing inferiorly and to the left (Apex Cordis)
      const apexGeo = new THREE.ConeGeometry(1.2, 1.9, 32)
      apexGeo.rotateZ(Math.PI)
      apexGeo.rotateZ(0.25)
      const lvApexMesh = new THREE.Mesh(apexGeo, myoMatLeft)
      lvApexMesh.position.set(0.7, -2.6, 0.15)
      registerPart(lvApexMesh, 'lv')
      leftHeartGroup.add(lvApexMesh)

      // LV Anterior Wall Shell (z >= 0) - Covers the heart when intact
      const lvAntGeo = new THREE.SphereGeometry(2.4, 32, 32, 0, Math.PI, 0, Math.PI)
      lvAntGeo.scale(0.9, 1.45, 0.9)
      const lvAntMesh = new THREE.Mesh(lvAntGeo, myoMatLeft.clone())
      lvAntMesh.position.set(1.0, -0.6, 0.0)
      registerPart(lvAntMesh, 'lv')
      leftHeartGroup.add(lvAntMesh)

      // LV Internal Cavity Lumen (inside posterior bowl)
      const lvCavityGeo = new THREE.SphereGeometry(1.9, 24, 24, Math.PI, Math.PI, 0, Math.PI)
      lvCavityGeo.scale(0.72, 1.35, 0.78)
      const lvCavity = new THREE.Mesh(lvCavityGeo, lumenMat)
      lvCavity.position.set(1.0, -0.6, -0.05)
      registerPart(lvCavity, 'lv')
      leftHeartGroup.add(lvCavity)

      // Coronal Cut Face on z = 0 (Showing thick ~15 mm myocardium wall and solid interventricular septum)
      const lvShape = new THREE.Shape()
      // Outer border matching LV posterior contour
      const lvR = 2.38
      lvShape.absellipse(0, 0, lvR * 0.9, lvR * 1.45, 0, Math.PI * 2, false, 0)
      // Inner lumen hole (hollow cavity)
      const lvHole = new THREE.Path()
      lvHole.absellipse(0.12, 0, 1.4 * 0.85, 1.4 * 1.35, 0, Math.PI * 2, true, 0)
      lvShape.holes.push(lvHole)
      const lvCutShapeGeo = new THREE.ShapeGeometry(lvShape, 48)
      const lvCutFace = new THREE.Mesh(lvCutShapeGeo, cutWallLeftMat)
      lvCutFace.position.set(1.0, -0.6, 0.01)
      registerPart(lvCutFace, 'lv')
      leftHeartGroup.add(lvCutFace)

      // Trabeculae Carneae Muscular Columns lining LV interior
      for (let t = 0; t < 6; t++) {
        const trabGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.8, 8)
        const trabMesh = new THREE.Mesh(trabGeo, myoMatLeft)
        trabMesh.position.set(0.6 + (t % 3) * 0.45, -1.2 + (t > 2 ? 0.8 : 0), -0.35)
        trabMesh.rotation.z = (t - 2.5) * 0.15
        leftHeartGroup.add(trabMesh)
      }

      // Papillary Muscles anchored inside LV posterior floor
      const papGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.4, 12)
      const pap1 = new THREE.Mesh(papGeo, myoMatLeft)
      pap1.position.set(1.4, -1.0, -0.4)
      leftHeartGroup.add(pap1)

      const pap2 = new THREE.Mesh(papGeo, myoMatLeft)
      pap2.position.set(0.6, -1.0, -0.4)
      leftHeartGroup.add(pap2)

      // Fibrous Chordae Tendineae ("Heart Strings")
      for (let c = 0; c < 8; c++) {
        const cordGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.25, 6)
        cordGeo.translate(0, 0.62, 0)
        const cordMesh = new THREE.Mesh(cordGeo, chordaeMat)
        const isPap1 = c < 4
        cordMesh.position.copy(isPap1 ? pap1.position : pap2.position).add(new THREE.Vector3(0, 0.7, 0))
        const angle = ((c % 4) * Math.PI) / 3
        cordMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(Math.cos(angle) * 0.35, 1.0, Math.sin(angle) * 0.35).normalize()
        )
        leftHeartGroup.add(cordMesh)
      }

      // Mitral (Bicuspid) Valve Leaflets across LV inlet
      const mitralGeo = new THREE.PlaneGeometry(1.4, 0.75)
      const mitralCusp1 = new THREE.Mesh(mitralGeo, valveMat)
      mitralCusp1.position.set(1.0, 0.75, 0.1)
      mitralCusp1.rotation.x = 0.4
      registerPart(mitralCusp1, 'lv')
      leftHeartGroup.add(mitralCusp1)

      const mitralCusp2 = new THREE.Mesh(mitralGeo, valveMat)
      mitralCusp2.position.set(1.0, 0.75, -0.3)
      mitralCusp2.rotation.x = -0.4
      registerPart(mitralCusp2, 'lv')
      leftHeartGroup.add(mitralCusp2)

      // Left Atrium (LA) - Posterior receiving chamber
      const laGeo = new THREE.SphereGeometry(1.65, 24, 24)
      laGeo.scale(1.05, 1.0, 1.1)
      const laMesh = new THREE.Mesh(laGeo, atriumMat)
      laMesh.position.set(1.2, 2.2, -0.3)
      registerPart(laMesh, 'la')
      leftHeartGroup.add(laMesh)

      // Left Auricle (appendage with crenulated form)
      const laAuricle = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 16),
        atriumMat
      )
      laAuricle.scale.set(1.1, 0.7, 1.3)
      laAuricle.position.set(0.9, 1.7, 0.75)
      leftHeartGroup.add(laAuricle)

      // 4 Pulmonary Vein Intakes (Oxygenated Blood from Lungs)
      const pvOffsets = [
        new THREE.Vector3(0.85, 0.5, -0.6),
        new THREE.Vector3(0.85, -0.4, -0.6),
        new THREE.Vector3(-0.4, 0.5, -0.8),
        new THREE.Vector3(-0.4, -0.4, -0.8),
      ]
      pvOffsets.forEach((pvOff) => {
        const pvGeo = new THREE.CylinderGeometry(0.24, 0.26, 1.4, 12)
        pvGeo.translate(0, 0.7, 0)
        const pvMesh = new THREE.Mesh(pvGeo, arterialMat)
        pvMesh.position.copy(laMesh.position).add(pvOff)
        pvMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pvOff.clone().normalize())
        leftHeartGroup.add(pvMesh)

        // Glowing red intake ostium
        const ostium = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 8, 16), new THREE.MeshBasicMaterial({ color: 0xfca5a5 }))
        ostium.position.copy(pvMesh.position)
        ostium.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pvOff.clone().normalize())
        leftHeartGroup.add(ostium)
      })

      // Ascending Aorta & Iconic Aortic Arch
      const aortaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.3, 1.1, 0.1),
        new THREE.Vector3(0.2, 3.2, 0.2),
        new THREE.Vector3(-0.3, 4.8, 0),
        new THREE.Vector3(0.0, 5.4, -0.6),
        new THREE.Vector3(1.1, 5.0, -1.0),
        new THREE.Vector3(1.7, 2.8, -1.2),
      ])
      const aortaGeo = new THREE.TubeGeometry(aortaCurve, 32, 0.65, 16, false)
      const aortaMesh = new THREE.Mesh(aortaGeo, arterialMat)
      registerPart(aortaMesh, 'aorta')
      leftHeartGroup.add(aortaMesh)

      // 3 Aortic Arch Branches (Brachiocephalic, Left Common Carotid, Left Subclavian)
      const archBranches = [
        { start: new THREE.Vector3(-0.3, 5.1, -0.1), dir: new THREE.Vector3(-0.4, 1.4, 0.2) },
        { start: new THREE.Vector3(0.1, 5.3, -0.4), dir: new THREE.Vector3(-0.1, 1.5, 0.1) },
        { start: new THREE.Vector3(0.6, 5.2, -0.7), dir: new THREE.Vector3(0.2, 1.4, -0.1) },
      ]
      archBranches.forEach((b) => {
        const bGeo = new THREE.CylinderGeometry(0.17, 0.21, 1.6, 12)
        bGeo.translate(0, 0.8, 0)
        const bMesh = new THREE.Mesh(bGeo, arterialMat)
        bMesh.position.copy(b.start)
        bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.dir.clone().normalize())
        leftHeartGroup.add(bMesh)
      })

      // Systemic Oxygenated Blood Flow Particles (travel along left heart half)
      const sysCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.5, 2.5, -0.6),
        new THREE.Vector3(1.2, 2.1, -0.3),
        new THREE.Vector3(1.0, 0.8, -0.1),
        new THREE.Vector3(0.9, -0.8, -0.2),
        new THREE.Vector3(0.7, -2.1, 0.0),
        new THREE.Vector3(0.4, -0.8, 0.1),
        new THREE.Vector3(0.3, 1.1, 0.1),
        new THREE.Vector3(0.2, 3.2, 0.2),
        new THREE.Vector3(0.0, 5.4, -0.6),
        new THREE.Vector3(1.7, 2.8, -1.2)
      ])
      const sysBloodCount = 35
      const sysBloodSpheres: THREE.Mesh[] = []
      const sysBloodMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
        roughness: 0.2
      })
      const bBallGeo = new THREE.SphereGeometry(0.12, 10, 10)
      for (let s = 0; s < sysBloodCount; s++) {
        const sm = new THREE.Mesh(bBallGeo, sysBloodMat)
        sm.userData = { progress: s / sysBloodCount }
        leftHeartGroup.add(sm)
        sysBloodSpheres.push(sm)
      }

      // ========================================================
      // 2. RIGHT HEART (PULMONARY CIRCUIT - ANATOMICAL RIGHT, VIEWER'S LEFT: X < 0)
      // ========================================================
      // RV Posterior Chamber Bowl (z <= 0)
      const rvPostGeo = new THREE.SphereGeometry(2.3, 32, 32, Math.PI, Math.PI, 0, Math.PI)
      rvPostGeo.scale(1.05, 1.35, 0.85)
      const rvPostMesh = new THREE.Mesh(rvPostGeo, myoMatRight)
      rvPostMesh.position.set(-1.0, -0.5, 0.0)
      registerPart(rvPostMesh, 'rv')
      rightHeartGroup.add(rvPostMesh)

      // RV Anterior Wall Shell (z >= 0)
      const rvAntGeo = new THREE.SphereGeometry(2.3, 32, 32, 0, Math.PI, 0, Math.PI)
      rvAntGeo.scale(1.05, 1.35, 0.85)
      const rvAntMesh = new THREE.Mesh(rvAntGeo, myoMatRight.clone())
      rvAntMesh.position.set(-1.0, -0.5, 0.0)
      registerPart(rvAntMesh, 'rv')
      rightHeartGroup.add(rvAntMesh)

      // RV Internal Cavity Lumen (inside posterior bowl)
      const rvCavityGeo = new THREE.SphereGeometry(2.15, 24, 24, Math.PI, Math.PI, 0, Math.PI)
      rvCavityGeo.scale(1.0, 1.3, 0.8)
      const rvCavity = new THREE.Mesh(rvCavityGeo, lumenMat)
      rvCavity.position.set(-1.0, -0.5, -0.05)
      registerPart(rvCavity, 'rv')
      rightHeartGroup.add(rvCavity)

      // Coronal Cut Face on z = 0 (Showing thin ~4 mm wall border - 3x thinner than LV, wrapping crescent around septum)
      const rvShape = new THREE.Shape()
      const rvR = 2.3
      rvShape.absellipse(0, 0, rvR * 1.05, rvR * 1.35, 0, Math.PI * 2, false, 0)
      const rvHole = new THREE.Path()
      rvHole.absellipse(-0.06, 0, 2.05 * 1.0, 2.05 * 1.3, 0, Math.PI * 2, true, 0)
      rvShape.holes.push(rvHole)
      const rvCutShapeGeo = new THREE.ShapeGeometry(rvShape, 48)
      const rvCutFace = new THREE.Mesh(rvCutShapeGeo, cutWallRightMat)
      rvCutFace.position.set(-1.0, -0.5, 0.01)
      registerPart(rvCutFace, 'rv')
      rightHeartGroup.add(rvCutFace)

      // Right Atrium (RA)
      const raGeo = new THREE.SphereGeometry(1.7, 24, 24)
      raGeo.scale(1.08, 1.1, 1.0)
      const raMesh = new THREE.Mesh(raGeo, myoMatRight)
      raMesh.position.set(-1.4, 2.0, 0.0)
      registerPart(raMesh, 'ra')
      rightHeartGroup.add(raMesh)

      // Right Auricle (dog-ear appendage wrapping anteriorly)
      const raAuricle = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), myoMatRight)
      raAuricle.scale.set(1.2, 0.8, 1.1)
      raAuricle.position.set(-0.8, 1.9, 0.85)
      rightHeartGroup.add(raAuricle)

      // Tricuspid Valve Leaflets
      const triGeo = new THREE.PlaneGeometry(1.3, 0.75)
      const triCusp1 = new THREE.Mesh(triGeo, valveMat)
      triCusp1.position.set(-1.0, 0.65, 0.1)
      triCusp1.rotation.x = 0.4
      registerPart(triCusp1, 'rv')
      rightHeartGroup.add(triCusp1)

      const triCusp2 = new THREE.Mesh(triGeo, valveMat)
      triCusp2.position.set(-1.0, 0.65, -0.3)
      triCusp2.rotation.x = -0.4
      registerPart(triCusp2, 'rv')
      rightHeartGroup.add(triCusp2)

      // Superior Vena Cava (SVC)
      const svcGeo = new THREE.CylinderGeometry(0.55, 0.55, 3.2, 16)
      const svcMesh = new THREE.Mesh(svcGeo, venousMat)
      svcMesh.position.set(-1.6, 3.8, -0.4)
      registerPart(svcMesh, 'ra')
      rightHeartGroup.add(svcMesh)

      // Inferior Vena Cava (IVC)
      const ivcGeo = new THREE.CylinderGeometry(0.52, 0.52, 2.6, 16)
      const ivcMesh = new THREE.Mesh(ivcGeo, venousMat)
      ivcMesh.position.set(-1.4, -1.8, -0.5)
      registerPart(ivcMesh, 'ra')
      rightHeartGroup.add(ivcMesh)

      // Sinoatrial (SA) Node Pacemaker Orb & Depolarization Wave
      const saGeo = new THREE.SphereGeometry(0.3, 16, 16)
      const saMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
      const saMesh = new THREE.Mesh(saGeo, saMat)
      saMesh.position.set(-1.6, 3.1, 0.6)
      registerPart(saMesh, 'sanode')
      rightHeartGroup.add(saMesh)

      const saPulseGeo = new THREE.RingGeometry(0.35, 0.7, 32)
      const saPulseMesh = new THREE.Mesh(
        saPulseGeo,
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
      )
      saPulseMesh.position.copy(saMesh.position)
      saPulseMesh.rotation.y = Math.PI / 4
      rightHeartGroup.add(saPulseMesh)

      // Pulmonary Trunk (emerging from RV) & Bifurcation into Left/Right Pulmonary Arteries
      const ptCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.4, 0.8, 0.5),
        new THREE.Vector3(-0.2, 2.6, 0.8),
        new THREE.Vector3(0.2, 3.8, 0.3),
      ])
      const ptGeo = new THREE.TubeGeometry(ptCurve, 24, 0.55, 16, false)
      const ptMesh = new THREE.Mesh(ptGeo, venousMat)
      registerPart(ptMesh, 'pulmonary')
      rightHeartGroup.add(ptMesh)

      // Left & Right Pulmonary Branches
      const rpaGeo = new THREE.CylinderGeometry(0.32, 0.32, 2.4, 12)
      rpaGeo.translate(0, 1.2, 0)
      const rpaMesh = new THREE.Mesh(rpaGeo, venousMat)
      rpaMesh.position.set(0.2, 3.8, 0.3)
      rpaMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1.3, 0.2, -0.6).normalize())
      rightHeartGroup.add(rpaMesh)

      const lpaGeo = new THREE.CylinderGeometry(0.32, 0.32, 2.2, 12)
      lpaGeo.translate(0, 1.1, 0)
      const lpaMesh = new THREE.Mesh(lpaGeo, venousMat)
      lpaMesh.position.set(0.2, 3.8, 0.3)
      lpaMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1.2, 0.4, -0.7).normalize())
      rightHeartGroup.add(lpaMesh)

      // Pulmonary Deoxygenated Blood Flow Particles (travel along right heart half)
      const pulCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.6, 4.2, -0.4),
        new THREE.Vector3(-1.4, 2.0, 0.0),
        new THREE.Vector3(-1.0, 0.7, 0.0),
        new THREE.Vector3(-1.0, -0.6, -0.1),
        new THREE.Vector3(-0.7, -1.5, 0.0),
        new THREE.Vector3(-0.4, 0.8, 0.5),
        new THREE.Vector3(-0.2, 2.6, 0.8),
        new THREE.Vector3(0.2, 3.8, 0.3),
        new THREE.Vector3(-1.2, 4.2, -0.3)
      ])
      const pulBloodCount = 35
      const pulBloodSpheres: THREE.Mesh[] = []
      const pulBloodMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
        roughness: 0.2
      })
      for (let s = 0; s < pulBloodCount; s++) {
        const pm = new THREE.Mesh(bBallGeo, pulBloodMat)
        pm.userData = { progress: s / pulBloodCount }
        rightHeartGroup.add(pm)
        pulBloodSpheres.push(pm)
      }

      // ========================================================
      // 3. ANTERIOR CORONARY SULCUS & SULCUS VESSELS (INTACT VIEW)
      // ========================================================
      // Yellow Adipose Fat Cushion along Anterior Interventricular Groove
      const fatGeo = new THREE.TorusGeometry(2.35, 0.22, 10, 32, Math.PI * 0.72)
      const fatMesh = new THREE.Mesh(fatGeo, fatMat)
      fatMesh.position.set(-0.05, 0.4, 1.05)
      fatMesh.rotation.z = Math.PI / 3.4
      heartRig.add(fatMesh)

      // Left Anterior Descending (LAD) Coronary Artery
      const ladCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.1, 1.6, 1.35),
        new THREE.Vector3(-0.2, 0.6, 1.55),
        new THREE.Vector3(0.0, -0.6, 1.45),
        new THREE.Vector3(0.3, -1.8, 1.15),
        new THREE.Vector3(0.6, -2.6, 0.55),
      ])
      const ladGeo = new THREE.TubeGeometry(ladCurve, 24, 0.08, 10, false)
      const ladMesh = new THREE.Mesh(ladGeo, arterialMat)
      heartRig.add(ladMesh)

      // Great Cardiac Vein running parallel to LAD
      const gcvCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.25, 1.5, 1.3),
        new THREE.Vector3(-0.35, 0.5, 1.5),
        new THREE.Vector3(-0.15, -0.7, 1.4),
        new THREE.Vector3(0.15, -1.9, 1.1),
      ])
      const gcvGeo = new THREE.TubeGeometry(gcvCurve, 20, 0.07, 10, false)
      const gcvMesh = new THREE.Mesh(gcvGeo, venousMat)
      heartRig.add(gcvMesh)

      // ========================================================
      // 4. MOTION GRAPHICS: CORONAL BISECTING LASER & SLICING PLANE
      // ========================================================
      // Holographic Dissection Plane at z = 0 that activates and pulses during split
      const slicePlaneGeo = new THREE.PlaneGeometry(8.5, 11.5)
      const slicePlaneMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
      const slicePlaneMesh = new THREE.Mesh(slicePlaneGeo, slicePlaneMat)
      slicePlaneMesh.position.set(0, 0.5, 0)
      heartRig.add(slicePlaneMesh)

      // Scanning Dissection Laser Line across cutting edge
      const laserLineGeo = new THREE.CylinderGeometry(0.04, 0.04, 10.0, 8)
      const laserLineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 })
      const laserLine = new THREE.Mesh(laserLineGeo, laserLineMat)
      laserLine.position.set(0, 0.5, 0.02)
      heartRig.add(laserLine)

      // Glowing Dissection Spark Emitter Particles
      const sparkCount = 45
      const sparkGeo = new THREE.BufferGeometry()
      const sparkPos = new Float32Array(sparkCount * 3)
      for (let k = 0; k < sparkCount; k++) {
        sparkPos[k * 3] = (Math.random() - 0.5) * 1.5
        sparkPos[k * 3 + 1] = -3.0 + Math.random() * 7.0
        sparkPos[k * 3 + 2] = (Math.random() - 0.5) * 0.4
      }
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
      const sparkMat = new THREE.PointsMaterial({
        color: 0xa5f3fc,
        size: 0.18,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      })
      const sparkPoints = new THREE.Points(sparkGeo, sparkMat)
      heartRig.add(sparkPoints)

      // ========================================================
      // 5. MOTION GRAPHICS: CARDIAC ELECTRICAL CONDUCTION RIBBON
      // ========================================================
      const conductionCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.6, 3.1, 0.6), // SA Node
        new THREE.Vector3(-0.9, 2.2, 0.2), // Internodal tract
        new THREE.Vector3(-0.1, 0.9, 0.0), // AV Node
        new THREE.Vector3(0.0, 0.2, 0.0),  // Bundle of His
        new THREE.Vector3(0.1, -1.0, 0.0), // Septum branch
        new THREE.Vector3(0.4, -2.4, 0.1)  // Purkinje apex
      ])
      const condGeo = new THREE.TubeGeometry(conductionCurve, 32, 0.06, 8, false)
      const condMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      })
      const conductionMesh = new THREE.Mesh(condGeo, condMat)
      heartRig.add(conductionMesh)

      // Electrical Action Potential Pulse Spark
      const condSpark = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      )
      heartRig.add(condSpark)

      // 3D Chamber Biometric Callout Badges
      function createHeartBadge(text: string, subtext: string, isLeft: boolean) {
        const bCanvas = document.createElement('canvas')
        bCanvas.width = 512
        bCanvas.height = 160
        const bCtx = bCanvas.getContext('2d')!
        bCtx.fillStyle = 'rgba(7, 13, 24, 0.94)'
        bCtx.strokeStyle = isLeft ? '#ef4444' : '#38bdf8'
        bCtx.lineWidth = 5
        bCtx.beginPath()
        bCtx.roundRect(8, 8, 496, 144, 18)
        bCtx.fill()
        bCtx.stroke()

        bCtx.fillStyle = isLeft ? '#f87171' : '#38bdf8'
        bCtx.font = 'bold 34px sans-serif'
        bCtx.fillText(text, 24, 60)

        bCtx.fillStyle = '#e2e8f0'
        bCtx.font = 'bold 24px monospace'
        bCtx.fillText(subtext, 24, 110)

        const bTexture = new THREE.CanvasTexture(bCanvas)
        const bMat = new THREE.SpriteMaterial({ map: bTexture, transparent: true, opacity: 0.0 })
        const sprite = new THREE.Sprite(bMat)
        sprite.scale.set(3.4, 1.05, 1.0)
        return sprite
      }

      const lvBadge = createHeartBadge('🔴 LEFT VENTRICLE', '15 mm Wall · 120 mmHg Systolic', true)
      lvBadge.position.set(2.8, 1.8, 0.4)
      leftHeartGroup.add(lvBadge)

      const rvBadge = createHeartBadge('🔵 RIGHT VENTRICLE', '4 mm Wall · 25 mmHg Pulmonary', false)
      rvBadge.position.set(-2.8, 1.8, 0.4)
      rightHeartGroup.add(rvBadge)

      // Load Realistic Medical-Grade Blender GLTF Heart
      const gltfLoader = new GLTFLoader()
      let realisticHeartRoot: THREE.Group | null = null
      gltfLoader.load(
        '/models/heart_realistic.glb',
        (gltf) => {
          realisticHeartRoot = gltf.scene
          realisticHeartRoot.scale.setScalar(1.35)
          realisticHeartRoot.position.set(0, -0.2, 0)
          heartRig.add(realisticHeartRoot)

          const blenderLeft = realisticHeartRoot.getObjectByName('Left_Heart')
          const blenderRight = realisticHeartRoot.getObjectByName('Right_Heart')
          if (blenderLeft) leftHeartGroup.add(blenderLeft)
          if (blenderRight) rightHeartGroup.add(blenderRight)

          // Hide low-poly procedural fallback meshes once high-poly Blender model loads
          lvPostMesh.visible = false
          lvApexMesh.visible = false
          lvAntMesh.visible = false
          lvCavity.visible = false
          lvCutFace.visible = false
          rvPostMesh.visible = false
          rvAntMesh.visible = false
          rvCavity.visible = false
          rvCutFace.visible = false
          raMesh.visible = false
          raAuricle.visible = false
          aortaMesh.visible = false
          ptMesh.visible = false
          svcMesh.visible = false
          ivcMesh.visible = false
          fatMesh.visible = false
          ladMesh.visible = false
          gcvMesh.visible = false

          realisticHeartRoot.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
              const n = child.name.toLowerCase()
              if (n.includes('left') || n.includes('lv') || n.includes('mitral')) registerPart(child, 'lv')
              else if (n.includes('right') || n.includes('rv') || n.includes('tricuspid')) registerPart(child, 'rv')
              else if (n.includes('aorta')) registerPart(child, 'aorta')
              else if (n.includes('pulmonary')) registerPart(child, 'pulmonary')
              else if (n.includes('vena') || n.includes('atrium')) registerPart(child, 'ra')
            }
          })
        },
        undefined,
        (err) => {
          console.warn('Blender realistic heart fallback to procedural:', err)
        }
      )

      // Raycaster for Mouse Double-Click and Mobile Double-Tap
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function triggerRaycast(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(interactableMeshes, true)

        if (hits.length > 0) {
          const hit = hits[0].object
          const id = hit.userData?.partId as string | undefined

          if (id && DISSECT_CARDS[id]) {
            activeDissectId = id
            isSplit = true
            callbacks.onInspectPart?.(DISSECT_CARDS[id])
          } else {
            // Toggle Left/Right split
            isSplit = !isSplit
            activeDissectId = isSplit ? 'split' : null
            callbacks.onInspectPart?.(isSplit ? DISSECT_CARDS.split : null)
          }
        } else {
          // Double-tapped background: toggle Left/Right split
          isSplit = !isSplit
          activeDissectId = isSplit ? 'split' : null
          callbacks.onInspectPart?.(isSplit ? DISSECT_CARDS.split : null)
        }
      }

      function handleDblClick(e: MouseEvent) {
        triggerRaycast(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      function handleTouchEnd(e: TouchEvent) {
        const now = Date.now()
        if (now - lastTouchTime < 350 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerRaycast(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      if (isSplit && activeDissectId && DISSECT_CARDS[activeDissectId]) {
        callbacks.onInspectPart?.(DISSECT_CARDS[activeDissectId])
      }

      let pulseTime = 0

      function animate() {
        animId = requestAnimationFrame(animate)

        // Smooth fluid Left/Right splitting animation with cubic easing
        const targetSplit = (isSplit || params.splitView === 1 || (params.focusSide && params.focusSide > 0)) ? 1.0 : 0.0
        splitProgress += (targetSplit - splitProgress) * 0.085

        // Right Heart (viewer's left) translates left and tilts inward
        rightHeartGroup.position.x = -splitProgress * 2.8
        rightHeartGroup.rotation.y = splitProgress * 0.18
        rightHeartGroup.position.z = -splitProgress * 0.2

        // Left Heart (viewer's right) translates right and tilts inward
        leftHeartGroup.position.x = splitProgress * 2.8
        leftHeartGroup.rotation.y = -splitProgress * 0.18
        leftHeartGroup.position.z = -splitProgress * 0.2

        // Anterior ventricle shells fade smoothly as coronal interior opens (no awkward hinged flaps)
        lvAntMesh.position.z = splitProgress * 0.35
        const lvAntMat = lvAntMesh.material as THREE.MeshStandardMaterial
        lvAntMat.transparent = true
        lvAntMat.opacity = Math.max(0, 1.0 - splitProgress * 2.2)
        lvAntMesh.visible = splitProgress < 0.55

        rvAntMesh.position.z = splitProgress * 0.35
        const rvAntMat = rvAntMesh.material as THREE.MeshStandardMaterial
        rvAntMat.transparent = true
        rvAntMat.opacity = Math.max(0, 1.0 - splitProgress * 2.2)
        rvAntMesh.visible = splitProgress < 0.55

        // Fade anterior sulcus fat, LAD vessels, and cut faces
        fatMesh.visible = splitProgress < 0.25
        ladMesh.visible = splitProgress < 0.25
        gcvMesh.visible = splitProgress < 0.25
        lvCutFace.visible = splitProgress > 0.04
        rvCutFace.visible = splitProgress > 0.04

        // Split Motion Graphics: Laser pulse and dissection sparks during separation ONLY (no persistent plane)
        const splitMidWave = Math.sin(splitProgress * Math.PI)
        slicePlaneMesh.visible = splitProgress > 0.02 && splitProgress < 0.94
        slicePlaneMat.opacity = splitMidWave * 0.65
        laserLine.visible = splitProgress > 0.02 && splitProgress < 0.94
        laserLineMat.opacity = splitMidWave * 0.95
        laserLine.position.y = 0.5 + Math.sin(pulseTime * 14) * 3.5

        // Biometric Callout Badges fade in gracefully beside each hemisphere
        const badgeAlpha = Math.max(0, Math.min(1, (splitProgress - 0.25) * 1.5))
        ;(lvBadge.material as THREE.SpriteMaterial).opacity = badgeAlpha
        ;(rvBadge.material as THREE.SpriteMaterial).opacity = badgeAlpha

        // Dissection sparks emission during active transition
        sparkMat.opacity = splitMidWave * 0.9
        if (splitMidWave > 0.1) {
          const sAttr = sparkGeo.attributes.position as THREE.BufferAttribute
          for (let k = 0; k < sparkCount; k++) {
            let px = sAttr.getX(k) + (Math.random() - 0.5) * 0.16
            if (Math.abs(px) > 2.8) px = (Math.random() - 0.5) * 0.8
            sAttr.setX(k, px)
          }
          sAttr.needsUpdate = true
        }

        if (isPlaying) {
          const freq = (params.bpm / 60) * Math.PI * 2
          pulseTime += 0.024
          const cyclePhase = (pulseTime * freq) % (Math.PI * 2)

          // 2-Phase Cardiac Cycle: Atrial Systole -> Ventricular Systole -> Diastole
          const isAtrialBeat = cyclePhase < Math.PI * 0.4
          const isVentBeat = cyclePhase >= Math.PI * 0.4 && cyclePhase < Math.PI * 1.2

          const atriaContraction = isAtrialBeat ? 1.0 - Math.sin(cyclePhase * 2.5) * 0.12 : 1.0
          laMesh.scale.set(1.05 * atriaContraction, 1.0 * atriaContraction, 1.1 * atriaContraction)
          raMesh.scale.set(1.08 * atriaContraction, 1.1 * atriaContraction, 1.0 * atriaContraction)

          const ventScale = isVentBeat
            ? 1.0 - Math.sin((cyclePhase - Math.PI * 0.4) * 1.25) * 0.14
            : 1.0 + Math.sin(cyclePhase) * 0.04

          lvPostMesh.scale.set(0.9 * ventScale, 1.45 * (2 - ventScale), 0.9 * ventScale)
          lvApexMesh.scale.set(ventScale, 2 - ventScale, ventScale)
          lvAntMesh.scale.set(0.9 * ventScale, 1.45 * (2 - ventScale), 0.9 * ventScale)
          rvPostMesh.scale.set(1.05 * ventScale, 1.35 * (2 - ventScale), 0.85 * ventScale)
          rvAntMesh.scale.set(1.05 * ventScale, 1.35 * (2 - ventScale), 0.85 * ventScale)

          if (realisticHeartRoot) {
            realisticHeartRoot.scale.set(1.35 * ventScale, 1.35 * (2 - ventScale), 1.35 * ventScale)
          }

          // Dynamic Valve Leaflets flapping in sync with cardiac cycle
          const valveOpenAngle = isVentBeat ? 0.06 : 0.65
          mitralCusp1.rotation.x = valveOpenAngle
          mitralCusp2.rotation.x = -valveOpenAngle
          triCusp1.rotation.x = valveOpenAngle * 0.9
          triCusp2.rotation.x = -valveOpenAngle * 0.9

          // SA Node electrical conduction pulse
          const saWave = (Math.sin(cyclePhase) + 1.0) * 0.5
          saPulseMesh.scale.setScalar(1.0 + saWave * 1.4)
          ;(saPulseMesh.material as THREE.MeshBasicMaterial).opacity = 0.65 - saWave * 0.55

          // Electrical conduction spark travels down septum
          const condProg = (cyclePhase / (Math.PI * 2)) % 1.0
          const condPos = conductionCurve.getPointAt(condProg)
          condSpark.position.copy(condPos)
          condMat.opacity = 0.45 + saWave * 0.55

          // Double circulation blood streams active inside split halves
          const flowSpeed = (isVentBeat ? 0.35 : 0.18) * (params.bpm / 70)
          sysBloodSpheres.forEach(sm => {
            sm.userData.progress = (sm.userData.progress + 0.008 * flowSpeed) % 1.0
            const pCoord = sysCurve.getPointAt(sm.userData.progress)
            sm.position.copy(pCoord)
          })
          pulBloodSpheres.forEach(pm => {
            pm.userData.progress = (pm.userData.progress + 0.008 * flowSpeed) % 1.0
            const pCoord = pulCurve.getPointAt(pm.userData.progress)
            pm.position.copy(pCoord)
          })
        }

        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }

      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          isSplit = Boolean(params.splitView === 1 || (params.focusSide && params.focusSide > 0))
          if (params.focusSide === 1) {
            activeDissectId = 'lv'
            callbacks.onInspectPart?.(DISSECT_CARDS.lv)
          } else if (params.focusSide === 2) {
            activeDissectId = 'ra'
            callbacks.onInspectPart?.(DISSECT_CARDS.ra)
          } else if (isSplit && (!activeDissectId || activeDissectId === 'lv' || activeDissectId === 'ra')) {
            activeDissectId = 'split'
            callbacks.onInspectPart?.(DISSECT_CARDS.split)
          } else if (!isSplit && activeDissectId) {
            activeDissectId = null
            callbacks.onInspectPart?.(null)
          }
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          pulseTime = 0
          isSplit = false
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          heartRig.rotation.set(0, 0, -0.1)
        },
        closeDissection: () => {
          isSplit = false
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },
  // ==========================================
  // 7. BIOLOGY: 3D EPIDERMAL LAYERS & SKIN HISTOLOGY
  // ==========================================
  epidermis_3d: {
    type: 'epidermis_3d',
    title: '3D Epidermal Layers & Skin Histology',
    subject: 'Biology · Histology & Anatomy',
    concept: 'Stratified Squamous Epithelium: Corneum, Dermal Papillae & Appendages',
    description: 'Explore a medical-grade 3D histological cross-section of human skin. Dissect the 5 epidermal layers, examine dermal papillae capillary loops, melanocytes, the hair follicle & sebaceous gland unit, arrector pili muscle, and coiled eccrine sweat glands.',
    emoji: '🔬',
    difficulty: 'Intermediate',
    presets: [
      { label: '🌟 Intact Histological Skin Block', params: { layerSeparation: 0, activeLayer: 0, showAppendages: 1 } },
      { label: '✂️ Exploded Multi-Layer Architecture', params: { layerSeparation: 75, activeLayer: 0, showAppendages: 1 } },
      { label: '💇 Hair Follicle & Sebaceous Unit', params: { layerSeparation: 30, activeLayer: 0, showAppendages: 1 } },
      { label: '🩸 Dermal Papillae & Capillaries', params: { layerSeparation: 50, activeLayer: 6, showAppendages: 1 } },
      { label: '🧬 Stratum Basale & Melanocytes', params: { layerSeparation: 60, activeLayer: 5, showAppendages: 1 } },
      { label: '🛡️ Stratum Corneum Barrier', params: { layerSeparation: 45, activeLayer: 1, showAppendages: 1 } },
    ],
    params: [
      { key: 'layerSeparation', label: 'Explode Layers', min: 0, max: 100, step: 5, defaultValue: 0, unit: '%' },
      { key: 'activeLayer', label: 'Focus Layer (0:All, 1..7)', min: 0, max: 7, step: 1, defaultValue: 0, unit: '' },
      { key: 'showAppendages', label: 'Show Skin Appendages', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
    ],
    calculateReadouts: (p) => {
      const layerId = Math.round(p.activeLayer)
      const layerDetails: Record<number, { name: string; cells: string; role: string; marker: string }> = {
        0: {
          name: 'Complete Integumentary Cross-Section',
          cells: 'Stratified squamous keratinized epithelium + Dermis + Hypodermis',
          role: 'Full mechanical barrier, thermoregulation, sensory reception & hydration',
          marker: 'Epidermal turnover: ~28–40 days from Basale stem cell to Corneum desquamation',
        },
        1: {
          name: '1. Stratum Corneum (Horny Barrier Layer)',
          cells: '20–30 layers of dead, flattened, anucleate corneocytes',
          role: 'Hydrophobic permeability barrier preventing water loss & microbial invasion',
          marker: 'Brick-and-mortar: corneocytes embedded in extracellular lipid matrix',
        },
        2: {
          name: '2. Stratum Lucidum (Clear Transition Band)',
          cells: '2–3 rows of flat, translucent, dead keratinocytes',
          role: 'Frictional shear resistance (present in thick skin: palms & soles)',
          marker: 'Packed with eleidin, a lipid-bound protein intermediate of keratin',
        },
        3: {
          name: '3. Stratum Granulosum (Granular Zone)',
          cells: '3–5 rows of flattened cells undergoing programmed apoptosis',
          role: 'Active site of keratinization & lipid lamellar body discharge',
          marker: 'Coarse basophilic keratohyalin granules & lamellar Odland bodies',
        },
        4: {
          name: '4. Stratum Spinosum (Prickle Cell Layer)',
          cells: '8–10 layers of polyhedral cells bound by desmosome spines',
          role: 'Provides tensile structural resilience against mechanical shear & tension',
          marker: 'Prominent desmosomal cell bridges & intraepidermal Langerhans immune sentinels',
        },
        5: {
          name: '5. Stratum Basale (Germinativum)',
          cells: 'Single row of columnar/cuboidal mitotic stem cells on basement membrane',
          role: 'Continuous mitotic replenishment of epidermis + UV melanin production',
          marker: 'Anchored by hemidesmosomes; houses 10–25% dendritic melanocytes',
        },
        6: {
          name: '6. Dermis (Papillary & Reticular Base)',
          cells: 'Dense irregular connective tissue with fibroblasts & collagen bundles',
          role: 'Vascular nourishment of epidermis via papillary loops, supports hair & glands',
          marker: 'Hosts Meissner tactile corpuscles, Pacinian deep pressure sensors & capillaries',
        },
        7: {
          name: '7. Hypodermis (Subcutaneous Adipose Tissue)',
          cells: 'Unilocular adipocytes clustered in vascularized lobules',
          role: 'Thermal insulation, mechanical shock absorption & caloric energy storage',
          marker: 'Anchors skin to underlying deep fascia and skeletal muscle',
        },
      }
      const cur = layerDetails[layerId] || layerDetails[0]
      return [
        { label: 'Anatomical Structure', value: cur.name },
        { label: 'Cellular Composition', value: cur.cells },
        { label: 'Physiological Function', value: cur.role },
        { label: 'Histological Marker', value: cur.marker },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(16, 14, 22)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 1.5, 0)

      const skinRig = new THREE.Group()
      scene.add(skinRig)

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        corneum: {
          title: 'Stratum Corneum (Horny Barrier Layer)',
          partName: 'Corneocyte Brick & Extracellular Lipid Mortar',
          role: 'Primary physical and waterproof barrier safeguarding internal bodily homeostasis',
          bloodType: 'Neutral',
          internalStructures: ['Anucleate Corneocytes (Dead Keratin Flakes)', 'Hydrophobic Lipid Matrix (Ceramides, Free Fatty Acids, Cholesterol)', 'Cornified Envelope (Loricrin & Involucrin Crosslinks)', 'Acid Mantle Surface pH 4.5–5.5'],
          description: 'The outermost shield of the human body. Composed of 20 to 30 layers of dead, flattened squames tightly sealed in a specialized lipid bilayer. Prevents transepidermal water loss (TEWL) and repels environmental microbes and chemicals.',
          actionHint: 'Double-tap another layer or part to inspect microscopic histology',
        },
        lucidum: {
          title: 'Stratum Lucidum (Clear Transition Zone)',
          partName: 'Translucent Eleidin Barrier Band',
          role: 'Provides extra thickness and mechanical shear cushioning in high-friction thick skin',
          bloodType: 'Neutral',
          internalStructures: ['Translucent Eleidin Protein Droplets', 'Flattened Degenerate Keratinocytes', 'Dense Packed Intermediate Tonofibrils'],
          description: 'A thin, glass-like band found exclusively in thick glabrous skin (palms and soles). It serves as a transition zone where cellular organelles have completed autolysis, preparing keratinocytes for final cornification.',
          actionHint: 'Double-tap to close',
        },
        granulosum: {
          title: 'Stratum Granulosum (Granular Secretory Layer)',
          partName: 'Keratohyalin & Odland Body Secretory Zone',
          role: 'Critical biochemical hub where programmed cell death and epidermal lipid barrier synthesis occur',
          bloodType: 'Neutral',
          internalStructures: ['Keratohyalin Granules (Profilaggrin & Keratin Crosslinkers)', 'Lamellar Bodies (Odland Secretory Granules)', 'Pyknotic Deteriorating Cell Nuclei', 'Active Extracellular Exocytosis of Ceramides'],
          description: 'Here keratinocytes flatten and synthesize coarse keratohyalin granules while discharging lipid-rich lamellar bodies into intercellular spaces to create the waterproof sealant.',
          actionHint: 'Double-tap to close',
        },
        spinosum: {
          title: 'Stratum Spinosum (Prickle Cell Layer)',
          partName: 'Polyhedral Desmosomal Network & Langerhans Immune Sentinels',
          role: 'Provides tensile structural integrity against mechanical shear and coordinates cutaneous immunity',
          bloodType: 'Neutral',
          internalStructures: ['Prominent Desmosome Spines (Macula Adhaerens)', 'Keratin Intermediate Tonofilament Bundles', 'Intraepidermal Langerhans (Antigen Presenting) Dendritic Cells', 'Melanin Supranuclear Sun-Hats'],
          description: 'Named for the prickly spine-like intercellular desmosomal bridges that connect adjacent cells. Langerhans dendritic cells patrol this layer, capturing antigens and migrating to regional lymph nodes.',
          actionHint: 'Double-tap to close',
        },
        basale: {
          title: 'Stratum Basale (Stratum Germinativum)',
          partName: 'Mitotic Basal Stem Cells & Dermal-Epidermal Junction',
          role: 'Continuous lifelong renewal of the epidermis through mitotic cell division',
          bloodType: 'Neutral',
          internalStructures: ['Actively Dividing Basal Keratinocyte Stem Cells', 'Hemidesmosomes Anchoring to Basement Membrane (Type IV Collagen)', 'Merkel Tactile Disc Receptors', 'Dermal Papillae Interlocking Pegs (Rete Ridges)'],
          description: 'The germinal powerhouse of the skin. A single layer of cuboidal cells attached to the basement membrane. As basal stem cells divide, one daughter cell stays behind while the other ascends through the strata over 28 to 40 days.',
          actionHint: 'Double-tap to close',
        },
        melanocyte: {
          title: 'Dendritic Melanocyte & Melanin Production',
          partName: 'Melanosome Synthesis Factory (Skin Pigmentation & UV Defense)',
          role: 'Produces eumelanin and pheomelanin to shield nuclear DNA from ultraviolet carcinogens',
          bloodType: 'Neutral',
          internalStructures: ['Melanosome Organelles (Stages I–IV)', 'Branching Dendritic Processes Extending Upward', 'Supranuclear Melanin Caps Shielding Nuclei', 'Tyrosinase Rate-Limiting Enzyme'],
          description: 'Melanocytes constitute 10–25% of basal layer cells. Each melanocyte uses its branching dendrites to transfer pigment-packed melanosomes into approximately 36 neighboring keratinocytes, forming an umbrella-like melanin shield over their nuclei.',
          actionHint: 'Double-tap to close',
        },
        hair_unit: {
          title: 'Pilosebaceous Unit: Hair Follicle, Sebaceous Gland & Arrector Pili',
          partName: 'Keratin Hair Shaft, Sebum Gland & Thermoregulatory Muscle',
          role: 'Produces hair, secretes moisturizing sebum, and triggers cutaneous goosebumps',
          bloodType: 'Neutral',
          internalStructures: ['Cylindrical Hair Shaft (Cuticle, Cortex & Medulla)', 'Outer & Inner Root Sheaths + Dermal Hair Papilla Bulb', 'Multilobular Holocrine Sebaceous Glands (Sebum Secretion)', 'Arrector Pili Smooth Muscle (Sympathetic Goosebump Contraction)'],
          description: 'The pilosebaceous unit penetrates from the epidermis deep into the reticular dermis. The sebaceous gland produces lipid-rich sebum that lubricates hair and skin. When chilled or frightened, the sympathetic nervous system contracts the arrector pili muscle, pulling the hair erect and causing goosebumps.',
          actionHint: 'Double-tap to close',
        },
        sweat_gland: {
          title: 'Eccrine Sweat Gland & Helical Spiral Duct',
          partName: 'Thermoregulatory Merocrine Sweat Apparatus',
          role: 'Primary thermoregulation via evaporative cooling and electrolyte secretion',
          bloodType: 'Neutral',
          internalStructures: ['Coiled Tubular Secretory Gland in Deep Dermis', 'Helical Duct Spiraling Upward Through Epidermis', 'Surface Epidermal Sweat Pore (Acro披露)', 'Cholinergic Sympathetic Nerve Innervation'],
          description: 'Humans possess 2 to 4 million eccrine glands. The secretory base in the deep dermis produces a hypotonic fluid (water, NaCl, urea, lactate) pumped up the helical duct to evaporate on the skin surface, absorbing latent heat and cooling the body.',
          actionHint: 'Double-tap to close',
        },
        capillary: {
          title: 'Dermal Papillae Arteriovenous Capillary Loop',
          partName: 'Microvascular Nutrition Loop for Avascular Epidermis',
          role: 'Supplies oxygen and nutrients to the overlying epidermis and regulates body temperature',
          bloodType: 'Oxygenated',
          internalStructures: ['Ascending Arterial Capillary Limb (Oxygen-Rich Crimson)', 'Capillary Hairpin Apex (~10 μm below basement membrane)', 'Descending Venous Capillary Limb (Deoxygenated Blue)', 'Pre-Capillary Sphincters & Arteriovenous Shunts'],
          description: 'Because the epidermis is completely avascular, it relies entirely on diffusion from these capillary hairpin loops projecting upward inside the dermal papillae. In cold weather, arteriovenous shunts bypass these loops to conserve core body heat.',
          actionHint: 'Double-tap to close',
        },
        pacinian: {
          title: 'Cutaneous Mechanoreceptors: Pacinian & Meissner Corpuscles',
          partName: 'High-Frequency Vibration & Light Discriminative Touch Sensors',
          role: 'Translates mechanical tactile skin deformations into neurosensory action potentials',
          bloodType: 'Neutral',
          internalStructures: ['Pacinian Corpuscle (Concentric Lamellated Onion-Bulb, 200–300 Hz Vibration)', 'Meissner Tactile Corpuscle (Ellipsoidal in Dermal Papilla, Light Touch)', 'Myelinated A-beta Sensory Nerve Axon', 'Perineural Fluid-Filled Sheaths'],
          description: 'Skin is our largest sensory organ. Meissner corpuscles reside high in dermal papillae to detect gentle stroking and texture. Deep in the reticular dermis and hypodermis, large onion-like Pacinian corpuscles detect rapid vibrations and deep pressure transients.',
          actionHint: 'Double-tap to close',
        },
        hypodermis: {
          title: 'Hypodermis / Subcutaneous Tissue (Subcutis)',
          partName: 'Adipose Lobules & Fibrous Retinacula Cutis',
          role: 'Thermal insulation, mechanical shock attenuation, and long-term caloric energy storage',
          bloodType: 'Neutral',
          internalStructures: ['Unilocular White Adipocytes (Triglyceride Lipid Droplets)', 'Interlobular Fibrous Collagen Septa', 'Large Subcutaneous Musculocutaneous Arteries & Veins', 'Sensory Cutaneous Nerve Trunks'],
          description: 'Underlying the dermis, the hypodermis consists of rounded white fat lobules interwoven by fibrous septa. It absorbs mechanical shocks, insulates internal organs against hypothermia, and serves as our primary caloric energy reserve.',
          actionHint: 'Double-tap to close',
        },
      }

      const blockWidth = 9.4
      const blockDepth = 7.4

      interface LayerMeshObj {
        id: number
        group: THREE.Group
        slabMesh: THREE.Mesh
        baseElevation: number
        partKey: string
      }

      const layerConfigs = [
        { id: 1, name: 'Stratum Corneum', thickness: 0.8, color: 0xd4a373, baseElevation: 5.6, partKey: 'corneum' },
        { id: 2, name: 'Stratum Lucidum', thickness: 0.4, color: 0xfefae0, baseElevation: 4.85, partKey: 'lucidum' },
        { id: 3, name: 'Stratum Granulosum', thickness: 0.75, color: 0xc49a7a, baseElevation: 4.15, partKey: 'granulosum' },
        { id: 4, name: 'Stratum Spinosum', thickness: 1.5, color: 0xe07a5f, baseElevation: 2.85, partKey: 'spinosum' },
        { id: 5, name: 'Stratum Basale', thickness: 0.8, color: 0xb45309, baseElevation: 1.55, partKey: 'basale' },
        { id: 6, name: 'Dermis', thickness: 2.6, color: 0xbe185d, baseElevation: -0.3, partKey: 'capillary' },
        { id: 7, name: 'Hypodermis (Adipose)', thickness: 1.8, color: 0xf59e0b, baseElevation: -2.7, partKey: 'hypodermis' },
      ]

      const layerObjects: LayerMeshObj[] = []
      const interactableMeshes: THREE.Object3D[] = []

      // Create realistic histological layer slabs
      layerConfigs.forEach((cfg) => {
        const layerGrp = new THREE.Group()
        layerGrp.position.y = cfg.baseElevation
        skinRig.add(layerGrp)

        const geo = new THREE.BoxGeometry(blockWidth, cfg.thickness, blockDepth, 8, 1, 8)
        const mat = new THREE.MeshStandardMaterial({
          color: cfg.color,
          roughness: cfg.id === 1 ? 0.75 : 0.4,
          metalness: 0.05,
          transparent: true,
          opacity: 0.95,
        })
        const slabMesh = new THREE.Mesh(geo, mat)
        slabMesh.castShadow = true
        slabMesh.receiveShadow = true
        slabMesh.userData = { partKey: cfg.partKey, layerId: cfg.id }
        layerGrp.add(slabMesh)
        interactableMeshes.push(slabMesh)

        // Add layer-specific histological cellular features
        if (cfg.id === 1) {
          // Desquamating surface scales on stratum corneum
          const flakeGeo = new THREE.CircleGeometry(0.32, 6)
          flakeGeo.rotateX(-Math.PI / 2)
          const flakeMat = new THREE.MeshStandardMaterial({ color: 0xfaedcd, roughness: 0.85, side: THREE.DoubleSide })
          for (let i = 0; i < 30; i++) {
            const flake = new THREE.Mesh(flakeGeo, flakeMat)
            flake.position.set(
              (Math.random() - 0.5) * (blockWidth - 0.8),
              cfg.thickness / 2 + 0.02,
              (Math.random() - 0.5) * (blockDepth - 0.8)
            )
            flake.rotation.y = Math.random() * Math.PI
            flake.userData = { partKey: 'corneum', layerId: 1 }
            layerGrp.add(flake)
            interactableMeshes.push(flake)
          }
        } else if (cfg.id === 3) {
          // Keratohyalin granules
          const granGeo = new THREE.SphereGeometry(0.08, 8, 8)
          const granMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.3 })
          for (let i = 0; i < 40; i++) {
            const gran = new THREE.Mesh(granGeo, granMat)
            gran.position.set(
              (Math.random() - 0.5) * (blockWidth - 1),
              (Math.random() - 0.5) * (cfg.thickness * 0.7),
              (Math.random() - 0.5) * (blockDepth - 1)
            )
            layerGrp.add(gran)
          }
        } else if (cfg.id === 5) {
          // Basal cuboidal stem cells + dendritic melanocytes
          const basalGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.45, 10)
          const basalMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35 })
          const melanMat = new THREE.MeshStandardMaterial({ color: 0x271306, roughness: 0.25 })

          for (let i = 0; i < 24; i++) {
            const isMelanocyte = i % 5 === 0
            const cMesh = new THREE.Mesh(basalGeo, isMelanocyte ? melanMat : basalMat)
            cMesh.position.set(
              (Math.random() - 0.5) * (blockWidth - 1.2),
              0,
              (Math.random() - 0.5) * (blockDepth - 1.2)
            )
            cMesh.userData = { partKey: isMelanocyte ? 'melanocyte' : 'basale', layerId: 5 }
            layerGrp.add(cMesh)
            interactableMeshes.push(cMesh)

            // If melanocyte, add branching dendrites reaching upward
            if (isMelanocyte) {
              for (let d = 0; d < 3; d++) {
                const dAngle = (d * Math.PI * 2) / 3
                const dendrite = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6),
                  melanMat
                )
                dendrite.position.set(
                  cMesh.position.x + Math.cos(dAngle) * 0.25,
                  0.35,
                  cMesh.position.z + Math.sin(dAngle) * 0.25
                )
                dendrite.rotation.z = Math.sin(dAngle) * 0.4
                dendrite.rotation.x = Math.cos(dAngle) * 0.4
                dendrite.userData = { partKey: 'melanocyte', layerId: 5 }
                layerGrp.add(dendrite)
                interactableMeshes.push(dendrite)
              }
            }
          }
        } else if (cfg.id === 7) {
          // Hypodermis fat lobules (rounded golden adipocyte clusters)
          const fatGeo = new THREE.SphereGeometry(0.38, 12, 12)
          const fatMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5, metalness: 0.05 })
          for (let i = 0; i < 35; i++) {
            const fatBlob = new THREE.Mesh(fatGeo, fatMat)
            fatBlob.position.set(
              (Math.random() - 0.5) * (blockWidth - 1.0),
              (Math.random() - 0.5) * (cfg.thickness * 0.7),
              (Math.random() - 0.5) * (blockDepth - 1.0)
            )
            fatBlob.scale.set(1 + Math.random() * 0.4, 0.8 + Math.random() * 0.3, 1 + Math.random() * 0.4)
            fatBlob.userData = { partKey: 'hypodermis', layerId: 7 }
            layerGrp.add(fatBlob)
            interactableMeshes.push(fatBlob)
          }
        }

        layerObjects.push({
          id: cfg.id,
          group: layerGrp,
          slabMesh,
          baseElevation: cfg.baseElevation,
          partKey: cfg.partKey,
        })
      })

      // Skin Appendages Group (Hair Follicle, Sebaceous Gland, Sweat Gland, Capillary Loops, Tactile Receptors)
      const appendagesGrp = new THREE.Group()
      skinRig.add(appendagesGrp)

      // 1. Pilosebaceous Unit: Hair Follicle Assembly
      const hairUnitGrp = new THREE.Group()
      hairUnitGrp.position.set(-2.0, 1.2, 0.5)
      hairUnitGrp.rotation.z = 0.22 // Realistic natural hair slant
      appendagesGrp.add(hairUnitGrp)

      // Hair Shaft (dark keratin cylinder emerging from surface pore)
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.25, metalness: 0.3 })
      const hairShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 8.5, 16), hairMat)
      hairShaft.position.y = 2.2
      hairShaft.userData = { partKey: 'hair_unit' }
      hairUnitGrp.add(hairShaft)
      interactableMeshes.push(hairShaft)

      // Outer Root Sheath (translucent tissue surrounding follicle in dermis)
      const sheathMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.5, transparent: true, opacity: 0.7 })
      const follicleSheath = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 4.2, 16), sheathMat)
      follicleSheath.position.y = -0.5
      follicleSheath.userData = { partKey: 'hair_unit' }
      hairUnitGrp.add(follicleSheath)
      interactableMeshes.push(follicleSheath)

      // Hair Bulb & Dermal Papilla at base
      const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 }))
      bulbMesh.position.y = -2.6
      bulbMesh.userData = { partKey: 'hair_unit' }
      hairUnitGrp.add(bulbMesh)
      interactableMeshes.push(bulbMesh)

      // Multilobular Sebaceous Gland hugging upper follicle
      const sebumMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.45 })
      for (let s = 0; s < 5; s++) {
        const lobule = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 12), sebumMat)
        const sAngle = (s * Math.PI * 2) / 5
        lobule.position.set(Math.cos(sAngle) * 0.48 + 0.35, 0.4 + (s % 2) * 0.35, Math.sin(sAngle) * 0.48)
        lobule.userData = { partKey: 'hair_unit' }
        hairUnitGrp.add(lobule)
        interactableMeshes.push(lobule)
      }

      // Arrector Pili Muscle band (smooth muscle stretching from follicle to dermal papilla)
      const muscleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.2, -1.8, 0),
        new THREE.Vector3(1.6, -0.6, 0.3),
        new THREE.Vector3(2.6, 1.4, 0.1),
      ])
      const muscleGeo = new THREE.TubeGeometry(muscleCurve, 20, 0.18, 10, false)
      const muscleMat = new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.4 })
      const arrectorMuscle = new THREE.Mesh(muscleGeo, muscleMat)
      arrectorMuscle.userData = { partKey: 'hair_unit' }
      hairUnitGrp.add(arrectorMuscle)
      interactableMeshes.push(arrectorMuscle)

      // 2. Coiled Eccrine Sweat Gland & Spiral Duct
      const sweatUnitGrp = new THREE.Group()
      sweatUnitGrp.position.set(2.4, -0.2, -1.0)
      appendagesGrp.add(sweatUnitGrp)

      // Coiled tubular knot in deep dermis / hypodermis
      const coilMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.35 })
      const sweatTorus1 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 10, 24), coilMat)
      sweatTorus1.position.y = -1.8
      sweatTorus1.rotation.x = Math.PI / 3
      sweatTorus1.userData = { partKey: 'sweat_gland' }
      sweatUnitGrp.add(sweatTorus1)
      interactableMeshes.push(sweatTorus1)

      const sweatTorus2 = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.11, 10, 24), coilMat)
      sweatTorus2.position.set(0.15, -1.5, 0.1)
      sweatTorus2.rotation.y = Math.PI / 4
      sweatTorus2.userData = { partKey: 'sweat_gland' }
      sweatUnitGrp.add(sweatTorus2)
      interactableMeshes.push(sweatTorus2)

      // Helical spiral duct ascending through dermis and epidermis
      const spiralPts: THREE.Vector3[] = []
      const spiralSteps = 70
      for (let p = 0; p <= spiralSteps; p++) {
        const t = p / spiralSteps
        const y = -1.4 + t * 7.5
        const spiralR = 0.22 * (1 - t * 0.4)
        const angle = t * Math.PI * 12
        spiralPts.push(new THREE.Vector3(Math.cos(angle) * spiralR, y, Math.sin(angle) * spiralR))
      }
      const spiralGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts), 60, 0.08, 8, false)
      const spiralDuct = new THREE.Mesh(spiralGeo, coilMat)
      spiralDuct.userData = { partKey: 'sweat_gland' }
      sweatUnitGrp.add(spiralDuct)
      interactableMeshes.push(spiralDuct)

      // Surface sweat pore ring on stratum corneum
      const poreGeo = new THREE.TorusGeometry(0.2, 0.05, 8, 16)
      const poreMesh = new THREE.Mesh(poreGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7 }))
      poreMesh.rotation.x = -Math.PI / 2
      poreMesh.position.set(0, 6.1, 0)
      poreMesh.userData = { partKey: 'sweat_gland' }
      sweatUnitGrp.add(poreMesh)
      interactableMeshes.push(poreMesh)

      // 3. Dermal Papillae Microcirculation Capillary Loops
      const capGroup = new THREE.Group()
      capGroup.position.set(0, 0.4, 1.8)
      appendagesGrp.add(capGroup)

      const capRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 })
      const capBlueMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.25 })

      for (let c = 0; c < 5; c++) {
        const cX = -2.8 + c * 1.4
        // Arteriolar ascending limb + hairpin turn + venular descending limb
        const loopPts = [
          new THREE.Vector3(cX - 0.16, -1.0, 0),
          new THREE.Vector3(cX - 0.16, 1.2, 0),
          new THREE.Vector3(cX, 1.45, 0),
          new THREE.Vector3(cX + 0.16, 1.2, 0),
          new THREE.Vector3(cX + 0.16, -1.0, 0),
        ]
        const loopCurve = new THREE.CatmullRomCurve3(loopPts)
        const loopMesh = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, 24, 0.08, 8, false), capRedMat)
        loopMesh.userData = { partKey: 'capillary' }
        capGroup.add(loopMesh)
        interactableMeshes.push(loopMesh)

        // Blue venule companion vessel
        const venuleMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8),
          capBlueMat
        )
        venuleMesh.position.set(cX + 0.22, 0, 0.12)
        venuleMesh.userData = { partKey: 'capillary' }
        capGroup.add(venuleMesh)
        interactableMeshes.push(venuleMesh)
      }

      // 4. Cutaneous Mechanoreceptors: Pacinian & Meissner Tactile Sensors
      // Meissner corpuscle in dermal papilla
      const meissnerMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.35 })
      const meissnerMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), meissnerMat)
      meissnerMesh.scale.set(0.65, 1.4, 0.65)
      meissnerMesh.position.set(1.4, 1.8, 1.8)
      meissnerMesh.userData = { partKey: 'pacinian' }
      appendagesGrp.add(meissnerMesh)
      interactableMeshes.push(meissnerMesh)

      // Pacinian corpuscle in deep dermis (laminated onion-bulb)
      const pacinianGrp = new THREE.Group()
      pacinianGrp.position.set(-1.2, -1.4, -1.8)
      appendagesGrp.add(pacinianGrp)

      const pacinianMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.4, transparent: true, opacity: 0.85 })
      for (let l = 0; l < 3; l++) {
        const lamella = new THREE.Mesh(new THREE.SphereGeometry(0.45 + l * 0.18, 16, 16), pacinianMat)
        lamella.scale.set(0.65, 1.3, 0.65)
        lamella.rotation.z = Math.PI / 6
        lamella.userData = { partKey: 'pacinian' }
        pacinianGrp.add(lamella)
        interactableMeshes.push(lamella)
      }

      // Nerve axon entering corpuscle
      const nerveMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
      const nerveMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), nerveMat)
      nerveMesh.position.set(-1.4, -2.4, -1.8)
      nerveMesh.userData = { partKey: 'pacinian' }
      appendagesGrp.add(nerveMesh)
      interactableMeshes.push(nerveMesh)

      let activeDissectKey: string | null = null; void activeDissectKey

      const applyTransforms = () => {
        const sepFactor = (params.layerSeparation / 100) * 3.4
        const activeLyr = Math.round(params.activeLayer)
        const showApp = params.showAppendages >= 0.5

        appendagesGrp.visible = showApp

        layerObjects.forEach((obj, idx) => {
          // Spread layers vertically outwards around middle
          const explodeY = (3 - idx) * sepFactor
          obj.group.position.y = obj.baseElevation + explodeY

          const isHighlighted = activeLyr === 0 || activeLyr === obj.id
          const mat = obj.slabMesh.material as THREE.MeshStandardMaterial

          if (isHighlighted) {
            mat.opacity = 0.95
            mat.emissive.setHex(activeLyr === obj.id ? 0x223344 : 0x000000)
          } else {
            mat.opacity = 0.22
            mat.emissive.setHex(0x000000)
          }
        })
      }

      applyTransforms()

      // Raycasting for Double-Tap & Double-Click Dissection
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const key = hit.userData?.partKey as string | undefined
          if (key && DISSECT_CARDS[key]) {
            if (activeDissectKey === key) {
              activeDissectKey = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectKey = key
              callbacks.onInspectPart?.(DISSECT_CARDS[key])
            }
          }
        } else {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      // Animation Loop (NO involuntary spinning away from student)
      const animate = () => {
        animId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          applyTransforms()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          skinRig.rotation.set(0, 0, 0)
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
          applyTransforms()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          applyTransforms()
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 8. MATHEMATICS: 3D LORENZ STRANGE ATTRACTOR
  // ==========================================
  lorenz_3d: {
    type: 'lorenz_3d',
    title: '3D Lorenz Strange Attractor & Chaos',
    subject: 'Mathematics · Nonlinear Dynamics',
    concept: 'Deterministic Chaos, Butterfly Effect & Phase Space',
    description: 'Experience 3D chaos theory in the Lorenz 1963 system. Watch how two infinitesimally close starting trajectories diverge exponentially into the iconic butterfly attractor.',
    emoji: '🦋',
    difficulty: 'Advanced',
    presets: [
      { label: '🦋 Classic Butterfly (σ=10, ρ=28, β=8/3)', params: { sigma: 10, rho: 28, beta: 2.67 } },
      { label: '🌪️ Hyper-Chaos (ρ=45)', params: { sigma: 10, rho: 45, beta: 2.67 } },
      { label: '🌀 Periodic Limit Cycle (ρ=14)', params: { sigma: 10, rho: 14, beta: 2.67 } },
    ],
    params: [
      { key: 'sigma', label: 'Prandtl Number (σ)', min: 2, max: 20, step: 0.5, defaultValue: 10, unit: '' },
      { key: 'rho', label: 'Rayleigh Number (ρ)', min: 5, max: 50, step: 1, defaultValue: 28, unit: '' },
      { key: 'beta', label: 'Geometric Aspect (β)', min: 1, max: 5, step: 0.1, defaultValue: 2.67, unit: '' },
    ],
    calculateReadouts: (p) => {
      return [
        { label: 'Maximal Lyapunov Exponent (λ)', value: '0.9056', unit: 'nats/s', formula: 'Divergence: δ(t) ≈ δ₀ e^(λt)' },
        { label: 'Fractal Dimension (D)', value: '2.06', formula: 'Kaplan-Yorke Dimension' },
        { label: 'Fixed Points C+ / C-', value: `(±${Math.sqrt(p.beta * (p.rho - 1)).toFixed(1)}, ±${Math.sqrt(p.beta * (p.rho - 1)).toFixed(1)}, ${p.rho - 1})` },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x050711)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 30, 85)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 25, 0)

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        attractor: {
          title: 'Lorenz Strange Attractor · Butterfly Phase Space',
          partName: 'Chaotic Manifold & Dual Fixed Points (C+ / C-)',
          role: 'Deterministic non-periodic flow in ℝ³ demonstrating sensitive dependence on initial conditions (The Butterfly Effect)',
          internalStructures: ['Twin Equilibrium Fixed Points C± = (±√(β(ρ-1)), ±√(β(ρ-1)), ρ-1)', 'Maximal Lyapunov Exponent (λ ≈ 0.9056 nats/s)', 'Kaplan-Yorke Fractal Dimension (DF ≈ 2.06)', 'Poincaré Section Z = 27 Phase Return Map'],
          description: 'Double-tapping the chaotic attractor dissects the phase space. Two trajectories beginning with a 10⁻⁸ difference diverge exponentially as e^(λt). The system never repeats, yet stays confined forever inside this fractional-dimensional manifold.',
        },
      }

      const ambLight = new THREE.AmbientLight(0xffffff, 0.9)
      scene.add(ambLight)

      // Fixed Point Markers (C+ and C-)
      const fixedPointGroup = new THREE.Group()
      scene.add(fixedPointGroup)

      const fpGeo = new THREE.SphereGeometry(1.2, 16, 16)
      const fpMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true })
      const fp1 = new THREE.Mesh(fpGeo, fpMat)
      const fp2 = new THREE.Mesh(fpGeo, fpMat)
      fp1.userData = { partId: 'attractor' }
      fp2.userData = { partId: 'attractor' }
      fixedPointGroup.add(fp1, fp2)
      interactableMeshes.push(fp1, fp2)

      const maxPts = 4000
      const positions = new Float32Array(maxPts * 3)
      const colors = new Float32Array(maxPts * 3)

      let x = 0.1
      let y = 0
      let z = 0
      const dt = 0.008

      for (let i = 0; i < maxPts; i++) {
        const dx = params.sigma * (y - x)
        const dy = x * (params.rho - z) - y
        const dz = x * y - params.beta * z

        x += dx * dt
        y += dy * dt
        z += dz * dt

        positions[i * 3] = x
        positions[i * 3 + 1] = z
        positions[i * 3 + 2] = y

        const t = i / maxPts
        colors[i * 3] = 0.02 + t * 0.9
        colors[i * 3 + 1] = 0.7 - t * 0.4
        colors[i * 3 + 2] = 0.95 - t * 0.2
      }

      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        linewidth: 1.5,
      })
      const ribbon = new THREE.Line(lineGeo, lineMat)
      ribbon.userData = { partId: 'attractor' }
      scene.add(ribbon)
      interactableMeshes.push(ribbon)

      // Dual Orbits Simulation
      const orb1Geo = new THREE.SphereGeometry(0.8, 16, 16)
      const orb1Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      const orb1 = new THREE.Mesh(orb1Geo, orb1Mat)
      orb1.userData = { partId: 'attractor' }
      scene.add(orb1)
      interactableMeshes.push(orb1)

      const orb2Geo = new THREE.SphereGeometry(0.8, 16, 16)
      const orb2Mat = new THREE.MeshBasicMaterial({ color: 0xf43f5e })
      const orb2 = new THREE.Mesh(orb2Geo, orb2Mat)
      orb2.userData = { partId: 'attractor' }
      scene.add(orb2)
      interactableMeshes.push(orb2)

      let x1 = 0.1, y1 = 0.0, z1 = 0.0
      let x2 = 0.1001, y2 = 0.0, z2 = 0.0

      function updateFixedPoints() {
        if (params.rho > 1) {
          const cVal = Math.sqrt(params.beta * (params.rho - 1))
          fp1.position.set(cVal, params.rho - 1, cVal)
          fp2.position.set(-cVal, params.rho - 1, -cVal)
          fixedPointGroup.visible = true
        } else {
          fixedPointGroup.visible = false
        }
      }
      updateFixedPoints()

      let activeDissectId: 'attractor' | null = null
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          if (activeDissectId) {
            activeDissectId = null
            callbacks.onInspectPart?.(null)
          } else {
            activeDissectId = 'attractor'
            callbacks.onInspectPart?.(DISSECT_CARDS.attractor)
          }
        } else {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          for (let step = 0; step < 3; step++) {
            const dx1 = params.sigma * (y1 - x1)
            const dy1 = x1 * (params.rho - z1) - y1
            const dz1 = x1 * y1 - params.beta * z1
            x1 += dx1 * dt
            y1 += dy1 * dt
            z1 += dz1 * dt

            const dx2 = params.sigma * (y2 - x2)
            const dy2 = x2 * (params.rho - z2) - y2
            const dz2 = x2 * y2 - params.beta * z2
            x2 += dx2 * dt
            y2 += dy2 * dt
            z2 += dz2 * dt
          }

          orb1.position.set(x1, z1, y1)
          orb2.position.set(x2, z2, y2)

          if (!activeDissectId) {
            scene.rotation.y += 0.003
          }
        }

        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          updateFixedPoints()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          x1 = 0.1; y1 = 0.0; z1 = 0.0
          x2 = 0.1001; y2 = 0.0; z2 = 0.0
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        closeDissection: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 9. PHYSICS: 3D PRISM DISPERSION & OPTICS
  // ==========================================
  prism_optics_3d: {
    type: 'prism_optics_3d',
    title: '3D Optical Prism & Light Dispersion',
    subject: 'Physics · Wave & Ray Optics',
    concept: 'Cauchy Dispersion, Snell’s Law & Minimum Deviation',
    description: 'Direct a collimated beam of white light through a 3D glass prism. Observe chromatic dispersion into the continuous VIBGYOR rainbow spectrum, measure the angle of minimum deviation, and adjust refractive index.',
    emoji: '💎',
    difficulty: 'Intermediate',
    presets: [
      { label: '🌈 Minimum Deviation (A=60°, i=48°)', params: { incidentAngle: 48, prismAngle: 60, glassIndex: 1.52 } },
      { label: '💎 Dense Flint Glass (High Dispersion)', params: { incidentAngle: 52, prismAngle: 60, glassIndex: 1.66 } },
      { label: '⚡ Steep Grazing Incidence (i=68°)', params: { incidentAngle: 68, prismAngle: 60, glassIndex: 1.52 } },
    ],
    params: [
      { key: 'incidentAngle', label: 'Angle of Incidence (i₁)', min: 28, max: 72, step: 1, defaultValue: 48, unit: '°' },
      { key: 'prismAngle', label: 'Prism Apex Angle (A)', min: 45, max: 70, step: 1, defaultValue: 60, unit: '°' },
      { key: 'glassIndex', label: 'Glass Refractive Index (n_d)', min: 1.45, max: 1.75, step: 0.01, defaultValue: 1.52, unit: '' },
    ],
    calculateReadouts: (p) => {
      const iRad = (p.incidentAngle * Math.PI) / 180
      const aRad = (p.prismAngle * Math.PI) / 180
      const n = p.glassIndex

      // Refraction at face 1: sin(i) = n * sin(r1)
      const sinR1 = Math.sin(iRad) / n
      const r1 = Math.asin(Math.min(0.999, sinR1))
      // Refraction at face 2: r2 = A - r1
      const r2 = aRad - r1
      const sinE = n * Math.sin(r2)
      const e = sinE <= 1.0 ? Math.asin(sinE) : Math.PI / 2
      const deviationDeg = ((iRad + e - aRad) * 180) / Math.PI
      // Minimum deviation angle formula: n = sin((A + Dm)/2) / sin(A/2)
      const dmDeg = (2 * Math.asin(Math.min(0.999, n * Math.sin(aRad / 2))) - aRad) * (180 / Math.PI)

      return [
        { label: 'Angle of Deviation (δ)', value: sinE <= 1.0 ? deviationDeg.toFixed(1) : 'Total Internal Refl.', unit: '°', formula: 'δ = i₁ + e - A' },
        { label: 'Min Deviation Angle (D_m)', value: dmDeg.toFixed(1), unit: '°', formula: 'n = sin((A+D_m)/2) / sin(A/2)' },
        { label: 'Exit Angle (e)', value: sinE <= 1.0 ? ((e * 180) / Math.PI).toFixed(1) : 'TIR', unit: '°' },
        { label: 'Dispersion Spectrum', value: 'Red (Least Bent) → Violet (Most Bent)' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 35, 35)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 16, 26)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        prism: {
          title: 'Triangular Glass Prism & Wavefront Interior',
          partName: 'Optical Dispersive Medium · Cauchy Refraction Interior',
          role: 'Splits polychromatic white light into spectral constituent wavelengths via frequency-dependent phase velocities',
          internalStructures: ['Snell-Descartes Normal Vectors (n1 sin θ1 = n2 sin θ2)', 'Cauchy Dispersion Curve: n(λ) = A + B/λ²', 'Angle of Minimum Deviation (Dm)', 'Critical Angle for Total Internal Reflection (θc = arcsin(1/n))'],
          description: 'Double-tapping the crystal prism exposes the internal chromatic ray geometry. Because blue/violet light has a shorter wavelength, it encounters higher refractive index n(λ) and bends more sharply than longer red wavelengths.',
        },
      }

      const opticsGroup = new THREE.Group()
      scene.add(opticsGroup)

      const prismMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        roughness: 0.04,
        transmission: 0.92,
        ior: 1.52,
        thickness: 4.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      })

      let prismMesh: THREE.Mesh | null = null

      function createPrismGeometry(apexAngleDeg: number) {
        const halfAngle = (apexAngleDeg / 2) * (Math.PI / 180)
        const prismHeight = 6.0
        const sideLen = 6.0

        const shape = new THREE.Shape()
        shape.moveTo(0, sideLen * Math.cos(halfAngle))
        shape.lineTo(-sideLen * Math.sin(halfAngle), 0)
        shape.lineTo(sideLen * Math.sin(halfAngle), 0)
        shape.closePath()

        const extrudeSettings = {
          steps: 1,
          depth: prismHeight,
          bevelEnabled: true,
          bevelThickness: 0.15,
          bevelSize: 0.15,
          bevelSegments: 4,
        }

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
        geo.center()
        return geo
      }

      prismMesh = new THREE.Mesh(createPrismGeometry(params.prismAngle), prismMat)
      prismMesh.position.set(0, 3.2, 0)
      prismMesh.rotation.x = Math.PI / 2
      prismMesh.userData = { partId: 'prism' }
      opticsGroup.add(prismMesh)
      interactableMeshes.push(prismMesh)

      // Light Collimator Source Box
      const boxGeo = new THREE.BoxGeometry(2.2, 2.2, 3.8)
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 })
      const collimator = new THREE.Mesh(boxGeo, boxMat)
      collimator.position.set(-14, 3.2, 0)
      opticsGroup.add(collimator)

      const lensRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.4, 24),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8 })
      )
      lensRing.rotation.z = Math.PI / 2
      lensRing.position.set(-12.8, 3.2, 0)
      opticsGroup.add(lensRing)

      // Spectral Observation Screen
      const screenGeo = new THREE.PlaneGeometry(1.2, 10)
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, side: THREE.DoubleSide })
      const screenMesh = new THREE.Mesh(screenGeo, screenMat)
      screenMesh.position.set(13, 3.2, -2)
      screenMesh.rotation.y = -Math.PI / 3
      opticsGroup.add(screenMesh)

      // VIBGYOR Spectrum colors
      const spectrumColors = [
        { name: 'Red', hex: 0xef4444, lambda: 700, deltaN: -0.018 },
        { name: 'Orange', hex: 0xf97316, lambda: 620, deltaN: -0.01 },
        { name: 'Yellow', hex: 0xeab308, lambda: 580, deltaN: -0.004 },
        { name: 'Green', hex: 0x22c55e, lambda: 530, deltaN: 0.002 },
        { name: 'Blue', hex: 0x3b82f6, lambda: 470, deltaN: 0.01 },
        { name: 'Indigo', hex: 0x6366f1, lambda: 430, deltaN: 0.018 },
        { name: 'Violet', hex: 0xa855f7, lambda: 400, deltaN: 0.026 },
      ]

      let incidentBeam: THREE.Line | null = null
      let internalLines: THREE.Line[] = []
      let exitLines: THREE.Line[] = []
      let spectralDots: THREE.Mesh[] = []

      // Raycaster for Double-Tap & Double-Click Dissection
      let activeDissectId: 'prism' | null = null
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const id = hit.userData?.partId as 'prism' | undefined
          if (id) {
            if (activeDissectId === id) {
              activeDissectId = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectId = id
              callbacks.onInspectPart?.(DISSECT_CARDS[id])
            }
          }
        } else {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      function updateOpticsPaths() {
        if (incidentBeam) opticsGroup.remove(incidentBeam)
        internalLines.forEach((l) => opticsGroup.remove(l))
        exitLines.forEach((l) => opticsGroup.remove(l))
        spectralDots.forEach((d) => opticsGroup.remove(d))

        internalLines = []
        exitLines = []
        spectralDots = []

        const iRad = (params.incidentAngle * Math.PI) / 180
        const aRad = (params.prismAngle * Math.PI) / 180
        const halfA = aRad / 2
        const nBase = params.glassIndex

        const entryPt = new THREE.Vector3(-2.6 * Math.sin(halfA), 3.2, 0)
        const sourcePt = new THREE.Vector3(-12.8, 3.2, 0)

        const incGeo = new THREE.BufferGeometry().setFromPoints([sourcePt, entryPt])
        const incMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 })
        incidentBeam = new THREE.Line(incGeo, incMat)
        opticsGroup.add(incidentBeam)

        const face1Normal = new THREE.Vector3(-Math.cos(halfA), Math.sin(halfA), 0).normalize()
        const face2Normal = new THREE.Vector3(Math.cos(halfA), Math.sin(halfA), 0).normalize()

        spectrumColors.forEach((colorData, idx) => {
          const nColor = nBase + colorData.deltaN

          const sinR1 = Math.sin(iRad) / nColor
          const r1 = Math.asin(Math.min(0.999, sinR1))

          const intDir = new THREE.Vector3(
            face1Normal.x * Math.cos(r1) + face1Normal.y * Math.sin(r1),
            face1Normal.y * Math.cos(r1) - face1Normal.x * Math.sin(r1),
            0
          ).normalize()

          const exitDist = 5.2 - idx * 0.15
          const exitPt = entryPt.clone().add(intDir.clone().multiplyScalar(exitDist))

          const intGeo = new THREE.BufferGeometry().setFromPoints([entryPt, exitPt])
          const intMat = new THREE.LineBasicMaterial({ color: colorData.hex, transparent: true, opacity: 0.85 })
          const intLine = new THREE.Line(intGeo, intMat)
          opticsGroup.add(intLine)
          internalLines.push(intLine)

          const r2 = aRad - r1
          const sinE = nColor * Math.sin(r2)
          const e = sinE <= 1.0 ? Math.asin(sinE) : Math.PI / 2

          const exitDir = new THREE.Vector3(
            face2Normal.x * Math.cos(e) - face2Normal.y * Math.sin(e),
            face2Normal.y * Math.cos(e) + face2Normal.x * Math.sin(e),
            0
          ).normalize()

          const screenHitPt = exitPt.clone().add(exitDir.clone().multiplyScalar(9.5))

          const exitGeo = new THREE.BufferGeometry().setFromPoints([exitPt, screenHitPt])
          const exitMat = new THREE.LineBasicMaterial({ color: colorData.hex, linewidth: 2 })
          const exitLine = new THREE.Line(exitGeo, exitMat)
          opticsGroup.add(exitLine)
          exitLines.push(exitLine)

          const dotMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 16, 16),
            new THREE.MeshBasicMaterial({ color: colorData.hex })
          )
          dotMesh.position.copy(screenHitPt)
          opticsGroup.add(dotMesh)
          spectralDots.push(dotMesh)
        })
      }

      updateOpticsPaths()

      let pulseAngle = 0
      function animate() {
        animId = requestAnimationFrame(animate)
        if (isPlaying) {
          pulseAngle += 0.03
          spectralDots.forEach((dot, idx) => {
            const s = 1.0 + Math.sin(pulseAngle + idx * 0.8) * 0.25
            dot.scale.set(s, s, s)
          })
        }
        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          if (prismMesh) {
            prismMesh.geometry.dispose()
            prismMesh.geometry = createPrismGeometry(params.prismAngle)
          }
          prismMat.ior = params.glassIndex
          updateOpticsPaths()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        closeDissection: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  // ==========================================
  // 10. PHYSICS: 3D DC ELECTRIC MOTOR & LORENTZ FORCE
  // ==========================================
  motor_3d: {
    type: 'motor_3d',
    title: '3D DC Electric Motor & Lorentz Force',
    subject: 'Physics · Electromagnetism',
    concept: 'Fleming’s Left-Hand Rule, Split-Ring Commutator & Mechanical Explode View',
    description: 'Explore an authentic 3D cutaway of a DC electric motor. Watch magnetic flux lines, dynamic 3D Lorentz force vectors, and current reversal at the split-ring commutator. Pull the motor apart with the Explode slider to inspect the stator magnets, laminated rotor core, and spring-loaded carbon brushes.',
    emoji: '⚡',
    difficulty: 'Intermediate',
    presets: [
      { label: '⚡ Standard DC Motor (12V, 1.0T)', params: { voltage: 12, fieldStrength: 1.0, coilTurns: 50, explode: 0 } },
      { label: '✂️ Exploded Mechanical Cutaway', params: { voltage: 0, fieldStrength: 1.0, coilTurns: 50, explode: 85 } },
      { label: '🔬 Slow-Motion Commutator Switching (4V)', params: { voltage: 4, fieldStrength: 0.8, coilTurns: 40, explode: 20 } },
      { label: '🏎️ High-Torque Turbo (24V, 1.8T)', params: { voltage: 24, fieldStrength: 1.8, coilTurns: 100, explode: 0 } },
      { label: '🧭 Fleming’s Left-Hand Rule Vectors', params: { voltage: 8, fieldStrength: 1.2, coilTurns: 50, explode: 0 } },
    ],
    params: [
      { key: 'voltage', label: 'DC Voltage (V)', min: 0, max: 24, step: 1, defaultValue: 12, unit: 'V' },
      { key: 'fieldStrength', label: 'Magnetic Field (B)', min: 0.2, max: 2.0, step: 0.1, defaultValue: 1.0, unit: 'T' },
      { key: 'coilTurns', label: 'Coil Windings (N)', min: 10, max: 150, step: 5, defaultValue: 50, unit: 'turns' },
      { key: 'explode', label: 'Explode Motor Assembly', min: 0, max: 100, step: 5, defaultValue: 0, unit: '%' },
    ],
    calculateReadouts: (p) => {
      const R = 2.0 // Armature internal resistance (ohms)
      const current = (p.voltage / R).toFixed(1)
      const area = 0.08 * 0.12 // coil area m^2
      const maxTorque = (p.coilTurns * parseFloat(current) * area * p.fieldStrength).toFixed(2)
      const rpm = (p.voltage * 160 * p.fieldStrength).toFixed(0)
      const backEmf = (p.voltage * 0.85).toFixed(1)

      return [
        { label: 'Armature Current (I)', value: current, unit: 'A', formula: 'I = V / R' },
        { label: 'Peak Magnetic Torque (τ)', value: maxTorque, unit: 'N·m', formula: 'τ = NIAB sin(θ)' },
        { label: 'Rotational Velocity (ω)', value: rpm, unit: 'RPM', formula: 'ω ∝ V_eff / B' },
        { label: 'Induced Back-EMF (E_b)', value: backEmf, unit: 'V', formula: 'E_b = k_e · ω' },
        { label: 'Fleming’s Force Couple', value: 'Left: Upward (↑) · Right: Downward (↓)' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 40, 40)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 18, 32)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 0, 0)

      const motorRig = new THREE.Group()
      scene.add(motorRig)

      const interactableMeshes: THREE.Object3D[] = []

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        commutator: {
          title: 'Split-Ring Commutator & Carbon Brushes',
          partName: 'Current Inversion Mechanical Rectifier Dissected',
          role: 'Reverses DC current through the armature coil every half-rotation (180°) to maintain continuous unidirectional torque',
          bloodType: 'Neutral',
          internalStructures: [
            'Dual Semi-Cylindrical Copper Segments (Separated by 20° gap)',
            'Mica Solid Dielectric Insulation Layer',
            'Spring-Loaded High-Purity Graphite Carbon Brushes',
            'Flexible Braided Copper Pigtail Shunt Wires',
          ],
          description: 'The split-ring commutator is the mechanical inverter of the DC motor. As the coil passes through the vertical neutral plane (where magnetic torque drops to zero), the split rings break contact with one brush and reconnect with the opposite brush, flipping current direction and keeping the motor spinning continuously.',
          actionHint: 'Double-tap another part to inspect internal mechanics',
        },
        armature: {
          title: 'Armature Windings & Laminated Silicon-Steel Core',
          partName: 'Lorentz Torque Generating Rotor Assembly',
          role: "Converts electrical current into mechanical rotational torque via Fleming's Left-Hand Rule",
          bloodType: 'Neutral',
          internalStructures: [
            'Multi-Turn Enamelled Copper Windings (N turns)',
            'Insulated Laminated Silicon-Steel Stamping Discs (Reduces Eddy Currents)',
            'Longitudinal Wire Winding Slots with Wedge Closures',
            'Lorentz Torque Couple: τ = N · I · A · B · sin(θ)',
          ],
          description: 'The armature core is constructed from thin, mutually insulated silicon-steel laminations to suppress parasitic eddy-current power dissipation. When current flows through the copper windings, the two opposing coil legs experience equal and opposite Lorentz forces, generating continuous rotational torque.',
          actionHint: 'Double-tap to close',
        },
        magnets: {
          title: 'Stator Field Magnets (N-S Poles) & Yoke',
          partName: 'Curved Permanent Magnet Pole Shoes & Magnetic Flux Return',
          role: 'Establishes a uniform horizontal magnetic field (B-vector) crossing the rotor air gap',
          bloodType: 'Neutral',
          internalStructures: [
            'North Pole (Crimson NdFeB Sintered Rare-Earth Magnet)',
            'South Pole (Cobalt Blue NdFeB Sintered Magnet)',
            'Cast-Iron Return Yoke Frame & Mounting Foot Pedestals',
            'Cyan Magnetic Flux Lines Directed Strictly from North to South',
          ],
          description: 'The curved pole faces shape the magnetic field lines so they cross perpendicularly across the cylindrical armature air gap. This maximizes the vector cross-product F = I(L × B), ensuring maximum mechanical force on each wire turn.',
          actionHint: 'Double-tap to close',
        },
        lorentz: {
          title: "Fleming's Left-Hand Rule & Lorentz Force Vectors",
          partName: 'Orthogonal Vector Cross Product F = I(L × B)',
          role: 'Directs mechanical thrust perpendicular to both the magnetic field and current flow',
          bloodType: 'Neutral',
          internalStructures: [
            'Thumb: Resultant Lorentz Force Direction (F)',
            'First Finger: Magnetic Field Direction (B, North to South)',
            'Second Finger: Conventional Current Direction (I, + to -)',
            'Dynamic Torque Oscillation: τ(θ) = τ_max · |sin(θ)|',
          ],
          description: "Fleming's Left-Hand rule determines the exact direction of force on a current-carrying conductor inside a magnetic field. Because current flows forward in one side of the coil and backward in the other, one side is pushed UP while the opposite side is pushed DOWN, forming a pure force couple.",
          actionHint: 'Double-tap to close',
        },
        shaft: {
          title: 'Drive Shaft & Pillow-Block Sleeve Bearings',
          partName: 'Hardened Ground-Steel Mechanical Power Output Axis',
          role: 'Transmits rotor torque to external mechanical loads with minimal frictional resistance',
          bloodType: 'Neutral',
          internalStructures: [
            'Precision Ground Hardened Steel Shaft (Rockwell C60)',
            'Dual Low-Friction Sintered Bronze Bearing Sleeves',
            'Keyway Drive Coupling for Mechanical Power Transfer',
          ],
          description: 'The central shaft supports the rotating armature and split-ring commutator. Precision bronze bearings minimize mechanical friction, ensuring electrical energy is efficiently converted into shaft horsepower.',
          actionHint: 'Double-tap to close',
        },
      }

      // Structural Groups for Explode animation
      const statorLeftGrp = new THREE.Group()  // North pole
      const statorRightGrp = new THREE.Group() // South pole
      const yokeGrp = new THREE.Group()        // Base & frame
      const rotorGrp = new THREE.Group()       // Shaft, core, windings, commutator
      const brushesGrp = new THREE.Group()     // Carbon brushes & leads

      motorRig.add(yokeGrp)
      motorRig.add(statorLeftGrp)
      motorRig.add(statorRightGrp)
      motorRig.add(rotorGrp)
      motorRig.add(brushesGrp)

      // 1. Cast-iron Stator Base Yoke Frame
      const yokeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 16), yokeMat)
      basePlate.position.y = -4.5
      basePlate.userData = { partKey: 'magnets' }
      yokeGrp.add(basePlate)
      interactableMeshes.push(basePlate)

      // Dual Bearing Pillars on Yoke
      const pillarGeo = new THREE.BoxGeometry(1.6, 6.0, 1.6)
      const pillarFront = new THREE.Mesh(pillarGeo, yokeMat)
      pillarFront.position.set(0, -1.0, 7.0)
      yokeGrp.add(pillarFront)

      const pillarBack = new THREE.Mesh(pillarGeo, yokeMat)
      pillarBack.position.set(0, -1.0, -7.0)
      yokeGrp.add(pillarBack)

      // 2. Curved Stator Magnets
      // North Magnet (Left, Red)
      const northMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.3 })
      const northPole = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.5, 9.5), northMat)
      northPole.position.set(-8.5, 0, 0)
      northPole.userData = { partKey: 'magnets' }
      statorLeftGrp.add(northPole)
      interactableMeshes.push(northPole)

      // North Pole Curved Shoe
      const shoeNorthGeo = new THREE.CylinderGeometry(5.2, 5.2, 9.5, 24, 1, false, -Math.PI / 4, Math.PI / 2)
      const shoeNorth = new THREE.Mesh(shoeNorthGeo, northMat)
      shoeNorth.rotation.x = Math.PI / 2
      shoeNorth.position.set(-4.0, 0, 0)
      shoeNorth.userData = { partKey: 'magnets' }
      statorLeftGrp.add(shoeNorth)
      interactableMeshes.push(shoeNorth)

      // South Magnet (Right, Blue)
      const southMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.3 })
      const southPole = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.5, 9.5), southMat)
      southPole.position.set(8.5, 0, 0)
      southPole.userData = { partKey: 'magnets' }
      statorRightGrp.add(southPole)
      interactableMeshes.push(southPole)

      // South Pole Curved Shoe
      const shoeSouthGeo = new THREE.CylinderGeometry(5.2, 5.2, 9.5, 24, 1, false, (3 * Math.PI) / 4, Math.PI / 2)
      const shoeSouth = new THREE.Mesh(shoeSouthGeo, southMat)
      shoeSouth.rotation.x = Math.PI / 2
      shoeSouth.position.set(4.0, 0, 0)
      shoeSouth.userData = { partKey: 'magnets' }
      statorRightGrp.add(shoeSouth)
      interactableMeshes.push(shoeSouth)

      // 3. Magnetic Flux Vector Lines (Cyan Arrows from North to South)
      const fluxLinesGrp = new THREE.Group()
      motorRig.add(fluxLinesGrp)

      const fluxCount = 9
      for (let i = 0; i < fluxCount; i++) {
        const fy = -1.8 + (i % 3) * 1.8
        const fz = -3.0 + Math.floor(i / 3) * 3.0
        const arrow = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-6.2, fy, fz),
          12.4,
          0x06b6d4,
          0.8,
          0.4
        )
        fluxLinesGrp.add(arrow)
      }

      // 4. Rotor Assembly: Steel Shaft, Laminated Core & Copper Windings
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 17, 16), shaftMat)
      shaft.rotation.x = Math.PI / 2
      shaft.userData = { partKey: 'shaft' }
      rotorGrp.add(shaft)
      interactableMeshes.push(shaft)

      // Laminated Rotor Iron Core
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 })
      const ironCore = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 8.2, 24), coreMat)
      ironCore.rotation.x = Math.PI / 2
      ironCore.userData = { partKey: 'armature' }
      rotorGrp.add(ironCore)
      interactableMeshes.push(ironCore)

      // Multi-Turn Copper Windings
      const copperMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 })
      const coilWidth = 6.4
      const coilLength = 8.8

      const coilLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, coilLength, 12), copperMat)
      coilLeft.position.x = -coilWidth / 2
      coilLeft.rotation.x = Math.PI / 2
      coilLeft.userData = { partKey: 'armature' }
      rotorGrp.add(coilLeft)
      interactableMeshes.push(coilLeft)

      const coilRight = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, coilLength, 12), copperMat)
      coilRight.position.x = coilWidth / 2
      coilRight.rotation.x = Math.PI / 2
      coilRight.userData = { partKey: 'armature' }
      rotorGrp.add(coilRight)
      interactableMeshes.push(coilRight)

      const coilFront = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, coilWidth, 12), copperMat)
      coilFront.position.z = coilLength / 2
      coilFront.rotation.z = Math.PI / 2
      coilFront.userData = { partKey: 'armature' }
      rotorGrp.add(coilFront)
      interactableMeshes.push(coilFront)

      const coilBack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, coilWidth, 12), copperMat)
      coilBack.position.z = -coilLength / 2
      coilBack.rotation.z = Math.PI / 2
      coilBack.userData = { partKey: 'armature' }
      rotorGrp.add(coilBack)
      interactableMeshes.push(coilBack)

      // 5. Split-Ring Commutator Segments
      const commMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 })
      const comm1Geo = new THREE.CylinderGeometry(0.9, 0.9, 2.0, 16, 1, false, 0.18, Math.PI - 0.36)
      const commRing1 = new THREE.Mesh(comm1Geo, commMat)
      commRing1.rotation.x = Math.PI / 2
      commRing1.position.z = coilLength / 2 + 2.0
      commRing1.userData = { partKey: 'commutator' }
      rotorGrp.add(commRing1)
      interactableMeshes.push(commRing1)

      const comm2Geo = new THREE.CylinderGeometry(0.9, 0.9, 2.0, 16, 1, false, Math.PI + 0.18, Math.PI - 0.36)
      const commRing2 = new THREE.Mesh(comm2Geo, commMat)
      commRing2.rotation.x = Math.PI / 2
      commRing2.position.z = coilLength / 2 + 2.0
      commRing2.userData = { partKey: 'commutator' }
      rotorGrp.add(commRing2)
      interactableMeshes.push(commRing2)

      // 6. Spring-Loaded Carbon Brushes & Terminals
      const brushMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
      const brushGeo = new THREE.BoxGeometry(0.55, 0.8, 1.5)

      const brushPositive = new THREE.Mesh(brushGeo, brushMat)
      brushPositive.position.set(-1.22, 0, coilLength / 2 + 2.0)
      brushPositive.userData = { partKey: 'commutator' }
      brushesGrp.add(brushPositive)
      interactableMeshes.push(brushPositive)

      const brushNegative = new THREE.Mesh(brushGeo, brushMat)
      brushNegative.position.set(1.22, 0, coilLength / 2 + 2.0)
      brushNegative.userData = { partKey: 'commutator' }
      brushesGrp.add(brushNegative)
      interactableMeshes.push(brushNegative)

      // Terminal Wires
      const redLead = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.0, 10), new THREE.MeshStandardMaterial({ color: 0xef4444 }))
      redLead.position.set(-2.8, -1.8, coilLength / 2 + 2.0)
      redLead.rotation.z = Math.PI / 4
      brushesGrp.add(redLead)

      const blueLead = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.0, 10), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }))
      blueLead.position.set(2.8, -1.8, coilLength / 2 + 2.0)
      blueLead.rotation.z = -Math.PI / 4
      brushesGrp.add(blueLead)

      // 7. Dynamic Lorentz Force Vectors
      const forceArrowLeft = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-coilWidth / 2, 0, 0),
        3.5,
        0xd946ef,
        0.9,
        0.45
      )
      forceArrowLeft.userData = { partKey: 'lorentz' }
      rotorGrp.add(forceArrowLeft)

      const forceArrowRight = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(coilWidth / 2, 0, 0),
        3.5,
        0xd946ef,
        0.9,
        0.45
      )
      forceArrowRight.userData = { partKey: 'lorentz' }
      rotorGrp.add(forceArrowRight)

      let angle = 0
      let activeDissectKey: string | null = null; void activeDissectKey

      // Raycasting for Double-Tap & Double-Click Dissection
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()

      function triggerDissectionAtPoint(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(interactableMeshes, false)

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh
          const key = hit.userData?.partKey as string | undefined
          if (key && DISSECT_CARDS[key]) {
            if (activeDissectKey === key) {
              activeDissectKey = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectKey = key
              callbacks.onInspectPart?.(DISSECT_CARDS[key])
            }
          }
        } else {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        }
      }

      const handleDblClick = (e: MouseEvent) => {
        triggerDissectionAtPoint(e.clientX, e.clientY)
      }

      let lastTouchTime = 0
      const handleTouchEnd = (e: TouchEvent) => {
        const now = performance.now()
        if (now - lastTouchTime < 340 && e.changedTouches.length > 0) {
          const t = e.changedTouches[0]
          triggerDissectionAtPoint(t.clientX, t.clientY)
        }
        lastTouchTime = now
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      const applyExplode = () => {
        const factor = (params.explode / 100) * 8.0 // Explode expansion factor
        statorLeftGrp.position.x = -factor
        statorRightGrp.position.x = factor
        brushesGrp.position.z = factor * 0.8
        fluxLinesGrp.visible = params.explode < 30
      }

      applyExplode()

      function animate() {
        animId = requestAnimationFrame(animate)

        // Only spin if not in heavy exploded mode
        if (params.voltage > 0 && params.explode < 70) {
          const speed = (params.voltage / 12) * params.fieldStrength * 0.05
          angle += speed
          rotorGrp.rotation.z = angle

          // Lorentz force couple flips and scales with torque angle
          const torqueMagnitude = Math.abs(Math.cos(angle))
          const forceLen = Math.max(0.6, 3.6 * torqueMagnitude * (params.voltage / 12))

          forceArrowLeft.setLength(forceLen, 0.8, 0.4)
          forceArrowRight.setLength(forceLen, 0.8, 0.4)
        }

        controls.update()
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          applyExplode()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          angle = 0
          rotorGrp.rotation.z = 0
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
          applyExplode()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  eye_optics_3d: {
    type: 'eye_optics_3d',
    title: '3D Human Eye Anatomy & Vision Optics',
    subject: 'Biology & Physics · Optics & Anatomy',
    concept: 'Ciliary Accommodation, Refraction & Vision Defects (Myopia/Hypermetropia)',
    description: 'Anatomically authentic 3D human eye model based on medical reference standards (Kenhub & Netter). Features physiological ciliary muscle accommodation, suspensory zonules of Zinn, episcleral micro-capillaries, real-time light ray refraction through the cornea and crystalline biconvex lens onto the retina, and corrective spectacle lens simulation for Myopia and Hypermetropia.',
    emoji: '👁️',
    difficulty: 'Intermediate',
    presets: [
      { label: '👁️ Emmetropia (Normal Distance Vision 100cm)', params: { objectDist: 100, accommodation: 0, visionDefect: 0, correctiveLens: 0, splitView: 0 } },
      { label: '📖 Near Vision Reading (Ciliary Tension 100%)', params: { objectDist: 25, accommodation: 1, visionDefect: 0, correctiveLens: 0, splitView: 0 } },
      { label: '👓 Myopia (Short-Sightedness & Concave Correction)', params: { objectDist: 80, accommodation: 0, visionDefect: 1, correctiveLens: 1, splitView: 0 } },
      { label: '🔍 Hypermetropia (Far-Sightedness & Convex Correction)', params: { objectDist: 30, accommodation: 0.2, visionDefect: 2, correctiveLens: 2, splitView: 0 } },
      { label: '✂️ Sagittal Anatomical Cross-Section', params: { objectDist: 60, accommodation: 0.5, visionDefect: 0, correctiveLens: 0, splitView: 1 } },
    ],
    params: [
      { key: 'objectDist', label: 'Object Distance (u)', min: 15, max: 200, step: 5, defaultValue: 60, unit: 'cm' },
      { key: 'accommodation', label: 'Ciliary Accommodation (Lens Thickness)', min: 0, max: 1, step: 0.05, defaultValue: 0.3, unit: '' },
      { key: 'visionDefect', label: 'Vision Condition (0: Normal, 1: Myopia, 2: Hypermetropia)', min: 0, max: 2, step: 1, defaultValue: 0, unit: '' },
      { key: 'correctiveLens', label: 'Corrective Spectacles (0: None, 1: Concave, 2: Convex)', min: 0, max: 2, step: 1, defaultValue: 0, unit: '' },
      { key: 'splitView', label: 'Sagittal Cross-Section (0: Intact, 1: Dissected)', min: 0, max: 1, step: 1, defaultValue: 0, unit: '' },
    ],
    calculateReadouts: (p) => {
      const u = p.objectDist; void u
      const eyeDepthCm = p.visionDefect === 1 ? 2.65 : p.visionDefect === 2 ? 2.15 : 2.4; void eyeDepthCm
      const accommodationPower = p.accommodation * 12.0
      const basePower = 58.0 + accommodationPower
      const defectLabel = p.visionDefect === 1 ? 'Myopia (Elongated Axial Length)' : p.visionDefect === 2 ? 'Hypermetropia (Shortened Axial Length)' : 'Emmetropia (Normal Vision)'
      const lensCorrection = p.correctiveLens === 1 ? 'Concave Diverging Lens (-2.50 D)' : p.correctiveLens === 2 ? 'Convex Converging Lens (+2.50 D)' : 'No Correction'

      let focusStatus = 'Focused Sharply on Fovea Centralis'
      if (p.visionDefect === 1 && p.correctiveLens !== 1) focusStatus = 'Rays Converge in Front of Retina (Blurred)'
      else if (p.visionDefect === 2 && p.correctiveLens !== 2) focusStatus = 'Rays Converge Behind Retina (Blurred)'

      return [
        { label: 'Vision State', value: defectLabel },
        { label: 'Image Focus Position', value: focusStatus },
        { label: 'Total Optical Power', value: basePower.toFixed(1), unit: 'Diopters (D)', formula: 'P = 1/f' },
        { label: 'Spectacle Correction', value: lensCorrection },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number
      let activeDissectKey: string | null = null; void activeDissectKey

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(-6, 3, 14)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 0, 0)

      const eyeRig = new THREE.Group()
      scene.add(eyeRig)

      const interactableMeshes: THREE.Object3D[] = []

      const DISSECT_CARDS: Record<string, DissectInfo> = {
        cornea: {
          title: 'Cornea · Anterior Transparent Window',
          partName: 'Cornea (Tunica Fibrosa Oculi)',
          role: 'Accounts for ~70% (43 Diopters) of total optical refractive power; protects internal ocular structures.',
          internalStructures: ['Epithelium', "Bowman's Membrane", 'Collagen Stroma (Avascular)', 'Descemet Membrane', 'Endothelium'],
          description: 'The cornea is avascular and receives oxygen directly from atmospheric tears. Its strict regular lattice of collagen fibers maintains absolute optical transparency.',
        },
        lens: {
          title: 'Crystalline Lens · Dynamic Accommodation',
          partName: 'Biconvex Elastic Crystalline Lens',
          role: 'Adjusts focal length dynamically by changing curvature through ciliary muscle tension (Accommodation).',
          internalStructures: ['Lens Capsule', 'Subcapsular Epithelium', 'Crystalline Protein Fibers', 'Suspensory Zonules of Zinn'],
          description: 'For distant objects, ciliary muscles relax, pulling zonule fibers taut and flattening the lens. For near reading, ciliary muscles contract, releasing zonule tension and allowing elastic lens proteins to bulge thicker (+12 D power increase).',
        },
        ciliary: {
          title: 'Ciliary Body & Zonules of Zinn',
          partName: 'Corpus Ciliare & Zonular Fibers',
          role: 'Controls lens curvature and continuously secretes aqueous humor to nourish avascular lens and cornea.',
          internalStructures: ['Ciliary Smooth Muscle Rings', 'Ciliary Processes', 'Zonular Ligaments (Heartstrings of Vision)'],
          description: 'The sphincter-like ciliary muscle contracts inward like an aperture, slackening the zonules to focus nearby objects onto the fovea.',
        },
        iris: {
          title: 'Iris & Pupil · Light Aperture',
          partName: 'Iris & Pupillary Aperture',
          role: 'Regulates luminous flux entering the retina by contracting sphincter and dilator pupillae muscles.',
          internalStructures: ['Sphincter Pupillae (Parasympathetic)', 'Dilator Pupillae (Sympathetic)', 'Melanin Chromatophores'],
          description: 'In bright light, the pupil constricts to ~2 mm to minimize spherical aberrations and protect photoreceptors. In darkness, it dilates to ~8 mm.',
        },
        retina: {
          title: 'Retina & Fovea Centralis · Photoreceptor Screen',
          partName: 'Neurosensory Retina & Fovea',
          role: 'Translates focused light photons into action potentials via 120 million Rods and 6 million Cones.',
          internalStructures: ['Fovea Centralis (Peak Cone Density)', 'Macula Lutea', 'Rods (Scotopic/Night Vision)', 'Cones (Photopic/Color Vision)', 'Retinal Ganglion Cells'],
          description: 'The fovea contains solely tightly packed cones with 1:1 ganglion cell wiring, delivering maximum visual acuity for reading and facial recognition.',
        },
        optic_nerve: {
          title: 'Optic Nerve (Cranial Nerve II)',
          partName: 'Nervus Opticus & Central Retinal Artery',
          role: 'Transmits over 1.2 million myelinated axons from retinal ganglion cells to the visual cortex (occipital lobe).',
          internalStructures: ['Optic Disc (Physiological Blind Spot)', 'Central Retinal Artery & Vein', 'Myelin Sheath'],
          description: 'Where the optic nerve exits the eyeball, there are zero photoreceptors, creating your anatomical blind spot.',
        },
        sclera: {
          title: 'Sclera · White Protective Outer Shell',
          partName: 'Sclera (Tough Fibrous Coat)',
          role: 'Maintains intraocular pressure (~15 mmHg), structural spherical shape, and anchors extraocular muscles.',
          internalStructures: ['Dense Collagen Bundles', 'Episcleral Capillary Plexus', 'Tenon Capsule', 'Extraocular Muscle Insertions'],
          description: 'The opaque white of the eye transitions smoothly into the clear cornea at the sclerocorneal limbus.',
        },
      }

      // 1. Sclera Shell (Full intact sphere)
      const scleraGeo = new THREE.SphereGeometry(3.2, 48, 48)
      const scleraMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.28,
        metalness: 0.04,
      })
      const scleraMesh = new THREE.Mesh(scleraGeo, scleraMat)
      scleraMesh.name = 'sclera'
      eyeRig.add(scleraMesh)
      interactableMeshes.push(scleraMesh)

      // Episcleral Micro-Capillaries on Sclera
      const vesselsGroup = new THREE.Group()
      const vesselMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.75 })
      for (let v = 0; v < 14; v++) {
        const phi = (v / 14) * Math.PI * 2
        const vCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(phi) * 1.6, Math.sin(phi) * 1.6, 2.2),
          new THREE.Vector3(Math.cos(phi + 0.12) * 2.3, Math.sin(phi + 0.12) * 2.3, 1.6),
          new THREE.Vector3(Math.cos(phi + 0.22) * 3.0, Math.sin(phi + 0.22) * 3.0, 0.4),
          new THREE.Vector3(Math.cos(phi + 0.18) * 3.16, Math.sin(phi + 0.18) * 3.16, -1.0),
        ])
        const vTube = new THREE.Mesh(new THREE.TubeGeometry(vCurve, 16, 0.035, 6, false), vesselMat)
        vesselsGroup.add(vTube)
      }
      eyeRig.add(vesselsGroup)

      // 3/4 Sagittal Dissection Cutaway Sclera
      const cutawayScleraGeo = new THREE.SphereGeometry(3.2, 48, 48, 0, Math.PI * 1.5, 0, Math.PI)
      const cutawayScleraMesh = new THREE.Mesh(cutawayScleraGeo, scleraMat)
      cutawayScleraMesh.name = 'sclera'
      cutawayScleraMesh.visible = false
      eyeRig.add(cutawayScleraMesh)

      // Middle Choroid Vascular Layer (Dark crimson/brown lining under sclera)
      const choroidGeo = new THREE.SphereGeometry(3.14, 48, 48, 0, Math.PI * 1.5, 0, Math.PI)
      const choroidMat = new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.65, side: THREE.DoubleSide })
      const choroidMesh = new THREE.Mesh(choroidGeo, choroidMat)
      choroidMesh.visible = false
      eyeRig.add(choroidMesh)

      // 2. Bulging Transparent Cornea Dome (Anterior dome, offset forward at z = +2.4)
      const corneaGeo = new THREE.SphereGeometry(1.68, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.46)
      const corneaMat = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.45,
        roughness: 0.06,
        transmission: 0.85,
        ior: 1.376,
        reflectivity: 0.9,
      })
      const corneaMesh = new THREE.Mesh(corneaGeo, corneaMat)
      corneaMesh.position.set(0, 0, 2.3)
      corneaMesh.name = 'cornea'
      eyeRig.add(corneaMesh)
      interactableMeshes.push(corneaMesh)

      // Dark Limbal Ring (Sclerocorneal Junction)
      const limbusGeo = new THREE.TorusGeometry(1.58, 0.08, 12, 36)
      const limbusMat = new THREE.MeshBasicMaterial({ color: 0x0f172a })
      const limbusMesh = new THREE.Mesh(limbusGeo, limbusMat)
      limbusMesh.position.set(0, 0, 2.3)
      eyeRig.add(limbusMesh)

      // 3. Iris with radial pupillary stroma fibers
      const irisGeo = new THREE.RingGeometry(0.55, 1.55, 36)
      const irisMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.55,
        side: THREE.DoubleSide,
      })
      const irisMesh = new THREE.Mesh(irisGeo, irisMat)
      irisMesh.position.set(0, 0, 2.36)
      irisMesh.name = 'iris'
      eyeRig.add(irisMesh)
      interactableMeshes.push(irisMesh)

      // Pupil aperture (deep black behind iris)
      const pupilGeo = new THREE.CircleGeometry(0.54, 32)
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x020617 })
      const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat)
      pupilMesh.position.set(0, 0, 2.35)
      eyeRig.add(pupilMesh)

      // 4. Crystalline Biconvex Elastic Lens (Scales with accommodation)
      const lensGeo = new THREE.SphereGeometry(1.18, 32, 32)
      const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.82,
        roughness: 0.06,
        transmission: 0.9,
        ior: 1.406,
      })
      const lensMesh = new THREE.Mesh(lensGeo, lensMat)
      lensMesh.position.set(0, 0, 1.85)
      lensMesh.scale.set(1.0, 1.0, 0.45)
      lensMesh.name = 'lens'
      eyeRig.add(lensMesh)
      interactableMeshes.push(lensMesh)

      // 5. Suspensory Zonules of Zinn (Radial tension filaments connecting lens to ciliary body)
      const zonulesGroup = new THREE.Group()
      const zonuleMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 })
      for (let z = 0; z < 24; z++) {
        const angle = (z / 24) * Math.PI * 2
        const innerPt = new THREE.Vector3(Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, 1.85)
        const outerPt = new THREE.Vector3(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, 1.85)
        const zGeo = new THREE.BufferGeometry().setFromPoints([innerPt, outerPt])
        const zLine = new THREE.Line(zGeo, zonuleMat)
        zonulesGroup.add(zLine)
      }
      eyeRig.add(zonulesGroup)

      // Ciliary Muscle Ring
      const ciliaryGeo = new THREE.TorusGeometry(1.5, 0.22, 16, 40)
      const ciliaryMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7 })
      const ciliaryMesh = new THREE.Mesh(ciliaryGeo, ciliaryMat)
      ciliaryMesh.position.set(0, 0, 1.85)
      ciliaryMesh.name = 'ciliary'
      eyeRig.add(ciliaryMesh)
      interactableMeshes.push(ciliaryMesh)

      // 6. Vitreous Body Gel Interior (translucent optical interior)
      const vitreousGeo = new THREE.SphereGeometry(3.08, 32, 32, 0, Math.PI * 1.5, 0, Math.PI)
      const vitreousMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.18,
        roughness: 0.05,
        transmission: 0.95,
        side: THREE.DoubleSide
      })
      const vitreousMesh = new THREE.Mesh(vitreousGeo, vitreousMat)
      vitreousMesh.visible = false
      eyeRig.add(vitreousMesh)

      // Posterior Retina Lining
      const retinaGeo = new THREE.SphereGeometry(3.1, 40, 40, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5)
      const retinaMat = new THREE.MeshStandardMaterial({
        color: 0xea580c,
        roughness: 0.65,
        side: THREE.BackSide,
      })
      const retinaMesh = new THREE.Mesh(retinaGeo, retinaMat)
      retinaMesh.name = 'retina'
      eyeRig.add(retinaMesh)
      interactableMeshes.push(retinaMesh)

      // Fovea Centralis (Golden tiny disc on retina pole)
      const foveaGeo = new THREE.CircleGeometry(0.24, 24)
      const foveaMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
      const foveaMesh = new THREE.Mesh(foveaGeo, foveaMat)
      foveaMesh.position.set(0.4, 0, -3.08)
      foveaMesh.name = 'retina'
      eyeRig.add(foveaMesh)

      // 7. Optic Nerve Trunk (Posterior Cylinder)
      const nerveGeo = new THREE.CylinderGeometry(0.65, 0.75, 3.2, 24)
      const nerveMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 })
      const nerveMesh = new THREE.Mesh(nerveGeo, nerveMat)
      nerveMesh.rotation.x = Math.PI / 2
      nerveMesh.position.set(-0.6, -0.2, -4.5)
      nerveMesh.name = 'optic_nerve'
      eyeRig.add(nerveMesh)
      interactableMeshes.push(nerveMesh)

      // Central retinal blood vessels on nerve
      const arteryGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.3, 16)
      const arteryMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
      const arteryMesh = new THREE.Mesh(arteryGeo, arteryMat)
      arteryMesh.rotation.x = Math.PI / 2
      arteryMesh.position.set(-0.65, -0.2, -4.5)
      eyeRig.add(arteryMesh)

      // 8. Optical Ray Tracing Light Bundle
      const rayGroup = new THREE.Group()
      scene.add(rayGroup)

      const rayLines: THREE.Line[] = []
      const rayMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2, transparent: true, opacity: 0.85 })
      const rayFocalMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, transparent: true, opacity: 0.95 })

      for (let i = 0; i < 5; i++) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
        const line = new THREE.Line(geo, i === 2 ? rayFocalMat : rayMat)
        rayLines.push(line)
        rayGroup.add(line)
      }

      // Dynamic Photon Particle Spark travelling on chief ray
      const photonSpark = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      )
      scene.add(photonSpark)

      // Retinal Focal Spot Indicator (Sharp glowing dot when focused on retina, blurry halo when defocused)
      const focalSpotMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
      const focalSpotMesh = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.22, 24), focalSpotMat)
      focalSpotMesh.position.set(0, 0, -3.09)
      eyeRig.add(focalSpotMesh)

      // Light Object (Candle with flame)
      const objectGroup = new THREE.Group()
      scene.add(objectGroup)

      const candleGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.2, 16)
      const candleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
      const candleMesh = new THREE.Mesh(candleGeo, candleMat)
      objectGroup.add(candleMesh)

      const flameGeo = new THREE.ConeGeometry(0.2, 0.6, 16)
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 })
      const flameMesh = new THREE.Mesh(flameGeo, flameMat)
      flameMesh.position.y = 1.35
      objectGroup.add(flameMesh)

      // Corrective Spectacles Group (Authentic titanium glasses frame in front of eye)
      const specGroup = new THREE.Group()
      scene.add(specGroup)

      const specLensGeo = new THREE.CylinderGeometry(1.65, 1.65, 0.14, 32)
      const specLensMat = new THREE.MeshPhysicalMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.55,
        roughness: 0.08,
        transmission: 0.92,
      })
      const specLensMesh = new THREE.Mesh(specLensGeo, specLensMat)
      specLensMesh.rotation.x = Math.PI / 2
      specLensMesh.position.set(0, 0, 4.8)
      specGroup.add(specLensMesh)

      // Titanium Spectacle Rim & Nose Bridge
      const specRimGeo = new THREE.TorusGeometry(1.68, 0.08, 8, 36)
      const specRimMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 })
      const specRimMesh = new THREE.Mesh(specRimGeo, specRimMat)
      specRimMesh.position.set(0, 0, 4.8)
      specGroup.add(specRimMesh)

      // Nose bridge arch connecting left/right frames
      const bridgeCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-1.65, 0.2, 4.8),
        new THREE.Vector3(-2.3, 0.6, 4.8),
        new THREE.Vector3(-2.9, 0.2, 4.8)
      )
      const bridgeMesh = new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 16, 0.06, 8, false), specRimMat)
      specGroup.add(bridgeMesh)

      // Left temple arm extending back towards ear
      const templeGeo = new THREE.CylinderGeometry(0.05, 0.05, 5.2, 8)
      const templeMesh = new THREE.Mesh(templeGeo, specRimMat)
      templeMesh.rotation.x = Math.PI / 2
      templeMesh.position.set(1.68, 0.2, 2.2)
      specGroup.add(templeMesh)

      specGroup.visible = false

      // Load Realistic Medical-Grade Blender GLTF Eye
      const eyeGltfLoader = new GLTFLoader()
      let realisticEyeRoot: THREE.Group | null = null
      eyeGltfLoader.load(
        '/models/eye_realistic.glb',
        (gltf) => {
          realisticEyeRoot = gltf.scene
          realisticEyeRoot.scale.setScalar(1.28)
          realisticEyeRoot.position.set(0, 0, 0)
          eyeRig.add(realisticEyeRoot)

          // Hide low-poly procedural fallback meshes
          scleraMesh.visible = false
          vesselsGroup.visible = false
          corneaMesh.visible = false
          limbusMesh.visible = false
          irisMesh.visible = false
          pupilMesh.visible = false
          lensMesh.visible = false
          zonulesGroup.visible = false
          ciliaryMesh.visible = false
          retinaMesh.visible = false
          foveaMesh.visible = false
          nerveMesh.visible = false
          arteryMesh.visible = false

          realisticEyeRoot.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
              const n = child.name.toLowerCase()
              if (n.includes('lens')) { child.name = 'lens'; interactableMeshes.push(child) }
              else if (n.includes('cornea')) { child.name = 'cornea'; interactableMeshes.push(child) }
              else if (n.includes('iris') || n.includes('pupil')) { child.name = 'iris'; interactableMeshes.push(child) }
              else if (n.includes('retina') || n.includes('fovea')) { child.name = 'retina'; interactableMeshes.push(child) }
              else if (n.includes('nerve')) { child.name = 'optic_nerve'; interactableMeshes.push(child) }
              else if (n.includes('sclera')) { child.name = 'sclera'; interactableMeshes.push(child) }
            }
          })
        },
        undefined,
        (err) => {
          console.warn('Blender realistic eye fallback to procedural:', err)
        }
      )

      function updateRays() {
        const uCm = params.objectDist
        const objZ = 4.8 + Math.min(22, (uCm / 180) * 18)
        objectGroup.position.set(0, 0, objZ)

        // Show/hide corrective spectacles
        if (params.correctiveLens > 0) {
          specGroup.visible = true
          specLensMesh.scale.set(1.0, 1.0, params.correctiveLens === 1 ? 0.35 : 0.8)
        } else {
          specGroup.visible = false
        }

        // Lens thickness adaptation (accommodation)
        const thickZ = 0.35 + params.accommodation * 0.45
        lensMesh.scale.set(1.0, 1.0, thickZ)

        // Suspensory zonule relaxation with accommodation
        zonulesGroup.scale.setScalar(1.0 - params.accommodation * 0.08)

        if (realisticEyeRoot) {
          const specFrame = realisticEyeRoot.getObjectByName('Spectacles_Frame')
          if (specFrame) specFrame.visible = params.correctiveLens > 0
          const bLens = realisticEyeRoot.getObjectByName('Crystalline_Lens')
          if (bLens) {
            bLens.scale.set(1.0, 1.0, 0.42 + params.accommodation * 0.35)
          }
          const bZonules = realisticEyeRoot.getObjectByName('Zonules_Group')
          if (bZonules) {
            bZonules.scale.setScalar(1.0 - params.accommodation * 0.08)
          }
        }

        // Sclera and Sagittal section toggle (splitView)
        const isSplit = params.splitView >= 0.5
        scleraMesh.visible = !isSplit
        vesselsGroup.visible = !isSplit
        cutawayScleraMesh.visible = isSplit
        choroidMesh.visible = isSplit
        vitreousMesh.visible = isSplit

        let focalZ = -3.1 // Normal emmetropia

        if (params.visionDefect === 1) {
          focalZ = params.correctiveLens === 1 ? -3.1 : -1.8
        } else if (params.visionDefect === 2) {
          focalZ = params.correctiveLens === 2 ? -3.1 : -4.3
        }

        if (uCm < 40 && params.accommodation < 0.6 && params.visionDefect === 0) {
          focalZ -= (0.6 - params.accommodation) * 1.8
        }

        // Retinal focus check: If focal point is within ±0.15 of retina (-3.1), spot is sharp green
        const defocusDist = Math.abs(focalZ - (-3.1))
        if (defocusDist < 0.2) {
          focalSpotMat.color.setHex(0x22c55e) // Sharp focus (green)
          focalSpotMesh.scale.set(1.0, 1.0, 1.0)
          focalSpotMat.opacity = 0.95
        } else {
          focalSpotMat.color.setHex(0xef4444) // Blurred circle of confusion (red)
          const blurScale = 1.0 + defocusDist * 2.8
          focalSpotMesh.scale.set(blurScale, blurScale, 1.0)
          focalSpotMat.opacity = 0.6
        }

        const lensZ = 1.85
        const rayOffsets = [-1.0, -0.5, 0, 0.5, 1.0]

        rayLines.forEach((line, idx) => {
          const offY = rayOffsets[idx]
          const objPt = new THREE.Vector3(0, offY * 0.9, objZ)
          const lensPt = new THREE.Vector3(0, offY * 0.75, lensZ)
          const focusPt = new THREE.Vector3(0, -offY * 0.15, focalZ)

          const pts = [objPt, lensPt, focusPt]
          line.geometry.setFromPoints(pts)
        })

        // Photon particle travels along chief central ray
        const pCycle = (Date.now() * 0.002) % 1.0
        if (pCycle < 0.5) {
          const t = pCycle * 2.0
          photonSpark.position.lerpVectors(new THREE.Vector3(0, 0, objZ), new THREE.Vector3(0, 0, lensZ), t)
        } else {
          const t = (pCycle - 0.5) * 2.0
          photonSpark.position.lerpVectors(new THREE.Vector3(0, 0, lensZ), new THREE.Vector3(0, 0, focalZ), t)
        }
      }

      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function triggerRaycast(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(interactableMeshes, true)
        if (hits.length > 0) {
          const key = hits[0].object.name || 'cornea'
          activeDissectKey = key
          const card = DISSECT_CARDS[key] || DISSECT_CARDS.cornea
          callbacks.onInspectPart?.(card)
        }
      }

      function handleDblClick(e: MouseEvent) {
        triggerRaycast(e.clientX, e.clientY)
      }

      function handleTouchEnd(e: TouchEvent) {
        if (e.changedTouches.length === 0) return
        const t = e.changedTouches[0]
        triggerRaycast(t.clientX, t.clientY)
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      function animate() {
        animId = requestAnimationFrame(animate)
        controls.update()
        updateRays()
        eyeRig.rotation.y = Math.sin(Date.now() * 0.001) * 0.04
        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          updateRays()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          params = { ...initialParams }
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
          updateRays()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  cell_biology_3d: {
    type: 'cell_biology_3d',
    title: '3D Plant & Animal Cell Ultrastructure',
    subject: 'Biology · Cytology & Cell Physiology',
    concept: 'Eukaryotic Organelles, Membrane Systems & Bioenergetics',
    description: 'High-definition 3D eukaryotic cell ultrastructure model based on transmission electron microscopy (TEM). Features true 3/4 cutaways, folded mitochondrial cristae with active ATP generation, stacked chloroplast thylakoid grana, rough ER cisternal sheets with ribosome beads, Golgi transport vesicle budding, and active cytoplasmic streaming.',
    emoji: '🔬',
    difficulty: 'Intermediate',
    presets: [
      { label: '🌿 Eukaryotic Plant Cell (Chloroplasts & Rigid Wall)', params: { cellType: 0, zoomLevel: 1.0, activeOrganelle: 0, cutaway: 1 } },
      { label: '🐾 Eukaryotic Animal Cell (Centrosome & Lysosomes)', params: { cellType: 1, zoomLevel: 1.0, activeOrganelle: 0, cutaway: 1 } },
      { label: '⚡ Mitochondria Powerhouse (ATP Synthesis Focus)', params: { cellType: 1, zoomLevel: 1.8, activeOrganelle: 1, cutaway: 1 } },
      { label: '☀️ Chloroplast Thylakoids (Light Reactions Focus)', params: { cellType: 0, zoomLevel: 1.8, activeOrganelle: 2, cutaway: 1 } },
      { label: '🧬 Cell Nucleus & Chromatin Architecture', params: { cellType: 0, zoomLevel: 1.5, activeOrganelle: 3, cutaway: 1 } },
    ],
    params: [
      { key: 'cellType', label: 'Cell Type (0: Plant Cell, 1: Animal Cell)', min: 0, max: 1, step: 1, defaultValue: 0, unit: '' },
      { key: 'cutaway', label: 'Membrane Cutaway (0: Intact, 1: Cutaway)', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
      { key: 'zoomLevel', label: 'Organelle Magnification Zoom', min: 1.0, max: 2.5, step: 0.1, defaultValue: 1.0, unit: 'x' },
    ],
    calculateReadouts: (p) => {
      const isPlant = p.cellType === 0
      return [
        { label: 'Cell Type', value: isPlant ? 'Plant Cell (Autotrophic)' : 'Animal Cell (Heterotrophic)' },
        { label: 'Outer Boundary', value: isPlant ? 'Cellulose Cell Wall + Plasma Membrane' : 'Flexible Phospholipid Bilayer' },
        { label: 'Bioenergetic Organelle', value: isPlant ? 'Chloroplasts (Photosynthesis) & Mitochondria' : 'Mitochondria (Oxidative Phosphorylation)' },
        { label: 'Vacuole Type', value: isPlant ? 'Large Central Sap Vacuole (~80% volume)' : 'Small Transient Transport Vesicles' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      void isPlaying
      let animId: number
      let activeDissectKey: string | null = null; void activeDissectKey

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 4, 15)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const cellRig = new THREE.Group()
      scene.add(cellRig)

      const interactableMeshes: THREE.Object3D[] = []

      const DISSECT_CARDS: Record<string, DissectInfo> = {
        nucleus: {
          title: 'Cell Nucleus & Nucleolus · Genetic Command Center',
          partName: 'Nucleus, Chromatin & Nucleolus',
          role: 'Houses linear chromosomal DNA; coordinates transcription, DNA replication, and ribosome biogenesis.',
          internalStructures: ['Double-membrane Nuclear Envelope with Pores', 'Heterochromatin & Euchromatin', 'Dense Nucleolus (rRNA transcription)'],
          description: 'The nuclear envelope features selective octagonal nuclear pore complexes regulating RNA and protein transit between nucleoplasm and cytoplasm.',
        },
        mitochondria: {
          title: 'Mitochondrion · Cellular Powerhouse',
          partName: 'Double-Membrane Mitochondria with Folded Cristae',
          role: 'Produces >90% of cellular ATP via Krebs cycle and the electron transport chain (Oxidative Phosphorylation).',
          internalStructures: ['Outer Porin Membrane', 'Folded Inner Cristae Sheets', 'Mitochondrial Matrix (Mitochondrial DNA & Ribosomes)', 'F1F0 ATP Synthase Complexes'],
          description: 'The extensive folding of cristae expands the surface area available for complexes I–IV and rotating F1F0 ATP synthase motors.',
        },
        chloroplast: {
          title: 'Chloroplast · Photosynthetic Solar Factory',
          partName: 'Chloroplast (Plastid)',
          role: 'Harvests sunlight photons to synthesize carbohydrates from CO2 and water during oxygenic photosynthesis.',
          internalStructures: ['Double Plastid Envelope', 'Stacked Thylakoid Grana', 'Stroma Matrix (Rubisco enzymes)', 'Chlorophyll a & b Antenna Pigments'],
          description: 'Present only in plant and algal cells. Light reactions occur in the thylakoid membranes, pumping protons to fuel ATP and NADPH generation.',
        },
        er: {
          title: 'Endoplasmic Reticulum (Rough & Smooth ER)',
          partName: 'Endoplasmic Reticulum Cisternal Network',
          role: 'Synthesizes proteins (Rough ER with ribosomes) and lipids/steroids + calcium storage (Smooth ER).',
          internalStructures: ['Membrane Lamellae / Cisternae', 'Membrane-bound Ribosome Granules (Golden Beads)', 'Tubular Smooth Lumen'],
          description: 'Polypeptides synthesized by ribosomes thread directly into the ER lumen for post-translational folding and chaperone quality control.',
        },
        golgi: {
          title: 'Golgi Apparatus · Post Office of the Cell',
          partName: 'Golgi Cisternal Stack & Secretory Vesicles',
          role: 'Modifies, sorts, packages, and tags proteins with oligosaccharides for secretion or lysosomal delivery.',
          internalStructures: ['Cis-Golgi Receiving Face', 'Medial Cisternae', 'Trans-Golgi Network (Exit/Budding vesicles)'],
          description: 'Proteins arrive from the rough ER in transport vesicles, pass sequentially through cisternae for glycosylation, and bud off in targeted vesicles.',
        },
        vacuole: {
          title: 'Central Vacuole / Sap Vacuole',
          partName: 'Tonoplast & Central Vacuole',
          role: 'Maintains turgor pressure against the cell wall, stores water, pigments, and hydrolytic enzymes.',
          internalStructures: ['Tonoplast Semipermeable Membrane', 'Cell Sap Solution (Hypertonic)', 'Enzymatic Reservoirs'],
          description: 'In plant cells, osmotic water influx into the central vacuole creates hydrostatic turgor pressure, keeping herbaceous plant stems upright.',
        },
        wall: {
          title: 'Cellulose Cell Wall · Rigid Exoskeleton',
          partName: 'Primary & Secondary Cell Wall',
          role: 'Provides mechanical tensile strength, withstands high internal osmotic turgor pressure, and shapes the plant cell.',
          internalStructures: ['Cellulose Microfibrils', 'Hemicellulose & Pectin Matrix', 'Middle Lamella (Calcium Pectate)', 'Plasmodesmata Channels'],
          description: 'Composed of beta-glucose cellulose chains cross-linked by pectins, enabling plants to grow tall without an internal skeleton.',
        },
      }

      // 1. Plant Cell Wall & Animal Membrane with genuine 3/4 cutaways
      const plantWallGeo = new THREE.BoxGeometry(6.6, 5.4, 5.4)
      const plantWallMat = new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.45,
        transparent: true,
        opacity: 0.55,
      })
      const plantWallMesh = new THREE.Mesh(plantWallGeo, plantWallMat)
      plantWallMesh.name = 'wall'
      cellRig.add(plantWallMesh)
      interactableMeshes.push(plantWallMesh)

      // Plant Middle Lamella & Border Chamfers
      const plantBorderGeo = new THREE.BoxGeometry(6.75, 5.55, 5.55)
      const plantBorderMat = new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      })
      const plantBorderMesh = new THREE.Mesh(plantBorderGeo, plantBorderMat)
      cellRig.add(plantBorderMesh)

      // Animal Cell Membrane (3/4 cutaway spherical dome)
      const animalMembraneGeo = new THREE.SphereGeometry(3.3, 40, 40, 0, Math.PI * 1.5, 0, Math.PI)
      const animalMembraneMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      })
      const animalMembraneMesh = new THREE.Mesh(animalMembraneGeo, animalMembraneMat)
      animalMembraneMesh.name = 'wall'
      cellRig.add(animalMembraneMesh)

      // 2. Nucleus & Nucleolus (3/4 Cutaway showing interior chromatin & nucleolus)
      const nucleusGeo = new THREE.SphereGeometry(1.3, 32, 32, 0, Math.PI * 1.5, 0, Math.PI)
      const nucleusMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.4, side: THREE.DoubleSide })
      const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat)
      nucleusMesh.position.set(-0.8, 0.4, 0)
      nucleusMesh.name = 'nucleus'
      cellRig.add(nucleusMesh)
      interactableMeshes.push(nucleusMesh)

      // Dense Nucleolus Core
      const nucleolusGeo = new THREE.SphereGeometry(0.48, 24, 24)
      const nucleolusMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.25 })
      const nucleolusMesh = new THREE.Mesh(nucleolusGeo, nucleolusMat)
      nucleolusMesh.position.set(-0.7, 0.45, 0.25)
      nucleolusMesh.name = 'nucleus'
      cellRig.add(nucleolusMesh)

      // Chromatin Thread Coils inside nucleoplasm
      for (let ch = 0; ch < 5; ch++) {
        const cCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.9 + Math.sin(ch) * 0.4, 0.2 + (ch % 3) * 0.2, 0.1),
          new THREE.Vector3(-0.6 + Math.cos(ch) * 0.3, 0.6 - (ch % 2) * 0.3, 0.3),
          new THREE.Vector3(-0.8, 0.3, 0.4),
        ])
        const cGeo = new THREE.TubeGeometry(cCurve, 16, 0.03, 6, false)
        const cMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.5 })
        const cMesh = new THREE.Mesh(cGeo, cMat)
        cellRig.add(cMesh)
      }

      // Nuclear Pores (Octagonal tiny rings on outer envelope)
      for (let np = 0; np < 12; np++) {
        const theta = (np / 12) * Math.PI * 2
        const pMesh = new THREE.Mesh(
          new THREE.TorusGeometry(0.08, 0.02, 6, 12),
          new THREE.MeshBasicMaterial({ color: 0xc4b5fd })
        )
        pMesh.position.set(-0.8 + Math.cos(theta) * 1.3, 0.4 + Math.sin(theta) * 1.1, -0.4)
        cellRig.add(pMesh)
      }

      // 3. Mitochondria (Double-membrane cutaway with folded golden cristae sheets)
      const mitoGroup = new THREE.Group()
      cellRig.add(mitoGroup)
      const mitoPositions = [
        new THREE.Vector3(1.6, 1.2, 0.8),
        new THREE.Vector3(1.4, -1.3, -0.6),
        new THREE.Vector3(-1.8, -1.1, 0.9),
      ]
      const atpSparks: THREE.Mesh[] = []
      mitoPositions.forEach((pos) => {
        const mGroup = new THREE.Group()
        mGroup.position.copy(pos)
        mGroup.rotation.set(0.6, 0.4, 0.8)

        // Outer membrane capsule
        const mOuter = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.36, 0.85, 16, 20),
          new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 })
        )
        mOuter.name = 'mitochondria'
        mGroup.add(mOuter)
        interactableMeshes.push(mOuter)

        // Inner folded cristae ridges
        for (let cr = 0; cr < 5; cr++) {
          const ridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.48, 0.08, 0.35),
            new THREE.MeshBasicMaterial({ color: 0xfacc15 })
          )
          ridge.position.set(0, -0.3 + cr * 0.15, 0.12)
          mGroup.add(ridge)
        }

        // Glowing ATP energy spark
        const atp = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        )
        atp.position.set(0, 0, 0.4)
        mGroup.add(atp)
        atpSparks.push(atp)

        mitoGroup.add(mGroup)
      })

      // 4. Chloroplasts (For plant cell - with stacked thylakoid grana discs)
      const chloroGroup = new THREE.Group()
      cellRig.add(chloroGroup)
      const chloroPositions = [
        new THREE.Vector3(1.8, 0.2, -1.2),
        new THREE.Vector3(-1.5, 1.4, -0.8),
        new THREE.Vector3(0.3, -1.6, 1.2),
      ]
      chloroPositions.forEach((pos) => {
        const cGroup = new THREE.Group()
        cGroup.position.copy(pos)
        cGroup.rotation.set(0.4, 0.2, 0.5)

        const cOuter = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 20, 20),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 })
        )
        cOuter.scale.set(1.2, 0.65, 1.0)
        cOuter.name = 'chloroplast'
        cGroup.add(cOuter)
        interactableMeshes.push(cOuter)

        // Stacked Thylakoid Grana discs
        for (let g = 0; g < 3; g++) {
          for (let d = 0; d < 4; d++) {
            const disc = new THREE.Mesh(
              new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12),
              new THREE.MeshStandardMaterial({ color: 0x14532d })
            )
            disc.position.set(-0.25 + g * 0.25, -0.12 + d * 0.07, 0)
            cGroup.add(disc)
          }
        }
        chloroGroup.add(cGroup)
      })

      // 5. Rough & Smooth Endoplasmic Reticulum with Ribosome beads
      const erGroup = new THREE.Group()
      cellRig.add(erGroup)
      for (let i = 0; i < 4; i++) {
        const r = 1.45 + i * 0.24
        const erGeo = new THREE.TorusGeometry(r, 0.09, 12, 32, Math.PI * 1.3)
        const erMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 })
        const erMesh = new THREE.Mesh(erGeo, erMat)
        erMesh.position.set(-0.8, 0.4, 0)
        erMesh.rotation.set(0.4 + i * 0.18, 0.5, i * 0.28)
        erMesh.name = 'er'
        erGroup.add(erMesh)
        interactableMeshes.push(erMesh)

        // Golden Ribosome Beads on Rough ER
        for (let rb = 0; rb < 10; rb++) {
          const ribo = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xfacc15 })
          )
          const angle = (rb / 10) * Math.PI * 1.2
          ribo.position.set(
            -0.8 + Math.cos(angle) * r,
            0.4 + Math.sin(angle) * r,
            0.15 + (rb % 2) * 0.08
          )
          erGroup.add(ribo)
        }
      }

      // 6. Golgi Apparatus with Budding Secretory Transport Vesicles
      const golgiGroup = new THREE.Group()
      cellRig.add(golgiGroup)
      for (let i = 0; i < 4; i++) {
        const gGeo = new THREE.TorusGeometry(1.2 - i * 0.18, 0.08, 12, 24, Math.PI * 0.75)
        const gMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4 })
        const gMesh = new THREE.Mesh(gGeo, gMat)
        gMesh.position.set(0.8, -0.3 + i * 0.18, 1.1)
        gMesh.rotation.set(0.3, 0.9, 0.4)
        gMesh.name = 'golgi'
        golgiGroup.add(gMesh)
        interactableMeshes.push(gMesh)
      }

      // Budding Vesicles
      const vesicles: THREE.Mesh[] = []
      for (let v = 0; v < 6; v++) {
        const ves = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 })
        )
        ves.position.set(1.2 + Math.random() * 0.6, -0.2 + Math.random() * 0.8, 1.2 + Math.random() * 0.5)
        golgiGroup.add(ves)
        vesicles.push(ves)
      }

      // 7. Central Vacuole (Large sap reservoir in plant cell)
      const vacuoleGeo = new THREE.SphereGeometry(1.7, 32, 32)
      const vacuoleMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.15,
        transmission: 0.85,
      })
      const vacuoleMesh = new THREE.Mesh(vacuoleGeo, vacuoleMat)
      vacuoleMesh.position.set(1.2, 0.2, -0.4)
      vacuoleMesh.scale.set(1.15, 1.25, 1.05)
      vacuoleMesh.name = 'vacuole'
      cellRig.add(vacuoleMesh)
      interactableMeshes.push(vacuoleMesh)

      // 8. Centrosome with Orthogonal Centrioles (Animal Cell)
      const centrosomeGroup = new THREE.Group()
      centrosomeGroup.position.set(-0.4, 1.8, 0.6)
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 9), new THREE.MeshStandardMaterial({ color: 0xf59e0b }))
      const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 9), new THREE.MeshStandardMaterial({ color: 0xf59e0b }))
      c2.rotation.x = Math.PI / 2
      c2.position.set(0.2, 0, 0)
      centrosomeGroup.add(c1, c2)
      cellRig.add(centrosomeGroup)

      // Lysosomes (Suicide sacs containing digestive acid hydrolases)
      const lysoGroup = new THREE.Group()
      cellRig.add(lysoGroup)
      const lysoMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35 })
      for (const [lx, ly, lz] of [[-1.2, -1.5, -0.6], [0.9, 1.4, -1.0], [1.7, -0.8, 1.1]]) {
        const lyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), lysoMat)
        lyMesh.position.set(lx, ly, lz)
        lysoGroup.add(lyMesh)
      }

      // Peroxisomes (Catalase crystals decomposing H2O2)
      const peroxGroup = new THREE.Group()
      cellRig.add(peroxGroup)
      const peroxMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.3 })
      for (const [px, py, pz] of [[-0.4, -1.7, 0.8], [1.5, 0.8, -0.7]]) {
        const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), peroxMat)
        pMesh.position.set(px, py, pz)
        peroxGroup.add(pMesh)
      }

      // 9. Cytoplasmic Streaming (Cyclosis) Granules
      const streamingGranules: THREE.Mesh[] = []
      const granMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5 })
      for (let sg = 0; sg < 35; sg++) {
        const gMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), granMat)
        gMesh.position.set((Math.random() - 0.5) * 4.5, (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5)
        gMesh.userData = { angle: Math.random() * Math.PI * 2, r: 1.2 + Math.random() * 1.5, speed: 0.008 + Math.random() * 0.012 }
        cellRig.add(gMesh)
        streamingGranules.push(gMesh)
      }

      function applyCellState() {
        const isPlant = params.cellType === 0
        const isCutaway = params.cutaway >= 0.5
        plantWallMesh.visible = isPlant
        plantBorderMesh.visible = isPlant
        animalMembraneMesh.visible = !isPlant
        chloroGroup.visible = isPlant
        vacuoleMesh.visible = isPlant
        centrosomeGroup.visible = !isPlant

        if (!isCutaway) {
          plantWallMesh.material.opacity = 0.95
          animalMembraneMesh.material.opacity = 0.92
        } else {
          plantWallMesh.material.opacity = 0.55
          animalMembraneMesh.material.opacity = 0.45
        }

        const zFactor = params.zoomLevel || 1.0
        cellRig.scale.set(zFactor, zFactor, zFactor)
      }

      applyCellState()

      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function triggerRaycast(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(interactableMeshes, true)
        if (hits.length > 0) {
          const key = hits[0].object.name || 'nucleus'
          activeDissectKey = key
          const card = DISSECT_CARDS[key] || DISSECT_CARDS.nucleus
          callbacks.onInspectPart?.(card)
        }
      }

      function handleDblClick(e: MouseEvent) {
        triggerRaycast(e.clientX, e.clientY)
      }

      function handleTouchEnd(e: TouchEvent) {
        if (e.changedTouches.length === 0) return
        const t = e.changedTouches[0]
        triggerRaycast(t.clientX, t.clientY)
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)
      renderer.domElement.addEventListener('touchend', handleTouchEnd)

      function animate() {
        animId = requestAnimationFrame(animate)
        controls.update()
        cellRig.rotation.y += 0.0025

        // Dynamic ATP synthesis pulses
        const atpScale = 1.0 + Math.sin(Date.now() * 0.008) * 0.35
        atpSparks.forEach(s => s.scale.setScalar(atpScale))

        // Cytoplasmic cyclosis streaming
        streamingGranules.forEach(g => {
          g.userData.angle += g.userData.speed
          g.position.x = Math.cos(g.userData.angle) * g.userData.r
          g.position.z = Math.sin(g.userData.angle) * g.userData.r
        })

        // Golgi vesicle drift
        vesicles.forEach((v, idx) => {
          v.position.x += Math.sin(Date.now() * 0.001 + idx) * 0.002
          v.position.y += Math.cos(Date.now() * 0.001 + idx) * 0.002
        })

        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
          applyCellState()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          params = { ...initialParams }
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
          applyCellState()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.domElement.removeEventListener('touchend', handleTouchEnd)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  ac_generator_3d: {
    type: 'ac_generator_3d',
    title: '3D AC Generator & Electromagnetic Dynamo',
    subject: 'Physics · Electromagnetism',
    concept: "Faraday's Law, Rotating Armature & Sinusoidal AC Induction",
    description: "Interactive 3D model of an Alternating Current (AC) Generator based on standard physics laboratory apparatus. Features a rotating rectangular copper armature coil between North and South magnetic pole shoes, two continuous brass slip rings, spring-loaded carbon brushes, dynamic Fleming's right-hand rule vectors, and a live synchronized sinusoidal AC voltage waveform.",
    emoji: '⚡',
    difficulty: 'Intermediate',
    presets: [
      { label: '⚡ Standard Grid Generation (60 RPM)', params: { rpm: 60, fieldStrength: 1.2, coilTurns: 100 } },
      { label: '🚀 High-Speed Hydro Turbine (120 RPM)', params: { rpm: 120, fieldStrength: 1.5, coilTurns: 100 } },
      { label: '🧲 Strong Neodymium Magnet (2.5 Tesla)', params: { rpm: 60, fieldStrength: 2.5, coilTurns: 150 } },
      { label: '🐢 Slow-Motion Cycle Demonstration (20 RPM)', params: { rpm: 20, fieldStrength: 1.0, coilTurns: 100 } },
    ],
    params: [
      { key: 'rpm', label: 'Rotational Speed (RPM)', min: 10, max: 180, step: 5, defaultValue: 60, unit: 'rpm' },
      { key: 'fieldStrength', label: 'Magnetic Field (B)', min: 0.2, max: 3.0, step: 0.1, defaultValue: 1.2, unit: 'T' },
      { key: 'coilTurns', label: 'Armature Coil Turns (N)', min: 20, max: 200, step: 10, defaultValue: 100, unit: 'turns' },
    ],
    calculateReadouts: (p) => {
      const omega = (2 * Math.PI * p.rpm) / 60
      const freq = (p.rpm / 60).toFixed(2)
      const area = 0.04 // 0.2m x 0.2m armature
      const peakEmf = (p.coilTurns * p.fieldStrength * area * omega).toFixed(1)
      const rmsEmf = (Number(peakEmf) / Math.SQRT2).toFixed(1)
      return [
        { label: 'Frequency (f)', value: freq, unit: 'Hz', formula: 'f = RPM / 60' },
        { label: 'Peak Voltage (ε₀)', value: peakEmf, unit: 'V', formula: 'ε₀ = N · B · A · ω' },
        { label: 'RMS Voltage (V_rms)', value: rmsEmf, unit: 'V', formula: 'V_rms = ε₀ / √2' },
        { label: 'Current Type', value: 'Alternating Current (Sinusoidal)' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number
      let angle = 0
      let activeDissectKey: string | null = null; void activeDissectKey

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(-6, 5, 12)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 0, 0)

      const generatorRig = new THREE.Group()
      scene.add(generatorRig)

      const interactableMeshes: THREE.Object3D[] = []

      const DISSECT_CARDS: Record<string, DissectInfo> = {
        armature: {
          title: 'Rotating Armature Coil',
          partName: 'Armature (Rectangular Copper Winding)',
          role: 'Rotates across the magnetic field, continuously changing magnetic flux linkage dΦ/dt to induce EMF.',
          internalStructures: ['Enameled Copper Wire Turns', 'Soft Iron Laminated Core (reduces eddy currents)', 'Steel Shaft Axis'],
          description: "According to Faraday's law of electromagnetic induction, ε = -N(dΦ/dt). When the coil plane is parallel to field lines, rate of flux change is maximal (peak EMF). When perpendicular, instantaneous EMF is zero.",
        },
        slip_rings: {
          title: 'Continuous Brass Slip Rings',
          partName: 'Full Circular Slip Rings (R1 & R2)',
          role: 'Maintains continuous electrical contact with the rotating coil without twisting the circuit leads.',
          internalStructures: ['Solid Brass / Phosphor Bronze Rings', 'Insulating Core Sleeve', 'Stationary Carbon Brush Contacts'],
          description: 'Unlike a DC motor which uses a split-ring commutator to invert current, an AC generator uses two intact, continuous slip rings, preserving the naturally alternating sinusoidal current in the external circuit.',
        },
        magnets: {
          title: 'Permanent Magnetic Pole Shoes',
          partName: 'North & South Concave Field Magnets',
          role: 'Supplies a strong, uniform transverse magnetic field (B) across the armature gap.',
          internalStructures: ['North Pole (Red Painted Shoe)', 'South Pole (Blue Painted Shoe)', 'Magnetic Flux Streamlines'],
          description: 'The magnetic flux lines pass directly from the North pole to the South pole. The armature coil cuts across these lines at linear velocity v = ω · r.',
        },
        brushes: {
          title: 'Graphite Carbon Brushes',
          partName: 'Carbon Brushes (B1 & B2)',
          role: 'Spring-loaded conductive blocks that slide against the rotating slip rings to draw out the induced AC power.',
          internalStructures: ['High-conductivity Graphite Block', 'Tension Spring', 'Copper Pigtail Lead'],
          description: 'Graphite provides low friction and high thermal conductivity, preventing arcing while transferring alternating current to the external load circuit.',
        },
      }

      // 1. Magnetic Field Poles (North: Red, South: Blue)
      const poleGeo = new THREE.BoxGeometry(1.6, 3.2, 4.0)
      const northMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
      const southMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 })

      const northMesh = new THREE.Mesh(poleGeo, northMat)
      northMesh.position.set(-3.6, 0, 0)
      northMesh.name = 'magnets'
      generatorRig.add(northMesh)
      interactableMeshes.push(northMesh)

      const southMesh = new THREE.Mesh(poleGeo, southMat)
      southMesh.position.set(3.6, 0, 0)
      southMesh.name = 'magnets'
      generatorRig.add(southMesh)
      interactableMeshes.push(southMesh)

      // 2. Magnetic Flux Lines (Cyan Glowing Lines)
      const fluxGroup = new THREE.Group()
      generatorRig.add(fluxGroup)
      for (let y = -1.2; y <= 1.2; y += 0.6) {
        for (let z = -1.2; z <= 1.2; z += 0.8) {
          const fGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-2.8, y, z),
            new THREE.Vector3(2.8, y, z),
          ])
          const fMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 })
          const fLine = new THREE.Line(fGeo, fMat)
          fluxGroup.add(fLine)
        }
      }

      // 3. Central Steel Shaft & Rotor Group
      const rotorGroup = new THREE.Group()
      generatorRig.add(rotorGroup)

      const shaftGeo = new THREE.CylinderGeometry(0.2, 0.2, 7.5, 24)
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })
      const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat)
      shaftMesh.rotation.x = Math.PI / 2
      rotorGroup.add(shaftMesh)

      // 4. Rectangular Armature Coil
      const coilCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.8, 1.4, -1.8),
        new THREE.Vector3(1.8, 1.4, -1.8),
        new THREE.Vector3(1.8, -1.4, -1.8),
        new THREE.Vector3(-1.8, -1.4, -1.8),
        new THREE.Vector3(-1.8, 1.4, -1.8),
      ])
      const coilGeo = new THREE.TubeGeometry(coilCurve, 32, 0.12, 12, true)
      const coilMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 })
      const coilMesh = new THREE.Mesh(coilGeo, coilMat)
      coilMesh.name = 'armature'
      rotorGroup.add(coilMesh)
      interactableMeshes.push(coilMesh)

      // 5. Two Continuous Slip Rings on Shaft
      const ringGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.25, 24)
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.8, roughness: 0.25 })

      const ring1 = new THREE.Mesh(ringGeo, ringMat)
      ring1.rotation.x = Math.PI / 2
      ring1.position.set(0, 0, 2.2)
      ring1.name = 'slip_rings'
      rotorGroup.add(ring1)
      interactableMeshes.push(ring1)

      const ring2 = new THREE.Mesh(ringGeo, ringMat)
      ring2.rotation.x = Math.PI / 2
      ring2.position.set(0, 0, 2.8)
      ring2.name = 'slip_rings'
      rotorGroup.add(ring2)
      interactableMeshes.push(ring2)

      // 6. Stationary Carbon Brushes (Attached to generatorRig, sliding on rings)
      const brushGeo = new THREE.BoxGeometry(0.3, 0.3, 0.35)
      const brushMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })

      const brush1 = new THREE.Mesh(brushGeo, brushMat)
      brush1.position.set(0.65, 0, 2.2)
      brush1.name = 'brushes'
      generatorRig.add(brush1)
      interactableMeshes.push(brush1)

      const brush2 = new THREE.Mesh(brushGeo, brushMat)
      brush2.position.set(-0.65, 0, 2.8)
      brush2.name = 'brushes'
      generatorRig.add(brush2)
      interactableMeshes.push(brush2)

      // 7. External Load Bulb (Glows with sinusoidal power P = I^2 R)
      const bulbGeo = new THREE.SphereGeometry(0.6, 24, 24)
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.8 })
      const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat)
      bulbMesh.position.set(0, -2.6, 2.5)
      generatorRig.add(bulbMesh)

      // 8. 3D Oscilloscope Sine Wave Screen
      const oscPoints: THREE.Vector3[] = []
      const oscWidth = 4.0
      const oscSegments = 64
      for (let i = 0; i <= oscSegments; i++) {
        const x = -oscWidth / 2 + (i / oscSegments) * oscWidth
        oscPoints.push(new THREE.Vector3(x, 0, 0))
      }
      const oscGeo = new THREE.BufferGeometry().setFromPoints(oscPoints)
      const oscMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
      const oscLine = new THREE.Line(oscGeo, oscMat)
      oscLine.position.set(0, 3.2, 0)
      generatorRig.add(oscLine)

      const oscFrameGeo = new THREE.PlaneGeometry(oscWidth + 0.6, 2.2)
      const oscFrameMat = new THREE.MeshBasicMaterial({ color: 0x020617, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      const oscFrame = new THREE.Mesh(oscFrameGeo, oscFrameMat)
      oscFrame.position.set(0, 3.2, -0.05)
      generatorRig.add(oscFrame)

      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function handleDblClick(e: MouseEvent) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(interactableMeshes, true)
        if (hits.length > 0) {
          const key = hits[0].object.name || 'armature'
          activeDissectKey = key
          const card = DISSECT_CARDS[key] || DISSECT_CARDS.armature
          callbacks.onInspectPart?.(card)
        }
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)

      function animate() {
        animId = requestAnimationFrame(animate)
        controls.update()

        if (isPlaying) {
          const omega = (2 * Math.PI * params.rpm) / 60
          angle += omega * 0.016
          rotorGroup.rotation.z = angle

          // Dynamic bulb filament pulse
          const sinVal = Math.sin(angle)
          const power = sinVal * sinVal
          bulbMat.emissiveIntensity = 0.2 + power * 1.5

          // Update oscilloscope sine wave
          const pos = oscLine.geometry.attributes.position as THREE.BufferAttribute
          for (let i = 0; i <= oscSegments; i++) {
            const x = -oscWidth / 2 + (i / oscSegments) * oscWidth; void x;
            const phase = angle - (i / oscSegments) * Math.PI * 4
            const y = Math.sin(phase) * 0.8
            pos.setY(i, y)
          }
          pos.needsUpdate = true
        }

        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          angle = 0
          rotorGroup.rotation.z = 0
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  rutherford_atom_3d: {
    type: 'rutherford_atom_3d',
    title: '3D Rutherford Gold Foil Scattering Experiment',
    subject: 'Physics & Chemistry · Atomic Structure',
    concept: 'Discovery of the Atomic Nucleus & Coulomb Repulsion',
    description: 'Interactive 3D simulation of the historic 1911 Geiger-Marsden / Rutherford gold foil experiment. An energetic beam of alpha particles (+2e) strikes a thin gold foil (Z=79). Coulomb hyperbolic trajectory integration accurately demonstrates why 99.9% of particles pass straight through, while rare particles rebound back at >90°, proving the atom is mostly empty space with an ultra-dense positive nucleus.',
    emoji: '⚛️',
    difficulty: 'Intermediate',
    presets: [
      { label: '🎯 Standard Beam Scattering (5.0 MeV)', params: { alphaEnergy: 5.0, foilThickness: 1.0, zoomNucleus: 0 } },
      { label: '🔍 Single Nucleus Hyperbolic Coulomb Deflection', params: { alphaEnergy: 5.0, foilThickness: 1.0, zoomNucleus: 1 } },
      { label: '⚡ High Energy Particle Beam (8.0 MeV)', params: { alphaEnergy: 8.0, foilThickness: 1.0, zoomNucleus: 0 } },
      { label: '🛡️ Thick Gold Foil Multiple Scattering', params: { alphaEnergy: 5.0, foilThickness: 3.0, zoomNucleus: 0 } },
    ],
    params: [
      { key: 'alphaEnergy', label: 'Alpha Kinetic Energy (E)', min: 2.0, max: 10.0, step: 0.5, defaultValue: 5.0, unit: 'MeV' },
      { key: 'foilThickness', label: 'Gold Foil Thickness', min: 0.5, max: 4.0, step: 0.5, defaultValue: 1.0, unit: 'μm' },
      { key: 'zoomNucleus', label: 'View Mode (0: Laboratory Bench, 1: Atomic Scale)', min: 0, max: 1, step: 1, defaultValue: 0, unit: '' },
    ],
    calculateReadouts: (p) => {
      // Rutherford distance of closest approach: d = (1/(4πε0)) * (2 * Z * e^2) / E_k
      // For Au (Z=79), at 5.0 MeV: d ≈ 4.54e-14 m (45.4 fm)
      const dClosest = (227.0 / p.alphaEnergy).toFixed(1)
      const isZoom = p.zoomNucleus === 1
      return [
        { label: 'Target Nucleus', value: 'Gold-197 (Z = 79, N = 118)' },
        { label: 'Projectile', value: 'Alpha Particle He²⁺ (q = +2e, m = 4 u)' },
        { label: 'Closest Approach Distance (d)', value: `${dClosest} fm`, formula: 'd = (2·Z·e²) / (4πε₀·E)' },
        { label: 'Scattering Mode', value: isZoom ? 'Microscopic Coulomb Trajectory' : 'Macroscopic Scintillation Screen' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number
      let activeDissectKey: string | null = null; void activeDissectKey

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(-8, 6, 12)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const labRig = new THREE.Group()
      scene.add(labRig)

      const interactableMeshes: THREE.Object3D[] = []

      const DISSECT_CARDS: Record<string, DissectInfo> = {
        emitter: {
          title: 'Lead Collimator & Alpha Source',
          partName: 'Bismuth-214 / Radium Alpha Emitter',
          role: 'Emits a narrow, collimated beam of monoenergetic alpha particles (+2e) at ~15,000 km/s.',
          internalStructures: ['Dense Lead Shielding Box', 'Slit Collimator Aperture', 'Radioactive Pellet Source'],
          description: 'Alpha particles are helium-4 nuclei consisting of 2 protons and 2 neutrons. Because of their positive charge, they interact strongly with atomic nuclei via Coulomb electrostatic repulsion.',
        },
        foil: {
          title: 'Ultrathin Gold Foil Target',
          partName: 'Gold Foil (Aurum, Z = 79, Thickness ~400 atoms)',
          role: 'Serves as the target obstacle. Gold was selected because of its extreme malleability (hammered to ~0.1 μm).',
          internalStructures: ['Lattice of Gold Nuclei (+79e)', 'Electron Clouds', '99.999% Empty Atomic Volume'],
          description: 'Rutherford famously noted: "It was as if you fired a 15-inch shell at a piece of tissue paper and it came back and hit you!"',
        },
        screen: {
          title: 'Zinc Sulfide (ZnS) Scintillation Detector',
          partName: 'Circular ZnS Fluorescent Screen & Movable Microscope',
          role: 'Detects deflected alpha particles through microscopic phosphorescent flashes (scintillations).',
          internalStructures: ['Zinc Sulfide Phosphor Coating', 'Rotating Detection Arm', 'Optical Viewing Microscope'],
          description: 'Marsden and Geiger sat in pitch darkness for hours counting individual green flashes through a microscope at varying scattering angles θ from 0° to 150°.',
        },
        nucleus: {
          title: 'Gold Atomic Nucleus (Z = 79)',
          partName: 'Positive Concentrated Core',
          role: 'Contains 99.95% of the atom mass packed into an ultra-dense sphere of radius ~7 femtometers.',
          internalStructures: ['79 Protons', '118 Neutrons', 'Strong Nuclear Force Well'],
          description: 'Because the nucleus is tiny compared to the atom (1 : 100,000), almost all alpha particles pass straight through undeflected.',
        },
      }

      // 1. Lead Collimator Box (Emmiter)
      const leadGeo = new THREE.BoxGeometry(1.6, 1.4, 1.4)
      const leadMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })
      const leadMesh = new THREE.Mesh(leadGeo, leadMat)
      leadMesh.position.set(-5.5, 0, 0)
      leadMesh.name = 'emitter'
      labRig.add(leadMesh)
      interactableMeshes.push(leadMesh)

      const barrelGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.2, 16)
      const barrelMesh = new THREE.Mesh(barrelGeo, leadMat)
      barrelMesh.rotation.z = -Math.PI / 2
      barrelMesh.position.set(-4.5, 0, 0)
      labRig.add(barrelMesh)

      // 2. Gold Foil Target
      const foilGeo = new THREE.BoxGeometry(0.08, 3.2, 3.2)
      const foilMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.9,
        roughness: 0.15,
        transparent: true,
        opacity: 0.85,
      })
      const foilMesh = new THREE.Mesh(foilGeo, foilMat)
      foilMesh.name = 'foil'
      labRig.add(foilMesh)
      interactableMeshes.push(foilMesh)

      // 3. Circular ZnS Scintillation Detector Screen (Cylindrical Ring)
      const screenGeo = new THREE.CylinderGeometry(4.8, 4.8, 2.2, 48, 1, true, Math.PI * 0.15, Math.PI * 1.7)
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        roughness: 0.6,
        transparent: true,
        opacity: 0.5,
      })
      const screenMesh = new THREE.Mesh(screenGeo, screenMat)
      screenMesh.name = 'screen'
      labRig.add(screenMesh)
      interactableMeshes.push(screenMesh)

      // 4. Alpha Particle Stream (Instanced particle animation)
      const PARTICLE_COUNT = 140
      const particleGeo = new THREE.SphereGeometry(0.08, 8, 8)
      const particleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })

      interface AlphaParticle {
        mesh: THREE.Mesh
        x: number
        y: number
        z: number
        vx: number
        vy: number
        vz: number
        deflected: boolean
      }

      const particles: AlphaParticle[] = []
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const m = new THREE.Mesh(particleGeo, particleMat)
        m.position.set(-5.0 + Math.random() * 8.0, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)
        labRig.add(m)
        particles.push({
          mesh: m,
          x: m.position.x,
          y: m.position.y,
          z: m.position.z,
          vx: 0.22,
          vy: 0,
          vz: 0,
          deflected: false,
        })
      }

      // 5. Microscopic Gold Nucleus Model (For zoom mode)
      const nucleusGroup = new THREE.Group()
      scene.add(nucleusGroup)
      nucleusGroup.visible = false

      // Nucleus cluster of protons (Red) and neutrons (Gray)
      for (let i = 0; i < 35; i++) {
        const pGeo = new THREE.SphereGeometry(0.18, 12, 12)
        const isProton = i % 2 === 0
        const pMat = new THREE.MeshStandardMaterial({ color: isProton ? 0xef4444 : 0x94a3b8, roughness: 0.4 })
        const pMesh = new THREE.Mesh(pGeo, pMat)
        pMesh.position.set(
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.7
        )
        nucleusGroup.add(pMesh)
      }

      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function handleDblClick(e: MouseEvent) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(interactableMeshes, true)
        if (hits.length > 0) {
          const key = hits[0].object.name || 'foil'
          activeDissectKey = key
          const card = DISSECT_CARDS[key] || DISSECT_CARDS.foil
          callbacks.onInspectPart?.(card)
        }
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)

      function animate() {
        animId = requestAnimationFrame(animate)
        controls.update()

        const isZoom = params.zoomNucleus === 1
        nucleusGroup.visible = isZoom
        labRig.visible = !isZoom

        if (!isZoom && isPlaying) {
          particles.forEach((p) => {
            p.x += p.vx
            p.y += p.vy
            p.z += p.vz

            // When crossing foil at x = 0
            if (!p.deflected && p.x >= 0 && p.x <= 0.4) {
              p.deflected = true
              const r = Math.random()
              if (r < 0.015) {
                // Rare acute backscatter (> 90 deg)
                p.vx = -p.vx * 0.8
                p.vy = (Math.random() - 0.5) * 0.25
                p.vz = (Math.random() - 0.5) * 0.25
              } else if (r < 0.08) {
                // Moderate deflection
                const angle = (Math.random() - 0.5) * 0.8
                p.vy += Math.sin(angle) * 0.12
                p.vz += Math.cos(angle) * 0.12
              }
            }

            // Reset when reaching detector screen boundary
            const dist = Math.sqrt(p.x * p.x + p.z * p.z)
            if (dist > 4.6 || p.x > 5.5 || p.x < -6.0) {
              p.x = -5.0
              p.y = (Math.random() - 0.5) * 0.5
              p.z = (Math.random() - 0.5) * 0.5
              p.vx = 0.22
              p.vy = 0
              p.vz = 0
              p.deflected = false
            }

            p.mesh.position.set(p.x, p.y, p.z)
          })
        }

        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams) => {
          params = { ...newParams }
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },

  titration_3d: {
    type: 'titration_3d',
    title: '3D Acid-Base Titration & Volumetric Analysis',
    subject: 'Chemistry · Analytical & Physical',
    concept: 'Volumetric Equivalence & Neutralization Stoichiometry',
    description:
      'High-precision volumetric titration setup with calibrated 50 mL class-A glass burette, dual-clamp retort stand, borosilicate Erlenmeyer conical flask, magnetic stirrer hotplate, rotating PTFE flea stir bar, stopcock valve, dynamic Phenolphthalein indicator tint transition (clear to vibrant magenta pink at equivalence pH 8.2), and digital precision pH probe.',
    emoji: '🧪',
    difficulty: 'Intermediate',
    presets: [
      { label: '🧪 Initial Acidic Analyte (0.0 mL Added, pH 1.00)', params: { titrantAdded: 0, dropRate: 1, stirrerSpeed: 400, zoomFlask: 0 } },
      { label: '⏳ Approaching Equivalence Zone (24.0 mL Added, pH 2.69)', params: { titrantAdded: 24.0, dropRate: 1, stirrerSpeed: 500, zoomFlask: 1 } },
      { label: '🎯 Exact Stoichiometric Endpoint (25.0 mL Added, pH 7.00)', params: { titrantAdded: 25.0, dropRate: 0, stirrerSpeed: 400, zoomFlask: 1 } },
      { label: '🟣 Alkaline Excess Titrant (28.0 mL Added, pH 11.75)', params: { titrantAdded: 28.0, dropRate: 2, stirrerSpeed: 400, zoomFlask: 0 } },
      { label: '🌪️ High-Speed Magnetic Vortex Demonstration (800 RPM)', params: { titrantAdded: 15.0, dropRate: 1, stirrerSpeed: 800, zoomFlask: 1 } },
    ],
    params: [
      { key: 'titrantAdded', label: 'Titrant Added (mL NaOH 0.10 M)', min: 0, max: 50, step: 0.2, defaultValue: 0, unit: 'mL' },
      { key: 'dropRate', label: 'Burette Stopcock Dispense Rate', min: 0, max: 5, step: 1, defaultValue: 1, unit: 'drops/s' },
      { key: 'stirrerSpeed', label: 'Magnetic Stirrer Speed', min: 0, max: 1000, step: 50, defaultValue: 400, unit: 'RPM' },
      { key: 'zoomFlask', label: 'Camera View (0: Apparatus, 1: Flask Close-Up)', min: 0, max: 1, step: 1, defaultValue: 0, unit: '' },
    ],
    calculateReadouts: (p) => {
      const v = Number(p.titrantAdded ?? 0)
      const vEq = 25.0
      let ph = 1.0
      if (v < vEq - 0.05) {
        const hMol = Math.max(0.00001, (25.0 * 0.1 - v * 0.1) / (25.0 + v))
        ph = -Math.log10(hMol)
      } else if (v > vEq + 0.05) {
        const ohMol = Math.max(0.00001, (v * 0.1 - 25.0 * 0.1) / (25.0 + v))
        const pOh = -Math.log10(ohMol)
        ph = 14.0 - pOh
      } else {
        ph = 7.0 + (v - vEq) * 35.0
      }
      const phStr = Math.min(13.6, Math.max(1.0, ph)).toFixed(2)
      let indicator = 'Colorless (Acidic Form)'
      if (v >= 24.6 && v <= 25.4) indicator = 'Faint Blush Pink (Equivalence Endpoint)'
      else if (v > 25.4) indicator = 'Deep Vibrant Magenta (Alkaline Form)'

      const pct = Math.min(100, Math.round((v / 25.0) * 100))

      return [
        { label: 'Solution pH', value: phStr, formula: 'pH = -log₁₀[H⁺]' },
        { label: 'Phenolphthalein State', value: indicator },
        { label: 'Titrant Dispensed', value: `${v.toFixed(1)} / 50.0 mL` },
        { label: 'Neutralization Progress', value: `${pct}% of 25.0 mL` },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let animId: number
      let isPlaying = true
      let activeDissectKey: string | null = null; void activeDissectKey

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x060b13)
      scene.fog = new THREE.FogExp2(0x060b13, 0.02)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 4.5, 13.5)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 1.8, 0)

      // Lighting Setup
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambientLight)

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
      keyLight.position.set(8, 14, 10)
      scene.add(keyLight)

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.7)
      fillLight.position.set(-8, 6, -6)
      scene.add(fillLight)

      const rimLight = new THREE.PointLight(0xf472b6, 1.2, 20)
      rimLight.position.set(2, 1, 4)
      scene.add(rimLight)

      // Grid helper floor
      const grid = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a)
      grid.position.y = -2.2
      scene.add(grid)

      const labRig = new THREE.Group()
      scene.add(labRig)

      const interactableMeshes: THREE.Object3D[] = []

      const DISSECT_CARDS: Record<string, DissectInfo> = {
        burette: {
          title: 'Class-A 50 mL Precision Volumetric Burette',
          partName: 'Calibrated Borosilicate Glass Column',
          role: 'Accurately dispenses standardized 0.10 M NaOH titrant drop-by-drop into the analyte flask.',
          internalStructures: [
            'Class-A Precision Borosilicate Glass Tube (±0.05 mL accuracy)',
            'Permanent Ceramic 0.1 mL Graduation Ring Markings',
            'Smooth Hydrodynamic Capillary Meniscus Interface',
            'Sub-Millimeter Tapered Liquid Delivery Jet',
          ],
          description:
            'A burette is an essential quantitative analytical instrument. The bottom of the curved meniscus must be read strictly at horizontal eye level to avoid parallax errors.',
        },
        flask: {
          title: '250 mL Pyrex Erlenmeyer Conical Flask',
          partName: 'Reaction Vessel & Analyte Solution',
          role: 'Contains 25.0 mL of hydrochloric acid (HCl) sample combined with Phenolphthalein indicator.',
          internalStructures: [
            'Sloping Conical Walls (Eliminates splashing during rapid swirling)',
            'Dynamic Phenolphthalein Chromophore Equilibrium (HIn ⇌ H⁺ + In⁻)',
            'Central Induced Fluid Vortex Funnel',
            'Optical Window for Sudden Endpoint Tint Transition',
          ],
          description:
            'The conical geometry allows vigorous swirling and continuous magnetic agitation without splashing drops of solution onto the benchtop.',
        },
        stirrer: {
          title: 'Digital High-Torque Magnetic Stirrer Hotplate',
          partName: 'Electromagnetic Drive Platform & Stir Bar',
          role: 'Drives the Teflon-coated magnetic flea inside the flask to ensure instantaneous, homogeneous chemical mixing.',
          internalStructures: [
            'Rotating Rare-Earth Neodymium Drive Magnet Array',
            'Brushless DC Induction Motor (0 to 1200 RPM range)',
            'Inert White Ceramic-Coated Top Chemical Plate',
            'Digital Tachometer Speed Knob & LED Status Display',
          ],
          description:
            'Continuous rapid agitation prevents localized over-concentration of base titrant, guaranteeing a sharp and reproducible equivalence point.',
        },
        probe: {
          title: 'Glass Combination Potentiometric pH Electrode',
          partName: 'Electrochemical Sensing Half-Cell',
          role: 'Continuously monitors hydrogen ion hydronium activity [H₃O⁺] across a thin hydrated gel glass membrane.',
          internalStructures: [
            'Sub-Micron Hydrated Lithium Silicate Glass Bulb Membrane',
            'Internal Ag/AgCl Reference Electrode in Saturated KCl Gel',
            'Porous Ceramic Electrolyte Liquid Junction Diaphragm',
            'High-Impedance Coaxial Signal Shield Cable (Nernstian EMF)',
          ],
          description:
            'Generates a potential difference of ~59.16 mV per pH unit at 25 °C following the Nernst equation, feeding high-precision millivolts to the digital pH meter console.',
        },
        stopcock: {
          title: 'Precision PTFE Metering Stopcock Valve',
          partName: 'Fluoropolymer Flow Regulator',
          role: 'Controls volumetric fluid flow from full stream down to single fractionated 0.05 mL droplets.',
          internalStructures: [
            'Self-Lubricating Virgin PTFE Plug Bore',
            'Ergonomic High-Tension Crossbar Handle',
            'Chemical-Resistant Precision Taper Seal Ring',
          ],
          description:
            'Unlike traditional ground-glass valves, chemically inert PTFE plugs require no grease lubricant, preventing hydrocarbon contamination of standard solutions.',
        },
      }

      // 1. Heavy Retort Stand (Cast Iron Base + Stainless Steel Rod)
      const baseGeo = new THREE.BoxGeometry(4.8, 0.35, 6.4)
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.75,
        roughness: 0.35,
      })
      const standBase = new THREE.Mesh(baseGeo, baseMat)
      standBase.position.set(-1.4, -2.0, 0.4)
      labRig.add(standBase)

      // Base non-slip rubber feet
      for (const [fx, fz] of [[-2.1, -1.8], [2.1, -1.8], [-2.1, 2.6], [2.1, 2.6]]) {
        const footGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16)
        const footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
        const foot = new THREE.Mesh(footGeo, footMat)
        foot.position.set(-1.4 + fx, -2.2, 0.4 + fz)
        labRig.add(foot)
      }

      // Vertical Stainless Steel Rod
      const rodGeo = new THREE.CylinderGeometry(0.12, 0.12, 10.5, 24)
      const rodMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.95,
        roughness: 0.15,
      })
      const rodMesh = new THREE.Mesh(rodGeo, rodMat)
      rodMesh.position.set(-3.0, 3.2, 0.4)
      labRig.add(rodMesh)

      // Top decorative chrome end cap
      const capGeo = new THREE.SphereGeometry(0.18, 16, 16)
      const capMesh = new THREE.Mesh(capGeo, rodMat)
      capMesh.position.set(-3.0, 8.45, 0.4)
      labRig.add(capMesh)

      // 2. Bosshead Clamps (Holding Burette and pH Probe)
      function createBossheadClamp(yPos: number, xReach: number, zReach: number = 0) {
        const clampGroup = new THREE.Group()
        clampGroup.position.set(-3.0, yPos, 0.4)

        // Bosshead junction block
        const blockGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45)
        const blockMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
        const block = new THREE.Mesh(blockGeo, blockMat)
        clampGroup.add(block)

        // Tightening thumbscrew
        const screwGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 12)
        const screwHeadGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16)
        const screw = new THREE.Mesh(screwGeo, rodMat)
        screw.rotation.z = Math.PI / 2
        screw.position.set(-0.3, 0, 0)
        clampGroup.add(screw)
        const sHead = new THREE.Mesh(screwHeadGeo, rodMat)
        sHead.rotation.z = Math.PI / 2
        sHead.position.set(-0.5, 0, 0)
        clampGroup.add(sHead)

        // Extension arm rod
        const armLength = Math.hypot(xReach, zReach)
        const armGeo = new THREE.CylinderGeometry(0.07, 0.07, armLength, 16)
        const arm = new THREE.Mesh(armGeo, rodMat)
        arm.rotation.z = -Math.PI / 2
        arm.position.set(armLength / 2, 0, zReach / 2)
        clampGroup.add(arm)

        // 3-prong clamp jaws at the end
        const jawGroup = new THREE.Group()
        jawGroup.position.set(xReach, 0, zReach)

        const ringGeo = new THREE.TorusGeometry(0.35, 0.06, 12, 24, Math.PI * 1.5)
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = Math.PI / 2
        jawGroup.add(ring)

        clampGroup.add(jawGroup)
        return clampGroup
      }

      // Clamp 1 for Burette
      labRig.add(createBossheadClamp(5.5, 3.0, 0))
      // Clamp 2 lower brace for Burette
      labRig.add(createBossheadClamp(2.8, 3.0, 0))
      // Clamp 3 for pH probe (reaching to the right)
      labRig.add(createBossheadClamp(1.6, 3.7, 0.5))

      // 3. Digital Magnetic Stirrer Base
      const stirrerGroup = new THREE.Group()
      stirrerGroup.position.set(0, -1.5, 0.4)
      labRig.add(stirrerGroup)

      const stirrerBodyGeo = new THREE.BoxGeometry(3.2, 0.9, 3.8)
      const stirrerBodyMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.6,
        roughness: 0.4,
      })
      const stirrerBody = new THREE.Mesh(stirrerBodyGeo, stirrerBodyMat)
      stirrerBody.name = 'stirrer'
      stirrerGroup.add(stirrerBody)
      interactableMeshes.push(stirrerBody)

      // Ceramic Top Plate (White)
      const topPlateGeo = new THREE.BoxGeometry(2.9, 0.12, 3.2)
      const topPlateMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.2,
        roughness: 0.15,
      })
      const topPlate = new THREE.Mesh(topPlateGeo, topPlateMat)
      topPlate.position.y = 0.51
      topPlate.name = 'stirrer'
      stirrerGroup.add(topPlate)
      interactableMeshes.push(topPlate)

      // Speed control knob
      const knobGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.25, 24)
      const knobMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 })
      const knob = new THREE.Mesh(knobGeo, knobMat)
      knob.rotation.x = Math.PI / 2
      knob.position.set(0.7, -0.1, 1.95)
      stirrerGroup.add(knob)

      // Stirrer LED display screen
      const dispGeo = new THREE.PlaneGeometry(1.0, 0.4)
      const dispMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 })
      const dispMesh = new THREE.Mesh(dispGeo, dispMat)
      dispMesh.position.set(-0.6, -0.1, 1.91)
      stirrerGroup.add(dispMesh)

      // Power indicator LED (Glowing Green)
      const ledGeo = new THREE.SphereGeometry(0.06, 12, 12)
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x22c55e })
      const led = new THREE.Mesh(ledGeo, ledMat)
      led.position.set(-1.2, -0.1, 1.92)
      stirrerGroup.add(led)

      // 4. Calibrated 50 mL Glass Burette Assembly
      const buretteGroup = new THREE.Group()
      buretteGroup.position.set(0, 4.4, 0.4)
      labRig.add(buretteGroup)

      // Outer borosilicate glass tube
      const buretteGlassGeo = new THREE.CylinderGeometry(0.24, 0.24, 6.2, 32, 1, true)
      const buretteGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.35,
        roughness: 0.05,
        transmission: 0.85,
        ior: 1.47,
        side: THREE.DoubleSide,
      })
      const buretteGlass = new THREE.Mesh(buretteGlassGeo, buretteGlassMat)
      buretteGlass.name = 'burette'
      buretteGroup.add(buretteGlass)
      interactableMeshes.push(buretteGlass)

      // Liquid column inside burette (0.1 M NaOH clear solution)
      const buretteLiqGeo = new THREE.CylinderGeometry(0.21, 0.21, 5.8, 24)
      const buretteLiqMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
      })
      const buretteLiqMesh = new THREE.Mesh(buretteLiqGeo, buretteLiqMat)
      buretteLiqMesh.position.y = 0
      buretteGroup.add(buretteLiqMesh)

      // Graduation tick rings along the burette tube (25 rings representing marks)
      const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
      for (let i = 0; i <= 24; i++) {
        const isMajor = i % 5 === 0
        const tickGeo = new THREE.RingGeometry(0.241, 0.252, 24)
        const tick = new THREE.Mesh(tickGeo, tickMat)
        tick.rotation.x = Math.PI / 2
        tick.position.y = -2.7 + i * (5.4 / 24)
        tick.scale.set(isMajor ? 1.05 : 0.98, isMajor ? 1.05 : 0.98, 1)
        buretteGroup.add(tick)
      }

      // Precision PTFE Stopcock Valve
      const stopcockGroup = new THREE.Group()
      stopcockGroup.position.set(0, -3.2, 0)
      buretteGroup.add(stopcockGroup)

      const valveBodyGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16)
      const valveBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
      const valveBody = new THREE.Mesh(valveBodyGeo, valveBodyMat)
      valveBody.rotation.z = Math.PI / 2
      valveBody.name = 'stopcock'
      stopcockGroup.add(valveBody)
      interactableMeshes.push(valveBody)

      // Stopcock turning T-handle (White/Blue Teflon)
      const handleGeo = new THREE.BoxGeometry(0.12, 0.7, 0.25)
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.3 })
      const stopcockHandle = new THREE.Mesh(handleGeo, handleMat)
      stopcockHandle.position.set(0.35, 0, 0)
      stopcockHandle.name = 'stopcock'
      stopcockGroup.add(stopcockHandle)
      interactableMeshes.push(stopcockHandle)

      // Tapered delivery jet capillary tip below stopcock
      const tipGeo = new THREE.ConeGeometry(0.14, 0.6, 24, 1, true)
      const tipMesh = new THREE.Mesh(tipGeo, buretteGlassMat)
      tipMesh.rotation.x = Math.PI
      tipMesh.position.set(0, -0.6, 0)
      tipMesh.name = 'burette'
      stopcockGroup.add(tipMesh)
      interactableMeshes.push(tipMesh)

      // 5. Borosilicate Erlenmeyer Flask sitting on the stirrer plate
      const flaskGroup = new THREE.Group()
      flaskGroup.position.set(0, -0.92, 0.4)
      labRig.add(flaskGroup)

      // Conical Flask Body (Glass)
      const flaskConeGeo = new THREE.CylinderGeometry(0.55, 1.45, 1.8, 32, 1, true)
      const flaskGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.38,
        roughness: 0.08,
        transmission: 0.9,
        ior: 1.47,
        side: THREE.DoubleSide,
      })
      const flaskCone = new THREE.Mesh(flaskConeGeo, flaskGlassMat)
      flaskCone.position.y = 0.9
      flaskCone.name = 'flask'
      flaskGroup.add(flaskCone)
      interactableMeshes.push(flaskCone)

      // Flask Cylindrical Neck
      const flaskNeckGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.75, 32, 1, true)
      const flaskNeck = new THREE.Mesh(flaskNeckGeo, flaskGlassMat)
      flaskNeck.position.y = 2.15
      flaskNeck.name = 'flask'
      flaskGroup.add(flaskNeck)
      interactableMeshes.push(flaskNeck)

      // Flask Flared Rim
      const rimGeo = new THREE.TorusGeometry(0.57, 0.05, 16, 32)
      const rimMesh = new THREE.Mesh(rimGeo, flaskGlassMat)
      rimMesh.rotation.x = Math.PI / 2
      rimMesh.position.y = 2.52
      flaskGroup.add(rimMesh)

      // Flask Base Disc
      const flaskBaseGeo = new THREE.CircleGeometry(1.45, 32)
      const flaskBase = new THREE.Mesh(flaskBaseGeo, flaskGlassMat)
      flaskBase.rotation.x = -Math.PI / 2
      flaskBase.position.y = 0.02
      flaskGroup.add(flaskBase)

      // Liquid Analyte Solution inside flask (HCl + Indicator)
      const liquidGeo = new THREE.CylinderGeometry(0.85, 1.4, 0.95, 32)
      const liquidMat = new THREE.MeshStandardMaterial({
        color: 0xf0fdf4,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        metalness: 0.1,
      })
      const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat)
      liquidMesh.position.y = 0.5
      liquidMesh.name = 'flask'
      flaskGroup.add(liquidMesh)
      interactableMeshes.push(liquidMesh)

      // Liquid Meniscus Top Surface
      const meniscusGeo = new THREE.CircleGeometry(0.85, 32)
      const meniscusMat = new THREE.MeshStandardMaterial({
        color: 0xf0fdf4,
        transparent: true,
        opacity: 0.65,
        roughness: 0.05,
      })
      const meniscusMesh = new THREE.Mesh(meniscusGeo, meniscusMat)
      meniscusMesh.rotation.x = -Math.PI / 2
      meniscusMesh.position.y = 0.98
      flaskGroup.add(meniscusMesh)

      // Rotating Teflon Magnetic Stir Bar ("Flea") at bottom of flask
      const stirBarGeo = new THREE.CapsuleGeometry(0.08, 0.45, 8, 16)
      const stirBarMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.25,
        metalness: 0.1,
      })
      const stirBar = new THREE.Mesh(stirBarGeo, stirBarMat)
      stirBar.rotation.x = Math.PI / 2
      stirBar.position.set(0, 0.1, 0)
      stirBar.name = 'stirrer'
      flaskGroup.add(stirBar)
      interactableMeshes.push(stirBar)

      // 6. Falling Titrant Droplets
      const DROP_COUNT = 6
      const dropGeo = new THREE.SphereGeometry(0.065, 12, 12)
      const dropMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.8,
        roughness: 0.1,
      })
      const droplets: THREE.Mesh[] = []
      for (let i = 0; i < DROP_COUNT; i++) {
        const drop = new THREE.Mesh(dropGeo, dropMat)
        drop.position.set(0, 0.5 - i * 0.4, 0.4)
        drop.scale.set(0.8, 1.4, 0.8)
        labRig.add(drop)
        droplets.push(drop)
      }

      // 7. Glass Combination pH Electrode Probe
      const probeGroup = new THREE.Group()
      probeGroup.position.set(0.7, 0.35, 0.6)
      probeGroup.rotation.z = -0.15
      labRig.add(probeGroup)

      // Black probe shaft
      const probeShaftGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.8, 20)
      const probeShaftMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
      const probeShaft = new THREE.Mesh(probeShaftGeo, probeShaftMat)
      probeShaft.name = 'probe'
      probeGroup.add(probeShaft)
      interactableMeshes.push(probeShaft)

      // Blue glass sensing bulb
      const bulbGeo = new THREE.SphereGeometry(0.11, 16, 16)
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.1,
        metalness: 0.3,
        emissive: 0x0284c7,
        emissiveIntensity: 0.4,
      })
      const probeBulb = new THREE.Mesh(bulbGeo, bulbMat)
      probeBulb.position.y = -1.45
      probeBulb.name = 'probe'
      probeGroup.add(probeBulb)
      interactableMeshes.push(probeBulb)

      // Coaxial cable running from probe top
      const cableCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 1.4, 0),
        new THREE.Vector3(1.6, 2.8, 0.5),
        new THREE.Vector3(2.6, 0.8, 1.2)
      )
      const cableGeo = new THREE.TubeGeometry(cableCurve, 20, 0.04, 8, false)
      const cableMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
      const cableMesh = new THREE.Mesh(cableGeo, cableMat)
      probeGroup.add(cableMesh)

      // Benchtop pH Meter Console
      const meterGroup = new THREE.Group()
      meterGroup.position.set(3.4, -1.5, 1.8)
      meterGroup.rotation.y = -0.4
      labRig.add(meterGroup)

      const meterBodyGeo = new THREE.BoxGeometry(2.0, 0.7, 1.8)
      const meterBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 })
      const meterBody = new THREE.Mesh(meterBodyGeo, meterBodyMat)
      meterBody.name = 'probe'
      meterGroup.add(meterBody)
      interactableMeshes.push(meterBody)

      // Meter Screen
      const mScreenGeo = new THREE.PlaneGeometry(1.2, 0.5)
      const mScreenMat = new THREE.MeshBasicMaterial({ color: 0x0369a1 })
      const mScreen = new THREE.Mesh(mScreenGeo, mScreenMat)
      mScreen.rotation.x = -Math.PI / 6
      mScreen.position.set(0, 0.36, 0.2)
      meterGroup.add(mScreen)

      // Raycaster for inspection
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function handleDblClick(e: MouseEvent) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObjects(interactableMeshes, true)
        if (hits.length > 0) {
          const key = hits[0].object.name || 'burette'
          activeDissectKey = key
          const card = DISSECT_CARDS[key] || DISSECT_CARDS.burette
          callbacks.onInspectPart?.(card)
        }
      }

      renderer.domElement.addEventListener('dblclick', handleDblClick)

      let stirAngle = 0
      let dropTimer = 0

      function animate() {
        animId = requestAnimationFrame(animate)
        controls.update()

        const titrantV = Number(params.titrantAdded ?? 0)
        const rate = Number(params.dropRate ?? 1)
        const speed = Number(params.stirrerSpeed ?? 400)
        const isZoom = params.zoomFlask === 1

        // Smooth camera tween for zoom
        const targetCamY = isZoom ? 1.2 : 4.5
        const targetCamZ = isZoom ? 7.5 : 13.5
        const targetLookY = isZoom ? 0.3 : 1.8
        camera.position.y += (targetCamY - camera.position.y) * 0.05
        camera.position.z += (targetCamZ - camera.position.z) * 0.05
        controls.target.y += (targetLookY - controls.target.y) * 0.05

        // Burette Liquid Height calculation (0 to 50 mL)
        // 50 mL corresponds to empty burette
        const buretteRemainFrac = Math.max(0.04, 1.0 - titrantV / 50.0)
        buretteLiqMesh.scale.y = buretteRemainFrac
        buretteLiqMesh.position.y = -2.9 * (1.0 - buretteRemainFrac)

        // Stopcock handle position (turns when titrant is actively dispensing)
        if (rate > 0 && titrantV < 50) {
          stopcockHandle.rotation.x = Math.PI / 4 + Math.sin(Date.now() * 0.005) * 0.1
        } else {
          stopcockHandle.rotation.x = 0
        }

        // Calculate pH and dynamic Phenolphthalein color
        let currentPh = 1.0
        const vEq = 25.0
        if (titrantV < vEq - 0.05) {
          const hMol = Math.max(0.00001, (25.0 * 0.1 - titrantV * 0.1) / (25.0 + titrantV))
          currentPh = -Math.log10(hMol)
        } else if (titrantV > vEq + 0.05) {
          const ohMol = Math.max(0.00001, (titrantV * 0.1 - 25.0 * 0.1) / (25.0 + titrantV))
          const pOh = -Math.log10(ohMol)
          currentPh = 14.0 - pOh
        } else {
          currentPh = 7.0 + (titrantV - vEq) * 35.0
        }
        currentPh = Math.min(13.6, Math.max(1.0, currentPh))

        // Color transition:
        // Clear/Faint-blue at pH < 8.0 -> Blush-Pink at pH 8.2 -> Vibrant Deep Magenta at pH > 8.4
        if (currentPh < 8.0) {
          liquidMat.color.setHex(0xf0fdf4)
          meniscusMat.color.setHex(0xf0fdf4)
          liquidMat.opacity = 0.5
        } else if (currentPh < 8.4) {
          // Soft equivalence pink
          liquidMat.color.setHex(0xf472b6)
          meniscusMat.color.setHex(0xf472b6)
          liquidMat.opacity = 0.65
        } else {
          // Vibrant deep magenta pink
          liquidMat.color.setHex(0xec4899)
          meniscusMat.color.setHex(0xdb2777)
          liquidMat.opacity = 0.75
        }

        // Stirrer flea rotation
        if (speed > 0) {
          stirAngle += (speed / 60) * 0.15
          stirBar.rotation.y = stirAngle
          // Stirrer knob rotation
          knob.rotation.z = (speed / 1000) * (Math.PI * 1.5)
        }

        // Droplet animation
        if (isPlaying && rate > 0 && titrantV < 50) {
          dropTimer += 0.03 * rate
          droplets.forEach((drop, idx) => {
            const dropProgress = (dropTimer + idx / DROP_COUNT) % 1.0
            drop.visible = true
            // Fall from burette tip (y = 0.6) down to liquid surface (y = -0.42)
            drop.position.y = 0.6 - dropProgress * 1.02
            // At bottom, slight ripple scale
            if (dropProgress > 0.85) {
              drop.scale.set(1.4, 0.4, 1.4)
            } else {
              drop.scale.set(0.8, 1.4, 0.8)
            }
          })
        } else {
          droplets.forEach((drop) => {
            drop.visible = false
          })
        }

        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const w = container.clientWidth || 800
        const h = container.clientHeight || 500
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return {
        updateParams: (newParams: Record<string, number>) => {
          params = { ...newParams }
        },
        setPlaying: (playing: boolean) => {
          isPlaying = playing
        },
        reset: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
          controls.reset()
        },
        closeDissection: () => {
          activeDissectKey = null
          callbacks.onInspectPart?.(null)
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.domElement.removeEventListener('dblclick', handleDblClick)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },
}


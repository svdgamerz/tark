import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
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
    ],
    params: [
      { key: 'moleculeId', label: 'Molecule (0:H2O, 1:CH4, 2:CO2, 3:NH3)', min: 0, max: 3, step: 1, defaultValue: 0, unit: '' },
      { key: 'bondScale', label: 'Bond Length Scale', min: 0.6, max: 1.6, step: 0.1, defaultValue: 1.0, unit: 'x' },
      { key: 'showDipoles', label: 'Show Polarity Dipole Arrows', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
    ],
    calculateReadouts: (p) => {
      const molMap = [
        { name: 'Water (H₂O)', geom: 'Bent / V-Shaped', angle: '104.5°', polar: 'Polar (1.85 D)' },
        { name: 'Methane (CH₄)', geom: 'Tetrahedral', angle: '109.5°', polar: 'Non-Polar (0 D)' },
        { name: 'Carbon Dioxide (CO₂)', geom: 'Linear', angle: '180.0°', polar: 'Non-Polar (0 D)' },
        { name: 'Ammonia (NH₃)', geom: 'Trigonal Pyramidal', angle: '107.0°', polar: 'Polar (1.47 D)' },
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

      let activeDissectId: 'central' | 'dipole' | null = null

      function buildMolecule() {
        while (molGroup.children.length > 0) {
          molGroup.remove(molGroup.children[0])
        }
        lonePairGroup.clear()
        molGroup.add(lonePairGroup)
        interactableMeshes.length = 0

        const scale = params.bondScale

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

          const addBond = (p1: THREE.Vector3, p2: THREE.Vector3) => {
            const dir = new THREE.Vector3().subVectors(p2, p1)
            const len = dir.length()
            const bGeo = new THREE.CylinderGeometry(0.28, 0.28, len, 16)
            bGeo.translate(0, len / 2, 0)
            const bMesh = new THREE.Mesh(bGeo, mats.bond)
            bMesh.position.copy(p1)
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
            bMesh.userData = { partId: 'central' }
            molGroup.add(bMesh)
            interactableMeshes.push(bMesh)
          }

          addBond(new THREE.Vector3(0, 0, 0), h1Pos)
          addBond(new THREE.Vector3(0, 0, 0), h2Pos)

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

            const dir = pos.clone()
            const len = dir.length()
            const bGeo = new THREE.CylinderGeometry(0.28, 0.28, len, 16)
            bGeo.translate(0, len / 2, 0)
            const bMesh = new THREE.Mesh(bGeo, mats.bond)
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
            bMesh.userData = { partId: 'central' }
            molGroup.add(bMesh)
            interactableMeshes.push(bMesh)
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
            const bGeo = new THREE.CylinderGeometry(0.2, 0.2, dist, 16)
            bGeo.translate(0, dist / 2, 0)
            const b1 = new THREE.Mesh(bGeo, mats.bond)
            b1.position.set(0, 0.4, 0)
            b1.rotation.z = xOffset > 0 ? -Math.PI / 2 : Math.PI / 2
            b1.userData = { partId: 'central' }
            molGroup.add(b1)
            interactableMeshes.push(b1)

            const b2 = new THREE.Mesh(bGeo, mats.bond)
            b2.position.set(0, -0.4, 0)
            b2.rotation.z = xOffset > 0 ? -Math.PI / 2 : Math.PI / 2
            b2.userData = { partId: 'central' }
            molGroup.add(b2)
            interactableMeshes.push(b2)
          }
          addDoubleBond(dist)
          addDoubleBond(-dist)
        } else {
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

            const dir = new THREE.Vector3().subVectors(hPos, nMesh.position)
            const len = dir.length()
            const bGeo = new THREE.CylinderGeometry(0.28, 0.28, len, 16)
            bGeo.translate(0, len / 2, 0)
            const bMesh = new THREE.Mesh(bGeo, mats.bond)
            bMesh.position.copy(nMesh.position)
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
            bMesh.userData = { partId: 'central' }
            molGroup.add(bMesh)
            interactableMeshes.push(bMesh)
          }

          // Single Apex Lone Pair Lobe for Nitrogen
          const lobeGeo = new THREE.SphereGeometry(1.4, 24, 24)
          lobeGeo.scale(0.7, 1.5, 0.7)
          const lpN = new THREE.Mesh(lobeGeo, lonePairMat)
          lpN.position.set(0, 2.6, 0)
          lonePairGroup.add(lpN)
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
    subject: 'Biology · Genetics',
    concept: 'Antiparallel Strands, Base Complementarity (A-T, G-C)',
    description: 'Rotate and zoom into a 3D DNA double helix. Examine complementary base pairing (Adenine-Thymine, Guanine-Cytosine), hydrogen bonds, and the sugar-phosphate backbone with helical pitch.',
    emoji: '🧬',
    difficulty: 'Intermediate',
    presets: [
      { label: '🧬 Normal Twisting Double Helix', params: { twistSpeed: 1.0, baseRadius: 3.2, unzipping: 0 } },
      { label: '⚡ Rapid Transcription View', params: { twistSpeed: 2.2, baseRadius: 3.2, unzipping: 0 } },
      { label: '🔓 Helicase Unzipping Mode', params: { twistSpeed: 0.5, baseRadius: 4.8, unzipping: 1 } },
    ],
    params: [
      { key: 'twistSpeed', label: 'Rotation Speed', min: 0.2, max: 3.0, step: 0.1, defaultValue: 1.0, unit: 'x' },
      { key: 'baseRadius', label: 'Helix Diameter', min: 2.0, max: 5.5, step: 0.2, defaultValue: 3.2, unit: 'nm' },
      { key: 'unzipping', label: 'Replication Fork Unzip (0 or 1)', min: 0, max: 1, step: 1, defaultValue: 0, unit: '' },
    ],
    calculateReadouts: (p) => {
      return [
        { label: 'Helical Pitch (1 Turn)', value: '3.4', unit: 'nm', formula: '10.5 base pairs / turn' },
        { label: 'Helix Diameter', value: (p.baseRadius * 2).toFixed(1), unit: 'nm' },
        { label: 'Hydrogen Bonds', value: 'A=T (2 bonds) · G≡C (3 bonds)' },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 10, 28)

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
        at: {
          title: 'Adenine–Thymine Base Pair (A=T)',
          partName: 'A=T Nucleotide Rung · 2 Hydrogen Bonds Dissected',
          role: 'Complementary base pairing stabilizing the double helix via 2 electrostatic hydrogen bonds',
          internalStructures: ['Adenine (Bicyclic Purine Ring: C5H5N5)', 'Thymine (Pyrimidinedione Ring: C5H6N2O2)', '2 Linear Hydrogen Bonds (N-H...O & N...H-N)', 'Major & Minor Groove Contacts'],
          description: 'The A=T pair is held together by two hydrogen bonds (2.8 Å bond length). Because it has only 2 bonds compared to G≡C\'s 3, A-T rich regions are easier for RNA polymerase and helicase to unwind during replication origin firing.',
        },
        gc: {
          title: 'Guanine–Cytosine Base Pair (G≡C)',
          partName: 'G≡C Nucleotide Rung · 3 Triple Hydrogen Bonds Dissected',
          role: 'High-stability base pair conferring thermo-resistance and structural rigidity to the genome',
          internalStructures: ['Guanine (Purine Ring with Exocyclic Amine)', 'Cytosine (Monocyclic Pyrimidine Ring)', '3 Electrostatic Hydrogen Bonds (O...H-N, N-H...N, N-H...O)', 'GC-Clamp Stabilization'],
          description: 'The G≡C base pair is linked by three distinct hydrogen bonds, requiring significantly higher thermal denaturation temperature (Tm) to separate. It forms stable GC-clamps throughout genomic coding domains.',
        },
        backbone: {
          title: 'Sugar-Phosphate Antiparallel Backbone',
          partName: 'Deoxyribose & Phosphodiester Bridge (5\' to 3\')',
          role: 'Negatively charged structural scaffold providing directional orientation for transcription',
          internalStructures: ['2-Deoxy-D-ribose 5-Carbon Furanose Ring', 'Phosphodiester Ester Linkages', 'PO4(3-) Polyanionic Surface Charge', 'Antiparallel Polarity (Leading 5\'→3\' / Lagging 3\'→5\')'],
          description: 'The hydrophilic exterior of DNA consists of alternating deoxyribose sugar rings and phosphate groups. The strong negative charges repel nucleophiles, safeguarding genetic code inside the helical core.',
        },
      }

      const helixGroup = new THREE.Group()
      scene.add(helixGroup)

      const baseColors = [
        0x10b981, // Adenine (Green)
        0xef4444, // Thymine (Red)
        0x3b82f6, // Guanine (Blue)
        0xfbbf24, // Cytosine (Yellow/Gold)
      ]

      const backboneMat1 = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.2,
        metalness: 0.7,
      })
      const backboneMat2 = new THREE.MeshStandardMaterial({
        color: 0x9333ea,
        roughness: 0.2,
        metalness: 0.7,
      })
      const nodeMat1 = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      })
      const nodeMat2 = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      })
      const hBondMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        emissive: 0x94a3b8,
        emissiveIntensity: 0.4,
      })

      // Helicase Enzyme Ring Mesh (visible in unzipping mode)
      const helicaseGeo = new THREE.TorusGeometry(3.6, 0.7, 16, 32)
      const helicaseMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
      })
      const helicase = new THREE.Mesh(helicaseGeo, helicaseMat)
      helicase.rotation.x = Math.PI / 2
      scene.add(helicase)
      helicase.visible = Boolean(params.unzipping === 1)

      let strandMesh1: THREE.Mesh | null = null
      let strandMesh2: THREE.Mesh | null = null
      let pairGroups: THREE.Group[] = []

      // Raycasting for Double-Tap & Double-Click Dissection
      let activeDissectId: 'at' | 'gc' | 'backbone' | null = null
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
          const id = hit.userData?.partId as 'at' | 'gc' | 'backbone' | undefined
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

      function buildDNA() {
        while (helixGroup.children.length > 0) {
          helixGroup.remove(helixGroup.children[0])
        }
        pairGroups = []
        interactableMeshes.length = 0

        const numSteps = 42
        const stepY = 0.65
        const totalH = numSteps * stepY
        const r = params.baseRadius
        const isUnzip = params.unzipping === 1

        const pts1: THREE.Vector3[] = []
        const pts2: THREE.Vector3[] = []
        const grooveOffset = (140 * Math.PI) / 180

        for (let i = 0; i < numSteps; i++) {
          const angle = i * 0.36
          const y = i * stepY - totalH / 2

          let forkSpread1 = 1.0
          let forkSpread2 = 1.0
          if (isUnzip && i > numSteps * 0.55) {
            const forkFactor = (i - numSteps * 0.55) / (numSteps * 0.45)
            forkSpread1 += forkFactor * 1.6
            forkSpread2 += forkFactor * 1.6
          }

          const p1 = new THREE.Vector3(r * forkSpread1 * Math.cos(angle), y, r * forkSpread1 * Math.sin(angle))
          const p2 = new THREE.Vector3(
            r * forkSpread2 * Math.cos(angle + grooveOffset),
            y,
            r * forkSpread2 * Math.sin(angle + grooveOffset)
          )

          pts1.push(p1)
          pts2.push(p2)

          const node1 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), nodeMat1)
          node1.position.copy(p1)
          node1.userData = { partId: 'backbone' }
          helixGroup.add(node1)
          interactableMeshes.push(node1)

          const node2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), nodeMat2)
          node2.position.copy(p2)
          node2.userData = { partId: 'backbone' }
          helixGroup.add(node2)
          interactableMeshes.push(node2)

          const pairGroup = new THREE.Group()
          helixGroup.add(pairGroup)
          pairGroups.push(pairGroup)

          const bType = i % 2 === 0 ? 0 : 2
          const partId = bType === 0 ? 'at' : 'gc'
          const matBase1 = new THREE.MeshStandardMaterial({ color: baseColors[bType], roughness: 0.3 })
          const matBase2 = new THREE.MeshStandardMaterial({ color: baseColors[bType + 1], roughness: 0.3 })

          const centerPt = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
          const strandDir = new THREE.Vector3().subVectors(p2, p1)
          const fullLen = strandDir.length()

          if (!isUnzip || i <= numSteps * 0.55) {
            const halfLen = fullLen * 0.42

            const b1Geo = new THREE.CylinderGeometry(0.2, 0.2, halfLen, 12)
            b1Geo.translate(0, halfLen / 2, 0)
            const b1 = new THREE.Mesh(b1Geo, matBase1)
            b1.position.copy(p1)
            b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().normalize())
            b1.userData = { partId }
            pairGroup.add(b1)
            interactableMeshes.push(b1)

            const b2Geo = new THREE.CylinderGeometry(0.2, 0.2, halfLen, 12)
            b2Geo.translate(0, halfLen / 2, 0)
            const b2 = new THREE.Mesh(b2Geo, matBase2)
            b2.position.copy(p2)
            b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().negate().normalize())
            b2.userData = { partId }
            pairGroup.add(b2)
            interactableMeshes.push(b2)

            const hCount = bType === 0 ? 2 : 3
            const hGap = 0.2
            for (let h = 0; h < hCount; h++) {
              const hOffset = (h - (hCount - 1) / 2) * hGap
              const hBridgeGeo = new THREE.CylinderGeometry(0.06, 0.06, fullLen * 0.16, 8)
              const hBridge = new THREE.Mesh(hBridgeGeo, hBondMat)
              hBridge.position.copy(centerPt).add(new THREE.Vector3(0, hOffset, 0))
              hBridge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().normalize())
              hBridge.userData = { partId }
              pairGroup.add(hBridge)
              interactableMeshes.push(hBridge)
            }
          } else {
            const stubLen = r * 0.55
            const b1Geo = new THREE.CylinderGeometry(0.2, 0.2, stubLen, 12)
            b1Geo.translate(0, stubLen / 2, 0)
            const b1 = new THREE.Mesh(b1Geo, matBase1)
            b1.position.copy(p1)
            const inward1 = new THREE.Vector3(0, y, 0).sub(p1).normalize()
            b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward1)
            b1.userData = { partId }
            pairGroup.add(b1)
            interactableMeshes.push(b1)

            const b2Geo = new THREE.CylinderGeometry(0.2, 0.2, stubLen, 12)
            b2Geo.translate(0, stubLen / 2, 0)
            const b2 = new THREE.Mesh(b2Geo, matBase2)
            b2.position.copy(p2)
            const inward2 = new THREE.Vector3(0, y, 0).sub(p2).normalize()
            b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward2)
            b2.userData = { partId }
            pairGroup.add(b2)
            interactableMeshes.push(b2)
          }
        }

        const curve1 = new THREE.CatmullRomCurve3(pts1)
        const tube1Geo = new THREE.TubeGeometry(curve1, 80, 0.26, 12, false)
        strandMesh1 = new THREE.Mesh(tube1Geo, backboneMat1)
        strandMesh1.userData = { partId: 'backbone' }
        helixGroup.add(strandMesh1)
        interactableMeshes.push(strandMesh1)

        const curve2 = new THREE.CatmullRomCurve3(pts2)
        const tube2Geo = new THREE.TubeGeometry(curve2, 80, 0.26, 12, false)
        strandMesh2 = new THREE.Mesh(tube2Geo, backboneMat2)
        strandMesh2.userData = { partId: 'backbone' }
        helixGroup.add(strandMesh2)
        interactableMeshes.push(strandMesh2)

        if (isUnzip) {
          const forkY = (numSteps * 0.55 * stepY) - totalH / 2
          helicase.position.set(0, forkY, 0)
          helicase.visible = true
        } else {
          helicase.visible = false
        }
      }

      buildDNA()

      function animate() {
        animId = requestAnimationFrame(animate)
        if (isPlaying) {
          if (!activeDissectId) {
            helixGroup.rotation.y += 0.016 * params.twistSpeed
          }
          if (helicase.visible) {
            helicase.rotation.z += 0.02
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
          buildDNA()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          helixGroup.rotation.set(0, 0, 0)
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
  // 6. BIOLOGY: 3D HUMAN HEART & CARDIAC CYCLE
  // ==========================================
  heart_3d: {
    type: 'heart_3d',
    title: '3D Beating Human Heart & Circulation',
    subject: 'Biology · Human Physiology',
    concept: '4-Chambered Double Circulation & Cardiac Cycle',
    description: '3D anatomical human heart with realistic rhythmic systole and diastole contractions. Double-tap on the Left Atrium, Left Ventricle, or other chambers to dissect and reveal internal valves, heart strings, and lumen.',
    emoji: '🫀',
    difficulty: 'Intermediate',
    presets: [
      { label: '❤️ Normal Resting Heartbeat (72 BPM)', params: { bpm: 72, strokeVolume: 70, showValves: 1, dissectMode: 0 } },
      { label: '🔍 Dissect Left Atrium (Inside View)', params: { bpm: 60, strokeVolume: 70, showValves: 1, dissectMode: 1 } },
      { label: '🔍 Dissect Left Ventricle & Cords', params: { bpm: 60, strokeVolume: 70, showValves: 1, dissectMode: 2 } },
      { label: '🏃 Athletic Cardio Workout (130 BPM)', params: { bpm: 130, strokeVolume: 90, showValves: 1, dissectMode: 0 } },
    ],
    params: [
      { key: 'bpm', label: 'Heart Rate (BPM)', min: 45, max: 180, step: 1, defaultValue: 72, unit: 'bpm' },
      { key: 'strokeVolume', label: 'Stroke Volume', min: 40, max: 120, step: 2, defaultValue: 70, unit: 'mL' },
      { key: 'showValves', label: 'Internal Valve Visibility', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
      { key: 'dissectMode', label: 'Dissect Chamber (0:All Closed, 1:Left Atrium, 2:Left Ventricle, 3:Right Atrium, 4:Right Ventricle)', min: 0, max: 4, step: 1, defaultValue: 0, unit: '' },
    ],
    calculateReadouts: (p) => {
      const co = ((p.bpm * p.strokeVolume) / 1000).toFixed(2)
      const cycleTime = (60 / p.bpm).toFixed(2)
      const dissectNames = ['None (Intact Organ)', 'Left Atrium (Opened)', 'Left Ventricle (Opened)', 'Right Atrium (Opened)', 'Right Ventricle (Opened)']
      const curDissect = dissectNames[Math.round(p.dissectMode)] || dissectNames[0]
      return [
        { label: 'Cardiac Output (Q)', value: co, unit: 'L/min', formula: 'Q = HR × SV' },
        { label: 'Cardiac Cycle Time', value: cycleTime, unit: 's', formula: 'T = 60 / BPM' },
        { label: 'Inner Dissection', value: curDissect },
        { label: 'Circulation Circuit', value: 'Double Circulation (Systemic & Pulmonary)' },
      ]
    },
    initScene: (container, initialParams, callbacks) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      // Clean medical studio environment without any harsh graph paper grid floor!
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 4, 21)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.target.set(0, 1.2, 0)

      const heartGroup = new THREE.Group()
      scene.add(heartGroup)

      // High-Fidelity Anatomical Materials
      const myoMatLeft = new THREE.MeshStandardMaterial({
        color: 0x9f1239,
        roughness: 0.32,
        metalness: 0.12,
      })
      const myoMatRight = new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        roughness: 0.36,
        metalness: 0.1,
      })
      const atriumMat = new THREE.MeshStandardMaterial({
        color: 0x881337,
        roughness: 0.4,
        metalness: 0.1,
      })
      const fatMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.7,
        metalness: 0.05,
      })
      const lumenMat = new THREE.MeshStandardMaterial({
        color: 0x4c0519,
        roughness: 0.5,
        side: THREE.BackSide,
      })
      const valveMat = new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        roughness: 0.25,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
      const chordaeMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.3,
        metalness: 0.1,
      })
      const coronaryMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xbe123c,
        emissiveIntensity: 0.7,
        roughness: 0.2,
      })

      // Interactive Dissection State
      let activeDissectId: 'la' | 'lv' | 'ra' | 'rv' | 'aorta' | null = null
      if (params.dissectMode === 1) activeDissectId = 'la'
      else if (params.dissectMode === 2) activeDissectId = 'lv'
      else if (params.dissectMode === 3) activeDissectId = 'ra'
      else if (params.dissectMode === 4) activeDissectId = 'rv'

      // Opening progress interpolators (0: closed, 1: fully opened)
      const openProgress = { la: 0, lv: 0, ra: 0, rv: 0, aorta: 0 }

      // Raycast Target Meshes
      const interactableMeshes: THREE.Mesh[] = []

      // Helper to register interactable chamber mesh
      function registerChamberMesh(mesh: THREE.Mesh, id: 'la' | 'lv' | 'ra' | 'rv' | 'aorta', name: string) {
        mesh.userData = { chamberId: id, chamberName: name }
        interactableMeshes.push(mesh)
      }

      // ========================================================
      // 1. LEFT ATRIUM (LA) WITH DOUBLE-TAP DISSECTION
      // ========================================================
      const laGroup = new THREE.Group()
      laGroup.position.set(-1.4, 2.3, -0.4)
      heartGroup.add(laGroup)

      // Inner Lumen Shell (Visible when opened)
      const laInnerGeo = new THREE.SphereGeometry(1.65, 24, 24)
      laInnerGeo.scale(1.1, 1.0, 1.2)
      const laInnerMesh = new THREE.Mesh(laInnerGeo, lumenMat)
      laGroup.add(laInnerMesh)

      // 4 Pulmonary Vein Intakes into Left Atrium (2 left lung, 2 right lung)
      const pvPositions = [
        new THREE.Vector3(-1.1, 0.5, -0.6),
        new THREE.Vector3(-1.1, -0.4, -0.6),
        new THREE.Vector3(0.9, 0.5, -0.8),
        new THREE.Vector3(0.9, -0.4, -0.8),
      ]
      pvPositions.forEach((pvPos) => {
        const pvGeo = new THREE.CylinderGeometry(0.24, 0.26, 1.5, 12)
        pvGeo.translate(0, 0.75, 0)
        const pvMesh = new THREE.Mesh(pvGeo, new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }))
        pvMesh.position.copy(pvPos)
        pvMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pvPos.clone().normalize())
        laGroup.add(pvMesh)

        // Glowing red intake ring ostium
        const ostiumGeo = new THREE.TorusGeometry(0.26, 0.05, 8, 16)
        const ostiumMesh = new THREE.Mesh(ostiumGeo, new THREE.MeshBasicMaterial({ color: 0xfca5a5 }))
        ostiumMesh.position.copy(pvPos)
        ostiumMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pvPos.clone().normalize())
        laGroup.add(ostiumMesh)
      })

      // Pectinate Muscle Ridges inside LA
      for (let p = 0; p < 6; p++) {
        const ridgeGeo = new THREE.TorusGeometry(0.7 + p * 0.12, 0.04, 6, 16, Math.PI * 0.8)
        const ridgeMesh = new THREE.Mesh(ridgeGeo, myoMatLeft)
        ridgeMesh.position.set(-0.2, -0.2 + p * 0.08, 0.1)
        ridgeMesh.rotation.x = Math.PI / 2
        laGroup.add(ridgeMesh)
      }

      // Left Atrium Outer Wall Flap (Hinged to swing open upon double-tap)
      const laHinge = new THREE.Group()
      laHinge.position.set(-1.2, 0, 0.6)
      laGroup.add(laHinge)

      const laFlapGeo = new THREE.SphereGeometry(1.72, 24, 24, 0, Math.PI * 1.1, 0, Math.PI)
      laFlapGeo.scale(1.1, 1.0, 1.2)
      const laFlapMesh = new THREE.Mesh(laFlapGeo, atriumMat)
      laFlapMesh.position.set(1.2, 0, -0.6)
      registerChamberMesh(laFlapMesh, 'la', 'Left Atrium')
      laHinge.add(laFlapMesh)

      // ========================================================
      // 2. LEFT VENTRICLE (LV) WITH DOUBLE-TAP DISSECTION
      // ========================================================
      const lvGroup = new THREE.Group()
      lvGroup.position.set(-0.8, -0.6, 0.2)
      lvGroup.rotation.z = 0.18
      heartGroup.add(lvGroup)

      // Inner Ventricular Cavity
      const lvInnerGeo = new THREE.SphereGeometry(2.7, 32, 32)
      lvInnerGeo.scale(0.85, 1.4, 0.9)
      const lvInnerMesh = new THREE.Mesh(lvInnerGeo, lumenMat)
      lvGroup.add(lvInnerMesh)

      // Muscular Papillary Muscles on LV Floor
      const papGeo = new THREE.CylinderGeometry(0.35, 0.5, 1.6, 12)
      const pap1 = new THREE.Mesh(papGeo, myoMatLeft)
      pap1.position.set(-0.6, -1.2, 0.2)
      lvGroup.add(pap1)

      const pap2 = new THREE.Mesh(papGeo, myoMatLeft)
      pap2.position.set(0.6, -1.2, -0.2)
      lvGroup.add(pap2)

      // Fibrous Chordae Tendineae ("Heart Strings") connecting Papillary Muscles to Mitral Cusps
      for (let c = 0; c < 8; c++) {
        const cordGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6)
        cordGeo.translate(0, 0.6, 0)
        const cordMesh = new THREE.Mesh(cordGeo, chordaeMat)
        const isPap1 = c < 4
        cordMesh.position.copy(isPap1 ? pap1.position : pap2.position).add(new THREE.Vector3(0, 0.8, 0))
        const angle = ((c % 4) * Math.PI) / 3
        cordMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(Math.cos(angle) * 0.3, 1.0, Math.sin(angle) * 0.3).normalize()
        )
        lvGroup.add(cordMesh)
      }

      // Left Ventricle Outer Wall Flap
      const lvHinge = new THREE.Group()
      lvHinge.position.set(-1.8, 0, 0.5)
      lvGroup.add(lvHinge)

      const lvFlapGeo = new THREE.SphereGeometry(2.82, 32, 32, 0, Math.PI * 1.15, 0, Math.PI)
      lvFlapGeo.scale(0.9, 1.45, 0.95)
      const lvFlapMesh = new THREE.Mesh(lvFlapGeo, myoMatLeft)
      lvFlapMesh.position.set(1.8, 0, -0.5)
      registerChamberMesh(lvFlapMesh, 'lv', 'Left Ventricle')
      lvHinge.add(lvFlapMesh)

      // ========================================================
      // 3. RIGHT ATRIUM (RA) WITH DOUBLE-TAP DISSECTION
      // ========================================================
      const raGroup = new THREE.Group()
      raGroup.position.set(1.5, 2.0, 0.3)
      heartGroup.add(raGroup)

      const raInnerGeo = new THREE.SphereGeometry(1.75, 24, 24)
      raInnerGeo.scale(1.1, 1.1, 1.0)
      const raInnerMesh = new THREE.Mesh(raInnerGeo, lumenMat)
      raGroup.add(raInnerMesh)

      // Fossa Ovalis (Oval depression in interatrial septum)
      const fossaGeo = new THREE.RingGeometry(0.25, 0.55, 16)
      const fossaMesh = new THREE.Mesh(fossaGeo, new THREE.MeshStandardMaterial({ color: 0x334155, side: THREE.DoubleSide }))
      fossaMesh.position.set(-0.8, 0, 0)
      fossaMesh.rotation.y = Math.PI / 2
      raGroup.add(fossaMesh)

      // Right Atrium Outer Wall Flap
      const raHinge = new THREE.Group()
      raHinge.position.set(1.5, 0, 0.6)
      raGroup.add(raHinge)

      const raFlapGeo = new THREE.SphereGeometry(1.82, 24, 24, 0, Math.PI * 1.15, 0, Math.PI)
      raFlapGeo.scale(1.1, 1.1, 1.0)
      const raFlapMesh = new THREE.Mesh(raFlapGeo, atriumMat)
      raFlapMesh.position.set(-1.5, 0, -0.6)
      registerChamberMesh(raFlapMesh, 'ra', 'Right Atrium')
      raHinge.add(raFlapMesh)

      // ========================================================
      // 4. RIGHT VENTRICLE (RV) WITH DOUBLE-TAP DISSECTION
      // ========================================================
      const rvGroup = new THREE.Group()
      rvGroup.position.set(1.1, -0.4, 0.5)
      rvGroup.rotation.z = -0.15
      heartGroup.add(rvGroup)

      const rvInnerGeo = new THREE.SphereGeometry(2.4, 32, 32)
      rvInnerGeo.scale(1.05, 1.3, 0.8)
      const rvInnerMesh = new THREE.Mesh(rvInnerGeo, lumenMat)
      rvGroup.add(rvInnerMesh)

      // Trabeculae Carneae (Muscular ridges in RV)
      for (let t = 0; t < 5; t++) {
        const trabGeo = new THREE.TorusGeometry(0.8 + t * 0.15, 0.08, 6, 16, Math.PI * 0.7)
        const trabMesh = new THREE.Mesh(trabGeo, myoMatRight)
        trabMesh.position.set(0.1, -1.0 + t * 0.25, -0.1)
        trabMesh.rotation.x = Math.PI / 2.5
        rvGroup.add(trabMesh)
      }

      // Right Ventricle Outer Wall Flap
      const rvHinge = new THREE.Group()
      rvHinge.position.set(1.6, 0, 0.6)
      rvGroup.add(rvHinge)

      const rvFlapGeo = new THREE.SphereGeometry(2.52, 32, 32, 0, Math.PI * 1.15, 0, Math.PI)
      rvFlapGeo.scale(1.05, 1.3, 0.8)
      const rvFlapMesh = new THREE.Mesh(rvFlapGeo, myoMatRight)
      rvFlapMesh.position.set(-1.6, 0, -0.6)
      registerChamberMesh(rvFlapMesh, 'rv', 'Right Ventricle')
      rvHinge.add(rvFlapMesh)

      // ========================================================
      // 5. GREAT VESSELS: AORTA, PULMONARY TRUNK, VENA CAVA
      // ========================================================
      // Ascending Aorta & Arch (Sweeping Red Trunk with 3 Head/Neck Branches)
      const aortaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.2, 1.2, 0),
        new THREE.Vector3(-0.1, 3.2, 0.2),
        new THREE.Vector3(0.6, 4.8, 0),
        new THREE.Vector3(0.2, 5.4, -0.6),
        new THREE.Vector3(-1.2, 5.0, -1.0),
        new THREE.Vector3(-1.8, 2.8, -1.2),
      ])
      const aortaGeo = new THREE.TubeGeometry(aortaCurve, 32, 0.65, 16, false)
      const aortaMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.22,
        metalness: 0.28,
      })
      const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat)
      registerChamberMesh(aortaMesh, 'aorta', 'Aorta Arch')
      heartGroup.add(aortaMesh)

      // 3 Head/Neck Branches: Brachiocephalic trunk, Left common carotid, Left subclavian
      const branchPositions = [
        { start: new THREE.Vector3(0.5, 5.1, -0.1), dir: new THREE.Vector3(0.4, 1.4, 0.2) },
        { start: new THREE.Vector3(0.0, 5.3, -0.4), dir: new THREE.Vector3(0.1, 1.5, 0.1) },
        { start: new THREE.Vector3(-0.6, 5.2, -0.7), dir: new THREE.Vector3(-0.2, 1.4, -0.1) },
      ]
      branchPositions.forEach((b) => {
        const bGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.6, 12)
        bGeo.translate(0, 0.8, 0)
        const bMesh = new THREE.Mesh(bGeo, aortaMat)
        bMesh.position.copy(b.start)
        bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.dir.clone().normalize())
        heartGroup.add(bMesh)
      })

      // Pulmonary Trunk (Venous Blue Arch curving across anterior Aorta)
      const pulmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.6, 1.2, 0.8),
        new THREE.Vector3(0.4, 3.0, 0.9),
        new THREE.Vector3(-0.6, 3.8, 0.4),
      ])
      const pulmGeo = new THREE.TubeGeometry(pulmCurve, 20, 0.58, 16, false)
      const venousMat = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.25,
        metalness: 0.25,
      })
      const pulmMesh = new THREE.Mesh(pulmGeo, venousMat)
      heartGroup.add(pulmMesh)

      // Left & Right Pulmonary Arteries
      const leftPulmGeo = new THREE.CylinderGeometry(0.3, 0.35, 2.2, 12)
      leftPulmGeo.translate(0, 1.1, 0)
      const leftPulm = new THREE.Mesh(leftPulmGeo, venousMat)
      leftPulm.position.set(-0.6, 3.8, 0.4)
      leftPulm.rotation.z = Math.PI / 2.3
      heartGroup.add(leftPulm)

      const rightPulmGeo = new THREE.CylinderGeometry(0.3, 0.35, 2.2, 12)
      rightPulmGeo.translate(0, 1.1, 0)
      const rightPulm = new THREE.Mesh(rightPulmGeo, venousMat)
      rightPulm.position.set(-0.6, 3.8, 0.4)
      rightPulm.rotation.z = -Math.PI / 2.4
      heartGroup.add(rightPulm)

      // Superior & Inferior Vena Cava (Blue Great Vessels into RA)
      const svcGeo = new THREE.CylinderGeometry(0.55, 0.6, 3.0, 16)
      const svcMesh = new THREE.Mesh(svcGeo, venousMat)
      svcMesh.position.set(2.4, 3.4, 0.0)
      heartGroup.add(svcMesh)

      const ivcGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.2, 16)
      const ivcMesh = new THREE.Mesh(ivcGeo, venousMat)
      ivcMesh.position.set(2.2, -1.4, -0.3)
      heartGroup.add(ivcMesh)

      // ========================================================
      // 6. ADIPOSE FAT PADS & CORONARY ARTERY NETWORK
      // ========================================================
      // Subepicardial Adipose Tissue (Fat pads along coronary sulcus)
      const fatBandCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.8, 1.4, 0.4),
        new THREE.Vector3(0.1, 1.8, 1.4),
        new THREE.Vector3(1.8, 1.4, 0.6),
        new THREE.Vector3(0.0, 1.2, -1.2),
      ])
      const fatBandGeo = new THREE.TubeGeometry(fatBandCurve, 24, 0.28, 10, true)
      const fatBandMesh = new THREE.Mesh(fatBandGeo, fatMat)
      heartGroup.add(fatBandMesh)

      // Anterior Interventricular Coronary Artery
      const coronaryCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1, 1.8, 1.4),
        new THREE.Vector3(0.3, 0.6, 1.6),
        new THREE.Vector3(0.0, -0.8, 1.4),
        new THREE.Vector3(-0.4, -2.1, 0.9),
      ])
      const coronaryGeo = new THREE.TubeGeometry(coronaryCurve, 20, 0.12, 12, false)
      const coronaryMesh = new THREE.Mesh(coronaryGeo, coronaryMat)
      heartGroup.add(coronaryMesh)

      // ========================================================
      // 7. INTERNAL ATRIOVENTRICULAR VALVES
      // ========================================================
      const valveGroup = new THREE.Group()
      heartGroup.add(valveGroup)
      valveGroup.visible = Boolean(params.showValves === 1)

      // Mitral Valve Cusps (Left Heart)
      const mitralCuspGeo = new THREE.PlaneGeometry(1.2, 0.8)
      const mitralCusp1 = new THREE.Mesh(mitralCuspGeo, valveMat)
      mitralCusp1.position.set(-0.9, 0.8, 0.1)
      mitralCusp1.rotation.x = 0.5
      valveGroup.add(mitralCusp1)

      const mitralCusp2 = new THREE.Mesh(mitralCuspGeo, valveMat)
      mitralCusp2.position.set(-0.9, 0.8, -0.2)
      mitralCusp2.rotation.x = -0.5
      valveGroup.add(mitralCusp2)

      // Tricuspid Valve Cusps (Right Heart)
      const triCuspGeo = new THREE.PlaneGeometry(1.1, 0.7)
      const triCusp1 = new THREE.Mesh(triCuspGeo, valveMat)
      triCusp1.position.set(1.0, 0.7, 0.4)
      triCusp1.rotation.x = 0.4
      valveGroup.add(triCusp1)

      const triCusp2 = new THREE.Mesh(triCuspGeo, valveMat)
      triCusp2.position.set(1.0, 0.7, 0.0)
      triCusp2.rotation.x = -0.4
      valveGroup.add(triCusp2)

      // ========================================================
      // 8. OXYGENATED & DEOXYGENATED BLOOD PARTICLES
      // ========================================================
      const particleCount = 280
      const bloodGeo = new THREE.BufferGeometry()
      const bloodPos = new Float32Array(particleCount * 3)
      const bloodColors = new Float32Array(particleCount * 3)

      for (let i = 0; i < particleCount; i++) {
        const isOxy = i % 2 === 0
        if (isOxy) {
          // Oxygenated in Left Atrium, LV & Aorta
          bloodPos[i * 3] = -0.8 + (Math.random() - 0.5) * 1.8
          bloodPos[i * 3 + 1] = -1.2 + Math.random() * 5.0
          bloodPos[i * 3 + 2] = 0.1 + (Math.random() - 0.5) * 1.4
          bloodColors[i * 3] = 0.98
          bloodColors[i * 3 + 1] = 0.15
          bloodColors[i * 3 + 2] = 0.2
        } else {
          // Deoxygenated in RA, RV & Pulmonary Trunk
          bloodPos[i * 3] = 1.1 + (Math.random() - 0.5) * 1.8
          bloodPos[i * 3 + 1] = -1.2 + Math.random() * 4.8
          bloodPos[i * 3 + 2] = 0.4 + (Math.random() - 0.5) * 1.4
          bloodColors[i * 3] = 0.2
          bloodColors[i * 3 + 1] = 0.5
          bloodColors[i * 3 + 2] = 0.98
        }
      }

      bloodGeo.setAttribute('position', new THREE.BufferAttribute(bloodPos, 3))
      bloodGeo.setAttribute('color', new THREE.BufferAttribute(bloodColors, 3))
      const bloodMat = new THREE.PointsMaterial({
        size: 0.38,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
      })
      const bloodParticles = new THREE.Points(bloodGeo, bloodMat)
      heartGroup.add(bloodParticles)

      // Pedagogical Dissection Metadata Dictionary
      const DISSECT_CARDS: Record<string, DissectInfo> = {
        la: {
          title: 'Left Atrium (Atrium Sinistrum)',
          partName: 'Left Atrium · Interior Lumen Dissected',
          role: 'Receives oxygen-rich blood from lungs via 4 pulmonary veins; pumps into Left Ventricle',
          bloodType: 'Oxygenated',
          internalStructures: ['4 Pulmonary Vein Ostia', 'Bicuspid (Mitral) Valve Orifice', 'Pectinate Muscles', 'Interatrial Septum'],
          description: 'The anterior wall is opened to reveal the interior chamber. You can see the 4 pulmonary vein orifices entering from both lungs, delicate pectinate ridges, and the bicuspid (mitral) valve at the base leading into the thick-walled left ventricle.',
        },
        lv: {
          title: 'Left Ventricle (Ventriculus Sinister)',
          partName: 'Left Ventricle · Interior Cavity Dissected',
          role: 'High-pressure muscular pump driving systemic circulation throughout the entire body',
          bloodType: 'Oxygenated',
          internalStructures: ['Thick Myocardial Wall (3x thicker)', 'Papillary Muscles', 'Chordae Tendineae (Heart Strings)', 'Mitral Valve Leaflets', 'Aortic Vestibule'],
          description: 'Notice the prominent papillary muscles and fibrous chordae tendineae anchored to the bicuspid valve leaflets. These strings prevent the valve flaps from prolapsing backwards into the left atrium under massive systolic pressure.',
        },
        ra: {
          title: 'Right Atrium (Atrium Dextrum)',
          partName: 'Right Atrium · Deoxygenated Receiving Chamber',
          role: 'Collects oxygen-depleted venous blood from the entire body via Vena Cava',
          bloodType: 'Deoxygenated',
          internalStructures: ['Superior & Inferior Vena Cava', 'Fossa Ovalis (Fetal Shunt Remnant)', 'Coronary Sinus Orifice', 'Tricuspid Valve'],
          description: 'Exposes the entry of the superior and inferior vena cava. The smooth oval depression is the Fossa Ovalis (remnant of the fetal shunt). Blood flows through the tricuspid valve into the right ventricle.',
        },
        rv: {
          title: 'Right Ventricle (Ventriculus Dexter)',
          partName: 'Right Ventricle · Pulmonary Pump',
          role: 'Pumps deoxygenated blood under low resistance to the lungs for gas exchange',
          bloodType: 'Deoxygenated',
          internalStructures: ['Tricuspid Valve', 'Trabeculae Carneae', 'Papillary Muscles', 'Pulmonary Semilunar Valve'],
          description: 'The muscular ridges inside are trabeculae carneae. Blood is propelled through the pulmonary semilunar valve into the pulmonary artery heading towards alveolar capillary beds.',
        },
        aorta: {
          title: 'Ascending Aorta & Arch',
          partName: 'Aorta Root · Aortic Semilunar Valve Dissected',
          role: 'Main arterial trunk distributing oxygenated blood under systemic systolic pressure (120 mmHg)',
          bloodType: 'Oxygenated',
          internalStructures: ['3 Semilunar Pocket Cusps', 'Left & Right Coronary Ostia', 'Brachiocephalic Trunk', 'Left Common Carotid', 'Left Subclavian Artery'],
          description: 'Exposing the aortic root reveals the 3 pocket-like semilunar cusps that snap shut immediately after ventricular ejection, preventing backflow and directing blood into the coronary ostia.',
        },
      }

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
          const id = hit.userData?.chamberId as 'la' | 'lv' | 'ra' | 'rv' | 'aorta' | undefined
          if (id) {
            if (activeDissectId === id) {
              activeDissectId = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectId = id
              const card = DISSECT_CARDS[id]
              if (card) callbacks.onInspectPart?.(card)
            }
          }
        } else {
          // Tapped outside on background: close dissection
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

      // Notify initial card if dissectMode was preset
      if (activeDissectId && DISSECT_CARDS[activeDissectId]) {
        callbacks.onInspectPart?.(DISSECT_CARDS[activeDissectId])
      }

      let pulseTime = 0

      function animate() {
        animId = requestAnimationFrame(animate)

        // Smooth Chamber Opening Hinge Interpolation
        const targetLA = activeDissectId === 'la' ? 1.0 : 0.0
        openProgress.la += (targetLA - openProgress.la) * 0.1
        laHinge.rotation.y = -openProgress.la * 1.35
        laFlapMesh.material.transparent = openProgress.la > 0.05
        ;(laFlapMesh.material as THREE.MeshStandardMaterial).opacity = 1.0 - openProgress.la * 0.45

        const targetLV = activeDissectId === 'lv' ? 1.0 : 0.0
        openProgress.lv += (targetLV - openProgress.lv) * 0.1
        lvHinge.rotation.y = -openProgress.lv * 1.25
        lvFlapMesh.material.transparent = openProgress.lv > 0.05
        ;(lvFlapMesh.material as THREE.MeshStandardMaterial).opacity = 1.0 - openProgress.lv * 0.45

        const targetRA = activeDissectId === 'ra' ? 1.0 : 0.0
        openProgress.ra += (targetRA - openProgress.ra) * 0.1
        raHinge.rotation.y = openProgress.ra * 1.25

        const targetRV = activeDissectId === 'rv' ? 1.0 : 0.0
        openProgress.rv += (targetRV - openProgress.rv) * 0.1
        rvHinge.rotation.y = openProgress.rv * 1.25

        if (isPlaying) {
          const freq = (params.bpm / 60) * Math.PI * 2
          pulseTime += 0.024
          const cyclePhase = (pulseTime * freq) % (Math.PI * 2)

          // Wiggers Diagram Cardiac Cycle Approximation:
          // Phase 1 (0 to 0.25): Atrial Systole
          // Phase 2 (0.25 to 0.70): Ventricular Systole
          // Phase 3 (0.70 to 2*PI): Diastole / Relaxation
          const isAtrialBeat = cyclePhase < Math.PI * 0.4
          const isVentBeat = cyclePhase >= Math.PI * 0.4 && cyclePhase < Math.PI * 1.2

          const atriaContraction = isAtrialBeat ? 1.0 - Math.sin(cyclePhase * 2.5) * 0.12 : 1.0
          laGroup.scale.set(1.1 * atriaContraction, 1.0 * atriaContraction, 1.2 * atriaContraction)
          raGroup.scale.set(1.1 * atriaContraction, 1.1 * atriaContraction, 1.0 * atriaContraction)

          const ventScale = isVentBeat
            ? 1.0 - Math.sin((cyclePhase - Math.PI * 0.4) * 1.25) * 0.16
            : 1.0 + Math.sin(cyclePhase) * 0.05

          lvGroup.scale.set(0.9 * ventScale, 1.45 * (2 - ventScale), 0.95 * ventScale)
          rvGroup.scale.set(1.05 * ventScale, 1.3 * (2 - ventScale), 0.8 * ventScale)

          // Valve flapping: open during filling (diastole), snap closed during systole
          const valveOpenAngle = isVentBeat ? 0.05 : 0.65
          mitralCusp1.rotation.x = valveOpenAngle
          mitralCusp2.rotation.x = -valveOpenAngle
          triCusp1.rotation.x = valveOpenAngle * 0.9
          triCusp2.rotation.x = -valveOpenAngle * 0.9

          // Blood circulation particles movement
          const pos = bloodGeo.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < particleCount; i++) {
            let y = pos.getY(i) + 0.11
            if (y > 5.2) y = -2.8
            pos.setY(i, y)
          }
          pos.needsUpdate = true

          // Slow organic rotation if not actively dissecting
          if (!activeDissectId) {
            heartGroup.rotation.y += 0.005
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
          if (params.dissectMode === 1) activeDissectId = 'la'
          else if (params.dissectMode === 2) activeDissectId = 'lv'
          else if (params.dissectMode === 3) activeDissectId = 'ra'
          else if (params.dissectMode === 4) activeDissectId = 'rv'
          else if (params.dissectMode === 0 && activeDissectId) {
            activeDissectId = null
            callbacks.onInspectPart?.(null)
          }
          if (activeDissectId && DISSECT_CARDS[activeDissectId]) {
            callbacks.onInspectPart?.(DISSECT_CARDS[activeDissectId])
          }
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          pulseTime = 0
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
  // 7. BIOLOGY: 3D EPIDERMAL LAYERS & SKIN HISTOLOGY
  // ==========================================
  epidermis_3d: {
    type: 'epidermis_3d',
    title: '3D Epidermal Layers & Skin Architecture',
    subject: 'Biology · Histology & Anatomy',
    concept: 'Stratified Squamous Epithelium: Corneum to Basale',
    description: 'Explore the 5 microscopic layers of the human epidermis and underlying dermis in 3D. Pull layers apart with the Explode slider, rotate 360°, and inspect cellular keratinization, melanocytes, and capillary loops.',
    emoji: '🔬',
    difficulty: 'Intermediate',
    presets: [
      { label: '🌟 Full Intact Skin Block', params: { layerSeparation: 0, activeLayer: 0, showCells: 1 } },
      { label: '🔍 Exploded Multi-Layer View', params: { layerSeparation: 75, activeLayer: 0, showCells: 1 } },
      { label: '🛡️ Stratum Corneum Barrier', params: { layerSeparation: 40, activeLayer: 1, showCells: 1 } },
      { label: '🧬 Stratum Basale & Mitosis', params: { layerSeparation: 50, activeLayer: 5, showCells: 1 } },
      { label: '🩸 Dermis & Capillary Loops', params: { layerSeparation: 60, activeLayer: 6, showCells: 1 } },
    ],
    params: [
      { key: 'layerSeparation', label: 'Explode Layers', min: 0, max: 100, step: 5, defaultValue: 0, unit: '%' },
      { key: 'activeLayer', label: 'Inspect Layer', min: 0, max: 6, step: 1, defaultValue: 0, unit: '' },
      { key: 'showCells', label: 'Show Cellular Details', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
    ],
    calculateReadouts: (p) => {
      const layerId = Math.round(p.activeLayer)
      const layerDetails: Record<number, { name: string; cells: string; role: string; marker: string }> = {
        0: {
          name: 'All 5 Epidermal Layers + Dermis',
          cells: 'Stratified squamous keratinized epithelium',
          role: 'Complete physical barrier, thermoregulation & sensation',
          marker: 'Turnover cycle: 28–40 days from Basale to Corneum',
        },
        1: {
          name: '1. Stratum Corneum (Horny Layer)',
          cells: '20–30 layers of dead, flat, anucleate corneocytes',
          role: 'Primary waterproof barrier against desiccation and microbes',
          marker: 'Packed with insoluble keratin filaments & lipid envelope',
        },
        2: {
          name: '2. Stratum Lucidum (Clear Layer)',
          cells: '2–3 rows of flat, translucent, dead keratinocytes',
          role: 'Provides extra thickness & resilience in palms and soles',
          marker: 'Contains eleidin, an intermediate transformation protein',
        },
        3: {
          name: '3. Stratum Granulosum (Granular Layer)',
          cells: '3–5 rows of flattening cells with deteriorating nuclei',
          role: 'Active site of keratinization & lipid secretion',
          marker: 'Abundant coarse dark keratohyalin & lamellar granules',
        },
        4: {
          name: '4. Stratum Spinosum (Prickle Cell Layer)',
          cells: '8–10 layers of polyhedral cells with desmosome spines',
          role: 'Mechanical strength against shear stress + immune defense',
          marker: 'Desmosomal bridges and intraepidermal Langerhans cells',
        },
        5: {
          name: '5. Stratum Basale (Stratum Germinativum)',
          cells: 'Single row of actively dividing cuboidal stem cells',
          role: 'Continuous mitotic replenishment of epidermis + UV melanin',
          marker: 'Attached to basement membrane; contains 10–25% melanocytes',
        },
        6: {
          name: 'Dermis (Papillary & Reticular Base)',
          cells: 'Fibroblasts, macrophages, mast cells in collagen matrix',
          role: 'Nourishes avascular epidermis via dermal papillae capillary loops',
          marker: 'Contains Meissner corpuscles, sensory nerves & capillaries',
        },
      }
      const cur = layerDetails[layerId] || layerDetails[0]
      return [
        { label: 'Anatomical Structure', value: cur.name },
        { label: 'Cell Architecture', value: cur.cells },
        { label: 'Physiological Role', value: cur.role },
        { label: 'Histological Marker', value: cur.marker },
      ]
    },
    initScene: (container, initialParams, callbacks = {}) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createBioStudioEnvironment(scene)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(14, 12, 22)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const skinGroup = new THREE.Group()
      scene.add(skinGroup)

      const layerConfigs = [
        { id: 1, name: 'Stratum Corneum', thickness: 0.9, color: 0xd4a373, baseElevation: 5.6 },
        { id: 2, name: 'Stratum Lucidum', thickness: 0.45, color: 0xfefae0, baseElevation: 4.85 },
        { id: 3, name: 'Stratum Granulosum', thickness: 0.85, color: 0xddb892, baseElevation: 4.1 },
        { id: 4, name: 'Stratum Spinosum', thickness: 1.6, color: 0xe07a5f, baseElevation: 2.7 },
        { id: 5, name: 'Stratum Basale', thickness: 0.85, color: 0xb45309, baseElevation: 1.4 },
        { id: 6, name: 'Dermis', thickness: 2.4, color: 0xbe185d, baseElevation: -0.4 },
      ]

      const DISSECT_CARDS: Record<number, DissectInfo> = {
        1: {
          title: 'Stratum Corneum (Horny Barrier Layer)',
          partName: 'Corneocyte Brick & Mortar Lipid Matrix',
          role: 'Primary physical and waterproof barrier safeguarding internal homeostasis',
          internalStructures: ['Anucleate Corneocyte Bricks', 'Extracellular Lipid Mortar (Ceramides, Cholesterol)', 'Filaggrin Crosslinks', 'Desquamation Surface Enzymes'],
          description: 'The outermost layer comprises 20–30 sublayers of dead corneocytes tightly bound in a hydrophobic lipid bilayer matrix. Prevents pathogen penetration and transepidermal water loss (TEWL).',
        },
        2: {
          title: 'Stratum Lucidum (Clear Transition Layer)',
          partName: 'Eleidin-Packed Translucent Zone',
          role: 'Extra mechanical cushioning found in thick skin (palms & soles)',
          internalStructures: ['Translucent Eleidin Protein Granules', 'Flattened Keratinocyte Boundaries', 'Densely Packed Intermediate Tonofibrils'],
          description: 'A thin, clear band of flat dead cells present only in hairless thick skin surfaces subjected to high frictional shear forces.',
        },
        3: {
          title: 'Stratum Granulosum (Granular Layer)',
          partName: 'Keratohyalin & Lamellar Body Secretory Zone',
          role: 'Active biochemical site of cellular death and lipid barrier synthesis',
          internalStructures: ['Keratohyalin Granules (Pro-Filaggrin)', 'Lamellar Bodies (Odland Bodies)', 'Deteriorating Cell Nuclei', 'Apoptotic Programmed Envelopes'],
          description: 'Keratinocytes begin programmed cell death here. They discharge lipid-rich lamellar bodies into intercellular spaces to forge the epidermal water barrier.',
        },
        4: {
          title: 'Stratum Spinosum (Prickle Cell Layer)',
          partName: 'Polyhedral Desmosomal Network & Langerhans Cells',
          role: 'Provides tensile structural resilience against shear tension and houses immune sentinels',
          internalStructures: ['Intercellular Desmosome Spines', 'Keratin Intermediate Filaments', 'Intraepidermal Langerhans (Antigen Presenting) Cells'],
          description: 'Named for its spiny appearance caused by prominent desmosomal cell-to-cell bridges. Langerhans dendritic cells patrol this layer for microbial invaders.',
        },
        5: {
          title: 'Stratum Basale (Germinativum)',
          partName: 'Mitotic Stem Cells & Melanocyte Pigment Factories',
          role: 'Continuous cell renewal and UV-protective melanin production',
          internalStructures: ['Actively Mitotic Basal Stem Cells', 'Melanocytes with Dendritic Melanosomes', 'Merkel Sensory Disc Cells', 'Hemidesmosomes & Basement Membrane'],
          description: 'A single layer of proliferating stem cells anchored to the dermal basement membrane. Melanocytes transfer protective melanin granules into rising keratinocytes to shield DNA from UV damage.',
        },
        6: {
          title: 'Dermis (Papillary & Reticular Base)',
          partName: 'Vascularized Collagen-Elastin Foundation',
          role: 'Nourishes the avascular epidermis and hosts tactile receptors, hair roots, and sweat glands',
          internalStructures: ['Dermal Papillae Arteriovenous Capillary Loops', 'Type I & III Collagen Bundles', 'Meissner Tactile Corpuscles', 'Sensory Nerve Endings'],
          description: 'Richly vascularized matrix providing high tensile elasticity. The dermal ridges interlock with epidermal pegs to supply vital nutrients across the basement membrane.',
        },
      }

      const blockWidth = 9.0
      const blockDepth = 7.0

      interface LayerMeshObj {
        id: number
        group: THREE.Group
        slabMesh: THREE.Mesh
        cellMeshes: THREE.Object3D[]
        baseElevation: number
      }

      const layerObjects: LayerMeshObj[] = []
      const interactableMeshes: THREE.Object3D[] = []

      layerConfigs.forEach((cfg) => {
        const layerGrp = new THREE.Group()
        layerGrp.position.y = cfg.baseElevation
        skinGroup.add(layerGrp)

        const geo = new THREE.BoxGeometry(blockWidth, cfg.thickness, blockDepth)
        const mat = new THREE.MeshStandardMaterial({
          color: cfg.color,
          roughness: 0.4,
          metalness: 0.05,
          transparent: true,
          opacity: 0.94,
        })
        const slabMesh = new THREE.Mesh(geo, mat)
        slabMesh.userData = { layerId: cfg.id }
        layerGrp.add(slabMesh)
        interactableMeshes.push(slabMesh)

        const cellMeshes: THREE.Object3D[] = []

        if (cfg.id === 1) {
          const flakeGeo = new THREE.CircleGeometry(0.35, 6)
          flakeGeo.rotateX(-Math.PI / 2)
          const flakeMat = new THREE.MeshStandardMaterial({ color: 0xfaedcd, roughness: 0.8, side: THREE.DoubleSide })
          for (let i = 0; i < 28; i++) {
            const flake = new THREE.Mesh(flakeGeo, flakeMat)
            flake.position.set(
              (Math.random() - 0.5) * (blockWidth - 1),
              cfg.thickness / 2 + 0.02,
              (Math.random() - 0.5) * (blockDepth - 1)
            )
            flake.rotation.y = Math.random() * Math.PI
            layerGrp.add(flake)
            cellMeshes.push(flake)
          }
        } else if (cfg.id === 3) {
          const granGeo = new THREE.SphereGeometry(0.1, 8, 8)
          const granMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.3 })
          for (let i = 0; i < 35; i++) {
            const gran = new THREE.Mesh(granGeo, granMat)
            gran.position.set(
              (Math.random() - 0.5) * (blockWidth - 1),
              (Math.random() - 0.5) * (cfg.thickness * 0.7),
              (Math.random() - 0.5) * (blockDepth - 1)
            )
            layerGrp.add(gran)
            cellMeshes.push(gran)
          }
        } else if (cfg.id === 4) {
          const spinGeo = new THREE.DodecahedronGeometry(0.24, 0)
          const spinMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
          for (let i = 0; i < 24; i++) {
            const spin = new THREE.Mesh(spinGeo, spinMat)
            spin.position.set(
              (Math.random() - 0.5) * (blockWidth - 1.2),
              (Math.random() - 0.5) * (cfg.thickness * 0.7),
              (Math.random() - 0.5) * (blockDepth - 1.2)
            )
            layerGrp.add(spin)
            cellMeshes.push(spin)
          }
        } else if (cfg.id === 5) {
          const basalGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12)
          const basalMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 })
          const melanMat = new THREE.MeshStandardMaterial({ color: 0x3f1a07, roughness: 0.2 })
          for (let i = 0; i < 24; i++) {
            const isMelanocyte = i % 5 === 0
            const cMesh = new THREE.Mesh(basalGeo, isMelanocyte ? melanMat : basalMat)
            cMesh.position.set(
              (Math.random() - 0.5) * (blockWidth - 1.2),
              0,
              (Math.random() - 0.5) * (blockDepth - 1.2)
            )
            layerGrp.add(cMesh)
            cellMeshes.push(cMesh)
          }
        } else if (cfg.id === 6) {
          const loopGeo = new THREE.TorusGeometry(0.65, 0.08, 8, 16, Math.PI)
          const redLoopMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
          const blueLoopMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 })
          for (let i = 0; i < 6; i++) {
            const loopRed = new THREE.Mesh(loopGeo, redLoopMat)
            loopRed.position.set(-2.8 + i * 1.1, cfg.thickness / 2 - 0.1, -1.2)
            layerGrp.add(loopRed)
            cellMeshes.push(loopRed)

            const loopBlue = new THREE.Mesh(loopGeo, blueLoopMat)
            loopBlue.position.set(-2.6 + i * 1.1, cfg.thickness / 2 - 0.1, 1.2)
            layerGrp.add(loopBlue)
            cellMeshes.push(loopBlue)
          }
        }

        layerObjects.push({
          id: cfg.id,
          group: layerGrp,
          slabMesh,
          cellMeshes,
          baseElevation: cfg.baseElevation,
        })
      })

      let activeDissectId: number | null = null

      const applyLayerTransforms = () => {
        const sepFactor = (params.layerSeparation / 100) * 2.8 + (activeDissectId ? 1.4 : 0)
        const activeLyr = activeDissectId !== null ? activeDissectId : Math.round(params.activeLayer)
        const showCellDetails = params.showCells >= 0.5

        layerObjects.forEach((obj, idx) => {
          const explodeY = (2.5 - idx) * sepFactor
          obj.group.position.y = obj.baseElevation + explodeY

          const isHighlighted = activeLyr === 0 || activeLyr === obj.id
          const mat = obj.slabMesh.material as THREE.MeshStandardMaterial

          if (isHighlighted) {
            mat.opacity = 0.94
            mat.emissive.setHex(activeLyr === obj.id ? 0x223344 : 0x000000)
          } else {
            mat.opacity = 0.22
            mat.emissive.setHex(0x000000)
          }

          obj.cellMeshes.forEach((cm) => {
            cm.visible = showCellDetails && isHighlighted
          })
        })
      }

      applyLayerTransforms()

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
          const id = hit.userData?.layerId as number | undefined
          if (id) {
            if (activeDissectId === id) {
              activeDissectId = null
              callbacks.onInspectPart?.(null)
            } else {
              activeDissectId = id
              callbacks.onInspectPart?.(DISSECT_CARDS[id])
            }
            applyLayerTransforms()
          }
        } else {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          applyLayerTransforms()
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

      let time = 0
      const animate = () => {
        animId = requestAnimationFrame(animate)
        if (isPlaying) {
          time += 0.01
          if (!activeDissectId) {
            skinGroup.rotation.y += 0.002
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
          applyLayerTransforms()
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          skinGroup.rotation.set(0, 0, 0)
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          controls.reset()
          applyLayerTransforms()
        },
        closeDissection: () => {
          activeDissectId = null
          callbacks.onInspectPart?.(null)
          applyLayerTransforms()
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
    title: '3D Electric DC Motor & Lorentz Force',
    subject: 'Physics · Electromagnetism',
    concept: 'Fleming’s Left-Hand Rule, Magnetic Torque & Commutator',
    description: 'Explore the internal mechanical and electromagnetic workings of a 3D DC electric motor. Watch magnetic field flux lines, Lorentz force vectors on armature coils, and split-ring commutator current reversal in real time.',
    emoji: '⚡',
    difficulty: 'Intermediate',
    presets: [
      { label: '⚡ Standard DC Motor (12V, 1.0T)', params: { voltage: 12, fieldStrength: 1.0, coilTurns: 50 } },
      { label: '🏎️ High-Torque Turbo (24V, 1.8T)', params: { voltage: 24, fieldStrength: 1.8, coilTurns: 100 } },
      { label: '🔬 Slow-Motion Commutator (4V, 0.5T)', params: { voltage: 4, fieldStrength: 0.5, coilTurns: 30 } },
    ],
    params: [
      { key: 'voltage', label: 'DC Voltage (V)', min: 0, max: 24, step: 1, defaultValue: 12, unit: 'V' },
      { key: 'fieldStrength', label: 'Magnetic Field (B)', min: 0.2, max: 2.0, step: 0.1, defaultValue: 1.0, unit: 'T' },
      { key: 'coilTurns', label: 'Coil Windings (N)', min: 10, max: 150, step: 5, defaultValue: 50, unit: 'turns' },
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
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 35, 35)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 18, 30)

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
        commutator: {
          title: 'Split-Ring Commutator & Carbon Brushes',
          partName: 'Current Inversion Assembly Dissected',
          role: 'Reverses DC current through the armature coil every half-rotation (180°) to maintain continuous unidirectional torque',
          internalStructures: ['Dual Semi-Cylindrical Copper Segments', 'Mica Insulation Gap', 'Spring-Loaded Carbon Brushes', 'Brush Spark Arc Discharges'],
          description: 'Double-tapping reveals the commutator cross-section. Without current reversal every half-turn, torque would reverse and the rotor would merely oscillate back and forth around the neutral plane instead of spinning continuously.',
        },
        armature: {
          title: 'Armature Coil & Rotor Core',
          partName: 'Lorentz Force Generator Core',
          role: 'Electromagnetic coil converting electrical power into mechanical torque via Fleming\'s Left-Hand Rule',
          internalStructures: ['Multi-turn Enamelled Copper Windings (N turns)', 'Laminated Soft-Iron Core (Eddy Current Supression)', 'Steel Drive Shaft & Bearings', 'Lorentz Torque Couple: τ = NIAB sin(θ)'],
          description: 'Inspecting the rotating armature reveals the laminated silicon-steel core designed to minimize parasitic eddy current losses, and copper windings experiencing equal and opposite magnetic forces.',
        },
        magnets: {
          title: 'Stator Field Magnets (N-S Poles)',
          partName: 'Uniform Transverse Magnetic Field Medium',
          role: 'Generates horizontal magnetic flux lines (B-field) crossing the air gap',
          internalStructures: ['North (Red) & South (Blue) Sintered NdFeB Poles', 'Cyan Magnetic Flux Streamlines', 'Soft Iron Return Yoke'],
          description: 'The stator produces a uniform magnetic field across the air gap. The magnetic flux vectors cross perpendicular to the armature wire, maximizing the vector cross product F = I(L × B).',
        },
      }

      const motorGroup = new THREE.Group()
      scene.add(motorGroup)

      const magnetGeo = new THREE.BoxGeometry(3.5, 5.0, 9.0)
      const northMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.3,
        metalness: 0.3,
      })
      const southMat = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.3,
        metalness: 0.3,
      })

      const northPole = new THREE.Mesh(magnetGeo, northMat)
      northPole.position.set(-8.5, 0, 0)
      northPole.userData = { partId: 'magnets' }
      motorGroup.add(northPole)
      interactableMeshes.push(northPole)

      const southPole = new THREE.Mesh(magnetGeo, southMat)
      southPole.position.set(8.5, 0, 0)
      southPole.userData = { partId: 'magnets' }
      motorGroup.add(southPole)
      interactableMeshes.push(southPole)

      // Magnetic Flux Lines
      const fluxLinesCount = 8
      for (let i = 0; i < fluxLinesCount; i++) {
        const fy = -1.8 + (i % 3) * 1.8
        const fz = -3.2 + Math.floor(i / 3) * 3.2
        const arrow = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-6.7, fy, fz),
          13.4,
          0x06b6d4,
          0.8,
          0.4
        )
        motorGroup.add(arrow)
      }

      // Rotor Group
      const rotorGroup = new THREE.Group()
      motorGroup.add(rotorGroup)

      const shaftGeo = new THREE.CylinderGeometry(0.35, 0.35, 14, 16)
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
      const shaft = new THREE.Mesh(shaftGeo, shaftMat)
      shaft.rotation.x = Math.PI / 2
      rotorGroup.add(shaft)

      const coilWidth = 6.8
      const coilLength = 8.5
      const copperMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.85,
        roughness: 0.25,
      })

      const coilLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, coilLength, 12), copperMat)
      coilLeft.position.x = -coilWidth / 2
      coilLeft.rotation.x = Math.PI / 2
      coilLeft.userData = { partId: 'armature' }
      rotorGroup.add(coilLeft)
      interactableMeshes.push(coilLeft)

      const coilRight = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, coilLength, 12), copperMat)
      coilRight.position.x = coilWidth / 2
      coilRight.rotation.x = Math.PI / 2
      coilRight.userData = { partId: 'armature' }
      rotorGroup.add(coilRight)
      interactableMeshes.push(coilRight)

      const coilFront = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, coilWidth, 12), copperMat)
      coilFront.position.z = coilLength / 2
      coilFront.rotation.z = Math.PI / 2
      coilFront.userData = { partId: 'armature' }
      rotorGroup.add(coilFront)
      interactableMeshes.push(coilFront)

      const coilBack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, coilWidth, 12), copperMat)
      coilBack.position.z = -coilLength / 2
      coilBack.rotation.z = Math.PI / 2
      coilBack.userData = { partId: 'armature' }
      rotorGroup.add(coilBack)
      interactableMeshes.push(coilBack)

      const coreGeo = new THREE.CylinderGeometry(coilWidth * 0.44, coilWidth * 0.44, coilLength * 0.85, 20)
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 })
      const ironCore = new THREE.Mesh(coreGeo, coreMat)
      ironCore.rotation.x = Math.PI / 2
      ironCore.userData = { partId: 'armature' }
      rotorGroup.add(ironCore)
      interactableMeshes.push(ironCore)

      // Split-Ring Commutator Segments
      const commMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.9,
        roughness: 0.2,
      })
      const comm1Geo = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 16, 1, false, 0.15, Math.PI - 0.3)
      const commRing1 = new THREE.Mesh(comm1Geo, commMat)
      commRing1.rotation.x = Math.PI / 2
      commRing1.position.z = coilLength / 2 + 1.8
      commRing1.userData = { partId: 'commutator' }
      rotorGroup.add(commRing1)
      interactableMeshes.push(commRing1)

      const comm2Geo = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 16, 1, false, Math.PI + 0.15, Math.PI - 0.3)
      const commRing2 = new THREE.Mesh(comm2Geo, commMat)
      commRing2.rotation.x = Math.PI / 2
      commRing2.position.z = coilLength / 2 + 1.8
      commRing2.userData = { partId: 'commutator' }
      rotorGroup.add(commRing2)
      interactableMeshes.push(commRing2)

      // Carbon Brushes
      const brushMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
      const brushGeo = new THREE.BoxGeometry(0.5, 0.7, 1.4)

      const brushPositive = new THREE.Mesh(brushGeo, brushMat)
      brushPositive.position.set(-1.15, 0, coilLength / 2 + 1.8)
      brushPositive.userData = { partId: 'commutator' }
      motorGroup.add(brushPositive)
      interactableMeshes.push(brushPositive)

      const brushNegative = new THREE.Mesh(brushGeo, brushMat)
      brushNegative.position.set(1.15, 0, coilLength / 2 + 1.8)
      brushNegative.userData = { partId: 'commutator' }
      motorGroup.add(brushNegative)
      interactableMeshes.push(brushNegative)

      const redLead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 3.5, 12),
        new THREE.MeshStandardMaterial({ color: 0xef4444 })
      )
      redLead.position.set(-2.5, -1.5, coilLength / 2 + 1.8)
      redLead.rotation.z = Math.PI / 4
      motorGroup.add(redLead)

      const blueLead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 3.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
      )
      blueLead.position.set(2.5, -1.5, coilLength / 2 + 1.8)
      blueLead.rotation.z = -Math.PI / 4
      motorGroup.add(blueLead)

      const forceArrowLeft = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-coilWidth / 2, 0, 0),
        3.5,
        0xd946ef,
        0.9,
        0.45
      )
      rotorGroup.add(forceArrowLeft)

      const forceArrowRight = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(coilWidth / 2, 0, 0),
        3.5,
        0xd946ef,
        0.9,
        0.45
      )
      rotorGroup.add(forceArrowRight)

      let angle = 0
      let activeDissectId: 'commutator' | 'armature' | 'magnets' | null = null

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
          const id = hit.userData?.partId as 'commutator' | 'armature' | 'magnets' | undefined
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

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying && params.voltage > 0) {
          const speed = (params.voltage / 12) * params.fieldStrength * 0.05
          angle += speed
          rotorGroup.rotation.z = angle

          const torqueMagnitude = Math.abs(Math.cos(angle))
          const forceLen = Math.max(0.5, 3.5 * torqueMagnitude * (params.voltage / 12))

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
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          angle = 0
          rotorGroup.rotation.z = 0
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
}

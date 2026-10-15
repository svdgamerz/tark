import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SimulationParam, SimulationReadout } from './types'

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
    callbacks: { onUpdateReadouts?: (r: SimulationReadout[]) => void }
  ) => {
    updateParams: (params: Record<string, number>) => void
    setPlaying: (playing: boolean) => void
    reset: () => void
    dispose: () => void
  }
}

// Helper: Apply cinematic tone mapping, soft shadows, and high-DPI scaling to WebGL renderer
export function setupRenderer(renderer: THREE.WebGLRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}

// Helper: Create a styled 3D laboratory environment (grid, lighting, soft shadows)
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
    initScene: (container, initialParams) => {
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

      // 3D Articulated Cannon Rig
      const cannonGroup = new THREE.Group()
      scene.add(cannonGroup)

      const baseGeo = new THREE.CylinderGeometry(2, 2.5, 0.8, 24)
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.25 })
      const baseMesh = new THREE.Mesh(baseGeo, metalMat)
      baseMesh.position.y = 0.4
      cannonGroup.add(baseMesh)

      // Turret & Barrel
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
      barrelGroup.add(barrelMesh)

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

      // Parabolic Trajectory Line (3D Ribbon)
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
        metalness: 0.6,
        roughness: 0.2,
        emissive: 0xd97706,
        emissiveIntensity: 0.35,
      })
      const ballMesh = new THREE.Mesh(ballGeo, ballMat)
      scene.add(ballMesh)

      // Velocity Vector Arrow
      const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(1, 1, 0).normalize(), new THREE.Vector3(), 4, 0x10b981, 1, 0.5)
      scene.add(arrowHelper)

      let simTime = 0

      function updateCannonOrientation() {
        const el = (params.angle * Math.PI) / 180
        const az = (-params.azimuth * Math.PI) / 180
        turretPivot.rotation.y = az
        barrelGroup.rotation.x = -el

        // Place target at theoretical landing position
        const g = params.gravity
        const v0 = params.speed
        const range = (v0 * v0 * Math.sin(2 * el)) / g
        targetGroup.position.set(range * Math.cos(az), 0, range * Math.sin(az))
      }

      updateCannonOrientation()

      function animate() {
        animId = requestAnimationFrame(animate)

        const el = (params.angle * Math.PI) / 180
        const az = (-params.azimuth * Math.PI) / 180
        const g = params.gravity
        const v0 = params.speed
        const totalTime = (2 * v0 * Math.sin(el)) / g

        if (isPlaying) {
          simTime += 0.025
          if (simTime > totalTime + 0.8) {
            simTime = 0
          }
        }

        const t = Math.min(simTime, totalTime)
        const vx = v0 * Math.cos(el) * Math.cos(az)
        const vz = v0 * Math.cos(el) * Math.sin(az)
        const vy = v0 * Math.sin(el) - g * t

        const currentX = v0 * Math.cos(el) * Math.cos(az) * t
        const currentY = Math.max(0, v0 * Math.sin(el) * t - 0.5 * g * t * t)
        const currentZ = v0 * Math.cos(el) * Math.sin(az) * t

        ballMesh.position.set(currentX, currentY + 1.2, currentZ)

        // Update velocity arrow
        const vDir = new THREE.Vector3(vx, vy, vz)
        const vMag = vDir.length()
        if (vMag > 0.01) {
          arrowHelper.position.copy(ballMesh.position)
          arrowHelper.setDirection(vDir.clone().normalize())
          arrowHelper.setLength(Math.min(vMag * 0.25, 6), 1, 0.4)
        }

        // Draw trajectory trail
        const pts = Math.floor(Math.min((t / (totalTime || 1)) * maxTrailPoints, maxTrailPoints))
        const posAttr = trailGeo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pts; i++) {
          const ptTime = (i / maxTrailPoints) * totalTime
          const px = v0 * Math.cos(el) * Math.cos(az) * ptTime
          const py = v0 * Math.sin(el) * ptTime - 0.5 * g * ptTime * ptTime + 1.2
          const pz = v0 * Math.cos(el) * Math.sin(az) * ptTime
          posAttr.setXYZ(i, px, Math.max(0, py), pz)
        }
        for (let i = pts; i < maxTrailPoints; i++) {
          posAttr.setXYZ(i, currentX, currentY + 1.2, currentZ)
        }
        posAttr.needsUpdate = true

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
          simTime = 0
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          simTime = 0
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
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

      // Starfield particles in the background
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

      // The Sun (Glowing Central Sphere with Multi-Layered Coronal Plasma Aura)
      const sunGroup = new THREE.Group()
      scene.add(sunGroup)
      const sunGeo = new THREE.SphereGeometry(3.5, 32, 32)
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff7ed })
      const sunMesh = new THREE.Mesh(sunGeo, sunMat)
      sunGroup.add(sunMesh)

      const coronaGeo = new THREE.SphereGeometry(4.3, 32, 32)
      const coronaMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
        side: THREE.BackSide,
      })
      const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat)
      sunGroup.add(coronaMesh)

      const outerCoronaGeo = new THREE.SphereGeometry(5.4, 32, 32)
      const outerCoronaMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
      })
      const outerCoronaMesh = new THREE.Mesh(outerCoronaGeo, outerCoronaMat)
      sunGroup.add(outerCoronaMesh)

      // Sun Light & Point Light
      const sunLight = new THREE.PointLight(0xfffbeb, 2.8, 350, 0.2)
      scene.add(sunLight)
      const ambLight = new THREE.AmbientLight(0x334155, 0.5)
      scene.add(ambLight)

      // Planets Definitions: [Name, DistanceAU, Radius, Color, PeriodRatio, HasRings, HasMoon]
      const planetData = [
        { name: 'Mercury', dist: 7, size: 0.55, color: 0x94a3b8, speed: 4.15 },
        { name: 'Venus', dist: 11, size: 0.95, color: 0xf59e0b, speed: 1.62 },
        { name: 'Earth', dist: 16, size: 1.1, color: 0x38bdf8, speed: 1.0, hasMoon: true },
        { name: 'Mars', dist: 22, size: 0.7, color: 0xef4444, speed: 0.53 },
        { name: 'Jupiter', dist: 30, size: 2.4, color: 0xd97706, speed: 0.084 },
        { name: 'Saturn', dist: 38, size: 1.9, color: 0xfde047, speed: 0.034, hasRings: true },
      ]

      let earthMoon: THREE.Mesh | null = null
      const planets: {
        mesh: THREE.Mesh
        pivot: THREE.Group
        orbitLine: THREE.Line
        data: typeof planetData[0]
        angle: number
      }[] = []

      planetData.forEach((p) => {
        const pivot = new THREE.Group()
        scene.add(pivot)

        const pGeo = new THREE.SphereGeometry(p.size, 24, 24)
        const pMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.5, metalness: 0.1 })
        const mesh = new THREE.Mesh(pGeo, pMat)
        mesh.position.x = p.dist * params.scaleDist
        pivot.add(mesh)

        if (p.hasMoon) {
          const mGeo = new THREE.SphereGeometry(0.32, 16, 16)
          const mMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 })
          earthMoon = new THREE.Mesh(mGeo, mMat)
          mesh.add(earthMoon)
        }

        if (p.hasRings) {
          // Inner Ring B
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

          // Outer Ring A (separated by Cassini Division gap)
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

        // Orbit Line
        const orbitCurve = new THREE.EllipseCurve(0, 0, p.dist * params.scaleDist, p.dist * params.scaleDist, 0, 2 * Math.PI, false, 0)
        const points = orbitCurve.getPoints(64)
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(points.map((pt) => new THREE.Vector3(pt.x, 0, pt.y)))
        const orbitMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 })
        const orbitLine = new THREE.Line(orbitGeo, orbitMat)
        scene.add(orbitLine)

        planets.push({ mesh, pivot, orbitLine, data: p, angle: Math.random() * Math.PI * 2 })
      })

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
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
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

      // Central glowing core
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

      nucleonPositions.forEach((pos, idx) => {
        const mat = idx % 2 === 0 ? protonMat : neutronMat
        const nMesh = new THREE.Mesh(nucleonGeo, mat)
        nMesh.position.copy(pos)
        nucleusGroup.add(nMesh)
      })

      // Shell Rings (n=1 to 5) with quantized Bohr radii r_n = r_0 * n^1.3 (visually scaled)
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

        // Subtle glowing translucent ring disc
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

      // Ambient Ground-State Electrons on lower shells
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
      scene.add(electron)

      // Electron Trail
      const trailCount = 25
      const trailPositions = new Float32Array(trailCount * 3)
      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
      const trailMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
      const trailLine = new THREE.Line(trailGeo, trailMat)
      scene.add(trailLine)

      // Photon Wave Packet (Emitted on downward quantum jumps)
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

      // Sinusoidal wave tail for photon wave packet
      const wavePtsCount = 40
      const wavePos = new Float32Array(wavePtsCount * 3)
      const waveGeo = new THREE.BufferGeometry()
      waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePos, 3))
      const waveMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 })
      const waveLine = new THREE.Line(waveGeo, waveMat)
      photonGroup.add(waveLine)

      // 3D Quantum Orbital Lobes (px, py, pz dumbbell surfaces)
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

      // Pz lobes (vertical)
      const topLobeZ = new THREE.Mesh(lobeGeo, lobeMatPos)
      topLobeZ.position.y = 3.4
      orbitalGroup.add(topLobeZ)

      const botLobeZ = new THREE.Mesh(lobeGeo, lobeMatNeg)
      botLobeZ.position.y = -3.4
      orbitalGroup.add(botLobeZ)

      // Px lobes (horizontal)
      const lobeGeoX = lobeGeo.clone()
      lobeGeoX.rotateZ(Math.PI / 2)
      const rightLobeX = new THREE.Mesh(lobeGeoX, lobeMatPos)
      rightLobeX.position.x = 3.4
      orbitalGroup.add(rightLobeX)

      const leftLobeX = new THREE.Mesh(lobeGeoX, lobeMatNeg)
      leftLobeX.position.x = -3.4
      orbitalGroup.add(leftLobeX)

      // Helper to compute spectral color hex based on transition
      function getSpectralColor(ni: number, nf: number): number {
        if (nf === 1) return 0xa855f7 // Lyman UV (Violet Glow)
        if (nf === 2) {
          if (ni === 3) return 0xef4444 // Balmer H-alpha 656.3 nm Red
          if (ni === 4) return 0x06b6d4 // Balmer H-beta 486.1 nm Cyan
          if (ni >= 5) return 0x8b5cf6 // Balmer H-gamma 434.0 nm Violet
        }
        return 0xf59e0b // Paschen IR (Amber Glow)
      }

      let theta = 0
      let currentR = shellRadii[Math.max(0, Math.min(params.nInitial - 1, 4))]
      let photonDistance = 0
      let photonDir = new THREE.Vector3(1, 0.4, 0.5).normalize()
      let photonActive = false
      let cycleTimer = 0

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          theta += 0.038
          nucleusGroup.rotation.y += 0.008
          nucleusGroup.rotation.x += 0.005
          orbitalGroup.rotation.y += 0.012

          // Update ambient electrons
          ambientElectrons.forEach((el) => {
            el.angle += el.speed
            el.mesh.position.set(el.r * Math.cos(el.angle), 0, el.r * Math.sin(el.angle))
          })

          // Smooth quantum transition between shells
          const targetR = shellRadii[Math.max(0, Math.min(params.nFinal - 1, 4))]
          currentR += (targetR - currentR) * 0.045

          electron.position.set(currentR * Math.cos(theta), 0, currentR * Math.sin(theta))

          // Update electron trail
          const tPos = trailGeo.attributes.position as THREE.BufferAttribute
          for (let i = trailCount - 1; i > 0; i--) {
            tPos.setXYZ(i, tPos.getX(i - 1), tPos.getY(i - 1), tPos.getZ(i - 1))
          }
          tPos.setXYZ(0, electron.position.x, electron.position.y, electron.position.z)
          tPos.needsUpdate = true

          // Trigger photon emission wave packet periodically
          cycleTimer += 0.016
          if (cycleTimer > 2.8) {
            cycleTimer = 0
            if (params.nInitial > params.nFinal) {
              photonActive = true
              photonDistance = targetR
              photonDir.set(Math.cos(theta), 0.35, Math.sin(theta)).normalize()
              const spectralCol = getSpectralColor(params.nInitial, params.nFinal)
              photonGlowMat.color.setHex(spectralCol)
              waveMat.color.setHex(spectralCol)
              photonGroup.visible = true
            }
          }

          if (photonActive) {
            photonDistance += 0.32
            photonGroup.position.copy(photonDir.clone().multiplyScalar(photonDistance))

            // Animate sinusoidal wave packet tail
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
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 30, 30)

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

      function buildMolecule() {
        while (molGroup.children.length > 0) {
          molGroup.remove(molGroup.children[0])
        }

        const scale = params.bondScale

        if (params.moleculeId === 0) {
          // Water (H2O): Oxygen at origin, two Hydrogens at 104.5 degrees
          const oMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 32), mats.O)
          molGroup.add(oMesh)

          const angle = (104.5 * Math.PI) / 180
          const hDist = 3.2 * scale
          const h1Pos = new THREE.Vector3(hDist * Math.sin(angle / 2), -hDist * Math.cos(angle / 2), 0)
          const h2Pos = new THREE.Vector3(-hDist * Math.sin(angle / 2), -hDist * Math.cos(angle / 2), 0)

          const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), mats.H)
          h1.position.copy(h1Pos)
          molGroup.add(h1)

          const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), mats.H)
          h2.position.copy(h2Pos)
          molGroup.add(h2)

          // Cylinder Bonds
          const addBond = (p1: THREE.Vector3, p2: THREE.Vector3) => {
            const dir = new THREE.Vector3().subVectors(p2, p1)
            const len = dir.length()
            const bGeo = new THREE.CylinderGeometry(0.28, 0.28, len, 16)
            bGeo.translate(0, len / 2, 0)
            const bMesh = new THREE.Mesh(bGeo, mats.bond)
            bMesh.position.copy(p1)
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
            molGroup.add(bMesh)
          }

          addBond(new THREE.Vector3(0, 0, 0), h1Pos)
          addBond(new THREE.Vector3(0, 0, 0), h2Pos)
        } else if (params.moleculeId === 1) {
          // Methane (CH4): Carbon at origin, 4 Hydrogens at tetrahedral vertices
          const cMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), mats.C)
          molGroup.add(cMesh)

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
            molGroup.add(h)

            const dir = pos.clone()
            const len = dir.length()
            const bGeo = new THREE.CylinderGeometry(0.28, 0.28, len, 16)
            bGeo.translate(0, len / 2, 0)
            const bMesh = new THREE.Mesh(bGeo, mats.bond)
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
            molGroup.add(bMesh)
          })
        } else if (params.moleculeId === 2) {
          // Carbon Dioxide (CO2): Linear O=C=O
          const cMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 32), mats.C)
          molGroup.add(cMesh)

          const dist = 3.6 * scale
          const o1 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), mats.O)
          o1.position.set(dist, 0, 0)
          molGroup.add(o1)

          const o2 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), mats.O)
          o2.position.set(-dist, 0, 0)
          molGroup.add(o2)

          // Double bond cylinders
          const addDoubleBond = (xOffset: number) => {
            const bGeo = new THREE.CylinderGeometry(0.2, 0.2, dist, 16)
            bGeo.translate(0, dist / 2, 0)
            const b1 = new THREE.Mesh(bGeo, mats.bond)
            b1.position.set(xOffset > 0 ? 0 : 0, 0.4, 0)
            b1.rotation.z = xOffset > 0 ? -Math.PI / 2 : Math.PI / 2
            molGroup.add(b1)

            const b2 = new THREE.Mesh(bGeo, mats.bond)
            b2.position.set(xOffset > 0 ? 0 : 0, -0.4, 0)
            b2.rotation.z = xOffset > 0 ? -Math.PI / 2 : Math.PI / 2
            molGroup.add(b2)
          }
          addDoubleBond(dist)
          addDoubleBond(-dist)
        } else {
          // Ammonia (NH3): Nitrogen with 3 Hydrogens in trigonal pyramid
          const nMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 32), mats.N)
          nMesh.position.y = 0.8
          molGroup.add(nMesh)

          const dist = 3.1 * scale
          for (let i = 0; i < 3; i++) {
            const a = (i * 2 * Math.PI) / 3
            const hPos = new THREE.Vector3(dist * Math.cos(a), -1.2, dist * Math.sin(a))
            const h = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), mats.H)
            h.position.copy(hPos)
            molGroup.add(h)

            const dir = new THREE.Vector3().subVectors(hPos, nMesh.position)
            const len = dir.length()
            const bGeo = new THREE.CylinderGeometry(0.28, 0.28, len, 16)
            bGeo.translate(0, len / 2, 0)
            const bMesh = new THREE.Mesh(bGeo, mats.bond)
            bMesh.position.copy(nMesh.position)
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
            molGroup.add(bMesh)
          }
        }
      }

      buildMolecule()

      function animate() {
        animId = requestAnimationFrame(animate)
        if (isPlaying) {
          molGroup.rotation.y += 0.012
          molGroup.rotation.x += 0.006
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
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 30, 30)

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

      function buildDNA() {
        // Clear previous children
        while (helixGroup.children.length > 0) {
          helixGroup.remove(helixGroup.children[0])
        }
        pairGroups = []

        const numSteps = 42
        const stepY = 0.65
        const totalH = numSteps * stepY
        const r = params.baseRadius
        const isUnzip = params.unzipping === 1

        const pts1: THREE.Vector3[] = []
        const pts2: THREE.Vector3[] = []

        // Major groove angle offset (140 deg)
        const grooveOffset = (140 * Math.PI) / 180

        for (let i = 0; i < numSteps; i++) {
          const angle = i * 0.36
          const y = i * stepY - totalH / 2

          // Fork divergence if unzipping
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

          // Sugar-phosphate nodes
          const node1 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), nodeMat1)
          node1.position.copy(p1)
          helixGroup.add(node1)

          const node2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), nodeMat2)
          node2.position.copy(p2)
          helixGroup.add(node2)

          // Base Pair Rungs (joined only below the fork if unzipping)
          const pairGroup = new THREE.Group()
          helixGroup.add(pairGroup)
          pairGroups.push(pairGroup)

          const bType = i % 2 === 0 ? 0 : 2 // 0: A-T, 2: G-C
          const matBase1 = new THREE.MeshStandardMaterial({ color: baseColors[bType], roughness: 0.3 })
          const matBase2 = new THREE.MeshStandardMaterial({ color: baseColors[bType + 1], roughness: 0.3 })

          const centerPt = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
          const strandDir = new THREE.Vector3().subVectors(p2, p1)
          const fullLen = strandDir.length()

          if (!isUnzip || i <= numSteps * 0.55) {
            // Intact base pair joined by hydrogen bonds
            const halfLen = fullLen * 0.42

            // Base 1 cylinder
            const b1Geo = new THREE.CylinderGeometry(0.2, 0.2, halfLen, 12)
            b1Geo.translate(0, halfLen / 2, 0)
            const b1 = new THREE.Mesh(b1Geo, matBase1)
            b1.position.copy(p1)
            b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().normalize())
            pairGroup.add(b1)

            // Base 2 cylinder
            const b2Geo = new THREE.CylinderGeometry(0.2, 0.2, halfLen, 12)
            b2Geo.translate(0, halfLen / 2, 0)
            const b2 = new THREE.Mesh(b2Geo, matBase2)
            b2.position.copy(p2)
            b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().negate().normalize())
            pairGroup.add(b2)

            // Hydrogen Bonds (2 for A=T, 3 for G≡C)
            const hCount = bType === 0 ? 2 : 3
            const hGap = 0.2
            for (let h = 0; h < hCount; h++) {
              const hOffset = (h - (hCount - 1) / 2) * hGap
              const hBridgeGeo = new THREE.CylinderGeometry(0.06, 0.06, fullLen * 0.16, 8)
              const hBridge = new THREE.Mesh(hBridgeGeo, hBondMat)
              hBridge.position.copy(centerPt).add(new THREE.Vector3(0, hOffset, 0))
              hBridge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strandDir.clone().normalize())
              pairGroup.add(hBridge)
            }
          } else {
            // Unzipped individual open nucleotide bases projecting inward
            const stubLen = r * 0.55
            const b1Geo = new THREE.CylinderGeometry(0.2, 0.2, stubLen, 12)
            b1Geo.translate(0, stubLen / 2, 0)
            const b1 = new THREE.Mesh(b1Geo, matBase1)
            b1.position.copy(p1)
            const inward1 = new THREE.Vector3(0, y, 0).sub(p1).normalize()
            b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward1)
            pairGroup.add(b1)

            const b2Geo = new THREE.CylinderGeometry(0.2, 0.2, stubLen, 12)
            b2Geo.translate(0, stubLen / 2, 0)
            const b2 = new THREE.Mesh(b2Geo, matBase2)
            b2.position.copy(p2)
            const inward2 = new THREE.Vector3(0, y, 0).sub(p2).normalize()
            b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward2)
            pairGroup.add(b2)
          }
        }

        // Build continuous smooth 3D tube geometries for both sugar-phosphate backbones
        const curve1 = new THREE.CatmullRomCurve3(pts1)
        const tube1Geo = new THREE.TubeGeometry(curve1, 80, 0.26, 12, false)
        strandMesh1 = new THREE.Mesh(tube1Geo, backboneMat1)
        helixGroup.add(strandMesh1)

        const curve2 = new THREE.CatmullRomCurve3(pts2)
        const tube2Geo = new THREE.TubeGeometry(curve2, 80, 0.26, 12, false)
        strandMesh2 = new THREE.Mesh(tube2Geo, backboneMat2)
        helixGroup.add(strandMesh2)

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
          helixGroup.rotation.y += 0.016 * params.twistSpeed
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
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    description: '3D anatomical human heart with realistic rhythmic systole and diastole contractions. Observe valve action and flowing red (oxygenated) and blue (deoxygenated) blood streams.',
    emoji: '🫀',
    difficulty: 'Intermediate',
    presets: [
      { label: '❤️ Normal Resting Heartbeat (72 BPM)', params: { bpm: 72, strokeVolume: 70, showValves: 1 } },
      { label: '🏃 Athletic Cardio Workout (130 BPM)', params: { bpm: 130, strokeVolume: 90, showValves: 1 } },
      { label: '🧘 Deep Meditation (55 BPM)', params: { bpm: 55, strokeVolume: 65, showValves: 1 } },
    ],
    params: [
      { key: 'bpm', label: 'Heart Rate (BPM)', min: 45, max: 180, step: 1, defaultValue: 72, unit: 'bpm' },
      { key: 'strokeVolume', label: 'Stroke Volume', min: 40, max: 120, step: 2, defaultValue: 70, unit: 'mL' },
      { key: 'showValves', label: 'Chamber Cross-Section', min: 0, max: 1, step: 1, defaultValue: 1, unit: '' },
    ],
    calculateReadouts: (p) => {
      const co = ((p.bpm * p.strokeVolume) / 1000).toFixed(2)
      const cycleTime = (60 / p.bpm).toFixed(2)
      return [
        { label: 'Cardiac Output (Q)', value: co, unit: 'L/min', formula: 'Q = HR × SV' },
        { label: 'Cardiac Cycle Time', value: cycleTime, unit: 's', formula: 'T = 60 / BPM' },
        { label: 'Blood Circuit', value: 'Systemic (Red) & Pulmonary (Blue)' },
      ]
    },
    initScene: (container, initialParams) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      createLabEnvironment(scene, 25, 25)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 5, 20)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const heartGroup = new THREE.Group()
      scene.add(heartGroup)

      // Anatomical Muscle Materials
      const myoMatLeft = new THREE.MeshStandardMaterial({
        color: 0x9f1239,
        roughness: 0.35,
        metalness: 0.15,
      })
      const myoMatRight = new THREE.MeshStandardMaterial({
        color: 0xbe123c,
        roughness: 0.4,
        metalness: 0.1,
      })
      const atriumMat = new THREE.MeshStandardMaterial({
        color: 0x881337,
        roughness: 0.45,
        metalness: 0.1,
      })
      const valveMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
      const coronaryMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xbe123c,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      })

      // 1. LEFT VENTRICLE (Thick conical muscular chamber forming cardiac apex)
      const lvGeo = new THREE.SphereGeometry(2.8, 32, 32)
      lvGeo.scale(0.9, 1.45, 0.95)
      const lvMesh = new THREE.Mesh(lvGeo, myoMatLeft)
      lvMesh.position.set(-0.8, -0.6, 0.2)
      lvMesh.rotation.z = 0.18
      heartGroup.add(lvMesh)

      // 2. RIGHT VENTRICLE (Anterior crescent-shaped chamber)
      const rvGeo = new THREE.SphereGeometry(2.5, 32, 32)
      rvGeo.scale(1.05, 1.3, 0.8)
      const rvMesh = new THREE.Mesh(rvGeo, myoMatRight)
      rvMesh.position.set(1.1, -0.4, 0.5)
      rvMesh.rotation.z = -0.15
      heartGroup.add(rvMesh)

      // 3. LEFT ATRIUM (Posterior-superior receiving auricle)
      const laGeo = new THREE.SphereGeometry(1.7, 24, 24)
      laGeo.scale(1.1, 1.0, 1.2)
      const laMesh = new THREE.Mesh(laGeo, atriumMat)
      laMesh.position.set(-1.4, 2.2, -0.4)
      heartGroup.add(laMesh)

      // 4. RIGHT ATRIUM (Anterior-superior receiving auricle)
      const raGeo = new THREE.SphereGeometry(1.8, 24, 24)
      raGeo.scale(1.1, 1.1, 1.0)
      const raMesh = new THREE.Mesh(raGeo, atriumMat)
      raMesh.position.set(1.5, 2.0, 0.3)
      heartGroup.add(raMesh)

      // 5. INTERVENTRICULAR CORONARY ARTERY NETWORK
      const coronaryCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1, 1.8, 1.4),
        new THREE.Vector3(0.3, 0.6, 1.6),
        new THREE.Vector3(0.0, -0.8, 1.4),
        new THREE.Vector3(-0.4, -2.1, 0.9),
      ])
      const coronaryGeo = new THREE.TubeGeometry(coronaryCurve, 20, 0.12, 12, false)
      const coronaryMesh = new THREE.Mesh(coronaryGeo, coronaryMat)
      heartGroup.add(coronaryMesh)

      // 6. ASCENDING AORTA & AORTIC ARCH (Sweeping Red Trunk with 3 Head/Neck Branches)
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
        roughness: 0.25,
        metalness: 0.25,
      })
      const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat)
      heartGroup.add(aortaMesh)

      // 3 Aortic Arch Branches: Brachiocephalic trunk, Left common carotid, Left subclavian
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

      // 7. PULMONARY TRUNK & BIFURCATION (Venous Blue Arch curving across anterior Aorta)
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

      // 8. SUPERIOR & INFERIOR VENA CAVA (Blue Great Vessels into RA)
      const svcGeo = new THREE.CylinderGeometry(0.55, 0.6, 3.0, 16)
      const svcMesh = new THREE.Mesh(svcGeo, venousMat)
      svcMesh.position.set(2.4, 3.4, 0.0)
      heartGroup.add(svcMesh)

      const ivcGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.2, 16)
      const ivcMesh = new THREE.Mesh(ivcGeo, venousMat)
      ivcMesh.position.set(2.2, -1.4, -0.3)
      heartGroup.add(ivcMesh)

      // 9. ATRIOVENTRICULAR VALVES (Mitral on Left, Tricuspid on Right)
      const valveGroup = new THREE.Group()
      heartGroup.add(valveGroup)
      valveGroup.visible = Boolean(params.showValves === 1)

      // Mitral Valve Cusps
      const mitralCuspGeo = new THREE.PlaneGeometry(1.2, 0.8)
      const mitralCusp1 = new THREE.Mesh(mitralCuspGeo, valveMat)
      mitralCusp1.position.set(-0.9, 0.8, 0.1)
      mitralCusp1.rotation.x = 0.5
      valveGroup.add(mitralCusp1)

      const mitralCusp2 = new THREE.Mesh(mitralCuspGeo, valveMat)
      mitralCusp2.position.set(-0.9, 0.8, -0.2)
      mitralCusp2.rotation.x = -0.5
      valveGroup.add(mitralCusp2)

      // Tricuspid Valve Cusps
      const triCuspGeo = new THREE.PlaneGeometry(1.1, 0.7)
      const triCusp1 = new THREE.Mesh(triCuspGeo, valveMat)
      triCusp1.position.set(1.0, 0.7, 0.4)
      triCusp1.rotation.x = 0.4
      valveGroup.add(triCusp1)

      const triCusp2 = new THREE.Mesh(triCuspGeo, valveMat)
      triCusp2.position.set(1.0, 0.7, 0.0)
      triCusp2.rotation.x = -0.4
      valveGroup.add(triCusp2)

      // 10. Flowing Oxygenated (Red) & Deoxygenated (Blue) Blood Corpuscles
      const particleCount = 260
      const bloodGeo = new THREE.BufferGeometry()
      const bloodPos = new Float32Array(particleCount * 3)
      const bloodColors = new Float32Array(particleCount * 3)

      for (let i = 0; i < particleCount; i++) {
        const isOxy = i % 2 === 0
        if (isOxy) {
          // Oxygenated in Left Ventricle & Aorta
          bloodPos[i * 3] = -0.8 + (Math.random() - 0.5) * 1.8
          bloodPos[i * 3 + 1] = -1.2 + Math.random() * 5.0
          bloodPos[i * 3 + 2] = 0.1 + (Math.random() - 0.5) * 1.4
          bloodColors[i * 3] = 0.98
          bloodColors[i * 3 + 1] = 0.15
          bloodColors[i * 3 + 2] = 0.2
        } else {
          // Deoxygenated in Right Ventricle, RA & Pulmonary Trunk
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

      let pulseTime = 0

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          const freq = (params.bpm / 60) * Math.PI * 2
          pulseTime += 0.024
          const cyclePhase = (pulseTime * freq) % (Math.PI * 2)

          // Wiggers Diagram Cardiac Cycle Approximation:
          // Phase 1 (0 to 0.25): Atrial Systole (Atria contract first)
          // Phase 2 (0.25 to 0.70): Ventricular Systole (Ventricles contract strongly, valves close)
          // Phase 3 (0.70 to 2*PI): Diastole / Relaxation (Valves open, chambers expand)
          const isAtrialBeat = cyclePhase < Math.PI * 0.4
          const isVentBeat = cyclePhase >= Math.PI * 0.4 && cyclePhase < Math.PI * 1.2

          const atriaContraction = isAtrialBeat ? 1.0 - Math.sin(cyclePhase * 2.5) * 0.12 : 1.0
          laMesh.scale.set(1.1 * atriaContraction, 1.0 * atriaContraction, 1.2 * atriaContraction)
          raMesh.scale.set(1.1 * atriaContraction, 1.1 * atriaContraction, 1.0 * atriaContraction)

          const ventScale = isVentBeat
            ? 1.0 - Math.sin((cyclePhase - Math.PI * 0.4) * 1.25) * 0.16
            : 1.0 + Math.sin(cyclePhase) * 0.05

          lvMesh.scale.set(0.9 * ventScale, 1.45 * (2 - ventScale), 0.95 * ventScale)
          rvMesh.scale.set(1.05 * ventScale, 1.3 * (2 - ventScale), 0.8 * ventScale)

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

          heartGroup.rotation.y += 0.006
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
          pulseTime = 0
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
      let params = { ...initialParams }
      let isPlaying = true
      let animId: number

      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      const scene = new THREE.Scene()
      // Modern clean scientific studio backdrop
      scene.background = new THREE.Color(0x0f172a)
      scene.fog = new THREE.FogExp2(0x0f172a, 0.02)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(14, 12, 22)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      setupRenderer(renderer)
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.target.set(0, 2.5, 0)

      // Soft laboratory studio lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
      scene.add(ambientLight)

      const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.2)
      keyLight.position.set(15, 25, 20)
      scene.add(keyLight)

      const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.7)
      fillLight.position.set(-15, 12, -10)
      scene.add(fillLight)

      const skinGroup = new THREE.Group()
      scene.add(skinGroup)

      // Define 6 distinct anatomical layers (5 epidermis + dermis base)
      const layerConfigs = [
        { id: 1, name: 'Stratum Corneum', thickness: 0.9, color: 0xd4a373, baseElevation: 5.6 },
        { id: 2, name: 'Stratum Lucidum', thickness: 0.45, color: 0xfefae0, baseElevation: 4.85 },
        { id: 3, name: 'Stratum Granulosum', thickness: 0.85, color: 0xddb892, baseElevation: 4.1 },
        { id: 4, name: 'Stratum Spinosum', thickness: 1.6, color: 0xe07a5f, baseElevation: 2.7 },
        { id: 5, name: 'Stratum Basale', thickness: 0.85, color: 0xb45309, baseElevation: 1.4 },
        { id: 6, name: 'Dermis', thickness: 2.4, color: 0xbe185d, baseElevation: -0.4 },
      ]

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

      layerConfigs.forEach((cfg) => {
        const layerGrp = new THREE.Group()
        layerGrp.position.y = cfg.baseElevation
        skinGroup.add(layerGrp)

        // Main tissue slab with rounded beveled edges
        const geo = new THREE.BoxGeometry(blockWidth, cfg.thickness, blockDepth)
        const mat = new THREE.MeshStandardMaterial({
          color: cfg.color,
          roughness: 0.4,
          metalness: 0.05,
          transparent: true,
          opacity: 0.94,
        })
        const slabMesh = new THREE.Mesh(geo, mat)
        layerGrp.add(slabMesh)

        // Microscopic Cellular Elements
        const cellMeshes: THREE.Object3D[] = []

        if (cfg.id === 1) {
          // Corneum: Flakes / flattened polygonal scales on top
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
          // Granulosum: Keratohyalin dark granule clusters
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
          // Spinosum: Polyhedral cells with desmosome prickly bridges
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
          // Basale: Cuboidal cells + Melanocytes (dark star cells)
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
          // Dermis: Capillary Loops (Arterial Red & Venous Blue arches)
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

      // Update positions based on explode separation slider and active layer highlight
      const applyLayerTransforms = () => {
        const sepFactor = (params.layerSeparation / 100) * 2.8
        const activeLyr = Math.round(params.activeLayer)
        const showCellDetails = params.showCells >= 0.5

        layerObjects.forEach((obj, idx) => {
          // Expand outward from center along Y axis
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

      let time = 0
      const animate = () => {
        animId = requestAnimationFrame(animate)
        if (isPlaying) {
          time += 0.01
          // Subtle gentle breathing/rotation of skin block
          skinGroup.rotation.y += 0.002
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
          controls.reset()
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
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

      // Lighting
      const ambLight = new THREE.AmbientLight(0xffffff, 0.9)
      scene.add(ambLight)

      // Pre-compute Lorenz Attractor Trajectory Ribbon
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
        positions[i * 3 + 1] = z // Swap Y and Z for visual vertical orientation
        positions[i * 3 + 2] = y

        // Spectral coloring gradient along trajectory
        const t = i / maxPts
        colors[i * 3] = Math.sin(t * Math.PI) * 0.9 + 0.1
        colors[i * 3 + 1] = Math.sin(t * Math.PI + 2) * 0.8 + 0.2
        colors[i * 3 + 2] = Math.cos(t * Math.PI) * 0.9 + 0.1
      }

      const lorenzGeo = new THREE.BufferGeometry()
      lorenzGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      lorenzGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      const lorenzMat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 })
      const lorenzLine = new THREE.Line(lorenzGeo, lorenzMat)
      scene.add(lorenzLine)

      // Traveling Glowing Head
      const headGeo = new THREE.SphereGeometry(0.8, 16, 16)
      const headMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      const headMesh = new THREE.Mesh(headGeo, headMat)
      scene.add(headMesh)

      let headIdx = 0

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          headIdx = (headIdx + 3) % maxPts
          headMesh.position.set(positions[headIdx * 3], positions[headIdx * 3 + 1], positions[headIdx * 3 + 2])
          lorenzLine.rotation.y += 0.006
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
          let lx = 0.1
          let ly = 0
          let lz = 0
          for (let i = 0; i < maxPts; i++) {
            const dx = params.sigma * (ly - lx)
            const dy = lx * (params.rho - lz) - ly
            const dz = lx * ly - params.beta * lz
            lx += dx * dt
            ly += dy * dt
            lz += dz * dt
            positions[i * 3] = lx
            positions[i * 3 + 1] = lz
            positions[i * 3 + 2] = ly
          }
          ;(lorenzGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          headIdx = 0
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
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

      const opticsGroup = new THREE.Group()
      scene.add(opticsGroup)

      // 1. Triangular Glass Prism Mesh
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

      function createPrismGeometry(apexDeg: number): THREE.BufferGeometry {
        const apexRad = (apexDeg * Math.PI) / 180
        const sideLen = 9.0
        const halfBase = sideLen * Math.sin(apexRad / 2)
        const height = sideLen * Math.cos(apexRad / 2)

        const shape = new THREE.Shape()
        shape.moveTo(0, height * 0.5)
        shape.lineTo(halfBase, -height * 0.5)
        shape.lineTo(-halfBase, -height * 0.5)
        shape.closePath()

        const extrudeSettings = {
          steps: 1,
          depth: 5.5,
          bevelEnabled: true,
          bevelThickness: 0.1,
          bevelSize: 0.1,
          bevelSegments: 4,
        }
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
        geo.center()
        return geo
      }

      prismMesh = new THREE.Mesh(createPrismGeometry(params.prismAngle), prismMat)
      opticsGroup.add(prismMesh)

      // 2. Collimated Laser Housing (Incident Source)
      const emitterGroup = new THREE.Group()
      opticsGroup.add(emitterGroup)

      const emitterBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.6, 3.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })
      )
      emitterBody.rotation.z = Math.PI / 2
      emitterGroup.add(emitterBody)

      const emitterLens = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      )
      emitterLens.position.x = 1.6
      emitterGroup.add(emitterLens)

      // 3. Frosted Glass Projection Screen (To capture the rainbow spectrum)
      const screenGeo = new THREE.PlaneGeometry(8, 6)
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })
      const screenMesh = new THREE.Mesh(screenGeo, screenMat)
      screenMesh.position.set(12, 0, -3)
      screenMesh.rotation.y = -Math.PI / 3.5
      opticsGroup.add(screenMesh)

      // Rainbow Spectral Wavelengths & Colors: VIBGYOR
      const spectrumColors = [
        { name: 'Red', hex: 0xef4444, dn: -0.012 },
        { name: 'Orange', hex: 0xf97316, dn: -0.007 },
        { name: 'Yellow', hex: 0xfacc15, dn: -0.002 },
        { name: 'Green', hex: 0x22c55e, dn: 0.004 },
        { name: 'Blue', hex: 0x06b6d4, dn: 0.011 },
        { name: 'Indigo', hex: 0x3b82f6, dn: 0.018 },
        { name: 'Violet', hex: 0x8b5cf6, dn: 0.026 },
      ]

      // Ray lines containers
      let incidentLine: THREE.Line | null = null
      let internalLines: THREE.Line[] = []
      let exitLines: THREE.Line[] = []
      let spectralDots: THREE.Mesh[] = []

      function updateOpticsPaths() {
        // Clear previous lines
        if (incidentLine) opticsGroup.remove(incidentLine)
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

        // Face 1 entry point and normal
        const entryPt = new THREE.Vector3(-2.8, -0.2, 0)
        const face1Normal = new THREE.Vector3(-Math.cos(halfA), Math.sin(halfA), 0).normalize()

        // Incident ray vector (striking face 1 at angle iRad relative to normal)
        const inDir = new THREE.Vector3(
          face1Normal.x * Math.cos(iRad) + face1Normal.y * Math.sin(iRad),
          face1Normal.y * Math.cos(iRad) - face1Normal.x * Math.sin(iRad),
          0
        ).normalize()

        const laserSource = entryPt.clone().sub(inDir.clone().multiplyScalar(10.0))
        emitterGroup.position.copy(laserSource)
        emitterGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), inDir)

        // Draw incident white beam
        const incGeo = new THREE.BufferGeometry().setFromPoints([laserSource, entryPt])
        const incMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 })
        incidentLine = new THREE.Line(incGeo, incMat)
        opticsGroup.add(incidentLine)

        // Face 2 normal (pointing right-up)
        const face2Normal = new THREE.Vector3(Math.cos(halfA), Math.sin(halfA), 0).normalize()

        spectrumColors.forEach((colorData, idx) => {
          const nColor = nBase + colorData.dn
          // Snell's Law face 1: sin(i) = n * sin(r1)
          const sinR1 = Math.sin(iRad) / nColor
          const r1 = Math.asin(Math.min(0.999, sinR1))

          // Direction inside prism
          const intDir = new THREE.Vector3(
            face1Normal.x * Math.cos(r1) + face1Normal.y * Math.sin(r1),
            face1Normal.y * Math.cos(r1) - face1Normal.x * Math.sin(r1),
            0
          ).normalize()

          // Trace to exit face 2
          const exitDist = 5.2 - idx * 0.15
          const exitPt = entryPt.clone().add(intDir.clone().multiplyScalar(exitDist))

          // Internal ray
          const intGeo = new THREE.BufferGeometry().setFromPoints([entryPt, exitPt])
          const intMat = new THREE.LineBasicMaterial({ color: colorData.hex, transparent: true, opacity: 0.85 })
          const intLine = new THREE.Line(intGeo, intMat)
          opticsGroup.add(intLine)
          internalLines.push(intLine)

          // Refraction at face 2: r2 = A - r1, sin(e) = n * sin(r2)
          const r2 = aRad - r1
          const sinE = nColor * Math.sin(r2)
          const e = sinE <= 1.0 ? Math.asin(sinE) : Math.PI / 2

          // Exit ray direction
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

          // Glowing spectral spot on projection screen
          const dotMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 16, 16),
            new THREE.MeshBasicMaterial({ color: colorData.hex })
          )
          dotMesh.position.copy(screenHitPt)
          opticsGroup.add(dotMesh)
          spectralDots.push(dotMesh)
        })
      }

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
          // Defaults handled by canvas
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
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
    initScene: (container, initialParams) => {
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

      const motorGroup = new THREE.Group()
      scene.add(motorGroup)

      // 1. Permanent Stator Magnets (North Red on Left, South Blue on Right)
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
      motorGroup.add(northPole)

      const southPole = new THREE.Mesh(magnetGeo, southMat)
      southPole.position.set(8.5, 0, 0)
      motorGroup.add(southPole)

      // 2. Magnetic Flux Lines (Cyan arrows pointing N -> S)
      const fieldLinesGroup = new THREE.Group()
      motorGroup.add(fieldLinesGroup)
      for (let y = -1.8; y <= 1.8; y += 1.2) {
        for (let z = -3.0; z <= 3.0; z += 1.5) {
          const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-6.5, y, z),
            13.0,
            0x06b6d4,
            0.8,
            0.4
          )
          fieldLinesGroup.add(arrow)
        }
      }

      // 3. Central Steel Axle
      const axleGeo = new THREE.CylinderGeometry(0.35, 0.35, 18.0, 20)
      const axleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.15 })
      const axle = new THREE.Mesh(axleGeo, axleMat)
      axle.rotation.x = Math.PI / 2

      // 4. Rotating Armature Rotor Group
      const rotorGroup = new THREE.Group()
      rotorGroup.add(axle)
      motorGroup.add(rotorGroup)

      // Copper Rectangular Coil
      const copperMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.85,
        roughness: 0.2,
      })

      const coilWidth = 7.5
      const coilLength = 10.0
      const wireRadius = 0.22

      // Left wire arm (along Z)
      const leftWireGeo = new THREE.CylinderGeometry(wireRadius, wireRadius, coilLength, 12)
      const leftWire = new THREE.Mesh(leftWireGeo, copperMat)
      leftWire.rotation.x = Math.PI / 2
      leftWire.position.x = -coilWidth / 2
      rotorGroup.add(leftWire)

      // Right wire arm (along Z)
      const rightWire = new THREE.Mesh(leftWireGeo, copperMat)
      rightWire.rotation.x = Math.PI / 2
      rightWire.position.x = coilWidth / 2
      rotorGroup.add(rightWire)

      // Front cross wire
      const frontWireGeo = new THREE.CylinderGeometry(wireRadius, wireRadius, coilWidth, 12)
      const frontWire = new THREE.Mesh(frontWireGeo, copperMat)
      frontWire.rotation.z = Math.PI / 2
      frontWire.position.z = coilLength / 2
      rotorGroup.add(frontWire)

      // Back cross wire
      const backWire = new THREE.Mesh(frontWireGeo, copperMat)
      backWire.rotation.z = Math.PI / 2
      backWire.position.z = -coilLength / 2
      rotorGroup.add(backWire)

      // 5. Split-Ring Commutator (Two split brass half-cylinders)
      const commMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.9,
        roughness: 0.25,
      })
      const comm1Geo = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 16, 1, false, 0.15, Math.PI - 0.3)
      const commRing1 = new THREE.Mesh(comm1Geo, commMat)
      commRing1.rotation.x = Math.PI / 2
      commRing1.position.z = coilLength / 2 + 1.8
      rotorGroup.add(commRing1)

      const comm2Geo = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 16, 1, false, Math.PI + 0.15, Math.PI - 0.3)
      const commRing2 = new THREE.Mesh(comm2Geo, commMat)
      commRing2.rotation.x = Math.PI / 2
      commRing2.position.z = coilLength / 2 + 1.8
      rotorGroup.add(commRing2)

      // 6. Stationary Carbon Brushes & Terminals
      const brushMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
      const brushGeo = new THREE.BoxGeometry(0.5, 0.7, 1.4)

      const brushPositive = new THREE.Mesh(brushGeo, brushMat)
      brushPositive.position.set(-1.15, 0, coilLength / 2 + 1.8)
      motorGroup.add(brushPositive)

      const brushNegative = new THREE.Mesh(brushGeo, brushMat)
      brushNegative.position.set(1.15, 0, coilLength / 2 + 1.8)
      motorGroup.add(brushNegative)

      // Red (+) and Blue (-) Supply Terminals
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

      // 7. Dynamic Fleming's Left Hand Force Arrows (Attached to Rotor)
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

      // Current Arrows (Green)
      const currentArrowLeft = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(-coilWidth / 2, 0, -coilLength / 3),
        2.5,
        0x10b981,
        0.7,
        0.35
      )
      rotorGroup.add(currentArrowLeft)

      const currentArrowRight = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(coilWidth / 2, 0, coilLength / 3),
        2.5,
        0x10b981,
        0.7,
        0.35
      )
      rotorGroup.add(currentArrowRight)

      let angle = 0

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying && params.voltage > 0) {
          const speed = (params.voltage / 12) * params.fieldStrength * 0.05
          angle += speed
          rotorGroup.rotation.z = angle

          // Lorentz force magnitude depends on sin(theta + pi/2)
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
        },
        dispose: () => {
          cancelAnimationFrame(animId)
          window.removeEventListener('resize', handleResize)
          renderer.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        },
      }
    },
  },
}

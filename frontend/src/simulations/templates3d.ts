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

// Helper: Create a styled 3D laboratory environment (grid, lighting, soft shadows)
function createLabEnvironment(scene: THREE.Scene, gridSize = 40, divisions = 40) {
  scene.background = new THREE.Color(0x0a0f1d)
  scene.fog = new THREE.FogExp2(0x0a0f1d, 0.015)

  // Subtle 3D laboratory optical breadboard grid
  const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x38bdf8, 0x1e293b)
  gridHelper.position.y = -0.01
  scene.add(gridHelper)

  // Ambient fill light for scientific clarity
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75)
  scene.add(ambientLight)

  // Primary laboratory directional spotlight with shadows
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
  dirLight.position.set(15, 25, 15)
  dirLight.castShadow = true
  scene.add(dirLight)

  // Accent rim light (cyan/blue)
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6)
  rimLight.position.set(-15, 10, -15)
  scene.add(rimLight)
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

      // The Sun (Glowing Central Sphere)
      const sunGeo = new THREE.SphereGeometry(3.5, 32, 32)
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      const sunMesh = new THREE.Mesh(sunGeo, sunMat)
      scene.add(sunMesh)

      // Sun Light & Point Light
      const sunLight = new THREE.PointLight(0xfffbeb, 2.5, 300, 0.2)
      scene.add(sunLight)
      const ambLight = new THREE.AmbientLight(0x334155, 0.5)
      scene.add(ambLight)

      // Planets Definitions: [Name, DistanceAU, Radius, Color, PeriodRatio, HasRings]
      const planetData = [
        { name: 'Mercury', dist: 7, size: 0.55, color: 0x94a3b8, speed: 4.15 },
        { name: 'Venus', dist: 11, size: 0.95, color: 0xf59e0b, speed: 1.62 },
        { name: 'Earth', dist: 16, size: 1.1, color: 0x38bdf8, speed: 1.0, hasMoon: true },
        { name: 'Mars', dist: 22, size: 0.7, color: 0xef4444, speed: 0.53 },
        { name: 'Jupiter', dist: 30, size: 2.4, color: 0xd97706, speed: 0.084 },
        { name: 'Saturn', dist: 38, size: 1.9, color: 0xfde047, speed: 0.034, hasRings: true },
      ]

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

        if (p.hasRings) {
          const ringGeo = new THREE.RingGeometry(p.size * 1.4, p.size * 2.3, 32)
          const ringMat = new THREE.MeshBasicMaterial({ color: 0xca8a04, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
          const ring = new THREE.Mesh(ringGeo, ringMat)
          ring.rotation.x = Math.PI / 2.3
          mesh.add(ring)
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
          sunMesh.rotation.y += 0.004
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
      scene.background = new THREE.Color(0x060914)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 18, 30)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      // Lighting
      const ambLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambLight)
      const pLight = new THREE.PointLight(0x38bdf8, 2, 50)
      scene.add(pLight)

      // Nucleus Cluster (Protons & Neutrons)
      const nucleusGroup = new THREE.Group()
      scene.add(nucleusGroup)
      const nucleonGeo = new THREE.SphereGeometry(0.5, 16, 16)
      const protonMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, emissive: 0x991b1b, emissiveIntensity: 0.4 })
      const neutronMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 })

      for (let i = 0; i < 12; i++) {
        const mat = i % 2 === 0 ? protonMat : neutronMat
        const nMesh = new THREE.Mesh(nucleonGeo, mat)
        nMesh.position.set(
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 1.4
        )
        nucleusGroup.add(nMesh)
      }

      // Shell Rings (n=1 to 5)
      const shellRadii = [3.5, 6.5, 9.8, 13.2, 16.8]
      const shellLines: THREE.Line[] = []
      shellRadii.forEach((r, idx) => {
        const curve = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0)
        const pts = curve.getPoints(64)
        const geo = new THREE.BufferGeometry().setFromPoints(pts.map((pt) => new THREE.Vector3(pt.x, 0, pt.y)))
        const mat = new THREE.LineBasicMaterial({
          color: idx === params.nFinal - 1 ? 0x10b981 : idx === params.nInitial - 1 ? 0xef4444 : 0x334155,
          transparent: true,
          opacity: 0.6,
        })
        const line = new THREE.Line(geo, mat)
        scene.add(line)
        shellLines.push(line)
      })

      // Active Jumping Electron
      const elecGeo = new THREE.SphereGeometry(0.42, 24, 24)
      const elecMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      })
      const electron = new THREE.Mesh(elecGeo, elecMat)
      scene.add(electron)

      // 3D Orbital Lobes (p-orbital dumbbell mesh)
      const orbitalGroup = new THREE.Group()
      scene.add(orbitalGroup)
      orbitalGroup.visible = Boolean(params.orbitalMode === 1)

      const lobeGeo = new THREE.SphereGeometry(3.5, 32, 32)
      lobeGeo.scale(0.8, 1.8, 0.8)
      const lobeMat1 = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        transmission: 0.6,
      })
      const topLobe = new THREE.Mesh(lobeGeo, lobeMat1)
      topLobe.position.y = 3.2
      orbitalGroup.add(topLobe)

      const lobeMat2 = new THREE.MeshPhysicalMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        transmission: 0.6,
      })
      const botLobe = new THREE.Mesh(lobeGeo, lobeMat2)
      botLobe.position.y = -3.2
      orbitalGroup.add(botLobe)

      let theta = 0
      let currentR = shellRadii[Math.max(0, Math.min(params.nInitial - 1, 4))]

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          theta += 0.035
          nucleusGroup.rotation.y += 0.01
          orbitalGroup.rotation.y += 0.015

          // Smooth quantum transition between shells
          const targetR = shellRadii[Math.max(0, Math.min(params.nFinal - 1, 4))]
          currentR += (targetR - currentR) * 0.04

          electron.position.set(currentR * Math.cos(theta), 0, currentR * Math.sin(theta))
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
          shellLines.forEach((line, idx) => {
            const mat = line.material as THREE.LineBasicMaterial
            mat.color.setHex(idx === params.nFinal - 1 ? 0x10b981 : idx === params.nInitial - 1 ? 0xef4444 : 0x334155)
          })
        },
        setPlaying: (playing) => {
          isPlaying = playing
        },
        reset: () => {
          currentR = shellRadii[Math.max(0, Math.min(params.nInitial - 1, 4))]
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
        0xfbbf24, // Cytosine (Yellow)
      ]

      const backboneMat1 = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25, metalness: 0.5 })
      const backboneMat2 = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.25, metalness: 0.5 })

      const numSteps = 36
      const stepY = 0.75
      const totalH = numSteps * stepY

      const pairMeshes: THREE.Group[] = []

      for (let i = 0; i < numSteps; i++) {
        const pairGroup = new THREE.Group()
        const angle = i * 0.35
        const y = i * stepY - totalH / 2
        const r = params.baseRadius

        // Strand 1 Backbone sphere
        const bb1 = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), backboneMat1)
        bb1.position.set(r * Math.cos(angle), y, r * Math.sin(angle))
        pairGroup.add(bb1)

        // Strand 2 Backbone sphere (antiparallel 180 degrees)
        const bb2 = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), backboneMat2)
        bb2.position.set(r * Math.cos(angle + Math.PI), y, r * Math.sin(angle + Math.PI))
        pairGroup.add(bb2)

        // Base 1 & Base 2 rungs
        const bType = i % 2 === 0 ? 0 : 2
        const col1 = baseColors[bType]
        const col2 = baseColors[bType + 1]

        const r1Geo = new THREE.CylinderGeometry(0.18, 0.18, r, 12)
        r1Geo.translate(0, r / 2, 0)
        const r1Mat = new THREE.MeshStandardMaterial({ color: col1, roughness: 0.3 })
        const r1Mesh = new THREE.Mesh(r1Geo, r1Mat)
        r1Mesh.position.set(0, y, 0)
        r1Mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)))
        pairGroup.add(r1Mesh)

        const r2Geo = new THREE.CylinderGeometry(0.18, 0.18, r, 12)
        r2Geo.translate(0, r / 2, 0)
        const r2Mat = new THREE.MeshStandardMaterial({ color: col2, roughness: 0.3 })
        const r2Mesh = new THREE.Mesh(r2Geo, r2Mat)
        r2Mesh.position.set(0, y, 0)
        r2Mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)))
        pairGroup.add(r2Mesh)

        helixGroup.add(pairGroup)
        pairMeshes.push(pairGroup)
      }

      function animate() {
        animId = requestAnimationFrame(animate)
        if (isPlaying) {
          helixGroup.rotation.y += 0.015 * params.twistSpeed
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
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      const heartGroup = new THREE.Group()
      scene.add(heartGroup)

      // Anatomical heart base geometry (Right & Left Ventricles)
      const muscleMat = new THREE.MeshStandardMaterial({
        color: 0xbe123c,
        roughness: 0.35,
        metalness: 0.1,
      })

      const ventGeo = new THREE.SphereGeometry(3.5, 32, 32)
      ventGeo.scale(1.0, 1.4, 0.9)
      const ventMesh = new THREE.Mesh(ventGeo, muscleMat)
      heartGroup.add(ventMesh)

      // Aorta (Red Artery Arch)
      const aortaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.5, 3.5, 0),
        new THREE.Vector3(0.8, 5.5, 0),
        new THREE.Vector3(-1.2, 5.8, -0.5),
        new THREE.Vector3(-2.2, 4.0, -1.0),
      ])
      const aortaGeo = new THREE.TubeGeometry(aortaCurve, 20, 0.65, 16, false)
      const aortaMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.2 })
      const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat)
      heartGroup.add(aortaMesh)

      // Vena Cava / Pulmonary Artery (Blue Vein Arch)
      const venaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.5, 3.5, 0.5),
        new THREE.Vector3(-1.2, 5.2, 0.8),
        new THREE.Vector3(1.0, 5.0, 0.5),
      ])
      const venaGeo = new THREE.TubeGeometry(venaCurve, 20, 0.6, 16, false)
      const venaMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.2 })
      const venaMesh = new THREE.Mesh(venaGeo, venaMat)
      heartGroup.add(venaMesh)

      // Flowing Blood Particles (Red & Blue streams)
      const particleCount = 200
      const bloodGeo = new THREE.BufferGeometry()
      const bloodPos = new Float32Array(particleCount * 3)
      const bloodColors = new Float32Array(particleCount * 3)

      for (let i = 0; i < particleCount; i++) {
        bloodPos[i * 3] = (Math.random() - 0.5) * 4
        bloodPos[i * 3 + 1] = (Math.random() - 0.5) * 6
        bloodPos[i * 3 + 2] = (Math.random() - 0.5) * 3

        const isOxy = i % 2 === 0
        bloodColors[i * 3] = isOxy ? 0.95 : 0.15
        bloodColors[i * 3 + 1] = isOxy ? 0.1 : 0.4
        bloodColors[i * 3 + 2] = isOxy ? 0.15 : 0.95
      }

      bloodGeo.setAttribute('position', new THREE.BufferAttribute(bloodPos, 3))
      bloodGeo.setAttribute('color', new THREE.BufferAttribute(bloodColors, 3))
      const bloodMat = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.85 })
      const bloodParticles = new THREE.Points(bloodGeo, bloodMat)
      heartGroup.add(bloodParticles)

      let pulseTime = 0

      function animate() {
        animId = requestAnimationFrame(animate)

        if (isPlaying) {
          const freq = (params.bpm / 60) * Math.PI * 2
          pulseTime += 0.025
          const beat = Math.sin(pulseTime * freq)
          // Systolic contraction & diastolic expansion
          const scale = 1.0 + Math.pow(Math.max(0, beat), 3) * 0.14
          ventMesh.scale.set(scale, scale * 1.4, scale * 0.9)

          // Blood circulation particles movement
          const pos = bloodGeo.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < particleCount; i++) {
            let y = pos.getY(i) + 0.08
            if (y > 4.5) y = -3.5
            pos.setY(i, y)
          }
          pos.needsUpdate = true

          heartGroup.rotation.y += 0.005
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
}

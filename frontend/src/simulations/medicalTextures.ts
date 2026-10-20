import * as THREE from 'three'

/**
 * Procedural Medical & Exhibition Textures Generator
 * Creates photorealistic medical PBR maps and exhibition pins/tubes:
 * - Striated muscle normal map (living cardiac tissue)
 * - Wet specular / roughness map (organic glistening fluid sheen)
 * - High-detail iris stroma (radial fibers, Fuchs' crypts, pupillary ruff, collarette)
 * - Pearlescent sclera with branching episcleral capillaries
 * - Fundus retina with branching retinal arcades, optic disc & macula
 * - Exhibition-style 3D anatomical marker pins & transparent working circulation tubes
 */

// 1. STRIATED CARDIAC MUSCLE NORMAL MAP (512x512)
export function createStriatedMuscleNormalMap(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  // Generate directional striated fibers with micro-wrinkles
  const heightMap = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      // Longitudinally aligned muscle fibers with natural periodic wave
      const fiberWave = Math.sin(v * Math.PI * 48 + Math.cos(u * Math.PI * 12) * 2.5) * 0.5 + 0.5
      const microStriation = Math.sin(v * Math.PI * 128) * 0.25
      const crossSepta = Math.sin(u * Math.PI * 32) * 0.15
      heightMap[y * size + x] = fiberWave * 0.6 + microStriation * 0.25 + crossSepta * 0.15
    }
  }

  // Sobel filter to generate tangent space normal vector (R, G, B) = (Nx, Ny, Nz)
  const strength = 2.4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const x0 = x > 0 ? x - 1 : size - 1
      const x1 = x < size - 1 ? x + 1 : 0
      const y0 = y > 0 ? y - 1 : size - 1
      const y1 = y < size - 1 ? y + 1 : 0

      const dX = (heightMap[y * size + x1] - heightMap[y * size + x0]) * strength
      const dY = (heightMap[y1 * size + x] - heightMap[y0 * size + x]) * strength

      // Normal vector
      let nx = -dX
      let ny = -dY
      let nz = 1.0
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len

      data[idx] = Math.floor((nx * 0.5 + 0.5) * 255)
      data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255)
      data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255)
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  return tex
}

// 2. WET GLISTENING TISSUE ROUGHNESS & SPECULAR MAP (512x512)
export function createWetSpecularMap(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      // Mottled glistening patches: values from 35 (glossy wet spot) to 110 (moist tissue)
      const n1 = Math.sin(x * 0.08) * Math.cos(y * 0.08) * 0.5 + 0.5
      const n2 = Math.sin(x * 0.22 + y * 0.18) * 0.5 + 0.5
      const wetVal = Math.floor(40 + n1 * 45 + n2 * 30)

      data[idx] = wetVal
      data[idx + 1] = wetVal
      data[idx + 2] = wetVal
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  return tex
}

// 3. PHOTOREALISTIC HUMAN IRIS TEXTURE (1024x1024)
export function createPhotorealisticIrisTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.48

  // Base background
  ctx.fillStyle = '#061325'
  ctx.fillRect(0, 0, size, size)

  // Radial stroma fibers
  const numFibers = 720
  for (let i = 0; i < numFibers; i++) {
    const angle = (i / numFibers) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const rInner = radius * 0.24 + Math.sin(i * 0.4) * 4
    const rOuter = radius * 0.98

    // Color gradient along radial fiber: amber collarette -> vibrant sapphire blue -> darker limbal
    const grad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter)
    const hueVariation = Math.sin(i * 0.15) * 15
    grad.addColorStop(0.0, '#100b05') // Pupillary ruff
    grad.addColorStop(0.12, '#854d0e') // Peripupillary amber zone
    grad.addColorStop(0.32, `hsl(${200 + hueVariation}, 85%, 45%)`) // Collarette
    grad.addColorStop(0.65, `hsl(${210 + hueVariation}, 75%, 38%)`) // Ciliary zone
    grad.addColorStop(0.92, '#0f2744') // Outer iris
    grad.addColorStop(1.0, '#030712') // Limbal ring

    ctx.strokeStyle = grad
    ctx.lineWidth = 1.2 + Math.sin(i * 0.7) * 0.8
    ctx.beginPath()
    ctx.moveTo(cx + cos * rInner, cy + sin * rInner)
    // Subtle wavy organic undulation
    const cpR = (rInner + rOuter) * 0.55
    const cpAngle = angle + (Math.sin(i * 0.3) * 0.015)
    ctx.quadraticCurveTo(cx + Math.cos(cpAngle) * cpR, cy + Math.sin(cpAngle) * cpR, cx + cos * rOuter, cy + sin * rOuter)
    ctx.stroke()
  }

  // Fuchs' crypts & concentric contraction furrows
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.28)'
  for (let r = radius * 0.45; r < radius * 0.85; r += radius * 0.09) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Dark limbal border ring
  ctx.lineWidth = 14
  ctx.strokeStyle = '#020617'
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2)
  ctx.stroke()

  // Central Velvet Pupil with feathered border
  const pupilR = radius * 0.25
  const pGrad = ctx.createRadialGradient(cx, cy, pupilR * 0.7, cx, cy, pupilR)
  pGrad.addColorStop(0, '#000000')
  pGrad.addColorStop(0.85, '#050505')
  pGrad.addColorStop(1.0, '#1c1917') // Brown pupillary ruff fringe
  ctx.fillStyle = pGrad
  ctx.beginPath()
  ctx.arc(cx, cy, pupilR, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

// 4. PEARLESCENT SCLERA WITH BRANCHING EPISCLERAL CAPILLARIES (1024x1024)
export function createScleraCapillaryTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Soft pearlescent ivory base with slight warm pink hue
  const baseGrad = ctx.createRadialGradient(size / 2, size / 2, 50, size / 2, size / 2, size * 0.7)
  baseGrad.addColorStop(0, '#ffffff')
  baseGrad.addColorStop(0.5, '#f8fafc')
  baseGrad.addColorStop(0.85, '#f1f5f9')
  baseGrad.addColorStop(1.0, '#e2e8f0')
  ctx.fillStyle = baseGrad
  ctx.fillRect(0, 0, size, size)

  // Branching episcleral blood vessels (fine crimson capillaries)
  function drawCapillaryBranch(startX: number, startY: number, angle: number, length: number, width: number, depth: number) {
    if (depth <= 0 || length < 4) return
    const endX = startX + Math.cos(angle) * length
    const endY = startY + Math.sin(angle) * length

    ctx.strokeStyle = depth > 2 ? 'rgba(185, 28, 28, 0.75)' : 'rgba(220, 38, 38, 0.55)'
    ctx.lineWidth = width
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    const midX = (startX + endX) * 0.5 + (Math.random() - 0.5) * length * 0.35
    const midY = (startY + endY) * 0.5 + (Math.random() - 0.5) * length * 0.35
    ctx.quadraticCurveTo(midX, midY, endX, endY)
    ctx.stroke()

    // Bifurcation into 2 smaller arterioles
    const branchAngle1 = angle + 0.32 + (Math.random() - 0.5) * 0.2
    const branchAngle2 = angle - 0.35 + (Math.random() - 0.5) * 0.2
    drawCapillaryBranch(endX, endY, branchAngle1, length * 0.68, width * 0.72, depth - 1)
    drawCapillaryBranch(endX, endY, branchAngle2, length * 0.62, width * 0.68, depth - 1)
  }

  // Emit capillaries from 12 perimeter anchor points around equator
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const dist = 360 + Math.random() * 80
    const sx = size / 2 + Math.cos(a) * dist
    const sy = size / 2 + Math.sin(a) * dist
    const targetAngle = a + Math.PI + (Math.random() - 0.5) * 0.4
    drawCapillaryBranch(sx, sy, targetAngle, 55 + Math.random() * 35, 2.2, 4)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

// 5. RETINAL FUNDUS WITH OPTIC DISC, MACULA & BRANCHING RETINAL ARCADES (1024x1024)
export function createRetinaFundusTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Deep warm orange-red fundus background with fine vascular mottling
  const fGrad = ctx.createRadialGradient(size / 2, size / 2, 80, size / 2, size / 2, size * 0.65)
  fGrad.addColorStop(0, '#c2410c')
  fGrad.addColorStop(0.5, '#9a3412')
  fGrad.addColorStop(0.85, '#7c2d12')
  fGrad.addColorStop(1.0, '#431407')
  ctx.fillStyle = fGrad
  ctx.fillRect(0, 0, size, size)

  // Subtle choroidal pigment mottling
  ctx.fillStyle = 'rgba(67, 20, 7, 0.08)'
  for (let k = 0; k < 600; k++) {
    const rx = Math.random() * size
    const ry = Math.random() * size
    ctx.beginPath()
    ctx.arc(rx, ry, 2 + Math.random() * 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Optic Disc (Nasal side: x=340, y=512)
  const odX = 360
  const odY = 512
  const odR = 48
  const odGrad = ctx.createRadialGradient(odX, odY, 8, odX, odY, odR)
  odGrad.addColorStop(0, '#fef08a') // Pale physiologic cup
  odGrad.addColorStop(0.6, '#fed7aa')
  odGrad.addColorStop(0.9, '#f97316')
  odGrad.addColorStop(1.0, 'rgba(154, 52, 18, 0)') // Soft transition
  ctx.fillStyle = odGrad
  ctx.beginPath()
  ctx.arc(odX, odY, odR, 0, Math.PI * 2)
  ctx.fill()

  // Macula Lutea & Fovea Centralis (Temporal side: x=660, y=512)
  const macX = 660
  const macY = 512
  const macR = 56
  const macGrad = ctx.createRadialGradient(macX, macY, 6, macX, macY, macR)
  macGrad.addColorStop(0, '#451a03') // Foveal avascular pit
  macGrad.addColorStop(0.2, '#78350f')
  macGrad.addColorStop(0.65, '#b45309') // Yellowish lutein pigment
  macGrad.addColorStop(1.0, 'rgba(154, 52, 18, 0)')
  ctx.fillStyle = macGrad
  ctx.beginPath()
  ctx.arc(macX, macY, macR, 0, Math.PI * 2)
  ctx.fill()

  // Branching Retinal Vessels radiating outward from Optic Disc (Superior & Inferior Arcades)
  function drawRetinalArcade(startAngle: number, isArtery: boolean) {
    let currX = odX
    let currY = odY
    let angle = startAngle
    const steps = 18
    const stepLen = 28
    let width = isArtery ? 4.0 : 5.0
    const color = isArtery ? '#ef4444' : '#7f1d1d'

    ctx.strokeStyle = color
    ctx.lineCap = 'round'

    for (let s = 0; s < steps; s++) {
      ctx.lineWidth = Math.max(0.8, width)
      ctx.beginPath()
      ctx.moveTo(currX, currY)

      // Curve around macula
      const nextX = currX + Math.cos(angle) * stepLen
      const nextY = currY + Math.sin(angle) * stepLen
      ctx.lineTo(nextX, nextY)
      ctx.stroke()

      // Small secondary arterioles branching toward periphery
      if (s > 3 && s % 3 === 0) {
        const bAngle = angle + (isArtery ? 0.6 : -0.6)
        ctx.lineWidth = Math.max(0.6, width * 0.5)
        ctx.beginPath()
        ctx.moveTo(nextX, nextY)
        ctx.lineTo(nextX + Math.cos(bAngle) * 45, nextY + Math.sin(bAngle) * 45)
        ctx.stroke()
      }

      currX = nextX
      currY = nextY
      width *= 0.88
      angle += (startAngle > 0 ? 0.05 : -0.05) + (Math.random() - 0.5) * 0.08
    }
  }

  // 4 Major vascular quadrants
  drawRetinalArcade(-Math.PI * 0.25, true)  // Superior Temporal Artery
  drawRetinalArcade(-Math.PI * 0.30, false) // Superior Temporal Vein
  drawRetinalArcade(Math.PI * 0.25, true)   // Inferior Temporal Artery
  drawRetinalArcade(Math.PI * 0.30, false)  // Inferior Temporal Vein
  drawRetinalArcade(-Math.PI * 0.75, true)  // Superior Nasal Artery
  drawRetinalArcade(Math.PI * 0.75, true)   // Inferior Nasal Artery

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

// 6. 3D EXHIBITION ANATOMICAL PIN & BADGE (Like YouTube & Amazon Working Models)
export interface AnatomicalPinOptions {
  tag: string
  fullName: string
  subtext?: string
  isOxygenatedOrSensory: boolean // true = red/gold, false = blue/cyan
  postHeight?: number
  pinColor?: number
}

export function createAnatomicalPin(options: AnatomicalPinOptions): {
  group: THREE.Group
  badgeSprite: THREE.Sprite
  pinMesh: THREE.Mesh
} {
  const {
    tag,
    fullName,
    subtext,
    isOxygenatedOrSensory,
    postHeight = 0.85,
    pinColor = isOxygenatedOrSensory ? 0xef4444 : 0x0284c7
  } = options

  const group = new THREE.Group()
  group.name = `Pin_${tag}`

  // A. Slender stainless steel metallic pin needle/post
  const pinGeo = new THREE.CylinderGeometry(0.016, 0.016, postHeight, 8)
  pinGeo.translate(0, postHeight * 0.5, 0)
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.15
  })
  const pinMesh = new THREE.Mesh(pinGeo, pinMat)
  group.add(pinMesh)

  // B. Glowing Metallic Sphere Joint
  const jointGeo = new THREE.SphereGeometry(0.065, 12, 12)
  const jointMat = new THREE.MeshStandardMaterial({
    color: pinColor,
    emissive: pinColor,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.8
  })
  const jointMesh = new THREE.Mesh(jointGeo, jointMat)
  jointMesh.position.y = postHeight
  group.add(jointMesh)

  // C. High-Res Canvas Badge Sprite
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 130
  const ctx = canvas.getContext('2d')!

  // Background with rounded card look
  ctx.fillStyle = 'rgba(7, 13, 24, 0.92)'
  ctx.strokeStyle = isOxygenatedOrSensory ? '#ef4444' : '#38bdf8'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(6, 6, 372, 118, 16)
  ctx.fill()
  ctx.stroke()

  // Tag Pill Header (e.g. AO, LV, PA, RV, CORNEA, RETINA)
  ctx.fillStyle = isOxygenatedOrSensory ? '#ef4444' : '#0284c7'
  ctx.beginPath()
  ctx.roundRect(14, 14, 110, 36, 8)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(tag, 69, 40)

  // Full Anatomical Name
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 24px system-ui, sans-serif'
  ctx.fillText(fullName, 136, 40)

  // Pedagogical Subtitle
  if (subtext) {
    ctx.fillStyle = isOxygenatedOrSensory ? '#fca5a5' : '#7dd3fc'
    ctx.font = '17px monospace'
    ctx.fillText(subtext, 18, 86)
  }

  // Bottom Interactive Hint
  ctx.fillStyle = '#94a3b8'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('Tap to dissect & inspect →', 18, 112)

  const badgeTex = new THREE.CanvasTexture(canvas)
  const badgeMat = new THREE.SpriteMaterial({
    map: badgeTex,
    transparent: true,
    depthTest: false
  })
  const badgeSprite = new THREE.Sprite(badgeMat)
  badgeSprite.scale.set(1.4, 0.48, 1)
  badgeSprite.position.set(0, postHeight + 0.32, 0)
  group.add(badgeSprite)

  return { group, badgeSprite, pinMesh }
}

// 7. WORKING CIRCULATION FLUID TUBES (Transparent Silicone with Pulsing Fluid Particles)
export function createWorkingFlowTube(
  points: THREE.Vector3[],
  tubeRadius: number,
  isOxygenated: boolean
): {
  tubeMesh: THREE.Mesh
  particles: THREE.Mesh[]
  updateParticles: (speed: number) => void
} {
  const curve = new THREE.CatmullRomCurve3(points)
  const tubeGeo = new THREE.TubeGeometry(curve, 48, tubeRadius, 14, false)

  // Glass / Silicone Physical Material
  const tubeMat = new THREE.MeshPhysicalMaterial({
    color: isOxygenated ? 0xffe4e6 : 0xe0f2fe,
    transmission: 0.90,
    opacity: 1.0,
    transparent: true,
    roughness: 0.08,
    ior: 1.46,
    thickness: 0.35,
    specularIntensity: 1.0
  })
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat)

  // Luminous Corpuscle Fluid Particles inside the tube
  const pCount = 28
  const particles: THREE.Mesh[] = []
  const pGeo = new THREE.SphereGeometry(tubeRadius * 0.55, 10, 10)
  const pMat = new THREE.MeshStandardMaterial({
    color: isOxygenated ? 0xff2222 : 0x0284c7,
    emissive: isOxygenated ? 0xef4444 : 0x38bdf8,
    emissiveIntensity: 1.2,
    roughness: 0.2
  })

  for (let i = 0; i < pCount; i++) {
    const pMesh = new THREE.Mesh(pGeo, pMat)
    pMesh.userData = { progress: i / pCount }
    const pos = curve.getPointAt(pMesh.userData.progress)
    pMesh.position.copy(pos)
    particles.push(pMesh)
  }

  const updateParticles = (speed: number) => {
    for (let i = 0; i < pCount; i++) {
      const pm = particles[i]
      pm.userData.progress = (pm.userData.progress + speed) % 1.0
      const pos = curve.getPointAt(pm.userData.progress)
      pm.position.copy(pos)
    }
  }

  return { tubeMesh, particles, updateParticles }
}

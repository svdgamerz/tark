import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Props {
  isOpen: boolean
  onClose: () => void
}

type SandboxMode = '3d_surfaces' | '2d_calculus' | 'vector_fields'

interface PointCharge {
  id: string
  x: number
  y: number
  q: number // in micro-Coulombs (+1 or -1)
}

interface TestParticle {
  x: number
  y: number
  vx: number
  vy: number
  trail: { x: number; y: number }[]
  color: string
}

export function MathSandboxModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<SandboxMode>('3d_surfaces')

  // -------------------------------------------------------------
  // TAB 1: 3D SURFACES STATE
  // -------------------------------------------------------------
  const threeMountRef = useRef<HTMLDivElement | null>(null)
  const [surfacePreset, setSurfacePreset] = useState<string>('ripple')
  const [resolution, setResolution] = useState<number>(36)
  const [isWireframe, setIsWireframe] = useState<boolean>(false)
  const [isAnimated, setIsAnimated] = useState<boolean>(true)
  const [slicePlane, setSlicePlane] = useState<'none' | 'x' | 'y'>('none')
  const [sliceCoord, setSliceCoord] = useState<number>(0)
  const [surfaceStats, setSurfaceStats] = useState<{ zMin: number; zMax: number; fps: number }>({
    zMin: -1,
    zMax: 1,
    fps: 60,
  })

  // -------------------------------------------------------------
  // TAB 2: 2D CALCULUS STATE
  // -------------------------------------------------------------
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null)
  const [calcSubmode, setCalcSubmode] = useState<'riemann' | 'tangent' | 'taylor'>('riemann')
  const [calcFunction, setCalcFunction] = useState<string>('x^2')
  const [riemannMethod, setRiemannMethod] = useState<'left' | 'right' | 'midpoint' | 'trapezoid'>('midpoint')
  const [numRectangles, setNumRectangles] = useState<number>(10)
  const [tangentX, setTangentX] = useState<number>(1.2)
  const [taylorOrder, setTaylorOrder] = useState<number>(5)
  const [calcReadout, setCalcReadout] = useState<{
    approx: number
    exact: number | null
    errorPct: number
    slope: number
  }>({ approx: 0, exact: null, errorPct: 0, slope: 0 })

  // -------------------------------------------------------------
  // TAB 3: VECTOR FIELDS STATE
  // -------------------------------------------------------------
  const vectorCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [charges, setCharges] = useState<PointCharge[]>([
    { id: '1', x: -1.8, y: 0, q: 1.0 },
    { id: '2', x: 1.8, y: 0, q: -1.0 },
  ])
  const [showGridVectors, setShowGridVectors] = useState(true)
  const [showFieldLines, setShowFieldLines] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const testParticlesRef = useRef<TestParticle[]>([])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // =============================================================
  // 1. THREE.JS 3D SMOOTH SURFACES ENGINE
  // =============================================================
  useEffect(() => {
    if (!isOpen || activeTab !== '3d_surfaces' || !threeMountRef.current) return

    const container = threeMountRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene, Camera, Renderer
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060913) // Obsidian deep background
    scene.fog = new THREE.FogExp2(0x060913, 0.035)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(6, 5, 8)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambLight)

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.4)
    dirLight1.position.set(5, 10, 7)
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 0.9)
    dirLight2.position.set(-5, -6, -5)
    scene.add(dirLight2)

    // Grid Floor
    const gridHelper = new THREE.GridHelper(10, 20, 0x1e293b, 0x0f172a)
    gridHelper.position.y = -2.5
    scene.add(gridHelper)

    // Coordinate Axes
    const axesGroup = new THREE.Group()
    const axisMat = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.5 })
    const axisGeoX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4, -2.5, 0), new THREE.Vector3(4, -2.5, 0)])
    const axisGeoZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -2.5, -4), new THREE.Vector3(0, -2.5, 4)])
    axesGroup.add(new THREE.Line(axisGeoX, axisMat))
    axesGroup.add(new THREE.Line(axisGeoZ, axisMat))
    scene.add(axesGroup)

    // Slicing Plane mesh
    const sliceMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      wireframe: false,
    })
    const sliceGeo = new THREE.PlaneGeometry(8, 6)
    const sliceMesh = new THREE.Mesh(sliceGeo, sliceMat)
    sliceMesh.visible = false
    scene.add(sliceMesh)

    // Surface Mesh
    const N = resolution
    const surfaceGeo = new THREE.PlaneGeometry(6, 6, N - 1, N - 1)
    surfaceGeo.rotateX(-Math.PI / 2) // lie horizontally

    const count = surfaceGeo.attributes.position.count
    const colors = new Float32Array(count * 3)
    surfaceGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const surfaceMat = new THREE.MeshStandardMaterial({
      roughness: 0.25,
      metalness: 0.4,
      wireframe: isWireframe,
      vertexColors: true,
      side: THREE.DoubleSide,
    })
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat)
    scene.add(surfaceMesh)

    // Function evaluation formulas
    const evalZ = (x: number, y: number, t: number): number => {
      const r = Math.sqrt(x * x + y * y)
      switch (surfacePreset) {
        case 'ripple':
          return Math.sin(2.2 * r - t * 2.5) / (r + 0.6) * 1.5
        case 'saddle':
          return (x * x - y * y) * 0.25
        case 'sombrero':
          return r === 0 ? 1.8 : (Math.sin(2.5 * r) / (2.5 * r)) * 1.8
        case 'eggcarton':
          return Math.cos(1.8 * x) * Math.sin(1.8 * y) * 0.9
        case 'gaussian':
          return Math.exp(-(x * x + y * y) * 0.6) * 2.2
        case 'monkey':
          return (x * x * x - 3 * x * y * y) * 0.08
        default:
          return Math.sin(x) * Math.cos(y)
      }
    }

    // Color mapper from elevation
    const colorForZ = (zNorm: number): [number, number, number] => {
      // zNorm between 0 and 1
      // Deep Blue (0.0) -> Cyan (0.35) -> Emerald (0.7) -> Amber/Gold (1.0)
      if (zNorm < 0.35) {
        const u = zNorm / 0.35
        return [0.05 + 0.1 * u, 0.2 + 0.6 * u, 0.7 + 0.28 * u]
      } else if (zNorm < 0.7) {
        const u = (zNorm - 0.35) / 0.35
        return [0.15 + 0.1 * u, 0.8 + 0.1 * u, 0.98 - 0.6 * u]
      } else {
        const u = (zNorm - 0.7) / 0.3
        return [0.25 + 0.73 * u, 0.9 - 0.2 * u, 0.38 - 0.25 * u]
      }
    }

    // Smooth Orbit Controls via Custom Inertia Mouse/Touch
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0
    let spherical = { radius: 10, theta: 0.8, phi: 0.9 }
    let targetSpherical = { ...spherical }

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - prevMouseX
      const dy = e.clientY - prevMouseY
      targetSpherical.theta -= dx * 0.007
      targetSpherical.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, targetSpherical.phi - dy * 0.007))
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }
    const onMouseUp = () => {
      isDragging = false
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      targetSpherical.radius = Math.max(4, Math.min(18, targetSpherical.radius + e.deltaY * 0.01))
    }

    const dom = renderer.domElement
    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dom.addEventListener('wheel', onWheel, { passive: false })

    // Animation Loop
    let animId: number
    let clock = new THREE.Clock()
    let frameCount = 0
    let lastFpsUpdate = performance.now()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Smooth camera interpolation (inertial damping)
      spherical.radius += (targetSpherical.radius - spherical.radius) * 0.08
      spherical.theta += (targetSpherical.theta - spherical.theta) * 0.08
      spherical.phi += (targetSpherical.phi - spherical.phi) * 0.08

      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta)
      camera.position.y = spherical.radius * Math.cos(spherical.phi)
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
      camera.lookAt(0, 0, 0)

      // Update surface geometry vertices
      const posAttr = surfaceGeo.attributes.position
      const colAttr = surfaceGeo.attributes.color
      let zMin = 1e9
      let zMax = -1e9

      const timeVal = isAnimated ? t : 0

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i)
        const z = posAttr.getZ(i)
        const y = evalZ(x, z, timeVal)
        posAttr.setY(i, y)
        if (y < zMin) zMin = y
        if (y > zMax) zMax = y
      }

      const zRange = Math.max(0.01, zMax - zMin)
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i)
        const norm = (y - zMin) / zRange
        const [r, g, b] = colorForZ(norm)
        colAttr.setXYZ(i, r, g, b)
      }

      posAttr.needsUpdate = true
      colAttr.needsUpdate = true
      surfaceGeo.computeVertexNormals()

      // Slice plane position
      if (slicePlane === 'x') {
        sliceMesh.visible = true
        sliceMesh.rotation.set(0, Math.PI / 2, 0)
        sliceMesh.position.set(sliceCoord, 0, 0)
      } else if (slicePlane === 'y') {
        sliceMesh.visible = true
        sliceMesh.rotation.set(0, 0, 0)
        sliceMesh.position.set(0, 0, sliceCoord)
      } else {
        sliceMesh.visible = false
      }

      renderer.render(scene, camera)

      // FPS Calculation
      frameCount++
      const now = performance.now()
      if (now - lastFpsUpdate >= 1000) {
        setSurfaceStats({
          zMin: Math.round(zMin * 100) / 100,
          zMax: Math.round(zMax * 100) / 100,
          fps: frameCount,
        })
        frameCount = 0
        lastFpsUpdate = now
      }
    }

    animate()

    // Resize handler
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      surfaceGeo.dispose()
      surfaceMat.dispose()
    }
  }, [isOpen, activeTab, surfacePreset, resolution, isWireframe, isAnimated, slicePlane, sliceCoord])

  // =============================================================
  // 2. 2D CALCULUS (RIEMANN / TANGENT / TAYLOR) CANVAS
  // =============================================================
  useEffect(() => {
    if (!isOpen || activeTab !== '2d_calculus' || !canvas2DRef.current) return
    const canvas = canvas2DRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Coordinate mapping: [-4, 4] in x, [-3, 5] in y
    const xMin = -4
    const xMax = 4
    const yMin = -3
    const yMax = 5

    const toScreenX = (x: number) => ((x - xMin) / (xMax - xMin)) * width
    const toScreenY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height

    // Function evaluator
    const f = (x: number): number => {
      switch (calcFunction) {
        case 'x^2':
          return 0.35 * x * x
        case 'sin(x)':
          return 2.0 * Math.sin(x)
        case 'cubic':
          return 0.15 * (x * x * x - 3 * x)
        case 'exponential':
          return Math.exp(0.5 * x) - 1.0
        default:
          return 0.35 * x * x
      }
    }

    // Exact derivative
    const df = (x: number): number => {
      switch (calcFunction) {
        case 'x^2':
          return 0.7 * x
        case 'sin(x)':
          return 2.0 * Math.cos(x)
        case 'cubic':
          return 0.15 * (3 * x * x - 3)
        case 'exponential':
          return 0.5 * Math.exp(0.5 * x)
        default:
          return 0.7 * x
      }
    }

    // Clear Background
    ctx.fillStyle = '#060913'
    ctx.fillRect(0, 0, width, height)

    // Draw Grid Lines
    ctx.lineWidth = 1
    ctx.strokeStyle = '#1e293b'
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      ctx.beginPath()
      ctx.moveTo(toScreenX(x), 0)
      ctx.lineTo(toScreenX(x), height)
      ctx.stroke()
    }
    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
      ctx.beginPath()
      ctx.moveTo(0, toScreenY(y))
      ctx.lineTo(width, toScreenY(y))
      ctx.stroke()
    }

    // Axes
    ctx.lineWidth = 2
    ctx.strokeStyle = '#475569'
    ctx.beginPath()
    ctx.moveTo(0, toScreenY(0))
    ctx.lineTo(width, toScreenY(0))
    ctx.moveTo(toScreenX(0), 0)
    ctx.lineTo(toScreenX(0), height)
    ctx.stroke()

    // -------------------------------------------------------------
    // SUBMODE A: RIEMANN SUMS
    // -------------------------------------------------------------
    if (calcSubmode === 'riemann') {
      const a = 0.0
      const b = 3.2
      const n = numRectangles
      const dx = (b - a) / n
      let approxSum = 0

      for (let i = 0; i < n; i++) {
        const xL = a + i * dx
        const xR = xL + dx
        let xSample = xL
        if (riemannMethod === 'right') xSample = xR
        else if (riemannMethod === 'midpoint' || riemannMethod === 'trapezoid') xSample = (xL + xR) / 2

        const ySample = f(xSample)
        approxSum += ySample * dx

        // Draw rectangle
        const rectLeft = toScreenX(xL)
        const rectRight = toScreenX(xR)
        const rectTop = toScreenY(ySample)
        const rectBottom = toScreenY(0)
        const rectWidth = rectRight - rectLeft
        const rectHeight = rectBottom - rectTop

        // Gradient bar
        const barGrad = ctx.createLinearGradient(0, rectTop, 0, rectBottom)
        barGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)')
        barGrad.addColorStop(1, 'rgba(56, 189, 248, 0.12)')

        ctx.fillStyle = barGrad
        ctx.fillRect(rectLeft, rectTop, rectWidth, rectHeight)

        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rectLeft, rectTop, rectWidth, rectHeight)

        // Midpoint sample dot
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(toScreenX(xSample), toScreenY(ySample), 3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Analytical reference integral for f(x)
      let exact = 0
      if (calcFunction === 'x^2') exact = (0.35 * Math.pow(b, 3)) / 3 - (0.35 * Math.pow(a, 3)) / 3
      else if (calcFunction === 'sin(x)') exact = -2.0 * Math.cos(b) - -2.0 * Math.cos(a)

      const err = exact !== 0 ? Math.abs((approxSum - exact) / exact) * 100 : 0
      setCalcReadout({
        approx: Math.round(approxSum * 1000) / 1000,
        exact: Math.round(exact * 1000) / 1000,
        errorPct: Math.round(err * 10) / 10,
        slope: 0,
      })
    }

    // -------------------------------------------------------------
    // SUBMODE B: TANGENT LINE & INSTANTANEOUS SLOPE
    // -------------------------------------------------------------
    if (calcSubmode === 'tangent') {
      const x0 = tangentX
      const y0 = f(x0)
      const m = df(x0)

      // Draw Tangent Line y - y0 = m * (x - x0)
      const x1 = xMin
      const y1 = y0 + m * (x1 - x0)
      const x2 = xMax
      const y2 = y0 + m * (x2 - x0)

      ctx.strokeStyle = '#f43f5e'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(toScreenX(x1), toScreenY(y1))
      ctx.lineTo(toScreenX(x2), toScreenY(y2))
      ctx.stroke()

      // Slope triangle
      const deltaX = 1.0
      const deltaY = m * deltaX
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(toScreenX(x0), toScreenY(y0))
      ctx.lineTo(toScreenX(x0 + deltaX), toScreenY(y0))
      ctx.lineTo(toScreenX(x0 + deltaX), toScreenY(y0 + deltaY))
      ctx.stroke()
      ctx.setLineDash([])

      // Point of tangency
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#f43f5e'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(toScreenX(x0), toScreenY(y0), 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      setCalcReadout({
        approx: y0,
        exact: null,
        errorPct: 0,
        slope: Math.round(m * 100) / 100,
      })
    }

    // -------------------------------------------------------------
    // SUBMODE C: TAYLOR POLYNOMIAL APPROXIMATION
    // -------------------------------------------------------------
    if (calcSubmode === 'taylor') {
      // Taylor for sin(x) about 0
      const taylorSin = (x: number, order: number): number => {
        let sum = 0
        const terms = [
          (x: number) => x,
          (x: number) => -Math.pow(x, 3) / 6,
          (x: number) => Math.pow(x, 5) / 120,
          (x: number) => -Math.pow(x, 7) / 5040,
          (x: number) => Math.pow(x, 9) / 362880,
          (x: number) => -Math.pow(x, 11) / 39916800,
        ]
        const maxK = Math.min(terms.length, Math.floor((order + 1) / 2))
        for (let k = 0; k < maxK; k++) {
          sum += 2.0 * terms[k](x)
        }
        return sum
      }

      ctx.strokeStyle = '#a855f7'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      let firstP = true
      for (let px = 0; px <= width; px += 2) {
        const x = xMin + (px / width) * (xMax - xMin)
        const y = taylorSin(x, taylorOrder)
        if (Math.abs(y) > 8) continue
        const sy = toScreenY(y)
        if (firstP) {
          ctx.moveTo(px, sy)
          firstP = false
        } else {
          ctx.lineTo(px, sy)
        }
      }
      ctx.stroke()
    }

    // Draw Primary Function Curve f(x)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3
    ctx.beginPath()
    let first = true
    for (let px = 0; px <= width; px += 2) {
      const x = xMin + (px / width) * (xMax - xMin)
      const y = f(x)
      const sy = toScreenY(y)
      if (first) {
        ctx.moveTo(px, sy)
        first = false
      } else {
        ctx.lineTo(px, sy)
      }
    }
    ctx.stroke()
  }, [isOpen, activeTab, calcSubmode, calcFunction, riemannMethod, numRectangles, tangentX, taylorOrder])

  // =============================================================
  // 3. VECTOR FIELDS & ELECTRIC FIELD LINES CANVAS
  // =============================================================
  useEffect(() => {
    if (!isOpen || activeTab !== 'vector_fields' || !vectorCanvasRef.current) return
    const canvas = vectorCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const xMin = -4
    const xMax = 4
    const yMin = -3
    const yMax = 3

    const toScreenX = (x: number) => ((x - xMin) / (xMax - xMin)) * width
    const toScreenY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height

    let animId: number

    // Calculate E field vector (Ex, Ey) at any point
    const calcE = (x: number, y: number): { ex: number; ey: number; mag: number; v: number } => {
      let ex = 0
      let ey = 0
      let v = 0
      const k = 1.8

      for (const chg of charges) {
        const dx = x - chg.x
        const dy = y - chg.y
        const r2 = dx * dx + dy * dy
        const r = Math.sqrt(r2)
        if (r < 0.15) continue
        const eMag = (k * chg.q) / r2
        ex += eMag * (dx / r)
        ey += eMag * (dy / r)
        v += (k * chg.q) / r
      }
      const mag = Math.sqrt(ex * ex + ey * ey)
      return { ex, ey, mag, v }
    }

    const render = () => {
      ctx.fillStyle = '#060913'
      ctx.fillRect(0, 0, width, height)

      // Grid Vector Field Arrows
      if (showGridVectors) {
        const cols = 22
        const rows = 16
        for (let i = 0; i < cols; i++) {
          const x = xMin + (i / (cols - 1)) * (xMax - xMin)
          for (let j = 0; j < rows; j++) {
            const y = yMin + (j / (rows - 1)) * (yMax - yMin)
            const { ex, ey, mag } = calcE(x, y)
            if (mag < 0.02) continue

            const sx = toScreenX(x)
            const sy = toScreenY(y)
            const len = Math.min(18, Math.max(6, mag * 8))
            const angle = Math.atan2(-ey, ex) // inverted y for canvas

            // Arrow color based on magnitude
            const intensity = Math.min(1, mag * 0.7)
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.25 + intensity * 0.75})`
            ctx.lineWidth = 1.2

            ctx.save()
            ctx.translate(sx, sy)
            ctx.rotate(angle)

            // Arrow line
            ctx.beginPath()
            ctx.moveTo(-len / 2, 0)
            ctx.lineTo(len / 2, 0)
            // Arrow tip
            ctx.lineTo(len / 2 - 3, -2.5)
            ctx.moveTo(len / 2, 0)
            ctx.lineTo(len / 2 - 3, 2.5)
            ctx.stroke()
            ctx.restore()
          }
        }
      }

      // Streamlines / Field Lines
      if (showFieldLines) {
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)'
        ctx.lineWidth = 1.5

        for (const chg of charges) {
          if (chg.q <= 0) continue
          const numLines = 14
          for (let k = 0; k < numLines; k++) {
            const theta = (k / numLines) * Math.PI * 2
            let lx = chg.x + 0.25 * Math.cos(theta)
            let ly = chg.y + 0.25 * Math.sin(theta)

            ctx.beginPath()
            ctx.moveTo(toScreenX(lx), toScreenY(ly))

            const maxSteps = 120
            const ds = 0.08
            for (let step = 0; step < maxSteps; step++) {
              const { ex, ey, mag } = calcE(lx, ly)
              if (mag < 0.001) break
              lx += (ex / mag) * ds
              ly += (ey / mag) * ds

              if (lx < xMin || lx > xMax || ly < yMin || ly > yMax) break

              // Hit a negative charge
              let hit = false
              for (const other of charges) {
                if (other.q < 0 && Math.hypot(lx - other.x, ly - other.y) < 0.25) {
                  hit = true
                  break
                }
              }
              ctx.lineTo(toScreenX(lx), toScreenY(ly))
              if (hit) break
            }
            ctx.stroke()
          }
        }
      }

      // Draw Point Charges (+q Red, -q Blue)
      for (const chg of charges) {
        const sx = toScreenX(chg.x)
        const sy = toScreenY(chg.y)
        const isPos = chg.q > 0

        // Glow ring
        ctx.fillStyle = isPos ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'
        ctx.beginPath()
        ctx.arc(sx, sy, 22, 0, Math.PI * 2)
        ctx.fill()

        // Core sphere
        ctx.fillStyle = isPos ? '#ef4444' : '#3b82f6'
        ctx.shadowColor = isPos ? '#ef4444' : '#3b82f6'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(sx, sy, 14, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Symbol (+ or -)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(isPos ? '+' : '−', sx, sy)
      }

      // Update and Draw Test Particles
      const particles = testParticlesRef.current
      for (let p = particles.length - 1; p >= 0; p--) {
        const part = particles[p]
        const { ex, ey } = calcE(part.x, part.y)

        // Acceleration F = qE -> a = (q/m) * E
        part.vx += ex * 0.04
        part.vy += ey * 0.04
        part.x += part.vx * 0.04
        part.y += part.vy * 0.04
        part.trail.push({ x: part.x, y: part.y })
        if (part.trail.length > 35) part.trail.shift()

        // Draw particle trail
        if (part.trail.length > 1) {
          ctx.strokeStyle = part.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(toScreenX(part.trail[0].x), toScreenY(part.trail[0].y))
          for (let i = 1; i < part.trail.length; i++) {
            ctx.lineTo(toScreenX(part.trail[i].x), toScreenY(part.trail[i].y))
          }
          ctx.stroke()
        }

        // Particle head
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(toScreenX(part.x), toScreenY(part.y), 4, 0, Math.PI * 2)
        ctx.fill()

        // Boundary removal
        if (part.x < xMin - 1 || part.x > xMax + 1 || part.y < yMin - 1 || part.y > yMax + 1) {
          particles.splice(p, 1)
        }
      }

      animId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animId)
  }, [isOpen, activeTab, charges, showGridVectors, showFieldLines])

  // Mouse Dragging on Charges
  const handleVectorMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = vectorCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const xMin = -4, xMax = 4, yMin = -3, yMax = 3
    const worldX = xMin + (mx / canvas.clientWidth) * (xMax - xMin)
    const worldY = yMax - (my / canvas.clientHeight) * (yMax - yMin)

    // Check hit on charge
    const hit = charges.find((c) => Math.hypot(c.x - worldX, c.y - worldY) < 0.45)
    if (hit) {
      setActiveDragId(hit.id)
    } else {
      // Spawn mobile test charge!
      testParticlesRef.current.push({
        x: worldX,
        y: worldY,
        vx: 0,
        vy: 0,
        trail: [{ x: worldX, y: worldY }],
        color: '#fbbf24',
      })
    }
  }

  const handleVectorMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeDragId) return
    const canvas = vectorCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const xMin = -4, xMax = 4, yMin = -3, yMax = 3
    const worldX = Math.max(xMin + 0.3, Math.min(xMax - 0.3, xMin + (mx / canvas.clientWidth) * (xMax - xMin)))
    const worldY = Math.max(yMin + 0.3, Math.min(yMax - 0.3, yMax - (my / canvas.clientHeight) * (yMax - yMin)))

    setCharges((prev) => prev.map((c) => (c.id === activeDragId ? { ...c, x: worldX, y: worldY } : c)))
  }

  const handleVectorMouseUp = () => setActiveDragId(null)

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1240px',
          height: '92vh',
          background: '#070d18',
          border: '1px solid rgba(56, 189, 248, 0.22)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(7, 13, 24, 0.95))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)',
                fontSize: '20px',
              }}
            >
              📐
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Visual 2D/3D Math & Vector Field Sandbox
                </h2>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  60 FPS WebGL Engine
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                High-performance calculus visualizer, parametric 3D surfaces, and interactive Coulomb physics field lines
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '4px',
            }}
          >
            {[
              { id: '3d_surfaces', label: '🧊 3D Parametric Surfaces' },
              { id: '2d_calculus', label: '📈 2D Calculus Engine' },
              { id: 'vector_fields', label: '⚡ Electric Vector Fields' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SandboxMode)}
                style={{
                  background: activeTab === tab.id ? 'linear-gradient(135deg, #0284c7, #0ea5e9)' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: activeTab === tab.id ? '0 2px 8px rgba(14, 165, 233, 0.35)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ========================================================= */}
          {/* TAB 1: 3D SURFACES */}
          {/* ========================================================= */}
          {activeTab === '3d_surfaces' && (
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
              <div ref={threeMountRef} style={{ flex: 1, width: '100%', height: '100%' }} />

              {/* 3D Control Sidebar */}
              <div
                style={{
                  width: '320px',
                  background: 'rgba(11, 19, 36, 0.92)',
                  backdropFilter: 'blur(12px)',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Surface Preset
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'ripple', name: 'Wave Ripple', math: 'z = sin(r - t)/r' },
                    { id: 'saddle', name: 'Hyperbolic Saddle', math: 'z = x² - y²' },
                    { id: 'sombrero', name: 'Sombrero Sinc', math: 'z = sin(r)/r' },
                    { id: 'eggcarton', name: 'Egg Carton', math: 'z = cos(x)sin(y)' },
                    { id: 'gaussian', name: 'Gaussian Bell', math: 'z = e^(-r²)' },
                    { id: 'monkey', name: 'Monkey Saddle', math: 'z = x³ - 3xy²' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSurfacePreset(preset.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: surfacePreset === preset.id ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                        border: surfacePreset === preset.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.06)',
                        color: surfacePreset === preset.id ? '#38bdf8' : '#e2e8f0',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{preset.name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                        {preset.math}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Mesh & Animation Settings */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Grid Resolution</span>
                    <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>{resolution}×{resolution}</span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="50"
                    value={resolution}
                    onChange={(e) => setResolution(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#38bdf8' }}
                  />
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isAnimated}
                      onChange={(e) => setIsAnimated(e.target.checked)}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    <span>Continuous Time Evolution ($t$)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isWireframe}
                      onChange={(e) => setIsWireframe(e.target.checked)}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    <span>Wireframe Overlay</span>
                  </label>
                </div>

                {/* Calculus Slice Plane */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                    Partial Derivative Slice Plane
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {(['none', 'x', 'y'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSlicePlane(mode)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '6px',
                          background: slicePlane === mode ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {mode === 'none' ? 'Off' : `${mode.toUpperCase()} Plane`}
                      </button>
                    ))}
                  </div>

                  {slicePlane !== 'none' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <span>Slice Position: {sliceCoord.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="-2.5"
                        max="2.5"
                        step="0.05"
                        value={sliceCoord}
                        onChange={(e) => setSliceCoord(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#38bdf8', marginTop: '4px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Telemetry Badge */}
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Elevation Range:</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                      [{surfaceStats.zMin}, {surfaceStats.zMax}]
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Render Performance:</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>{surfaceStats.fps} FPS</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '4px' }}>
                    💡 Left click + drag to rotate • Scroll to zoom
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: 2D CALCULUS ENGINE */}
          {/* ========================================================= */}
          {activeTab === '2d_calculus' && (
            <div style={{ flex: 1, display: 'flex' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <canvas ref={canvas2DRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>

              {/* Calculus Controls Sidebar */}
              <div
                style={{
                  width: '320px',
                  background: 'rgba(11, 19, 36, 0.92)',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Calculus Topic
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { id: 'riemann', label: 'Riemann Sums' },
                      { id: 'tangent', label: 'Derivative Slope' },
                      { id: 'taylor', label: 'Taylor Series' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setCalcSubmode(m.id as any)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: '8px',
                          background: calcSubmode === m.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: calcSubmode === m.id ? '1px solid #38bdf8' : '1px solid transparent',
                          color: calcSubmode === m.id ? '#38bdf8' : '#94a3b8',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Function Choice */}
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Target Function $f(x)$</div>
                  <select
                    value={calcFunction}
                    onChange={(e) => setCalcFunction(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value="x^2">f(x) = 0.35 x² (Parabola)</option>
                    <option value="sin(x)">f(x) = 2.0 sin(x) (Harmonic)</option>
                    <option value="cubic">f(x) = 0.15 (x³ - 3x) (Cubic)</option>
                    <option value="exponential">f(x) = e^(0.5x) - 1 (Exponential)</option>
                  </select>
                </div>

                {/* Submode Specific Controls */}
                {calcSubmode === 'riemann' && (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Partitions (n)</span>
                        <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>{numRectangles}</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="80"
                        value={numRectangles}
                        onChange={(e) => setNumRectangles(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#38bdf8' }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Sample Rule</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {(['midpoint', 'left', 'right', 'trapezoid'] as const).map((method) => (
                          <button
                            key={method}
                            onClick={() => setRiemannMethod(method)}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              background: riemannMethod === method ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                            }}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Result Card */}
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#94a3b8' }}>Riemann Sum:</span>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>{calcReadout.approx}</span>
                      </div>
                      {calcReadout.exact !== null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#94a3b8' }}>Exact Integral:</span>
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>{calcReadout.exact}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#94a3b8' }}>Relative Error:</span>
                        <span style={{ color: calcReadout.errorPct < 1 ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                          {calcReadout.errorPct}%
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {calcSubmode === 'tangent' && (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Evaluation Point ($x_0$)</span>
                        <span style={{ fontSize: '0.8rem', color: '#f43f5e', fontWeight: 600 }}>{tangentX.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="-2.5"
                        max="2.5"
                        step="0.05"
                        value={tangentX}
                        onChange={(e) => setTangentX(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#f43f5e' }}
                      />
                    </div>

                    <div
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tangent Line Equation:</div>
                      <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontFamily: 'monospace' }}>
                        y - ({calcReadout.approx.toFixed(2)}) = {calcReadout.slope} · (x - {tangentX.toFixed(2)})
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#94a3b8' }}>Instantaneous Slope $f'(x_0)$:</span>
                        <span style={{ color: '#f43f5e', fontWeight: 700 }}>{calcReadout.slope}</span>
                      </div>
                    </div>
                  </>
                )}

                {calcSubmode === 'taylor' && (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Polynomial Order ($n$)</span>
                        <span style={{ fontSize: '0.8rem', color: '#a855f7', fontWeight: 600 }}>{taylorOrder}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="11"
                        step="2"
                        value={taylorOrder}
                        onChange={(e) => setTaylorOrder(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#a855f7' }}
                      />
                    </div>

                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.8)', fontSize: '0.78rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#a855f7', fontWeight: 600 }}>Purple Curve: </span>
                      Taylor series expansion about $x_0 = 0$. Higher orders approximate wider spans of the target curve!
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: VECTOR FIELDS & ELECTRIC FIELD LINES */}
          {/* ========================================================= */}
          {activeTab === 'vector_fields' && (
            <div style={{ flex: 1, display: 'flex' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <canvas
                  ref={vectorCanvasRef}
                  onMouseDown={handleVectorMouseDown}
                  onMouseMove={handleVectorMouseMove}
                  onMouseUp={handleVectorMouseUp}
                  style={{ width: '100%', height: '100%', display: 'block', cursor: activeDragId ? 'grabbing' : 'crosshair' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '16px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  💡 Drag charges to rearrange • Click anywhere to spawn a mobile test particle
                </div>
              </div>

              {/* Vector Field Settings Sidebar */}
              <div
                style={{
                  width: '320px',
                  background: 'rgba(11, 19, 36, 0.92)',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase' }}>
                  Field Configurations
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    {
                      name: 'Electric Dipole (+ / -)',
                      charges: [
                        { id: '1', x: -1.6, y: 0, q: 1.0 },
                        { id: '2', x: 1.6, y: 0, q: -1.0 },
                      ],
                    },
                    {
                      name: 'Like Repulsion (+ / +)',
                      charges: [
                        { id: '1', x: -1.6, y: 0, q: 1.0 },
                        { id: '2', x: 1.6, y: 0, q: 1.0 },
                      ],
                    },
                    {
                      name: 'Quadrupole (+ - + -)',
                      charges: [
                        { id: '1', x: -1.5, y: -1.2, q: 1.0 },
                        { id: '2', x: 1.5, y: -1.2, q: -1.0 },
                        { id: '3', x: 1.5, y: 1.2, q: 1.0 },
                        { id: '4', x: -1.5, y: 1.2, q: -1.0 },
                      ],
                    },
                  ].map((cfg, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCharges(cfg.charges)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {cfg.name}
                    </button>
                  ))}
                </div>

                {/* Display Overlays */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>
                    Visual Overlays
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showGridVectors}
                        onChange={(e) => setShowGridVectors(e.target.checked)}
                        style={{ accentColor: '#38bdf8' }}
                      />
                      <span>Electric Field Vector Grid (E-field vectors)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showFieldLines}
                        onChange={(e) => setShowFieldLines(e.target.checked)}
                        style={{ accentColor: '#a855f7' }}
                      />
                      <span>Curved Streamlines / Field Lines</span>
                    </label>
                  </div>
                </div>

                {/* Add / Clear Charges */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={() =>
                      setCharges((prev) => [
                        ...prev,
                        { id: String(Date.now()), x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 2, q: 1.0 },
                      ])
                    }
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Add (+q)
                  </button>
                  <button
                    onClick={() =>
                      setCharges((prev) => [
                        ...prev,
                        { id: String(Date.now()), x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 2, q: -1.0 },
                      ])
                    }
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid #3b82f6',
                      color: '#3b82f6',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Add (-q)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

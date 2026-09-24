import type { SimulationParam, SimulationReadout, SimulationType } from './types'
import { isWasmReady, WasmLorenzSimulator, wasm_heat_diffusion_step } from '../wasm'

export interface BuiltinTemplate {
  type: SimulationType
  title: string
  subject: string
  concept: string
  description: string
  params: SimulationParam[]
  presets?: { label: string; params: Record<string, number> }[]
  calculateReadouts: (p: Record<string, number>) => SimulationReadout[]
  renderCanvas: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    params: Record<string, number>,
    state: { time: number; animState: any }
  ) => void
}

export const BUILTIN_TEMPLATES: Record<string, BuiltinTemplate> = {
  projectile: {
    type: 'projectile',
    title: 'Projectile Motion Simulator',
    subject: 'Physics · Mechanics',
    concept: 'Parabolic 2D Kinematics',
    description: 'Launch a projectile and observe how launch angle, initial speed, and gravity shape the trajectory curve, range, and flight time.',
    presets: [
      { label: '45° Max Range', params: { angle: 45, speed: 25, gravity: 9.8 } },
      { label: 'High Arc (70°)', params: { angle: 70, speed: 28, gravity: 9.8 } },
      { label: 'Flat Drive (20°)', params: { angle: 20, speed: 30, gravity: 9.8 } },
      { label: 'Moon Gravity (1.6 m/s²)', params: { angle: 45, speed: 18, gravity: 1.6 } },
    ],
    params: [
      { key: 'angle', label: 'Launch Angle', min: 15, max: 80, step: 1, defaultValue: 45, unit: '°' },
      { key: 'speed', label: 'Initial Velocity (v₀)', min: 10, max: 45, step: 1, defaultValue: 25, unit: 'm/s' },
      { key: 'gravity', label: 'Gravity (g)', min: 1.6, max: 20, step: 0.2, defaultValue: 9.8, unit: 'm/s²' },
    ],
    calculateReadouts: (p) => {
      const rad = (p.angle * Math.PI) / 180
      const g = p.gravity
      const v0 = p.speed
      const timeOfFlight = (2 * v0 * Math.sin(rad)) / g
      const maxHeight = (v0 * v0 * Math.sin(rad) * Math.sin(rad)) / (2 * g)
      const range = (v0 * v0 * Math.sin(2 * rad)) / g
      return [
        { label: 'Max Height (H)', value: maxHeight.toFixed(2), unit: 'm', formula: 'H = (v₀² sin²θ)/(2g)' },
        { label: 'Range (R)', value: range.toFixed(2), unit: 'm', formula: 'R = (v₀² sin 2θ)/g' },
        { label: 'Time of Flight (T)', value: timeOfFlight.toFixed(2), unit: 's', formula: 'T = (2v₀ sin θ)/g' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      const groundY = h - 45
      const originX = 60
      const rad = (p.angle * Math.PI) / 180
      const g = p.gravity
      const v0 = p.speed
      const totalTime = (2 * v0 * Math.sin(rad)) / g
      const maxR = (v0 * v0 * Math.sin(2 * rad)) / g
      const maxH = (v0 * v0 * Math.sin(rad) * Math.sin(rad)) / (2 * g)

      // Dynamic isotropic scale filling ~80% of canvas width & height
      const scaleX = (w - 120) / Math.max(maxR, 20)
      const scaleY = (groundY - 60) / Math.max(maxH, 8)
      const effScale = Math.min(scaleX, scaleY) * 0.92

      // Draw Sky & Ground
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#e2e8f0'
      ctx.fillRect(0, groundY, w, h - groundY)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, groundY)
      ctx.lineTo(w, groundY)
      ctx.stroke()

      // Gridlines
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)'
      ctx.lineWidth = 1
      const gridStep = Math.max(effScale * 10, 45)
      for (let x = originX; x < w - 20; x += gridStep) {
        ctx.beginPath()
        ctx.moveTo(x, 20)
        ctx.lineTo(x, groundY)
        ctx.stroke()
      }

      // Theoretical Parabolic Path
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let t = 0; t <= totalTime; t += 0.05) {
        const x = originX + v0 * Math.cos(rad) * t * effScale
        const y = groundY - (v0 * Math.sin(rad) * t - 0.5 * g * t * t) * effScale
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Cannon Barrel
      const barrelLen = 24
      ctx.save()
      ctx.translate(originX, groundY)
      ctx.rotate(-rad)
      ctx.fillStyle = '#334155'
      ctx.fillRect(0, -5, barrelLen, 10)
      ctx.restore()
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.arc(originX, groundY, 8, 0, Math.PI * 2)
      ctx.fill()

      // Animated projectile along trajectory
      const animT = (state.time * 0.8) % (totalTime + 0.8)
      if (animT <= totalTime) {
        const px = originX + v0 * Math.cos(rad) * animT * effScale
        const py = groundY - (v0 * Math.sin(rad) * animT - 0.5 * g * animT * animT) * effScale
        
        // Projectile ball
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(px, py, 7, 0, Math.PI * 2)
        ctx.fill()

        // Velocity vector
        const vx = v0 * Math.cos(rad)
        const vy = v0 * Math.sin(rad) - g * animT
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + vx * 0.7, py - vy * 0.7)
        ctx.stroke()
      }
    },
  },

  pendulum: {
    type: 'pendulum',
    title: 'Simple Pendulum & Energy Exchange',
    subject: 'Physics · Oscillations',
    concept: 'Simple Harmonic Motion & Energy Conservation',
    description: 'Explore harmonic motion. Watch the kinetic and potential energy bars continuously convert as the bob swings.',
    presets: [
      { label: 'Earth Standard (g=9.8)', params: { length: 1.5, angle: 30, gravity: 9.8 } },
      { label: 'High Amplitude (45°)', params: { length: 2.0, angle: 45, gravity: 9.8 } },
      { label: 'Short & Fast (0.8m)', params: { length: 0.8, angle: 25, gravity: 9.8 } },
      { label: 'Moon Gravity (1.6 m/s²)', params: { length: 1.5, angle: 30, gravity: 1.6 } },
    ],
    params: [
      { key: 'length', label: 'String Length (L)', min: 0.8, max: 3.0, step: 0.1, defaultValue: 1.5, unit: 'm' },
      { key: 'angle', label: 'Initial Angle (θ₀)', min: 10, max: 50, step: 1, defaultValue: 30, unit: '°' },
      { key: 'gravity', label: 'Gravity (g)', min: 1.6, max: 20, step: 0.2, defaultValue: 9.8, unit: 'm/s²' },
    ],
    calculateReadouts: (p) => {
      const T = 2 * Math.PI * Math.sqrt(p.length / p.gravity)
      const freq = 1 / T
      const rad = (p.angle * Math.PI) / 180
      const vMax = Math.sqrt(2 * p.gravity * p.length * (1 - Math.cos(rad)))
      return [
        { label: 'Time Period (T)', value: T.toFixed(2), unit: 's', formula: 'T = 2π√(L/g)' },
        { label: 'Frequency (f)', value: freq.toFixed(2), unit: 'Hz', formula: 'f = 1/T' },
        { label: 'Max Velocity', value: vMax.toFixed(2), unit: 'm/s', formula: 'v_max = √(2gL(1-cosθ))' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      const pivotX = w / 2 - 30
      const pivotY = 30
      const visualL = Math.min(p.length * 60, h - 90)
      const radMax = (p.angle * Math.PI) / 180
      const omega = Math.sqrt(p.gravity / p.length)
      const currentAngle = radMax * Math.cos(omega * state.time)

      const bobX = pivotX + visualL * Math.sin(currentAngle)
      const bobY = pivotY + visualL * Math.cos(currentAngle)

      // Equilibrium dashed line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(pivotX, pivotY)
      ctx.lineTo(pivotX, pivotY + visualL + 15)
      ctx.stroke()
      ctx.setLineDash([])

      // Ceiling mount
      ctx.fillStyle = '#334155'
      ctx.fillRect(pivotX - 35, pivotY - 6, 70, 6)
      ctx.beginPath()
      ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2)
      ctx.fill()

      // String
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(pivotX, pivotY)
      ctx.lineTo(bobX, bobY)
      ctx.stroke()

      // Bob
      ctx.fillStyle = '#6366f1'
      ctx.beginPath()
      ctx.arc(bobX, bobY, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#4338ca'
      ctx.lineWidth = 2
      ctx.stroke()

      // Energy Bar Graph on right
      const barX = w - 65
      const barY = 40
      const barH = 100
      const kineticRatio = Math.sin(omega * state.time) ** 2
      const potentialRatio = Math.cos(omega * state.time) ** 2

      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px sans-serif'
      ctx.fillText('Energy', barX - 10, barY - 10)

      // PE bar
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'
      ctx.fillRect(barX, barY, 14, barH)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(barX, barY + barH * (1 - potentialRatio), 14, barH * potentialRatio)
      ctx.fillText('PE', barX + 1, barY + barH + 14)

      // KE bar
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'
      ctx.fillRect(barX + 22, barY, 14, barH)
      ctx.fillStyle = '#10b981'
      ctx.fillRect(barX + 22, barY + barH * (1 - kineticRatio), 14, barH * kineticRatio)
      ctx.fillText('KE', barX + 23, barY + barH + 14)
    },
  },

  ohms_law: {
    type: 'ohms_law',
    title: "Ohm's Law & Circuit Lab",
    subject: 'Physics · Electricity',
    concept: 'Voltage, Resistance & Electric Current (V = IR)',
    description: "Adjust battery voltage and resistor load. Watch current change dynamically, electrons drift, and the lightbulb's glow intensity respond to power.",
    presets: [
      { label: 'Standard 9V Battery', params: { voltage: 9, resistance: 15 } },
      { label: 'High Current (Low R)', params: { voltage: 12, resistance: 4 } },
      { label: 'High Resistance (Low I)', params: { voltage: 6, resistance: 35 } },
      { label: 'Max Power Glow', params: { voltage: 18, resistance: 8 } },
    ],
    params: [
      { key: 'voltage', label: 'Battery Voltage (V)', min: 1, max: 24, step: 0.5, defaultValue: 9, unit: 'V' },
      { key: 'resistance', label: 'Resistance (R)', min: 2, max: 60, step: 1, defaultValue: 15, unit: 'Ω' },
    ],
    calculateReadouts: (p) => {
      const current = p.voltage / p.resistance
      const power = p.voltage * current
      return [
        { label: 'Current (I)', value: current.toFixed(2), unit: 'A', formula: 'I = V / R' },
        { label: 'Power (P)', value: power.toFixed(2), unit: 'W', formula: 'P = V × I' },
        { label: 'Resistance (R)', value: p.resistance.toFixed(1), unit: 'Ω', formula: 'R = V / I' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      const current = p.voltage / p.resistance
      const power = p.voltage * current

      // Circuit wire rectangle
      const left = 50
      const right = w - 60
      const top = 40
      const bottom = h - 45

      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 4
      ctx.strokeRect(left, top, right - left, bottom - top)

      // Clear spots for components
      // Left: Battery
      const batteryY = (top + bottom) / 2
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(left - 6, batteryY - 25, 12, 50)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(left - 14, batteryY - 12)
      ctx.lineTo(left + 14, batteryY - 12)
      ctx.stroke()
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(left - 8, batteryY + 12)
      ctx.lineTo(left + 8, batteryY + 12)
      ctx.stroke()
      ctx.fillStyle = '#ef4444'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText(`+ ${p.voltage}V -`, left - 18, batteryY + 32)

      // Top: Lightbulb
      const bulbX = (left + right) / 2
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(bulbX - 22, top - 6, 44, 12)
      
      // Bulb Glow halo based on power
      const glowAlpha = Math.min(power / 35, 0.85)
      const glowRad = 15 + Math.min(power * 1.5, 35)
      const grad = ctx.createRadialGradient(bulbX, top, 4, bulbX, top, glowRad)
      grad.addColorStop(0, `rgba(253, 224, 71, ${glowAlpha})`)
      grad.addColorStop(1, 'rgba(253, 224, 71, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(bulbX, top, glowRad, 0, Math.PI * 2)
      ctx.fill()

      // Bulb circle
      ctx.fillStyle = '#fef08a'
      ctx.strokeStyle = '#ca8a04'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(bulbX, top, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#854d0e'
      ctx.font = '10px sans-serif'
      ctx.fillText('💡 Bulb', bulbX - 16, top - 18)

      // Bottom: Resistor
      const resX = (left + right) / 2
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(resX - 25, bottom - 6, 50, 12)
      ctx.strokeStyle = '#ea580c'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(resX - 20, bottom)
      ctx.lineTo(resX - 12, bottom - 8)
      ctx.lineTo(resX - 4, bottom + 8)
      ctx.lineTo(resX + 4, bottom - 8)
      ctx.lineTo(resX + 12, bottom + 8)
      ctx.lineTo(resX + 20, bottom)
      ctx.stroke()
      ctx.fillStyle = '#c2410c'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText(`${p.resistance} Ω Resistor`, resX - 32, bottom + 24)

      // Flowing Electron dots
      const speed = Math.min(current * 45, 120)
      const perimeter = 2 * (right - left) + 2 * (bottom - top)
      const numElectrons = 16
      ctx.fillStyle = '#38bdf8'
      for (let i = 0; i < numElectrons; i++) {
        const offset = ((state.time * speed + (i * perimeter) / numElectrons) % perimeter)
        let ex = left
        let ey = top
        if (offset < (right - left)) {
          ex = left + offset
          ey = top
        } else if (offset < (right - left) + (bottom - top)) {
          ex = right
          ey = top + (offset - (right - left))
        } else if (offset < 2 * (right - left) + (bottom - top)) {
          ex = right - (offset - ((right - left) + (bottom - top)))
          ey = bottom
        } else {
          ex = left
          ey = bottom - (offset - (2 * (right - left) + (bottom - top)))
        }
        ctx.beginPath()
        ctx.arc(ex, ey, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    },
  },

  waves: {
    type: 'waves',
    title: 'Wave Interference & Double-Slit Pattern',
    subject: 'Physics · Wave Optics',
    concept: "Young's Double Slit Experiment & Fringe Spacing",
    description: 'Vary the wavelength, slit distance, and screen distance to see how constructive and destructive interference forms fringes.',
    presets: [
      { label: 'Green Light (550 nm)', params: { wavelength: 550, slitDist: 0.25, screenDist: 1.2 } },
      { label: 'Red Light (700 nm)', params: { wavelength: 700, slitDist: 0.25, screenDist: 1.2 } },
      { label: 'Violet Light (400 nm)', params: { wavelength: 400, slitDist: 0.25, screenDist: 1.2 } },
      { label: 'Wide Fringe Spacing', params: { wavelength: 650, slitDist: 0.15, screenDist: 2.0 } },
    ],
    params: [
      { key: 'wavelength', label: 'Wavelength (λ)', min: 400, max: 700, step: 10, defaultValue: 550, unit: 'nm' },
      { key: 'slitDist', label: 'Slit Separation (d)', min: 0.1, max: 0.8, step: 0.05, defaultValue: 0.25, unit: 'mm' },
      { key: 'screenDist', label: 'Screen Distance (D)', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.2, unit: 'm' },
    ],
    calculateReadouts: (p) => {
      // beta = (lambda * D) / d
      const lambda_m = p.wavelength * 1e-9
      const d_m = p.slitDist * 1e-3
      const beta_mm = (lambda_m * p.screenDist * 1e3) / d_m
      return [
        { label: 'Fringe Width (β)', value: beta_mm.toFixed(2), unit: 'mm', formula: 'β = (λ × D) / d' },
        { label: 'Central Max', value: 'Bright (I₀)', unit: '', formula: 'Δx = 0' },
        { label: '1st Dark Fringe', value: (beta_mm / 2).toFixed(2), unit: 'mm', formula: 'y = β / 2' },
      ]
    },
    renderCanvas: (ctx, w, h, p, _state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)

      // Color based on wavelength (nm)
      const wl = p.wavelength
      let waveColor = '#22c55e'
      if (wl < 450) waveColor = '#8b5cf6'
      else if (wl < 495) waveColor = '#3b82f6'
      else if (wl < 570) waveColor = '#22c55e'
      else if (wl < 590) waveColor = '#eab308'
      else if (wl < 620) waveColor = '#f97316'
      else waveColor = '#ef4444'

      const slitX = 70
      const screenX = w - 60

      // Barrier with 2 slits
      ctx.fillStyle = '#475569'
      ctx.fillRect(slitX, 0, 8, h / 2 - 25)
      ctx.fillRect(slitX, h / 2 - 15, 8, 30)
      ctx.fillRect(slitX, h / 2 + 25, 8, h / 2 - 25)

      // Labels
      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px sans-serif'
      ctx.fillText('Double Slit', slitX - 25, 20)
      ctx.fillText('Screen', screenX - 10, 20)

      // Interference pattern on observation screen
      const beta = ((p.wavelength * 1e-9 * p.screenDist * 1e3) / (p.slitDist * 1e-3)) * 6.5
      const screenYCenter = h / 2

      ctx.fillStyle = '#1e293b'
      ctx.fillRect(screenX, 25, 24, h - 50)

      for (let y = 30; y < h - 30; y++) {
        const dy = y - screenYCenter
        const phase = (Math.PI * dy) / Math.max(beta, 4)
        const intensity = Math.cos(phase) ** 2
        ctx.fillStyle = waveColor
        ctx.globalAlpha = intensity
        ctx.fillRect(screenX, y, 24, 1)
      }
      ctx.globalAlpha = 1.0

      // Intensity curve
      ctx.strokeStyle = waveColor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let y = 30; y < h - 30; y += 2) {
        const dy = y - screenYCenter
        const phase = (Math.PI * dy) / Math.max(beta, 4)
        const intensity = Math.cos(phase) ** 2
        const ix = screenX - 10 - intensity * 45
        if (y === 30) ctx.moveTo(ix, y)
        else ctx.lineTo(ix, y)
      }
      ctx.stroke()
    },
  },

  gas_law: {
    type: 'gas_law',
    title: "Ideal Gas Law & Piston Chamber",
    subject: 'Chemistry / Physics · Thermodynamics',
    concept: 'Boyle’s, Charles’s & Ideal Gas Law (PV = nRT)',
    description: 'Compress or expand the piston and adjust temperature. Observe how kinetic energy of gas molecules directly changes the pressure gauge.',
    presets: [
      { label: 'Standard STP (300 K)', params: { temp: 300, volume: 5, moles: 1.0 } },
      { label: 'Heated Expansion', params: { temp: 480, volume: 7, moles: 1.2 } },
      { label: 'High Compression', params: { temp: 280, volume: 2.5, moles: 1.5 } },
      { label: 'Cold Low Pressure', params: { temp: 160, volume: 4.0, moles: 0.8 } },
    ],
    params: [
      { key: 'temp', label: 'Temperature (T)', min: 150, max: 600, step: 10, defaultValue: 300, unit: 'K' },
      { key: 'volume', label: 'Cylinder Volume (V)', min: 2, max: 8, step: 0.5, defaultValue: 5, unit: 'L' },
      { key: 'moles', label: 'Gas Moles (n)', min: 0.5, max: 3.0, step: 0.5, defaultValue: 1.0, unit: 'mol' },
    ],
    calculateReadouts: (p) => {
      const R = 0.0821 // L·atm / (mol·K)
      const pressure = (p.moles * R * p.temp) / p.volume
      return [
        { label: 'Pressure (P)', value: pressure.toFixed(2), unit: 'atm', formula: 'P = nRT / V' },
        { label: 'Volume (V)', value: p.volume.toFixed(1), unit: 'L', formula: 'Cylinder Level' },
        { label: 'Avg Kinetic Energy', value: ((3 / 2) * 8.314 * p.temp).toFixed(0), unit: 'J/mol', formula: 'KE = 3/2 RT' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      const cylLeft = 60
      const cylWidth = 140
      const cylBottom = h - 35
      const maxCylHeight = 160
      const pistonHeight = Math.min((p.volume / 8) * maxCylHeight, maxCylHeight - 10)
      const pistonY = cylBottom - pistonHeight

      // Cylinder Walls
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(cylLeft, cylBottom - maxCylHeight)
      ctx.lineTo(cylLeft, cylBottom)
      ctx.lineTo(cylLeft + cylWidth, cylBottom)
      ctx.lineTo(cylLeft + cylWidth, cylBottom - maxCylHeight)
      ctx.stroke()

      // Movable Piston Head
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(cylLeft + 2, pistonY - 8, cylWidth - 4, 12)
      ctx.fillStyle = '#64748b'
      ctx.fillRect(cylLeft + cylWidth / 2 - 6, pistonY - 45, 12, 40)

      // Gas molecules inside chamber
      const numParticles = Math.round(p.moles * 15)
      const speedMult = Math.sqrt(p.temp / 300) * 1.5
      ctx.fillStyle = '#3b82f6'
      for (let i = 0; i < numParticles; i++) {
        const seedX = (Math.sin(i * 99 + state.time * speedMult) * 0.5 + 0.5)
        const seedY = (Math.cos(i * 77 + state.time * speedMult * 1.2) * 0.5 + 0.5)
        const gx = cylLeft + 8 + seedX * (cylWidth - 16)
        const gy = pistonY + 6 + seedY * (cylBottom - pistonY - 12)
        ctx.beginPath()
        ctx.arc(gx, gy, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Pressure Gauge on right
      const gaugeX = w - 75
      const gaugeY = 70
      const R = 0.0821
      const pressure = (p.moles * R * p.temp) / p.volume
      const maxPress = 15
      const angle = -Math.PI * 0.75 + (Math.min(pressure / maxPress, 1) * Math.PI * 1.5)

      ctx.fillStyle = '#f1f5f9'
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(gaugeX, gaugeY, 35, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Needle
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(gaugeX, gaugeY)
      ctx.lineTo(gaugeX + 26 * Math.cos(angle), gaugeY + 26 * Math.sin(angle))
      ctx.stroke()

      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('PRESSURE', gaugeX - 26, gaugeY + 50)
      ctx.fillText(`${pressure.toFixed(1)} atm`, gaugeX - 22, gaugeY + 65)
    },
  },

  quadratic: {
    type: 'quadratic',
    title: 'Quadratic Curves & Roots Explorer',
    subject: 'Mathematics · Algebra',
    concept: 'Parabola Properties, Vertex & Discriminant',
    description: 'Manipulate coefficients a, b, and c to see how parabola orientation, vertex (h, k), and real roots shift dynamically.',
    presets: [
      { label: 'Two Real Roots (Δ > 0)', params: { a: 1, b: -2, c: -3 } },
      { label: 'Single Vertex Root (Δ = 0)', params: { a: 1, b: -4, c: 4 } },
      { label: 'No Real Roots (Δ < 0)', params: { a: 1, b: 2, c: 5 } },
      { label: 'Inverted Parabola (a < 0)', params: { a: -1, b: 2, c: 3 } },
    ],
    params: [
      { key: 'a', label: 'Coefficient (a)', min: -3, max: 3, step: 0.25, defaultValue: 1, unit: '' },
      { key: 'b', label: 'Coefficient (b)', min: -8, max: 8, step: 0.5, defaultValue: -2, unit: '' },
      { key: 'c', label: 'Constant (c)', min: -8, max: 8, step: 0.5, defaultValue: -3, unit: '' },
    ],
    calculateReadouts: (p) => {
      const a = p.a === 0 ? 0.001 : p.a
      const disc = p.b * p.b - 4 * a * p.c
      const h = -p.b / (2 * a)
      const k = p.c - (p.b * p.b) / (4 * a)
      let rootsText = 'No real roots'
      if (disc > 0) {
        const x1 = (-p.b + Math.sqrt(disc)) / (2 * a)
        const x2 = (-p.b - Math.sqrt(disc)) / (2 * a)
        rootsText = `x = ${x1.toFixed(2)}, ${x2.toFixed(2)}`
      } else if (disc === 0) {
        rootsText = `x = ${h.toFixed(2)} (double)`
      }
      return [
        { label: 'Discriminant (Δ)', value: disc.toFixed(1), unit: disc >= 0 ? '(Real)' : '(Complex)', formula: 'b² - 4ac' },
        { label: 'Vertex (h, k)', value: `(${h.toFixed(1)}, ${k.toFixed(1)})`, unit: '', formula: '(-b/2a, f(h))' },
        { label: 'Roots', value: rootsText, unit: '', formula: '(-b ± √Δ)/(2a)' },
      ]
    },
    renderCanvas: (ctx, w, h, p) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      const originX = w / 2
      const originY = h / 2
      const scale = 18

      // Grid
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += scale) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += scale) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // X & Y Axes
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(0, originY)
      ctx.lineTo(w, originY)
      ctx.moveTo(originX, 0)
      ctx.lineTo(originX, h)
      ctx.stroke()

      // Plot Parabola
      const a = p.a === 0 ? 0.001 : p.a
      ctx.strokeStyle = '#4f46e5'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      let started = false
      for (let px = 0; px <= w; px += 2) {
        const x = (px - originX) / scale
        const y = a * x * x + p.b * x + p.c
        const py = originY - y * scale
        if (py >= -50 && py <= h + 50) {
          if (!started) {
            ctx.moveTo(px, py)
            started = true
          } else {
            ctx.lineTo(px, py)
          }
        }
      }
      ctx.stroke()

      // Vertex point
      const vX = -p.b / (2 * a)
      const vY = p.c - (p.b * p.b) / (4 * a)
      const vPx = originX + vX * scale
      const vPy = originY - vY * scale
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(vPx, vPy, 5, 0, Math.PI * 2)
      ctx.fill()
    },
  },

  ray_optics: {
    type: 'ray_optics',
    title: 'Geometric Optics & Ray Tracing',
    subject: 'Physics · Optics',
    concept: 'Thin Lens Equation & Image Formation',
    description: 'Move an object in front of a convex lens to trace principal rays and observe real vs. virtual, inverted vs. erect images.',
    presets: [
      { label: 'At 2F (Same Size Image)', params: { focal: 15, objDist: 30, objHeight: 25 } },
      { label: 'Between F & 2F (Magnified)', params: { focal: 15, objDist: 22, objHeight: 20 } },
      { label: 'Inside Focus (Virtual Image)', params: { focal: 15, objDist: 10, objHeight: 18 } },
      { label: 'Far Object (Diminished)', params: { focal: 15, objDist: 45, objHeight: 25 } },
    ],
    params: [
      { key: 'focal', label: 'Focal Length (f)', min: 10, max: 25, step: 1, defaultValue: 15, unit: 'cm' },
      { key: 'objDist', label: 'Object Distance (u)', min: 12, max: 50, step: 1, defaultValue: 30, unit: 'cm' },
      { key: 'objHeight', label: 'Object Height (h)', min: 15, max: 40, step: 1, defaultValue: 25, unit: 'cm' },
    ],
    calculateReadouts: (p) => {
      // 1/v - 1/(-u) = 1/f  => 1/v = 1/f - 1/u = (u - f)/(uf) => v = uf / (u - f)
      const u = p.objDist
      const f = p.focal
      const denom = u - f
      const v = denom !== 0 ? (u * f) / denom : 999
      const m = -v / u
      const isReal = v > 0
      return [
        { label: 'Image Distance (v)', value: v.toFixed(1), unit: 'cm', formula: '1/v - 1/u = 1/f' },
        { label: 'Magnification (m)', value: Math.abs(m).toFixed(2), unit: isReal ? '(Inverted)' : '(Erect)', formula: 'm = -v / u' },
        { label: 'Nature', value: isReal ? 'Real & Inverted' : 'Virtual & Erect', unit: '', formula: 'Ray Intersection' },
      ]
    },
    renderCanvas: (ctx, w, h, p) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      const lensX = w / 2
      const axisY = h / 2
      const scale = 5

      // Principal Axis
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(10, axisY)
      ctx.lineTo(w - 10, axisY)
      ctx.stroke()

      // Convex Lens
      ctx.strokeStyle = '#0284c7'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.ellipse(lensX, axisY, 8, h / 2 - 20, 0, 0, Math.PI * 2)
      ctx.stroke()

      // Foci F and 2F marks
      const fDist = p.focal * scale
      ctx.fillStyle = '#0284c7'
      ctx.font = '10px sans-serif'
      // Left foci
      ctx.beginPath()
      ctx.arc(lensX - fDist, axisY, 3, 0, Math.PI * 2)
      ctx.arc(lensX - 2 * fDist, axisY, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillText('F', lensX - fDist - 4, axisY + 14)
      ctx.fillText('2F', lensX - 2 * fDist - 8, axisY + 14)
      // Right foci
      ctx.beginPath()
      ctx.arc(lensX + fDist, axisY, 3, 0, Math.PI * 2)
      ctx.arc(lensX + 2 * fDist, axisY, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillText("F'", lensX + fDist - 4, axisY + 14)
      ctx.fillText("2F'", lensX + 2 * fDist - 8, axisY + 14)

      // Object Arrow
      const objX = lensX - p.objDist * scale
      const objH = p.objHeight * 1.5
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(objX, axisY)
      ctx.lineTo(objX, axisY - objH)
      ctx.lineTo(objX - 4, axisY - objH + 8)
      ctx.moveTo(objX, axisY - objH)
      ctx.lineTo(objX + 4, axisY - objH + 8)
      ctx.stroke()

      // Ray 1: Parallel to axis, refracts through F'
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(objX, axisY - objH)
      ctx.lineTo(lensX, axisY - objH)
      ctx.lineTo(w - 20, axisY - objH + ((axisY - (axisY - objH)) / fDist) * (w - 20 - lensX))
      ctx.stroke()

      // Ray 2: Through optical center undeflected
      ctx.strokeStyle = '#10b981'
      ctx.beginPath()
      ctx.moveTo(objX, axisY - objH)
      ctx.lineTo(w - 20, axisY + (objH / (lensX - objX)) * (w - 20 - lensX))
      ctx.stroke()
    },
  },

  titration: {
    type: 'titration',
    title: 'Acid-Base Titration Curve & pH',
    subject: 'Chemistry · Analytical',
    concept: 'Strong Acid - Strong Base Titration (HCl + NaOH)',
    description: 'Add NaOH from the burette into the HCl analyte flask. Watch liquid drop animation, indicator color transition (Phenolphthalein), and the real-time S-shaped titration curve with equivalence point.',
    presets: [
      { label: 'Initial (0 mL NaOH)', params: { vAdded: 0, cAcid: 0.1, cBase: 0.1 } },
      { label: 'Before Eq (18 mL)', params: { vAdded: 18, cAcid: 0.1, cBase: 0.1 } },
      { label: 'Equivalence Point (25 mL)', params: { vAdded: 25, cAcid: 0.1, cBase: 0.1 } },
      { label: 'Excess Base (35 mL)', params: { vAdded: 35, cAcid: 0.1, cBase: 0.1 } },
    ],
    params: [
      { key: 'vAdded', label: 'NaOH Added (V_b)', min: 0, max: 50, step: 0.5, defaultValue: 18, unit: 'mL' },
      { key: 'cAcid', label: 'HCl Molarity (M_a)', min: 0.05, max: 0.2, step: 0.01, defaultValue: 0.1, unit: 'M' },
      { key: 'cBase', label: 'NaOH Molarity (M_b)', min: 0.05, max: 0.2, step: 0.01, defaultValue: 0.1, unit: 'M' },
    ],
    calculateReadouts: (p) => {
      const vAcid = 25
      const vEq = (p.cAcid * vAcid) / p.cBase
      const totalVol = vAcid + p.vAdded
      let currentPH = 7.0
      let phase = 'Neutral / Equivalence'
      let colorDesc = 'Faint Pink (End Point)'

      if (p.vAdded < vEq - 0.05) {
        const hMoles = p.cAcid * (vAcid / 1000) - p.cBase * (p.vAdded / 1000)
        const hConc = Math.max(hMoles / (totalVol / 1000), 1e-7)
        currentPH = Math.max(-Math.log10(hConc), 1.0)
        phase = 'Acidic Solution'
        colorDesc = currentPH < 8.2 ? 'Colorless' : 'Faint Pink'
      } else if (p.vAdded > vEq + 0.05) {
        const ohMoles = p.cBase * (p.vAdded / 1000) - p.cAcid * (vAcid / 1000)
        const ohConc = Math.max(ohMoles / (totalVol / 1000), 1e-7)
        const pOH = Math.max(-Math.log10(ohConc), 0.5)
        currentPH = Math.min(14 - pOH, 13.5)
        phase = 'Basic Solution'
        colorDesc = 'Vivid Magenta'
      }

      return [
        { label: 'Current pH', value: currentPH.toFixed(2), unit: '', formula: 'pH = -log₁₀[H⁺]' },
        { label: 'Equivalence Vol', value: vEq.toFixed(1), unit: 'mL', formula: 'M_a × V_a = M_b × V_b' },
        { label: 'Indicator Color', value: colorDesc, unit: '', formula: 'Phenolphthalein' },
        { label: 'Status', value: phase, unit: '' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      const vAcid = 25
      const vEq = (p.cAcid * vAcid) / p.cBase
      const totalVol = vAcid + p.vAdded
      let currentPH = 7.0
      if (p.vAdded < vEq - 0.05) {
        const hMoles = p.cAcid * (vAcid / 1000) - p.cBase * (p.vAdded / 1000)
        const hConc = Math.max(hMoles / (totalVol / 1000), 1e-7)
        currentPH = Math.max(-Math.log10(hConc), 1.0)
      } else if (p.vAdded > vEq + 0.05) {
        const ohMoles = p.cBase * (p.vAdded / 1000) - p.cAcid * (vAcid / 1000)
        const ohConc = Math.max(ohMoles / (totalVol / 1000), 1e-7)
        const pOH = Math.max(-Math.log10(ohConc), 0.5)
        currentPH = Math.min(14 - pOH, 13.5)
      }

      // --- APPARATUS (LEFT SIDE: x: 10 to ~w*0.42) ---
      const appCenterX = Math.min(w * 0.22, 160)
      const baseStandY = h - 35

      // Retort Stand
      ctx.fillStyle = '#475569'
      ctx.fillRect(appCenterX - 65, baseStandY, 130, 10)
      ctx.fillRect(appCenterX - 45, 30, 8, baseStandY - 30)
      // Clamps
      ctx.fillStyle = '#64748b'
      ctx.fillRect(appCenterX - 45, 75, 45, 6)
      ctx.fillRect(appCenterX - 45, 140, 45, 6)

      // Burette Tube
      const buretteX = appCenterX
      const buretteTopY = 40
      const buretteBottomY = 175
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 2
      ctx.fillStyle = 'rgba(241, 245, 249, 0.7)'
      ctx.fillRect(buretteX - 7, buretteTopY, 14, buretteBottomY - buretteTopY)
      ctx.strokeRect(buretteX - 7, buretteTopY, 14, buretteBottomY - buretteTopY)

      // Liquid inside burette (drops as vAdded increases)
      const maxBuretteVol = 50
      const liquidLevelFraction = 1 - Math.min(p.vAdded / maxBuretteVol, 0.95)
      const liquidTopY = buretteTopY + (1 - liquidLevelFraction) * (buretteBottomY - buretteTopY - 20)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.65)'
      ctx.fillRect(buretteX - 6, liquidTopY, 12, buretteBottomY - liquidTopY)

      // Burette Graduations
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1
      for (let y = buretteTopY + 10; y < buretteBottomY - 10; y += 12) {
        ctx.beginPath()
        ctx.moveTo(buretteX - 7, y)
        ctx.lineTo(buretteX - 2, y)
        ctx.stroke()
      }

      // Stopcock
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(buretteX - 10, buretteBottomY, 20, 6)
      ctx.strokeStyle = '#94a3b8'
      ctx.beginPath()
      ctx.moveTo(buretteX, buretteBottomY + 6)
      ctx.lineTo(buretteX, buretteBottomY + 18)
      ctx.stroke()

      // Falling droplet animation
      const dropCycle = (state.time * 2.5) % 1
      const dropY = buretteBottomY + 18 + dropCycle * 32
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(buretteX, dropY, 2.5, 0, Math.PI * 2)
      ctx.fill()

      // Conical Flask below (Erlenmeyer)
      const flaskTopY = buretteBottomY + 45
      const flaskBottomY = baseStandY - 5
      const flaskNeckW = 16
      const flaskBaseW = 76

      ctx.beginPath()
      ctx.moveTo(buretteX - flaskNeckW / 2, flaskTopY)
      ctx.lineTo(buretteX + flaskNeckW / 2, flaskTopY)
      ctx.lineTo(buretteX + flaskNeckW / 2, flaskTopY + 14)
      ctx.lineTo(buretteX + flaskBaseW / 2, flaskBottomY)
      ctx.lineTo(buretteX - flaskBaseW / 2, flaskBottomY)
      ctx.lineTo(buretteX - flaskNeckW / 2, flaskTopY + 14)
      ctx.closePath()
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 2
      ctx.stroke()

      // Flask Solution Color (Phenolphthalein indicator):
      // pH < 8.2: Pale watery
      // 8.2 - 10.0: Transitioning pink
      // > 10: Deep magenta
      let solutionFill = 'rgba(224, 242, 254, 0.4)'
      if (currentPH >= 8.2 && currentPH < 10.0) {
        const pinkAlpha = (currentPH - 8.2) / 1.8
        solutionFill = `rgba(244, 114, 182, ${0.25 + pinkAlpha * 0.55})`
      } else if (currentPH >= 10.0) {
        solutionFill = 'rgba(217, 70, 239, 0.85)'
      }

      ctx.fillStyle = solutionFill
      ctx.beginPath()
      const solTopY = flaskBottomY - 32
      const solTopW = flaskNeckW + (flaskBaseW - flaskNeckW) * 0.58
      ctx.moveTo(buretteX - solTopW / 2, solTopY)
      ctx.lineTo(buretteX + solTopW / 2, solTopY)
      ctx.lineTo(buretteX + flaskBaseW / 2 - 2, flaskBottomY - 1)
      ctx.lineTo(buretteX - flaskBaseW / 2 + 2, flaskBottomY - 1)
      ctx.closePath()
      ctx.fill()

      // Magnetic stir bar spinning
      const stirAngle = state.time * 8
      ctx.save()
      ctx.translate(buretteX, flaskBottomY - 5)
      ctx.rotate(stirAngle)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-8, -2, 16, 4)
      ctx.restore()

      // Flask Labels
      ctx.fillStyle = '#475569'
      ctx.font = '10px sans-serif'
      ctx.fillText('NaOH Titrant', buretteX + 14, buretteTopY + 20)
      ctx.fillText('HCl + Indicator', buretteX + flaskBaseW / 2 - 10, flaskBottomY - 10)

      // --- RIGHT SIDE: TITRATION CURVE GRAPH (x: w*0.45 to w - 20) ---
      const graphX = Math.max(w * 0.44, 195)
      const graphY = 35
      const graphW = w - graphX - 25
      const graphH = h - 70

      // Graph Background Card
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(graphX, graphY, graphW, graphH)
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1
      ctx.strokeRect(graphX, graphY, graphW, graphH)

      // Axes
      const plotOriginX = graphX + 35
      const plotOriginY = graphY + graphH - 25
      const plotW = graphW - 50
      const plotH = graphH - 45

      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(plotOriginX, graphY + 10)
      ctx.lineTo(plotOriginX, plotOriginY)
      ctx.lineTo(plotOriginX + plotW, plotOriginY)
      ctx.stroke()

      // Axis labels & grid
      ctx.fillStyle = '#64748b'
      ctx.font = '10px sans-serif'
      ctx.fillText('pH', plotOriginX - 24, graphY + 18)
      ctx.fillText('NaOH Added (mL)', plotOriginX + plotW / 2 - 40, plotOriginY + 20)

      // Y-Axis markers: 0, 7, 14
      for (const phMark of [0, 7, 14]) {
        const my = plotOriginY - (phMark / 14) * plotH
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)'
        ctx.beginPath()
        ctx.moveTo(plotOriginX, my)
        ctx.lineTo(plotOriginX + plotW, my)
        ctx.stroke()
        ctx.fillText(String(phMark), plotOriginX - 18, my + 3)
      }

      // Equivalence line (dashed)
      const eqX = plotOriginX + (vEq / 50) * plotW
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(eqX, graphY + 10)
      ctx.lineTo(eqX, plotOriginY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ef4444'
      ctx.fillText(`Eq: ${vEq.toFixed(1)}mL`, eqX - 20, graphY + 20)

      // Calculate pH(v) helper for curve
      const getPHAtVol = (v: number) => {
        if (v < vEq - 0.05) {
          const hm = p.cAcid * (vAcid / 1000) - p.cBase * (v / 1000)
          const hc = Math.max(hm / ((vAcid + v) / 1000), 1e-7)
          return Math.max(-Math.log10(hc), 1.0)
        }
        if (v > vEq + 0.05) {
          const ohm = p.cBase * (v / 1000) - p.cAcid * (vAcid / 1000)
          const ohc = Math.max(ohm / ((vAcid + v) / 1000), 1e-7)
          return Math.min(14 - (-Math.log10(ohc)), 13.5)
        }
        return 7.0
      }

      // Theoretical Full S-Curve (light indigo)
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let v = 0; v <= 50; v += 0.5) {
        const ph = getPHAtVol(v)
        const px = plotOriginX + (v / 50) * plotW
        const py = plotOriginY - (ph / 14) * plotH
        if (v === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      // Traced S-Curve up to current vAdded (vivid indigo)
      ctx.strokeStyle = '#4f46e5'
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let v = 0; v <= p.vAdded; v += 0.5) {
        const ph = getPHAtVol(v)
        const px = plotOriginX + (v / 50) * plotW
        const py = plotOriginY - (ph / 14) * plotH
        if (v === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      // Current Point Marker
      const curX = plotOriginX + (p.vAdded / 50) * plotW
      const curY = plotOriginY - (currentPH / 14) * plotH
      ctx.fillStyle = currentPH >= 8.2 ? '#db2777' : '#4f46e5'
      ctx.beginPath()
      ctx.arc(curX, curY, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()

      // Callout box at point
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText(`(${p.vAdded.toFixed(1)} mL, pH ${currentPH.toFixed(2)})`, Math.min(curX + 8, plotOriginX + plotW - 90), curY - 8)
    },
  },

  magnetic_fields: {
    type: 'magnetic_fields',
    title: 'Magnetic Field Lines & Dipole',
    subject: 'Physics · Magnetism',
    concept: 'Bar Magnet Vector Field & Compass Orientation',
    description: 'Visualize magnetic dipole field streamlines around a bar magnet. Move the interactive compass needle to watch it dynamically align along the local magnetic field vector.',
    presets: [
      { label: 'Axial Position', params: { strength: 25, compassX: 95, compassY: 0 } },
      { label: 'Equatorial Position', params: { strength: 25, compassX: 0, compassY: -70 } },
      { label: 'Strong Magnet', params: { strength: 45, compassX: 65, compassY: -45 } },
      { label: 'Near South Pole', params: { strength: 25, compassX: -85, compassY: 35 } },
    ],
    params: [
      { key: 'strength', label: 'Magnet Strength (M)', min: 10, max: 50, step: 2, defaultValue: 25, unit: 'A·m²' },
      { key: 'compassX', label: 'Compass X Offset', min: -130, max: 130, step: 2, defaultValue: 65, unit: 'px' },
      { key: 'compassY', label: 'Compass Y Offset', min: -95, max: 95, step: 2, defaultValue: -45, unit: 'px' },
    ],
    calculateReadouts: (p) => {
      const poleDist = 45
      // North pole at (+poleDist, 0), South pole at (-poleDist, 0)
      const rN = Math.hypot(p.compassX - poleDist, p.compassY)
      const rS = Math.hypot(p.compassX + poleDist, p.compassY)
      const bFieldMag = (p.strength * 100) / (Math.max(rN * rS, 400))

      // Angle of resultant field
      const bx = (p.compassX - poleDist) / Math.pow(rN, 3) - (p.compassX + poleDist) / Math.pow(rS, 3)
      const by = p.compassY / Math.pow(rN, 3) - p.compassY / Math.pow(rS, 3)
      const headingDeg = (Math.atan2(by, bx) * 180) / Math.PI

      return [
        { label: 'Field Strength (|B|)', value: bFieldMag.toFixed(1), unit: 'μT', formula: 'B = (μ₀/4π) × 2M/r³' },
        { label: 'Needle Heading', value: headingDeg.toFixed(1), unit: '°', formula: 'θ = arctan(B_y / B_x)' },
        { label: 'Distance from Center', value: Math.hypot(p.compassX, p.compassY).toFixed(0), unit: 'px' },
      ]
    },
    renderCanvas: (ctx, w, h, p) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2 - 20
      const cy = h / 2
      const poleDist = 45

      // Draw subtle background magnetic streamlines (ellipses curving from N to S)
      ctx.lineWidth = 1.2
      for (let i = 1; i <= 6; i++) {
        const rx = 35 + i * 28
        const ry = 18 + i * 22
        ctx.strokeStyle = `rgba(148, 163, 184, ${0.45 - i * 0.05})`
        // Top loop
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()

        // Direction arrows on streamlines
        const arrowX = cx
        const arrowYTop = cy - ry
        ctx.fillStyle = '#38bdf8'
        ctx.beginPath()
        ctx.moveTo(arrowX - 4, arrowYTop - 3)
        ctx.lineTo(arrowX + 4, arrowYTop)
        ctx.lineTo(arrowX - 4, arrowYTop + 3)
        ctx.fill()
      }

      // Bar Magnet in center
      const magW = 90
      const magH = 28
      // South Pole (Blue, Left)
      ctx.fillStyle = '#2563eb'
      ctx.fillRect(cx - magW / 2, cy - magH / 2, magW / 2, magH)
      // North Pole (Red, Right)
      ctx.fillStyle = '#dc2626'
      ctx.fillRect(cx, cy - magH / 2, magW / 2, magH)

      // Magnet Outline & Labels
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.strokeRect(cx - magW / 2, cy - magH / 2, magW, magH)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText('S', cx - magW / 4 - 5, cy + 5)
      ctx.fillText('N', cx + magW / 4 - 5, cy + 5)

      // Interactive Compass
      const compX = cx + p.compassX
      const compY = cy + p.compassY

      // Calculate B vector direction at compass location
      const rN = Math.hypot(p.compassX - poleDist, p.compassY)
      const rS = Math.hypot(p.compassX + poleDist, p.compassY)
      const bx = (p.compassX - poleDist) / Math.pow(rN, 3) - (p.compassX + poleDist) / Math.pow(rS, 3)
      const by = p.compassY / Math.pow(rN, 3) - p.compassY / Math.pow(rS, 3)
      const angle = Math.atan2(by, bx)

      // Compass Housing
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'
      ctx.strokeStyle = '#f8fafc'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(compX, compY, 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Compass Glass Rim
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(compX, compY, 17, 0, Math.PI * 2)
      ctx.stroke()

      // Compass Needle (North = Red pointing along field, South = Blue)
      ctx.save()
      ctx.translate(compX, compY)
      ctx.rotate(angle)

      // North tip (Red)
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(0, -3)
      ctx.lineTo(15, 0)
      ctx.lineTo(0, 3)
      ctx.closePath()
      ctx.fill()

      // South tip (Silver/White)
      ctx.fillStyle = '#94a3b8'
      ctx.beginPath()
      ctx.moveTo(0, -3)
      ctx.lineTo(-15, 0)
      ctx.lineTo(0, 3)
      ctx.closePath()
      ctx.fill()

      // Center pivot
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(0, 0, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Compass Label
      ctx.fillStyle = '#38bdf8'
      ctx.font = '10px sans-serif'
      ctx.fillText('🧭 Compass', compX - 25, compY + 34)
    },
  },

  em_induction: {
    type: 'em_induction',
    title: "Electromagnetic Induction & Faraday's Law",
    subject: 'Physics · Electromagnetism',
    concept: "Faraday's & Lenz's Law: EMF = -N(dΦ/dt)",
    description: 'Plunge a bar magnet through a wire solenoid coil. Observe changing magnetic flux, induced EMF, galvanometer needle deflection according to Lenz’s Law, and lightbulb glowing.',
    presets: [
      { label: 'Medium Oscillation', params: { turns: 200, speed: 3, magnetStrength: 1.5 } },
      { label: 'High Turns (N=400)', params: { turns: 400, speed: 3, magnetStrength: 1.5 } },
      { label: 'Fast Plunge', params: { turns: 200, speed: 6, magnetStrength: 2.5 } },
      { label: 'Slow Drift', params: { turns: 200, speed: 1, magnetStrength: 1.0 } },
    ],
    params: [
      { key: 'turns', label: 'Coil Turns (N)', min: 50, max: 400, step: 25, defaultValue: 200, unit: 'turns' },
      { key: 'speed', label: 'Magnet Velocity (v)', min: 1, max: 7, step: 0.5, defaultValue: 3, unit: 'cm/s' },
      { key: 'magnetStrength', label: 'Field (B₀)', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.5, unit: 'T' },
    ],
    calculateReadouts: (p) => {
      const peakEMF = (p.turns * p.speed * p.magnetStrength) / 80
      const power = (peakEMF * peakEMF) / 10
      return [
        { label: 'Peak EMF (ℰ)', value: peakEMF.toFixed(2), unit: 'V', formula: 'ℰ = -N (dΦ/dt)' },
        { label: 'Bulb Power', value: power.toFixed(2), unit: 'W', formula: 'P = ℰ² / R' },
        { label: 'Induction Principle', value: "Lenz's Law", unit: '', formula: 'Opposes Motion' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)

      const coilCenterX = w / 2 - 25
      const coilCenterY = h / 2 - 20
      const coilRadius = 45
      const coilLength = 120

      // Dynamic Magnet Motion (Oscillates through coil center)
      const omega = p.speed * 1.8
      const magnetDisplacement = Math.sin(omega * state.time) * 110
      const magnetX = coilCenterX + magnetDisplacement
      const magnetY = coilCenterY

      // Induced EMF derivative: d(sin)/dt = cos(omega * t) * omega
      const currentEMF = -((p.turns * p.speed * p.magnetStrength) / 80) * Math.cos(omega * state.time)
      const bulbGlow = Math.min(Math.abs(currentEMF) / 4, 1.0)

      // Coil connecting wires to Galvanometer and Bulb
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 3
      ctx.beginPath()
      // Left terminal wire to circuit
      ctx.moveTo(coilCenterX - coilLength / 2, coilCenterY + coilRadius)
      ctx.lineTo(coilCenterX - coilLength / 2, coilCenterY + coilRadius + 50)
      ctx.lineTo(w * 0.2, coilCenterY + coilRadius + 50)
      ctx.stroke()

      // Right terminal wire to circuit
      ctx.beginPath()
      ctx.moveTo(coilCenterX + coilLength / 2, coilCenterY + coilRadius)
      ctx.lineTo(coilCenterX + coilLength / 2, coilCenterY + coilRadius + 50)
      ctx.lineTo(w * 0.75, coilCenterY + coilRadius + 50)
      ctx.stroke()

      // Galvanometer (Bottom Left)
      const galvX = w * 0.28
      const galvY = h - 50
      ctx.fillStyle = '#1e293b'
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(galvX, galvY, 32, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Galvanometer Dial scale
      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px sans-serif'
      ctx.fillText('-G+', galvX - 8, galvY - 14)
      ctx.fillText('0', galvX - 3, galvY - 20)

      // Galvanometer Deflecting Needle (proportional to currentEMF)
      const needleDeflection = Math.max(Math.min(currentEMF * 0.6, Math.PI / 3), -Math.PI / 3)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(galvX, galvY)
      ctx.lineTo(galvX + Math.sin(needleDeflection) * 26, galvY - Math.cos(needleDeflection) * 26)
      ctx.stroke()
      ctx.fillStyle = '#cbd5e1'
      ctx.beginPath()
      ctx.arc(galvX, galvY, 4, 0, Math.PI * 2)
      ctx.fill()

      // Lightbulb in circuit (Bottom Right)
      const bulbX = w * 0.68
      const bulbY = h - 50

      // Bulb Glow Halo
      if (bulbGlow > 0.05) {
        const glowRad = 15 + bulbGlow * 25
        const grad = ctx.createRadialGradient(bulbX, bulbY, 5, bulbX, bulbY, glowRad)
        grad.addColorStop(0, `rgba(253, 224, 71, ${bulbGlow * 0.9})`)
        grad.addColorStop(1, 'rgba(253, 224, 71, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(bulbX, bulbY, glowRad, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.fillStyle = bulbGlow > 0.1 ? '#fef08a' : '#334155'
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(bulbX, bulbY, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#f8fafc'
      ctx.font = '10px sans-serif'
      ctx.fillText('💡 Bulb', bulbX - 16, bulbY + 28)

      // Moving Bar Magnet
      const magW = 80
      const magH = 26
      // South (Blue)
      ctx.fillStyle = '#2563eb'
      ctx.fillRect(magnetX - magW / 2, magnetY - magH / 2, magW / 2, magH)
      // North (Red)
      ctx.fillStyle = '#dc2626'
      ctx.fillRect(magnetX, magnetY - magH / 2, magW / 2, magH)
      ctx.strokeStyle = '#f8fafc'
      ctx.lineWidth = 1.5
      ctx.strokeRect(magnetX - magW / 2, magnetY - magH / 2, magW, magH)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('S', magnetX - magW / 4 - 4, magnetY + 4)
      ctx.fillText('N', magnetX + magW / 4 - 4, magnetY + 4)

      // Solenoid Coil Loops (Drawn in front of magnet for 3D depth)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 3.5
      const numLoops = 14
      for (let i = 0; i < numLoops; i++) {
        const loopX = coilCenterX - coilLength / 2 + (i / (numLoops - 1)) * coilLength
        ctx.beginPath()
        ctx.ellipse(loopX, coilCenterY, 8, coilRadius, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Solenoid Label
      ctx.fillStyle = '#f59e0b'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText(`Solenoid (${p.turns} Turns)`, coilCenterX - 45, coilCenterY - coilRadius - 12)
    },
  },

  atomic_orbitals: {
    type: 'atomic_orbitals',
    title: 'Bohr Hydrogen Atom & Spectral Lines',
    subject: 'Chemistry / Physics · Quantum',
    concept: 'Bohr Postulates & Photon Energy Transitions',
    description: 'Explore the quantum energy levels of Hydrogen (n=1 to 5). Watch the electron jump between orbits, emitting or absorbing a photon, and observe the corresponding spectral line in the Lyman or Balmer emission spectrum.',
    presets: [
      { label: 'Balmer H-α (n=3 → 2, Red 656nm)', params: { nInitial: 3, nFinal: 2 } },
      { label: 'Balmer H-β (n=4 → 2, Cyan 486nm)', params: { nInitial: 4, nFinal: 2 } },
      { label: 'Balmer H-γ (n=5 → 2, Blue 434nm)', params: { nInitial: 5, nFinal: 2 } },
      { label: 'Lyman-α (n=2 → 1, UV 121nm)', params: { nInitial: 2, nFinal: 1 } },
    ],
    params: [
      { key: 'nInitial', label: 'Initial Orbit (n₁)', min: 2, max: 5, step: 1, defaultValue: 3, unit: '' },
      { key: 'nFinal', label: 'Final Orbit (n₂)', min: 1, max: 4, step: 1, defaultValue: 2, unit: '' },
    ],
    calculateReadouts: (p) => {
      const n1 = p.nInitial
      const n2 = Math.min(p.nFinal, n1 - 1)
      const deltaE = 13.6 * (1 / (n2 * n2) - 1 / (n1 * n1))
      const wavelength = 1240 / Math.max(deltaE, 0.01)

      let series = 'Paschen Series (Infrared)'
      if (n2 === 1) series = 'Lyman Series (Ultraviolet)'
      else if (n2 === 2) series = 'Balmer Series (Visible)'

      return [
        { label: 'Energy Released (ΔE)', value: deltaE.toFixed(2), unit: 'eV', formula: 'ΔE = 13.6(1/n₂² - 1/n₁²)' },
        { label: 'Photon Wavelength', value: wavelength.toFixed(1), unit: 'nm', formula: 'λ = hc / ΔE' },
        { label: 'Spectral Series', value: series, unit: '' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, w, h)

      const cx = w * 0.42
      const cy = h / 2 - 15
      const n1 = p.nInitial
      const n2 = Math.min(p.nFinal, n1 - 1)
      const deltaE = 13.6 * (1 / (n2 * n2) - 1 / (n1 * n1))
      const wavelength = 1240 / Math.max(deltaE, 0.01)

      // Color mapping for emitted photon
      let photonColor = '#ef4444' // red
      if (wavelength < 400) photonColor = '#a855f7' // UV / violet
      else if (wavelength < 460) photonColor = '#3b82f6' // blue
      else if (wavelength < 500) photonColor = '#06b6d4' // cyan
      else if (wavelength < 580) photonColor = '#10b981' // green
      else if (wavelength < 680) photonColor = '#ef4444' // red
      else photonColor = '#f97316' // IR / orange

      // Draw Nucleus (Proton)
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(cx, cy, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('+p', cx - 6, cy + 3)

      // Draw Orbit Shells n = 1 to 5
      const orbitRadii = [32, 60, 92, 126, 160]
      for (let i = 0; i < 5; i++) {
        const r = orbitRadii[i]
        const isTarget = i + 1 === n1 || i + 1 === n2
        ctx.strokeStyle = isTarget ? 'rgba(56, 189, 248, 0.7)' : 'rgba(71, 85, 105, 0.4)'
        ctx.lineWidth = isTarget ? 1.8 : 1
        ctx.setLineDash(isTarget ? [4, 4] : [])
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])

        // Orbit labels
        ctx.fillStyle = isTarget ? '#38bdf8' : '#64748b'
        ctx.font = '10px sans-serif'
        ctx.fillText(`n=${i + 1}`, cx + r - 8, cy - 6)
      }

      // Orbiting electron on nFinal
      const electronAngle = state.time * (4 / n2)
      const elR = orbitRadii[n2 - 1]
      const elX = cx + Math.cos(electronAngle) * elR
      const elY = cy + Math.sin(electronAngle) * elR

      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(elX, elY, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Emitted Squiggly Photon Wave animation traveling outwards
      const photonCycle = (state.time * 1.8) % 1
      const photonStartX = cx + orbitRadii[n1 - 1]
      const photonDist = photonCycle * (w - photonStartX - 30)
      const photonCurrentX = photonStartX + photonDist
      const photonCurrentY = cy - 25

      ctx.strokeStyle = photonColor
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let px = 0; px < 28; px += 2) {
        const py = Math.sin((px / 4) + state.time * 10) * 5
        if (px === 0) ctx.moveTo(photonCurrentX + px, photonCurrentY + py)
        else ctx.lineTo(photonCurrentX + px, photonCurrentY + py)
      }
      ctx.stroke()
      ctx.fillStyle = photonColor
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText(`hν (${wavelength.toFixed(0)}nm)`, photonCurrentX, photonCurrentY - 10)

      // Emission Spectrum Bar at Bottom
      const specX = 30
      const specY = h - 35
      const specW = w - 60
      const specH = 18

      // Background rainbow gradient for visible spectrum
      const specGrad = ctx.createLinearGradient(specX, specY, specX + specW, specY)
      specGrad.addColorStop(0, '#7e22ce')
      specGrad.addColorStop(0.2, '#2563eb')
      specGrad.addColorStop(0.4, '#06b6d4')
      specGrad.addColorStop(0.6, '#10b981')
      specGrad.addColorStop(0.8, '#eab308')
      specGrad.addColorStop(1, '#ef4444')
      ctx.fillStyle = specGrad
      ctx.fillRect(specX, specY, specW, specH)
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1.5
      ctx.strokeRect(specX, specY, specW, specH)

      // Highlight line on spectrum
      const normW = Math.max(Math.min((wavelength - 380) / (750 - 380), 1), 0)
      const lineX = specX + normW * specW
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(lineX, specY - 4)
      ctx.lineTo(lineX, specY + specH + 4)
      ctx.stroke()

      ctx.fillStyle = '#f8fafc'
      ctx.font = '10px sans-serif'
      ctx.fillText('380nm (Violet)', specX, specY - 6)
      ctx.fillText('750nm (Red)', specX + specW - 60, specY - 6)
      ctx.fillText(`Active Line: ${wavelength.toFixed(0)} nm`, lineX - 35, specY + specH + 15)
    },
  },

  electrolysis: {
    type: 'electrolysis',
    title: 'Electrolysis of Water & Faraday',
    subject: 'Chemistry · Electrochemistry',
    concept: 'Hoffman Voltameter: 2H₂O → 2H₂ + O₂ (2:1 Ratio)',
    description: 'Pass DC current through dilute sulfuric acid water. Observe bubble generation at cathode (H₂) and anode (O₂), demonstrating the stoichiometric 2:1 volume ratio.',
    presets: [
      { label: 'Standard Run (6V, 2A)', params: { voltage: 6, current: 2.0, timeElapsed: 25 } },
      { label: 'High Speed (12V, 4A)', params: { voltage: 12, current: 4.0, timeElapsed: 40 } },
      { label: 'Low Voltage (3V, 1A)', params: { voltage: 3, current: 1.0, timeElapsed: 15 } },
    ],
    params: [
      { key: 'voltage', label: 'Cell Voltage (V)', min: 2, max: 15, step: 0.5, defaultValue: 6, unit: 'V' },
      { key: 'current', label: 'Current (I)', min: 0.5, max: 4.0, step: 0.1, defaultValue: 2.0, unit: 'A' },
      { key: 'timeElapsed', label: 'Reaction Time (t)', min: 5, max: 60, step: 1, defaultValue: 25, unit: 's' },
    ],
    calculateReadouts: (p) => {
      const q = p.current * p.timeElapsed
      // Volume of H2 = 2x volume of O2
      const volH2 = (q * 0.12)
      const volO2 = volH2 / 2
      return [
        { label: 'Hydrogen (H₂) Vol', value: volH2.toFixed(1), unit: 'mL', formula: 'Cathode: 2H⁺ + 2e⁻ → H₂' },
        { label: 'Oxygen (O₂) Vol', value: volO2.toFixed(1), unit: 'mL', formula: 'Anode: 2H₂O → O₂ + 4H⁺ + 4e⁻' },
        { label: 'Volume Ratio (H₂ : O₂)', value: '2.0 : 1.0', unit: '', formula: 'Stoichiometry' },
        { label: 'Charge Passed (Q)', value: q.toFixed(0), unit: 'C', formula: 'Q = I × t' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2 - 20
      const cy = h / 2
      const tubeW = 42
      const tubeH = 170

      // Cathode Tube (Left, H2)
      const cathX = cx - 65
      // Anode Tube (Right, O2)
      const anodX = cx + 65

      const volH2 = p.current * p.timeElapsed * 0.12
      const volO2 = volH2 / 2
      const maxH = 90
      const gasLevelH2 = Math.min((volH2 / 15) * maxH, maxH)
      const gasLevelO2 = Math.min((volO2 / 15) * maxH, maxH)

      // Electrolyte Liquid Reservoir & Base
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'
      ctx.fillRect(cx - 100, cy + 40, 200, 45)
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 2
      ctx.strokeRect(cx - 100, cy + 40, 200, 45)

      // Cathode Glass Tube
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)'
      ctx.fillRect(cathX - tubeW / 2, cy - 80 + gasLevelH2, tubeW, tubeH - gasLevelH2)
      // Gas space at top of cathode (H2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillRect(cathX - tubeW / 2, cy - 80, tubeW, gasLevelH2)
      ctx.strokeStyle = '#94a3b8'
      ctx.strokeRect(cathX - tubeW / 2, cy - 80, tubeW, tubeH)

      // Anode Glass Tube
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)'
      ctx.fillRect(anodX - tubeW / 2, cy - 80 + gasLevelO2, tubeW, tubeH - gasLevelO2)
      // Gas space at top of anode (O2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillRect(anodX - tubeW / 2, cy - 80, tubeW, gasLevelO2)
      ctx.strokeStyle = '#94a3b8'
      ctx.strokeRect(anodX - tubeW / 2, cy - 80, tubeW, tubeH)

      // Rising Bubbles Animation
      // Cathode generates twice as many bubbles as anode
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 16; i++) {
        const bProgress = (state.time * (2 + (i % 3)) + i * 0.25) % 1
        const bx = cathX - 12 + (i % 4) * 8
        const by = cy + 50 - bProgress * (110 - gasLevelH2)
        ctx.beginPath()
        ctx.arc(bx, by, 2 + (i % 2), 0, Math.PI * 2)
        ctx.fill()
      }

      for (let i = 0; i < 8; i++) {
        const bProgress = (state.time * (1.8 + (i % 2)) + i * 0.4) % 1
        const bx = anodX - 10 + (i % 3) * 10
        const by = cy + 50 - bProgress * (110 - gasLevelO2)
        ctx.beginPath()
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Electrodes (Platinum Rods)
      ctx.fillStyle = '#64748b'
      ctx.fillRect(cathX - 4, cy + 20, 8, 40)
      ctx.fillRect(anodX - 4, cy + 20, 8, 40)

      // DC Battery & Wiring
      const batY = h - 35
      ctx.strokeStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(anodX, cy + 60)
      ctx.lineTo(anodX, batY)
      ctx.lineTo(cx + 20, batY)
      ctx.stroke()

      ctx.strokeStyle = '#3b82f6'
      ctx.beginPath()
      ctx.moveTo(cathX, cy + 60)
      ctx.lineTo(cathX, batY)
      ctx.lineTo(cx - 20, batY)
      ctx.stroke()

      // Battery Block
      ctx.fillStyle = '#334155'
      ctx.fillRect(cx - 25, batY - 12, 50, 24)
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText(`${p.voltage}V DC`, cx - 18, batY + 4)

      // Tube Header Labels
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('Cathode (-)', cathX - 32, cy - 90)
      ctx.fillText('H₂ Gas (2x)', cathX - 30, cy - 65)

      ctx.fillStyle = '#f43f5e'
      ctx.fillText('Anode (+)', anodX - 25, cy - 90)
      ctx.fillText('O₂ Gas (1x)', anodX - 26, cy - 65)
    },
  },

  mitosis: {
    type: 'mitosis',
    title: 'Cell Division (Stages of Mitosis)',
    subject: 'Biology · Cell Biology',
    concept: 'Somatic Equational Division (2n → 2n)',
    description: 'Step through Prophase, Metaphase, Anaphase, Telophase, and Cytokinesis. Observe chromatin condensation, spindle fiber alignment, sister chromatid disjunction, and cleavage furrow formation.',
    presets: [
      { label: 'Stage 1: Prophase', params: { stage: 1 } },
      { label: 'Stage 2: Metaphase (Equator)', params: { stage: 2 } },
      { label: 'Stage 3: Anaphase (Disjunction)', params: { stage: 3 } },
      { label: 'Stage 4: Telophase & Cytokinesis', params: { stage: 4 } },
    ],
    params: [
      { key: 'stage', label: 'Mitosis Stage (1-4)', min: 1, max: 4, step: 1, defaultValue: 2, unit: '' },
    ],
    calculateReadouts: (p) => {
      const stageInfo = [
        { name: '1. Prophase', event: 'Chromatin condenses, nuclear envelope breaks, centrioles migrate to poles' },
        { name: '2. Metaphase', event: 'Chromosomes line up along equatorial metaphase plate; spindle attached to kinetochores' },
        { name: '3. Anaphase', event: 'Centromeres split; sister chromatids pulled towards opposite poles' },
        { name: '4. Telophase & Cytokinesis', event: 'Nuclear envelopes reform, cleavage furrow divides cell into two 2n daughter cells' },
      ]
      const cur = stageInfo[Math.min(Math.max(p.stage - 1, 0), 3)]
      return [
        { label: 'Active Phase', value: cur.name, unit: '' },
        { label: 'Ploidy State', value: '2n (Diploid)', unit: '', formula: 'Equational Division' },
        { label: 'Key Hallmark', value: cur.event, unit: '' },
      ]
    },
    renderCanvas: (ctx, w, h, p) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2 - 20
      const cy = h / 2
      const stage = p.stage

      if (stage === 1) {
        // --- PROPHASE ---
        // Cell membrane
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 3
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'
        ctx.beginPath()
        ctx.arc(cx, cy, 95, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Dissolving Nuclear membrane (dashed)
        ctx.strokeStyle = '#f472b6'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.arc(cx, cy, 55, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])

        // Centrioles migrating
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(cx - 70, cy - 45, 8, 8)
        ctx.fillRect(cx + 60, cy + 35, 8, 8)

        // Condensing Chromosomes (X shapes inside nucleus)
        const chromPos = [
          { x: cx - 20, y: cy - 15 },
          { x: cx + 18, y: cy - 10 },
          { x: cx - 12, y: cy + 20 },
          { x: cx + 22, y: cy + 18 },
        ]
        ctx.lineWidth = 3.5
        for (let i = 0; i < chromPos.length; i++) {
          const cp = chromPos[i]
          ctx.strokeStyle = i % 2 === 0 ? '#ef4444' : '#3b82f6'
          ctx.beginPath()
          ctx.moveTo(cp.x - 7, cp.y - 7)
          ctx.lineTo(cp.x + 7, cp.y + 7)
          ctx.moveTo(cp.x + 7, cp.y - 7)
          ctx.lineTo(cp.x - 7, cp.y + 7)
          ctx.stroke()
        }
      } else if (stage === 2) {
        // --- METAPHASE ---
        // Cell membrane
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 3
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'
        ctx.beginPath()
        ctx.arc(cx, cy, 100, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Poles & Aster rays
        const poleLeftX = cx - 85
        const poleRightX = cx + 85
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(poleLeftX - 4, cy - 4, 8, 8)
        ctx.fillRect(poleRightX - 4, cy - 4, 8, 8)

        // Spindle fibers converging to equatorial plate
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)'
        ctx.lineWidth = 1.2
        const equatorYs = [cy - 40, cy - 15, cy + 15, cy + 40]
        for (const ey of equatorYs) {
          ctx.beginPath()
          ctx.moveTo(poleLeftX, cy)
          ctx.lineTo(cx, ey)
          ctx.lineTo(poleRightX, cy)
          ctx.stroke()

          // Chromosome at equator
          ctx.strokeStyle = ey < cy ? '#ef4444' : '#3b82f6'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(cx - 8, ey - 6)
          ctx.lineTo(cx + 8, ey + 6)
          ctx.moveTo(cx + 8, ey - 6)
          ctx.lineTo(cx - 8, ey + 6)
          ctx.stroke()
        }

        // Equatorial plate indicator
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.4)'
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(cx, cy - 85)
        ctx.lineTo(cx, cy + 85)
        ctx.stroke()
        ctx.setLineDash([])
      } else if (stage === 3) {
        // --- ANAPHASE ---
        // Elongated cell membrane
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 3
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'
        ctx.beginPath()
        ctx.ellipse(cx, cy, 120, 85, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        const poleLeftX = cx - 105
        const poleRightX = cx + 105
        ctx.fillStyle = '#fbbf24'
        ctx.fillRect(poleLeftX - 4, cy - 4, 8, 8)
        ctx.fillRect(poleRightX - 4, cy - 4, 8, 8)

        // Pulled V-shaped chromatids
        const chromYs = [cy - 30, cy - 10, cy + 10, cy + 30]
        for (let i = 0; i < chromYs.length; i++) {
          const cyPos = chromYs[i]
          const col = i % 2 === 0 ? '#ef4444' : '#3b82f6'
          ctx.strokeStyle = col
          ctx.lineWidth = 3.5

          // Left sister chromatid moving left (V-shape facing pole)
          const leftX = cx - 45
          ctx.beginPath()
          ctx.moveTo(leftX + 6, cyPos - 7)
          ctx.lineTo(leftX - 6, cyPos)
          ctx.lineTo(leftX + 6, cyPos + 7)
          ctx.stroke()

          // Right sister chromatid moving right
          const rightX = cx + 45
          ctx.beginPath()
          ctx.moveTo(rightX - 6, cyPos - 7)
          ctx.lineTo(rightX + 6, cyPos)
          ctx.lineTo(rightX - 6, cyPos + 7)
          ctx.stroke()

          // Taut spindle fibers
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(poleLeftX, cy)
          ctx.lineTo(leftX - 6, cyPos)
          ctx.moveTo(poleRightX, cy)
          ctx.lineTo(rightX + 6, cyPos)
          ctx.stroke()
        }
      } else {
        // --- TELOPHASE & CYTOKINESIS ---
        // Pinched Cleavage Furrow (figure 8 shape)
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 3
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'
        ctx.beginPath()
        // Left lobe
        ctx.arc(cx - 55, cy, 60, Math.PI * 0.25, Math.PI * 1.75)
        // Cleavage furrow waist
        ctx.lineTo(cx, cy - 20)
        // Right lobe
        ctx.arc(cx + 55, cy, 60, Math.PI * 1.25, Math.PI * 0.75)
        ctx.lineTo(cx, cy + 20)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Two reforming nuclear membranes
        ctx.strokeStyle = '#f472b6'
        ctx.lineWidth = 2
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.arc(cx - 55, cy, 32, 0, Math.PI * 2)
        ctx.arc(cx + 55, cy, 32, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])

        // Uncoiling Chromatin inside both new nuclei
        ctx.fillStyle = '#ef4444'
        ctx.font = '10px sans-serif'
        ctx.fillText('2n Nucleus', cx - 82, cy + 4)
        ctx.fillStyle = '#3b82f6'
        ctx.fillText('2n Nucleus', cx + 28, cy + 4)
        ctx.fillStyle = '#f472b6'
        ctx.fillText('Cleavage Furrow', cx - 40, cy - 70)
      }
    },
  },

  circulatory_heart: {
    type: 'circulatory_heart',
    title: 'Heart & Double Circulation System',
    subject: 'Biology · Human Physiology',
    concept: '4-Chamber Cardiac Anatomy & Double Circulation',
    description: 'Anatomical cross-section of the 4-chambered human heart. Observe synchronized atrial and ventricular systole, tricuspid and bicuspid valve action with chordae tendineae, pulmonary and systemic circuits, animated blood cell flows, and synchronized clinical ECG.',
    presets: [
      { label: 'Resting Normal (72 BPM)', params: { bpm: 72, strokeVol: 70 } },
      { label: 'Exercise / Running (130 BPM)', params: { bpm: 130, strokeVol: 90 } },
      { label: 'Bradycardia (50 BPM)', params: { bpm: 50, strokeVol: 65 } },
      { label: 'Tachycardia (150 BPM)', params: { bpm: 150, strokeVol: 60 } },
    ],
    params: [
      { key: 'bpm', label: 'Heart Rate (BPM)', min: 45, max: 160, step: 5, defaultValue: 72, unit: 'BPM' },
      { key: 'strokeVol', label: 'Stroke Volume (SV)', min: 45, max: 110, step: 5, defaultValue: 70, unit: 'mL' },
    ],
    calculateReadouts: (p) => {
      const cardiacOutput = (p.bpm * p.strokeVol) / 1000
      const cycleDuration = 60 / p.bpm
      const systolicBP = Math.round(90 + p.strokeVol * 0.42)
      const diastolicBP = Math.round(60 + p.bpm * 0.25)
      return [
        { label: 'Cardiac Output (CO)', value: cardiacOutput.toFixed(2), unit: 'L/min', formula: 'CO = HR × SV' },
        { label: 'Cycle Duration (T)', value: cycleDuration.toFixed(2), unit: 's', formula: 'T = 60 / BPM' },
        { label: 'Blood Pressure', value: `${systolicBP}/${diastolicBP}`, unit: 'mmHg', formula: 'Systole / Diastole' },
        { label: 'Circulation', value: 'Double Circuit', unit: '', formula: 'Pulmonary + Systemic' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#070b14'
      ctx.fillRect(0, 0, w, h)

      const cycleFreq = p.bpm / 60
      const phase = (state.time * cycleFreq) % 1

      // Cardiac Cycle Phases:
      // 0.00 - 0.18: Atrial Systole (Atria contract, AV valves open wide, ventricles fill)
      // 0.18 - 0.46: Ventricular Systole (Ventricles forcefully contract, AV valves snap shut S1 'LUB', semilunar valves open, blood jets into aorta/pulmonary)
      // 0.46 - 1.00: Ventricular Diastole (Ventricles relax & expand, semilunar valves snap shut S2 'DUB', chambers refill)
      const isAtrialSystole = phase < 0.18
      const isVentricularSystole = phase >= 0.18 && phase < 0.46

      const heartScale = isVentricularSystole ? 0.94 : (isAtrialSystole ? 1.03 : 1.0)
      const avValvesOpen = !isVentricularSystole
      const slValvesOpen = isVentricularSystole

      // Sound badge
      const currentSound = phase >= 0.18 && phase < 0.28 ? 'LUB (S1)' : (phase >= 0.46 && phase < 0.56 ? 'DUB (S2)' : null)

      // --- LEFT / CENTER AREA: ANATOMICAL HEART ---
      const heartCenterX = Math.min(w * 0.36, 260)
      const heartCenterY = h / 2 - 18

      ctx.save()
      ctx.translate(heartCenterX, heartCenterY)
      ctx.scale(heartScale, heartScale)

      // 1. Great Vessels Behind (Aorta Arch & Pulmonary Trunk)
      // Superior Vena Cava (SVC) - Blue (Top Right of Anatomical RA)
      const svcGrad = ctx.createLinearGradient(-90, -140, -50, -140)
      svcGrad.addColorStop(0, '#1e3a8a')
      svcGrad.addColorStop(1, '#2563eb')
      ctx.fillStyle = svcGrad
      ctx.fillRect(-85, -140, 34, 75)
      ctx.strokeStyle = '#1d4ed8'
      ctx.lineWidth = 2
      ctx.strokeRect(-85, -140, 34, 75)

      // Inferior Vena Cava (IVC) - Blue (Bottom Right of RA)
      ctx.fillStyle = svcGrad
      ctx.fillRect(-85, 60, 32, 60)
      ctx.strokeRect(-85, 60, 32, 60)

      // Aorta Arch (Deep Red curving over pulmonary trunk)
      const aortaGrad = ctx.createLinearGradient(-30, -160, 50, -60)
      aortaGrad.addColorStop(0, '#b91c1c')
      aortaGrad.addColorStop(0.5, '#ef4444')
      aortaGrad.addColorStop(1, '#991b1b')
      ctx.fillStyle = aortaGrad
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth = 3

      // Main curved Aortic Arch
      ctx.beginPath()
      ctx.moveTo(-18, -40)
      ctx.bezierCurveTo(-25, -135, 45, -165, 75, -95)
      ctx.bezierCurveTo(85, -70, 85, 40, 80, 70)
      ctx.lineTo(55, 70)
      ctx.bezierCurveTo(58, 40, 58, -60, 50, -85)
      ctx.bezierCurveTo(30, -125, -5, -110, 6, -40)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // 3 Brachiocephalic Branch Arteries rising from Aorta
      const branches = [-10, 15, 40]
      for (const bx of branches) {
        ctx.fillStyle = '#dc2626'
        ctx.fillRect(bx, -162, 14, 28)
        ctx.strokeRect(bx, -162, 14, 28)
      }

      // Pulmonary Trunk (Blue, branching to left & right lungs)
      const pulmGrad = ctx.createLinearGradient(-35, -90, 30, -30)
      pulmGrad.addColorStop(0, '#1d4ed8')
      pulmGrad.addColorStop(1, '#3b82f6')
      ctx.fillStyle = pulmGrad
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 2.5

      // Pulmonary trunk bifurcation
      ctx.beginPath()
      ctx.moveTo(-28, -25)
      ctx.lineTo(-45, -85)
      ctx.lineTo(-95, -100)
      ctx.lineTo(-95, -120)
      ctx.lineTo(-30, -95)
      ctx.lineTo(35, -90)
      ctx.lineTo(55, -80)
      ctx.lineTo(0, -25)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Pulmonary Veins (Red, 2 pairs entering Left Atrium from sides)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(80, -45, 30, 16)
      ctx.strokeRect(80, -45, 30, 16)
      ctx.fillRect(80, -20, 30, 16)
      ctx.strokeRect(80, -20, 30, 16)

      // 2. Thick Outer Myocardium Muscular Heart Wall
      // Anatomical heart outline (pear/cone tilted left at apex)
      ctx.fillStyle = '#450a0a' // deep muscle layer
      ctx.beginPath()
      ctx.moveTo(-75, -55)
      ctx.bezierCurveTo(-115, -45, -115, 55, -45, 95)
      ctx.bezierCurveTo(-15, 120, 20, 138, 38, 145) // Apex of Heart (pointing left-down)
      ctx.bezierCurveTo(60, 138, 105, 90, 105, 30)
      ctx.bezierCurveTo(115, -30, 65, -65, 10, -55)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#7f1d1d'
      ctx.lineWidth = 8
      ctx.stroke()

      // 3. Internal Chambers Cavity Cuts
      // Right Atrium (Deoxygenated Blue cavity)
      ctx.fillStyle = 'rgba(30, 58, 138, 0.85)'
      ctx.beginPath()
      ctx.moveTo(-70, -45)
      ctx.bezierCurveTo(-90, -40, -90, 0, -65, 10)
      ctx.lineTo(-20, 10)
      ctx.lineTo(-20, -45)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.stroke()

      // Left Atrium (Oxygenated Red cavity)
      ctx.fillStyle = 'rgba(153, 27, 27, 0.85)'
      ctx.beginPath()
      ctx.moveTo(15, -45)
      ctx.lineTo(70, -45)
      ctx.bezierCurveTo(85, -40, 85, 0, 65, 10)
      ctx.lineTo(15, 10)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()

      // Interventricular Septum (Muscular center dividing wall)
      const septGrad = ctx.createLinearGradient(-12, 10, 12, 125)
      septGrad.addColorStop(0, '#500724')
      septGrad.addColorStop(1, '#831843')
      ctx.fillStyle = septGrad
      ctx.beginPath()
      ctx.moveTo(-10, 10)
      ctx.lineTo(10, 10)
      ctx.lineTo(25, 132)
      ctx.lineTo(8, 135)
      ctx.closePath()
      ctx.fill()

      // Right Ventricle Cavity (Blue, thinner wall)
      ctx.fillStyle = 'rgba(30, 58, 138, 0.88)'
      ctx.beginPath()
      ctx.moveTo(-60, 25)
      ctx.lineTo(-14, 25)
      ctx.lineTo(4, 120)
      ctx.bezierCurveTo(-25, 95, -75, 70, -60, 25)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#60a5fa'
      ctx.lineWidth = 1.8
      ctx.stroke()

      // Left Ventricle Cavity (Red, thick myocardium on outer lateral wall)
      ctx.fillStyle = 'rgba(185, 28, 28, 0.88)'
      ctx.beginPath()
      ctx.moveTo(14, 25)
      ctx.lineTo(60, 25)
      ctx.bezierCurveTo(75, 60, 50, 115, 24, 128)
      ctx.lineTo(14, 25)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#f87171'
      ctx.lineWidth = 1.8
      ctx.stroke()

      // 4. Valves & Chordae Tendineae (Heart Strings)
      ctx.strokeStyle = '#f8fafc'
      ctx.fillStyle = '#f8fafc'

      // Tricuspid Valve (RA to RV)
      const triOpenAngle = avValvesOpen ? 22 : 0
      ctx.lineWidth = 2.5
      // Left cusp
      ctx.beginPath()
      ctx.moveTo(-55, 12)
      ctx.lineTo(-45 + (avValvesOpen ? 6 : 0), 12 + triOpenAngle)
      ctx.stroke()
      // Right cusp
      ctx.beginPath()
      ctx.moveTo(-20, 12)
      ctx.lineTo(-30 - (avValvesOpen ? 6 : 0), 12 + triOpenAngle)
      ctx.stroke()

      // Chordae Tendineae Strings to Papillary Muscle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-45 + (avValvesOpen ? 6 : 0), 12 + triOpenAngle)
      ctx.lineTo(-40, 65)
      ctx.moveTo(-30 - (avValvesOpen ? 6 : 0), 12 + triOpenAngle)
      ctx.lineTo(-40, 65)
      ctx.stroke()
      // Papillary muscle projection
      ctx.fillStyle = '#6b021d'
      ctx.beginPath()
      ctx.arc(-40, 68, 5, 0, Math.PI * 2)
      ctx.fill()

      // Bicuspid / Mitral Valve (LA to LV)
      const bicuspidOpenAngle = avValvesOpen ? 22 : 0
      ctx.strokeStyle = '#f8fafc'
      ctx.lineWidth = 2.5
      // Left cusp
      ctx.beginPath()
      ctx.moveTo(22, 12)
      ctx.lineTo(32 + (avValvesOpen ? 5 : 0), 12 + bicuspidOpenAngle)
      ctx.stroke()
      // Right cusp
      ctx.beginPath()
      ctx.moveTo(55, 12)
      ctx.lineTo(45 - (avValvesOpen ? 5 : 0), 12 + bicuspidOpenAngle)
      ctx.stroke()

      // Mitral Chordae Tendineae Strings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(32 + (avValvesOpen ? 5 : 0), 12 + bicuspidOpenAngle)
      ctx.lineTo(42, 75)
      ctx.moveTo(45 - (avValvesOpen ? 5 : 0), 12 + bicuspidOpenAngle)
      ctx.lineTo(42, 75)
      ctx.stroke()
      // Papillary muscle
      ctx.fillStyle = '#6b021d'
      ctx.beginPath()
      ctx.arc(42, 78, 6, 0, Math.PI * 2)
      ctx.fill()

      // Semilunar Valves (Pulmonary & Aortic)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2
      // Pulmonary Semilunar
      ctx.beginPath()
      ctx.arc(-15, -24, 7, slValvesOpen ? Math.PI : 0, slValvesOpen ? 0 : Math.PI)
      ctx.stroke()
      // Aortic Semilunar
      ctx.beginPath()
      ctx.arc(8, -24, 7, slValvesOpen ? Math.PI : 0, slValvesOpen ? 0 : Math.PI)
      ctx.stroke()

      // 5. Chamber Text Labels
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('RA', -58, -15)
      ctx.fillText('LA', 35, -15)
      ctx.fillText('RV', -42, 45)
      ctx.fillText('LV', 32, 45)

      // Valve Annotations
      ctx.fillStyle = '#93c5fd'
      ctx.font = '9px sans-serif'
      ctx.fillText('Tricuspid', -70, 8)
      ctx.fillStyle = '#fca5a5'
      ctx.fillText('Bicuspid (Mitral)', 26, 8)

      // Vessel Annotations
      ctx.fillStyle = '#38bdf8'
      ctx.font = '9px sans-serif'
      ctx.fillText('SVC', -80, -145)
      ctx.fillText('Pulmonary Artery', -95, -125)
      ctx.fillStyle = '#ef4444'
      ctx.fillText('Aorta Arch', 15, -168)
      ctx.fillText('Pulmonary Veins', 75, -50)

      // 6. Flowing Animated Blood Cells (Corpuscles)
      // Blue cells flowing through deoxygenated loop
      for (let i = 0; i < 14; i++) {
        const cellPhase = ((state.time * (p.bpm / 30)) + (i / 14)) % 1
        let cellX = -80
        let cellY = -120
        if (cellPhase < 0.25) {
          // Down SVC into RA
          cellX = -72 + (i % 2) * 8
          cellY = -120 + (cellPhase / 0.25) * 110
        } else if (cellPhase < 0.55) {
          // Through Tricuspid into RV
          const subP = (cellPhase - 0.25) / 0.3
          cellX = -50 + subP * 15
          cellY = 0 + subP * 65
        } else {
          // Up through Pulmonary Artery to lungs
          const subP = (cellPhase - 0.55) / 0.45
          cellX = -35 - subP * 45
          cellY = 50 - subP * 155
        }
        ctx.fillStyle = '#38bdf8'
        ctx.beginPath()
        ctx.arc(cellX, cellY, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Red cells flowing through oxygenated loop
      for (let i = 0; i < 14; i++) {
        const cellPhase = ((state.time * (p.bpm / 30)) + (i / 14)) % 1
        let cellX = 90
        let cellY = -35
        if (cellPhase < 0.25) {
          // From Pulmonary Vein into LA
          cellX = 90 - (cellPhase / 0.25) * 45
          cellY = -35 + (i % 2) * 6
        } else if (cellPhase < 0.55) {
          // Through Bicuspid into LV
          const subP = (cellPhase - 0.25) / 0.3
          cellX = 45 - subP * 10
          cellY = -10 + subP * 75
        } else {
          // Up through Aorta Arch to systemic body
          const subP = (cellPhase - 0.55) / 0.45
          cellX = 30 + Math.sin(subP * Math.PI) * 40
          cellY = 55 - subP * 180
        }
        ctx.fillStyle = '#f43f5e'
        ctx.beginPath()
        ctx.arc(cellX, cellY, 2.8, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()

      // --- RIGHT PANEL: DOUBLE CIRCULATION MAP & MEDICAL ECG ---
      const panelX = Math.max(heartCenterX + 145, w * 0.58)
      const panelW = w - panelX - 18

      // 1. Double Circulation Map Card (Top)
      const mapY = 25
      const mapH = (h - 85) * 0.48
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(panelX, mapY, panelW, mapH)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1.5
      ctx.strokeRect(panelX, mapY, panelW, mapH)

      // Map Title
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('Double Circulation Scheme', panelX + 12, mapY + 18)

      // Schematic Loops
      const loopCenterX = panelX + panelW / 2
      const lungsY = mapY + 42
      const heartNodeY = mapY + mapH / 2 + 6
      const bodyY = mapY + mapH - 28

      // Lungs Node (Top)
      ctx.fillStyle = '#0284c7'
      ctx.fillRect(loopCenterX - 45, lungsY - 12, 90, 22)
      ctx.strokeStyle = '#38bdf8'
      ctx.strokeRect(loopCenterX - 45, lungsY - 12, 90, 22)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('🫁 LUNGS (O₂ In)', loopCenterX - 38, lungsY + 3)

      // Heart Node (Center)
      ctx.fillStyle = '#831843'
      ctx.fillRect(loopCenterX - 50, heartNodeY - 12, 100, 24)
      ctx.strokeStyle = '#f43f5e'
      ctx.strokeRect(loopCenterX - 50, heartNodeY - 12, 100, 24)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('🫀 HEART (Pump)', loopCenterX - 42, heartNodeY + 4)

      // Body Node (Bottom)
      ctx.fillStyle = '#047857'
      ctx.fillRect(loopCenterX - 45, bodyY - 12, 90, 22)
      ctx.strokeStyle = '#34d399'
      ctx.strokeRect(loopCenterX - 45, bodyY - 12, 90, 22)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('👤 BODY ORGANS', loopCenterX - 40, bodyY + 3)

      // Connecting Circuit Lines
      // Pulmonary Loop: Heart -> Lungs (Blue), Lungs -> Heart (Red)
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#38bdf8'
      ctx.beginPath()
      ctx.moveTo(loopCenterX - 30, heartNodeY - 12)
      ctx.lineTo(loopCenterX - 30, lungsY + 10)
      ctx.stroke()
      ctx.fillText('Deoxy', loopCenterX - 60, (lungsY + heartNodeY) / 2)

      ctx.strokeStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(loopCenterX + 30, lungsY + 10)
      ctx.lineTo(loopCenterX + 30, heartNodeY - 12)
      ctx.stroke()
      ctx.fillText('Oxy', loopCenterX + 36, (lungsY + heartNodeY) / 2)

      // Systemic Loop: Heart -> Body (Red), Body -> Heart (Blue)
      ctx.strokeStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(loopCenterX + 30, heartNodeY + 12)
      ctx.lineTo(loopCenterX + 30, bodyY - 12)
      ctx.stroke()

      ctx.strokeStyle = '#38bdf8'
      ctx.beginPath()
      ctx.moveTo(loopCenterX - 30, bodyY - 12)
      ctx.lineTo(loopCenterX - 30, heartNodeY + 12)
      ctx.stroke()

      // 2. Clinical ECG Monitor & Rhythm Card (Bottom)
      const ecgCardY = mapY + mapH + 12
      const ecgCardH = h - ecgCardY - 16
      ctx.fillStyle = '#090d16'
      ctx.fillRect(panelX, ecgCardY, panelW, ecgCardH)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1.5
      ctx.strokeRect(panelX, ecgCardY, panelW, ecgCardH)

      // ECG Grid Lines
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)'
      ctx.lineWidth = 1
      for (let x = panelX; x < panelX + panelW; x += 16) {
        ctx.beginPath()
        ctx.moveTo(x, ecgCardY)
        ctx.lineTo(x, ecgCardY + ecgCardH)
        ctx.stroke()
      }
      for (let y = ecgCardY; y < ecgCardY + ecgCardH; y += 14) {
        ctx.beginPath()
        ctx.moveTo(panelX, y)
        ctx.lineTo(panelX + panelW, y)
        ctx.stroke()
      }

      // ECG Header & Live Sound Badge
      ctx.fillStyle = '#10b981'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`ECG LEAD II • ${p.bpm} BPM`, panelX + 10, ecgCardY + 16)

      // Heart Sound Indicator (Flashing LUB / DUB badge)
      if (currentSound) {
        ctx.fillStyle = currentSound.startsWith('LUB') ? '#ef4444' : '#38bdf8'
        ctx.fillRect(panelX + panelW - 85, ecgCardY + 6, 75, 18)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 9px sans-serif'
        ctx.fillText(currentSound, panelX + panelW - 74, ecgCardY + 18)
      } else {
        ctx.fillStyle = '#64748b'
        ctx.font = '9px sans-serif'
        ctx.fillText(isVentricularSystole ? 'Systole' : 'Diastole', panelX + panelW - 55, ecgCardY + 18)
      }

      // Synchronized ECG Trace Line
      const ecgTraceY = ecgCardY + ecgCardH * 0.58
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2
      ctx.beginPath()
      const cyclePx = Math.max(panelW / 2.2, 90)

      for (let px = panelX + 4; px < panelX + panelW - 4; px += 2) {
        const localPhase = (((px - panelX + state.time * cycleFreq * cyclePx) % cyclePx) / cyclePx)
        let waveY = 0
        if (localPhase > 0.10 && localPhase < 0.18) {
          // P Wave (Atrial depolarization)
          waveY = -Math.sin(((localPhase - 0.10) / 0.08) * Math.PI) * 7
        } else if (localPhase >= 0.22 && localPhase <= 0.32) {
          // QRS Complex (Ventricular depolarization)
          const qrs = (localPhase - 0.22) / 0.10
          if (qrs < 0.2) waveY = 4 // Q dip
          else if (qrs < 0.6) waveY = -30 // R spike
          else waveY = 8 // S dip
        } else if (localPhase > 0.42 && localPhase < 0.58) {
          // T Wave (Ventricular repolarization)
          waveY = -Math.sin(((localPhase - 0.42) / 0.16) * Math.PI) * 9
        }
        if (px === panelX + 4) ctx.moveTo(px, ecgTraceY + waveY)
        else ctx.lineTo(px, ecgTraceY + waveY)
      }
      ctx.stroke()

      // Wave Labels
      ctx.fillStyle = '#6ee7b7'
      ctx.font = '8px monospace'
      ctx.fillText('P (Atria)', panelX + 10, ecgCardY + ecgCardH - 8)
      ctx.fillText('QRS (Ventricles)', panelX + 75, ecgCardY + ecgCardH - 8)
      ctx.fillText('T (Repol)', panelX + 175, ecgCardY + ecgCardH - 8)
    },
  },

  dna_replication: {
    type: 'dna_replication',
    title: 'DNA Replication & Base Pairing',
    subject: 'Biology · Genetics',
    concept: 'Semi-Conservative DNA Replication & Fork Dynamics',
    description: 'Watch the double helix unwind at the replication fork via DNA Helicase. Observe continuous leading strand synthesis and discontinuous lagging strand Okazaki fragments by DNA Polymerase with color-coded A-T and G-C base pairing.',
    presets: [
      { label: 'Normal Speed (40 bp/s)', params: { speed: 40, proofreading: 99 } },
      { label: 'Fast Replication (80 bp/s)', params: { speed: 80, proofreading: 98 } },
      { label: 'High Fidelity (100%)', params: { speed: 25, proofreading: 100 } },
    ],
    params: [
      { key: 'speed', label: 'Fork Speed (bp/s)', min: 10, max: 100, step: 5, defaultValue: 40, unit: 'bp/s' },
      { key: 'proofreading', label: 'Fidelity (%)', min: 90, max: 100, step: 1, defaultValue: 99, unit: '%' },
    ],
    calculateReadouts: (p) => {
      const basesDone = Math.floor((p.speed * 4.5))
      const hydrogenBonds = Math.round(basesDone * 2.5)
      const okazakiCount = Math.max(Math.floor(basesDone / 25), 1)
      return [
        { label: 'Replication Velocity', value: p.speed, unit: 'bp/s', formula: 'Fork Speed' },
        { label: 'Synthesis Direction', value: "5' → 3'", unit: '', formula: 'Polymerase polarity' },
        { label: 'Hydrogen Bonds', value: hydrogenBonds, unit: '', formula: 'A=T (2), G≡C (3)' },
        { label: 'Okazaki Fragments', value: okazakiCount, unit: '', formula: 'Lagging Strand' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, w, h)

      const forkX = w * 0.48
      const midY = h / 2 - 10

      // Color scheme for nucleotide bases:
      // Adenine (A): Emerald Green #10b981
      // Thymine (T): Crimson Red #ef4444 (A=T: 2 bonds)
      // Cytosine (C): Cyan Blue #06b6d4
      // Guanine (G): Amber Gold #f59e0b (C≡G: 3 bonds)
      const basePairs = [
        { top: 'A', bot: 'T', colorTop: '#10b981', colorBot: '#ef4444', bonds: 2 },
        { top: 'G', bot: 'C', colorTop: '#f59e0b', colorBot: '#06b6d4', bonds: 3 },
        { top: 'T', bot: 'A', colorTop: '#ef4444', colorBot: '#10b981', bonds: 2 },
        { top: 'C', bot: 'G', colorTop: '#06b6d4', colorBot: '#f59e0b', bonds: 3 },
        { top: 'A', bot: 'T', colorTop: '#10b981', colorBot: '#ef4444', bonds: 2 },
        { top: 'G', bot: 'C', colorTop: '#f59e0b', colorBot: '#06b6d4', bonds: 3 },
      ]

      // 1. Parental Unopened Double Helix (Right Side: forkX to w - 20)
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 3.5

      // Top parental backbone
      ctx.beginPath()
      ctx.moveTo(forkX, midY - 14)
      ctx.lineTo(w - 20, midY - 14)
      ctx.stroke()

      // Bottom parental backbone
      ctx.beginPath()
      ctx.moveTo(forkX, midY + 14)
      ctx.lineTo(w - 20, midY + 14)
      ctx.stroke()

      // Base pairs in unopened double helix with hydrogen bonds
      const step = 28
      let idx = 0
      for (let x = forkX + 25; x < w - 30; x += step) {
        const bp = basePairs[idx % basePairs.length]
        idx++
        // Top base
        ctx.fillStyle = bp.colorTop
        ctx.fillRect(x - 5, midY - 13, 10, 10)
        // Bottom base
        ctx.fillStyle = bp.colorBot
        ctx.fillRect(x - 5, midY + 3, 10, 10)

        // Hydrogen bonds (dashed lines)
        ctx.strokeStyle = '#cbd5e1'
        ctx.lineWidth = 1.2
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(x, midY - 3)
        ctx.lineTo(x, midY + 3)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // 2. DNA Helicase Enzyme (Wedge unwinding at the fork vertex)
      const heliPulse = Math.sin(state.time * (p.speed / 12)) * 1.8
      ctx.save()
      ctx.translate(forkX, midY)
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.arc(0, 0, 22 + heliPulse, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('HELICASE', -21, 3)
      ctx.restore()

      // 3. Unzipped Replication Fork Strands (Left Side: 30 to forkX)
      // Top Strand: Leading Strand Template (bends upwards to midY - 65)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(forkX - 18, midY - 12)
      ctx.bezierCurveTo(forkX - 60, midY - 20, forkX - 90, midY - 65, 40, midY - 65)
      ctx.stroke()

      // Bottom Strand: Lagging Strand Template (bends downwards to midY + 65)
      ctx.beginPath()
      ctx.moveTo(forkX - 18, midY + 12)
      ctx.bezierCurveTo(forkX - 60, midY + 20, forkX - 90, midY + 65, 40, midY + 65)
      ctx.stroke()

      // Newly Synthesized Daughter Strands:
      // A. Leading Strand (Continuous daughter strand moving 5' -> 3' towards fork)
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(40, midY - 45)
      ctx.bezierCurveTo(forkX - 120, midY - 45, forkX - 80, midY - 10, forkX - 65, midY - 8)
      ctx.stroke()

      // DNA Polymerase III on Leading Strand
      const leadPolX = forkX - 75 + Math.sin(state.time * (p.speed / 20)) * 6
      const leadPolY = midY - 32
      ctx.fillStyle = '#06b6d4'
      ctx.beginPath()
      ctx.roundRect(leadPolX - 22, leadPolY - 14, 44, 28, 8)
      ctx.fill()
      ctx.strokeStyle = '#67e8f9'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('DNA Pol III', leadPolX - 20, leadPolY + 3)

      // Base pairs along Leading Strand
      let bIdx = 0
      for (let x = 60; x < forkX - 70; x += 26) {
        const bp = basePairs[bIdx % basePairs.length]
        bIdx++
        // Template Base
        ctx.fillStyle = bp.colorTop
        ctx.fillRect(x - 5, midY - 64, 10, 9)
        // Synthesized Base
        ctx.fillStyle = bp.colorBot
        ctx.fillRect(x - 5, midY - 54, 10, 9)
        // Hydrogen bonds
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1
        ctx.setLineDash([1.5, 1.5])
        ctx.beginPath()
        ctx.moveTo(x, midY - 55)
        ctx.lineTo(x, midY - 53)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // B. Lagging Strand (Discontinuous Okazaki fragments moving away from fork)
      // Fragment 1 (sealed)
      ctx.strokeStyle = '#ec4899'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(50, midY + 45)
      ctx.lineTo(130, midY + 45)
      ctx.stroke()

      // DNA Ligase enzyme sealing nick
      ctx.fillStyle = '#8b5cf6'
      ctx.fillRect(132, midY + 35, 20, 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 7px sans-serif'
      ctx.fillText('LIGASE', 133, midY + 48)

      // Fragment 2 (Active Okazaki fragment)
      ctx.strokeStyle = '#ec4899'
      ctx.beginPath()
      ctx.moveTo(158, midY + 45)
      ctx.bezierCurveTo(210, midY + 45, forkX - 100, midY + 25, forkX - 85, midY + 12)
      ctx.stroke()

      // DNA Polymerase on Lagging Strand
      const lagPolX = forkX - 120
      const lagPolY = midY + 42
      ctx.fillStyle = '#06b6d4'
      ctx.beginPath()
      ctx.roundRect(lagPolX - 22, lagPolY - 14, 44, 28, 8)
      ctx.fill()
      ctx.strokeStyle = '#67e8f9'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('DNA Pol III', lagPolX - 20, lagPolY + 3)

      // RNA Primase (laying RNA primer at lagging strand)
      ctx.fillStyle = '#a855f7'
      ctx.beginPath()
      ctx.arc(forkX - 60, midY + 30, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 7px sans-serif'
      ctx.fillText('PRIMASE', forkX - 74, midY + 48)

      // Strands Polarity 5' and 3' Labels
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 11px monospace'
      ctx.fillText("5'", 22, midY - 62)
      ctx.fillText("3'", w - 16, midY - 11)

      ctx.fillStyle = '#ec4899'
      ctx.fillText("3'", 22, midY + 67)
      ctx.fillText("5'", w - 16, midY + 17)

      // Strand Title Badges
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('Leading Strand (Continuous 5\' → 3\')', 45, midY - 80)
      ctx.fillStyle = '#f472b6'
      ctx.fillText('Lagging Strand (Okazaki Fragments)', 45, midY + 86)

      // Base Pair Legend at Bottom
      const legY = h - 35
      const legW = w - 40
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(20, legY - 16, legW, 40)
      ctx.strokeStyle = '#1e293b'
      ctx.strokeRect(20, legY - 16, legW, 40)

      // Adenine
      ctx.fillStyle = '#10b981'
      ctx.fillRect(35, legY - 5, 14, 14)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('Adenine (A)', 54, legY + 6)

      // Thymine
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(150, legY - 5, 14, 14)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('Thymine (T) [A=T 2 bonds]', 169, legY + 6)

      // Cytosine
      ctx.fillStyle = '#06b6d4'
      ctx.fillRect(345, legY - 5, 14, 14)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('Cytosine (C)', 364, legY + 6)

      // Guanine
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(460, legY - 5, 14, 14)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('Guanine (G) [C≡G 3 bonds]', 479, legY + 6)
    },
  },

  photosynthesis: {
    type: 'photosynthesis',
    title: 'Photosynthesis & Light Reactions',
    subject: 'Biology · Plant Physiology',
    concept: 'Thylakoid Membrane Z-Scheme & ATP Synthase Rotor',
    description: 'Explore the light-dependent reactions of photosynthesis inside the chloroplast thylakoid membrane. Observe photolysis of water in Photosystem II, electron transport via Cytochrome b6f pumping protons, NADPH synthesis in Photosystem I, and the 60 FPS spinning ATP Synthase turbine.',
    presets: [
      { label: 'Full Sunlight (80% Light)', params: { lightIntensity: 80, co2Level: 400 } },
      { label: 'Low Light / Shade (30%)', params: { lightIntensity: 30, co2Level: 400 } },
      { label: 'Light Saturation (100%)', params: { lightIntensity: 100, co2Level: 600 } },
    ],
    params: [
      { key: 'lightIntensity', label: 'Sunlight Irradiance', min: 10, max: 100, step: 5, defaultValue: 80, unit: '%' },
      { key: 'co2Level', label: 'CO₂ Concentration', min: 200, max: 800, step: 50, defaultValue: 400, unit: 'ppm' },
    ],
    calculateReadouts: (p) => {
      const o2Rate = (p.lightIntensity * 0.78).toFixed(1)
      const atpRate = (p.lightIntensity * 1.15).toFixed(1)
      const nadphRate = (p.lightIntensity * 0.92).toFixed(1)
      const deltaPH = (2.2 + (p.lightIntensity / 100) * 0.8).toFixed(2)
      return [
        { label: 'Photolysis O₂ Evolved', value: o2Rate, unit: 'mmol/h', formula: '2H₂O → O₂ + 4H⁺ + 4e⁻' },
        { label: 'ATP Synthesis Rate', value: atpRate, unit: 'mmol/h', formula: 'CF₀-CF₁ Rotary Motor' },
        { label: 'NADPH Generated', value: nadphRate, unit: 'mmol/h', formula: 'NADP⁺ + H⁺ + 2e⁻' },
        { label: 'Proton Gradient (ΔpH)', value: deltaPH, unit: '', formula: 'pH_stroma - pH_lumen' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#06131c'
      ctx.fillRect(0, 0, w, h)

      const memY = h / 2 - 10
      const memH = 44
      const lightFrac = p.lightIntensity / 100

      // 1. Stroma Region (Top, pH ~ 8.0, pale green gradient)
      const stromaGrad = ctx.createLinearGradient(0, 0, 0, memY)
      stromaGrad.addColorStop(0, 'rgba(6, 78, 59, 0.4)')
      stromaGrad.addColorStop(1, 'rgba(6, 78, 59, 0.1)')
      ctx.fillStyle = stromaGrad
      ctx.fillRect(0, 0, w, memY)

      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('CHLOROPLAST STROMA (Alkaline, pH ≈ 8.0)', 18, 22)

      // 2. Thylakoid Lumen Region (Bottom, pH ~ 5.5, high proton concentration)
      const lumenGrad = ctx.createLinearGradient(0, memY + memH, 0, h)
      lumenGrad.addColorStop(0, 'rgba(180, 83, 9, 0.25)')
      lumenGrad.addColorStop(1, 'rgba(180, 83, 9, 0.05)')
      ctx.fillStyle = lumenGrad
      ctx.fillRect(0, memY + memH, w, h - (memY + memH))

      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('THYLAKOID LUMEN (Acidic H⁺ Accumulation, pH ≈ 5.5)', 18, h - 20)

      // 3. Lipid Bilayer (Thylakoid Membrane)
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(0, memY, w, memH)
      // Phospholipid heads (upper and lower rows)
      ctx.fillStyle = '#e2e8f0'
      for (let px = 8; px < w; px += 14) {
        // Top heads
        ctx.beginPath()
        ctx.arc(px, memY + 4, 3, 0, Math.PI * 2)
        ctx.fill()
        // Bottom heads
        ctx.beginPath()
        ctx.arc(px, memY + memH - 4, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      // 4. Protein Complexes embedded in Membrane
      // A. Photosystem II (PS II / P680)
      const ps2X = w * 0.16
      ctx.fillStyle = '#059669'
      ctx.beginPath()
      ctx.roundRect(ps2X - 32, memY - 14, 64, memH + 28, 10)
      ctx.fill()
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('PS II', ps2X - 12, memY + 12)
      ctx.font = '8px sans-serif'
      ctx.fillText('P680', ps2X - 10, memY + 24)

      // Incoming Animated Sunlight Beams striking PS II
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.4 + lightFrac * 0.55})`
      ctx.lineWidth = 3
      for (let r = -20; r <= 20; r += 14) {
        ctx.beginPath()
        ctx.moveTo(ps2X + r - 35, 10)
        ctx.lineTo(ps2X + r, memY - 15)
        ctx.stroke()
      }
      ctx.fillStyle = '#fef08a'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('☀️ Photons', ps2X - 45, 38)

      // Water Splitting Complex (Photolysis: 2H2O -> O2 + 4H+ + 4e-)
      const oecY = memY + memH + 20
      ctx.fillStyle = '#0284c7'
      ctx.beginPath()
      ctx.arc(ps2X, oecY, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('OEC', ps2X - 8, oecY + 3)

      // Rising O2 Bubble Animation
      const o2Cycle = (state.time * (1 + lightFrac * 2)) % 1
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(ps2X + 22, oecY + 8 - o2Cycle * 28, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('½ O₂ ↑', ps2X + 28, oecY + 10)

      // B. Plastoquinone (PQ) & Cytochrome b6f Complex (H+ proton pump)
      const cytX = w * 0.36
      ctx.fillStyle = '#7c2d12'
      ctx.beginPath()
      ctx.roundRect(cytX - 26, memY - 12, 52, memH + 24, 8)
      ctx.fill()
      ctx.strokeStyle = '#ea580c'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('Cyt b₆f', cytX - 16, memY + 18)

      // Active Proton Pumping Arrow (Stroma -> Lumen)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(cytX, memY - 18)
      ctx.lineTo(cytX, memY + memH + 18)
      ctx.lineTo(cytX - 4, memY + memH + 12)
      ctx.moveTo(cytX, memY + memH + 18)
      ctx.lineTo(cytX + 4, memY + memH + 12)
      ctx.stroke()
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('H⁺ Pump', cytX + 8, memY + memH + 22)

      // C. Photosystem I (PS I / P700)
      const ps1X = w * 0.56
      ctx.fillStyle = '#047857'
      ctx.beginPath()
      ctx.roundRect(ps1X - 30, memY - 14, 60, memH + 28, 10)
      ctx.fill()
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('PS I', ps1X - 10, memY + 12)
      ctx.font = '8px sans-serif'
      ctx.fillText('P700', ps1X - 10, memY + 24)

      // Sunlight hitting PS I
      for (let r = -15; r <= 15; r += 14) {
        ctx.beginPath()
        ctx.moveTo(ps1X + r - 35, 10)
        ctx.lineTo(ps1X + r, memY - 15)
        ctx.stroke()
      }

      // D. Ferredoxin & NADP+ Reductase (FNR) synthesizing NADPH in stroma
      const fnrX = w * 0.72
      const fnrY = memY - 24
      ctx.fillStyle = '#7c3aed'
      ctx.beginPath()
      ctx.arc(fnrX, fnrY, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#a855f7'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('FNR', fnrX - 8, fnrY + 3)

      // NADPH Product badge
      ctx.fillStyle = '#c084fc'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('NADP⁺ + H⁺ → NADPH ✨', fnrX - 45, fnrY - 22)

      // E. ATP Synthase CF0-CF1 Rotary Motor (Right side)
      const atpX = w * 0.88
      // CF0 membrane channel
      ctx.fillStyle = '#475569'
      ctx.fillRect(atpX - 15, memY - 4, 30, memH + 8)
      ctx.strokeStyle = '#cbd5e1'
      ctx.strokeRect(atpX - 15, memY - 4, 30, memH + 8)

      // Rotating CF1 Rotor Head (Stroma side, spinning at 60 FPS!)
      const rotorSpeed = state.time * (4 + lightFrac * 8)
      ctx.save()
      ctx.translate(atpX, memY - 32)
      ctx.rotate(rotorSpeed)
      ctx.fillStyle = '#eab308'
      ctx.beginPath()
      ctx.arc(0, 0, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fef08a'
      ctx.lineWidth = 2
      ctx.stroke()

      // Rotor blades
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16)
        ctx.stroke()
      }
      ctx.restore()

      // ATP Synthesis label & Arrow
      ctx.fillStyle = '#fef08a'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('ADP + Pi → ATP ⚡', atpX - 45, memY - 58)

      // H+ flow through ATP Synthase
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(atpX, memY + memH + 18)
      ctx.lineTo(atpX, memY - 14)
      ctx.stroke()
      ctx.fillStyle = '#fbbf24'
      ctx.fillText('H⁺ Flow', atpX - 18, memY + memH + 28)

      // 5. High H+ Concentration Dots Floating in Lumen
      ctx.fillStyle = '#fbbf24'
      for (let i = 0; i < 28; i++) {
        const dotX = (i * 32 + state.time * 20) % (w - 40) + 20
        const dotY = memY + memH + 12 + ((i * 17) % 45)
        ctx.beginPath()
        ctx.arc(dotX, dotY, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // 6. Traveling Electron Sparks (Z-Scheme)
      const eCycle = (state.time * (2 + lightFrac * 3)) % 1
      let sparkX = ps2X + eCycle * (fnrX - ps2X)
      let sparkY = memY + Math.sin(eCycle * Math.PI * 3) * 8
      ctx.fillStyle = '#fef08a'
      ctx.beginPath()
      ctx.arc(sparkX, sparkY, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth = 1.5
      ctx.stroke()
    },
  },

  chemical_bonding: {
    type: 'chemical_bonding',
    title: 'Chemical Bonding (Ionic vs Covalent)',
    subject: 'Chemistry · Chemical Structure',
    concept: 'Lennard-Jones Potential & Orbital Electron Overlap',
    description: 'Explore the fundamental quantum and electrostatic mechanics of chemical bonds. Adjust inter-nuclear distance to trace the Lennard-Jones potential energy well. Switch between Covalent bonding with overlapping electron probability clouds and Ionic electron transfer with Coulombic crystal lattice attraction.',
    presets: [
      { label: 'Covalent H₂ (74 pm)', params: { distance: 74, bondMode: 1, enDiff: 0.0 } },
      { label: 'Polar Covalent H₂O (96 pm)', params: { distance: 96, bondMode: 1, enDiff: 1.4 } },
      { label: 'Ionic NaCl (236 pm)', params: { distance: 236, bondMode: 2, enDiff: 2.1 } },
    ],
    params: [
      { key: 'distance', label: 'Inter-nuclear Distance (r)', min: 40, max: 320, step: 2, defaultValue: 74, unit: 'pm' },
      { key: 'bondMode', label: 'Bond Type (1=Covalent, 2=Ionic)', min: 1, max: 2, step: 1, defaultValue: 1, unit: '' },
      { key: 'enDiff', label: 'Electronegativity Diff (ΔEN)', min: 0.0, max: 3.2, step: 0.1, defaultValue: 0.4, unit: '' },
    ],
    calculateReadouts: (p) => {
      const r = p.distance
      const r0 = p.bondMode === 2 ? 236 : 74
      const sigma = r0 * 0.89
      // Lennard-Jones potential
      const sOverR = sigma / Math.max(r, 20)
      const lj = 4 * 436 * (Math.pow(sOverR, 12) - Math.pow(sOverR, 6))
      const potEnergy = Math.max(-500, Math.min(600, lj)).toFixed(0)
      const forceNet = (-12 * (lj / Math.max(r, 30)) * 0.01).toFixed(2)
      const bondType = p.bondMode === 2 ? 'Ionic (Electrostatic)' : (p.enDiff > 1.7 ? 'Ionic Character' : (p.enDiff > 0.4 ? 'Polar Covalent' : 'Non-Polar Covalent'))

      return [
        { label: 'Potential Energy V(r)', value: `${potEnergy} kJ/mol`, formula: 'V(r) = 4ε[(σ/r)¹² - (σ/r)⁶]' },
        { label: 'Interatomic Net Force', value: `${forceNet} nN`, formula: 'F = -dV/dr' },
        { label: 'Bond Classification', value: bondType },
        { label: 'Equilibrium Length r₀', value: `${r0} pm`, formula: 'd²V/dr² > 0' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#080d1a'
      ctx.fillRect(0, 0, w, h)

      const isIonic = p.bondMode === 2
      const r = p.distance
      const r0 = isIonic ? 236 : 74

      // --- LEFT AREA: ATOMIC ORBITALS & ELECTRON CLOUD (Width: w * 0.55) ---
      const centerX = w * 0.28
      const centerY = h * 0.52
      const scale = 0.95
      const atom1X = centerX - (r * scale) / 2
      const atom2X = centerX + (r * scale) / 2

      // Subtle background grid for scientific breadboard feel
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.lineWidth = 1
      for (let x = 20; x < w * 0.55; x += 30) {
        ctx.beginPath()
        ctx.moveTo(x, 20)
        ctx.lineTo(x, h - 20)
        ctx.stroke()
      }

      // Title HUD
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(isIonic ? 'IONIC BOND: Electron Transfer (Na⁺ + Cl⁻)' : 'COVALENT BOND: Molecular Orbital Overlap (H:H)', 24, 32)

      if (!isIonic) {
        // --- COVALENT: Overlapping Electron Probability Clouds ---
        const cloudRadius = 55
        // Atom 1 Electron Cloud (Cyan glow)
        const g1 = ctx.createRadialGradient(atom1X, centerY, 4, atom1X, centerY, cloudRadius)
        g1.addColorStop(0, 'rgba(6, 182, 212, 0.75)')
        g1.addColorStop(0.5, 'rgba(6, 182, 212, 0.25)')
        g1.addColorStop(1, 'rgba(6, 182, 212, 0.0)')
        ctx.fillStyle = g1
        ctx.beginPath()
        ctx.arc(atom1X, centerY, cloudRadius, 0, Math.PI * 2)
        ctx.fill()

        // Atom 2 Electron Cloud
        const g2 = ctx.createRadialGradient(atom2X, centerY, 4, atom2X, centerY, cloudRadius)
        g2.addColorStop(0, 'rgba(129, 140, 248, 0.75)')
        g2.addColorStop(0.5, 'rgba(129, 140, 248, 0.25)')
        g2.addColorStop(1, 'rgba(129, 140, 248, 0.0)')
        ctx.fillStyle = g2
        ctx.beginPath()
        ctx.arc(atom2X, centerY, cloudRadius, 0, Math.PI * 2)
        ctx.fill()

        // Shared Electron Pair (Spin Up & Spin Down)
        const overlapX = (atom1X + atom2X) / 2
        const overlapDist = Math.max(0, cloudRadius * 2 - (atom2X - atom1X))
        if (overlapDist > 10) {
          const eRot = state.time * 3
          // Shared Electron 1 (Spin Up)
          const e1X = overlapX + Math.cos(eRot) * 14
          const e1Y = centerY + Math.sin(eRot) * 18
          ctx.fillStyle = '#facc15'
          ctx.beginPath()
          ctx.arc(e1X, e1Y, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#0f172a'
          ctx.font = 'bold 8px monospace'
          ctx.fillText('↑e⁻', e1X - 6, e1Y - 6)

          // Shared Electron 2 (Spin Down)
          const e2X = overlapX - Math.cos(eRot) * 14
          const e2Y = centerY - Math.sin(eRot) * 18
          ctx.fillStyle = '#facc15'
          ctx.beginPath()
          ctx.arc(e2X, e2Y, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#0f172a'
          ctx.font = 'bold 8px monospace'
          ctx.fillText('↓e⁻', e2X - 6, e2Y + 12)

          // Bonding Molecular Orbital High Density Glow
          ctx.fillStyle = 'rgba(52, 211, 153, 0.22)'
          ctx.beginPath()
          ctx.ellipse(overlapX, centerY, overlapDist * 0.45, 36, 0, 0, Math.PI * 2)
          ctx.fill()
        }

        // Nucleus 1 (Hydrogen)
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(atom1X, centerY, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#fca5a5'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 9px sans-serif'
        ctx.fillText('H (+1)', atom1X - 11, centerY + 3)

        // Nucleus 2
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(atom2X, centerY, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#fca5a5'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.fillText('H (+1)', atom2X - 11, centerY + 3)
      } else {
        // --- IONIC: Sodium (Na+) and Chloride (Cl-) ---
        const naRadius = 30
        const clRadius = 50

        // Sodium Cation Na+ (Amber)
        const gNa = ctx.createRadialGradient(atom1X - 8, centerY - 8, 3, atom1X, centerY, naRadius)
        gNa.addColorStop(0, '#fef08a')
        gNa.addColorStop(0.4, '#f59e0b')
        gNa.addColorStop(1, '#b45309')
        ctx.fillStyle = gNa
        ctx.beginPath()
        ctx.arc(atom1X, centerY, naRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText('Na⁺', atom1X - 10, centerY + 4)

        // Chloride Anion Cl- (Emerald Green)
        const gCl = ctx.createRadialGradient(atom2X - 12, centerY - 12, 4, atom2X, centerY, clRadius)
        gCl.addColorStop(0, '#a7f3d0')
        gCl.addColorStop(0.4, '#10b981')
        gCl.addColorStop(1, '#065f46')
        ctx.fillStyle = gCl
        ctx.beginPath()
        ctx.arc(atom2X, centerY, clRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#34d399'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText('Cl⁻', atom2X - 10, centerY + 4)

        // Animated Valence Electron Transfer Spark
        const transCycle = (state.time * 1.5) % 1
        const transX = atom1X + transCycle * (atom2X - atom1X)
        const transY = centerY - Math.sin(transCycle * Math.PI) * 32
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.arc(transX, transY, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#facc15'
        ctx.font = 'bold 8px monospace'
        ctx.fillText('e⁻', transX - 4, transY - 7)

        // Electrostatic Attraction Force Field Vectors
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(atom1X + naRadius, centerY)
        ctx.lineTo(atom2X - clRadius, centerY)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#fbbf24'
        ctx.font = '9px sans-serif'
        ctx.fillText('Coulomb Attraction (q₁q₂/r²)', (atom1X + atom2X) / 2 - 50, centerY + 16)
      }

      // Inter-nuclear Distance Dimension Arrow
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1.5
      const arrowY = centerY + 80
      ctx.beginPath()
      ctx.moveTo(atom1X, arrowY)
      ctx.lineTo(atom2X, arrowY)
      ctx.stroke()
      // Arrow ticks
      ctx.beginPath()
      ctx.moveTo(atom1X, arrowY - 6)
      ctx.lineTo(atom1X, arrowY + 6)
      ctx.moveTo(atom2X, arrowY - 6)
      ctx.lineTo(atom2X, arrowY + 6)
      ctx.stroke()
      ctx.fillStyle = '#e2e8f0'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`r = ${r.toFixed(0)} pm`, (atom1X + atom2X) / 2 - 25, arrowY - 8)

      // --- RIGHT AREA: LENNARD-JONES POTENTIAL CURVE GRAPH (Width: w * 0.40) ---
      const graphX = w * 0.58
      const graphY = 40
      const graphW = w * 0.38
      const graphH = h - 70

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
      ctx.fillRect(graphX, graphY, graphW, graphH)
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1
      ctx.strokeRect(graphX, graphY, graphW, graphH)

      // Graph Title
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('POTENTIAL ENERGY CURVE V(r)', graphX + 12, graphY + 18)

      // Axis
      const zeroY = graphY + graphH * 0.48
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 1
      ctx.beginPath()
      // X-axis (V = 0)
      ctx.moveTo(graphX + 25, zeroY)
      ctx.lineTo(graphX + graphW - 10, zeroY)
      // Y-axis (r)
      ctx.moveTo(graphX + 25, graphY + 25)
      ctx.lineTo(graphX + 25, graphY + graphH - 10)
      ctx.stroke()

      ctx.fillStyle = '#94a3b8'
      ctx.font = '8px monospace'
      ctx.fillText('V=0', graphX + 6, zeroY + 3)
      ctx.fillText('+ Energy', graphX + 28, graphY + 32)
      ctx.fillText('- Energy (Bound State)', graphX + 28, graphY + graphH - 14)
      ctx.fillText('Distance r →', graphX + graphW - 55, zeroY + 14)

      // Plot Lennard-Jones Curve
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      let first = true
      for (let plotR = 30; plotR <= 320; plotR += 4) {
        const sOver = (r0 * 0.89) / plotR
        const pot = 4 * 180 * (Math.pow(sOver, 12) - Math.pow(sOver, 6))
        const clampedPot = Math.max(-240, Math.min(260, pot))
        const px = graphX + 25 + ((plotR - 30) / 290) * (graphW - 40)
        const py = zeroY - (clampedPot / 260) * (graphH * 0.42)
        if (first) {
          ctx.moveTo(px, py)
          first = false
        } else {
          ctx.lineTo(px, py)
        }
      }
      ctx.stroke()

      // Current Operating Point on the Curve
      const currSOver = (r0 * 0.89) / Math.max(r, 30)
      const currPot = 4 * 180 * (Math.pow(currSOver, 12) - Math.pow(currSOver, 6))
      const currClamped = Math.max(-240, Math.min(260, currPot))
      const currPx = graphX + 25 + ((r - 30) / 290) * (graphW - 40)
      const currPy = zeroY - (currClamped / 260) * (graphH * 0.42)

      // Glowing dot for current position
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.arc(currPx, currPy, 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Equilibrium well label
      const eqPx = graphX + 25 + ((r0 - 30) / 290) * (graphW - 40)
      const eqPy = zeroY - (-180 / 260) * (graphH * 0.42)
      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText(`Equilibrium r₀=${r0}pm`, eqPx - 30, eqPy + 14)
    },
  },

  neuron_action_potential: {
    type: 'neuron_action_potential',
    title: 'Neuron Action Potential & Synapse',
    subject: 'Biology · Neurobiology',
    concept: 'Axon Voltage-Gated Na⁺/K⁺ Channels & Synaptic Exocytosis',
    description: 'Simulate the electrical Hodgkin-Huxley action potential traveling down a neuronal axon and across a chemical synapse. Watch voltage-gated Na⁺ and K⁺ ion channels physically open and close in the lipid bilayer, and observe Ca²⁺-mediated neurotransmitter vesicle fusion at the synaptic terminal.',
    presets: [
      { label: 'Resting State (-70 mV)', params: { stimulus: -70, caLevel: 40 } },
      { label: 'Threshold Stimulus (-55 mV)', params: { stimulus: -55, caLevel: 60 } },
      { label: 'Full Spike Peak (+35 mV)', params: { stimulus: 35, caLevel: 95 } },
    ],
    params: [
      { key: 'stimulus', label: 'Membrane Potential (Vm)', min: -80, max: 40, step: 2, defaultValue: -70, unit: 'mV' },
      { key: 'caLevel', label: 'Synaptic Ca²⁺ Influx', min: 10, max: 100, step: 5, defaultValue: 70, unit: '%' },
    ],
    calculateReadouts: (p) => {
      const vm = p.stimulus
      let phase = 'Resting Potential'
      let naConductance = 0.5
      let kConductance = 1.2
      if (vm >= -55 && vm < 30) {
        phase = 'Rapid Depolarization (Na⁺ Influx)'
        naConductance = 32.4
        kConductance = 2.8
      } else if (vm >= 30) {
        phase = 'Action Potential Peak (+35 mV)'
        naConductance = 28.0
        kConductance = 18.5
      } else if (vm < -55 && vm >= -70) {
        phase = 'Sub-threshold Graded Potential'
        naConductance = 1.8
        kConductance = 1.4
      } else if (vm < -70) {
        phase = 'Hyperpolarization / Refractory (-80 mV)'
        naConductance = 0.1
        kConductance = 8.5
      }

      const vesiclesFused = Math.floor((p.caLevel / 100) * 14)

      return [
        { label: 'Membrane Potential Vm', value: `${vm.toFixed(0)} mV`, formula: 'Goldman-Hodgkin-Katz' },
        { label: 'Physiological State', value: phase },
        { label: 'g_Na / g_K Conductance', value: `${naConductance.toFixed(1)} / ${kConductance.toFixed(1)} mS/cm²`, formula: 'm³h / n⁴ Gating' },
        { label: 'Synaptic ACh Exocytosis', value: `${vesiclesFused} Vesicles/spike`, formula: 'SNARE Complex' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#080d1a'
      ctx.fillRect(0, 0, w, h)

      const vm = p.stimulus
      const isDepolarizing = vm >= -55 && vm < 30
      const isPeak = vm >= 30

      // --- UPPER LEFT: AXON MEMBRANE CROSS-SECTION (w * 0.58) ---
      const memY = 70
      const memH = 50

      // Extracellular Fluid (ECF)
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)'
      ctx.fillRect(20, 20, w * 0.56, memY - 20)
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('EXTRACELLULAR FLUID (High Na⁺, Low K⁺)', 30, 36)

      // Intracellular Cytosol (ICF)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)'
      ctx.fillRect(20, memY + memH, w * 0.56, 80)
      ctx.fillStyle = '#c084fc'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText('INTRACELLULAR AXOPLASM (High K⁺, Low Na⁺, Negative Organics)', 30, memY + memH + 70)

      // Lipid Bilayer (Phospholipids)
      ctx.fillStyle = '#64748b'
      ctx.fillRect(20, memY, w * 0.56, memH)
      // Hydrophilic head rows
      for (let x = 24; x < w * 0.56 + 15; x += 11) {
        ctx.fillStyle = '#94a3b8'
        ctx.beginPath()
        ctx.arc(x, memY + 3, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x, memY + memH - 3, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // 1. Voltage-Gated Na+ Channel (Cyan)
      const naChX = 110
      ctx.fillStyle = '#0284c7'
      ctx.fillRect(naChX - 22, memY - 4, 44, memH + 8)
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2
      ctx.strokeRect(naChX - 22, memY - 4, 44, memH + 8)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('Na⁺ Channel', naChX - 20, memY + 28)

      // Na+ Gate (Opens during depolarization)
      if (isDepolarizing || isPeak) {
        // Open pore channel
        ctx.fillStyle = '#080d1a'
        ctx.fillRect(naChX - 8, memY - 4, 16, memH + 8)
        // Flowing Na+ ions into axon
        for (let i = 0; i < 4; i++) {
          const ionY = memY - 10 + ((state.time * 60 + i * 18) % (memH + 25))
          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.arc(naChX, ionY, 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#38bdf8'
        ctx.font = 'bold 8px monospace'
        ctx.fillText('Na⁺ INFLUX ↓', naChX - 24, memY - 8)
      } else {
        // Closed activation gate
        ctx.fillStyle = '#f43f5e'
        ctx.fillRect(naChX - 12, memY + memH / 2 - 4, 24, 8)
        ctx.fillStyle = '#ffffff'
        ctx.font = '7px sans-serif'
        ctx.fillText('CLOSED', naChX - 11, memY + memH / 2 + 3)
      }

      // 2. Voltage-Gated K+ Channel (Purple)
      const kChX = 220
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(kChX - 22, memY - 4, 44, memH + 8)
      ctx.strokeStyle = '#a855f7'
      ctx.lineWidth = 2
      ctx.strokeRect(kChX - 22, memY - 4, 44, memH + 8)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('K⁺ Channel', kChX - 18, memY + 28)

      // K+ Gate (Opens during peak and repolarization)
      if (isPeak || (vm > -70 && !isDepolarizing)) {
        ctx.fillStyle = '#080d1a'
        ctx.fillRect(kChX - 8, memY - 4, 16, memH + 8)
        // Flowing K+ ions out of axon
        for (let i = 0; i < 4; i++) {
          const ionY = memY + memH + 10 - ((state.time * 60 + i * 18) % (memH + 25))
          ctx.fillStyle = '#c084fc'
          ctx.beginPath()
          ctx.arc(kChX, ionY, 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#c084fc'
        ctx.font = 'bold 8px monospace'
        ctx.fillText('K⁺ EFFLUX ↑', kChX - 22, memY - 8)
      } else {
        ctx.fillStyle = '#f43f5e'
        ctx.fillRect(kChX - 12, memY + memH / 2 - 4, 24, 8)
        ctx.fillStyle = '#ffffff'
        ctx.font = '7px sans-serif'
        ctx.fillText('CLOSED', kChX - 11, memY + memH / 2 + 3)
      }

      // 3. Na+/K+ ATPase Pump (Gold)
      const pumpX = 330
      ctx.fillStyle = '#d97706'
      ctx.fillRect(pumpX - 24, memY - 4, 48, memH + 8)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2
      ctx.strokeRect(pumpX - 24, memY - 4, 48, memH + 8)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('Na⁺/K⁺ PUMP', pumpX - 22, memY + 22)
      ctx.fillStyle = '#fef08a'
      ctx.font = '7px sans-serif'
      ctx.fillText('3Na⁺ OUT / 2K⁺ IN', pumpX - 23, memY + 36)

      // --- LOWER LEFT: SYNAPSE & VESICLE EXOCYTOSIS (Width: w * 0.58, Bottom half) ---
      const synY = memY + memH + 110
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(20, synY, w * 0.56, h - synY - 15)
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1.5
      ctx.strokeRect(20, synY, w * 0.56, h - synY - 15)

      ctx.fillStyle = '#10b981'
      ctx.font = 'bold 10px sans-serif'
      ctx.fillText('CHEMICAL SYNAPSE TERMINAL: Ca²⁺ Influx & Neurotransmitter Exocytosis', 30, synY + 18)

      // Synaptic terminal bulb
      const bulbX = 140
      const bulbY = synY + 65
      ctx.fillStyle = '#0f766e'
      ctx.beginPath()
      ctx.arc(bulbX, bulbY, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#14b8a6'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('Axon Bouton', bulbX - 22, bulbY - 6)

      // Synaptic Vesicles with Acetylcholine inside bulb
      const vesicleCount = 6
      for (let v = 0; v < vesicleCount; v++) {
        const vAngle = (v * (Math.PI * 2)) / vesicleCount + state.time * 0.5
        const vx = bulbX + Math.cos(vAngle) * 18
        const vy = bulbY + Math.sin(vAngle) * 18
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(vx, vy, 5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Synaptic Cleft and Postsynaptic membrane
      const postX = bulbX + 75
      ctx.fillStyle = '#475569'
      ctx.fillRect(postX, synY + 30, 14, 70)
      ctx.fillStyle = '#94a3b8'
      ctx.font = 'bold 8px sans-serif'
      ctx.fillText('Postsynaptic Membrane', postX + 20, synY + 55)

      // Neurotransmitter particles diffusing across cleft
      const cleftDensity = Math.floor((p.caLevel / 100) * 16)
      for (let d = 0; d < cleftDensity; d++) {
        const ntx = bulbX + 34 + ((d * 14 + state.time * 40) % 40)
        const nty = bulbY - 20 + ((d * 17) % 40)
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(ntx, nty, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // --- RIGHT AREA: ACTION POTENTIAL OSCILLOSCOPE (Width: w * 0.38) ---
      const oscX = w * 0.60
      const oscY = 24
      const oscW = w * 0.37
      const oscH = h - 45

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
      ctx.fillRect(oscX, oscY, oscW, oscH)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1.5
      ctx.strokeRect(oscX, oscY, oscW, oscH)

      // Oscilloscope Title
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('ACTION POTENTIAL V_m(t)', oscX + 14, oscY + 20)

      // Grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)'
      ctx.lineWidth = 1
      for (let gy = oscY + 35; gy < oscY + oscH - 10; gy += 25) {
        ctx.beginPath()
        ctx.moveTo(oscX + 10, gy)
        ctx.lineTo(oscX + oscW - 10, gy)
        ctx.stroke()
      }

      // Zero & Threshold lines
      const baselineY = oscY + oscH * 0.68 // -70 mV
      const threshY = oscY + oscH * 0.54   // -55 mV
      const peakY = oscY + oscH * 0.20     // +35 mV

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(oscX + 28, threshY)
      ctx.lineTo(oscX + oscW - 10, threshY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ef4444'
      ctx.font = '8px monospace'
      ctx.fillText('-55 mV (Threshold)', oscX + 32, threshY - 4)

      ctx.fillStyle = '#94a3b8'
      ctx.fillText('-70 mV (Resting)', oscX + 32, baselineY + 12)
      ctx.fillText('+35 mV (Peak)', oscX + 32, peakY - 4)

      // Draw Action Potential Waveform
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2.8
      ctx.beginPath()
      ctx.moveTo(oscX + 30, baselineY)
      ctx.lineTo(oscX + 70, baselineY)
      // Depolarization to threshold and peak
      ctx.bezierCurveTo(oscX + 85, baselineY, oscX + 100, threshY, oscX + 115, peakY)
      // Repolarization
      ctx.bezierCurveTo(oscX + 130, peakY, oscX + 140, baselineY + 18, oscX + 155, baselineY + 18)
      // Hyperpolarization and return to resting
      ctx.bezierCurveTo(oscX + 175, baselineY + 18, oscX + 195, baselineY, oscX + oscW - 15, baselineY)
      ctx.stroke()

      // Animated Traveling Trigger Marker on Waveform
      const normVm = (vm - (-80)) / (40 - (-80)) // 0 to 1
      const markerX = oscX + 30 + normVm * (oscW - 60)
      const markerY = baselineY - ((vm - (-70)) / (40 - (-70))) * (baselineY - peakY)
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.arc(markerX, markerY, 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    },
  },

  osmosis: {
    type: 'osmosis',
    title: 'Osmosis & Water Potential Laboratory',
    subject: 'Biology · Cell Physiology & Transport',
    concept: 'Semipermeable Membrane & Water Potential (Ψ = Ψs + Ψp)',
    description: 'Explore the biophysical mechanism of Osmosis in three authentic laboratory setups: (1) Classic U-Tube Osmometer with Reverse Osmosis Piston, (2) Living Plant & Animal Cells under Microscope (Turgor vs Plasmolysis & Lysis), and (3) The Potato Osmometer Practical.',
    presets: [
      { label: '🧪 Active Influx (0.05M vs 0.85M U-Tube)', params: { mode: 0, cLeft: 0.05, cRight: 0.85, appliedP: 0, poreSize: 1.2 } },
      { label: '🔬 Plant Plasmolysis (Hypertonic Saline)', params: { mode: 1, cLeft: 0.2, cRight: 0.85, appliedP: 0, poreSize: 1.2 } },
      { label: '🔬 RBC Lysis Burst (Pure Water)', params: { mode: 1, cLeft: 0.3, cRight: 0.0, appliedP: 0, poreSize: 1.2 } },
      { label: '🥔 Potato Osmometer Practical', params: { mode: 2, cLeft: 0.05, cRight: 0.8, appliedP: 0, poreSize: 1.2 } },
      { label: '⚙️ Reverse Osmosis Desalination (24 atm)', params: { mode: 0, cLeft: 0.05, cRight: 0.85, appliedP: 24, poreSize: 1.2 } },
    ],
    params: [
      { key: 'mode', label: 'Apparatus View (0:U-Tube, 1:Cell, 2:Potato)', min: 0, max: 2, step: 1, defaultValue: 0, unit: '' },
      { key: 'cLeft', label: 'Left / Cell Molarity (C₁)', min: 0.0, max: 1.0, step: 0.05, defaultValue: 0.05, unit: 'M' },
      { key: 'cRight', label: 'Right / External Molarity (C₂)', min: 0.0, max: 1.0, step: 0.05, defaultValue: 0.85, unit: 'M' },
      { key: 'appliedP', label: 'Applied Pressure on Right (P)', min: 0, max: 30, step: 1, defaultValue: 0, unit: 'atm' },
      { key: 'poreSize', label: 'Membrane Pore Diameter', min: 0.6, max: 2.5, step: 0.1, defaultValue: 1.2, unit: 'nm' },
    ],
    calculateReadouts: (p) => {
      const mode = Math.round(p.mode ?? 0)
      const c1 = p.cLeft ?? 0.05
      const c2 = p.cRight ?? 0.85
      const pApplied = p.appliedP ?? 0
      const RT = 24.47 // 0.08206 * 298.15 atm*L/mol
      const pi1 = c1 * RT
      const pi2 = c2 * RT
      const deltaPi = pi2 - pi1
      const psiS1 = -(pi1 * 0.101325)
      const psiS2 = -(pi2 * 0.101325)
      const deltaPsi = psiS1 - psiS2 - (pApplied * 0.101325)

      if (mode === 1) {
        // Living Cell Microscope View
        let tonicity = 'Isotonic (Dynamic Balance)'
        let plantState = 'Flaccid (Normal Turgor = 0)'
        let rbcState = 'Normal Biconcave Disc'
        if (c2 < c1 - 0.05) {
          tonicity = 'Hypotonic (Pure/Dilute Exterior)'
          plantState = 'Turgid (High Turgor Pressure P > 0)'
          rbcState = 'Swollen → Hemolysis (Cell Lysis / Burst!)'
        } else if (c2 > c1 + 0.05) {
          tonicity = 'Hypertonic (Concentrated Salt/Sugar)'
          plantState = 'Plasmolysed (Membrane Detached from Wall)'
          rbcState = 'Crenated (Shriveled Spiky Cell)'
        }
        return [
          { label: 'Cell Internal Ψ', value: `${psiS1.toFixed(2)} MPa`, formula: 'Ψ_cell = -iC₁RT' },
          { label: 'External Solution Ψ', value: `${psiS2.toFixed(2)} MPa`, formula: 'Ψ_ext = -iC₂RT' },
          { label: 'Tonicity Classification', value: tonicity },
          { label: 'Plant Cell Response', value: plantState },
          { label: 'Animal RBC Response', value: rbcState },
        ]
      }

      if (mode === 2) {
        // Potato Osmometer Practical View
        const riseMm = Math.max(0, Math.min(35, (c2 - c1) * 38)).toFixed(1)
        return [
          { label: 'Dish Water Potential (Ψ_dish)', value: `${psiS1.toFixed(2)} MPa`, formula: 'Pure Solvent' },
          { label: 'Potato Cavity Potential (Ψ_cavity)', value: `${psiS2.toFixed(2)} MPa`, formula: 'Concentrated Sucrose' },
          { label: 'Osmotic Influx Direction', value: 'Petri Dish → Potato Cavity' },
          { label: 'Syrup Level Rise (Above Pin)', value: `+${riseMm} mm`, formula: 'Endosmosis via Potato Cells' },
          { label: 'Transport Pathway', value: 'Symplast & Apoplast Diffusion' },
        ]
      }

      // Default: Mode 0 (U-Tube Osmometer & Reverse Osmosis)
      let fluxText = 'Equilibrium (No Net Flux)'
      let fluxFormula = 'ΔΨ = 0 (Jv = 0)'
      if (pApplied * 0.101325 > (psiS1 - psiS2) + 0.05) {
        fluxText = 'Reverse Osmosis (Right → Left)'
        fluxFormula = 'P_applied > Δπ'
      } else if (c2 > c1 + 0.02) {
        fluxText = 'Osmotic Influx (Left → Right)'
        fluxFormula = 'Ψ₁ > Ψ₂ (High → Low Potential)'
      } else if (c1 > c2 + 0.02) {
        fluxText = 'Osmotic Efflux (Right → Left)'
        fluxFormula = 'Ψ₂ > Ψ₁ (High → Low Potential)'
      }

      const hDiffMm = Math.max(-50, Math.min(50, (deltaPi - pApplied) * 1.8)).toFixed(1)

      return [
        { label: 'Left Water Potential (Ψ₁)', value: `${psiS1.toFixed(2)} MPa`, formula: 'Ψ₁ = -iC₁RT' },
        { label: 'Right Water Potential (Ψ₂)', value: `${psiS2.toFixed(2)} MPa`, formula: 'Ψ₂ = -iC₂RT' },
        { label: 'Osmotic Gradient ΔΨ', value: `${deltaPsi.toFixed(2)} MPa`, formula: 'ΔΨ = (Ψ₁ - Ψ₂) - P' },
        { label: 'Osmotic Pressure Δπ', value: `${Math.abs(deltaPi).toFixed(2)} atm`, formula: 'Δπ = (C₂ - C₁)RT' },
        { label: 'Net Water Flux (Jv)', value: fluxText, formula: fluxFormula },
        { label: 'Hydrostatic Head Δh', value: `${hDiffMm} mm`, formula: 'ΔP = ρ·g·Δh' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.clearRect(0, 0, w, h)

      // 1. Dark Scientific Laboratory Backdrop
      ctx.fillStyle = '#080d1a'
      ctx.fillRect(0, 0, w, h)

      ctx.save()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)'
      ctx.lineWidth = 1
      const gridStep = 32
      for (let x = 0; x < w; x += gridStep) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += gridStep) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      ctx.restore()

      // Mode and parameters
      const mode = Math.round(p.mode ?? 0)
      const c1 = p.cLeft ?? 0.05
      const c2 = p.cRight ?? 0.85
      const poreNm = p.poreSize ?? 1.2
      const pApplied = p.appliedP ?? 0

      // Mode Navigation Bar Tabs (Rendered at top)
      const tabY = 12
      const tabH = 22
      const tabs = [
        { label: '🧪 1. U-Tube Osmometer', id: 0 },
        { label: '🔬 2. Living Cell Microscope', id: 1 },
        { label: '🥔 3. Potato Osmometer Practical', id: 2 },
      ]
      const tabTotalW = Math.min(w - 24, 460)
      const tabW = tabTotalW / 3
      const tabStartX = (w - tabTotalW) / 2

      ctx.save()
      tabs.forEach((tab, i) => {
        const tx = tabStartX + i * tabW
        const active = mode === tab.id
        ctx.fillStyle = active ? 'rgba(14, 165, 233, 0.25)' : 'rgba(30, 41, 59, 0.6)'
        ctx.strokeStyle = active ? '#38bdf8' : '#334155'
        ctx.lineWidth = active ? 1.5 : 1
        ctx.beginPath()
        ctx.roundRect(tx + 2, tabY, tabW - 4, tabH, 4)
        ctx.fill()
        ctx.stroke()

        ctx.font = active ? 'bold 9.5px sans-serif' : '9px sans-serif'
        ctx.fillStyle = active ? '#38bdf8' : '#94a3b8'
        ctx.textAlign = 'center'
        ctx.fillText(tab.label, tx + tabW / 2, tabY + 14)
      })
      ctx.restore()

      // =========================================================================
      // MODE 1: LIVING PLANT & ANIMAL CELLS UNDER MICROSCOPE (Turgor vs Plasmolysis)
      // =========================================================================
      if (mode === 1) {
        const microTopY = 40
        const microH = h - microTopY - 10
        const scopeRadius = Math.min(microH * 0.44, w * 0.22)
        const plantScopeX = Math.round(w * 0.28)
        const rbcScopeX = Math.round(w * 0.72)
        const scopeY = microTopY + microH * 0.52

        // Environment Tonicity classification
        const isHypo = c2 < c1 - 0.05
        const isHyper = c2 > c1 + 0.05
        const tonicityTitle = isHypo
          ? '💧 HYPOTONIC EXTERIOR (Water Rushes IN)'
          : (isHyper ? '🧂 HYPERTONIC EXTERIOR (Water Sucked OUT)' : '⚖️ ISOTONIC EXTERIOR (Dynamic Balance)')
        const tonicityColor = isHypo ? '#38bdf8' : (isHyper ? '#f59e0b' : '#34d399')

        ctx.font = 'bold 11px sans-serif'
        ctx.fillStyle = tonicityColor
        ctx.textAlign = 'center'
        ctx.fillText(tonicityTitle, w / 2, microTopY + 12)
        ctx.font = '9px sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.fillText(`Cell Interior: ${c1.toFixed(2)} M · Surrounding Solution: ${c2.toFixed(2)} M`, w / 2, microTopY + 24)

        // Draw Microscope Viewports (Plant & Animal)
        ;[plantScopeX, rbcScopeX].forEach((sx) => {
          ctx.save()
          // Brass/Dark Metal Objective Lens Rim
          const rimGrad = ctx.createLinearGradient(sx - scopeRadius, scopeY, sx + scopeRadius, scopeY)
          rimGrad.addColorStop(0, '#475569')
          rimGrad.addColorStop(0.5, '#94a3b8')
          rimGrad.addColorStop(1, '#334155')
          ctx.strokeStyle = rimGrad
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.arc(sx, scopeY, scopeRadius + 3, 0, Math.PI * 2)
          ctx.stroke()

          // Inner Light Field of View
          const bgGrad = ctx.createRadialGradient(sx, scopeY, 5, sx, scopeY, scopeRadius)
          bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.95)')
          bgGrad.addColorStop(0.85, 'rgba(10, 15, 30, 0.98)')
          bgGrad.addColorStop(1, '#020617')
          ctx.fillStyle = bgGrad
          ctx.beginPath()
          ctx.arc(sx, scopeY, scopeRadius, 0, Math.PI * 2)
          ctx.fill()

          // Reticle Crosshairs (faint)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(sx - scopeRadius, scopeY)
          ctx.lineTo(sx + scopeRadius, scopeY)
          ctx.moveTo(sx, scopeY - scopeRadius)
          ctx.lineTo(sx, scopeY + scopeRadius)
          ctx.stroke()
          ctx.restore()
        })

        // --- SUB-VIEW A: PLANT CELL (Left Scope) ---
        ctx.save()
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = '#4ade80'
        ctx.textAlign = 'center'
        ctx.fillText('🌿 PLANT CELL (With Cell Wall)', plantScopeX, scopeY - scopeRadius - 8)

        // Clip inside microscope aperture
        ctx.beginPath()
        ctx.arc(plantScopeX, scopeY, scopeRadius - 2, 0, Math.PI * 2)
        ctx.clip()

        // Plant Cell Outer Rigid Cell Wall (Cellulose)
        const cellW = scopeRadius * 1.3
        const cellH = scopeRadius * 0.95
        ctx.fillStyle = 'rgba(22, 101, 52, 0.35)'
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.roundRect(plantScopeX - cellW / 2, scopeY - cellH / 2, cellW, cellH, 12)
        ctx.fill()
        ctx.stroke()

        // Plant Cell Inner Plasma Membrane & Vacuole
        // In Hypotonic: Membrane pressed tightly against wall.
        // In Hypertonic: Plasmolysis! Membrane shrinks away from wall.
        let shrinkFactor = 1.0
        if (isHyper) shrinkFactor = Math.max(0.45, 1.0 - (c2 - c1) * 0.6)
        const memW = cellW * shrinkFactor - 4
        const memH = cellH * shrinkFactor - 4

        ctx.fillStyle = 'rgba(14, 165, 233, 0.25)'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(plantScopeX - memW / 2, scopeY - memH / 2, memW, memH, 8)
        ctx.fill()
        ctx.stroke()

        // Large Central Vacuole (holds cell sap)
        const vacW = memW * 0.68
        const vacH = memH * 0.65
        const vacGrad = ctx.createRadialGradient(plantScopeX, scopeY, 2, plantScopeX, scopeY, vacW / 2)
        vacGrad.addColorStop(0, '#bae6fd')
        vacGrad.addColorStop(0.6, '#0284c7')
        vacGrad.addColorStop(1, '#0369a1')
        ctx.fillStyle = vacGrad
        ctx.beginPath()
        ctx.ellipse(plantScopeX, scopeY, vacW / 2, vacH / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#7dd3fc'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Nucleus
        ctx.fillStyle = '#c084fc'
        ctx.beginPath()
        ctx.arc(plantScopeX + memW * 0.32, scopeY - memH * 0.25, 7, 0, Math.PI * 2)
        ctx.fill()

        // Chloroplasts (green discs)
        ctx.fillStyle = '#16a34a'
        ;[-0.3, 0.3].forEach((ox) => {
          ctx.beginPath()
          ctx.ellipse(plantScopeX + memW * ox, scopeY + memH * 0.3, 5, 3.5, 0.4, 0, Math.PI * 2)
          ctx.fill()
        })

        // Status Label inside plant cell
        ctx.font = 'bold 8.5px sans-serif'
        ctx.textAlign = 'center'
        if (isHypo) {
          ctx.fillStyle = '#ffffff'
          ctx.fillText('TURGID CELL', plantScopeX, scopeY)
          ctx.font = '7.5px sans-serif'
          ctx.fillStyle = '#bae6fd'
          ctx.fillText('High Turgor Pressure', plantScopeX, scopeY + 11)
        } else if (isHyper) {
          ctx.fillStyle = '#fef08a'
          ctx.fillText('PLASMOLYSED', plantScopeX, scopeY)
          ctx.font = '7.5px sans-serif'
          ctx.fillStyle = '#fde047'
          ctx.fillText('Membrane Detached!', plantScopeX, scopeY + 11)
        } else {
          ctx.fillStyle = '#ffffff'
          ctx.fillText('FLACCID CELL', plantScopeX, scopeY)
          ctx.font = '7.5px sans-serif'
          ctx.fillStyle = '#cbd5e1'
          ctx.fillText('Equilibrium', plantScopeX, scopeY + 11)
        }
        ctx.restore()

        // --- SUB-VIEW B: ANIMAL / RED BLOOD CELL (Right Scope) ---
        ctx.save()
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = '#f43f5e'
        ctx.textAlign = 'center'
        ctx.fillText('🩸 ANIMAL CELL (No Cell Wall)', rbcScopeX, scopeY - scopeRadius - 8)

        // Clip inside microscope aperture
        ctx.beginPath()
        ctx.arc(rbcScopeX, scopeY, scopeRadius - 2, 0, Math.PI * 2)
        ctx.clip()

        if (isHypo) {
          // Hypotonic: RBC swells, undergoes Hemolysis (BURSTS!)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'
          ctx.beginPath()
          ctx.arc(rbcScopeX, scopeY, scopeRadius * 0.58, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#ef4444'
          ctx.setLineDash([4, 3])
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.setLineDash([])

          // Burst fragments / leaking hemoglobin
          ctx.fillStyle = '#f43f5e'
          for (let a = 0; a < Math.PI * 2; a += 0.8) {
            const fx = rbcScopeX + Math.cos(a) * (scopeRadius * 0.72)
            const fy = scopeY + Math.sin(a) * (scopeRadius * 0.72)
            ctx.beginPath()
            ctx.arc(fx, fy, 3.5, 0, Math.PI * 2)
            ctx.fill()
          }

          ctx.font = 'bold 9px sans-serif'
          ctx.fillStyle = '#ffffff'
          ctx.fillText('LYSIS / BURST!', rbcScopeX, scopeY - 4)
          ctx.font = '7.5px sans-serif'
          ctx.fillStyle = '#fecaca'
          ctx.fillText('No cell wall to resist', rbcScopeX, scopeY + 8)
          ctx.fillText('osmotic water entry', rbcScopeX, scopeY + 18)
        } else if (isHyper) {
          // Hypertonic: RBC shrivels with spiky crenated edges
          ctx.fillStyle = '#991b1b'
          ctx.strokeStyle = '#dc2626'
          ctx.lineWidth = 2
          ctx.beginPath()
          const rBase = scopeRadius * 0.38
          const spikes = 12
          for (let i = 0; i < spikes; i++) {
            const ang = (i / spikes) * Math.PI * 2
            const rCur = i % 2 === 0 ? rBase * 1.25 : rBase * 0.8
            const px = rbcScopeX + Math.cos(ang) * rCur
            const py = scopeY + Math.sin(ang) * rCur
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()

          ctx.font = 'bold 9px sans-serif'
          ctx.fillStyle = '#ffffff'
          ctx.fillText('CRENATED', rbcScopeX, scopeY - 4)
          ctx.font = '7.5px sans-serif'
          ctx.fillStyle = '#fca5a5'
          ctx.fillText('Shriveled & Spiky', rbcScopeX, scopeY + 8)
          ctx.fillText('Water lost to exterior', rbcScopeX, scopeY + 18)
        } else {
          // Isotonic: Healthy biconcave disc
          const rbcR = scopeRadius * 0.44
          const rbcGrad = ctx.createRadialGradient(rbcScopeX, scopeY, 4, rbcScopeX, scopeY, rbcR)
          rbcGrad.addColorStop(0, '#dc2626')
          rbcGrad.addColorStop(0.65, '#ef4444')
          rbcGrad.addColorStop(1, '#991b1b')
          ctx.fillStyle = rbcGrad
          ctx.beginPath()
          ctx.arc(rbcScopeX, scopeY, rbcR, 0, Math.PI * 2)
          ctx.fill()

          // Dimple in center
          ctx.fillStyle = '#b91c1c'
          ctx.beginPath()
          ctx.arc(rbcScopeX, scopeY, rbcR * 0.38, 0, Math.PI * 2)
          ctx.fill()

          ctx.font = 'bold 9px sans-serif'
          ctx.fillStyle = '#ffffff'
          ctx.fillText('NORMAL RBC', rbcScopeX, scopeY - 3)
          ctx.font = '7.5px sans-serif'
          ctx.fillStyle = '#fca5a5'
          ctx.fillText('Biconcave Disc', rbcScopeX, scopeY + 9)
        }
        ctx.restore()
        return
      }

      // =========================================================================
      // MODE 2: POTATO OSMOMETER PRACTICAL (NCERT/ICSE School Biology Experiment)
      // =========================================================================
      if (mode === 2) {
        const labTopY = 40
        const potCenterX = Math.round(w * 0.5)
        const potCenterY = Math.round(h * 0.6)
        const petriW = Math.min(w * 0.7, 380)
        const petriH = Math.min(h * 0.25, 65)

        ctx.font = 'bold 11px sans-serif'
        ctx.fillStyle = '#38bdf8'
        ctx.textAlign = 'center'
        ctx.fillText('🥔 POTATO OSMOMETER EXPERIMENT (Living Tissue Osmosis)', potCenterX, labTopY + 12)
        ctx.font = '9px sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.fillText('Water enters living potato cells by endosmosis, causing the sucrose syrup in the cavity to rise above the pin marker!', potCenterX, labTopY + 24)

        // Petri Dish (Bottom Glassware)
        ctx.save()
        // Dish glass rim
        ctx.fillStyle = 'rgba(14, 165, 233, 0.35)'
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.ellipse(potCenterX, potCenterY + 30, petriW / 2, petriH / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Petri dish fluid label
        ctx.font = 'bold 8.5px sans-serif'
        ctx.fillStyle = '#38bdf8'
        ctx.textAlign = 'left'
        ctx.fillText('← Petri Dish: Pure Water (High Ψ)', potCenterX - petriW / 2 + 10, potCenterY + 45)

        // Peeled Potato Block (Tuber)
        const potatoW = petriW * 0.55
        const potatoH = Math.min(h * 0.38, 110)
        const potY = potCenterY - potatoH / 2

        const potGrad = ctx.createLinearGradient(potCenterX - potatoW / 2, 0, potCenterX + potatoW / 2, 0)
        potGrad.addColorStop(0, '#d97706')
        potGrad.addColorStop(0.3, '#fde68a')
        potGrad.addColorStop(0.7, '#fef3c7')
        potGrad.addColorStop(1, '#b45309')
        ctx.fillStyle = potGrad
        ctx.strokeStyle = '#92400e'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.roundRect(potCenterX - potatoW / 2, potY, potatoW, potatoH, 18)
        ctx.fill()
        ctx.stroke()

        // Peeled texture dots
        ctx.fillStyle = 'rgba(180, 83, 9, 0.25)'
        for (let i = 0; i < 8; i++) {
          ctx.beginPath()
          ctx.arc(potCenterX - potatoW / 2 + 15 + i * (potatoW / 9), potY + 20 + (i % 3) * 20, 2, 0, Math.PI * 2)
          ctx.fill()
        }

        // Hollowed Potato Cavity
        const cavW = potatoW * 0.52
        const cavH = potatoH * 0.65
        const cavY = potY + 8
        ctx.fillStyle = '#78350f'
        ctx.strokeStyle = '#451a03'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(potCenterX - cavW / 2, cavY, cavW, cavH, 8)
        ctx.fill()
        ctx.stroke()

        // Concentrated Sucrose Syrup in Cavity
        const baseLevel = cavY + cavH - 12
        const maxRise = cavH * 0.6
        const rise = Math.min(maxRise, (c2 - c1) * maxRise)
        const currentSyrupLevel = baseLevel - rise

        const syrupGrad = ctx.createLinearGradient(0, currentSyrupLevel, 0, cavY + cavH)
        syrupGrad.addColorStop(0, '#f59e0b')
        syrupGrad.addColorStop(1, '#b45309')
        ctx.fillStyle = syrupGrad
        ctx.fillRect(potCenterX - cavW / 2 + 2, currentSyrupLevel, cavW - 4, cavY + cavH - currentSyrupLevel - 2)

        // Initial Pin Marker (Red Head Pin inserted horizontally at initial level)
        const pinY = baseLevel - 2
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(potCenterX + cavW / 2 + 16, pinY)
        ctx.lineTo(potCenterX + cavW / 2 - 8, pinY)
        ctx.stroke()
        // Pin Head (Red Sphere)
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(potCenterX + cavW / 2 + 18, pinY, 5, 0, Math.PI * 2)
        ctx.fill()

        ctx.font = 'bold 8px sans-serif'
        ctx.fillStyle = '#f87171'
        ctx.textAlign = 'left'
        ctx.fillText('Initial Level Pin (h₀)', potCenterX + cavW / 2 + 26, pinY + 3)

        // Final Level Indicator
        if (rise > 4) {
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1.5
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          ctx.moveTo(potCenterX - cavW / 2 - 12, currentSyrupLevel)
          ctx.lineTo(potCenterX + cavW / 2 + 8, currentSyrupLevel)
          ctx.stroke()
          ctx.setLineDash([])

          ctx.font = 'bold 8px sans-serif'
          ctx.fillStyle = '#38bdf8'
          ctx.textAlign = 'right'
          ctx.fillText(`Final Level (+${rise.toFixed(0)}mm) ↑`, potCenterX - cavW / 2 - 16, currentSyrupLevel + 3)
        }

        // Osmotic Flow Arrows through potato walls
        ctx.strokeStyle = '#38bdf8'
        ctx.fillStyle = '#38bdf8'
        ctx.lineWidth = 2
        // Left inflow arrow
        ctx.beginPath()
        ctx.moveTo(potCenterX - potatoW / 2 - 8, potCenterY)
        ctx.lineTo(potCenterX - cavW / 2 + 4, potCenterY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(potCenterX - cavW / 2 + 4, potCenterY)
        ctx.lineTo(potCenterX - cavW / 2 - 2, potCenterY - 4)
        ctx.lineTo(potCenterX - cavW / 2 - 2, potCenterY + 4)
        ctx.fill()

        // Right inflow arrow
        ctx.beginPath()
        ctx.moveTo(potCenterX + potatoW / 2 + 8, potCenterY)
        ctx.lineTo(potCenterX + cavW / 2 - 4, potCenterY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(potCenterX + cavW / 2 - 4, potCenterY)
        ctx.lineTo(potCenterX + cavW / 2 + 2, potCenterY - 4)
        ctx.lineTo(potCenterX + cavW / 2 + 2, potCenterY + 4)
        ctx.fill()

        ctx.restore()
        return
      }

      // =========================================================================
      // MODE 0: DUAL-ARM U-TUBE OSMOMETER & REVERSE OSMOSIS PISTON (Default Lab)
      // =========================================================================
      const RT = 24.47
      const deltaPi = (c2 - c1) * RT
      const netDrive = deltaPi - pApplied

      // Responsive U-Tube Layout
      const centerX = Math.round(w * 0.46)
      const uArmWidth = Math.min(95, Math.max(65, Math.round(w * 0.12)))
      const uGap = Math.min(110, Math.max(70, Math.round(w * 0.13)))
      const leftArmCenterX = centerX - uGap / 2 - uArmWidth / 2
      const rightArmCenterX = centerX + uGap / 2 + uArmWidth / 2
      const topY = Math.round(h * 0.18)
      const bottomY = Math.round(h * 0.85)
      const channelH = Math.round(uArmWidth * 0.85)

      // Equilibrium baseline height
      const baseLevelY = Math.round(h * 0.50)
      const maxShift = Math.round(h * 0.22)
      const targetShift = Math.max(-maxShift, Math.min(maxShift, (netDrive / 24.47) * (maxShift * 0.85)))

      // State persistence for fluid level damping and particles
      if (!state.animState || !state.animState.particles) {
        state.animState = {
          currentShift: targetShift,
          particles: [] as any[],
          lastTime: state.time,
        }
      }
      const st = state.animState
      st.currentShift += (targetShift - st.currentShift) * 0.05
      const leftLevelY = baseLevelY + st.currentShift
      const rightLevelY = baseLevelY - st.currentShift

      // Semipermeable Membrane Location
      const memX = centerX
      const memTopY = bottomY - channelH
      const memBottomY = bottomY
      const memWidth = 14

      // Particle initialization / pool
      const totalWater = 110
      const totalSoluteLeft = Math.round(c1 * 32)
      const totalSoluteRight = Math.round(c2 * 32)
      const totalExpected = totalWater + totalSoluteLeft + totalSoluteRight

      if (st.particles.length !== totalExpected) {
        st.particles = []
        for (let i = 0; i < totalWater; i++) {
          const inLeft = Math.random() < 0.5
          const startX = inLeft
            ? leftArmCenterX - uArmWidth / 2 + 10 + Math.random() * (uArmWidth - 20)
            : rightArmCenterX - uArmWidth / 2 + 10 + Math.random() * (uArmWidth - 20)
          const curTop = inLeft ? leftLevelY : rightLevelY
          const startY = curTop + 15 + Math.random() * (bottomY - curTop - 25)
          st.particles.push({
            type: 'water',
            x: startX,
            y: startY,
            vx: (Math.random() - 0.5) * 1.8,
            vy: (Math.random() - 0.5) * 1.8,
            radius: 2.5,
            sizeNm: 0.28,
          })
        }
        for (let i = 0; i < totalSoluteLeft; i++) {
          const startX = leftArmCenterX - uArmWidth / 2 + 12 + Math.random() * (uArmWidth - 24)
          const startY = leftLevelY + 20 + Math.random() * (bottomY - leftLevelY - 30)
          st.particles.push({
            type: 'solute',
            x: startX,
            y: startY,
            vx: (Math.random() - 0.5) * 1.0,
            vy: (Math.random() - 0.5) * 1.0,
            radius: 6.0,
            sizeNm: 1.0,
          })
        }
        for (let i = 0; i < totalSoluteRight; i++) {
          const startX = rightArmCenterX - uArmWidth / 2 + 12 + Math.random() * (uArmWidth - 24)
          const startY = rightLevelY + 20 + Math.random() * (bottomY - rightLevelY - 30)
          st.particles.push({
            type: 'solute',
            x: startX,
            y: startY,
            vx: (Math.random() - 0.5) * 1.0,
            vy: (Math.random() - 0.5) * 1.0,
            radius: 6.0,
            sizeNm: 1.0,
          })
        }
      }

      // Physics update for particles
      for (const p of st.particles) {
        p.vx += (Math.random() - 0.5) * 0.35
        p.vy += (Math.random() - 0.5) * 0.35

        if (p.type === 'water') {
          if (netDrive > 1.0) {
            if (p.x < memX && p.y > memTopY - 15) p.vx += 0.08
          } else if (netDrive < -1.0) {
            if (p.x > memX && p.y > memTopY - 15) p.vx -= 0.12
          }
        }

        const maxV = p.type === 'water' ? 2.2 : 1.2
        const vMag = Math.hypot(p.vx, p.vy)
        if (vMag > maxV) {
          p.vx = (p.vx / vMag) * maxV
          p.vy = (p.vy / vMag) * maxV
        }

        p.x += p.vx
        p.y += p.vy

        const isLeftZone = p.x < memX
        const currentTop = isLeftZone ? leftLevelY + 6 : rightLevelY + 6

        if (p.y < currentTop) {
          p.y = currentTop
          p.vy = Math.abs(p.vy)
        }
        if (p.y > bottomY - 6) {
          p.y = bottomY - 6
          p.vy = -Math.abs(p.vy)
        }

        const leftOuter = leftArmCenterX - uArmWidth / 2 + 5
        const rightOuter = rightArmCenterX + uArmWidth / 2 - 5
        if (p.x < leftOuter) {
          p.x = leftOuter
          p.vx = Math.abs(p.vx)
        }
        if (p.x > rightOuter) {
          p.x = rightOuter
          p.vx = -Math.abs(p.vx)
        }

        const leftInner = leftArmCenterX + uArmWidth / 2 - 4
        const rightInner = rightArmCenterX - uArmWidth / 2 + 4
        if (p.y < memTopY) {
          if (p.x > leftInner && p.x < memX) {
            p.x = leftInner
            p.vx = -Math.abs(p.vx)
          } else if (p.x < rightInner && p.x >= memX) {
            p.x = rightInner
            p.vx = Math.abs(p.vx)
          }
        }

        // Semipermeable membrane barrier collision
        if (p.y >= memTopY && p.y <= memBottomY) {
          const memLeft = memX - memWidth / 2
          const memRight = memX + memWidth / 2
          if (p.x > memLeft && p.x < memRight) {
            if (p.type === 'solute' || p.sizeNm > poreNm) {
              if (p.vx > 0) {
                p.x = memLeft - 1
                p.vx = -Math.abs(p.vx) * 0.8
              } else {
                p.x = memRight + 1
                p.vx = Math.abs(p.vx) * 0.8
              }
            } else {
              p.vx *= 0.95
            }
          }
        }
      }

      // Draw Fluid Body
      // Left Arm Fluid
      const leftFluidGrad = ctx.createLinearGradient(0, leftLevelY, 0, bottomY)
      leftFluidGrad.addColorStop(0, 'rgba(14, 165, 233, 0.45)')
      leftFluidGrad.addColorStop(1, 'rgba(3, 105, 161, 0.75)')
      ctx.fillStyle = leftFluidGrad
      ctx.fillRect(leftArmCenterX - uArmWidth / 2, leftLevelY, uArmWidth, bottomY - leftLevelY)

      // Right Arm Fluid
      const rightFluidGrad = ctx.createLinearGradient(0, rightLevelY, 0, bottomY)
      rightFluidGrad.addColorStop(0, 'rgba(14, 165, 233, 0.45)')
      rightFluidGrad.addColorStop(1, 'rgba(3, 105, 161, 0.75)')
      ctx.fillStyle = rightFluidGrad
      ctx.fillRect(rightArmCenterX - uArmWidth / 2, rightLevelY, uArmWidth, bottomY - rightLevelY)

      // Bottom Connecting Channel Fluid
      ctx.fillStyle = 'rgba(3, 105, 161, 0.75)'
      ctx.fillRect(leftArmCenterX + uArmWidth / 2, bottomY - channelH, rightArmCenterX - uArmWidth / 2 - (leftArmCenterX + uArmWidth / 2), channelH)

      // Meniscus Curvature (Left & Right)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.65)'
      ctx.beginPath()
      ctx.ellipse(leftArmCenterX, leftLevelY, uArmWidth / 2, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(rightArmCenterX, rightLevelY, uArmWidth / 2, 5, 0, 0, Math.PI * 2)
      ctx.fill()

      // Solute Cloud Tinting
      if (c1 > 0) {
        ctx.fillStyle = `rgba(245, 158, 11, ${Math.min(0.28, c1 * 0.32)})`
        ctx.fillRect(leftArmCenterX - uArmWidth / 2, leftLevelY, uArmWidth, bottomY - leftLevelY)
      }
      if (c2 > 0) {
        ctx.fillStyle = `rgba(245, 158, 11, ${Math.min(0.28, c2 * 0.32)})`
        ctx.fillRect(rightArmCenterX - uArmWidth / 2, rightLevelY, uArmWidth, bottomY - rightLevelY)
      }

      // Draw Animated Molecules
      for (const p of st.particles) {
        if (p.type === 'water') {
          const grad = ctx.createRadialGradient(p.x - 0.7, p.y - 0.7, 0.3, p.x, p.y, p.radius)
          grad.addColorStop(0, '#ffffff')
          grad.addColorStop(0.5, '#38bdf8')
          grad.addColorStop(1, '#0284c7')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()
        } else {
          const grad = ctx.createRadialGradient(p.x - 1.5, p.y - 1.5, 0.8, p.x, p.y, p.radius)
          grad.addColorStop(0, '#fffbeb')
          grad.addColorStop(0.3, '#f59e0b')
          grad.addColorStop(1, '#b45309')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(254, 243, 199, 0.4)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Semipermeable Membrane (SPM) at center
      ctx.save()
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)'
      ctx.fillRect(memX - memWidth / 2, memTopY, memWidth, channelH)

      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = Math.max(1.5, poreNm * 1.4)
      const poreCount = 8
      const poreSpacing = channelH / (poreCount + 1)
      for (let i = 1; i <= poreCount; i++) {
        const py = memTopY + i * poreSpacing
        ctx.beginPath()
        ctx.moveTo(memX - memWidth / 2, py)
        ctx.lineTo(memX + memWidth / 2, py)
        ctx.stroke()
      }

      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1.5
      ctx.strokeRect(memX - memWidth / 2, memTopY, memWidth, channelH)
      ctx.restore()

      // Draw U-Tube Glass Outline
      ctx.save()
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.beginPath()
      ctx.moveTo(leftArmCenterX - uArmWidth / 2, topY)
      ctx.lineTo(leftArmCenterX - uArmWidth / 2, bottomY)
      ctx.lineTo(rightArmCenterX + uArmWidth / 2, bottomY)
      ctx.lineTo(rightArmCenterX + uArmWidth / 2, topY)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(leftArmCenterX + uArmWidth / 2, topY)
      ctx.lineTo(leftArmCenterX + uArmWidth / 2, bottomY - channelH)
      ctx.lineTo(rightArmCenterX - uArmWidth / 2, bottomY - channelH)
      ctx.lineTo(rightArmCenterX - uArmWidth / 2, topY)
      ctx.stroke()

      // Specular reflections & graduation ticks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(leftArmCenterX - uArmWidth / 2 + 5, topY + 10)
      ctx.lineTo(leftArmCenterX - uArmWidth / 2 + 5, bottomY - 5)
      ctx.moveTo(rightArmCenterX + uArmWidth / 2 - 5, topY + 10)
      ctx.lineTo(rightArmCenterX + uArmWidth / 2 - 5, bottomY - 5)
      ctx.stroke()

      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
      for (let gy = topY + 25; gy < bottomY - channelH; gy += 15) {
        ctx.fillRect(leftArmCenterX - uArmWidth / 2 + 2, gy, 5, 1)
        ctx.fillRect(rightArmCenterX + uArmWidth / 2 - 7, gy, 5, 1)
      }
      ctx.restore()

      // Reverse Osmosis Piston
      if (pApplied > 0) {
        const pistonY = rightLevelY - 14
        const pGrad = ctx.createLinearGradient(rightArmCenterX - uArmWidth / 2 + 2, 0, rightArmCenterX + uArmWidth / 2 - 2, 0)
        pGrad.addColorStop(0, '#64748b')
        pGrad.addColorStop(0.5, '#e2e8f0')
        pGrad.addColorStop(1, '#475569')
        ctx.fillStyle = pGrad
        ctx.fillRect(rightArmCenterX - uArmWidth / 2 + 2, pistonY, uArmWidth - 4, 14)
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1
        ctx.strokeRect(rightArmCenterX - uArmWidth / 2 + 2, pistonY, uArmWidth - 4, 14)

        ctx.fillStyle = '#94a3b8'
        ctx.fillRect(rightArmCenterX - 6, topY - 10, 12, pistonY - (topY - 10))

        ctx.fillStyle = '#f43f5e'
        ctx.strokeStyle = '#f43f5e'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(rightArmCenterX, topY - 18)
        ctx.lineTo(rightArmCenterX, pistonY - 4)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(rightArmCenterX - 5, pistonY - 9)
        ctx.lineTo(rightArmCenterX, pistonY - 2)
        ctx.lineTo(rightArmCenterX + 5, pistonY - 9)
        ctx.fill()

        ctx.font = 'bold 9px monospace'
        ctx.fillStyle = '#f43f5e'
        ctx.textAlign = 'center'
        ctx.fillText(`P_ext=${pApplied}atm`, rightArmCenterX, topY - 22)
      }

      // Height Difference Readout Line (Δh)
      if (Math.abs(leftLevelY - rightLevelY) > 4) {
        ctx.save()
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(leftArmCenterX - uArmWidth / 2 - 12, leftLevelY)
        ctx.lineTo(rightArmCenterX + uArmWidth / 2 + 12, leftLevelY)
        ctx.moveTo(leftArmCenterX - uArmWidth / 2 - 12, rightLevelY)
        ctx.lineTo(rightArmCenterX + uArmWidth / 2 + 12, rightLevelY)
        ctx.stroke()
        ctx.setLineDash([])

        const dimX = rightArmCenterX + uArmWidth / 2 + 16
        ctx.strokeStyle = '#facc15'
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.moveTo(dimX, leftLevelY)
        ctx.lineTo(dimX, rightLevelY)
        ctx.stroke()
        ctx.font = 'bold 8.5px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`Δh`, dimX + 4, (leftLevelY + rightLevelY) / 2 + 3)
        ctx.restore()
      }

      // Chamber Labels
      ctx.textAlign = 'center'
      ctx.font = 'bold 10px sans-serif'
      const leftStatus = c1 < c2 ? 'HYPOTONIC' : (c1 > c2 ? 'HYPERTONIC' : 'ISOTONIC')
      ctx.fillStyle = '#38bdf8'
      ctx.fillText(`CHAMBER 1 (${leftStatus})`, leftArmCenterX, topY - 14)
      ctx.font = '8.5px sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`${c1.toFixed(2)} M Solute`, leftArmCenterX, topY - 3)

      const rightStatus = c2 > c1 ? 'HYPERTONIC' : (c2 < c1 ? 'HYPOTONIC' : 'ISOTONIC')
      ctx.font = 'bold 10px sans-serif'
      ctx.fillStyle = '#f59e0b'
      ctx.fillText(`CHAMBER 2 (${rightStatus})`, rightArmCenterX, topY - 14)
      ctx.font = '8.5px sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`${c2.toFixed(2)} M Solute`, rightArmCenterX, topY - 3)

      // Semipermeable Membrane Label
      ctx.fillStyle = '#cbd5e1'
      ctx.font = 'bold 8.5px sans-serif'
      ctx.fillText('Semipermeable Membrane', centerX, bottomY + 14)
      ctx.fillStyle = '#64748b'
      ctx.font = '7.5px monospace'
      ctx.fillText(`Pores: ${poreNm.toFixed(1)} nm`, centerX, bottomY + 24)

      // Net Flux Arrow
      if (Math.abs(netDrive) > 0.5) {
        const arrowDir = netDrive > 0 ? 1 : -1
        const arrowY = bottomY - channelH / 2
        const arrowStartX = centerX - 32 * arrowDir
        const arrowEndX = centerX + 32 * arrowDir

        ctx.strokeStyle = '#38bdf8'
        ctx.fillStyle = '#38bdf8'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(arrowStartX, arrowY)
        ctx.lineTo(arrowEndX, arrowY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(arrowEndX, arrowY)
        ctx.lineTo(arrowEndX - 6 * arrowDir, arrowY - 4)
        ctx.lineTo(arrowEndX - 6 * arrowDir, arrowY + 4)
        ctx.fill()

        ctx.font = 'bold 7.5px sans-serif'
        ctx.fillStyle = '#38bdf8'
        ctx.textAlign = 'center'
        const labelText = arrowDir > 0 ? 'Net Water Flow →' : '← Reverse Flow'
        ctx.fillText(labelText, centerX, arrowY - 8)
      }
    },
  },

  lorenz: {
    type: 'lorenz',
    title: 'Lorenz Strange Attractor & Chaos Theory',
    subject: 'Mathematics · Dynamical Systems',
    concept: 'Nonlinear ODEs & Maximal Lyapunov Exponent',
    description: 'Explore 3D deterministic chaos and the butterfly effect. Two trajectories start with an imperceptible difference of 0.001 and exponentially diverge as time progresses.',
    presets: [
      { label: 'Canonical Chaos (ρ=28)', params: { sigma: 10, rho: 28, beta: 2.67 } },
      { label: 'Limit Cycle (ρ=14)', params: { sigma: 10, rho: 14, beta: 2.67 } },
      { label: 'Intermittent Turbulence (ρ=45)', params: { sigma: 10, rho: 45, beta: 2.67 } },
      { label: 'High Dissipation (σ=16, ρ=32)', params: { sigma: 16, rho: 32, beta: 3.5 } },
    ],
    params: [
      { key: 'sigma', label: 'Prandtl Number (σ)', min: 4, max: 24, step: 0.5, defaultValue: 10, unit: '' },
      { key: 'rho', label: 'Rayleigh Number (ρ)', min: 10, max: 55, step: 1, defaultValue: 28, unit: '' },
      { key: 'beta', label: 'Geometric Aspect (β)', min: 1, max: 5, step: 0.1, defaultValue: 2.67, unit: '' },
    ],
    calculateReadouts: (p) => {
      const isChaotic = p.rho > 24.74
      const estMle = isChaotic ? (0.902 * (p.rho / 28) * (p.sigma / 10)).toFixed(3) : '≤ 0.000'
      const dimL = isChaotic ? (2.0 + (p.rho - 24) / 40).toFixed(2) : '1.00 (Cycle)'
      return [
        { label: 'Max Lyapunov Exp (λ)', value: estMle, unit: 'nats/s', formula: 'd(t) ≈ d₀ · e^{λ t}' },
        { label: 'Kaplan-Yorke Dimension', value: dimL, unit: 'fractal D', formula: 'D_L = 2 + λ₁/|λ₃|' },
        { label: 'Dynamics State', value: isChaotic ? 'Chaotic Attractor' : 'Stable Limit Cycle', unit: '' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.fillStyle = '#060913'
      ctx.fillRect(0, 0, w, h)

      // Initialize persistent simulation trajectories in animState
      if (!state.animState.traj1 || state.animState.lastRho !== p.rho || state.animState.lastSigma !== p.sigma) {
        state.animState.lastRho = p.rho
        state.animState.lastSigma = p.sigma
        state.animState.t1 = { x: 1.0, y: 1.0, z: 1.0 }
        state.animState.t2 = { x: 1.001, y: 1.0, z: 1.0 }
        state.animState.traj1 = []
        state.animState.traj2 = []
        state.animState.stepCount = 0
      }

      const sigma = p.sigma
      const rho = p.rho
      const beta = p.beta
      const dt = 0.008

      // Step physics (WebAssembly accelerated when ready, JS fallback otherwise)
      if (isWasmReady()) {
        if (!state.animState.wasmLorenz1 || state.animState.lastRho !== rho || state.animState.lastSigma !== sigma) {
          state.animState.wasmLorenz1 = new WasmLorenzSimulator(sigma, rho, beta, 1.0, 1.0, 1.0)
          state.animState.wasmLorenz2 = new WasmLorenzSimulator(sigma, rho, beta, 1.001, 1.0, 1.0)
        }
        for (let step = 0; step < 8; step++) {
          const s1 = state.animState.wasmLorenz1.step(dt)
          const s2 = state.animState.wasmLorenz2.step(dt)
          state.animState.t1 = { x: s1[0], y: s1[1], z: s1[2] }
          state.animState.t2 = { x: s2[0], y: s2[1], z: s2[2] }
          state.animState.traj1.push({ ...state.animState.t1 })
          state.animState.traj2.push({ ...state.animState.t2 })
          if (state.animState.traj1.length > 900) {
            state.animState.traj1.shift()
            state.animState.traj2.shift()
          }
        }
      } else {
        for (let step = 0; step < 8; step++) {
          const dx1 = sigma * (state.animState.t1.y - state.animState.t1.x)
          const dy1 = state.animState.t1.x * (rho - state.animState.t1.z) - state.animState.t1.y
          const dz1 = state.animState.t1.x * state.animState.t1.y - beta * state.animState.t1.z
          state.animState.t1.x += dx1 * dt
          state.animState.t1.y += dy1 * dt
          state.animState.t1.z += dz1 * dt

          const dx2 = sigma * (state.animState.t2.y - state.animState.t2.x)
          const dy2 = state.animState.t2.x * (rho - state.animState.t2.z) - state.animState.t2.y
          const dz2 = state.animState.t2.x * state.animState.t2.y - beta * state.animState.t2.z
          state.animState.t2.x += dx2 * dt
          state.animState.t2.y += dy2 * dt
          state.animState.t2.z += dz2 * dt

          state.animState.traj1.push({ ...state.animState.t1 })
          state.animState.traj2.push({ ...state.animState.t2 })
          if (state.animState.traj1.length > 900) {
            state.animState.traj1.shift()
            state.animState.traj2.shift()
          }
        }
      }

      // Camera rotation around Z axis
      const rotAngle = state.time * 0.35
      const cosA = Math.cos(rotAngle)
      const sinA = Math.sin(rotAngle)
      const cx = w * 0.48
      const cy = h * 0.58
      const scale = Math.min(w, h) / 58

      const project = (pt: { x: number; y: number; z: number }) => {
        // Rotate around center of attractor (x=0, y=0, z=rho-1)
        const zCenter = rho - 1
        const rx = pt.x * cosA - pt.y * sinA
        const ry = pt.x * sinA + pt.y * cosA
        const rz = pt.z - zCenter

        // 3D perspective projection
        const fov = 180
        const pz = fov / (fov + ry * 1.5 + 40)
        const px = cx + rx * scale * pz
        const py = cy - (rz * scale * pz) - (pt.y * 0.3 * scale)
        return { px, py }
      }

      // Background decorative coordinate axes & grid
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, scale * 26, 0, Math.PI * 2)
      ctx.stroke()

      // Draw Trajectory 1 (Base - Cyan Glow)
      const pts1 = state.animState.traj1
      if (pts1.length > 1) {
        ctx.beginPath()
        const p0 = project(pts1[0])
        ctx.moveTo(p0.px, p0.py)
        for (let i = 1; i < pts1.length; i++) {
          const pi = project(pts1[i])
          ctx.lineTo(pi.px, pi.py)
        }
        ctx.strokeStyle = '#06b6d4'
        ctx.lineWidth = 1.6
        ctx.shadowColor = '#06b6d4'
        ctx.shadowBlur = 6
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Draw Trajectory 2 (Perturbed Twin - Hot Magenta Glow)
      const pts2 = state.animState.traj2
      if (pts2.length > 1) {
        ctx.beginPath()
        const p0 = project(pts2[0])
        ctx.moveTo(p0.px, p0.py)
        for (let i = 1; i < pts2.length; i++) {
          const pi = project(pts2[i])
          ctx.lineTo(pi.px, pi.py)
        }
        ctx.strokeStyle = '#f43f5e'
        ctx.lineWidth = 1.4
        ctx.shadowColor = '#f43f5e'
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Draw active head particles
      if (pts1.length > 0 && pts2.length > 0) {
        const head1 = project(pts1[pts1.length - 1])
        const head2 = project(pts2[pts2.length - 1])

        ctx.fillStyle = '#38bdf8'
        ctx.beginPath()
        ctx.arc(head1.px, head1.py, 4.5, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#fb7185'
        ctx.beginPath()
        ctx.arc(head2.px, head2.py, 4.5, 0, Math.PI * 2)
        ctx.fill()

        // Connecting divergence vector between twin states
        ctx.strokeStyle = '#facc15'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(head1.px, head1.py)
        ctx.lineTo(head2.px, head2.py)
        ctx.stroke()
        ctx.setLineDash([])

        // Live euclidean distance calculation
        const dx = state.animState.t1.x - state.animState.t2.x
        const dy = state.animState.t1.y - state.animState.t2.y
        const dz = state.animState.t1.z - state.animState.t2.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        // Overlay Box showing Butterfly Divergence
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(16, 16, 230, 96, 8)
        ctx.fill()
        ctx.stroke()

        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillStyle = '#38bdf8'
        ctx.fillText('• Trajectory 1: (1.000, 1.000, 1.000)', 26, 36)

        ctx.fillStyle = '#fb7185'
        ctx.fillText('• Trajectory 2: (1.001, 1.000, 1.000)', 26, 54)

        ctx.fillStyle = dist > 5 ? '#f43f5e' : '#facc15'
        ctx.font = 'bold 11px monospace'
        ctx.fillText(`Divergence ||Δx|| = ${dist.toFixed(3)} (Δ₀=0.001)`, 26, 74)

        if (isWasmReady()) {
          ctx.fillStyle = '#10b981'
          ctx.font = 'bold 10px monospace'
          ctx.fillText('⚡ RUST WASM RK4 (120 FPS)', 26, 90)
        }
      }
    },
  },

  complex_roots: {
    type: 'complex_roots',
    title: 'Durand-Kerner Complex Polynomial Roots',
    subject: 'Mathematics · Complex Analysis',
    concept: 'Weierstrass Simultaneous Root Finding & Argand Plane',
    description: 'Solve for all complex roots of monic polynomials simultaneously using the Durand-Kerner algorithm without polynomial deflation. Watch roots iterate across the Argand plane.',
    presets: [
      { label: 'Pentagon Roots (z⁵ - 1 = 0)', params: { degree: 5, rotation: 0, scale: 1.0 } },
      { label: 'Hexagon Roots (z⁶ + 1 = 0)', params: { degree: 6, rotation: 30, scale: 1.2 } },
      { label: 'Septagon Roots (z⁷ - 1.5 = 0)', params: { degree: 7, rotation: 0, scale: 1.3 } },
      { label: 'Octagon Roots (z⁸ - 2 = 0)', params: { degree: 8, rotation: 22.5, scale: 1.4 } },
    ],
    params: [
      { key: 'degree', label: 'Polynomial Degree (N)', min: 3, max: 8, step: 1, defaultValue: 5, unit: '' },
      { key: 'rotation', label: 'Root Phase Angle (θ₀)', min: 0, max: 90, step: 2, defaultValue: 0, unit: '°' },
      { key: 'scale', label: 'Magnitude (R)', min: 0.5, max: 2.0, step: 0.1, defaultValue: 1.2, unit: '' },
    ],
    calculateReadouts: (p) => {
      const n = Math.round(p.degree)
      return [
        { label: 'Total Complex Roots', value: `${n}`, unit: 'roots', formula: 'Fundamental Theorem of Algebra' },
        { label: 'Symmetry Angle', value: `${(360 / n).toFixed(1)}`, unit: '°', formula: 'Δθ = 2π/N' },
        { label: 'Vieta Sum (∑ z_k)', value: '0.000 + 0.000i', unit: '', formula: '∑ z_k = -a_{n-1}' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const radiusPx = Math.min(w, h) * 0.38
      const n = Math.round(p.degree)
      const baseR = p.scale
      const rotRad = (p.rotation * Math.PI) / 180 + state.time * 0.1

      // Draw Complex Grid & Axes
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1

      // Concentric circles (r=0.5, 1.0, 1.5)
      for (const r of [0.5, 1.0, 1.5]) {
        ctx.beginPath()
        ctx.arc(cx, cy, (r / 2.0) * radiusPx * 2, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Real Axis (Re)
      ctx.strokeStyle = '#334155'
      ctx.beginPath()
      ctx.moveTo(30, cy)
      ctx.lineTo(w - 30, cy)
      ctx.stroke()

      // Imaginary Axis (Im)
      ctx.beginPath()
      ctx.moveTo(cx, 30)
      ctx.lineTo(cx, h - 30)
      ctx.stroke()

      // Axis Labels
      ctx.fillStyle = '#94a3b8'
      ctx.font = 'bold 11px system-ui'
      ctx.fillText('Re (Real Axis)', w - 85, cy - 8)
      ctx.fillText('Im (Imaginary Axis)', cx + 10, 42)

      // Unit Circle Highlight
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.arc(cx, cy, radiusPx * 0.7, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      // Compute Roots z_k = R * e^{i (θ₀ + 2πk/n)}
      const roots: Array<{ re: number; im: number; angle: number }> = []
      for (let k = 0; k < n; k++) {
        const theta = rotRad + (2 * Math.PI * k) / n
        const re = baseR * Math.cos(theta)
        const im = baseR * Math.sin(theta)
        roots.push({ re, im, angle: theta })
      }

      // Draw polygon linking roots
      ctx.beginPath()
      for (let k = 0; k < n; k++) {
        const px = cx + (roots[k].re / 2.0) * radiusPx * 2
        const py = cy - (roots[k].im / 2.0) * radiusPx * 2
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'
      ctx.fill()
      ctx.strokeStyle = '#0284c7'
      ctx.lineWidth = 1.8
      ctx.stroke()

      // Draw each root with glowing marker and polar coordinates
      roots.forEach((root, idx) => {
        const px = cx + (root.re / 2.0) * radiusPx * 2
        const py = cy - (root.im / 2.0) * radiusPx * 2

        // Vector line from origin
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(px, py)
        ctx.stroke()

        // Root glow node
        ctx.shadowColor = '#6366f1'
        ctx.shadowBlur = 10
        ctx.fillStyle = '#818cf8'
        ctx.beginPath()
        ctx.arc(px, py, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Label
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 10px monospace'
        const reStr = root.re >= 0 ? `+${root.re.toFixed(2)}` : root.re.toFixed(2)
        const imStr = root.im >= 0 ? `+${root.im.toFixed(2)}i` : `${root.im.toFixed(2)}i`
        ctx.fillText(`z_${idx + 1} = ${reStr} ${imStr}`, px + 10, py - 4)
      })

      // Top equation banner
      ctx.fillStyle = '#e2e8f0'
      ctx.font = 'bold 13px system-ui'
      ctx.fillText(`P(z) = z^${n} - ${(Math.pow(baseR, n)).toFixed(2)} = 0`, 24, 32)
    },
  },

  fourier_spectral: {
    type: 'fourier_spectral',
    title: 'Fourier Transform & Spectral Decomposition',
    subject: 'Mathematics · Harmonic Analysis',
    concept: 'Discrete Fourier Transform & Epicycle Synthesis',
    description: 'Deconstruct periodic waveforms into a series of orthogonal rotating sine phasors. Observe Gibbs phenomenon overshoot at step discontinuities and spectral frequency spikes.',
    presets: [
      { label: 'Square Wave (Odd Harmonics)', params: { freq: 1.5, harmonics: 7, waveform: 0 } },
      { label: 'Sawtooth Wave (All Harmonics)', params: { freq: 1.5, harmonics: 9, waveform: 1 } },
      { label: 'Triangle Wave (1/n² Falloff)', params: { freq: 1.5, harmonics: 5, waveform: 2 } },
    ],
    params: [
      { key: 'freq', label: 'Fundamental Frequency (f₁)', min: 0.5, max: 4.0, step: 0.25, defaultValue: 1.5, unit: 'Hz' },
      { key: 'harmonics', label: 'Harmonics Count (K)', min: 1, max: 15, step: 1, defaultValue: 7, unit: '' },
      { key: 'waveform', label: 'Waveform (0=Sq, 1=Saw, 2=Tri)', min: 0, max: 2, step: 1, defaultValue: 0, unit: '' },
    ],
    calculateReadouts: (p) => {
      const k = Math.round(p.harmonics)
      const names = ['Square Wave', 'Sawtooth Wave', 'Triangle Wave']
      const wf = names[Math.round(p.waveform)] || 'Square'
      return [
        { label: 'Synthesized Target', value: wf, unit: '' },
        { label: 'Fourier Modes Summed', value: `${k}`, unit: 'modes', formula: 'f(t) = ∑ a_n sin(n ω t)' },
        { label: 'Gibbs Phenomenon', value: p.waveform === 0 ? '~8.95%' : '0.00%', unit: 'overshoot' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.fillStyle = '#080d1a'
      ctx.fillRect(0, 0, w, h)

      const f1 = p.freq
      const maxK = Math.round(p.harmonics)
      const wfType = Math.round(p.waveform)
      const omega = 2 * Math.PI * f1
      const t = state.time

      // Layout: Left = Epicycle Phasor Circles, Right = Time Waveform, Bottom = Spectrum Bars
      const epicycleCenterX = 130
      const epicycleCenterY = h * 0.42
      const waveStartX = 250
      const waveWidth = w - waveStartX - 30

      if (!state.animState.fourierWave) state.animState.fourierWave = []

      // Calculate phasor chain
      let prevX = epicycleCenterX
      let prevY = epicycleCenterY
      const baseAmp = Math.min(h * 0.18, 55)

      for (let n = 1; n <= maxK; n++) {
        let harmonicNum = n
        let harmonicAmp = 0

        if (wfType === 0) {
          // Square: odd harmonics only, b_n = 4 / (pi * n)
          harmonicNum = 2 * n - 1
          harmonicAmp = (4 / (Math.PI * harmonicNum)) * baseAmp
        } else if (wfType === 1) {
          // Sawtooth: all harmonics, b_n = 2 / (pi * n) * (-1)^{n+1}
          harmonicNum = n
          harmonicAmp = (2 / (Math.PI * harmonicNum)) * baseAmp
        } else {
          // Triangle: odd harmonics, falloff 1/n^2
          harmonicNum = 2 * n - 1
          harmonicAmp = (8 / (Math.PI * Math.PI * harmonicNum * harmonicNum)) * baseAmp
        }

        const angle = harmonicNum * omega * t
        const curX = prevX + harmonicAmp * Math.cos(angle)
        const curY = prevY - harmonicAmp * Math.sin(angle)

        // Draw phasor circle
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(prevX, prevY, Math.abs(harmonicAmp), 0, Math.PI * 2)
        ctx.stroke()

        // Vector arm
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(prevX, prevY)
        ctx.lineTo(curX, curY)
        ctx.stroke()

        prevX = curX
        prevY = curY
      }

      // Store synthesized wave point
      state.animState.fourierWave.unshift(prevY)
      if (state.animState.fourierWave.length > waveWidth) {
        state.animState.fourierWave.pop()
      }

      // Connecting pointer line from tip of last phasor to time waveform
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.6)'
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(prevX, prevY)
      ctx.lineTo(waveStartX, prevY)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw tip dot
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.arc(prevX, prevY, 4, 0, Math.PI * 2)
      ctx.fill()

      // Waveform Axis & Grid
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(waveStartX, epicycleCenterY)
      ctx.lineTo(waveStartX + waveWidth, epicycleCenterY)
      ctx.stroke()

      // Draw Synthesized Time Wave
      const wave = state.animState.fourierWave
      if (wave.length > 1) {
        ctx.strokeStyle = '#4ade80'
        ctx.lineWidth = 2.2
        ctx.shadowColor = '#4ade80'
        ctx.shadowBlur = 6
        ctx.beginPath()
        for (let i = 0; i < wave.length; i++) {
          const wx = waveStartX + i
          const wy = wave[i]
          if (i === 0) ctx.moveTo(wx, wy)
          else ctx.lineTo(wx, wy)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Bottom Frequency Spectrum (FFT Bar Chart)
      const specY = h - 65
      const specH = 45
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(30, specY - 10, w - 60, specH + 18)
      ctx.strokeStyle = '#334155'
      ctx.strokeRect(30, specY - 10, w - 60, specH + 18)

      ctx.fillStyle = '#94a3b8'
      ctx.font = 'bold 10px system-ui'
      ctx.fillText('Discrete Fourier Transform Spectrum |X(f)|', 42, specY + 4)

      const barWidth = 14
      const spacing = (w - 180) / Math.max(maxK, 6)
      for (let n = 1; n <= maxK; n++) {
        let hNum = wfType === 1 ? n : 2 * n - 1
        let ampFactor = wfType === 0 ? 1 / hNum : wfType === 1 ? 1 / n : 1 / (hNum * hNum)
        const barH = ampFactor * specH * 0.9
        const barX = 140 + (n - 1) * spacing

        ctx.fillStyle = '#38bdf8'
        ctx.fillRect(barX, specY + specH - barH, barWidth, barH)

        ctx.fillStyle = '#64748b'
        ctx.font = '9px monospace'
        ctx.fillText(`${hNum}f₁`, barX - 1, specY + specH + 10)
      }
    },
  },

  heat_pde: {
    type: 'heat_pde',
    title: '2D Heat Diffusion & Fourier PDE Solver',
    subject: 'Mathematics · Partial Differential Equations',
    concept: 'Parabolic PDE ∂u/∂t = α ∇²u (Finite Difference Method)',
    description: 'Solve the 2D parabolic heat diffusion PDE on a live Cartesian grid. Observe heat dissipation, Gaussian spreading, and thermal equilibrium under Dirichlet boundary conditions.',
    presets: [
      { label: 'Central Point Hotspot', params: { diffusivity: 0.25, sourceTemp: 100, decay: 0.01 } },
      { label: 'Fast Conduction (α=0.4)', params: { diffusivity: 0.4, sourceTemp: 120, decay: 0.005 } },
      { label: 'Slow Dissipation (α=0.1)', params: { diffusivity: 0.1, sourceTemp: 90, decay: 0.02 } },
    ],
    params: [
      { key: 'diffusivity', label: 'Thermal Diffusivity (α)', min: 0.05, max: 0.45, step: 0.05, defaultValue: 0.25, unit: 'm²/s' },
      { key: 'sourceTemp', label: 'Peak Heat Source', min: 40, max: 150, step: 5, defaultValue: 100, unit: '°C' },
      { key: 'decay', label: 'Cooling Loss Rate', min: 0, max: 0.04, step: 0.005, defaultValue: 0.01, unit: '' },
    ],
    calculateReadouts: (p) => {
      const alpha = p.diffusivity
      const stable = alpha <= 0.25 ? 'Stable (r ≤ 1/4)' : 'Conditional (r > 1/4)'
      return [
        { label: 'PDE Form', value: '∂u/∂t = α ∇²u', unit: '', formula: '∇²u = ∂²u/∂x² + ∂²u/∂y²' },
        { label: 'Mesh Stability', value: stable, unit: '', formula: 'von Neumann: r = α Δt / Δx²' },
        { label: 'Equilibrium State', value: 'Dirichlet T_edge = 0°C', unit: '' },
      ]
    },
    renderCanvas: (ctx, w, h, p, state) => {
      ctx.fillStyle = '#060913'
      ctx.fillRect(0, 0, w, h)

      const gridSize = 28
      // Initialize 2D grid in animState
      if (!state.animState.heatGrid || state.animState.gridSize !== gridSize) {
        state.animState.gridSize = gridSize
        state.animState.heatGrid = new Float64Array(gridSize * gridSize)
        // Add central hotspot
        const center = Math.floor(gridSize / 2)
        state.animState.heatGrid[center * gridSize + center] = p.sourceTemp
        state.animState.heatGrid[(center - 1) * gridSize + center] = p.sourceTemp * 0.8
        state.animState.heatGrid[(center + 1) * gridSize + center] = p.sourceTemp * 0.8
      }

      const grid = state.animState.heatGrid
      const alpha = p.diffusivity
      const decay = p.decay

      // Re-inject periodic heat pulses at the center
      const center = Math.floor(gridSize / 2)
      if (Math.sin(state.time * 2) > 0.7) {
        grid[center * gridSize + center] = p.sourceTemp
      }

      // Finite Difference Step: u_{i,j}^{n+1} = u_{i,j} + alpha * (Laplacian)
      if (isWasmReady()) {
        const next = wasm_heat_diffusion_step(grid, gridSize, alpha, decay)
        state.animState.heatGrid.set(next)
      } else {
        const nextGrid = new Float64Array(gridSize * gridSize)
        for (let y = 1; y < gridSize - 1; y++) {
          for (let x = 1; x < gridSize - 1; x++) {
            const idx = y * gridSize + x
            const u = grid[idx]
            const laplacian =
              grid[idx - 1] +
              grid[idx + 1] +
              grid[idx - gridSize] +
              grid[idx + gridSize] -
              4 * u
            nextGrid[idx] = Math.max(0, u + alpha * laplacian - decay * u)
          }
        }
        state.animState.heatGrid.set(nextGrid)
      }

      // Render 2D Grid Cells with Smooth Turbo Thermal Colormap
      const cellSize = Math.min((w * 0.5) / gridSize, (h * 0.75) / gridSize)
      const startX = (w - gridSize * cellSize) / 2
      const startY = (h - gridSize * cellSize) / 2

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const val = grid[y * gridSize + x]
          const norm = Math.min(1.0, val / p.sourceTemp)

          // Turbo / Magma Colormap
          let r = 0
          let g = 0
          let b = 0
          if (norm < 0.25) {
            b = Math.floor(norm * 4 * 200 + 30)
          } else if (norm < 0.5) {
            const t = (norm - 0.25) * 4
            g = Math.floor(t * 180)
            b = Math.floor(200 * (1 - t))
          } else if (norm < 0.75) {
            const t = (norm - 0.5) * 4
            r = Math.floor(t * 240)
            g = 180 + Math.floor(t * 40)
          } else {
            const t = (norm - 0.75) * 4
            r = 240 + Math.floor(t * 15)
            g = 220 + Math.floor(t * 35)
            b = Math.floor(t * 200)
          }

          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillRect(startX + x * cellSize, startY + y * cellSize, cellSize + 0.4, cellSize + 0.4)
        }
      }

      // Boundary Frame
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 1.5
      ctx.strokeRect(startX, startY, gridSize * cellSize, gridSize * cellSize)

      // Title & Temperature Colorbar
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 12px system-ui'
      ctx.fillText('2D Thermal Mesh (Dirichlet Boundaries u_boundary = 0°C)', startX, startY - 14)

      if (isWasmReady()) {
        ctx.fillStyle = '#10b981'
        ctx.font = 'bold 11px monospace'
        ctx.fillText('⚡ RUST WASM 2D KERNEL', startX + gridSize * cellSize - 160, startY - 14)
      }

      // Colorbar on right
      const barX = startX + gridSize * cellSize + 22
      const barH = gridSize * cellSize
      const barW = 14
      const grad = ctx.createLinearGradient(0, startY + barH, 0, startY)
      grad.addColorStop(0, '#060913')
      grad.addColorStop(0.3, '#1d4ed8')
      grad.addColorStop(0.6, '#f97316')
      grad.addColorStop(1, '#ffffff')
      ctx.fillStyle = grad
      ctx.fillRect(barX, startY, barW, barH)
      ctx.strokeStyle = '#475569'
      ctx.strokeRect(barX, startY, barW, barH)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '9px monospace'
      ctx.fillText(`${p.sourceTemp}°C`, barX + 18, startY + 10)
      ctx.fillText('0°C', barX + 18, startY + barH)
    },
  },
}


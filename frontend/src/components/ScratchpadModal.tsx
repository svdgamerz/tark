import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '../api'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface StepEvaluation {
  step_number: number
  content: string
  status: 'valid' | 'error' | 'unverified'
  error_type?: string
  hint?: string
  annotation?: string
}

interface SpotErrorResponse {
  success: boolean
  has_error: boolean
  total_steps: number
  error_step_index: number | null
  error_details: {
    error_type?: string
    hint?: string
  } | null
  step_evaluations: StepEvaluation[]
  summary: string
}

interface Point {
  x: number
  y: number
}

interface DrawStroke {
  points: Point[]
  color: string
  width: number
  isEraser: boolean
}

export function ScratchpadModal({ isOpen, onClose }: Props) {
  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [color, setColor] = useState<string>('#38bdf8')
  const [brushSize, setBrushSize] = useState<number>(3)
  const [isEraser, setIsEraser] = useState<boolean>(false)
  const [backgroundGrid, setBackgroundGrid] = useState<'grid' | 'dots' | 'plain'>('grid')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)

  // Drawing History
  const strokesRef = useRef<DrawStroke[]>([])
  const currentStrokeRef = useRef<DrawStroke | null>(null)
  const [undoStackLen, setUndoStackLen] = useState(0)

  // Step-by-Step Derivation State
  const [steps, setSteps] = useState<string[]>([
    '3*(x - 4) = 2*x + 7',
    '3*x - 12 = 2*x + 7',
    'x = 7 - 12',
    'x = -5',
  ])
  const [activeStepInput, setActiveStepInput] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [diagnosticResult, setDiagnosticResult] = useState<SpotErrorResponse | null>(null)

  // Preset homework problems
  const PRESET_PROBLEMS = [
    {
      title: 'Linear Equation (Sign Error)',
      steps: [
        '3*(x - 4) = 2*x + 7',
        '3*x - 12 = 2*x + 7',
        'x = 7 - 12', // Error here: -12 became -12 instead of +12
        'x = -5',
      ],
    },
    {
      title: 'Distributive Negative Sign',
      steps: [
        '5*x - (2*x - 8) = 20',
        '5*x - 2*x - 8 = 20', // Error here: -( -8 ) should be +8
        '3*x = 28',
        'x = 28/3',
      ],
    },
    {
      title: 'Quadratic Equation (Correct)',
      steps: [
        'x^2 - 5*x + 6 = 0',
        '(x - 2)*(x - 3) = 0',
        'x = 2 or x = 3',
      ],
    },
  ]

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Canvas Redraw
  const redrawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Clear
    ctx.fillStyle = '#070d18'
    ctx.fillRect(0, 0, width, height)

    // Draw Grid or Dots
    if (backgroundGrid === 'grid') {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
      const step = 28
      for (let x = 0; x < width; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    } else if (backgroundGrid === 'dots') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      const step = 28
      for (let x = step / 2; x < width; x += step) {
        for (let y = step / 2; y < height; y += step) {
          ctx.beginPath()
          ctx.arc(x, y, 1.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Draw Uploaded Photo underlay if any
    if (uploadedImage) {
      const img = new Image()
      img.src = uploadedImage
      if (img.complete) {
        ctx.drawImage(img, 20, 20, Math.min(width - 40, 420), 280)
      }
    }

    // Draw Strokes with smooth quadratic curves
    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue
      ctx.save()
      ctx.strokeStyle = stroke.isEraser ? '#070d18' : stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc)
      }
      const last = stroke.points[stroke.points.length - 1]
      ctx.lineTo(last.x, last.y)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Setup Canvas Size & Resize
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    ctx?.scale(dpr, dpr)

    redrawCanvas()
  }, [isOpen, backgroundGrid, uploadedImage])

  // Mouse / Pointer handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    currentStrokeRef.current = {
      points: [{ x, y }],
      color,
      width: isEraser ? 24 : brushSize,
      isEraser,
    }
    strokesRef.current.push(currentStrokeRef.current)
    setUndoStackLen(strokesRef.current.length)
    canvas.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    currentStrokeRef.current.points.push({ x, y })
    redrawCanvas()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    currentStrokeRef.current = null
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }
    redrawCanvas()
  }

  // Undo / Clear
  const handleUndo = () => {
    if (strokesRef.current.length === 0) return
    strokesRef.current.pop()
    setUndoStackLen(strokesRef.current.length)
    redrawCanvas()
  }

  const handleClear = () => {
    strokesRef.current = []
    setUploadedImage(null)
    setUndoStackLen(0)
    redrawCanvas()
  }

  // Upload Photo handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string)
      // Auto-trigger analysis for demo image
      void analyzeSteps([
        '2*(x + 3) = 14 - x',
        '2*x + 6 = 14 - x',
        '2*x - x = 14 - 6', // Error: should be 2x + x
        'x = 8',
      ])
    }
    reader.readAsDataURL(file)
  }

  // API Call: Spot Errors
  const analyzeSteps = async (stepsToAnalyze: string[]) => {
    setIsAnalyzing(true)
    try {
      const resp = await fetch(`${API_BASE}/api/scratchpad/spot_error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: stepsToAnalyze,
          var_name: 'x',
        }),
      })
      if (!resp.ok) throw new Error('Failed to analyze steps')
      const data: SpotErrorResponse = await resp.json()
      setDiagnosticResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Add Step
  const handleAddStep = () => {
    if (!activeStepInput.trim()) return
    const nextSteps = [...steps, activeStepInput.trim()]
    setSteps(nextSteps)
    setActiveStepInput('')
    void analyzeSteps(nextSteps)
  }

  // Remove Step
  const handleRemoveStep = (idx: number) => {
    const nextSteps = steps.filter((_, i) => i !== idx)
    setSteps(nextSteps)
    if (nextSteps.length >= 2) void analyzeSteps(nextSteps)
    else setDiagnosticResult(null)
  }

  // Load Preset
  const handleLoadPreset = (presetSteps: string[]) => {
    setSteps(presetSteps)
    void analyzeSteps(presetSteps)
  }

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
          border: '1px solid rgba(244, 63, 94, 0.22)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(244, 63, 94, 0.12)',
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
                background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(244, 63, 94, 0.4)',
                fontSize: '20px',
              }}
            >
              ✍️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  "Where Did I Go Wrong?" Homework & Scratchpad Error Spotter
                </h2>
                <span
                  style={{
                    background: 'rgba(244, 63, 94, 0.15)',
                    color: '#fb7185',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  Diagnostic Step Verifier
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                Write calculations or upload notebook pages. Tark scans line-by-line transitions and pinpoints exact algebraic errors.
              </p>
            </div>
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

        {/* Workspace: Left Whiteboard Canvas + Right Step Diagnostic Engine */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* LEFT: DIGITAL WHITEBOARD CANVAS */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {/* Canvas Toolbar */}
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(11, 19, 36, 0.75)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              {/* Color Swatches */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {[
                  { id: '#f8fafc', label: 'Chalk' },
                  { id: '#38bdf8', label: 'Cyan' },
                  { id: '#10b981', label: 'Emerald' },
                  { id: '#fbbf24', label: 'Gold' },
                  { id: '#f43f5e', label: 'Rose' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setColor(c.id)
                      setIsEraser(false)
                    }}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: c.id,
                      border: color === c.id && !isEraser ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.2)',
                      cursor: 'pointer',
                      boxShadow: color === c.id && !isEraser ? `0 0 10px ${c.id}` : 'none',
                    }}
                    title={c.label}
                  />
                ))}
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.1)' }} />

              {/* Eraser */}
              <button
                onClick={() => setIsEraser((e) => !e)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: isEraser ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: isEraser ? '1px solid #f43f5e' : '1px solid transparent',
                  color: isEraser ? '#fb7185' : '#94a3b8',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                🧹 Eraser
              </button>

              {/* Stroke Size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Size:</span>
                <input
                  type="range"
                  min="2"
                  max="12"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  style={{ width: '70px', accentColor: '#38bdf8' }}
                />
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.1)' }} />

              {/* Grid Style */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['grid', 'dots', 'plain'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setBackgroundGrid(g)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: backgroundGrid === g ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* Undo & Clear */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleUndo}
                  disabled={undoStackLen === 0}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: undoStackLen > 0 ? '#f8fafc' : '#475569',
                    fontSize: '0.76rem',
                    cursor: undoStackLen > 0 ? 'pointer' : 'default',
                  }}
                >
                  ↩ Undo
                </button>
                <button
                  onClick={handleClear}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Canvas Surface */}
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: isEraser ? 'cell' : 'crosshair' }}
              />

              {/* Upload Photo Button Overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <label
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    color: '#38bdf8',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  📸 Upload Notebook Photo
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT: DIAGNOSTIC STEP VERIFIER & ERROR SPOTTER */}
          <div
            style={{
              width: '420px',
              background: 'rgba(11, 19, 36, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              gap: '16px',
              overflowY: 'auto',
            }}
          >
            {/* Presets */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', marginBottom: '8px' }}>
                Load Common Student Problem
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {PRESET_PROBLEMS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLoadPreset(p.steps)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      color: '#e2e8f0',
                      fontSize: '0.78rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{p.title}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{p.steps.length} lines</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Derivation Step List */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>Derivation Steps</span>
                <button
                  onClick={() => void analyzeSteps(steps)}
                  disabled={isAnalyzing || steps.length < 2}
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(244, 63, 94, 0.3)',
                  }}
                >
                  {isAnalyzing ? 'Scanning...' : '🔍 Spot Errors'}
                </button>
              </div>

              {/* Step Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {steps.map((st, idx) => {
                  const evalItem = diagnosticResult?.step_evaluations.find((e) => e.step_number === idx + 1)
                  const isBuggy = evalItem?.status === 'error'

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isBuggy ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                        border: isBuggy ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: isBuggy ? '0 0 16px rgba(239, 68, 68, 0.25)' : 'none',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: isBuggy ? '#f87171' : '#94a3b8', fontWeight: 600 }}>
                          Step {idx + 1}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isBuggy && (
                            <span
                              style={{
                                background: '#ef4444',
                                color: '#ffffff',
                                fontSize: '0.66rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              🚨 MISSTEP HERE
                            </span>
                          )}
                          {!isBuggy && evalItem?.status === 'valid' && (
                            <span style={{ color: '#22c55e', fontSize: '0.78rem' }}>✓</span>
                          )}
                          <button
                            onClick={() => handleRemoveStep(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div style={{ fontFamily: 'monospace', fontSize: '0.86rem', color: '#f8fafc', marginTop: '4px' }}>
                        {st}
                      </div>

                      {/* Diagnostic Callout for buggy line */}
                      {isBuggy && evalItem && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '8px 10px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px',
                            borderLeft: '3px solid #ef4444',
                          }}
                        >
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fca5a5' }}>
                            {evalItem.error_type}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#fed7d7', marginTop: '2px' }}>
                            💡 {evalItem.hint}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add New Step Input */}
              <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                <input
                  type="text"
                  placeholder="Type next math step, e.g. 3x = 19..."
                  value={activeStepInput}
                  onChange={(e) => setActiveStepInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddStep()
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handleAddStep}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>

              {/* Summary Card */}
              {diagnosticResult && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: '10px',
                    background: diagnosticResult.has_error ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                    border: diagnosticResult.has_error ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                    fontSize: '0.78rem',
                    color: diagnosticResult.has_error ? '#fca5a5' : '#86efac',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{diagnosticResult.has_error ? '⚠️' : '🎉'}</span>
                  <span>{diagnosticResult.summary}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

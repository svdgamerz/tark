import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { SimulationData } from '../simulations/types'
import { BUILTIN_TEMPLATES } from '../simulations/templates'
import { BUILTIN_TEMPLATES_3D } from '../simulations/templates3d'
import { ThreeSimulationCanvas } from './ThreeSimulationCanvas'

const TYPE_3D_MAPPING: Record<string, string> = {
  projectile: 'projectile_3d',
  projectile_3d: 'projectile_3d',
  solar_system: 'solar_system_3d',
  solar_system_3d: 'solar_system_3d',
  atomic_orbitals: 'bohr_atom_3d',
  bohr_atom: 'bohr_atom_3d',
  bohr_atom_3d: 'bohr_atom_3d',
  chemical_bonding: 'molecules_3d',
  molecules: 'molecules_3d',
  molecules_3d: 'molecules_3d',
  dna_replication: 'dna_helix_3d',
  dna_helix: 'dna_helix_3d',
  dna_helix_3d: 'dna_helix_3d',
  circulatory_heart: 'heart_3d',
  heart: 'heart_3d',
  heart_3d: 'heart_3d',
  epidermis: 'epidermis_3d',
  epidermis_3d: 'epidermis_3d',
  skin: 'epidermis_3d',
  skin_layers: 'epidermis_3d',
  lorenz: 'lorenz_3d',
  lorenz_chaos: 'lorenz_3d',
  lorenz_3d: 'lorenz_3d',
  ray_optics: 'prism_optics_3d',
  prism: 'prism_optics_3d',
  prism_optics: 'prism_optics_3d',
  prism_optics_3d: 'prism_optics_3d',
  em_induction: 'motor_3d',
  motor: 'motor_3d',
  motor_3d: 'motor_3d',
  electric_motor: 'motor_3d',
  eye: 'eye_optics_3d',
  human_eye: 'eye_optics_3d',
  eye_optics: 'eye_optics_3d',
  eye_optics_3d: 'eye_optics_3d',
  vision: 'eye_optics_3d',
  myopia: 'eye_optics_3d',
  hypermetropia: 'eye_optics_3d',
  cell: 'cell_biology_3d',
  plant_cell: 'cell_biology_3d',
  animal_cell: 'cell_biology_3d',
  cell_biology: 'cell_biology_3d',
  cell_biology_3d: 'cell_biology_3d',
  cell_organelles: 'cell_biology_3d',
  ac_generator: 'ac_generator_3d',
  ac_generator_3d: 'ac_generator_3d',
  dynamo: 'ac_generator_3d',
  generator: 'ac_generator_3d',
  rutherford: 'rutherford_atom_3d',
  rutherford_atom: 'rutherford_atom_3d',
  rutherford_atom_3d: 'rutherford_atom_3d',
  gold_foil: 'rutherford_atom_3d',
  titration: 'titration_3d',
  titration_3d: 'titration_3d',
  acid_base_titration: 'titration_3d',
  titration_curve: 'titration_3d',
  volumetric_titration: 'titration_3d',
  brain: 'brain_3d',
  brain_3d: 'brain_3d',
  human_brain: 'brain_3d',
  neuron: 'brain_3d',
  neuron_action_potential: 'brain_3d',
  nervous_system: 'brain_3d',
  lungs: 'lungs_3d',
  lungs_3d: 'lungs_3d',
  respiratory_system: 'lungs_3d',
  respiration: 'lungs_3d',
  alveoli: 'lungs_3d',
  kidney: 'kidney_3d',
  kidney_3d: 'kidney_3d',
  nephron: 'kidney_3d',
  excretory_system: 'kidney_3d',
  renal: 'kidney_3d',
}

function Icon({ name }: { name: 'zoom' | 'close' }) {
  if (name === 'close') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

interface Props {
  simulation: SimulationData
}

export function InteractiveSimulation({ simulation }: Props) {
  const target3DKey = TYPE_3D_MAPPING[simulation.type] || simulation.type
  const template3D = BUILTIN_TEMPLATES_3D[target3DKey]
  const [isMode3D, setIsMode3D] = useState(Boolean(template3D))

  const template = BUILTIN_TEMPLATES[simulation.type]
  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    if (template) {
      for (const p of template.params) {
        init[p.key] = simulation.params?.[p.key] ?? p.defaultValue
      }
    }
    return init
  })

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [telemetry, setTelemetry] = useState<any>(null)
  const inlineIframeRef = useRef<HTMLIFrameElement | null>(null)
  const fullIframeRef = useRef<HTMLIFrameElement | null>(null)
  const inlineCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(performance.now())
  const animStateRef = useRef<any>({})

  // Lab Copilot Bi-directional Event Listener
  useEffect(() => {
    const handleSimMsg = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type === 'tark_sim_telemetry') {
        setTelemetry(e.data)
      } else if (e.data.type === 'tark_mission_completed') {
        setTelemetry((prev: any) => ({
          ...prev,
          activeMission: e.data.completedMission,
          activeMissionIndex: e.data.nextMissionIndex,
        }))
      }
    }
    window.addEventListener('message', handleSimMsg)
    return () => window.removeEventListener('message', handleSimMsg)
  }, [])

  // Send message to active simulation iframe
  const sendToSim = (msg: any) => {
    if (fullIframeRef.current?.contentWindow) {
      fullIframeRef.current.contentWindow.postMessage(msg, '*')
    } else if (inlineIframeRef.current?.contentWindow) {
      inlineIframeRef.current.contentWindow.postMessage(msg, '*')
    }
  }

  // Reset parameters to defaults
  const handleReset = () => {
    if (template) {
      const resetParams: Record<string, number> = {}
      for (const p of template.params) {
        resetParams[p.key] = p.defaultValue
      }
      setParams(resetParams)
    }
    sendToSim({ type: 'tark_reset' })
    animStateRef.current = {}
    startTimeRef.current = performance.now()
  }

  // Keyboard shortcut (Escape to exit fullscreen) & scroll lock
  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isFullscreen])

  // Animation Loop for built-in simulations (renders to whichever canvas is active)
  useEffect(() => {
    if (!template || simulation.type === 'custom_html') return

    let running = true
    const render = () => {
      if (!running) return
      const now = performance.now()
      const time = isPlaying ? (now - startTimeRef.current) / 1000 : 0

      // Render to inline canvas if mounted
      if (inlineCanvasRef.current) {
        const c = inlineCanvasRef.current
        const ctx = c.getContext('2d')
        if (ctx) {
          template.renderCanvas(ctx, c.width, c.height, params, { time, animState: animStateRef.current })
        }
      }

      // Render to fullscreen canvas if active
      if (isFullscreen && fullscreenCanvasRef.current) {
        const fc = fullscreenCanvasRef.current
        const fctx = fc.getContext('2d')
        if (fctx) {
          template.renderCanvas(fctx, fc.width, fc.height, params, { time, animState: animStateRef.current })
        }
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()
    return () => {
      running = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [template, params, isPlaying, isFullscreen, simulation.type])

  const readouts = template ? template.calculateReadouts(params) : []

  // If 3D WebGL simulation is available and active
  if (template3D && isMode3D) {
    return (
      <>
        <div className="sim-3d-wrapper sim-3d-inline">
          <ThreeSimulationCanvas
            template={template3D}
            initialParams={simulation.params}
            isFullscreen={false}
            onOpenFullscreen={() => setIsFullscreen(true)}
          />
          {template && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 14px', background: 'var(--surface, #ffffff)', borderTop: '1px solid var(--border, #e2e8f0)' }}>
              <button
                type="button"
                className="sim-btn"
                onClick={() => setIsMode3D(false)}
                title="Switch to 2D Canvas Schematic"
              >
                📊 Switch to 2D Schematic
              </button>
            </div>
          )}
        </div>

        {isFullscreen &&
          createPortal(
            <div className="sim-fullscreen-backdrop" onClick={() => setIsFullscreen(false)}>
              <div className="sim-fullscreen-modal" onClick={(e) => e.stopPropagation()}>
                <ThreeSimulationCanvas
                  template={template3D}
                  initialParams={simulation.params}
                  isFullscreen={true}
                  onCloseFullscreen={() => setIsFullscreen(false)}
                />
              </div>
            </div>,
            document.body,
          )}
      </>
    )
  }

  // If custom AI-generated HTML simulation
  const customHtml = simulation.type === 'custom_html' ? (simulation.htmlContent || (simulation as any).html_content) : null
  if (simulation.type === 'custom_html' && customHtml) {
    return (
      <>
        <div className="sim-card">
          <div className="sim-header">
            <div className="sim-title-group">
              <span className="sim-badge">🧪 Interactive Virtual Lab</span>
              <span className="sim-title">{simulation.title || 'Interactive Model'}</span>
              {telemetry && (
                <span className="sim-copilot-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 12, background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', fontSize: '0.74rem', fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                  Copilot Live
                </span>
              )}
              {telemetry?.activeMission && (
                <span className="sim-mission-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#fbbf24', fontSize: '0.74rem', fontWeight: 600 }} title={telemetry.activeMission.task}>
                  🎯 Quest {telemetry.activeMissionIndex + 1}/{telemetry.totalMissions}: {telemetry.activeMission.title}
                </span>
              )}
            </div>
            <div className="sim-actions">
              <button
                className="sim-btn sim-btn-secondary"
                onClick={() => sendToSim({ type: 'tark_reset' })}
                title="Reset Simulation State"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                ↺ Reset
              </button>
              <button
                className="sim-btn sim-btn-expand"
                onClick={() => setIsFullscreen(true)}
                title="Expand to Fullscreen Lab"
              >
                <Icon name="zoom" />
                <span>⛶ Expand Lab</span>
              </button>
            </div>
          </div>
          <div className="sim-iframe-wrap">
            <iframe
              ref={inlineIframeRef}
              srcDoc={customHtml}
              title={simulation.title}
              sandbox="allow-scripts allow-same-origin allow-forms"
              allow="autoplay"
              className="sim-iframe"
            />
          </div>
        </div>

        {isFullscreen &&
          createPortal(
            <div className="sim-fullscreen-backdrop" onClick={() => setIsFullscreen(false)}>
              <div className="sim-fullscreen-modal sim-fullscreen-modal-iframe" onClick={(e) => e.stopPropagation()}>
                <div className="sim-lab-header">
                  <div className="sim-lab-header-left">
                    <span className="sim-lab-logo">🎮 Tark Virtual Lab</span>
                    <span className="sim-lab-divider">/</span>
                    <h2 className="sim-lab-title">{simulation.title || 'Interactive Simulation'}</h2>
                    {telemetry?.activeMission && (
                      <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 14, background: 'rgba(245, 158, 11, 0.18)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 700 }}>
                        🎯 Quest {telemetry.activeMissionIndex + 1}/{telemetry.totalMissions}: {telemetry.activeMission.title}
                      </span>
                    )}
                  </div>
                  <div className="sim-lab-header-right">
                    <button
                      className="sim-lab-btn"
                      onClick={() => {
                        if (!document.fullscreenElement) {
                          document.documentElement.requestFullscreen?.().catch(() => {})
                        } else {
                          document.exitFullscreen?.().catch(() => {})
                        }
                      }}
                      title="Toggle Full Display (F11)"
                    >
                      <span>⛶ Screen Focus</span>
                    </button>
                    <button
                      className="sim-lab-btn"
                      onClick={() => sendToSim({ type: 'tark_reset' })}
                      title="Reset simulation parameters"
                    >
                      <span>↺ Reset</span>
                    </button>
                    <button
                      className="sim-lab-btn sim-lab-btn-close"
                      onClick={() => {
                        if (document.fullscreenElement) {
                          document.exitFullscreen?.().catch(() => {})
                        }
                        setIsFullscreen(false)
                      }}
                      title="Exit Virtual Lab (Esc)"
                    >
                      <span>✕ Exit Lab <kbd>Esc</kbd></span>
                    </button>
                  </div>
                </div>
                <div className="sim-lab-iframe-viewport">
                  <iframe
                    ref={fullIframeRef}
                    srcDoc={customHtml}
                    title={simulation.title}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    allow="autoplay"
                    className="sim-iframe-full"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )}
      </>
    )
  }

  return (
    <>
      {/* --- Inline Simulation Card (embedded in message) --- */}
      <div className="sim-card">
        {/* Header Bar */}
        <div className="sim-header">
          <div className="sim-title-group">
            <span className="sim-badge">🎮 Interactive Virtual Lab</span>
            <span className="sim-title">{template?.title || simulation.title}</span>
            <span className="sim-concept-pill">{template?.concept || simulation.concept}</span>
          </div>
          <div className="sim-actions">
            {template3D && (
              <button
                type="button"
                className="sim-btn sim-badge-3d"
                onClick={() => setIsMode3D(true)}
                title="Switch to 3D Interactive WebGL"
              >
                <span>🌐 3D View</span>
              </button>
            )}
            <button className="sim-btn" onClick={handleReset} title="Reset sliders to defaults">
              <span>↺ Reset</span>
            </button>
            <button
              className="sim-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            >
              <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
            </button>
            <button
              className="sim-btn sim-btn-expand"
              onClick={() => setIsFullscreen(true)}
              title="Expand to Fullscreen Lab"
            >
              <Icon name="zoom" />
              <span>⛶ Expand Lab</span>
            </button>
          </div>
        </div>

        {/* Interactive Visual Canvas */}
        <div className="sim-canvas-wrap">
          <canvas
            ref={inlineCanvasRef}
            width={540}
            height={260}
            className="sim-canvas"
          />
        </div>

        {/* Live Formula Readouts */}
        {readouts.length > 0 && (
          <div className="sim-readouts-bar">
            {readouts.map((r, idx) => (
              <div key={idx} className="sim-readout-item">
                <span className="sim-readout-label">{r.label}</span>
                <span className="sim-readout-val">
                  {r.value} {r.unit}
                </span>
                {r.formula && <span className="sim-readout-formula">{r.formula}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Parameters Slider Controls */}
        {template && (
          <div className="sim-controls-panel">
            {template.params.map((p) => {
              const val = params[p.key] ?? p.defaultValue
              return (
                <div key={p.key} className="sim-slider-row">
                  <div className="sim-slider-label">
                    <span>{p.label}</span>
                    <span className="sim-slider-value">
                      {val} {p.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={val}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        [p.key]: parseFloat(e.target.value),
                      }))
                    }
                    className="sim-slider-input"
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Pedagogical Description */}
        <div className="sim-footer-note">
          💡 <strong>Tutor Note:</strong> {template?.description || simulation.description}
        </div>
      </div>

      {/* --- Fullscreen Virtual Laboratory Portal Modal --- */}
      {isFullscreen &&
        createPortal(
          <div className="sim-fullscreen-backdrop" onClick={() => setIsFullscreen(false)}>
            <div className="sim-fullscreen-modal" onClick={(e) => e.stopPropagation()}>
              {/* Top Laboratory Navigation Bar */}
              <div className="sim-lab-header">
                <div className="sim-lab-header-left">
                  <span className="sim-lab-logo">🎮 Tark Virtual Lab</span>
                  <span className="sim-lab-divider">/</span>
                  <h2 className="sim-lab-title">{template?.title || simulation.title}</h2>
                  <span className="sim-badge-subject">{template?.subject || simulation.subject}</span>
                  <span className="sim-badge-concept">{template?.concept || simulation.concept}</span>
                </div>
                <div className="sim-lab-header-right">
                  <button
                    className="sim-lab-btn"
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen?.().catch(() => {})
                      } else {
                        document.exitFullscreen?.().catch(() => {})
                      }
                    }}
                    title="Toggle Full Display (F11)"
                  >
                    <span>⛶ Screen Focus</span>
                  </button>
                  <button className="sim-lab-btn" onClick={handleReset} title="Reset all sliders to defaults">
                    <span>↺ Reset Defaults</span>
                  </button>
                  <button
                    className="sim-lab-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? 'Pause simulation' : 'Play simulation'}
                  >
                    <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
                  </button>
                  <button
                    className="sim-lab-btn sim-lab-btn-close"
                    onClick={() => {
                      if (document.fullscreenElement) {
                        document.exitFullscreen?.().catch(() => {})
                      }
                      setIsFullscreen(false)
                    }}
                    title="Exit Virtual Lab (Esc)"
                  >
                    <span>✕ Exit Lab <kbd>Esc</kbd></span>
                  </button>
                </div>
              </div>

              {/* Laboratory Split Workbench */}
              <div className="sim-lab-content">
                {/* Left Column: Expansive Simulation Canvas Viewport */}
                <div className="sim-lab-viewport">
                  <div className="sim-lab-canvas-container">
                    <canvas
                      ref={fullscreenCanvasRef}
                      width={1000}
                      height={580}
                      className="sim-lab-canvas"
                    />
                    <div className="sim-canvas-status-bar">
                      <span className={`sim-status-dot ${isPlaying ? 'active' : 'paused'}`} />
                      <span>{isPlaying ? 'Live 60 FPS Physics Engine' : 'Simulation Paused'}</span>
                      <span className="sim-canvas-dim">1000 × 580 px</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Instrument Deck & Controls Sidebar */}
                <div className="sim-lab-sidebar">
                  {/* Quick Concept Presets */}
                  {template?.presets && template.presets.length > 0 && (
                    <div className="sim-lab-section">
                      <div className="sim-lab-section-title">⚡ Quick Experiments & Scenarios</div>
                      <div className="sim-lab-presets-grid">
                        {template.presets.map((preset, idx) => (
                          <button
                            key={idx}
                            className="sim-preset-pill"
                            onClick={() => setParams((prev) => ({ ...prev, ...preset.params }))}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Measurement Sensors / Formula Readouts */}
                  <div className="sim-lab-section">
                    <div className="sim-lab-section-title">📊 Live Measurement Sensors</div>
                    <div className="sim-lab-readouts-grid">
                      {readouts.map((r, idx) => (
                        <div key={idx} className="sim-lab-readout-card">
                          <div className="sim-lab-readout-header">
                            <span className="sim-lab-readout-name">{r.label}</span>
                            {r.formula && <span className="sim-lab-readout-formula">{r.formula}</span>}
                          </div>
                          <div className="sim-lab-readout-value">
                            {r.value} <span className="sim-lab-readout-unit">{r.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Experimental Parameter Sliders */}
                  {template && (
                    <div className="sim-lab-section">
                      <div className="sim-lab-section-title">🎛️ Experimental Variables</div>
                      <div className="sim-lab-sliders-list">
                        {template.params.map((p) => {
                          const val = params[p.key] ?? p.defaultValue
                          return (
                            <div key={p.key} className="sim-lab-slider-item">
                              <div className="sim-lab-slider-top">
                                <span className="sim-lab-slider-label">{p.label}</span>
                                <span className="sim-lab-slider-val-badge">
                                  {val} {p.unit}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={p.min}
                                max={p.max}
                                step={p.step}
                                value={val}
                                onChange={(e) =>
                                  setParams((prev) => ({
                                    ...prev,
                                    [p.key]: parseFloat(e.target.value),
                                  }))
                                }
                                className="sim-lab-range"
                              />
                              <div className="sim-lab-slider-range-limits">
                                <span>{p.min} {p.unit}</span>
                                <span>{p.max} {p.unit}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Learning Objectives & Pedagogical Notes */}
                  <div className="sim-lab-section sim-lab-notes-section">
                    <div className="sim-lab-section-title">💡 Learning Guide & Concept</div>
                    <p className="sim-lab-description">
                      {template?.description || simulation.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}


import { useEffect, useRef, useState } from 'react'
import type { BuiltinTemplate3D, DissectInfo } from '../simulations/templates3d'
import type { SimulationReadout } from '../simulations/types'

interface Props {
  template: BuiltinTemplate3D
  initialParams?: Record<string, number>
  isFullscreen?: boolean
  onCloseFullscreen?: () => void
  onOpenFullscreen?: () => void
}

export function ThreeSimulationCanvas({
  template,
  initialParams,
  isFullscreen = false,
  onCloseFullscreen,
  onOpenFullscreen,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<{
    updateParams: (params: Record<string, number>) => void
    setPlaying: (playing: boolean) => void
    reset: () => void
    dispose: () => void
    closeDissection?: () => void
  } | null>(null)

  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const p of template.params) {
      init[p.key] = initialParams?.[p.key] ?? p.defaultValue
    }
    return init
  })

  const [isPlaying, setIsPlaying] = useState(true)
  const [inspectedPart, setInspectedPart] = useState<DissectInfo | null>(null)
  const [readouts, setReadouts] = useState<SimulationReadout[]>(() =>
    template.calculateReadouts(params)
  )

  // Initialize Three.js 3D Scene
  useEffect(() => {
    if (!containerRef.current) return
    setInspectedPart(null)

    const controller = template.initScene(containerRef.current, params, {
      onUpdateReadouts: (newReadouts) => setReadouts(newReadouts),
      onInspectPart: (info) => setInspectedPart(info),
    })
    controllerRef.current = controller

    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [template])

  // Sync params with 3D controller & update readouts
  const handleParamChange = (key: string, value: number) => {
    const nextParams = { ...params, [key]: value }
    setParams(nextParams)
    controllerRef.current?.updateParams(nextParams)
    setReadouts(template.calculateReadouts(nextParams))
  }

  // Handle Play/Pause
  const togglePlay = () => {
    const nextState = !isPlaying
    setIsPlaying(nextState)
    controllerRef.current?.setPlaying(nextState)
  }

  // Handle Reset Defaults
  const handleReset = () => {
    const defaultParams: Record<string, number> = {}
    for (const p of template.params) {
      defaultParams[p.key] = p.defaultValue
    }
    setParams(defaultParams)
    controllerRef.current?.updateParams(defaultParams)
    controllerRef.current?.reset()
    controllerRef.current?.closeDissection?.()
    setInspectedPart(null)
    setReadouts(template.calculateReadouts(defaultParams))
  }

  // Handle Close Dissection
  const handleCloseDissect = () => {
    setInspectedPart(null)
    controllerRef.current?.closeDissection?.()
  }

  const [showControls, setShowControls] = useState(true)

  // Handle Preset Selection
  const applyPreset = (presetParams: Record<string, number>) => {
    const nextParams = { ...params, ...presetParams }
    setParams(nextParams)
    controllerRef.current?.updateParams(nextParams)
    setReadouts(template.calculateReadouts(nextParams))
  }

  return (
    <div className={`sim-3d-wrapper ${isFullscreen ? 'sim-3d-fullscreen' : 'sim-3d-inline'}`}>
      {/* 3D Header Bar */}
      <div className="sim-header">
        <div className="sim-title-group">
          <span className="sim-badge sim-badge-3d">🌐 3D Interactive WebGL</span>
          <span className="sim-title">{template.title}</span>
          <span className="sim-concept-pill">{template.concept}</span>
        </div>
        <div className="sim-actions">
          <button className="sim-btn" onClick={handleReset} title="Reset sliders to defaults">
            <span>↺ Reset</span>
          </button>
          <button
            className="sim-btn"
            onClick={togglePlay}
            title={isPlaying ? 'Pause 3D physics' : 'Resume 3D physics'}
          >
            <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
          </button>
          <button
            className={`sim-btn ${showControls ? 'sim-btn-active' : ''}`}
            onClick={() => setShowControls(!showControls)}
            title={showControls ? 'Collapse controls panel to maximize 3D viewport' : 'Show controls and telemetry'}
          >
            <span>🎛️ {showControls ? 'Hide Controls' : 'Show Controls'}</span>
          </button>
          {isFullscreen ? (
            <button
              className="sim-btn sim-btn-close"
              onClick={onCloseFullscreen}
              title="Exit Fullscreen (Esc)"
            >
              <span>✕ Exit <kbd>Esc</kbd></span>
            </button>
          ) : (
            onOpenFullscreen && (
              <button
                className="sim-btn sim-btn-expand"
                onClick={onOpenFullscreen}
                title="Expand to Fullscreen 3D Lab"
              >
                <span>⛶ Expand 3D Lab</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 3D Main Workspace (2-Column Desktop Grid or Pure 3D Viewport) */}
      <div className={`sim-3d-workspace ${showControls ? 'with-sidebar' : 'canvas-only'}`}>
        {/* Left / Main 3D Viewport Area */}
        <div className="sim-3d-viewport-container">
          <div ref={containerRef} className="sim-3d-canvas-host" />

          {/* 3D Orbit Control Interaction Hint Overlay */}
          {!inspectedPart && (
            <div className="sim-3d-gesture-hint">
              <span>🖱️ <strong>Left-Drag:</strong> Rotate 360°</span>
              <span>•</span>
              <span>🔍 <strong>Scroll:</strong> Zoom</span>
              <span>•</span>
              <span>👆 <strong>Click / Tap:</strong> Dissect & Inspect Inside</span>
            </div>
          )}

          {/* 60 FPS Badge */}
          <div className="sim-3d-fps-badge">
            <span className={`sim-status-dot ${isPlaying ? 'active' : 'paused'}`} />
            <span>{isPlaying ? '60 FPS 3D Engine' : 'Paused'}</span>
          </div>

          {/* Floating Interactive Dissection & Inner Anatomy Card */}
          {inspectedPart && (
            <div className="sim-3d-dissect-card animate-fade-in">
              <div className="sim-3d-dissect-header">
                <div className="sim-3d-dissect-badge-group">
                  <span className="sim-3d-dissect-badge">🔬 Inner Dissection</span>
                  {inspectedPart.bloodType && (
                    <span className={`sim-3d-blood-pill ${inspectedPart.bloodType.toLowerCase()}`}>
                      {inspectedPart.bloodType === 'Oxygenated' ? '🔴 Oxygenated' : '🔵 Deoxygenated'}
                    </span>
                  )}
                </div>
                <button
                  className="sim-3d-dissect-close-btn"
                  onClick={handleCloseDissect}
                  title="Close inner chamber wall"
                >
                  ✕
                </button>
              </div>
              <div className="sim-3d-dissect-content">
                <h4 className="sim-3d-dissect-title">{inspectedPart.partName}</h4>
                <p className="sim-3d-dissect-role">{inspectedPart.role}</p>
                {inspectedPart.internalStructures && inspectedPart.internalStructures.length > 0 && (
                  <div className="sim-3d-dissect-features">
                    <span className="sim-3d-features-heading">Interior Structures Revealed:</span>
                    <div className="sim-3d-features-tags">
                      {inspectedPart.internalStructures.map((s, i) => (
                        <span key={i} className="sim-3d-feature-tag">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="sim-3d-dissect-desc">{inspectedPart.description}</p>
              </div>
              <div className="sim-3d-dissect-footer">
                <button className="sim-3d-dissect-btn-close" onClick={handleCloseDissect}>
                  ↺ Close
                </button>
                <button
                  className="sim-3d-dissect-btn-ask"
                  onClick={() => {
                    const evt = new CustomEvent('tark:ask-ai', {
                      detail: { prompt: `Explain the anatomical structure and clinical/physiological significance of ${inspectedPart.partName}: ${inspectedPart.role}.` }
                    })
                    window.dispatchEvent(evt)
                  }}
                  title="Ask Tark AI to explain this anatomical structure in chat"
                >
                  💬 Discuss with Tark
                </button>
                <span className="sim-3d-dissect-hint">💡 Tap to toggle</span>
              </div>
            </div>
          )}

          {/* Floating Concept Presets Strip docked at bottom of 3D viewport */}
          {template.presets && template.presets.length > 0 && (
            <div className="sim-3d-floating-presets" id="sim-presets-strip">
              <span className="sim-presets-title">⚡ Quick Experiments:</span>
              <div className="sim-presets-list">
                {template.presets.map((preset, idx) => (
                  <button
                    key={idx}
                    id={`sim-preset-${idx}`}
                    type="button"
                    className="sim-preset-pill"
                    onClick={() => applyPreset(preset.params)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right / Docked Controls & Telemetry Sidebar */}
        {showControls && (
          <aside className="sim-3d-controls-sidebar">
            {/* Real-Time Mathematical & Physics Telemetry Readouts */}
            {readouts.length > 0 && (
              <div className="sim-readouts-bar" id="sim-readouts-bar">
                {readouts.map((r, idx) => (
                  <div key={idx} className="sim-readout-item">
                    <span className="sim-readout-label">{r.label}</span>
                    <span className="sim-readout-val">
                      {r.value} {r.unit || ''}
                    </span>
                    {r.formula && <span className="sim-readout-formula">{r.formula}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic Sliders Controls Panel */}
            <div className="sim-controls-panel">
              <h4 className="sim-controls-heading">Parameters & Controls</h4>
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
                      onChange={(e) => handleParamChange(p.key, parseFloat(e.target.value))}
                      className="sim-slider-input"
                    />
                  </div>
                )
              })}
            </div>

            {/* Pedagogical Description Note */}
            <div className="sim-footer-note">
              💡 <strong>Tutor Note:</strong> {template.description}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

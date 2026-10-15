import { useState, useEffect, useRef } from 'react'

interface Props {
  code: string
}

let mermaidInit = false

export function MermaidBlock({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)

  // Clean raw code: remove markdown code block tags if present
  const cleanCode = code
    .replace(/^```[ \t]*(?:mermaid)?/i, '')
    .replace(/```$/g, '')
    .trim()

  useEffect(() => {
    let active = true
    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        if (!mermaidInit) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'base',
            flowchart: { htmlLabels: true, curve: 'basis' },
            themeVariables: {
              darkMode: true,
              background: '#0a0f1d',
              mainBkg: '#1e293b',
              primaryColor: '#1e293b',
              primaryBorderColor: '#38bdf8',
              primaryTextColor: '#f8fafc',
              lineColor: '#94a3b8',
              secondaryColor: '#312e81',
              tertiaryColor: '#0f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '14px',
              nodeBorder: '#38bdf8',
              clusterBkg: '#0f172a',
              clusterBorder: '#334155',
              titleColor: '#38bdf8',
              edgeLabelBackground: '#0a0f1d',
            },
          })
          mermaidInit = true
        }

        const id = 'mermaid_' + Math.random().toString(36).substring(2, 9)
        const { svg } = await mermaid.render(id, cleanCode)
        if (active) {
          setSvgHtml(svg)
          setError(null)
        }
      } catch (err: any) {
        if (active) {
          console.warn('Mermaid rendering fallback:', err)
          setError(err?.message || 'Diagram rendering issue')
        }
      }
    }

    renderDiagram()
    return () => {
      active = false
    }
  }, [cleanCode])

  const copyCode = () => {
    navigator.clipboard?.writeText(cleanCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className={`mermaid-block-card ${isFullscreen ? 'mermaid-fullscreen' : ''}`}>
      <div className="mermaid-header-bar">
        <div className="mermaid-title-tag">
          <span className="mermaid-icon">📊</span>
          <span className="mermaid-title">Flowchart &amp; System Process</span>
        </div>
        <div className="mermaid-actions">
          {isFullscreen && (
            <div className="mermaid-zoom-controls">
              <button
                type="button"
                className="mermaid-btn"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                title="Zoom Out"
              >
                −
              </button>
              <button
                type="button"
                className="mermaid-btn"
                onClick={() => setZoom(1)}
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                className="mermaid-btn"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                title="Zoom In"
              >
                +
              </button>
            </div>
          )}
          <button
            type="button"
            className="mermaid-btn"
            onClick={copyCode}
            title="Copy Mermaid source code"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            type="button"
            className="mermaid-btn"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Flowchart'}
          >
            {isFullscreen ? '✕ Close' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="mermaid-canvas-area"
        style={isFullscreen ? { transform: `scale(${zoom})`, transformOrigin: 'top center' } : undefined}
      >
        {svgHtml && !error ? (
          <div
            className="mermaid-svg-container"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : error ? (
          <div className="mermaid-fallback-box">
            <span className="mermaid-fallback-label">Process Steps:</span>
            <pre className="mermaid-code-fallback">{cleanCode}</pre>
          </div>
        ) : (
          <div className="mermaid-loading-pulse">
            <span>Rendering diagram...</span>
          </div>
        )}
      </div>
    </div>
  )
}

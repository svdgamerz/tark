import { useEffect, useRef, useState, useMemo } from 'react'
import { API_BASE } from '../api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onLaunchSimulation?: (simId: string) => void
  onStartChatTopic?: (topic: string) => void
}

interface ConceptNode {
  id: string
  label: string
  subject: string
  grade: string
  prerequisites: string[]
  x: number
  y: number
  simulation_id?: string
  formulas?: string[]
  description: string
  strength: number
  mastery_percent: number
  status: 'mastered' | 'in_progress' | 'struggling'
}

interface ConceptEdge {
  from: string
  to: string
}

export function ConceptMasteryGraphModal({
  isOpen,
  onClose,
  onLaunchSimulation,
  onStartChatTopic,
}: Props) {
  const [nodes, setNodes] = useState<ConceptNode[]>([])
  const [edges, setEdges] = useState<ConceptEdge[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('All')
  const [selectedGrade, setSelectedGrade] = useState<string>('All')
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null)

  // Pan & Zoom state
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 1100,
    h: 960,
  })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Fetch Graph Data
  useEffect(() => {
    if (!isOpen) return
    fetch(`${API_BASE}/api/mastery/graph?user_key=guest&subject=${encodeURIComponent(selectedSubject)}&grade=${encodeURIComponent(selectedGrade)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setNodes(data.nodes)
          setEdges(data.edges)
        }
      })
      .catch((err) => console.error('Failed to load mastery graph:', err))
  }, [isOpen, selectedSubject, selectedGrade])

  // Overall statistics
  const stats = useMemo(() => {
    const mastered = nodes.filter((n) => n.status === 'mastered').length
    const inProgress = nodes.filter((n) => n.status === 'in_progress').length
    const struggling = nodes.filter((n) => n.status === 'struggling').length
    const avgScore = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.mastery_percent, 0) / nodes.length) : 0
    return { mastered, inProgress, struggling, avgScore }
  }, [nodes])

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current && (e.target as HTMLElement).tagName !== 'svg') return
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.x
    const dy = e.clientY - panStart.y
    setViewBox((prev) => ({
      ...prev,
      x: prev.x - dx * (prev.w / 1000),
      y: prev.y - dy * (prev.h / 800),
    }))
    setPanStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => setIsPanning(false)

  const handleZoom = (factor: number) => {
    setViewBox((prev) => {
      const nw = prev.w * factor
      const nh = prev.h * factor
      return {
        x: prev.x - (nw - prev.w) / 2,
        y: prev.y - (nh - prev.h) / 2,
        w: nw,
        h: nh,
      }
    })
  }

  // Node position map for drawing edges
  const nodeMap = useMemo(() => {
    const m = new Map<string, ConceptNode>()
    nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [nodes])

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
          maxWidth: '1280px',
          height: '92vh',
          background: '#070d18',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.12)',
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
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.4)',
                fontSize: '20px',
              }}
            >
              🌳
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Diagnostic Concept Mastery Graph & Skill Tree
                </h2>
                <span
                  style={{
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  Adaptive DAG
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                Visual prerequisite map of STEM concepts. Pinpoint foundational gaps holding you back from mastering higher topics.
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

        {/* Filter and Stats Bar */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(11, 19, 36, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Subject & Grade Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Subject:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology'].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: selectedSubject === sub ? '#7c3aed' : 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: selectedSubject === sub ? '#ffffff' : '#cbd5e1',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {sub}
                </button>
              ))}
            </div>

            <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Class:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['All', '11', '12'].map((gr) => (
                <button
                  key={gr}
                  onClick={() => setSelectedGrade(gr)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: selectedGrade === gr ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: selectedGrade === gr ? '#ffffff' : '#cbd5e1',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {gr === 'All' ? 'All Classes' : `Class ${gr}`}
                </button>
              ))}
            </div>
          </div>

          {/* Aggregate Mastery Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ color: '#94a3b8' }}>Mastered:</span>
              <strong style={{ color: '#10b981' }}>{stats.mastered}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ color: '#94a3b8' }}>In Progress:</span>
              <strong style={{ color: '#f59e0b' }}>{stats.inProgress}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ color: '#94a3b8' }}>Needs Revision:</span>
              <strong style={{ color: '#ef4444' }}>{stats.struggling}</strong>
            </div>
            <div
              style={{
                marginLeft: '8px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              Overall: {stats.avgScore}%
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Zoom Controls Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: selectedNode ? '396px' : '20px',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'right 0.2s ease',
            }}
          >
            <button
              onClick={() => handleZoom(0.85)}
              style={{
                width: '30px',
                height: '30px',
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '1.1rem',
                cursor: 'pointer',
              }}
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => handleZoom(1.15)}
              style={{
                width: '30px',
                height: '30px',
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '1.1rem',
                cursor: 'pointer',
              }}
              title="Zoom Out"
            >
              −
            </button>
            <button
              onClick={() => setViewBox({ x: 0, y: 0, w: 1100, h: 960 })}
              style={{
                width: '30px',
                height: '30px',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
              title="Reset View"
            >
              ⟲
            </button>
          </div>

          {/* SVG Canvas DAG */}
          <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                width: '100%',
                height: '100%',
                cursor: isPanning ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
            >
              <defs>
                {/* Arrowhead marker */}
                <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(148, 163, 184, 0.5)" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>

                {/* Glow Filters */}
                <filter id="glow-mastered" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#10b981" floodOpacity="0.45" />
                </filter>
                <filter id="glow-struggling" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.45" />
                </filter>
              </defs>

              {/* Draw Edges */}
              {edges.map((e, idx) => {
                const source = nodeMap.get(e.from)
                const target = nodeMap.get(e.to)
                if (!source || !target) return null

                const isConnectedToSelected = selectedNode && (selectedNode.id === e.from || selectedNode.id === e.to)
                const strokeColor = isConnectedToSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)'
                const strokeWidth = isConnectedToSelected ? 2.5 : 1.5

                // Smooth Bezier Curve from Source to Target
                const dx = target.x - source.x
                const cx1 = source.x + dx * 0.5
                const cy1 = source.y
                const cx2 = source.x + dx * 0.5
                const cy2 = target.y

                return (
                  <path
                    key={idx}
                    d={`M ${source.x} ${source.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${target.x} ${target.y}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isConnectedToSelected ? 'none' : '4, 4'}
                    markerEnd={isConnectedToSelected ? 'url(#arrow-active)' : 'url(#arrow)'}
                  />
                )
              })}

              {/* Draw Nodes */}
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id
                let statusColor = '#f59e0b'
                if (node.status === 'mastered') statusColor = '#10b981'
                if (node.status === 'struggling') statusColor = '#ef4444'

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNode(node)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Glow ring */}
                    <circle
                      r={isSelected ? 34 : 26}
                      fill={node.status === 'mastered' ? 'rgba(16, 185, 129, 0.12)' : node.status === 'struggling' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.12)'}
                      stroke={isSelected ? '#ffffff' : statusColor}
                      strokeWidth={isSelected ? 3 : 2}
                      filter={node.status === 'mastered' ? 'url(#glow-mastered)' : node.status === 'struggling' ? 'url(#glow-struggling)' : 'none'}
                    />

                    {/* Inner Core */}
                    <circle r={14} fill="#070d18" stroke={statusColor} strokeWidth={2} />

                    {/* Status Icon */}
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="10"
                      fontWeight="bold"
                      fill={statusColor}
                    >
                      {node.status === 'mastered' ? '✓' : node.status === 'struggling' ? '!' : '⋯'}
                    </text>

                    {/* Node Label Card */}
                    <g transform="translate(0, 42)">
                      <rect
                        x="-80"
                        y="-10"
                        width="160"
                        height="26"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.92)"
                        stroke={isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle"
                        dy="7"
                        fill="#f8fafc"
                        fontSize="10.5"
                        fontWeight="600"
                      >
                        {node.label.length > 22 ? node.label.slice(0, 20) + '...' : node.label}
                      </text>
                    </g>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Right Concept Diagnostic Drawer */}
          {selectedNode && (
            <div
              style={{
                width: '380px',
                background: 'rgba(11, 19, 36, 0.95)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto',
                animation: 'slideLeft 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(124, 58, 237, 0.2)',
                        color: '#c084fc',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      {selectedNode.subject} • Class {selectedNode.grade}
                    </span>
                  </div>
                  <h3 style={{ margin: '8px 0 0', fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                    {selectedNode.label}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  ✕
                </button>
              </div>

              {/* Mastery Gauge */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Concept Mastery</span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: selectedNode.status === 'mastered' ? '#10b981' : selectedNode.status === 'struggling' ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {selectedNode.mastery_percent}% ({selectedNode.status.replace('_', ' ').toUpperCase()})
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${selectedNode.mastery_percent}%`,
                      height: '100%',
                      background: selectedNode.status === 'mastered' ? '#10b981' : selectedNode.status === 'struggling' ? '#ef4444' : '#f59e0b',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {selectedNode.description}
              </div>

              {/* Prerequisite Chain */}
              {selectedNode.prerequisites.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                    Foundational Prerequisites:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedNode.prerequisites.map((pId) => {
                      const pNode = nodeMap.get(pId)
                      return (
                        <span
                          key={pId}
                          onClick={() => pNode && setSelectedNode(pNode)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontSize: '0.74rem',
                            color: '#38bdf8',
                            cursor: 'pointer',
                          }}
                        >
                          ↳ {pNode?.label || pId}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Key Formulas */}
              {selectedNode.formulas && selectedNode.formulas.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                    Key Formulas:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedNode.formulas.map((form, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          color: '#fbbf24',
                        }}
                      >
                        {form}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedNode.simulation_id && (
                  <button
                    onClick={() => onLaunchSimulation?.(selectedNode.simulation_id!)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 10px rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    🧪 Launch Simulation in Virtual Lab
                  </button>
                )}
                <button
                  onClick={() => onStartChatTopic?.(selectedNode.label)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  💬 Start Focused Practice with Tark
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useRef, useEffect } from 'react'

export interface DualPaneTextbookViewProps {
  isOpen: boolean
  onClose: () => void
  board: string
  grade: string
  subject: string
  chapter: string
  source?: string
  initialPage?: number
  onAskSnippet: (snippetDataUrl: string, promptText: string, pageNumber: number) => void
}

export const DualPaneTextbookView: React.FC<DualPaneTextbookViewProps> = ({
  isOpen,
  onClose,
  board,
  grade,
  subject,
  chapter,
  source,
  initialPage = 1,
  onAskSnippet,
}) => {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [zoom, setZoom] = useState(1.0)
  const [snipMode, setSnipMode] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [snipPopover, setSnipPopover] = useState<{ x: number; y: number; dataUrl: string } | null>(null)
  const [customQuestion, setCustomQuestion] = useState('')

  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrentPage(initialPage)
    setSnipPopover(null)
    setCurrentBox(null)
  }, [initialPage, chapter])

  if (!isOpen) return null

  const pageImageUrl = source
    ? `http://127.0.0.1:8000/api/textbook/page-image?source=${encodeURIComponent(source)}&page=${currentPage}&chapter=${encodeURIComponent(chapter)}`
    : `http://127.0.0.1:8000/api/textbook/page-image?board=${encodeURIComponent(board)}&grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&page=${currentPage}`

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!snipMode || !imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setIsDrawing(true)
    setStartPos({ x, y })
    setCurrentBox(null)
    setSnipPopover(null)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos || !imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

    const x = Math.min(startPos.x, currentX)
    const y = Math.min(startPos.y, currentY)
    const w = Math.abs(currentX - startPos.x)
    const h = Math.abs(currentY - startPos.y)

    setCurrentBox({ x, y, w, h })
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox || !imgRef.current) {
      setIsDrawing(false)
      return
    }
    setIsDrawing(false)

    // If selection is too small, ignore
    if (currentBox.w < 20 || currentBox.h < 20) {
      setCurrentBox(null)
      return
    }

    // Crop snippet to canvas
    try {
      const img = imgRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height

      const canvas = document.createElement('canvas')
      canvas.width = currentBox.w * scaleX
      canvas.height = currentBox.h * scaleY
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(
          img,
          currentBox.x * scaleX,
          currentBox.y * scaleY,
          currentBox.w * scaleX,
          currentBox.h * scaleY,
          0,
          0,
          canvas.width,
          canvas.height
        )
        const dataUrl = canvas.toDataURL('image/png')
        setSnipPopover({
          x: currentBox.x + currentBox.w / 2,
          y: currentBox.y + currentBox.h + 10,
          dataUrl,
        })
      }
    } catch (e) {
      console.error('Failed to crop textbook region:', e)
    }
  }

  const submitSnippetQuery = (prompt: string) => {
    if (!snipPopover) return
    onAskSnippet(snipPopover.dataUrl, prompt, currentPage)
    setSnipPopover(null)
    setCurrentBox(null)
    setSnipMode(false)
  }

  return (
    <div className="dptv-container">
      {/* Left Pane Toolbar */}
      <div className="dptv-toolbar">
        <div className="dptv-meta">
          <span className="dptv-badge">📖 OFFICIAL TEXTBOOK</span>
          <span className="dptv-chapter-title" title={chapter}>
            {chapter || 'Chapter Study Scan'}
          </span>
        </div>

        {/* Page Nav & Controls */}
        <div className="dptv-controls">
          <button
            className="dptv-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            title="Previous Page"
          >
            ← Prev
          </button>
          <span className="dptv-page-indicator">Page {currentPage}</span>
          <button
            className="dptv-btn"
            onClick={() => setCurrentPage((p) => p + 1)}
            title="Next Page"
          >
            Next →
          </button>

          <div className="dptv-divider" />

          {/* Zoom controls */}
          <button
            className="dptv-btn dptv-btn-icon"
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            title="Zoom In"
          >
            🔍+
          </button>
          <button
            className="dptv-btn dptv-btn-icon"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
            title="Zoom Out"
          >
            🔍-
          </button>
          <button
            className="dptv-btn dptv-btn-icon"
            onClick={() => setZoom(1.0)}
            title="Fit Width / Reset Zoom"
          >
            ↺
          </button>

          <div className="dptv-divider" />

          {/* Snip / Click-to-Ask Toggle */}
          <button
            className={`dptv-btn dptv-btn-snip ${snipMode ? 'is-active' : ''}`}
            onClick={() => {
              setSnipMode(!snipMode)
              setCurrentBox(null)
              setSnipPopover(null)
            }}
            title="Snip a diagram or formula and ask Tark"
          >
            {snipMode ? '✂️ Snip Active (Drag Box)' : '✂️ Snip & Ask'}
          </button>

          <button
            className="dptv-btn dptv-btn-close"
            onClick={onClose}
            title="Close Book View"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Page Image Viewer with Bounding Box Selection */}
      <div
        className="dptv-viewer"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: snipMode ? 'crosshair' : 'default' }}
      >
        <div
          className="dptv-img-wrapper"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          <img
            ref={imgRef}
            src={pageImageUrl}
            alt={`Textbook Page ${currentPage}`}
            className="dptv-page-image"
            draggable={false}
          />

          {/* Render Active Selection Box */}
          {currentBox && (
            <div
              className="dptv-selection-box"
              style={{
                left: `${currentBox.x}px`,
                top: `${currentBox.y}px`,
                width: `${currentBox.w}px`,
                height: `${currentBox.h}px`,
              }}
            >
              <span className="dptv-selection-label">✂️ Selected Region</span>
            </div>
          )}

          {/* Floating Popover on Bounding Box Release */}
          {snipPopover && (
            <div
              className="dptv-popover"
              style={{
                left: `${Math.min(window.innerWidth * 0.35, Math.max(20, snipPopover.x))}px`,
                top: `${snipPopover.y}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dptv-popover-header">
                <span>✨ Ask Tark about this snippet:</span>
                <button onClick={() => { setSnipPopover(null); setCurrentBox(null); }}>✕</button>
              </div>

              {/* Quick Prompt Chips */}
              <div className="dptv-quick-chips">
                <button onClick={() => submitSnippetQuery(`Explain this diagram / section from Page ${currentPage} step-by-step:`)}>
                  🔍 Explain Diagram
                </button>
                <button onClick={() => submitSnippetQuery(`Solve this question from Page ${currentPage} with board marking steps:`)}>
                  ✍️ Solve Problem
                </button>
                <button onClick={() => submitSnippetQuery(`Deconstruct the grammar, sandhi, and word meanings in this line from Page ${currentPage}:`)}>
                  📖 Break Down Line
                </button>
              </div>

              {/* Custom question input */}
              <div className="dptv-popover-input-row">
                <input
                  type="text"
                  placeholder="Or ask a custom question..."
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customQuestion.trim()) {
                      submitSnippetQuery(customQuestion.trim())
                      setCustomQuestion('')
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (customQuestion.trim()) {
                      submitSnippetQuery(customQuestion.trim())
                      setCustomQuestion('')
                    }
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect, type MouseEvent } from 'react'

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

export function DiagramLightbox({ src, alt = 'Diagram', onClose }: Props) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }

  function handleMouseUp() {
    setIsDragging(false)
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = src
    a.download = `tark-diagram-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      className="lightbox-backdrop"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button
          className="lightbox-btn"
          onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
          title="Zoom In"
        >
          +
        </button>
        <button
          className="lightbox-btn"
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
          title="Zoom Out"
        >
          −
        </button>
        <button
          className="lightbox-btn"
          onClick={() => {
            setZoom(1)
            setPosition({ x: 0, y: 0 })
          }}
          title="Reset Zoom"
        >
          Reset ({Math.round(zoom * 100)}%)
        </button>
        <button
          className="lightbox-btn download-btn"
          onClick={handleDownload}
          title="Download diagram"
        >
          ⬇ Save Image
        </button>
        <button className="lightbox-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      <div
        className="lightbox-canvas"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}

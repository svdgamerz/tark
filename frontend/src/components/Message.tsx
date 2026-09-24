import { useEffect, useRef, useState } from 'react'
import { fetchTts, fetchSimulation, type ChatMessage } from '../api'
import type { SimulationData } from '../simulations/types'
import { InteractiveSimulation } from './InteractiveSimulation'
import {
  parseSegments,
  renderMarkdown,
  renderMath,
  stripDiagramForDisplay,
  formatPedagogicalSpeech,
  getSweetestBrowserVoice,
  splitSpeechSentences,
} from '../math'
import { Logo } from './Logo'
import { DiagramLightbox } from './DiagramLightbox'

/* ---- Minimal line icons (Lucide-style), 16px, inherit color ---- */
function Icon({ name }: { name: string }) {
  const p: Record<string, JSX.Element> = {
    copy: (
      <>
        <rect x="8" y="8" width="14" height="14" rx="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </>
    ),
    up: (
      <>
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
      </>
    ),
    down: (
      <>
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
      </>
    ),
    share: (
      <>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </>
    ),
    regen: (
      <>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </>
    ),
    sources: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
    branch: (
      <>
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </>
    ),
    speak: (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    ),
    stop: (
      <rect x="6" y="6" width="12" height="12" rx="2" />
    ),
    mic: (
      <>
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </>
    ),
    sim: (
      <>
        <path d="M10 2v7.31" />
        <path d="M14 2v7.31" />
        <path d="M8.5 2h7" />
        <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
        <path d="M5.52 16h12.96" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    zoom: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </>
    ),
    tune: (
      <>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </>
    ),
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p[name]}
    </svg>
  )
}

function fmtTime(at?: number): string {
  if (!at) return ''
  return new Date(at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Convert math and markdown to clean, natural human speech with teacher pauses
function speechText(s: string): string {
  return formatPedagogicalSpeech(s)
}

export function MessageView({
  message,
  streaming,
  canRegenerate,
  feedback,
  isLatest,
  onRegenerate,
  onFeedback,
  onBranch,
  onToast,
  onEdit,
  onFollowUp,
  onTalkLive,
  onShareWithFriend,
  userQuestion,
}: {
  message: ChatMessage
  streaming?: boolean
  canRegenerate?: boolean
  feedback?: 'up' | 'down'
  isLatest?: boolean
  userQuestion?: string
  onRegenerate?: () => void
  onFeedback?: (rating: 'up' | 'down') => void
  onBranch?: () => void
  onToast?: (msg: string) => void
  onEdit?: (newContent: string) => void
  onFollowUp?: (prompt: string) => void
  onTalkLive?: (conceptText: string) => void
  onShareWithFriend?: (doubtText: string) => void
}) {
  const isUser = message.role === 'user'
  const showDots = streaming && message.content === ''
  // Strip any diagram code the model emitted — it's rendered as a real figure.
  const displayText = isUser
    ? message.content
    : stripDiagramForDisplay(message.content)
  const segments = parseSegments(displayText)

  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [audioPaused, setAudioPaused] = useState(false)
  const [isNaturalAudio, setIsNaturalAudio] = useState(false)
  const [speechLoading, setSpeechLoading] = useState(false)
  const [speechSpeed, setSpeechSpeed] = useState(1.0)
  const utteranceQueueRef = useRef<{ sentences: string[]; index: number; timer: any }>({
    sentences: [],
    index: 0,
    timer: null,
  })
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [showEngineered, setShowEngineered] = useState(false)
  const [activeSim, setActiveSim] = useState<SimulationData | undefined>(message.simulation)
  const [isSimOpen, setIsSimOpen] = useState(false)
  const [simLoading, setSimLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (message.simulation) {
      setActiveSim(message.simulation)
    }
  }, [message.simulation])

  async function handleToggleSimulation() {
    if (isSimOpen) {
      setIsSimOpen(false)
      return
    }
    if (activeSim || message.simulation) {
      setIsSimOpen(true)
      return
    }
    setSimLoading(true)
    try {
      const topicQuery = (userQuestion && userQuestion.trim().length > 0) ? userQuestion : displayText
      const sim = await fetchSimulation(topicQuery, displayText)
      if (sim) {
        setActiveSim(sim)
        setIsSimOpen(true)
      } else {
        onToast?.('No interactive simulation available for this topic.')
      }
    } catch {
      onToast?.('Could not load interactive simulation.')
    } finally {
      setSimLoading(false)
    }
  }

  // Clean up any active speech or timer when unmounting
  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [])

  const showActions = !isUser && !streaming && message.content.trim() !== ''

  function saveEdit() {
    const v = draft.trim()
    setEditing(false)
    if (v && v !== message.content) onEdit?.(v)
  }

  function copy() {
    navigator.clipboard?.writeText(displayText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  function share() {
    navigator.clipboard?.writeText(displayText).then(() => {
      onToast?.('Answer copied to share')
    })
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (utteranceQueueRef.current.timer) {
      clearTimeout(utteranceQueueRef.current.timer)
      utteranceQueueRef.current.timer = null
    }
    utteranceQueueRef.current.sentences = []
    utteranceQueueRef.current.index = 0
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
    setAudioPaused(false)
    setIsNaturalAudio(false)
    setSpeechLoading(false)
  }

  function togglePauseResume() {
    if (audioRef.current) {
      if (audioPaused) {
        audioRef.current.play().catch(() => {})
        setAudioPaused(false)
      } else {
        audioRef.current.pause()
        setAudioPaused(true)
      }
      return
    }

    if ('speechSynthesis' in window) {
      if (audioPaused) {
        window.speechSynthesis.resume()
        setAudioPaused(false)
      } else {
        window.speechSynthesis.pause()
        setAudioPaused(true)
      }
    }
  }

  function cycleSpeed() {
    const nextSpeed = speechSpeed === 1.0 ? 1.25 : speechSpeed === 1.25 ? 0.85 : 1.0
    setSpeechSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    } else if (speaking) {
      const queue = utteranceQueueRef.current
      if (queue.sentences.length > 0) {
        window.speechSynthesis.cancel()
        speakNextSentence(nextSpeed)
      }
    }
  }

  function speakNextSentence(speed = speechSpeed) {
    const queue = utteranceQueueRef.current
    if (queue.index >= queue.sentences.length) {
      stopSpeaking()
      return
    }

    const currentSentence = queue.sentences[queue.index]
    const u = new SpeechSynthesisUtterance(currentSentence)
    const sweetVoice = getSweetestBrowserVoice()
    if (sweetVoice) u.voice = sweetVoice

    // Sweet, encouraging tutor pitch & calm, unhurried cadence
    u.pitch = 1.06
    u.rate = speed * 0.94

    u.onend = () => {
      queue.index++
      if (queue.index < queue.sentences.length) {
        const isQuestion = /\?$/.test(currentSentence)
        const isHeadingOrStep =
          currentSentence.includes('...') ||
          currentSentence.startsWith('Step') ||
          currentSentence.startsWith('Point')
        const pauseMs = isQuestion ? 500 : isHeadingOrStep ? 420 : 260
        queue.timer = setTimeout(() => {
          speakNextSentence(speed)
        }, pauseMs)
      } else {
        stopSpeaking()
      }
    }

    u.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        queue.index++
        speakNextSentence(speed)
      }
    }

    window.speechSynthesis.speak(u)
  }

  function fallbackSpeak(script: string, speed = speechSpeed) {
    if (!('speechSynthesis' in window)) {
      setSpeaking(false)
      onToast?.('Read-aloud not supported in this browser')
      return
    }
    stopSpeaking()

    const sentences = splitSpeechSentences(script)
    if (sentences.length === 0) return

    utteranceQueueRef.current.sentences = sentences
    utteranceQueueRef.current.index = 0
    setSpeaking(true)
    setAudioPaused(false)
    setIsNaturalAudio(false)

    speakNextSentence(speed)
  }

  async function readAloud() {
    setMenuOpen(false)
    if (speaking) {
      stopSpeaking()
      return
    }

    const script = speechText(displayText)
    if (!script) return

    // Instant local voice is default (0ms latency, sweetest browser voice)
    const useCloudTts = localStorage.getItem('tark_voice_engine') === 'cloud'
    const preferredVoice = localStorage.getItem('tark_voice_persona') || 'Aoede'

    if (!useCloudTts) {
      fallbackSpeak(script, speechSpeed)
      return
    }

    setSpeaking(true)
    setAudioPaused(false)
    setSpeechLoading(true)
    onToast?.('Starting cloud tutor voice…')

    try {
      const blob = await fetchTts(script, preferredVoice)
      setSpeechLoading(false)

      if (!blob) {
        onToast?.('Using sweet local tutor voice…')
        fallbackSpeak(script, speechSpeed)
        return
      }

      setIsNaturalAudio(true)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.playbackRate = speechSpeed
      audioRef.current = audio

      audio.onended = () => {
        stopSpeaking()
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        fallbackSpeak(script, speechSpeed)
      }
      await audio.play()
    } catch {
      setSpeechLoading(false)
      fallbackSpeak(script, speechSpeed)
    }
  }

  function branch() {
    setMenuOpen(false)
    onBranch?.()
  }

  function viewSources() {
    setMenuOpen(false)
    setShowSources((s) => !s)
    if (!message.sources?.length) onToast?.('Answered from general knowledge without textbook citations')
  }

  return (
    <>
      <div className={`msg ${isUser ? 'msg-user' : 'msg-tark'}`}>
        {!isUser && (
          <div className="avatar">
            <Logo size={17} />
          </div>
        )}
        <div className="msg-col">
          <div className={`content${editing ? ' editing' : ''}`}>
            {isUser && message.image && !editing && (
              <img
                className="msg-image"
                src={message.image}
                alt="attached"
                onClick={() => setLightboxImg(message.image ?? null)}
              />
            )}
            {editing ? (
              <div className="edit-box">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      saveEdit()
                    } else if (e.key === 'Escape') {
                      setEditing(false)
                    }
                  }}
                />
                <div className="edit-actions">
                  <button className="edit-cancel" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="edit-save" onClick={saveEdit}>
                    Save &amp; submit
                  </button>
                </div>
              </div>
            ) : showDots ? (
              <span className="dots" aria-label="Tark is thinking">
                <span />
                <span />
                <span />
              </span>
            ) : (
              <>
                {!isUser && message.engineeredPrompt && (
                  <div className="prompt-engineer-wrap">
                    <button
                      type="button"
                      className={`prompt-engineer-toggle ${showEngineered ? 'active' : ''}`}
                      onClick={() => setShowEngineered((v) => !v)}
                      title="View the prompt synthesized by Tark's dedicated Groq prompt engineering model"
                    >
                      <Icon name="tune" />
                      <span>Engineered Prompt</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          transform: showEngineered ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {showEngineered && (
                      <div className="prompt-engineer-card">
                        <div className="pe-card-meta">
                          <span className="pe-meta-title">Synthesized Pedagogical Prompt</span>
                          <span className="pe-meta-tag">Dedicated Groq Qwen 27B</span>
                        </div>
                        <div className="pe-card-text">{message.engineeredPrompt}</div>
                      </div>
                    )}
                  </div>
                )}
                {!isUser && message.textbook_page_image && !displayText.includes('/api/textbook/page-image') && (
                  <div className="md-image-card" style={{ marginBottom: '14px' }}>
                    <img
                      src={message.textbook_page_image}
                      alt="Textbook Page"
                      className="md-chat-image"
                      loading="eager"
                      onClick={() => setLightboxImg(message.textbook_page_image ?? null)}
                    />
                    <div className="md-image-caption">
                      <span>📖 Official Curriculum Study Page</span>
                      <span className="md-zoom-hint">Click to enlarge</span>
                    </div>
                  </div>
                )}
                <div
                  className="msg-body"
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.tagName === 'IMG' && target.classList.contains('md-chat-image')) {
                      const src = (target as HTMLImageElement).src
                      if (src) setLightboxImg(src)
                    }
                  }}
                >
                {segments.map((seg, i) =>
                  seg.type === 'math' ? (
                    seg.display ? (
                      <div
                        key={i}
                        className="math-block display-math"
                        dangerouslySetInnerHTML={{
                          __html: renderMath(seg.value, true),
                        }}
                      />
                    ) : (
                      <span
                        key={i}
                        className="math-block inline-math"
                        dangerouslySetInnerHTML={{
                          __html: renderMath(seg.value, false),
                        }}
                      />
                    )
                  ) : (
                    <span
                      key={i}
                      className="text-block"
                      style={{ whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.value) }}
                    />
                  ),
                )}
                </div>
              </>
            )}

            {!isUser && message.image && (
              <div
                className="figure-container"
                onClick={() => setLightboxImg(message.image ?? null)}
                title="Click to zoom & explore diagram"
              >
                <div className="figure-header-bar">
                  <span className="figure-badge">📐 Labelled Study Diagram</span>
                  <span className="figure-hint">🔍 Click to zoom & pan</span>
                </div>
                <img className="msg-image msg-figure" src={message.image} alt="Educational Study Diagram" loading="lazy" />
                <div className="figure-overlay">
                  <Icon name="zoom" /> Click to enlarge & explore
                </div>
              </div>
            )}

            {!isUser && (activeSim || message.simulation) && (
              <div className="msg-sim-prompt-banner">
                <div className="msg-sim-prompt-left">
                  <div className="msg-sim-prompt-icon-bubble">🧪</div>
                  <div className="msg-sim-prompt-text">
                    <span className="msg-sim-prompt-title">Interactive Virtual Lab Available</span>
                    <span className="msg-sim-prompt-desc">
                      {(activeSim || message.simulation)?.title || 'Explore with interactive physical & visual model'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`msg-sim-launch-btn ${isSimOpen ? 'open' : ''}`}
                  onClick={() => setIsSimOpen((open) => !open)}
                  title={isSimOpen ? 'Close interactive simulation' : 'Launch interactive simulation'}
                >
                  {isSimOpen ? '✕ Close Lab' : '🚀 Launch Simulation'}
                </button>
              </div>
            )}

            {!isUser && isSimOpen && (activeSim || message.simulation) && (
              <div className="msg-simulation-wrapper">
                <InteractiveSimulation simulation={(activeSim || message.simulation)!} />
              </div>
            )}
          </div>

          {showActions && (
            <>
              {showSources && (
                <div className="sources-panel">
                  {message.sources?.length ? (
                    <>
                      <div className="sources-title">Sources</div>
                      <ul>
                        {message.sources.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="sources-empty">
                      Answered from general knowledge.
                    </div>
                  )}
                </div>
              )}

              {/* Sweet Tutor Audio Player Bar */}
              {speaking && (
                <div className="msg-audio-player">
                  <button
                    onClick={togglePauseResume}
                    className="audio-play-pause-btn"
                    type="button"
                    disabled={speechLoading}
                    title={audioPaused ? 'Resume speech' : 'Pause speech'}
                  >
                    {speechLoading ? '⏳ Loading…' : audioPaused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <div className="audio-wave-anim">
                    <span className={`wave-bar b1 ${!audioPaused && !speechLoading ? 'wave-active' : ''}`} />
                    <span className={`wave-bar b2 ${!audioPaused && !speechLoading ? 'wave-active' : ''}`} />
                    <span className={`wave-bar b3 ${!audioPaused && !speechLoading ? 'wave-active' : ''}`} />
                    <span className={`wave-bar b4 ${!audioPaused && !speechLoading ? 'wave-active' : ''}`} />
                  </div>
                  <span className="audio-tutor-label">
                    🎙️ {isNaturalAudio ? 'Tark AI Tutor (Aoede)' : 'Tutor Voice'}
                  </span>
                  <button
                    onClick={cycleSpeed}
                    className="audio-speed-chip"
                    type="button"
                    title="Change playback speed"
                  >
                    {speechSpeed}x
                  </button>
                  <button
                    onClick={stopSpeaking}
                    className="audio-stop-btn"
                    type="button"
                    title="Stop reading aloud"
                    aria-label="Stop reading"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="msg-actions">
                <button onClick={copy} title="Copy answer" aria-label="Copy">
                  <Icon name={copied ? 'check' : 'copy'} />
                </button>
                <button
                  className={feedback === 'up' ? 'active' : ''}
                  onClick={() => onFeedback?.('up')}
                  title="Helpful response"
                  aria-label="Helpful response"
                >
                  <Icon name="up" />
                </button>
                <button
                  className={feedback === 'down' ? 'active' : ''}
                  onClick={() => onFeedback?.('down')}
                  title="Needs improvement"
                  aria-label="Needs improvement"
                >
                  <Icon name="down" />
                </button>
                <button onClick={share} title="Share" aria-label="Share">
                  <Icon name="share" />
                </button>
                {canRegenerate && (
                  <button
                    onClick={onRegenerate}
                    title="Regenerate response"
                    aria-label="Regenerate"
                  >
                    <Icon name="regen" />
                  </button>
                )}
                <button
                  className={speaking ? 'active speak-active' : ''}
                  onClick={readAloud}
                  title={speaking ? 'Stop speech' : 'Read Aloud: Listen to sweet teacher voice'}
                  aria-label="Read aloud"
                >
                  <Icon name={speaking ? 'stop' : 'speak'} />
                </button>
                <button
                  className="tl-action-btn"
                  onClick={() => onTalkLive?.(displayText)}
                  title="Talk Live: Recite from memory & get AI feedback"
                  aria-label="Speak to Master"
                >
                  <Icon name="mic" />
                  <span className="tl-btn-text">Speak to Master</span>
                </button>
                <button
                  className={`sim-action-btn ${isSimOpen ? 'active' : ''}`}
                  onClick={handleToggleSimulation}
                  title={isSimOpen ? 'Hide Interactive Simulation' : 'Launch Interactive Virtual Lab Simulation'}
                  aria-label="Interactive Simulation"
                >
                  <Icon name="sim" />
                  <span className="sim-btn-text">{simLoading ? 'Loading...' : isSimOpen ? 'Close Lab' : 'Simulate'}</span>
                </button>
                <div className="more-wrap">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    title="More"
                    aria-label="More options"
                    className={menuOpen ? 'active' : ''}
                  >
                    <Icon name="more" />
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className="menu-backdrop"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="msg-menu">
                        {message.at && (
                          <div className="menu-time">{fmtTime(message.at)}</div>
                        )}
                        <button className="menu-item" onClick={viewSources}>
                          <Icon name="sources" /> View sources
                        </button>
                        <button className="menu-item" onClick={branch}>
                          <Icon name="branch" /> Branch in new chat
                        </button>
                        <button className="menu-item" onClick={readAloud}>
                          <Icon name={speaking ? 'stop' : 'speak'} />{' '}
                          {speaking ? 'Stop' : 'Read aloud'}
                        </button>
                        <button
                          className="menu-item"
                          onClick={() => {
                            setMenuOpen(false)
                            onTalkLive?.(displayText)
                          }}
                        >
                          <Icon name="mic" /> Talk Live (Practice Answer)
                        </button>
                        {onShareWithFriend && (
                          <button
                            className="menu-item"
                            onClick={() => {
                              setMenuOpen(false)
                              onShareWithFriend(displayText)
                            }}
                          >
                            <Icon name="share" /> Share Doubt with Friend
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Pedagogical Follow-Up Chips */}
              {isLatest && !streaming && onFollowUp && (
                <div className="followup-chips">
                  {onTalkLive && (
                    <button
                      className="chip-btn chip-oral-mastery"
                      onClick={() => onTalkLive(displayText)}
                      title="Speak to Master this answer with AI voice evaluation"
                    >
                      🎙️ Speak to Master Answer
                    </button>
                  )}
                  {message.suggestions && message.suggestions.length > 0 ? (
                    message.suggestions.map((chip, idx) => (
                      <button
                        key={idx}
                        className="chip-btn"
                        onClick={() => onFollowUp(chip.prompt)}
                        title={chip.prompt}
                      >
                        {chip.label}
                      </button>
                    ))
                  ) : (
                    <>
                      <button
                        className="chip-btn"
                        onClick={() => onFollowUp('Explain this with a simpler everyday example')}
                      >
                        Simpler Example
                      </button>
                      <button
                        className="chip-btn"
                        onClick={() => onFollowUp('Give me a practice problem to test my understanding')}
                      >
                        Practice Problem
                      </button>
                      <button
                        className="chip-btn"
                        onClick={() => onFollowUp('Break this down step-by-step in more detail')}
                      >
                        Detailed Steps
                      </button>
                      <button
                        className="chip-btn"
                        onClick={() => onFollowUp('Can you draw or show a diagram for this concept?')}
                      >
                        Generate Diagram
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {isUser && onEdit && !editing && (
            <div className="msg-actions user-actions">
              <button
                onClick={() => {
                  setDraft(message.content)
                  setEditing(true)
                }}
                title="Edit message"
                aria-label="Edit message"
              >
                <Icon name="edit" />
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxImg && (
        <DiagramLightbox
          src={lightboxImg}
          alt="Enlarged diagram"
          onClose={() => setLightboxImg(null)}
        />
      )}
    </>
  )
}

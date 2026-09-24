import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { evaluateOral, fetchTts, type OralEvalResult } from '../api'
import { extractRecitationConcept, latexToSpeech, getSweetestBrowserVoice } from '../math'

/* ─── Types ─── */
type Phase = 'ready' | 'listening' | 'evaluating' | 'results'
type Lang = 'en-IN' | 'hi-IN'
type ResultsTab = 'feedback' | 'comparison'

export interface TalkLiveModalProps {
  /** The reference answer the student should recite */
  referenceText: string
  /** Optional context for the evaluation */
  subject?: string
  grade?: string
  board?: string
  /** Optional callback fired when student demonstrates mastery (>= 80% score) */
  onMastered?: (conceptTitle: string, score: number) => void
  /** Close the modal */
  onClose: () => void
}

/* ─── Helpers ─── */

/** Format seconds to MM:SS */
function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/* ─── Circular Score Ring SVG ─── */
function ScoreRing({ score, size = 110 }: { score: number; size?: number }) {
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const strokeColor =
    score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} className="tlm-score-svg">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="9"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="tlm-score-arc"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 - 5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        fontSize="26"
        fontWeight="800"
      >
        {score}%
      </text>
      <text
        x={size / 2}
        y={size / 2 + 18}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(150,160,180,0.85)"
        fontSize="10"
        fontWeight="600"
        letterSpacing="0.5"
      >
        ACCURACY
      </text>
    </svg>
  )
}

/* ─── Animated Voice Visualizer Wavebars ─── */
function VoiceWavebars({ active }: { active: boolean }) {
  return (
    <div className={`tlm-wavebars ${active ? 'active' : ''}`}>
      {[35, 60, 85, 45, 95, 70, 40, 80, 55, 90, 65, 30].map((h, i) => (
        <span
          key={i}
          className="tlm-wave-bar"
          style={{
            height: active ? `${h}%` : '20%',
            animationDelay: `${(i * 0.08).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Main Component ─── */
export function TalkLiveModal({
  referenceText,
  subject,
  grade,
  board,
  onMastered,
  onClose,
}: TalkLiveModalProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [lang, setLang] = useState<Lang>('en-IN')
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [result, setResult] = useState<OralEvalResult | null>(null)
  const [peekOpen, setPeekOpen] = useState(false)
  const [error, setError] = useState('')
  const [resultsTab, setResultsTab] = useState<ResultsTab>('feedback')

  // Gamified attempt history for "Beat your score"
  const [previousScore, setPreviousScore] = useState<number | null>(null)

  // Recording timer
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const timerIntervalRef = useRef<any>(null)

  // Audio playback state for feedback
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)

  const concept = useMemo(() => extractRecitationConcept(referenceText), [referenceText])
  const { title, coreConcept, keyBullets, fullCleanText, workedExample, targetForEvaluation } = concept

  // Clean up timers & speech on unmount
  useEffect(() => {
    return () => {
      stopListening()
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  /* ── Speech Recognition ── */
  const startListening = useCallback(() => {
    setError('')
    setTranscript('')
    setInterimText('')
    setRecordingSeconds(0)
    setPhase('listening')

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1)
    }, 1000)

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRec) {
      setError(
        'Live speech recognition is not available in this browser environment. You can type your answer directly in the box below to test your memory!',
      )
      return
    }

    try {
      const rec = new SpeechRec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = lang

      rec.onresult = (event: any) => {
        let final = ''
        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
          const t = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            final += t + ' '
          } else {
            interim = t
          }
        }
        if (final) setTranscript((prev) => prev + final)
        setInterimText(interim)
      }

      rec.onerror = (event: any) => {
        if (event.error !== 'aborted') {
          setError(
            `Microphone note: ${event.error}. You can speak again or type your answer directly in the box below!`,
          )
        }
      }

      rec.onend = () => {
        if (recognitionRef.current) {
          recognitionRef.current = null
        }
      }

      recognitionRef.current = rec
      rec.start()
    } catch {
      setError(
        'Microphone is not accessible. You can type your answer directly in the box below!',
      )
    }
  }, [lang])

  const stopListening = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  /* ── Play / Pause Voice Feedback ── */
  const playFeedbackAudio = useCallback(
    async (text: string) => {
      if (audioPlaying) {
        if (audioRef.current) audioRef.current.pause()
        if ('speechSynthesis' in window) window.speechSynthesis.cancel()
        setAudioPlaying(false)
        return
      }

      setAudioPlaying(true)
      const spokenText = latexToSpeech(text)

      const preferredVoice = localStorage.getItem('tark_voice_persona') || 'Aoede'

      try {
        const blob = await fetchTts(spokenText, preferredVoice)
        if (blob) {
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audio.playbackRate = audioSpeed
          audioRef.current = audio

          audio.onended = () => {
            setAudioPlaying(false)
            URL.revokeObjectURL(url)
          }
          audio.onerror = () => {
            browserSpeak(spokenText)
          }
          await audio.play()
        } else {
          browserSpeak(spokenText)
        }
      } catch {
        browserSpeak(spokenText)
      }
    },
    [audioPlaying, audioSpeed, lang],
  )

  function browserSpeak(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(text)
      utt.lang = lang
      const sweetVoice = getSweetestBrowserVoice()
      if (sweetVoice) utt.voice = sweetVoice
      utt.pitch = 1.06
      utt.rate = audioSpeed * 0.95
      utt.onend = () => setAudioPlaying(false)
      utt.onerror = () => setAudioPlaying(false)
      window.speechSynthesis.speak(utt)
    } else {
      setAudioPlaying(false)
    }
  }

  /* ── Evaluate ── */
  const handleEvaluate = useCallback(async () => {
    stopListening()
    const finalText = (transcript + ' ' + interimText).trim()
    setTranscript(finalText)
    setInterimText('')

    if (!finalText) {
      setError('No speech was detected. Please tap Start Speaking and recite out loud.')
      setPhase('ready')
      return
    }

    setPhase('evaluating')

    const res = await evaluateOral(
      finalText,
      targetForEvaluation,
      subject,
      grade,
      board,
    )

    if (res) {
      if (result) {
        setPreviousScore(result.accuracy_score)
      }
      setResult(res)
      setPhase('results')

      if (res.accuracy_score >= 80) {
        onMastered?.(title, res.accuracy_score)
      }

      if (res.feedback_speech) {
        void playFeedbackAudio(res.feedback_speech)
      }
    } else {
      setError('Assessment could not be completed. Please try again.')
      setPhase('ready')
    }
  }, [
    transcript,
    interimText,
    targetForEvaluation,
    subject,
    grade,
    board,
    stopListening,
    result,
    playFeedbackAudio,
  ])

  /* ── Retry / Beat Score ── */
  const handleRetry = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setAudioPlaying(false)

    if (result) {
      setPreviousScore(result.accuracy_score)
    }
    setPhase('ready')
    setTranscript('')
    setInterimText('')
    setError('')
  }, [result])

  const getBadgeInfo = (score: number) => {
    if (score >= 90) return { icon: '🌟', text: 'Mastered!', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
    if (score >= 75) return { icon: '🎯', text: 'Great Job!', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' }
    if (score >= 50) return { icon: '💪', text: 'Good Effort!', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    return { icon: '🌱', text: 'Keep Practicing', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
  }

  return (
    <div
      className="tlm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="tlm-card">
        {/* ── Top Bar with Student Steps ── */}
        <div className="tlm-top-bar">
          <div className="tlm-brand">
            <span className="tlm-brand-badge">🎙️ Talk Live</span>
            {subject && <span className="tlm-subject-chip">{subject}</span>}
          </div>

          <button className="tlm-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* ── 3-Step Student Progress Indicator ── */}
        <div className="tlm-steps-tracker">
          <div className={`tlm-step ${phase === 'ready' ? 'active' : 'done'}`}>
            <span className="tlm-step-num">1</span>
            <span className="tlm-step-label">Prepare</span>
          </div>
          <div className="tlm-step-line" />
          <div
            className={`tlm-step ${
              phase === 'listening' || phase === 'evaluating'
                ? 'active'
                : phase === 'results'
                ? 'done'
                : ''
            }`}
          >
            <span className="tlm-step-num">2</span>
            <span className="tlm-step-label">Recite</span>
          </div>
          <div className="tlm-step-line" />
          <div className={`tlm-step ${phase === 'results' ? 'active' : ''}`}>
            <span className="tlm-step-num">3</span>
            <span className="tlm-step-label">Feedback</span>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="tlm-alert-banner">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            PHASE 1: PREPARE & REVIEW
            ══════════════════════════════════════════════ */}
        {phase === 'ready' && (
          <div className="tlm-body tlm-ready-body">
            {/* Topic preview box */}
            <div className="tlm-topic-card">
              <div className="tlm-topic-card-header">
                <span className="tlm-card-icon">📖</span>
                <div>
                  <span className="tlm-topic-meta">CONCEPT TO RECITE</span>
                  <h3 className="tlm-topic-title">{title}</h3>
                </div>
              </div>

              <div className="tlm-prompt-target">
                <span className="tlm-target-label">Core Idea to Explain:</span>
                <p className="tlm-target-snippet">"{coreConcept}"</p>
                {keyBullets.length > 0 && (
                  <div className="tlm-key-bullets" style={{ marginTop: '10px' }}>
                    <span className="tlm-target-label" style={{ fontSize: '0.8rem', opacity: 0.85 }}>Key points to mention:</span>
                    <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: '0.9rem', lineHeight: '1.45' }}>
                      {keyBullets.map((bullet, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Expandable full reference */}
              <button
                className="tlm-peek-btn"
                onClick={() => setPeekOpen((o) => !o)}
                type="button"
              >
                <span>{peekOpen ? '▴ Hide full textbook explanation' : '▾ Peek at full textbook explanation'}</span>
              </button>

              {peekOpen && (
                <div className="tlm-full-text-scroll">
                  <p style={{ whiteSpace: 'pre-line' }}>{fullCleanText}</p>
                </div>
              )}
            </div>

            {/* Language Selection & Student Tip */}
            <div className="tlm-ready-settings">
              <div className="tlm-lang-picker">
                <span className="tlm-picker-label">Recite in:</span>
                <div className="tlm-pill-group">
                  <button
                    className={`tlm-pill-option ${lang === 'en-IN' ? 'active' : ''}`}
                    onClick={() => setLang('en-IN')}
                    type="button"
                  >
                    English
                  </button>
                  <button
                    className={`tlm-pill-option ${lang === 'hi-IN' ? 'active' : ''}`}
                    onClick={() => setLang('hi-IN')}
                    type="button"
                  >
                    हिन्दी
                  </button>
                </div>
              </div>

              <div className="tlm-tutor-hint">
                <span className="tlm-hint-emoji">💡</span>
                <span>
                  <strong>Tip:</strong> Don't worry about exact words. Speak naturally in your own words — Tark understands concepts!
                </span>
              </div>
            </div>

            {/* Action Button */}
            <div className="tlm-bottom-action">
              <button
                className="tlm-action-cta tlm-start-cta"
                onClick={startListening}
                type="button"
              >
                <span className="tlm-cta-icon">🎤</span>
                <span>Start Reciting</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            PHASE 2: LISTENING & RECORDING
            ══════════════════════════════════════════════ */}
        {phase === 'listening' && (
          <div className="tlm-body tlm-listening-body">
            {/* Dynamic Voice Hub */}
            <div className="tlm-voice-hub">
              <div className="tlm-status-pill">
                <span className="tlm-recording-dot" />
                <span>LISTENING LIVE • {formatTimer(recordingSeconds)}</span>
              </div>

              {/* Animated Wave visualizer */}
              <VoiceWavebars active={true} />

              <p className="tlm-listening-prompt">
                Explain the concept in your own words...
              </p>
            </div>

            {/* Live speech transcription display */}
            <div className="tlm-live-box">
              <div className="tlm-live-box-header">
                <span>Real-time Transcription</span>
                <span className="tlm-live-tag">Auto-detect</span>
              </div>
              <div className="tlm-transcript-viewport">
                <textarea
                  className="tlm-transcript-textarea"
                  value={transcript + (interimText ? (transcript ? ' ' : '') + interimText : '')}
                  onChange={(e) => {
                    setTranscript(e.target.value)
                    setInterimText('')
                  }}
                  placeholder="Speak your answer from memory... your words will appear here in real time (or type here if needed)"
                  rows={3}
                />
              </div>
              <span className="tlm-transcript-hint">
                💬 Speak into your mic, or edit words above if any scientific terms were misheard.
              </span>
            </div>

            {/* Controls */}
            <div className="tlm-listening-actions">
              <button
                className="tlm-btn-secondary"
                onClick={() => {
                  stopListening()
                  setPhase('ready')
                }}
                type="button"
              >
                ↺ Cancel
              </button>
              <button
                className="tlm-action-cta tlm-finish-cta"
                onClick={handleEvaluate}
                type="button"
              >
                <span>Check My Answer</span>
                <span className="tlm-arrow">➔</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            PHASE 2.5: EVALUATING
            ══════════════════════════════════════════════ */}
        {phase === 'evaluating' && (
          <div className="tlm-body tlm-evaluating-body">
            <div className="tlm-eval-avatar-wrap">
              <div className="tlm-eval-pulse-circle" />
              <div className="tlm-eval-tark-logo">🤖</div>
            </div>
            <h3 className="tlm-eval-headline">Tark is assessing your recitation...</h3>
            <p className="tlm-eval-subtext">
              Checking conceptual accuracy, key scientific terms, and completeness.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            PHASE 3: RESULTS & COACHING
            ══════════════════════════════════════════════ */}
        {phase === 'results' && result && (
          <div className="tlm-body tlm-results-body">
            {/* Score & Badge Showcase */}
            <div className="tlm-results-hero">
              <ScoreRing score={result.accuracy_score} />

              <div className="tlm-hero-meta">
                {(() => {
                  const badge = getBadgeInfo(result.accuracy_score)
                  return (
                    <div
                      className="tlm-grade-badge"
                      style={{ color: badge.color, backgroundColor: badge.bg }}
                    >
                      <span className="tlm-badge-icon">{badge.icon}</span>
                      <span className="tlm-badge-text">{badge.text}</span>
                    </div>
                  )
                })()}

                <h4 className="tlm-hero-title">
                  {result.accuracy_score >= 80
                    ? 'Superb understanding!'
                    : result.accuracy_score >= 60
                    ? 'Good conceptual grasp!'
                    : 'Good attempt, keep practicing!'}
                </h4>

                {previousScore !== null && (
                  <div className="tlm-improvement-chip">
                    {result.accuracy_score >= previousScore ? (
                      <span className="tlm-improved-up">
                        📈 +{result.accuracy_score - previousScore}% higher than your last try!
                      </span>
                    ) : (
                      <span className="tlm-improved-down">
                        Last try: {previousScore}% • Target: Beat your best!
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tutor Voice Audio Coach */}
            {result.feedback_speech && (
              <div className="tlm-audio-coach-card">
                <div className="tlm-coach-header">
                  <div className="tlm-coach-speaker">
                    <span className="tlm-speaker-icon">🗣️</span>
                    <div>
                      <span className="tlm-coach-name">Tark Voice Coach</span>
                      <span className="tlm-coach-status">
                        {audioPlaying ? 'Speaking now...' : 'Click to listen'}
                      </span>
                    </div>
                  </div>

                  <div className="tlm-coach-controls">
                    <button
                      className="tlm-speed-chip"
                      onClick={() =>
                        setAudioSpeed((s) => (s === 1.0 ? 1.25 : s === 1.25 ? 0.9 : 1.0))
                      }
                      title="Adjust voice speed"
                      type="button"
                    >
                      {audioSpeed}x
                    </button>
                    <button
                      className={`tlm-play-btn ${audioPlaying ? 'playing' : ''}`}
                      onClick={() => void playFeedbackAudio(result.feedback_speech)}
                      type="button"
                    >
                      {audioPlaying ? '⏸ Pause' : '▶ Play Voice'}
                    </button>
                  </div>
                </div>

                <p className="tlm-coach-text">"{result.feedback_speech}"</p>
              </div>
            )}

            {/* Results Navigation Tabs */}
            <div className="tlm-tab-row">
              <button
                className={`tlm-tab-btn ${resultsTab === 'feedback' ? 'active' : ''}`}
                onClick={() => setResultsTab('feedback')}
                type="button"
              >
                Concept Checklist
              </button>
              <button
                className={`tlm-tab-btn ${resultsTab === 'comparison' ? 'active' : ''}`}
                onClick={() => setResultsTab('comparison')}
                type="button"
              >
                Word Comparison
              </button>
            </div>

            {/* Tab 1: Concept Checklist */}
            {resultsTab === 'feedback' && (
              <div className="tlm-tab-content">
                <div className="tlm-concepts-grid">
                  {/* Covered */}
                  <div className="tlm-concept-col tlm-col-covered">
                    <div className="tlm-col-header">
                      <span className="tlm-icon-check">✓</span>
                      <span>Concepts Covered ({result.key_points_covered.length})</span>
                    </div>
                    <ul className="tlm-points-list">
                      {result.key_points_covered.length > 0 ? (
                        result.key_points_covered.map((point, idx) => (
                          <li key={idx} className="tlm-point-item covered">
                            <span className="tlm-bullet">✓</span>
                            <span>{point}</span>
                          </li>
                        ))
                      ) : (
                        <li className="tlm-point-empty">None detected yet.</li>
                      )}
                    </ul>
                  </div>

                  {/* Missing / To Add */}
                  <div className="tlm-concept-col tlm-col-missed">
                    <div className="tlm-col-header">
                      <span className="tlm-icon-missed">💡</span>
                      <span>Points to Add Next Time ({result.key_points_missing.length})</span>
                    </div>
                    <ul className="tlm-points-list">
                      {result.key_points_missing.length > 0 ? (
                        result.key_points_missing.map((point, idx) => (
                          <li key={idx} className="tlm-point-item missed">
                            <span className="tlm-bullet">+</span>
                            <span>{point}</span>
                          </li>
                        ))
                      ) : (
                        <li className="tlm-point-empty all-done">
                          🎉 All core points were covered!
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Tutor Memory Tip */}
                {result.tutor_tip && (
                  <div className="tlm-tutor-tip-card">
                    <span className="tlm-tip-lamp">🎯</span>
                    <div>
                      <span className="tlm-tip-title">Memory Trick:</span>
                      <p className="tlm-tip-body">{result.tutor_tip}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Word-by-Word Comparison */}
            {resultsTab === 'comparison' && (
              <div className="tlm-tab-content tlm-comparison-content">
                <div className="tlm-compare-box">
                  <div className="tlm-compare-col">
                    <span className="tlm-compare-tag user">What You Said:</span>
                    <div className="tlm-compare-text">
                      {transcript || 'No speech recorded.'}
                    </div>
                  </div>

                  <div className="tlm-compare-col">
                    <span className="tlm-compare-tag ref">Ideal Concept Answer:</span>
                    <div className="tlm-compare-text" style={{ whiteSpace: 'pre-line' }}>
                      {targetForEvaluation}
                      {workedExample && (
                        <details style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--accent, #6366f1)', fontWeight: 600, fontSize: '0.88rem' }}>
                            ▾ Step-by-Step Worked Problem
                          </summary>
                          <div style={{ marginTop: '8px', fontSize: '0.88rem', opacity: 0.9, lineHeight: '1.5' }}>
                            {workedExample}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>

                {result.matched_keywords && result.matched_keywords.length > 0 && (
                  <div className="tlm-matched-keywords">
                    <span className="tlm-match-title">Academic Terms Matched:</span>
                    <div className="tlm-chips-cloud">
                      {result.matched_keywords.map((kw, i) => (
                        <span key={i} className="tlm-keyword-chip">
                          ✓ {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="tlm-results-footer">
              <button
                className="tlm-btn-secondary"
                onClick={onClose}
                type="button"
              >
                Done
              </button>
              <button
                className="tlm-action-cta tlm-retry-cta"
                onClick={handleRetry}
                type="button"
              >
                <span>🔄 Practice Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'

export interface LiveVoiceModalProps {
  isOpen: boolean
  onClose: () => void
  targetConcept: string
  subject?: string
  grade?: string
  board?: string
}

interface EvaluationResult {
  accuracy_score: number
  grade_label: string
  key_points_covered: string[]
  key_points_missing: string[]
  feedback_speech: string
  feedback_markdown: string
  target_summary: string
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  targetConcept,
  subject = 'Science',
  grade = '9',
  board = 'Maharashtra State Board (Balbharati)',
}) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [language, setLanguage] = useState('en-IN')
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [showPeek, setShowPeek] = useState(false)
  const [isSpeakingTutor, setIsSpeakingTutor] = useState(false)
  const [activeVolume, setActiveVolume] = useState(0)

  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (!isOpen) {
      handleStopListening()
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setIsSpeakingTutor(false)
      setResult(null)
      setTranscript('')
      return
    }
  }, [isOpen])

  // Start Speech Recognition
  const handleStartListening = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeakingTutor(false)
    setResult(null)

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      alert('Speech Recognition is not supported in this browser. Please try Google Chrome or Microsoft Edge.')
      return
    }

    try {
      const rec = new SpeechRec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = language

      rec.onstart = () => {
        setIsListening(true)
      }

      rec.onresult = (event: any) => {
        let currentText = ''
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript + ' '
        }
        setTranscript(currentText.trim())
        setActiveVolume(Math.min(1, Math.random() * 0.7 + 0.3))
      }

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
      }

      rec.onend = () => {
        setIsListening(false)
        setActiveVolume(0)
      }

      rec.start()
      recognitionRef.current = rec
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
      setIsListening(false)
    }
  }

  const handleStopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {}
      recognitionRef.current = null
    }
    setIsListening(false)
    setActiveVolume(0)
  }

  // Submit transcript for evaluation
  const handleEvaluate = async () => {
    handleStopListening()
    if (!transcript.trim()) {
      alert('Please recite your answer into the microphone first!')
      return
    }

    setIsEvaluating(true)
    try {
      const res = await fetch('http://127.0.0.1:8000/api/voice/evaluate-recitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_concept: targetConcept,
          student_transcript: transcript,
          subject,
          grade,
          board,
          language,
        }),
      })

      if (!res.ok) throw new Error('Evaluation request failed')
      const data: EvaluationResult = await res.json()
      setResult(data)

      // Spoken voice feedback from Tark
      if (data.feedback_speech && 'speechSynthesis' in window) {
        speakTutorFeedback(data.feedback_speech)
      }
    } catch (e) {
      console.error('Evaluation error:', e)
      alert('Failed to evaluate recitation. Please try again.')
    } finally {
      setIsEvaluating(false)
    }
  }

  const speakTutorFeedback = (text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 1.0
    utter.pitch = 1.0

    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(
      (v) => v.lang.includes('IN') || v.name.includes('India') || v.name.includes('Natural')
    )
    if (preferredVoice) utter.voice = preferredVoice

    utter.onstart = () => setIsSpeakingTutor(true)
    utter.onend = () => setIsSpeakingTutor(false)
    utter.onerror = () => setIsSpeakingTutor(false)

    window.speechSynthesis.speak(utter)
  }

  const toggleTutorSpeech = () => {
    if (isSpeakingTutor) {
      window.speechSynthesis.cancel()
      setIsSpeakingTutor(false)
    } else if (result?.feedback_speech) {
      speakTutorFeedback(result.feedback_speech)
    }
  }

  if (!isOpen) return null

  return (
    <div className="lvm-backdrop" onClick={onClose}>
      <div className="lvm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lvm-header">
          <div className="lvm-title-group">
            <span className="lvm-badge">🎙️ LIVE ORAL PRACTICE</span>
            <h2>Talk Live with Tark</h2>
            <p className="lvm-subtitle">Recite your answer from memory. Tark will listen, score your accuracy, and point out mistakes!</p>
          </div>
          <button className="lvm-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Language & Target Subject Bar */}
        <div className="lvm-toolbar">
          <div className="lvm-meta-tags">
            <span className="lvm-tag">{subject}</span>
            <span className="lvm-tag">Class {grade}</span>
            <span className="lvm-tag">{board.replace(/\(.*?\)/, '')}</span>
          </div>

          <div className="lvm-lang-selector">
            <label htmlFor="lvm-lang">Spoken Language:</label>
            <select
              id="lvm-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isListening}
            >
              <option value="en-IN">English (Indian)</option>
              <option value="hi-IN">Hindi (हिंदी)</option>
              <option value="mr-IN">Marathi (मराठी)</option>
              <option value="sa-IN">Sanskrit (संस्कृतम्)</option>
            </select>
          </div>
        </div>

        {/* Main Body */}
        <div className="lvm-body">
          {/* Main Panel */}
          <div className="lvm-main-panel">
            {/* Visualizer Orb */}
            <div className={`lvm-orb-container ${isListening ? 'is-active' : ''} ${isSpeakingTutor ? 'is-tutor-speaking' : ''}`}>
              <div
                className="lvm-voice-orb"
                style={{
                  transform: isListening ? `scale(${1 + activeVolume * 0.35})` : 'scale(1)',
                }}
              >
                <div className="lvm-orb-inner">
                  {isListening ? '🎙️' : isSpeakingTutor ? '🔊' : '🧠'}
                </div>
              </div>
              <span className="lvm-status-label">
                {isListening
                  ? 'Listening to you... Recite your answer!'
                  : isSpeakingTutor
                  ? 'Tark is speaking feedback...'
                  : isEvaluating
                  ? 'Tark is analyzing your recitation...'
                  : transcript
                  ? 'Recitation recorded. Ready to evaluate!'
                  : 'Click the button below to start reciting'}
              </span>
            </div>

            {/* Live Transcript Area */}
            <div className="lvm-transcript-box">
              <div className="lvm-tb-header">
                <span>Your Spoken Transcript:</span>
                {transcript && (
                  <button className="lvm-tb-clear" onClick={() => setTranscript('')} disabled={isListening}>
                    Clear
                  </button>
                )}
              </div>
              <textarea
                className="lvm-transcript-input"
                placeholder={isListening ? 'Listening... speak clearly into your mic.' : 'Your spoken words will appear here in real-time... (You can also type/edit if needed)'}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={isListening}
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="lvm-actions">
              {!isListening ? (
                <button className="lvm-btn lvm-btn-record" onClick={handleStartListening}>
                  <span className="lvm-btn-icon">🎙️</span> Start Reciting
                </button>
              ) : (
                <button className="lvm-btn lvm-btn-stop" onClick={handleStopListening}>
                  <span className="lvm-btn-icon">⏹️</span> Done Speaking
                </button>
              )}

              <button
                className="lvm-btn lvm-btn-evaluate"
                onClick={handleEvaluate}
                disabled={isListening || isEvaluating || !transcript.trim()}
              >
                {isEvaluating ? (
                  <>
                    <span className="lvm-spinner" /> Evaluating...
                  </>
                ) : (
                  <>
                    <span className="lvm-btn-icon">✨</span> Check My Answer
                  </>
                )}
              </button>

              <button
                className="lvm-btn lvm-btn-peek"
                onClick={() => setShowPeek(!showPeek)}
                title="Toggle reference answer"
              >
                {showPeek ? '🙈 Hide Target' : '👁️ Peek Answer'}
              </button>
            </div>

            {/* Evaluation Scorecard */}
            {result && (
              <div className="lvm-scorecard">
                <div className="lvm-score-header">
                  <div className={`lvm-score-ring ${result.accuracy_score >= 80 ? 'is-high' : result.accuracy_score >= 60 ? 'is-mid' : 'is-low'}`}>
                    <span className="lvm-score-num">{result.accuracy_score}%</span>
                    <span className="lvm-score-tag">Accuracy</span>
                  </div>
                  <div className="lvm-score-meta">
                    <h3 className="lvm-grade-label">{result.grade_label}</h3>
                    <p className="lvm-feedback-speech">"{result.feedback_speech}"</p>
                    <button className="lvm-btn-listen-again" onClick={toggleTutorSpeech}>
                      {isSpeakingTutor ? '🔇 Mute Voice' : '🔊 Replay Tark Voice'}
                    </button>
                  </div>
                </div>

                {/* Covered & Missing Chips */}
                <div className="lvm-chips-grid">
                  <div className="lvm-chips-col lvm-chips-covered">
                    <h4>✅ Key Concepts Covered ({result.key_points_covered.length})</h4>
                    <ul>
                      {result.key_points_covered.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="lvm-chips-col lvm-chips-missing">
                    <h4>⚠️ Concepts Missed / To Add ({result.key_points_missing.length})</h4>
                    <ul>
                      {result.key_points_missing.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Target Reference Peek Pane */}
          {showPeek && (
            <div className="lvm-peek-pane">
              <div className="lvm-pp-header">
                <h3>Target Concept / Key Rule</h3>
                <button onClick={() => setShowPeek(false)}>✕</button>
              </div>
              <div className="lvm-pp-content">
                <p>{targetConcept}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  activeSimTitle?: string
}

interface CommandLogItem {
  id: string
  speaker: 'student' | 'tark'
  text: string
  action?: string
  timestamp: string
}

export const VoiceLabPartnerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  activeSimTitle = 'Interactive STEM Simulation',
}) => {
  const [isHandsFree, setIsHandsFree] = useState<boolean>(true)
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const [currentSpeech, setCurrentSpeech] = useState<string>('')
  const [language, setLanguage] = useState<string>('en-IN')
  const [commandLogs, setCommandLogs] = useState<CommandLogItem[]>([
    {
      id: '1',
      speaker: 'tark',
      text: `Hands-free Lab Partner ready! You can say: "Set angle to 45", "Launch projectile", "Moon gravity", or ask any question.`,
      timestamp: 'Just now',
    },
  ])

  const recognitionRef = useRef<any>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Canvas Audio Waveform Visualizer
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let phase = 0

    const renderWaveform = () => {
      animFrameRef.current = requestAnimationFrame(renderWaveform)
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      phase += 0.08
      const isLive = isListening || isSpeaking
      const amp = isLive ? (isSpeaking ? 28 : 18) : 4

      // Draw multi-layered glow sine waves
      const waves = [
        { color: 'rgba(56, 189, 248, 0.8)', freq: 0.02, speed: 1.0, width: 2.5 },
        { color: 'rgba(168, 85, 247, 0.6)', freq: 0.03, speed: -0.8, width: 1.8 },
        { color: 'rgba(34, 197, 94, 0.5)', freq: 0.015, speed: 1.4, width: 1.5 },
      ]

      for (const w of waves) {
        ctx.beginPath()
        ctx.lineWidth = w.width
        ctx.strokeStyle = w.color

        for (let x = 0; x < width; x += 3) {
          const y = height / 2 + Math.sin(x * w.freq + phase * w.speed) * amp * Math.sin((x / width) * Math.PI)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    renderWaveform()
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isOpen, isListening, isSpeaking])

  // TTS Speech Output
  const speakTark = (text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = 1.05
    utterance.pitch = 1.0

    // Try finding natural English or Indian English voice
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find((v) => v.lang.includes('IN') || v.name.includes('Natural') || v.lang.includes('en-GB'))
    if (match) utterance.voice = match

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  // Voice Command Dispatcher to Active Simulation
  const processVoiceCommand = (rawText: string) => {
    const text = rawText.toLowerCase().trim()
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Add student prompt to log
    setCommandLogs((prev) => [
      ...prev,
      { id: String(Date.now()), speaker: 'student', text: rawText, timestamp: now },
    ])

    // Broadcast commands to simulation iframe via postMessage
    const iframes = document.querySelectorAll('iframe')

    // Pattern 1: Set Angle
    const angleMatch = text.match(/(?:angle|deg|degrees?)\s*(?:to\s*)?(\d+)/) || text.match(/set\s*angle\s*(\d+)/)
    if (angleMatch) {
      const val = parseInt(angleMatch[1], 10)
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'tark_set_param', key: 'angle', value: val }, '*')
      })
      const reply = `Setting launch angle to ${val} degrees.`
      speakTark(reply)
      setCommandLogs((prev) => [
        ...prev,
        { id: String(Date.now() + 1), speaker: 'tark', text: reply, action: `angle: ${val}°`, timestamp: now },
      ])
      return
    }

    // Pattern 2: Set Speed / Velocity
    const speedMatch = text.match(/(?:speed|velocity)\s*(?:to\s*)?(\d+)/)
    if (speedMatch) {
      const val = parseInt(speedMatch[1], 10)
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'tark_set_param', key: 'speed', value: val }, '*')
      })
      const reply = `Adjusting initial speed to ${val} meters per second.`
      speakTark(reply)
      setCommandLogs((prev) => [
        ...prev,
        { id: String(Date.now() + 1), speaker: 'tark', text: reply, action: `speed: ${val} m/s`, timestamp: now },
      ])
      return
    }

    // Pattern 3: Moon / Earth Gravity
    if (text.includes('moon') || text.includes('lunar')) {
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'tark_set_param', key: 'gravity', value: 1.62 }, '*')
      })
      const reply = `Switched gravity to 1.62 m/s², simulating the Moon.`
      speakTark(reply)
      setCommandLogs((prev) => [
        ...prev,
        { id: String(Date.now() + 1), speaker: 'tark', text: reply, action: 'gravity: 1.62', timestamp: now },
      ])
      return
    }
    if (text.includes('earth') || text.includes('normal gravity')) {
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'tark_set_param', key: 'gravity', value: 9.8 }, '*')
      })
      const reply = `Reset gravity to standard Earth gravity, 9.8 m/s².`
      speakTark(reply)
      setCommandLogs((prev) => [
        ...prev,
        { id: String(Date.now() + 1), speaker: 'tark', text: reply, action: 'gravity: 9.8', timestamp: now },
      ])
      return
    }

    // Pattern 4: Launch / Fire
    if (text.includes('launch') || text.includes('fire') || text.includes('start') || text.includes('shoot')) {
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'tark_reset_sim' }, '*')
      })
      const reply = `Firing projectile now! Watch the trajectory arc.`
      speakTark(reply)
      setCommandLogs((prev) => [
        ...prev,
        { id: String(Date.now() + 1), speaker: 'tark', text: reply, action: 'Simulation Triggered', timestamp: now },
      ])
      return
    }

    // Pattern 5: Reset
    if (text.includes('reset') || text.includes('clear')) {
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'tark_reset_sim' }, '*')
      })
      const reply = `Simulation parameters reset to initial conditions.`
      speakTark(reply)
      setCommandLogs((prev) => [
        ...prev,
        { id: String(Date.now() + 1), speaker: 'tark', text: reply, action: 'Reset Lab', timestamp: now },
      ])
      return
    }

    // Default: General Socratic Lab Partner guidance
    const generalReply = `Got it. For maximum range in projectile motion, remember the launch angle should be 45 degrees when landing at equal elevation!`
    speakTark(generalReply)
    setCommandLogs((prev) => [
      ...prev,
      { id: String(Date.now() + 1), speaker: 'tark', text: generalReply, timestamp: now },
    ])
  }

  // Toggle Speech Recognition
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      alert('Speech Recognition is not supported in this browser. Try Chrome or Edge.')
      return
    }

    try {
      const rec = new SpeechRec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = language

      rec.onstart = () => setIsListening(true)
      rec.onresult = (event: any) => {
        let finalPhrase = ''
        let interimPhrase = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalPhrase += event.results[i][0].transcript
          } else {
            interimPhrase += event.results[i][0].transcript
          }
        }
        setCurrentSpeech(interimPhrase || finalPhrase)
        if (finalPhrase.trim()) {
          processVoiceCommand(finalPhrase.trim())
          setCurrentSpeech('')
        }
      }

      rec.onerror = (e: any) => console.warn('Speech error:', e)
      rec.onend = () => {
        // Auto restart if hands-free is enabled
        if (isHandsFree && isOpen) {
          try {
            rec.start()
          } catch {}
        } else {
          setIsListening(false)
        }
      }

      recognitionRef.current = rec
      rec.start()
    } catch (err) {
      console.error(err)
    }
  }

  // Start listening on open
  useEffect(() => {
    if (isOpen) {
      toggleListening()
    } else {
      recognitionRef.current?.stop()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [isOpen])

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
          maxWidth: '720px',
          background: '#070d18',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.15)',
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
                background: isListening
                  ? 'linear-gradient(135deg, #0284c7, #38bdf8)'
                  : 'linear-gradient(135deg, #475569, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isListening ? '0 0 16px rgba(56, 189, 248, 0.5)' : 'none',
                fontSize: '20px',
                transition: 'all 0.3s ease',
              }}
            >
              🎙️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                  Voice-First "Lab Partner"
                </h2>
                <span
                  style={{
                    background: isListening ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isListening ? '#22c55e' : '#f87171',
                    border: isListening ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  {isListening ? '● Live Hands-Free' : '○ Mic Muted'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Connected to: <strong style={{ color: '#38bdf8' }}>{activeSimTitle}</strong>
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
            }}
          >
            ✕
          </button>
        </div>

        {/* Audio Waveform Canvas */}
        <div style={{ background: '#050914', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative' }}>
          <canvas ref={canvasRef} width={680} height={100} style={{ width: '100%', height: '100px', display: 'block' }} />

          {/* Current speech preview */}
          {currentSpeech && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '20px',
                right: '20px',
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: '#38bdf8',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              "{currentSpeech}..."
            </div>
          )}
        </div>

        {/* Command History Feed */}
        <div
          style={{
            height: '240px',
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            background: 'rgba(7, 13, 24, 0.6)',
          }}
        >
          {commandLogs.map((log) => {
            const isTark = log.speaker === 'tark'
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isTark ? 'flex-start' : 'flex-end',
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: isTark ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                    background: isTark ? 'rgba(15, 23, 42, 0.9)' : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                    border: isTark ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                    color: '#f8fafc',
                    fontSize: '0.84rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {log.text}
                  {log.action && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-block',
                      }}
                    >
                      ⚡ Dispatched: {log.action}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#64748b',
                    marginTop: '2px',
                    alignSelf: isTark ? 'flex-start' : 'flex-end',
                  }}
                >
                  {log.timestamp}
                </span>
              </div>
            )
          })}
        </div>

        {/* Suggested Voice Commands Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(11, 19, 36, 0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Try saying:</span>
          {[
            'Set angle to 45',
            'Launch projectile',
            'Switch to Moon gravity',
            'Set speed to 30',
            'Reset experiment',
          ].map((phrase, i) => (
            <button
              key={i}
              onClick={() => processVoiceCommand(phrase)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: '999px',
                color: '#e2e8f0',
                fontSize: '0.74rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🗣️ "{phrase}"
            </button>
          ))}
        </div>

        {/* Footer Controls */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#070d18',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isHandsFree}
                onChange={(e) => setIsHandsFree(e.target.checked)}
                style={{ accentColor: '#38bdf8' }}
              />
              <span>Continuous Listening</span>
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontSize: '0.74rem',
              }}
            >
              <option value="en-IN">English (India)</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
            </select>
          </div>

          <button
            onClick={toggleListening}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(135deg, #0284c7, #38bdf8)',
              border: isListening ? '1px solid #ef4444' : 'none',
              color: isListening ? '#f87171' : '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isListening ? '🛑 Mute Partner' : '🎙️ Start Partner'}
          </button>
        </div>
      </div>
    </div>
  )
}

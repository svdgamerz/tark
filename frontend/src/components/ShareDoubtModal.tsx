import { useEffect, useState } from 'react'
import {
  socialApi,
  type Friend,
  type SocialChannel,
} from '../socialApi'
import { parseSegments, renderMath } from '../math'

interface Props {
  isOpen: boolean
  onClose: () => void
  token: string | null
  doubtPayload: {
    subject?: string
    chapter?: string
    formula?: string
    content: string
  } | null
  onDoubtShared: (channelId: string) => void
}

export function ShareDoubtModal({
  isOpen,
  onClose,
  token,
  doubtPayload,
  onDoubtShared,
}: Props) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [selectedTarget, setSelectedTarget] = useState<string>('')
  const [personalNote, setPersonalNote] = useState('Can you help me solve this step?')
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !token) return
    setLoading(true)
    setError(null)

    Promise.all([socialApi.getFriends(token), socialApi.getChannels(token)])
      .then(([fRes, cRes]) => {
        if (fRes.ok && fRes.data) {
          setFriends(fRes.data.friends)
        }
        if (cRes.ok && cRes.data) {
          setChannels(cRes.data.channels)
          // Default select first channel or friend if available
          if (cRes.data.channels.length > 0) {
            setSelectedTarget(`chan:${cRes.data.channels[0].id}`)
          } else if (fRes.data?.friends && fRes.data.friends.length > 0) {
            setSelectedTarget(`friend:${fRes.data.friends[0].id}`)
          }
        }
      })
      .catch(() => setError('Unable to load friend list'))
      .finally(() => setLoading(false))
  }, [isOpen, token])

  if (!isOpen || !doubtPayload) return null

  const handleShare = async () => {
    if (!token || !selectedTarget) return
    setSharing(true)
    setError(null)

    try {
      let targetChannelId = ''

      if (selectedTarget.startsWith('chan:')) {
        targetChannelId = selectedTarget.replace('chan:', '')
      } else if (selectedTarget.startsWith('friend:')) {
        const friendId = parseInt(selectedTarget.replace('friend:', ''), 10)
        const dirRes = await socialApi.getOrCreateDirectChannel(friendId, token)
        if (!dirRes.ok || !dirRes.data) {
          setError(dirRes.error || 'Failed to open DM channel')
          setSharing(false)
          return
        }
        targetChannelId = dirRes.data.channel_id
      }

      if (!targetChannelId) {
        setError('Please choose a friend or group circle')
        setSharing(false)
        return
      }

      // Metadata for doubt
      const metadata = {
        subject: doubtPayload.subject || 'Study Question',
        chapter: doubtPayload.chapter || '',
        equation: doubtPayload.formula || '',
        ai_quote: doubtPayload.content.slice(0, 400),
        personal_note: personalNote.trim(),
      }

      const sendContent = personalNote.trim()
        ? `${personalNote.trim()}\n\n> **Shared Doubt:**\n${doubtPayload.content.slice(0, 300)}`
        : `> **Shared Doubt:**\n${doubtPayload.content.slice(0, 300)}`

      const msgRes = await socialApi.sendMessage(
        targetChannelId,
        sendContent,
        token,
        'doubt_share',
        metadata
      )

      if (!msgRes.ok) {
        setError(msgRes.error || 'Failed to send doubt')
        setSharing(false)
        return
      }

      onClose()
      onDoubtShared(targetChannelId)
    } catch (e: any) {
      setError(e?.message || 'Error sharing doubt')
    } finally {
      setSharing(false)
    }
  }

  // Render preview segments
  const previewSegments = parseSegments(doubtPayload.content.slice(0, 240))

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="share-doubt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-doubt-header">
          <div className="share-doubt-title-wrap">
            <span className="share-doubt-icon">💡</span>
            <div>
              <h3>Share Doubt with Classmates</h3>
              <p>Send this problem directly to a classmate or study circle</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="share-doubt-body">
          {error && <div className="share-doubt-error">{error}</div>}

          {/* Doubt Preview Card */}
          <div className="doubt-preview-card">
            <div className="doubt-preview-meta">
              <span className="doubt-badge">
                📚 {doubtPayload.subject || 'Academic Doubt'}
              </span>
              {doubtPayload.chapter && (
                <span className="doubt-sub-badge">{doubtPayload.chapter}</span>
              )}
            </div>

            <div className="doubt-preview-content">
              {previewSegments.map((seg, idx) => {
                if (seg.type === 'math') {
                  const html = renderMath(seg.value, seg.display)
                  return (
                    <span
                      key={idx}
                      dangerouslySetInnerHTML={{ __html: html }}
                      className={seg.display ? 'block-math' : 'inline-math'}
                    />
                  )
                }
                return <span key={idx}>{seg.value}</span>
              })}
              {doubtPayload.content.length > 240 && ' …'}
            </div>
          </div>

          {/* Personal Note */}
          <div className="share-field">
            <label>Ask a question or add a note:</label>
            <input
              type="text"
              className="tw-input"
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder="e.g. Can you explain where this minus sign came from?"
              maxLength={180}
            />
          </div>

          {/* Target Selector */}
          <div className="share-field">
            <label>Select Classmate or Study Circle:</label>
            {loading ? (
              <div className="share-loading">Loading connections...</div>
            ) : friends.length === 0 && channels.length === 0 ? (
              <div className="share-empty">
                No connections yet. Connect with classmates in Study Network first!
              </div>
            ) : (
              <select
                className="tw-input"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
              >
                <optgroup label="Study Circles & Groups">
                  {channels
                    .filter((c) => c.type === 'group')
                    .map((c) => (
                      <option key={`chan:${c.id}`} value={`chan:${c.id}`}>
                        👥 {c.name || 'Study Circle'} ({c.member_count} members)
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Classmates">
                  {friends.map((f) => (
                    <option key={`friend:${f.id}`} value={`friend:${f.id}`}>
                      👤 {f.username} {f.grade ? `(Class ${f.grade})` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>
        </div>

        <div className="share-doubt-footer">
          <button className="tw-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="tw-btn-primary"
            disabled={sharing || !selectedTarget || (friends.length === 0 && channels.length === 0)}
            onClick={handleShare}
          >
            {sharing ? 'Sending Doubt...' : 'Send Doubt'}
          </button>
        </div>
      </div>
    </div>
  )
}

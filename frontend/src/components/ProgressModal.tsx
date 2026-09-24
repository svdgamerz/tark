import { useEffect, useState } from 'react'
import { fetchLearner, type LearnerTopic } from '../api'
import { useAuth } from '../auth'

function level(s: number): { label: string; color: string } {
  if (s >= 0.75) return { label: 'Proficient', color: '#1d9a5f' }
  if (s >= 0.45) return { label: 'In Progress', color: '#d9a300' }
  return { label: 'Needs Practice', color: '#d9534f' }
}

export function ProgressModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth()
  const [topics, setTopics] = useState<LearnerTopic[] | null>(null)

  useEffect(() => {
    if (token) fetchLearner(token).then(setTopics)
  }, [token])

  const list = topics ?? []
  const due = list.filter((t) => t.due_for_revision)
  const sorted = [...list].sort((a, b) => a.strength - b.strength)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Curriculum Progress</h2>

        {topics === null ? (
          <p className="auth-sub">Loading progress data…</p>
        ) : list.length === 0 ? (
          <p className="auth-sub">
            Topic mastery records will automatically populate as you practice problems and explore concepts.
          </p>
        ) : (
          <>
            {due.length > 0 && (
              <div className="settings-sec">
                <h3>Scheduled for Review</h3>
                <div className="revise-list">
                  {due.map((t, i) => (
                    <span key={i} className="revise-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                      {t.topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="settings-sec">
              <h3>Tracked Topics ({list.length})</h3>
              {sorted.map((t, i) => {
                const lv = level(t.strength)
                return (
                  <div key={i} className="topic-row">
                    <div className="topic-head">
                      <span className="topic-name">{t.topic}</span>
                      <span className="topic-level" style={{ color: lv.color }}>
                        {lv.label}
                      </span>
                    </div>
                    <div className="topic-bar">
                      <div
                        className="topic-fill"
                        style={{
                          width: `${Math.round(t.strength * 100)}%`,
                          background: lv.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="settings-actions">
          <span className="settings-hint">Updated continuously through session assessments.</span>
          <button className="modal-primary done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

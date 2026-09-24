import { useState } from 'react'
import type { Chat } from '../useChats'
import { useAuth } from '../auth'
import { Logo } from './Logo'

interface Props {
  chats: Chat[]
  activeId: string | null
  onNew: () => void
  onNewTask: () => void
  onOpenTasks: () => void
  onOpenVirtualLab: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onProfile: () => void
  onProgress: () => void
  onLogin: () => void
  onClose: () => void
  boardShort: (b: string) => string
  onOpenFriends?: () => void
  friendsUnreadCount?: number
}

export function Sidebar({
  chats,
  activeId,
  onNew,
  onNewTask,
  onOpenTasks,
  onOpenVirtualLab,
  onSelect,
  onDelete,
  onProfile,
  onProgress,
  onLogin,
  onClose,
  boardShort,
  onOpenFriends,
  friendsUnreadCount,
}: Props) {
  const { user } = useAuth()
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null)

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="sidebar-brand">
            <Logo size={22} className="brand-mark" /> Tark
          </span>
          <button className="icon-btn" onClick={onClose} title="Collapse sidebar" aria-label="Collapse sidebar">
            «
          </button>
        </div>

        <button className="new-chat" onClick={onNew}>
          <span className="plus">+</span> New conversation
        </button>

        <button className="new-task-btn" onClick={onNewTask} title="Create study schedule or portion completion plan">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="12" y1="14" x2="12" y2="18" />
            <line x1="10" y1="16" x2="14" y2="16" />
          </svg>
          <span>New Task / Schedule</span>
        </button>

        <button
          className="friends-dms-btn"
          onClick={onOpenFriends}
          title="Connect with classmates and join study circles"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Study Network</span>
          {(friendsUnreadCount ?? 0) > 0 && (
            <span className="friends-btn-badge">{friendsUnreadCount}</span>
          )}
        </button>

        <nav className="chat-list" aria-label="Conversation history">
          {chats.length === 0 ? (
            <div className="chat-empty">No conversations yet</div>
          ) : (
            chats.map((c) => (
              <div
                key={c.id}
                className={`chat-item${c.id === activeId ? ' active' : ''}`}
                onClick={() => onSelect(c.id)}
                title={c.title}
              >
                <span className="title">{c.title}</span>
                <button
                  className="del"
                  title="Delete conversation"
                  aria-label="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation()
                    setChatToDelete(c)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </nav>

        <div className="sidebar-foot">
          <button className="progress-btn" onClick={onOpenVirtualLab} title="Explore interactive science & math simulations in Virtual Lab">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v7.31M14 2v7.31M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0" />
              <path d="M5.52 16h12.96" />
            </svg>
            Virtual Lab 🧪
          </button>
          <button className="progress-btn" onClick={onOpenTasks} title="View study plans & task milestones">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Study Planner
          </button>
          {user && (
            <button className="progress-btn" onClick={onProgress}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              My Progress
            </button>
          )}
          {user ? (
            <button className="profile-btn" onClick={onProfile}>
              <span className="profile-av">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="profile-meta">
                <span className="profile-name">{user.username}</span>
                <span className="profile-sub">
                  {user.board
                    ? `${boardShort(user.board)} · Class ${user.grade ?? '—'}`
                    : 'Set syllabus'}
                </span>
              </span>
              <span className="cog" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="new-chat" onClick={onLogin}>
                Sign In / Register
              </button>
              <button
                className="new-chat"
                onClick={onProfile}
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                Configure Profile
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {chatToDelete && (
        <div
          className="modal-overlay"
          onClick={() => setChatToDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon-wrap" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h3 id="confirm-title">Delete conversation?</h3>
            <p className="confirm-text">
              Permanently delete <strong>"{chatToDelete.title}"</strong>. This action cannot be reversed.
            </p>
            <div className="confirm-actions">
              <button
                className="confirm-btn cancel"
                onClick={() => setChatToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn delete"
                onClick={() => {
                  onDelete(chatToDelete.id)
                  setChatToDelete(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

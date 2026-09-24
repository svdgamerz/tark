import { useEffect, useState } from 'react'
import {
  type StudyTask,
  fetchStudyTasks,
  toggleMilestone,
  deleteStudyTask,
} from '../tasksApi'
import { useAuth } from '../auth'

interface Props {
  onClose: () => void
  onOpenWizard: () => void
  onLaunchStudy: (task: StudyTask, milestoneIndex: number) => void
  onLaunchExamWorkout?: (task: StudyTask) => void
}

export function TaskManagerModal({ onClose, onOpenWizard, onLaunchStudy, onLaunchExamWorkout }: Props) {
  const { token } = useAuth()
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<StudyTask | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchStudyTasks(token).then((t) => {
      setTasks(t)
      setLoading(false)
      if (t.length > 0) setExpandedTaskId(t[0].id)
    })
  }, [token])

  async function handleToggle(taskId: number, milestoneId: string, currentStatus: boolean) {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const updatedMilestones = t.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed: !currentStatus } : m,
        )
        const allDone = updatedMilestones.every((m) => m.completed)
        return { ...t, milestones: updatedMilestones, status: allDone ? 'completed' : 'active' }
      }),
    )

    await toggleMilestone(taskId, milestoneId, !currentStatus, token)
  }

  async function confirmDelete() {
    if (!taskToDelete) return
    const id = taskToDelete.id
    setIsDeleting(true)
    try {
      setTasks((prev) => prev.filter((t) => t.id !== id))
      await deleteStudyTask(id, token)
    } finally {
      setIsDeleting(false)
      setTaskToDelete(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-manager-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tm-header">
          <div className="tm-header-left">
            <span className="tm-badge">Academic Schedule &amp; Roadmap</span>
            <h2 className="tm-title">Study Planner &amp; Milestones</h2>
          </div>
          <button
            type="button"
            className="tm-btn-new"
            onClick={() => {
              onClose()
              onOpenWizard()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Schedule
          </button>
        </div>

        <div className="tm-body">
          {loading ? (
            <div className="tm-empty-state">
              <span className="tw-spinner" />
              <p>Loading study schedules…</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="tm-empty-state">
              <div className="tm-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="tm-empty-title">No Active Study Schedules</h3>
              <p className="tm-empty-sub">
                Create a customized plan to finish your portion, prepare for exams, or structure a research project.
              </p>
              <button
                type="button"
                className="tw-btn-primary"
                onClick={() => {
                  onClose()
                  onOpenWizard()
                }}
              >
                Create First Study Schedule
              </button>
            </div>
          ) : (
            <div className="tm-task-list">
              {tasks.map((task) => {
                const total = task.milestones.length
                const completed = task.milestones.filter((m) => m.completed).length
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0
                const isExpanded = expandedTaskId === task.id

                return (
                  <div key={task.id} className="tm-task-card">
                    <div
                      className="tm-task-card-header"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    >
                      <div className="tm-tch-left">
                        <span className={`track-pill track-${task.track}`}>
                          {task.track === 'coursework' && 'Coursework Portion'}
                          {task.track === 'exam' && 'Exam Prep'}
                          {task.track === 'research' && 'Research'}
                        </span>
                        {task.details?.is_hourly && (
                          <span className="tw-hourly-sprint-badge">
                            Hourly Sprint{task.details?.exam_time ? ` (${task.details.exam_time})` : ''}
                          </span>
                        )}
                        <h4 className="tm-task-title">{task.title}</h4>
                      </div>

                      <div className="tm-tch-right">
                        <div className="tm-progress-summary">
                          <span className="tm-progress-num">
                            {completed}/{total} completed ({percent}%)
                          </span>
                          <div className="tm-progress-bar">
                            <div
                              className="tm-progress-fill"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {task.track === 'exam' && onLaunchExamWorkout && (
                          <button
                            type="button"
                            className="tm-btn-workout"
                            title="Daily 3-Question Active Recall Workout"
                            onClick={(e) => {
                              e.stopPropagation()
                              onLaunchExamWorkout(task)
                              onClose()
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            Daily 3Q Workout
                          </button>
                        )}

                        <button
                          type="button"
                          className="tm-btn-del"
                          title="Delete schedule"
                          onClick={(e) => {
                            e.stopPropagation()
                            setTaskToDelete(task)
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>

                        <span className="tm-expand-chevron">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                              transform: isExpanded ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.15s ease',
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="tm-milestones-container">
                        {task.track === 'exam' && onLaunchExamWorkout && (
                          <div className="tm-workout-banner">
                            <div className="tm-wb-left">
                              <span className="tm-wb-badge">Daily Spaced Repetition</span>
                              <div className="tm-wb-text">
                                <strong>Daily 3-Question Memory Workout:</strong> Test core formulas, definitions, and high-yield PYQs to lock concepts in memory before exam day.
                              </div>
                            </div>
                            <button
                              type="button"
                              className="tm-wb-btn"
                              onClick={() => {
                                onLaunchExamWorkout(task)
                                onClose()
                              }}
                            >
                              🎯 Start Daily Workout
                            </button>
                          </div>
                        )}
                        {task.milestones.map((m, idx) => (
                          <div
                            key={m.id || idx}
                            className={`tm-milestone-row ${m.completed ? 'is-completed' : ''}`}
                          >
                            <label className="tm-checkbox-wrap">
                              <input
                                type="checkbox"
                                checked={m.completed}
                                onChange={() => handleToggle(task.id, m.id, m.completed)}
                              />
                              <span className="tm-custom-checkbox" />
                            </label>

                            <div className="tm-milestone-info">
                              <div className="tm-mi-top">
                                <span className="tm-mi-title">{m.title}</span>
                                {m.target_date && (
                                  <span className="tm-mi-date">{m.target_date}</span>
                                )}
                              </div>
                              {m.notes && <p className="tm-mi-notes">{m.notes}</p>}
                            </div>

                            <button
                              type="button"
                              className="tm-btn-study"
                              title="Launch targeted lesson for this milestone"
                              onClick={() => {
                                onLaunchStudy(task, idx)
                                onClose()
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              Study Now
                            </button>

                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="tm-footer">
          <button type="button" className="tw-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* In-App Delete Confirmation Modal */}
      {taskToDelete && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1200 }}
          onClick={() => !isDeleting && setTaskToDelete(null)}
          role="dialog"
          aria-modal="true"
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
            <h3 id="confirm-title">Delete study schedule?</h3>
            <p className="confirm-text">
              Permanently delete <strong>"{taskToDelete.title}"</strong>. All milestone checkpoints and tracking progress will be removed.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn cancel"
                disabled={isDeleting}
                onClick={() => setTaskToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-btn delete"
                disabled={isDeleting}
                onClick={confirmDelete}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

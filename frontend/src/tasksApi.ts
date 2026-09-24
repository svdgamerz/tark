/**
 * Study Planner & Tasks API Client.
 * Supports persistent server tasks with automatic localStorage synchronization.
 */

export type TaskTrack = 'coursework' | 'exam' | 'research' | 'page_by_page'

export interface Milestone {
  id: string
  title: string
  target_date?: string
  completed: boolean
  notes?: string
  study_topic?: string
  textbook_source?: string
  page_number?: number
  chapter?: string
}

export interface StudyTask {
  id: number
  user_key: string
  track: TaskTrack
  title: string
  details: Record<string, any>
  milestones: Milestone[]
  status: 'active' | 'completed' | 'archived'
  created_at: number
  updated_at: number
}

export interface GeneratedPlan {
  title: string
  summary?: string
  chapter_confirmation?: string
  needs_chapters?: boolean
  clarification_message?: string
  milestones: Milestone[]
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'
const LOCAL_STORAGE_KEY = 'tark_local_study_tasks'

function getLocalAnonId(): string {
  let id = localStorage.getItem('tark_anon_id')
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    localStorage.setItem('tark_anon_id', id)
  }
  return id
}

function getLocalTasks(): StudyTask[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalTasks(tasks: StudyTask[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks))
  } catch {}
}

export async function generateStudyPlan(
  track: TaskTrack,
  answers: Record<string, any>,
  userContext?: Record<string, any>,
  token?: string | null,
): Promise<GeneratedPlan> {
  try {
    const res = await fetch(`${API_BASE}/tasks/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        track,
        answers,
        user_context: userContext,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    // Client-side fallback if server unreachable
    return {
      title: `${track.charAt(0).toUpperCase() + track.slice(1)} Roadmap`,
      summary: 'Structured academic plan prepared for your target portion.',
      milestones: [
        {
          id: 'm1',
          title: 'Phase 1: Conceptual Foundations',
          target_date: 'Week 1',
          notes: 'Review definitions, theorems, and core formulas.',
          study_topic: 'Review foundational concepts and definitions',
          completed: false,
        },
        {
          id: 'm2',
          title: 'Phase 2: Step-by-Step Derivations',
          target_date: 'Week 2',
          notes: 'Solve textbook examples and derivation proofs.',
          study_topic: 'Step-by-step problem derivations',
          completed: false,
        },
        {
          id: 'm3',
          title: 'Phase 3: High-Yield Practice & Drill',
          target_date: 'Week 3',
          notes: 'Practice exam-level problems and error revision.',
          study_topic: 'Practice exam-level problems',
          completed: false,
        },
      ],
    }
  }
}

export async function fetchStudyTasks(token?: string | null): Promise<StudyTask[]> {
  try {
    const anonId = getLocalAnonId()
    const res = await fetch(`${API_BASE}/tasks?anon_id=${encodeURIComponent(anonId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.tasks)) {
        saveLocalTasks(data.tasks)
        return data.tasks
      }
    }
  } catch {}
  return getLocalTasks()
}

export async function createStudyTask(
  track: TaskTrack,
  title: string,
  details: Record<string, any>,
  milestones: Milestone[],
  token?: string | null,
): Promise<StudyTask> {
  const anonId = getLocalAnonId()
  try {
    const res = await fetch(`${API_BASE}/tasks?anon_id=${encodeURIComponent(anonId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        track,
        title,
        details,
        milestones,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.task) {
        const current = getLocalTasks()
        saveLocalTasks([data.task, ...current])
        return data.task
      }
    }
  } catch {}

  // Local fallback
  const fallbackTask: StudyTask = {
    id: Date.now(),
    user_key: anonId,
    track,
    title,
    details,
    milestones,
    status: 'active',
    created_at: Date.now() / 1000,
    updated_at: Date.now() / 1000,
  }
  const current = getLocalTasks()
  saveLocalTasks([fallbackTask, ...current])
  return fallbackTask
}

export async function toggleMilestone(
  taskId: number,
  milestoneId: string,
  completed?: boolean,
  token?: string | null,
): Promise<StudyTask | null> {
  const anonId = getLocalAnonId()
  try {
    const res = await fetch(
      `${API_BASE}/tasks/${taskId}/milestones/${encodeURIComponent(milestoneId)}?anon_id=${encodeURIComponent(anonId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ completed }),
      },
    )
    if (res.ok) {
      const data = await res.json()
      if (data.task) {
        const current = getLocalTasks().map((t) => (t.id === taskId ? data.task : t))
        saveLocalTasks(current)
        return data.task
      }
    }
  } catch {}

  // Local fallback toggle
  const current = getLocalTasks()
  const idx = current.findIndex((t) => t.id === taskId)
  if (idx !== -1) {
    const task = current[idx]
    task.milestones = task.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: completed ?? !m.completed } : m,
    )
    task.status = task.milestones.every((m) => m.completed) ? 'completed' : 'active'
    task.updated_at = Date.now() / 1000
    current[idx] = task
    saveLocalTasks(current)
    return task
  }
  return null
}

export async function deleteStudyTask(taskId: number, token?: string | null): Promise<boolean> {
  const anonId = getLocalAnonId()
  try {
    await fetch(`${API_BASE}/tasks/${taskId}?anon_id=${encodeURIComponent(anonId)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {}
  const current = getLocalTasks().filter((t) => t.id !== taskId)
  saveLocalTasks(current)
  return true
}

export interface TextbookChapter {
  source: string
  chapter: string
  start_page: number
  end_page: number
  total_doc_pages: number
  chunks_count: number
}

export async function fetchTextbookChapters(
  board: string,
  grade: string,
  subject: string,
): Promise<TextbookChapter[]> {
  try {
    const url = `${API_BASE}/api/textbook/chapters?board=${encodeURIComponent(board)}&grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return data.chapters || []
  } catch {
    return []
  }
}

export function getTextbookPageImageUrl(source: string, page: number, dpi: number = 150): string {
  return `${API_BASE}/api/textbook/page-image?source=${encodeURIComponent(source)}&page=${page}&dpi=${dpi}`
}

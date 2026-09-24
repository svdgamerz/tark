// Talks to the FastAPI backend. The /chat endpoint streams Server-Sent Events
// over a POST body, so we read the response stream manually (EventSource only
// supports GET).

import type { SimulationData } from './simulations/types'

export type Mode = 'teacher' | 'socratic'

export interface FollowUpSuggestion {
  icon?: string
  label: string
  prompt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  at?: number // epoch ms (for the message timestamp)
  sources?: string[] // citations (for "View sources")
  image?: string // data URL of an attached image (shown in the bubble)
  textbook_page_image?: string // High-definition authentic textbook scan image URL
  suggestions?: FollowUpSuggestion[] // AI-generated dynamic follow-up exploration chips
  engineeredPrompt?: string // Prompt-engineered version produced by the dedicated Groq layer
  simulation?: SimulationData // Interactive visual simulation (Virtualization)
}

// Use the literal IPv4 loopback, not "localhost": on Windows "localhost" can
// resolve to IPv6 (::1) while uvicorn binds IPv4 (127.0.0.1), which breaks the
// fetch. 127.0.0.1 is unambiguous.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

export interface ModelInfo {
  id: string
  label: string
  grounded: boolean
  tier: string
  description: string
}

export async function fetchModels(
  token: string | null,
): Promise<{ models: ModelInfo[]; default: string }> {
  try {
    const res = await fetch(`${API_BASE}/models`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return { models: [], default: 'acharya' }
    return await res.json()
  } catch {
    return { models: [], default: 'acharya' }
  }
}

export interface CurriculumItem {
  board: string
  grade: string
  subject: string
  chunks: number
}

export async function fetchCurriculum(): Promise<CurriculumItem[]> {
  try {
    const res = await fetch(`${API_BASE}/curriculum`)
    if (!res.ok) return []
    return (await res.json()).items ?? []
  } catch {
    return []
  }
}

export interface SchoolItem {
  name: string
  city: string
  state: string
  board: string
}

export async function fetchSchools(q: string): Promise<SchoolItem[]> {
  if (q.trim().length < 2) return []
  try {
    const res = await fetch(`${API_BASE}/schools?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    return (await res.json()).items ?? []
  } catch {
    return []
  }
}

export interface LearnerTopic {
  topic: string
  strength: number
  struggles: number
  exposures: number
  due_for_revision: boolean
}

// The student's mastery map (adaptive learner model).
export async function fetchLearner(token: string): Promise<LearnerTopic[]> {
  try {
    const res = await fetch(`${API_BASE}/learner`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    return (await res.json()).topics ?? []
  } catch {
    return []
  }
}

export interface FeedbackContext {
  token?: string | null
  board?: string
  grade?: string
  subject?: string
}

// Thumbs up/down. A 👎 triggers the backend self-improvement loop and returns the
// directive the tutor just learned.
export async function sendFeedback(
  question: string,
  answer: string,
  rating: 'up' | 'down',
  ctx: FeedbackContext,
): Promise<{ ok: boolean; learned?: string }> {
  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}),
      },
      body: JSON.stringify({
        question,
        answer,
        rating,
        board: ctx.board,
        grade: ctx.grade,
        subject: ctx.subject,
      }),
    })
    if (!res.ok) return { ok: false }
    return await res.json()
  } catch {
    return { ok: false }
  }
}

// Natural read-aloud voice (Gemini TTS). Returns a WAV blob, or null on failure
export async function fetchTts(text: string, voice?: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    })
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

export interface OralEvalResult {
  accuracy_score: number
  grade_label: string
  key_points_covered: string[]
  key_points_missing: string[]
  matched_keywords?: string[]
  tutor_tip?: string
  feedback_speech: string
  feedback_markdown: string
}

// Evaluate a student's spoken recitation against the reference answer (Talk Live).
export async function evaluateOral(
  studentText: string,
  referenceText: string,
  subject?: string,
  grade?: string,
  board?: string,
): Promise<OralEvalResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/evaluate-oral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_text: studentText,
        reference_text: referenceText,
        subject: subject || '',
        grade: grade || '',
        board: board || '',
      }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export interface ChatOptions {
  model?: string
  token?: string | null
  board?: string
  grade?: string
  subject?: string
  chapter?: string
  image?: string // data URL of an attached image (multimodal)
  exam?: string
  tutoring_style?: string
  language?: string
  weak_subjects?: string[]
  goal?: string
  task_id?: number
  milestone_id?: string
  milestone_title?: string
  milestone_notes?: string
  milestone_index?: number
  milestone_total?: number
  chapter_confirmation?: string
  textbook_source?: string
  page_number?: number
}

interface StreamHandlers {
  onToken: (text: string) => void
  onReset?: () => void // discard the partial answer (server failed over mid-stream)
  onError: (message: string) => void
  onDone?: () => void
  onSources?: (items: string[]) => void
  onFigure?: (dataUrl: string) => void // code-rendered diagram (data URL)
  onMermaid?: (code: string) => void // flow/cycle diagram source (client-rendered)
  onSuggestions?: (items: FollowUpSuggestion[]) => void // dynamic contextual follow-up exploration chips
  onPromptEngineered?: (data: { original: string; engineered: string }) => void // dedicated prompt engineering layer
  onSimulation?: (sim: SimulationData) => void // interactive visual simulation
}

export async function streamChat(
  mode: Mode,
  messages: ChatMessage[],
  opts: ChatOptions,
  { onToken, onReset, onError, onDone, onSources, onFigure, onMermaid, onSuggestions, onPromptEngineered, onSimulation }: StreamHandlers,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: JSON.stringify({
        mode,
        // Send only role/content in history (strip image/at to keep it lean); the
        // current image travels in the top-level `image` field.
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        model: opts.model,
        board: opts.board,
        grade: opts.grade,
        subject: opts.subject,
        chapter: opts.chapter,
        image: opts.image,
        exam: opts.exam,
        tutoring_style: opts.tutoring_style,
        language: opts.language,
        weak_subjects: opts.weak_subjects,
        goal: opts.goal,
        task_id: opts.task_id,
        milestone_id: opts.milestone_id,
        milestone_title: opts.milestone_title,
        milestone_notes: opts.milestone_notes,
        milestone_index: opts.milestone_index,
        milestone_total: opts.milestone_total,
        chapter_confirmation: opts.chapter_confirmation,
        textbook_source: opts.textbook_source,
        page_number: opts.page_number,
      }),
    })
  } catch (err) {
    onError('Network error: Failed to connect to server. Please ensure the backend is running.')
    return
  }

  if (!res.ok || !res.body) {
    let errDetail = ''
    try {
      const errJson = await res.json()
      errDetail = errJson.detail || ''
    } catch {}
    onError(`Server error (${res.status}): ${errDetail || res.statusText || 'Unable to process chat request'}`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by a blank line.
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const evt of events) {
      const dataLine = evt.split('\n').find((l) => l.startsWith('data:'))
      if (!dataLine) continue
      let payload: {
        type: string
        text?: string
        message?: string
        items?: string[]
        data_url?: string
        code?: string
        sim?: SimulationData
      }
      try {
        payload = JSON.parse(dataLine.slice(5).trim())
      } catch {
        continue
      }
      if (payload.type === 'token' && payload.text) onToken(payload.text)
      else if (payload.type === 'reset') onReset?.()
      else if (payload.type === 'sources' && payload.items)
        onSources?.(payload.items)
      else if (payload.type === 'suggestions' && payload.items)
        onSuggestions?.(payload.items as unknown as FollowUpSuggestion[])
      else if (payload.type === 'figure' && payload.data_url)
        onFigure?.(payload.data_url)
      else if (payload.type === 'figure_mermaid' && payload.code)
        onMermaid?.(payload.code)
      else if (payload.type === 'simulation' && payload.sim)
        onSimulation?.(payload.sim as SimulationData)
      else if (payload.type === 'prompt_engineered' && (payload as any).engineered)
        onPromptEngineered?.({
          original: (payload as any).original || '',
          engineered: (payload as any).engineered || '',
        })
      else if (payload.type === 'error') onError(payload.message ?? 'unknown error')
      else if (payload.type === 'done') onDone?.()
    }
  }
}

export async function fetchSimulation(
  question: string,
  answer: string = '',
  token?: string | null,
): Promise<SimulationData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/simulation/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question, answer }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.sim ?? null
  } catch (err) {
    console.error('Failed to fetch simulation:', err)
    return null
  }
}


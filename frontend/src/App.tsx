import { useEffect, useRef, useState } from 'react'
import {
  fetchCurriculum,
  fetchModels,
  sendFeedback,
  streamChat,
  type ChatMessage,
  type CurriculumItem,
  type FollowUpSuggestion,
  type Mode,
  type ModelInfo,
} from './api'
import type { SimulationData } from './simulations/types'
import { MessageView } from './components/Message'
import { extractDiagramCode } from './math'
import { AuthPage } from './components/AuthPage'
import { Sidebar } from './components/Sidebar'
import { SettingsModal, applyTheme } from './components/SettingsModal'
import { ProgressModal } from './components/ProgressModal'
import { Logo } from './components/Logo'
import { useChats } from './useChats'
import { useAuth } from './auth'
import { ProfileBanner } from './components/ProfileBanner'
import { ProfileSetupModal } from './components/ProfileSetupModal'
import { TaskWizardModal } from './components/TaskWizardModal'
import { TaskManagerModal } from './components/TaskManagerModal'
import { TalkLiveModal } from './components/TalkLiveModal'
import { VirtualLabModal } from './components/VirtualLabModal'
import { FriendsDrawer } from './components/FriendsDrawer'
import { ShareDoubtModal } from './components/ShareDoubtModal'
import { socialApi } from './socialApi'
import { type StudyTask, toggleMilestone } from './tasksApi'

interface ActiveScheduleInfo {
  task: StudyTask
  currentMilestoneIndex: number
}

function trackLabel(track: string): string {
  if (track === 'exam') return 'Exam Prep'
  if (track === 'coursework') return 'Coursework'
  if (track === 'research') return 'Research'
  return track
}

// Free messages a guest gets before the sign-in wall appears (ChatGPT-style).
const GUEST_LIMIT = 20

// Single teaching style for now (the mode toggle was removed from the UI).
const MODE: Mode = 'teacher'

function boardShort(board: string): string {
  if (/cbse|ncert/i.test(board)) return 'CBSE'
  if (/maharashtra|balbharati/i.test(board)) return 'Maharashtra'
  if (/icse|cisce/i.test(board)) return 'ICSE'
  if (/igcse|cambridge/i.test(board)) return 'IGCSE'
  return board.split(' (')[0]
}

// Render Mermaid flow/cycle diagrams to an SVG data URL (loaded on demand).
// strict security + pure-SVG labels, and the result is shown via <img>, so the
// diagram can never carry executable content.
let mermaidReady = false
async function mermaidToDataUrl(code: string): Promise<string | null> {
  try {
    const mermaid = (await import('mermaid')).default
    if (!mermaidReady) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        flowchart: { htmlLabels: false, curve: 'basis' },
        themeVariables: {
          primaryColor: '#eef0ff',
          primaryBorderColor: '#4f46e5',
          primaryTextColor: '#23232a',
          lineColor: '#5b5b66',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
        },
      })
      mermaidReady = true
    }
    const { svg } = await mermaid.render(
      'fig' + Math.random().toString(36).slice(2),
      code,
    )
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  } catch {
    return null // bad mermaid syntax → simply no figure
  }
}

function friendlyError(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes('503') || r.includes('unavailable') || r.includes('high demand'))
    return 'The tutor is experiencing high demand right now. Please try again in a moment.'
  if (r.includes('429') || r.includes('quota') || r.includes('rate limit') || r.includes('resource_exhausted'))
    return 'The AI provider is temporarily busy. Please wait a few seconds and try again.'
  if (r.includes('failed to connect') || r.includes('network error') || r.includes('could not reach'))
    return 'Unable to connect to the tutor service. Please check your connection and ensure the backend is running.'
  if (r.includes('all providers failed'))
    return 'AI services are momentarily busy. Please try asking again.'
  return raw || 'Something went wrong. Please try again.'
}

export default function App() {
  const { user, token } = useAuth()
  const userKey = user?.email ?? 'guest'

  const {
    chats,
    activeId,
    setActiveId,
    restore,
    createChat,
    persistChat,
    deleteChat,
    ensureMessages,
    newId,
  } = useChats(userKey, token)

  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelId, setModelId] = useState<string>('acharya')
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({})
  const [toast, setToast] = useState('')
  const [attachment, setAttachment] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    id: string
    name: string
    type: 'image' | 'document' | 'code' | 'folder'
    size: number
    dataUrl?: string
    textContent?: string
  }>>([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > 820,
  )
  const [showSettings, setShowSettings] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [showProfileBanner, setShowProfileBanner] = useState(false)
  const [showTaskWizard, setShowTaskWizard] = useState(false)
  const [showTaskManager, setShowTaskManager] = useState(false)
  const [showVirtualLab, setShowVirtualLab] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [friendsUnreadCount, setFriendsUnreadCount] = useState(0)
  const [selectedDoubtChannelId, setSelectedDoubtChannelId] = useState<string | null>(null)
  const [shareDoubtPayload, setShareDoubtPayload] = useState<{
    subject?: string
    chapter?: string
    formula?: string
    content: string
  } | null>(null)
  const [talkLiveTarget, setTalkLiveTarget] = useState<string | null>(null)
  const [activeScheduleTask, setActiveScheduleTask] = useState<ActiveScheduleInfo | null>(() => {
    try {
      const raw = sessionStorage.getItem('tark_active_schedule')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const [guestCount, setGuestCount] = useState(() =>
    Number(localStorage.getItem('tark_guest_count') ?? 0),
  )
  const [showAuth, setShowAuth] = useState(false)
  const [authReason, setAuthReason] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const gated = !user
  const remaining = Math.max(0, GUEST_LIMIT - guestCount)
  const boards = [...new Set(curriculum.map((c) => c.board))]

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  // Reopen the last-active conversation after a refresh / login (fires once per load).
  useEffect(() => {
    if (restore) {
      setActiveId(restore.id)
      setMessages(restore.messages)
      setFeedback({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restore])

  useEffect(() => {
    fetchModels(token).then(({ models, default: def }) => {
      setModels(models)
      setModelId((cur) => (models.some((m) => m.id === cur) ? cur : def))
    })
  }, [token])

  useEffect(() => {
    if (token) {
      socialApi.getChannels(token).then((res) => {
        if (res.ok && res.data) {
          const totalUnread = res.data.channels.reduce((sum, c) => sum + c.unread_count, 0)
          setFriendsUnreadCount(totalUnread)
        }
      })
    }
  }, [token])

  useEffect(() => {
    fetchCurriculum().then(setCurriculum)
  }, [])

  // Apply the saved appearance theme (light / dark / system) on load.
  useEffect(() => {
    applyTheme(localStorage.getItem('tark_theme') ?? 'system')
  }, [])

  // Automatically prompt student profile setup modal on login if board/grade are incomplete
  useEffect(() => {
    if (user && (!user.board || !user.grade)) {
      setShowProfileSetup(true)
      setShowProfileBanner(false)
      return
    }

    const isProfileIncomplete = user
      ? !user.board || !user.grade
      : localStorage.getItem('tark_profile_completed') !== '1'

    if (isProfileIncomplete) {
      const snoozedAt = Number(localStorage.getItem('tark_profile_snoozed_at') ?? 0)
      if (Date.now() - snoozedAt > 20 * 60 * 1000) {
        setShowProfileBanner(true)
      }
    } else {
      setShowProfileBanner(false)
    }
  }, [user])

  useEffect(() => {
    if (activeScheduleTask) {
      sessionStorage.setItem('tark_active_schedule', JSON.stringify(activeScheduleTask))
    } else {
      sessionStorage.removeItem('tark_active_schedule')
    }
  }, [activeScheduleTask])

  function triggerRandomProfileCheck() {
    const isProfileIncomplete = user
      ? !user.board || !user.grade
      : localStorage.getItem('tark_profile_completed') !== '1'

    if (isProfileIncomplete && !showProfileBanner) {
      // ~35% chance to randomly pop up above composer
      if (Math.random() < 0.35) {
        setShowProfileBanner(true)
      }
    }
  }

  const selectedModel = models.find((m) => m.id === modelId)

  function autoGrow() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function openLogin() {
    setAuthReason('')
    setShowAuth(true)
  }


  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAttachMenu])

  async function processFileList(files: File[]) {
    if (files.length === 0) return
    const maxFiles = 30
    const limited = files.slice(0, maxFiles)
    if (files.length > maxFiles) {
      flash(`Loaded first ${maxFiles} files from upload.`)
    }

    const newAttachments: Array<{
      id: string
      name: string
      type: 'image' | 'document' | 'code' | 'folder'
      size: number
      dataUrl?: string
      textContent?: string
    }> = []

    for (const f of limited) {
      if (
        f.webkitRelativePath &&
        (f.webkitRelativePath.includes('.git/') || f.webkitRelativePath.includes('node_modules/'))
      ) {
        continue
      }
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      const isImg =
        f.type.startsWith('image/') ||
        ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)

      if (isImg) {
        if (f.size > 8 * 1024 * 1024) {
          flash(`${f.name} is too large (max 8MB)`)
          continue
        }
        const dataUrl = await new Promise<string>((res) => {
          const r = new FileReader()
          r.onload = () => res(r.result as string)
          r.readAsDataURL(f)
        })
        newAttachments.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: f.webkitRelativePath || f.name,
          type: 'image',
          size: f.size,
          dataUrl,
        })
      } else {
        if (f.size > 2 * 1024 * 1024) {
          flash(`${f.name} skipped (max 2MB per text file)`)
          continue
        }
        const textContent = await new Promise<string>((res) => {
          const r = new FileReader()
          r.onload = () => res((r.result as string) || '')
          r.onerror = () => res('')
          r.readAsText(f)
        })
        if (textContent.trim()) {
          newAttachments.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: f.webkitRelativePath || f.name,
            type: ['.py', '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.cpp', '.c', '.java'].includes(ext)
              ? 'code'
              : 'document',
            size: f.size,
            textContent: textContent.slice(0, 15000),
          })
        }
      }
    }

    if (newAttachments.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newAttachments])
      flash(`Attached ${newAttachments.length} file${newAttachments.length > 1 ? 's' : ''}`)
    }
  }

  async function processDataTransferItems(items: DataTransferItemList) {
    const filesToProcess: File[] = []

    async function traverseEntry(entry: any, path: string = '') {
      if (!entry) return
      if (entry.isFile) {
        const file: File = await new Promise((resolve) => entry.file(resolve))
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path ? `${path}/${file.name}` : file.name,
          writable: true,
        })
        filesToProcess.push(file)
      } else if (entry.isDirectory) {
        const reader = entry.createReader()
        const readEntries = (): Promise<any[]> =>
          new Promise((resolve) => reader.readEntries(resolve))
        let batch: any[]
        do {
          batch = await readEntries()
          for (const child of batch) {
            await traverseEntry(child, path ? `${path}/${entry.name}` : entry.name)
          }
        } while (batch.length > 0)
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null
      if (entry) {
        await traverseEntry(entry)
      } else {
        const f = item.getAsFile()
        if (f) filesToProcess.push(f)
      }
    }

    await processFileList(filesToProcess)
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false)
      dragCounterRef.current = 0
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounterRef.current = 0

    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      await processDataTransferItems(items)
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileList(Array.from(e.dataTransfer.files))
    }
  }

  function currentCtx(): {
    board?: string
    grade?: string
    subject?: string
    exam?: string
    tutoring_style?: string
    language?: string
    weak_subjects?: string[]
    goal?: string
  } {
    const board = user?.board || localStorage.getItem('tark_board') || undefined
    const grade = user?.grade || localStorage.getItem('tark_grade') || undefined
    const exam = user?.exam || localStorage.getItem('tark_target_exam') || undefined
    const tutoring_style =
      user?.tutoring_style || localStorage.getItem('tark_tutoring_style') || undefined
    const language = user?.language || localStorage.getItem('tark_language_pref') || undefined
    const goal = user?.goal || localStorage.getItem('tark_learning_goal') || undefined
    let weak_subjects: string[] | undefined = undefined
    try {
      const raw = user?.weak_subjects || localStorage.getItem('tark_weak_subjects')
      if (raw) weak_subjects = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {}

    return {
      board,
      grade,
      exam,
      tutoring_style,
      language,
      weak_subjects,
      goal,
    }
  }

  const [isProfileMandatory, setIsProfileMandatory] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)

  function ensureProfile(action: () => void) {
    const ctx = currentCtx()
    if (ctx.board && ctx.grade) {
      action()
    } else {
      pendingActionRef.current = action
      setIsProfileMandatory(true)
      setShowProfileSetup(true)
    }
  }

  function handleOpenShareDoubt(content: string, userQuestion?: string) {
    if (!user) {
      openLogin()
      return
    }
    ensureProfile(() => {
      setShareDoubtPayload({
        subject: currentCtx().subject || 'General Study',
        chapter: userQuestion ? `Question: ${userQuestion.slice(0, 90)}` : '',
        content,
      })
    })
  }

  function handleNew() {
    setActiveId(null)
    setMessages([])
    setFeedback({})
    setActiveScheduleTask(null)
    triggerRandomProfileCheck()
    if (window.innerWidth <= 820) setSidebarOpen(false)
  }

  async function handleSelect(id: string) {
    setActiveId(id)
    setFeedback({})
    const msgs = await ensureMessages(id) // server chats load messages on open
    setMessages(msgs)
    if (window.innerWidth <= 820) setSidebarOpen(false)
  }

  function handleDelete(id: string) {
    deleteChat(id)
    if (id === activeId) {
      setActiveId(null)
      setMessages([])
    }
  }

  // Stream an answer for the given history and save the finished exchange.
  async function runCompletion(
    chatId: string,
    history: ChatMessage[],
    schedOverride?: ActiveScheduleInfo | null,
  ) {
    // The last user turn may carry an attached image (multimodal).
    const image = [...history].reverse().find((m) => m.role === 'user')?.image
    const withPlaceholder: ChatMessage[] = [
      ...history,
      { role: 'assistant', content: '' },
    ]
    setMessages(withPlaceholder)
    persistChat(chatId, withPlaceholder)
    setBusy(true)

    let acc = ''
    let sources: string[] = []
    let figure: string | undefined
    let suggestions: FollowUpSuggestion[] = []
    let pendingMermaid: string | null = null
    let engineeredPrompt: string | undefined
    let simData: SimulationData | undefined

    const sched = schedOverride !== undefined ? schedOverride : activeScheduleTask
    const currMilestone = sched?.task?.milestones?.[sched.currentMilestoneIndex]
    const isPageByPage = Boolean(
      sched?.task?.track === 'page_by_page' ||
      currMilestone?.page_number ||
      (currMilestone?.title && /\bpage\s*\d+\b/i.test(currMilestone.title))
    )

    let textbookPageImage: string | undefined
    if (isPageByPage && currMilestone) {
      const pNum = currMilestone.page_number || 1
      const source = currMilestone.textbook_source || sched?.task?.details?.source
      const chapter = currMilestone.chapter || sched?.task?.details?.chapter || currMilestone.title || ''
      if (source) {
        textbookPageImage = `http://127.0.0.1:8000/api/textbook/page-image?source=${encodeURIComponent(source)}&page=${pNum}&chapter=${encodeURIComponent(chapter)}`
      } else {
        const board = sched?.task?.details?.board || ''
        const grade = sched?.task?.details?.grade || ''
        const subject = sched?.task?.details?.subject || ''
        textbookPageImage = `http://127.0.0.1:8000/api/textbook/page-image?board=${encodeURIComponent(board)}&grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&page=${pNum}`
      }
    }

    const setLast = (content: string) =>
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = {
          ...next[next.length - 1],
          role: 'assistant',
          content,
          ...(textbookPageImage ? { textbook_page_image: textbookPageImage } : {}),
        }
        return next
      })

    const schedOpts = currMilestone
      ? {
          task_id: sched.task.id,
          milestone_id: currMilestone.id,
          milestone_title: currMilestone.title,
          milestone_notes: currMilestone.notes || '',
          milestone_index: sched.currentMilestoneIndex + 1,
          milestone_total: sched.task.milestones.length,
          ...(sched.task.details?.subject ? { subject: sched.task.details.subject } : {}),
          ...(sched.task.details?.board ? { board: sched.task.details.board } : {}),
          ...(sched.task.details?.grade ? { grade: sched.task.details.grade } : {}),
          ...(sched.task.details?.chapter || currMilestone.chapter ? { chapter: sched.task.details?.chapter || currMilestone.chapter } : {}),
          ...(sched.task.details?.exam_name ? { exam: sched.task.details.exam_name } : {}),
          ...(sched.task.details?.chapter_confirmation
            ? { chapter_confirmation: sched.task.details.chapter_confirmation }
            : {}),
          ...(currMilestone.textbook_source || sched.task.details?.source
            ? { textbook_source: currMilestone.textbook_source || sched.task.details?.source }
            : {}),
          ...(currMilestone.page_number
            ? { page_number: currMilestone.page_number }
            : {}),
        }
      : {}

    await streamChat(MODE, history, { model: modelId, token, ...currentCtx(), ...schedOpts, image }, {
      onToken: (t) => {
        acc += t
        setLast(acc)
      },
      onReset: () => {
        acc = ''
        setLast('')
      },
      onError: (e) => {
        const msg = friendlyError(e)
        if (!acc || acc.trim().length === 0) {
          acc = msg
          setLast(acc)
        } else {
          console.warn('Post-stream warning occurred after answer was generated:', e)
        }
      },
      onSources: (s) => {
        sources = s
      },
      onSuggestions: (s) => {
        suggestions = s
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], suggestions: s }
          return next
        })
      },
      onPromptEngineered: (data) => {
        engineeredPrompt = data.engineered
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], engineeredPrompt: data.engineered }
          return next
        })
      },
      onFigure: (f) => {
        figure = f
        // Show the rendered diagram on the streaming answer immediately.
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], image: f }
          return next
        })
      },
      onSimulation: (s) => {
        simData = s
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], simulation: s }
          return next
        })
      },
      onMermaid: (c) => {
        pendingMermaid = c
      },
    })

    // If the model wrote its own ```mermaid block, salvage it as the figure and
    // clean it out of the answer text.
    const extracted = extractDiagramCode(acc)
    const mermaidCode = pendingMermaid ?? extracted.mermaid
    if (extracted.mermaid) acc = extracted.clean

    // Flow/cycle diagrams render client-side after the stream completes.
    if (!figure && mermaidCode) {
      const f = await mermaidToDataUrl(mermaidCode)
      if (f) figure = f
    }

    setMessages((prev) => {
      const next = [...prev]
      next[next.length - 1] = {
        ...next[next.length - 1],
        role: 'assistant',
        content: acc,
        ...(textbookPageImage ? { textbook_page_image: textbookPageImage } : {}),
        ...(figure ? { image: figure } : {}),
        ...(simData ? { simulation: simData } : {}),
        ...(suggestions.length ? { suggestions } : {}),
        ...(engineeredPrompt ? { engineeredPrompt } : {}),
      }
      return next
    })

    persistChat(chatId, [
      ...history,
      {
        role: 'assistant',
        content: acc,
        at: Date.now(),
        sources,
        image: figure,
        ...(textbookPageImage ? { textbook_page_image: textbookPageImage } : {}),
        ...(simData ? { simulation: simData } : {}),
        ...(suggestions.length ? { suggestions } : {}),
        ...(engineeredPrompt ? { engineeredPrompt } : {}),
      },
    ])
    setBusy(false)
  }

  async function sendText(text: string) {
    const clean = text.trim()
    const hasAttachments = Boolean(attachment || attachedFiles.length > 0)
    if ((!clean && !hasAttachments) || busy) return

    if (gated && guestCount >= GUEST_LIMIT) {
      setAuthReason(
        `You've used your ${GUEST_LIMIT} free messages. Sign in to keep learning with Tark.`,
      )
      setShowAuth(true)
      return
    }

    const chatId = activeId ?? newId()
    if (!activeId) {
      createChat(chatId)
      setActiveId(chatId)
    }

    // Determine multimodal image (either single attachment or first attached image)
    const firstImg = attachedFiles.find((f) => f.type === 'image')
    const activeImage = attachment || firstImg?.dataUrl

    // Build context if documents or code files are attached
    const textAttachments = attachedFiles.filter((f) => f.textContent)
    let promptPayload = clean
    if (textAttachments.length > 0) {
      const docsSummary = textAttachments
        .map(
          (f) =>
            `--- [ATTACHED FILE: ${f.name}] ---\n${f.textContent}\n--- [END OF ${f.name}] ---`,
        )
        .join('\n\n')
      promptPayload = `${docsSummary}\n\n${
        clean
          ? `STUDENT QUESTION:\n${clean}`
          : 'Please review and explain the attached file(s) and highlight key concepts.'
      }`
    }

    const userMsg: ChatMessage = { role: 'user', content: promptPayload, at: Date.now() }
    if (activeImage) userMsg.image = activeImage
    const history: ChatMessage[] = [...messages, userMsg]
    setInput('')
    setAttachment(null)
    setAttachedFiles([])
    requestAnimationFrame(autoGrow)
    setFeedback({})

    if (gated) {
      const n = guestCount + 1
      setGuestCount(n)
      localStorage.setItem('tark_guest_count', String(n))
    }

    await runCompletion(chatId, history)
    triggerRandomProfileCheck()
  }

  // Regenerate the last answer (re-runs the last question; now benefits from any
  // directive just learned via 👎).
  async function regenerateLast() {
    if (busy || !activeId) return
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user')
    if (lastUserIdx < 0) return
    setFeedback({})
    await runCompletion(activeId, messages.slice(0, lastUserIdx + 1))
  }

  // Edit a user message → replace it, drop everything after, and re-answer from there.
  async function handleEditMessage(index: number, newContent: string) {
    if (busy || !activeId || !newContent.trim()) return
    const history: ChatMessage[] = [
      ...messages.slice(0, index),
      { role: 'user', content: newContent.trim(), at: Date.now() },
    ]
    setFeedback({})
    await runCompletion(activeId, history)
  }

  // "Branch in new chat" — fork the conversation up to this message into a new chat.
  function handleBranch(index: number) {
    const upto = messages.slice(0, index + 1)
    const id = newId()
    createChat(id)
    setActiveId(id)
    setMessages(upto)
    persistChat(id, upto)
    setFeedback({})
    if (window.innerWidth <= 820) setSidebarOpen(false)
    flash('Branched into a new chat')
  }

  // 👍/👎 register quietly (just highlight the button). The Improver learns from a
  // 👎 silently in the background — no popup, no auto-regenerate.
  function handleFeedback(index: number, rating: 'up' | 'down') {
    const m = messages[index]
    if (!m || m.role !== 'assistant') return
    setFeedback((f) => ({ ...f, [index]: rating }))
    const question =
      messages
        .slice(0, index)
        .reverse()
        .find((x) => x.role === 'user')?.content ?? ''
    void sendFeedback(question, m.content, rating, { token, ...currentCtx() })
  }

  async function launchScheduleStudy(task: StudyTask, milestoneIndex: number = 0) {
    const validIndex = Math.max(0, Math.min(milestoneIndex, (task.milestones?.length || 1) - 1))
    const schedInfo: ActiveScheduleInfo = {
      task,
      currentMilestoneIndex: validIndex,
    }
    setActiveScheduleTask(schedInfo)
    sessionStorage.setItem('tark_active_schedule', JSON.stringify(schedInfo))

    // Close any planner / wizard modals
    setShowTaskManager(false)
    setShowTaskWizard(false)

    const ms = task.milestones[validIndex] || task.milestones[0]
    const subj = task.details?.subject || task.details?.exam_name || ''
    const board = task.details?.board || ''
    const grade = task.details?.grade ? `Class ${task.details.grade}` : ''
    const chapter = task.details?.chapter || ms.chapter || ms.title || ''
    const pageNo = ms.page_number || validIndex + 1

    const chatTitle = `${subj ? `${subj} • ` : ''}${ms.title || `Milestone ${validIndex + 1}`}`.slice(0, 42)

    // Start a fresh, dedicated chat session for this milestone
    const chatId = newId()
    createChat(chatId, chatTitle)
    setActiveId(chatId)
    setMessages([])
    setFeedback({})
    if (window.innerWidth <= 820) setSidebarOpen(false)

    const contextTag = [board, grade, subj ? `Subject: ${subj}` : ''].filter(Boolean).join(', ')

    let prompt = `Hello! Let's start Milestone ${validIndex + 1} of ${task.milestones.length}: "${ms.title}"${contextTag ? ` [${contextTag}]` : ''}. Please teach me step-by-step like a teacher on our first day of this chapter.`
    if (task.track === 'page_by_page' || ms.page_number) {
      prompt = `Hello! Let's start studying Page ${pageNo} of ${chapter} [${contextTag || 'Curriculum Study'}]. Please display the textbook page and teach me the concepts step-by-step like a teacher on our first day of this chapter.`
    }

    const userMsg: ChatMessage = { role: 'user', content: prompt, at: Date.now() }
    const history: ChatMessage[] = [userMsg]
    setMessages(history)
    persistChat(chatId, history)
    await runCompletion(chatId, history, schedInfo)
  }

  async function launchExamWorkout(task: StudyTask) {
    const schedInfo: ActiveScheduleInfo = {
      task,
      currentMilestoneIndex: 0,
    }
    setActiveScheduleTask(schedInfo)
    sessionStorage.setItem('tark_active_schedule', JSON.stringify(schedInfo))

    const chatId = newId()
    createChat(chatId)
    setActiveId(chatId)
    setMessages([])
    setFeedback({})
    if (window.innerWidth <= 820) setSidebarOpen(false)

    const subj = task.details?.subject || task.details?.exam_subject || ''
    const examName = task.details?.exam_name || task.title || 'Upcoming Exam'
    const portion = task.details?.syllabus || task.details?.portion || 'Target Exam Portion'

    const prompt = `🎯 Hello Tark! I am preparing for my exam: "${examName}". Let's start our Daily 3-Question Memory Workout (Spaced Repetition) for my syllabus portion: "${portion}"${subj ? ` (${subj})` : ''}. Please test me on 3 high-yield exam questions one at a time so I can lock them in memory before exam day. Let's begin with Question 1 of 3!`

    const userMsg: ChatMessage = { role: 'user', content: prompt, at: Date.now() }
    const history: ChatMessage[] = [userMsg]
    setMessages(history)
    await runCompletion(chatId, history, schedInfo)
  }

  async function handleNextMilestone() {
    if (!activeScheduleTask || busy) return
    const { task, currentMilestoneIndex } = activeScheduleTask
    const currMs = task.milestones[currentMilestoneIndex]

    // Mark current milestone completed if not already done
    if (currMs && !currMs.completed) {
      try {
        await toggleMilestone(task.id, currMs.id, true, token)
        task.milestones[currentMilestoneIndex].completed = true
      } catch (e) {
        console.warn('Failed to update milestone status:', e)
      }
    }

    const nextIdx = currentMilestoneIndex + 1
    if (nextIdx < task.milestones.length) {
      const nextMs = task.milestones[nextIdx]
      const updatedSched: ActiveScheduleInfo = {
        task,
        currentMilestoneIndex: nextIdx,
      }
      setActiveScheduleTask(updatedSched)
      flash(`Advanced to Milestone ${nextIdx + 1}: ${nextMs.title}`)

      const chatId = activeId ?? newId()
      if (!activeId) {
        createChat(chatId)
        setActiveId(chatId)
      }

      const subj = task.details?.subject || ''
      const board = task.details?.board || ''
      const grade = task.details?.grade ? `Class ${task.details.grade}` : ''
      const chapter = task.details?.chapter || nextMs.chapter || nextMs.title || ''
      const contextTag = [board, grade, subj ? `Subject: ${subj}` : ''].filter(Boolean).join(', ')

      let prompt = `I've completed Milestone ${currentMilestoneIndex + 1} ("${currMs?.title}"). Let's advance to Milestone ${nextIdx + 1} of ${task.milestones.length}: "${nextMs.title}"${contextTag ? ` [${contextTag}]` : ''}. Please teach me step-by-step like our first day on this milestone topic.`
      if (task.track === 'page_by_page' || nextMs.page_number) {
        prompt = `I've completed Page ${currMs?.page_number || currentMilestoneIndex + 1}. Let's advance to Page ${nextMs.page_number || nextIdx + 1} of ${chapter} [${contextTag || 'Curriculum Study'}]. Please show the textbook page and teach the next concepts step-by-step.`
      }

      const userMsg: ChatMessage = { role: 'user', content: prompt, at: Date.now() }
      const history: ChatMessage[] = [...messages, userMsg]
      setMessages(history)
      await runCompletion(chatId, history, updatedSched)
    } else {
      flash(`All ${task.milestones.length} milestones in "${task.title}" completed!`)
    }
  }


  const starterTopics = [
    { category: '🧪 Virtual Lab', title: 'Acid-Base Titration & pH', query: 'How does an acid-base titration work? Show me the pH curve and equivalence point in the simulation.' },
    { category: '🚀 Virtual Lab', title: 'Projectile 2D Trajectory', query: 'Simulate projectile motion at a 45 degree launch angle and explain maximum range and flight time.' },
    { category: '🧲 Virtual Lab', title: 'Magnetic Field & Compass', query: 'Show me the magnetic field lines around a bar magnet and how a compass needle aligns.' },
    { category: '⚛️ Virtual Lab', title: 'Bohr Atom & Spectral Lines', query: 'Explain the Bohr model of the hydrogen atom and how electron transitions create spectral lines.' },
    { category: 'Mathematics', title: 'Polynomial Factorization', query: 'Factorize the polynomial 6*x^3 - 11*x^2 - 3*x + 2 and find all its real roots step by step.' },
    { category: 'Physics', title: 'Inclined Plane Kinematics', query: 'A 2 kg block slides down a 30° frictionless incline from a height of 5m. What is its velocity at the bottom, and what does the energy diagram look like?' },
  ]

  return (
    <div
      className={`app ${sidebarOpen ? 'sidebar-open' : ''} ${isDragOver ? 'drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="dropzone-overlay">
          <div className="dropzone-card">
            <span className="drop-icon" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            <h3>Drop Files or Folders Here</h3>
            <p>Tark will instantly analyze photos, PDFs, notes, or study folders</p>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <Sidebar
          chats={chats}
          activeId={activeId}
          onNew={handleNew}
          onNewTask={() => ensureProfile(() => setShowTaskWizard(true))}
          onOpenTasks={() => ensureProfile(() => setShowTaskManager(true))}
          onOpenVirtualLab={() => ensureProfile(() => setShowVirtualLab(true))}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onProfile={() => (user ? setShowSettings(true) : setShowProfileSetup(true))}
          onProgress={() => setShowProgress(true)}
          onLogin={openLogin}
          onClose={() => setSidebarOpen(false)}
          boardShort={boardShort}
          onOpenFriends={() => {
            if (!user) {
              openLogin()
              return
            }
            ensureProfile(() => setShowFriends(true))
          }}
          friendsUnreadCount={friendsUnreadCount}
        />
      )}

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            onClick={() => setSidebarOpen((o) => !o)}
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          {!sidebarOpen && (
            <span className="brand">
              <Logo size={20} className="brand-mark" />
              <span className="brand-name">Tark</span>
            </span>
          )}
          <div className="topbar-right">
            {!user ? (
              <button className="login-btn" onClick={openLogin}>
                Log in
              </button>
            ) : (
              <button
                type="button"
                className="user-profile-btn"
                onClick={() => setShowSettings(true)}
                title={user.username || user.email}
              >
                {user.username ? user.username[0].toUpperCase() : '👤'}
              </button>
            )}
          </div>
        </header>

        {activeScheduleTask && (
          <div className="schedule-chat-header">
            <div className="sch-left">
              <span className={`sch-track-pill track-${activeScheduleTask.task.track}`}>
                {trackLabel(activeScheduleTask.task.track)}
              </span>
              <div className="sch-info">
                <span className="sch-title">{activeScheduleTask.task.title}</span>
                <span className="sch-milestone-step">
                  Milestone {activeScheduleTask.currentMilestoneIndex + 1} of {activeScheduleTask.task.milestones.length}:{' '}
                  <strong>{activeScheduleTask.task.milestones[activeScheduleTask.currentMilestoneIndex]?.title}</strong>
                </span>
              </div>
            </div>
            <div className="sch-actions">
              <button
                type="button"
                className="sch-btn sch-btn-next"
                title="Advance to next milestone in schedule"
                onClick={() => void handleNextMilestone()}
                disabled={busy}
              >
                Next Milestone →
              </button>
              <button
                type="button"
                className="sch-btn sch-btn-plan"
                title="View full study plan"
                onClick={() => ensureProfile(() => setShowTaskManager(true))}
              >
                Plan
              </button>
              <button
                type="button"
                className="sch-btn sch-btn-close"
                title="Dismiss schedule banner"
                onClick={() => setActiveScheduleTask(null)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <main className="conversation" ref={scrollRef}>
          <div className="thread">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-brand">
                  <Logo size={42} className="brand-mark" />
                  <span className="welcome-wordmark">Tark</span>
                </div>
                <h1>Curriculum Learning & Problem Solving</h1>
                <p className="welcome-hint">
                  Enter an academic question, request a conceptual derivation, or upload a problem image.
                </p>

                <div className="discovery-grid">
                  {starterTopics.map((t, idx) => (
                    <div
                      key={idx}
                      className="discovery-card"
                      onClick={() => void sendText(t.query)}
                    >
                      <span className="card-category">{t.category}</span>
                      <span className="card-title">{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageView
                  key={i}
                  message={m}
                  userQuestion={
                    m.role === 'assistant' && i > 0 && messages[i - 1].role === 'user'
                      ? messages[i - 1].content
                      : undefined
                  }
                  streaming={
                    busy && i === messages.length - 1 && m.role === 'assistant'
                  }
                  canRegenerate={!busy && i === messages.length - 1}
                  feedback={feedback[i]}
                  isLatest={i === messages.length - 1}
                  onRegenerate={regenerateLast}
                  onFeedback={(r) => handleFeedback(i, r)}
                  onBranch={() => handleBranch(i)}
                  onToast={flash}
                  onFollowUp={(p) => void sendText(p)}
                  onTalkLive={(text) => setTalkLiveTarget(text)}
                  onShareWithFriend={(text) =>
                    handleOpenShareDoubt(
                      text,
                      i > 0 && messages[i - 1].role === 'user' ? messages[i - 1].content : undefined
                    )
                  }
                  onEdit={
                    m.role === 'user' && !busy
                      ? (v) => handleEditMessage(i, v)
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </main>

        <div className="composer">
          {showProfileBanner && (
            <ProfileBanner
              onOpenSetup={() => {
                setShowProfileBanner(false)
                setShowProfileSetup(true)
              }}
              onDismiss={() => {
                setShowProfileBanner(false)
                localStorage.setItem('tark_profile_snoozed_at', String(Date.now()))
              }}
            />
          )}
          {/* Attachment Tray for Multiple Files/Folders/Images */}
          {attachedFiles.length > 0 && (
            <div className="attach-tray">
              {attachedFiles.map((f) => (
                <div key={f.id} className="attach-chip">
                  {f.type === 'image' && f.dataUrl ? (
                    <img src={f.dataUrl} alt={f.name} className="attach-chip-thumb" />
                  ) : (
                    <span className="attach-chip-icon">
                      {f.type === 'code' ? '💻' : f.type === 'folder' ? '📁' : '📄'}
                    </span>
                  )}
                  <span className="attach-chip-name" title={f.name}>
                    {f.name.length > 22 ? `${f.name.slice(0, 12)}…${f.name.slice(-7)}` : f.name}
                  </span>
                  <span className="attach-chip-size">
                    {f.size < 1024 * 1024
                      ? `${Math.round(f.size / 1024)} KB`
                      : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                  </span>
                  <button
                    type="button"
                    className="attach-chip-del"
                    onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.id !== f.id))}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="attach-tray-clear"
                onClick={() => setAttachedFiles([])}
                title="Clear all attachments"
              >
                Clear all
              </button>
            </div>
          )}

          {attachment && !attachedFiles.some((f) => f.dataUrl === attachment) && (
            <div className="attach-bar">
              <div className="attach-thumb">
                <img src={attachment} alt="attachment preview" />
                <button
                  className="attach-remove"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="input-pill">
            {/* Hidden upload inputs for images, documents, and folders */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void processFileList(Array.from(e.target.files))
                e.target.value = ''
              }}
            />
            <input
              ref={docRef}
              type="file"
              accept=".pdf,.txt,.md,.py,.js,.ts,.tsx,.json,.csv,.c,.cpp,.java,.html,.css"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void processFileList(Array.from(e.target.files))
                e.target.value = ''
              }}
            />
            <input
              ref={folderRef}
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void processFileList(Array.from(e.target.files))
                e.target.value = ''
              }}
            />

            {/* '+' button with popup menu */}
            <div className="attach-menu-wrap" ref={attachMenuRef}>
              <button
                type="button"
                className={`attach-btn ${showAttachMenu ? 'active' : ''}`}
                onClick={() => setShowAttachMenu((v) => !v)}
                title="Attach photos, documents, or study folders"
                aria-label="Attach files"
              >
                +
              </button>
              {showAttachMenu && (
                <div className="attach-dropdown">
                  <button
                    type="button"
                    className="attach-menu-item"
                    onClick={() => {
                      setShowAttachMenu(false)
                      fileRef.current?.click()
                    }}
                  >
                    <span className="ami-icon">🖼️</span>
                    <div className="ami-text">
                      <strong>Upload Photo / Image</strong>
                      <small>PNG, JPG, Problem screenshots</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="attach-menu-item"
                    onClick={() => {
                      setShowAttachMenu(false)
                      docRef.current?.click()
                    }}
                  >
                    <span className="ami-icon">📄</span>
                    <div className="ami-text">
                      <strong>Upload Document / Notes</strong>
                      <small>PDF, TXT, Markdown, Code</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="attach-menu-item"
                    onClick={() => {
                      setShowAttachMenu(false)
                      folderRef.current?.click()
                    }}
                  >
                    <span className="ami-icon">📁</span>
                    <div className="ami-text">
                      <strong>Upload Folder</strong>
                      <small>Entire study folder or chapter</small>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                autoGrow()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendText(input)
                }
              }}
              placeholder="Ask a question or drop files/folders here..."
              rows={1}
            />
            <select
              className="model-pick"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              title={selectedModel?.description ?? 'Select model'}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.tier === 'admin' ? ' (Admin)' : ''}
                </option>
              ))}
            </select>
            <button
              className="send"
              onClick={() => void sendText(input)}
              disabled={busy || (!input.trim() && !attachment && attachedFiles.length === 0)}
              aria-label="Send message"
            >
              {busy ? <span className="spinner" /> : '↑'}
            </button>
          </div>
          {gated && remaining <= 5 && (
            <div className="composer-note">
              <span className="gated-note">{remaining} free message{remaining === 1 ? '' : 's'} left — log in for unlimited.</span>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {showAuth && (
        <AuthPage reason={authReason} onClose={() => setShowAuth(false)} />
      )}
      {showSettings && user && (
        <SettingsModal
          boards={boards}
          models={models}
          modelId={modelId}
          onModelChange={setModelId}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showProgress && user && (
        <ProgressModal onClose={() => setShowProgress(false)} />
      )}
      {showProfileSetup && (
        <ProfileSetupModal
          isMandatory={isProfileMandatory}
          onClose={() => {
            setShowProfileSetup(false)
            setIsProfileMandatory(false)
            pendingActionRef.current = null
          }}
          onSuccess={() => {
            setShowProfileSetup(false)
            setIsProfileMandatory(false)
            if (pendingActionRef.current) {
              const action = pendingActionRef.current
              pendingActionRef.current = null
              setTimeout(() => {
                action()
              }, 50)
            }
          }}
        />
      )}
      {showTaskWizard && (
        <TaskWizardModal
          onClose={() => setShowTaskWizard(false)}
          onTaskCreated={() => setShowTaskManager(true)}
          onStartLearning={(task, idx) => void launchScheduleStudy(task, idx)}
          onEditProfile={() => {
            setShowTaskWizard(false)
            setIsProfileMandatory(false)
            setShowProfileSetup(true)
          }}
          userContext={currentCtx()}
        />
      )}
      {showTaskManager && (
        <TaskManagerModal
          onClose={() => setShowTaskManager(false)}
          onOpenWizard={() => ensureProfile(() => setShowTaskWizard(true))}
          onLaunchStudy={(task, idx) => void launchScheduleStudy(task, idx)}
          onLaunchExamWorkout={(task) => void launchExamWorkout(task)}
        />
      )}
      {talkLiveTarget && (
        <TalkLiveModal
          referenceText={talkLiveTarget}
          subject={currentCtx().subject}
          grade={currentCtx().grade}
          board={currentCtx().board}
          onMastered={(topic, score) => {
            flash(`🌟 Mastered "${topic}" with ${score}% active oral recall!`)
          }}
          onClose={() => setTalkLiveTarget(null)}
        />
      )}
      {showVirtualLab && (
        <VirtualLabModal
          onClose={() => setShowVirtualLab(false)}
          onSendToChat={(q) => void sendText(q)}
        />
      )}
      <FriendsDrawer
        isOpen={showFriends}
        onClose={() => {
          setShowFriends(false)
          setSelectedDoubtChannelId(null)
        }}
        token={token}
        currentUser={user}
        initialChannelId={selectedDoubtChannelId}
        onUnreadCountChange={(cnt) => setFriendsUnreadCount(cnt)}
        onRequireLogin={openLogin}
      />
      {shareDoubtPayload && (
        <ShareDoubtModal
          isOpen={true}
          onClose={() => setShareDoubtPayload(null)}
          token={token}
          doubtPayload={shareDoubtPayload}
          onDoubtShared={(chanId) => {
            setShareDoubtPayload(null)
            setSelectedDoubtChannelId(chanId)
            setShowFriends(true)
          }}
        />
      )}
    </div>
  )
}

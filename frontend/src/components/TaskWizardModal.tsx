import { useState, useEffect, useMemo } from 'react'
import {
  type TaskTrack,
  type Milestone,
  type StudyTask,
  type TextbookChapter,
  generateStudyPlan,
  createStudyTask,
  fetchTextbookChapters,
} from '../tasksApi'
import { useAuth } from '../auth'

export function getSubjectsForBoard(board?: string, grade?: string): string[] {
  const normBoard = (board || '').toLowerCase()
  const g = parseInt(grade || '10', 10) || 10

  if (normBoard.includes('maharashtra') || normBoard.includes('balbharati') || normBoard.includes('state')) {
    if (g === 11 || g === 12) {
      return [
        'Physics',
        'Chemistry',
        'Biology',
        'Mathematics & Statistics',
        'Information Technology (IT)',
        'Computer Science',
        'Book Keeping & Accountancy',
        'Organization of Commerce & Management (OCM)',
        'Secretarial Practice (SP)',
        'Economics',
        'History',
        'Political Science',
        'Geography',
        'Psychology',
        'Sociology',
        'English Yuvakbharati',
        'Marathi Yuvakbharati',
        'Hindi Yuvakbharati',
        'Sanskrit',
      ]
    } else if (g === 10) {
      return [
        'Science 1 (Physics & Chemistry)',
        'Science 2 (Biology & Environment)',
        'Maths 1 (Algebra)',
        'Maths 2 (Geometry)',
        'History & Political Science',
        'Geography',
        'English Kumarbharati',
        'Marathi (Kumarbharati / Aksharbharati)',
        'Hindi (Lokbharati / Lokvani)',
        'Sanskrit (Amod / Anand)',
        'Information Communication Technology (ICT)',
        'Defence Studies',
      ]
    } else if (g === 9) {
      return [
        'Science & Technology',
        'Maths 1 (Algebra)',
        'Maths 2 (Geometry)',
        'History & Political Science',
        'Geography',
        'English Kumarbharati',
        'Marathi (Kumarbharati / Aksharbharati)',
        'Hindi (Lokbharati / Lokvani)',
        'Sanskrit (Amod / Anand)',
        'Information Communication Technology (ICT)',
        'Defence Studies',
      ]
    } else if (g >= 6 && g <= 8) {
      return [
        'General Science',
        'Mathematics',
        'History & Civics',
        'Geography',
        'English Balbharati',
        'Marathi Sulabhbharati',
        'Hindi Sulabhbharati',
        'Sanskrit (Sugam Sanskrit / Amod)',
      ]
    } else {
      return [
        'Mathematics',
        'Environmental Studies (EVS)',
        'English Balbharati',
        'Marathi Balbharati',
        'Hindi',
      ]
    }
  }

  if (normBoard.includes('icse') || normBoard.includes('cisce')) {
    if (g === 11 || g === 12) {
      return [
        'Mathematics',
        'Physics',
        'Chemistry',
        'Biology',
        'Computer Science',
        'Accounts',
        'Commerce',
        'Economics',
        'Business Studies',
        'History',
        'Political Science',
        'Geography',
        'Psychology',
        'Sociology',
        'English Literature & Language',
        'Hindi',
        'Sanskrit',
      ]
    } else if (g >= 9) {
      return [
        'Mathematics',
        'Physics',
        'Chemistry',
        'Biology',
        'Computer Applications',
        'Commercial Studies',
        'Economic Applications',
        'Environmental Science',
        'History & Civics',
        'Geography',
        'English Literature & Language',
        'Hindi',
        'Sanskrit',
      ]
    } else if (g >= 6) {
      return [
        'Mathematics',
        'Physics',
        'Chemistry',
        'Biology',
        'Computer Applications',
        'History & Civics',
        'Geography',
        'English Literature & Language',
        'Hindi',
        'Sanskrit',
      ]
    } else {
      return [
        'Mathematics',
        'Science',
        'Social Studies',
        'EVS',
        'English',
        'Hindi',
        'Computer Studies',
      ]
    }
  }

  if (normBoard.includes('cbse') || normBoard.includes('ncert')) {
    if (g >= 11) {
      return [
        'Physics',
        'Chemistry',
        'Biology',
        'Mathematics / Applied Mathematics',
        'Computer Science (083)',
        'Informatics Practices (065)',
        'Accountancy',
        'Business Studies',
        'Economics',
        'History',
        'Political Science',
        'Geography',
        'Psychology',
        'Sociology',
        'English Core',
        'Hindi Core',
        'Sanskrit Core / Elective',
      ]
    } else if (g >= 9) {
      return [
        'Science',
        'Mathematics (Standard / Basic)',
        'Social Science',
        'English Language & Literature',
        'Hindi Course A/B',
        'Sanskrit (Shemushi / Manika)',
        'Information Technology (IT 402) / AI',
        'Computer Applications',
      ]
    } else if (g >= 6) {
      return [
        'Science',
        'Mathematics',
        'Social Science',
        'English',
        'Hindi',
        'Sanskrit (Ruchira)',
        'Computer Studies / Coding',
      ]
    } else {
      return [
        'Mathematics',
        'Environmental Studies (EVS)',
        'English',
        'Hindi',
      ]
    }
  }

  if (normBoard.includes('igcse') || normBoard.includes('cambridge')) {
    return [
      'Physics',
      'Chemistry',
      'Biology',
      'Mathematics (Core / Extended / Additional)',
      'Combined / Co-ordinated Sciences',
      'Computer Science / ICT',
      'Economics & Business Studies',
      'Accounting',
      'Geography / History',
      'Global Perspectives',
      'English First/Second Language',
      'Hindi as a Second Language',
      'Sanskrit / French / Spanish / German',
    ]
  }

  return [
    'Physics',
    'Chemistry',
    'Biology',
    'Mathematics',
    'Science (General)',
    'Social Studies / History',
    'Geography',
    'English Language & Literature',
    'Hindi',
    'Sanskrit',
    'Computer Science / IT',
    'Economics & Commerce',
  ]
}

export function normalizeBoardDisplay(board?: string): string {
  const norm = (board || '').toLowerCase()
  if (norm.includes('icse') || norm.includes('cisce')) return 'ICSE / CISCE'
  if (norm.includes('cbse') || norm.includes('ncert')) return 'CBSE (NCERT)'
  if (norm.includes('maharashtra') || norm.includes('balbharati') || norm.includes('state')) return 'Maharashtra State Board'
  if (norm.includes('cambridge') || norm.includes('igcse')) return 'Cambridge IGCSE'
  return board?.trim() || 'General Curriculum'
}

export function getTargetExamsForBoard(board?: string, grade?: string): string[] {
  const norm = (board || '').toLowerCase()
  const g = parseInt(grade || '10', 10) || 10

  if (norm.includes('icse') || norm.includes('cisce')) {
    if (g >= 11) {
      return [
        'ISC Class 12 Board Examination',
        'ISC Pre-Board & School Prelims',
        'JEE Main & Advanced',
        'NEET UG (Medical Entrance)',
        'ISC Semester & Unit Tests',
        'National Olympiads & KVPY',
      ]
    } else if (g >= 9) {
      return [
        `ICSE Class ${g} Board Examination`,
        `ICSE Class ${g} Pre-Board & Prelims`,
        `ICSE Class ${g} Semester & Unit Tests`,
        'NTSE & National Olympiads',
      ]
    } else {
      return [
        `ICSE Class ${g} Annual School Examination`,
        `ICSE Class ${g} Term Assessments`,
        'Science & Math Olympiads',
      ]
    }
  }

  if (norm.includes('cbse') || norm.includes('ncert')) {
    if (g >= 11) {
      return [
        `CBSE Class ${g} Board Examination`,
        `CBSE Class ${g} Pre-Board Examination`,
        'JEE Main & Advanced',
        'NEET UG (Medical Entrance)',
        `CBSE Class ${g} Term & Unit Tests`,
        'Olympiads & KVPY',
      ]
    } else if (g >= 9) {
      return [
        `CBSE Class ${g} Board Examination`,
        `CBSE Class ${g} Pre-Board Examination`,
        'Olympiads & NTSE',
        `CBSE Class ${g} Mid-Term / Half-Yearly Exam`,
        `CBSE Class ${g} Periodic Tests`,
      ]
    } else {
      return [
        `CBSE Class ${g} Annual School Examination`,
        `CBSE Class ${g} Term Assessments`,
        'Science & Math Olympiads',
      ]
    }
  }

  if (norm.includes('maharashtra') || norm.includes('balbharati') || norm.includes('state')) {
    if (g >= 11) {
      return [
        'Maharashtra HSC Class 12 Board Examination',
        'MHT-CET Entrance Examination',
        'JEE Main & Advanced',
        'NEET UG (Medical Entrance)',
        'HSC Prelims & Practice Tests',
      ]
    } else if (g >= 9) {
      return [
        `Maharashtra SSC Class ${g} Board Examination`,
        `SSC Class ${g} Prelims & Practice Papers`,
        `SSC Class ${g} Semester Examinations`,
        'NTSE / MTSE Scholarship Exam',
      ]
    } else {
      return [
        `State Board Class ${g} Annual Examination`,
        `State Board Class ${g} Semester Tests`,
      ]
    }
  }

  if (norm.includes('cambridge') || norm.includes('igcse')) {
    return [
      'Cambridge IGCSE Board Examination',
      'Cambridge AS & A Levels',
      'Checkpoint Examination',
      'Mock Examinations',
    ]
  }

  return [
    `Class ${g} Board Examination`,
    'JEE Main & Advanced',
    'NEET UG (Medical Entrance)',
    'School Prelims & Mid-Term Exams',
    'National Olympiads',
  ]
}

interface Props {
  onClose: () => void
  onTaskCreated: (task: StudyTask) => void
  onStartLearning?: (task: StudyTask, milestoneIndex: number) => void
  onEditProfile?: () => void
  userContext?: {
    board?: string
    grade?: string
    exam?: string
    subject?: string
    tutoring_style?: string
    language?: string
    weak_subjects?: string[]
    goal?: string
  }
}

export function TaskWizardModal({
  onClose,
  onTaskCreated,
  onStartLearning,
  onEditProfile,
  userContext,
}: Props) {
  const { token } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [track, setTrack] = useState<TaskTrack>('coursework')

  // Helper for live timeframe calculation
  function getDaysRemaining(dateStr: string): number | null {
    if (!dateStr) return null
    const target = new Date(dateStr)
    if (isNaN(target.getTime())) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  function formatDurationBadge(days: number | null): { text: string; isWarning: boolean } {
    if (days === null) return { text: '', isWarning: false }
    if (days < 0) return { text: 'Date is in the past (please pick a future date)', isWarning: true }
    if (days === 0) return { text: 'Exam is TODAY (Immediate Hourly Countdown)', isWarning: false }
    if (days === 1) return { text: '1 day left (24-Hour Countdown Sprint)', isWarning: false }
    if (days <= 5) return { text: `${days} days left (Hourly Sprint Schedule)`, isWarning: false }
    if (days <= 7) return { text: `${days} days remaining (1-week sprint)`, isWarning: false }
    if (days <= 21) return { text: `${days} days remaining (~${Math.round(days / 7)} weeks)`, isWarning: false }
    if (days <= 60) return { text: `${days} days remaining (~${Math.round(days / 7)} weeks)`, isWarning: false }
    const months = (days / 30.4).toFixed(1)
    return { text: `${days} days remaining (~${months} months)`, isWarning: false }
  }

  const resolvedBoard = userContext?.board || localStorage.getItem('tark_board') || 'ICSE'
  const resolvedGrade = userContext?.grade || localStorage.getItem('tark_grade') || '10'
  const resolvedBoardDisplay = normalizeBoardDisplay(resolvedBoard)

  const targetExamOptions = useMemo(
    () => getTargetExamsForBoard(resolvedBoard, resolvedGrade),
    [resolvedBoard, resolvedGrade]
  )

  const initialExamPreset = useMemo(() => {
    if (userContext?.exam && targetExamOptions.includes(userContext.exam)) {
      return userContext.exam
    }
    return targetExamOptions[0] || 'Board Examination'
  }, [userContext?.exam, targetExamOptions])

  // Exam prep form fields
  const [examPreset, setExamPreset] = useState(initialExamPreset)
  const [customExamName, setCustomExamName] = useState('')

  // Dynamically resolve exam subjects based on selected exam and resolved board
  const examSubjectsList = useMemo(() => {
    if (examPreset.includes('JEE')) {
      return ['Physics', 'Chemistry', 'Mathematics']
    }
    if (examPreset.includes('NEET')) {
      return ['Physics', 'Chemistry', 'Biology']
    }
    return getSubjectsForBoard(resolvedBoard, resolvedGrade)
  }, [examPreset, resolvedBoard, resolvedGrade])

  const initialSubjects = examSubjectsList
  const initialSubject =
    userContext?.subject && initialSubjects.includes(userContext.subject)
      ? userContext.subject
      : initialSubjects[0] || 'Physics'

  // Coursework form fields
  const [cwSubject, setCwSubject] = useState(initialSubject)
  const [customCwSubject, setCustomCwSubject] = useState('')
  const [cwPortion, setCwPortion] = useState('')
  const [cwPriorityFocus, setCwPriorityFocus] = useState('')
  const [cwDeadline, setCwDeadline] = useState('')
  const [cwDailyHours, setCwDailyHours] = useState('2 hours/day')
  const [customCwDailyHours, setCustomCwDailyHours] = useState('')
  const [cwDepth, setCwDepth] = useState('Step-by-step conceptual mastery')
  const [customCwDepth, setCustomCwDepth] = useState('')

  // Exam subject & fields
  const [examSubject, setExamSubject] = useState(initialSubject)
  const [customExamSubject, setCustomExamSubject] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examTime, setExamTime] = useState('09:00')
  const [examSyllabus, setExamSyllabus] = useState('')
  const [examPriorityFocus, setExamPriorityFocus] = useState('')
  const [examDailyHours, setExamDailyHours] = useState('3-4 hours/day')
  const [customExamDailyHours, setCustomExamDailyHours] = useState('')
  const [examDepth, setExamDepth] = useState('High-yield formula revision & PYQs')
  const [customExamDepth, setCustomExamDepth] = useState('')
  const [includeMocks, setIncludeMocks] = useState(true)
  const [dailySpacedRepetition, setDailySpacedRepetition] = useState(true)
  const [targetScore, setTargetScore] = useState('90%+')

  function handleExamPresetChange(newExam: string) {
    setExamPreset(newExam)
    let newSubs: string[]
    if (newExam.includes('JEE')) {
      newSubs = ['Physics', 'Chemistry', 'Mathematics']
    } else if (newExam.includes('NEET')) {
      newSubs = ['Physics', 'Chemistry', 'Biology']
    } else {
      newSubs = getSubjectsForBoard(resolvedBoard, resolvedGrade)
    }
    if (newSubs.length > 0 && !newSubs.includes(examSubject) && examSubject !== '__custom__') {
      setExamSubject(newSubs[0])
    }
  }

  // Research form fields
  const [resDomain, setResDomain] = useState('Applied Physics & Nanotechnology')
  const [customResDomain, setCustomResDomain] = useState('')
  const [resQuestion, setResQuestion] = useState('')
  const [resOutcome, setResOutcome] = useState('Literature Review & Synthesis')
  const [customResOutcome, setCustomResOutcome] = useState('')
  const [resTimeline, setResTimeline] = useState('4 weeks')
  const [customResTimeline, setCustomResTimeline] = useState('')

  // Page-by-Page form fields (locked to student board & grade)
  const [pbpSubject, setPbpSubject] = useState(initialSubject)
  const [customPbpSubject, setCustomPbpSubject] = useState('')
  const [pbpChapter, setPbpChapter] = useState('')
  const [customPbpChapter, setCustomPbpChapter] = useState('')
  const [selectedChaptersList, setSelectedChaptersList] = useState<string[]>([])
  const [pbpStartPage, setPbpStartPage] = useState<number | ''>('')
  const [pbpEndPage, setPbpEndPage] = useState<number | ''>('')
  const [pbpPacing, setPbpPacing] = useState('1 page per session (Deep Line-by-Line Mastery)')
  const [customPbpPacing, setCustomPbpPacing] = useState('')
  const [availableChapters, setAvailableChapters] = useState<TextbookChapter[]>([])
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [selectedSource, setSelectedSource] = useState('')

  // Dynamic subject lists
  const pbpSubjectsList = useMemo(() => getSubjectsForBoard(resolvedBoard, resolvedGrade), [resolvedBoard, resolvedGrade])
  const cwSubjectsList = useMemo(() => getSubjectsForBoard(resolvedBoard, resolvedGrade), [resolvedBoard, resolvedGrade])

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [generatedTitle, setGeneratedTitle] = useState('')
  const [generatedSummary, setGeneratedSummary] = useState('')
  const [generatedChapterConfirmation, setGeneratedChapterConfirmation] = useState<string | null>(null)
  const [generationClarificationError, setGenerationClarificationError] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [saving, setSaving] = useState(false)

  // Resolved effective values
  const effectiveCwSubject = cwSubject === '__custom__' ? (customCwSubject.trim() || 'Custom Subject') : cwSubject
  const effectiveCwDailyHours = cwDailyHours === '__custom__' ? (customCwDailyHours.trim() || 'Custom Commitment') : cwDailyHours
  const effectiveCwDepth = cwDepth === '__custom__' ? (customCwDepth.trim() || 'Custom Depth') : cwDepth

  const isCustomExam = examPreset === '__custom__'
  const effectiveExamName = isCustomExam ? (customExamName.trim() || 'Target Exam') : examPreset
  const effectiveExamSubject = examSubject === '__custom__' ? (customExamSubject.trim() || 'Custom Subject') : examSubject
  const effectiveExamDailyHours = examDailyHours === '__custom__' ? (customExamDailyHours.trim() || 'Custom Commitment') : examDailyHours
  const effectiveExamDepth = examDepth === '__custom__' ? (customExamDepth.trim() || 'Custom Strategy') : examDepth

  const effectiveResDomain = resDomain === '__custom__' ? (customResDomain.trim() || 'Research Domain') : resDomain
  const effectiveResOutcome = resOutcome === '__custom__' ? (customResOutcome.trim() || 'Custom Deliverable') : resOutcome
  const effectiveResTimeline = resTimeline === '__custom__' ? (customResTimeline.trim() || 'Custom Timeline') : resTimeline

  const effectivePbpBoard = resolvedBoard
  const effectivePbpGrade = resolvedGrade
  const effectivePbpSubject = pbpSubject === '__custom__' ? (customPbpSubject.trim() || 'Physics') : pbpSubject
  const effectivePbpChapter = pbpChapter === '__custom__'
    ? (customPbpChapter.trim() || 'Chapter 1')
    : (selectedChaptersList.length > 0 ? selectedChaptersList.join(', ') : (pbpChapter || customPbpChapter.trim() || 'Chapter 1'))
  const effectivePbpPacing = pbpPacing === '__custom__' ? (customPbpPacing.trim() || '1 page/session') : pbpPacing

  // Fetch available textbook chapters when Board/Grade/Subject changes in Page-by-Page track
  useEffect(() => {
    if (track !== 'page_by_page') return
    let active = true
    setLoadingChapters(true)
    fetchTextbookChapters(effectivePbpBoard, effectivePbpGrade, effectivePbpSubject)
      .then((chs) => {
        if (!active) return
        setAvailableChapters(chs)
        if (chs.length > 0) {
          const first = chs[0]
          setPbpChapter(first.chapter)
          setSelectedChaptersList([first.chapter])
          setSelectedSource(first.source)
          setPbpStartPage(first.start_page)
          setPbpEndPage(first.end_page)
        } else {
          setPbpChapter('__custom__')
          setSelectedChaptersList([])
          setSelectedSource('')
          setPbpStartPage(1)
          setPbpEndPage(5)
        }
      })
      .finally(() => {
        if (active) setLoadingChapters(false)
      })
    return () => {
      active = false
    }
  }, [track, effectivePbpBoard, effectivePbpGrade, effectivePbpSubject])

  function toggleChapterSelection(chapTitle: string) {
    setSelectedChaptersList((prev) => {
      let next: string[]
      if (prev.includes(chapTitle)) {
        next = prev.filter((c) => c !== chapTitle)
      } else {
        next = [...prev, chapTitle]
      }

      if (next.length === 1) {
        const found = availableChapters.find((c) => c.chapter === next[0])
        if (found) {
          setPbpChapter(found.chapter)
          setSelectedSource(found.source)
          setPbpStartPage(found.start_page)
          setPbpEndPage(found.end_page)
        }
      } else if (next.length > 1) {
        setPbpChapter(next.join(', '))
        const first = availableChapters.find((c) => c.chapter === next[0])
        const last = availableChapters.find((c) => c.chapter === next[next.length - 1])
        if (first && last) {
          setPbpStartPage(first.start_page)
          setPbpEndPage(last.end_page)
        }
      } else {
        setPbpChapter('')
        setPbpStartPage('')
        setPbpEndPage('')
      }
      return next
    })
  }

  function selectAllChapters() {
    const all = availableChapters.map((c) => c.chapter)
    setSelectedChaptersList(all)
    setPbpChapter(all.join(', '))
    if (availableChapters.length > 0) {
      setPbpStartPage(availableChapters[0].start_page)
      setPbpEndPage(availableChapters[availableChapters.length - 1].end_page)
    }
  }

  function clearChapterSelection() {
    setSelectedChaptersList([])
    setPbpChapter('')
    setPbpStartPage('')
    setPbpEndPage('')
  }

  const cwDaysRemaining = getDaysRemaining(cwDeadline)
  const examDaysRemaining = getDaysRemaining(examDate)
  const isUrgentExam = examDaysRemaining !== null && examDaysRemaining >= 0 && examDaysRemaining <= 5

  // Detect whether custom exam has only chapter numbers without topic names
  function hasMissingChapterNames(isCustom: boolean, text: string): boolean {
    if (!isCustom) return false
    const trimmed = text.trim()
    if (!trimmed) return false
    const cleaned = trimmed
      .replace(/\b(ch|chap|chapter|chapters|unit|units|part|parts|sec|section|sections|and|to|all|module|modules)\b/gi, '')
      .replace(/\b[ivxlcdm]+\b/gi, '')
      .replace(/[\d\s,\.\-\/\+\&\;:\(\)]+/g, '')
      .trim()
    return cleaned.length < 3
  }

  const missingChapterContext = isCustomExam && hasMissingChapterNames(true, examSyllabus)

  function getValidationErrors(): string[] {
    const errors: string[] = []

    if (track === 'coursework') {
      if (cwSubject === '__custom__' && !customCwSubject.trim()) {
        errors.push('Enter custom subject name')
      }
      if (!cwPortion.trim()) {
        errors.push('Enter syllabus / units covered')
      }
      if (!cwDeadline) {
        errors.push('Select target completion date')
      } else if (cwDaysRemaining !== null && cwDaysRemaining < 0) {
        errors.push('Completion date cannot be in the past')
      }
      if (cwDailyHours === '__custom__' && !customCwDailyHours.trim()) {
        errors.push('Specify custom daily hours')
      }
      if (cwDepth === '__custom__' && !customCwDepth.trim()) {
        errors.push('Specify custom learning depth')
      }
    } else if (track === 'exam') {
      if (isCustomExam && !customExamName.trim()) {
        errors.push('Enter custom exam name')
      }
      if (examSubject === '__custom__' && !customExamSubject.trim()) {
        errors.push('Enter custom subject name')
      }
      if (!examDate) {
        errors.push('Select exam date')
      } else if (examDaysRemaining !== null && examDaysRemaining < 0) {
        errors.push('Exam date cannot be in the past')
      }
      if (isUrgentExam && !examTime) {
        errors.push('Enter exam paper start time')
      }
      if (!examSyllabus.trim()) {
        errors.push('Enter full exam syllabus / chapters')
      } else if (missingChapterContext) {
        errors.push('Specify chapter names/topics for custom exam')
      }
      if (examDailyHours === '__custom__' && !customExamDailyHours.trim()) {
        errors.push('Specify custom daily hours')
      }
      if (examDepth === '__custom__' && !customExamDepth.trim()) {
        errors.push('Specify custom strategy preference')
      }
    } else if (track === 'page_by_page') {
      if (pbpSubject === '__custom__' && !customPbpSubject.trim()) {
        errors.push('Enter custom subject name')
      }
      if (pbpChapter === '__custom__' && !customPbpChapter.trim()) {
        errors.push('Enter chapter name')
      }
      if (!effectivePbpChapter) {
        errors.push('Select or enter chapter name')
      }
      if (pbpPacing === '__custom__' && !customPbpPacing.trim()) {
        errors.push('Specify custom pacing')
      }
    } else {
      if (resDomain === '__custom__' && !customResDomain.trim()) {
        errors.push('Enter custom research domain')
      }
      if (!resQuestion.trim()) {
        errors.push('Enter core research problem/question')
      }
      if (resOutcome === '__custom__' && !customResOutcome.trim()) {
        errors.push('Specify custom deliverable')
      }
      if (resTimeline === '__custom__' && !customResTimeline.trim()) {
        errors.push('Specify custom project duration')
      }
    }

    return errors
  }

  const validationErrors = getValidationErrors()
  const isFormValid = validationErrors.length === 0

  async function handleGenerate() {
    if (!isFormValid || generating) return
    setGenerating(true)
    setGenerationClarificationError(null)
    setStep(3)

    let answers: Record<string, any> = {}
    if (track === 'coursework') {
      answers = {
        subject: effectiveCwSubject,
        portion: cwPortion.trim(),
        priority_focus: cwPriorityFocus.trim(),
        deadline: cwDeadline,
        calculated_days: cwDaysRemaining !== null && cwDaysRemaining >= 0 ? cwDaysRemaining : undefined,
        daily_hours: effectiveCwDailyHours,
        depth: effectiveCwDepth,
      }
    } else if (track === 'exam') {
      answers = {
        exam_name: effectiveExamName,
        subject: effectiveExamSubject,
        is_custom_exam: isCustomExam,
        syllabus: examSyllabus.trim(),
        priority_focus: examPriorityFocus.trim(),
        portion_focus: `${effectiveExamSubject}: ${examSyllabus.trim()}` + (examPriorityFocus.trim() ? ` (Priority Focus: ${examPriorityFocus.trim()})` : ''),
        exam_date: examDate,
        exam_time: isUrgentExam ? examTime : undefined,
        is_hourly: isUrgentExam,
        calculated_days: examDaysRemaining !== null && examDaysRemaining >= 0 ? examDaysRemaining : undefined,
        daily_hours: effectiveExamDailyHours,
        depth: effectiveExamDepth,
        include_mocks: includeMocks,
        daily_spaced_repetition: dailySpacedRepetition,
        target_score: targetScore,
      }
    } else if (track === 'page_by_page') {
      const selectedChaps = availableChapters.filter((c) => selectedChaptersList.includes(c.chapter))
      answers = {
        board: effectivePbpBoard,
        grade: effectivePbpGrade,
        subject: effectivePbpSubject,
        chapter: selectedChaptersList.length > 1 ? selectedChaptersList.join(', ') : effectivePbpChapter,
        selected_chapters: selectedChaps.length > 0 ? selectedChaps : (selectedChaptersList.length > 0 ? selectedChaptersList.map((c) => ({ chapter: c })) : undefined),
        start_page: pbpStartPage ? Number(pbpStartPage) : undefined,
        end_page: pbpEndPage ? Number(pbpEndPage) : undefined,
        source: selectedSource || undefined,
        pacing: effectivePbpPacing,
      }
    } else {
      answers = {
        domain: effectiveResDomain,
        research_question: resQuestion.trim(),
        desired_outcome: effectiveResOutcome,
        timeline: effectiveResTimeline,
      }
    }

    try {
      const plan = await generateStudyPlan(track, answers, userContext, token)
      if (plan.needs_chapters) {
        setGenerationClarificationError(
          plan.clarification_message ||
            'Since this is a custom exam, please specify the chapter names or topics for these chapters.'
        )
        setStep(2)
        return
      }
      setGeneratedTitle(plan.title)
      setGeneratedSummary(plan.summary || '')
      setGeneratedChapterConfirmation(plan.chapter_confirmation || null)
      setMilestones(plan.milestones)
    } catch (e: any) {
      setGenerationClarificationError(e?.message || 'Failed to generate study schedule. Please try again.')
      setStep(2)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave(startLearning: boolean = false, milestoneIndex: number = 0) {
    if (saving || milestones.length === 0) return
    setSaving(true)
    let details: Record<string, any> = {}
    if (track === 'coursework') {
      details = {
        subject: effectiveCwSubject,
        portion: cwPortion,
        priority_focus: cwPriorityFocus,
        deadline: cwDeadline,
        calculated_days: cwDaysRemaining,
        daily_hours: effectiveCwDailyHours,
        depth: effectiveCwDepth,
        chapter_confirmation: generatedChapterConfirmation,
      }
    } else if (track === 'exam') {
      details = {
        exam_name: effectiveExamName,
        subject: effectiveExamSubject,
        is_custom_exam: isCustomExam,
        syllabus: examSyllabus,
        priority_focus: examPriorityFocus,
        chapter_confirmation: generatedChapterConfirmation,
        exam_date: examDate,
        exam_time: isUrgentExam ? examTime : undefined,
        is_hourly: isUrgentExam,
        calculated_days: examDaysRemaining,
        daily_hours: effectiveExamDailyHours,
        depth: effectiveExamDepth,
        target_score: targetScore,
      }
    } else if (track === 'page_by_page') {
      details = {
        board: effectivePbpBoard,
        grade: effectivePbpGrade,
        subject: effectivePbpSubject,
        chapter: selectedChaptersList.length > 1 ? selectedChaptersList.join(', ') : effectivePbpChapter,
        selected_chapters: selectedChaptersList,
        start_page: pbpStartPage,
        end_page: pbpEndPage,
        source: selectedSource,
        pacing: effectivePbpPacing,
        chapter_confirmation: generatedChapterConfirmation,
      }
    } else {
      details = {
        domain: effectiveResDomain,
        question: resQuestion,
        outcome: effectiveResOutcome,
        timeline: effectiveResTimeline,
      }
    }

    try {
      const created = await createStudyTask(track, generatedTitle, details, milestones, token)
      if (startLearning && onStartLearning) {
        onStartLearning(created, milestoneIndex)
      } else {
        onTaskCreated(created)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-wizard-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="task-wizard-header">
          <div className="tw-header-left">
            <span className="tw-badge">Study Planner &amp; Scheduler</span>
            <h2 className="tw-title">
              {step === 1 && 'Select Your Academic Objective'}
              {step === 2 && (track === 'coursework' ? 'Coursework & Syllabus Details' : track === 'exam' ? 'Exam Preparation Strategy' : track === 'page_by_page' ? 'Textbook Chapter & Page-by-Page Setup' : 'Research Objective & Scope')}
              {step === 3 && 'Your Customized Study Roadmap'}
            </h2>
          </div>
          <div className="tw-steps">
            <span className={`tw-step-dot ${step >= 1 ? 'active' : ''}`}>1</span>
            <span className="tw-step-line" />
            <span className={`tw-step-dot ${step >= 2 ? 'active' : ''}`}>2</span>
            <span className="tw-step-line" />
            <span className={`tw-step-dot ${step >= 3 ? 'active' : ''}`}>3</span>
          </div>
        </div>

        {/* Step 1: Track Selection */}
        {step === 1 && (
          <div className="tw-body">
            <p className="tw-desc">
              Choose the primary objective for this schedule. Tark will tailor questions, milestone pacing, and daily study blocks accordingly.
            </p>

            <div className="track-card-grid">
              <button
                type="button"
                className={`track-card ${track === 'coursework' ? 'selected' : ''}`}
                onClick={() => setTrack('coursework')}
              >
                <div className="tc-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <div className="tc-content">
                  <span className="tc-title">Complete Coursework Portion</span>
                  <span className="tc-sub">
                    Finish syllabus chapters, clear backlogs, and build conceptual mastery systematically before school deadlines.
                  </span>
                </div>
                <span className="tc-radio" />
              </button>

              <button
                type="button"
                className={`track-card ${track === 'exam' ? 'selected' : ''}`}
                onClick={() => setTrack('exam')}
              >
                <div className="tc-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="tc-content">
                  <span className="tc-title">Prepare for Exams</span>
                  <span className="tc-sub">
                    High-yield revision countdown for CBSE Boards, JEE, NEET, or school finals with formula drilling and mock tests.
                  </span>
                </div>
                <span className="tc-radio" />
              </button>

              <button
                type="button"
                className={`track-card ${track === 'page_by_page' ? 'selected' : ''}`}
                onClick={() => setTrack('page_by_page')}
              >
                <div className="tc-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    <line x1="6" y1="8" x2="8" y2="8" />
                    <line x1="6" y1="12" x2="8" y2="12" />
                  </svg>
                </div>
                <div className="tc-content">
                  <span className="tc-title">Textbook Page-by-Page Guided Mastery</span>
                  <span className="tc-sub">
                    Learn chapter line-by-line with authentic textbook page scans rendered directly in chat and step-by-step teacher guidance.
                  </span>
                </div>
                <span className="tc-radio" />
              </button>

              <button
                type="button"
                className={`track-card ${track === 'research' ? 'selected' : ''}`}
                onClick={() => setTrack('research')}
              >
                <div className="tc-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 2v7.31M14 2v7.31M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0" />
                    <path d="M5.52 16h12.96" />
                  </svg>
                </div>
                <div className="tc-content">
                  <span className="tc-title">Academic &amp; STEM Research</span>
                  <span className="tc-sub">
                    Investigate scientific hypotheses, conduct literature reviews, and structure discovery projects with milestone checkpoints.
                  </span>
                </div>
                <span className="tc-radio" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Dynamic Question Matrix */}
        {step === 2 && (
          <div className="tw-body">
            {generationClarificationError && (
              <div className="tw-context-warning" style={{ marginBottom: '1.25rem' }}>
                <span className="tw-cw-icon">!</span>
                <div className="tw-cw-text">
                  <strong>Clarification Required</strong>
                  <p>{generationClarificationError}</p>
                </div>
              </div>
            )}

            {track !== 'research' && (
              <div className="tw-locked-profile-badge">
                <div className="tw-locked-profile-info">
                  <span className="tw-profile-icon">🎓</span>
                  <div>
                    <span className="tw-profile-label">Student Curriculum Profile</span>
                    <strong className="tw-profile-val">
                      {resolvedBoardDisplay} • Class {resolvedGrade}
                    </strong>
                  </div>
                </div>
                {onEditProfile && (
                  <button
                    type="button"
                    className="tw-edit-profile-btn"
                    onClick={onEditProfile}
                    title="Change Education Board or Grade in Student Profile"
                  >
                    ✏️ Edit Profile
                  </button>
                )}
              </div>
            )}

            {track === 'coursework' && (
              <div className="tw-form-fields">
                <div className="tw-field-row">
                  <label className="tw-label">
                    Subject
                    <select
                      className="tw-input"
                      value={cwSubject}
                      onChange={(e) => setCwSubject(e.target.value)}
                    >
                      {cwSubjectsList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__custom__">Other / Custom Subject…</option>
                    </select>
                    {cwSubject === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="Type your custom subject (e.g. Psychology, Biotechnology)…"
                        value={customCwSubject}
                        autoFocus
                        onChange={(e) => setCustomCwSubject(e.target.value)}
                      />
                    )}
                  </label>

                  <label className="tw-label">
                    Target Completion Date
                    <input
                      type="date"
                      className="tw-input"
                      value={cwDeadline}
                      onChange={(e) => setCwDeadline(e.target.value)}
                    />
                    {cwDeadline && (
                      <div className={`tw-duration-badge ${formatDurationBadge(cwDaysRemaining).isWarning ? 'warning' : 'info'}`}>
                        {formatDurationBadge(cwDaysRemaining).text}
                      </div>
                    )}
                  </label>
                </div>

                <label className="tw-label">
                  Full Syllabus / Units Covered <span className="tw-required">*</span>
                  <textarea
                    className="tw-textarea"
                    rows={3}
                    placeholder="e.g. NCERT Class 12 Physics: Electrostatics, Current Electricity, and Magnetism (Chapters 1 to 4)"
                    value={cwPortion}
                    onChange={(e) => setCwPortion(e.target.value)}
                  />
                  <span className="tw-sub-hint">List all chapters, units, or modules included in your coursework.</span>
                </label>

                <label className="tw-label">
                  Priority Focus Chapters or Difficult Areas <span className="tw-optional">(Optional)</span>
                  <textarea
                    className="tw-textarea"
                    rows={2}
                    placeholder="Which chapters or topics from the syllabus need the most attention or deep-dive practice?"
                    value={cwPriorityFocus}
                    onChange={(e) => setCwPriorityFocus(e.target.value)}
                  />
                </label>

                <div className="tw-field-row">
                  <label className="tw-label">
                    Daily Study Commitment
                    <select
                      className="tw-input"
                      value={cwDailyHours}
                      onChange={(e) => setCwDailyHours(e.target.value)}
                    >
                      <option value="1 hour/day">1 hour/day (Steady pace)</option>
                      <option value="2 hours/day">2 hours/day (Recommended)</option>
                      <option value="3+ hours/day">3+ hours/day (Intensive catch-up)</option>
                      <option value="4-6 hours/day">4-6 hours/day (Full-time sprint)</option>
                      <option value="__custom__">Other / Custom Commitment…</option>
                    </select>
                    {cwDailyHours === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="e.g. 45 mins/day, 4 hours on weekends, 3.5 hrs/day…"
                        value={customCwDailyHours}
                        autoFocus
                        onChange={(e) => setCustomCwDailyHours(e.target.value)}
                      />
                    )}
                  </label>

                  <label className="tw-label">
                    Learning Depth Preference
                    <select
                      className="tw-input"
                      value={cwDepth}
                      onChange={(e) => setCwDepth(e.target.value)}
                    >
                      <option value="Step-by-step conceptual mastery">Step-by-step conceptual mastery</option>
                      <option value="Problem practice and numerical focus">Problem practice and numerical focus</option>
                      <option value="High-speed revision and summary">High-speed revision and summary</option>
                      <option value="Past 10-Year PYQs & Board Marking Scheme">Past 10-Year PYQs &amp; Marking Scheme</option>
                      <option value="__custom__">Other / Custom Preference…</option>
                    </select>
                    {cwDepth === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="Describe your learning style (e.g. Formula derivations only)…"
                        value={customCwDepth}
                        autoFocus
                        onChange={(e) => setCustomCwDepth(e.target.value)}
                      />
                    )}
                  </label>
                </div>
              </div>
            )}

            {track === 'exam' && (
              <div className="tw-form-fields">
                <div className="tw-field-row">
                  <label className="tw-label">
                    Target Exam / Milestone <span className="tw-required">*</span>
                    <select
                      className="tw-input"
                      value={examPreset}
                      onChange={(e) => handleExamPresetChange(e.target.value)}
                    >
                      {targetExamOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="__custom__">Other / Custom Exam…</option>
                    </select>
                    {examPreset === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        value={customExamName}
                        placeholder="Type exam name (e.g. SAT, AP Physics, BITSAT)…"
                        autoFocus
                        onChange={(e) => setCustomExamName(e.target.value)}
                      />
                    )}
                  </label>

                  <label className="tw-label">
                    Subject <span className="tw-required">*</span>
                    <select
                      className="tw-input"
                      value={examSubject}
                      onChange={(e) => setExamSubject(e.target.value)}
                    >
                      {examSubjectsList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__custom__">Other / Custom Subject…</option>
                    </select>
                    {examSubject === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="Type custom subject name (e.g. Accountancy, Statistics)…"
                        value={customExamSubject}
                        autoFocus
                        onChange={(e) => setCustomExamSubject(e.target.value)}
                      />
                    )}
                  </label>
                </div>

                <div className="tw-field-row">
                  <label className="tw-label">
                    Exam Date <span className="tw-required">*</span>
                    <input
                      type="date"
                      className="tw-input"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                    />
                    {examDate && (
                      <div className={`tw-duration-badge ${formatDurationBadge(examDaysRemaining).isWarning ? 'warning' : 'info'}`}>
                        {formatDurationBadge(examDaysRemaining).text}
                      </div>
                    )}
                  </label>

                  <label className="tw-label">
                    Target Score or Percentile Benchmark
                    <input
                      type="text"
                      className="tw-input"
                      value={targetScore}
                      placeholder="e.g. 95%+ in Boards or 99+ Percentile in JEE"
                      onChange={(e) => setTargetScore(e.target.value)}
                    />
                  </label>
                </div>

                {isUrgentExam && (
                  <div className="tw-urgent-time-row">
                    <div className="tw-urgent-callout">
                      <div className="tw-urgent-callout-header">
                        <span className="tw-urgent-pill">Urgent Sprint ({examDaysRemaining === 0 ? 'Today' : `${examDaysRemaining} ${examDaysRemaining === 1 ? 'day' : 'days'} left`})</span>
                        <span className="tw-urgent-callout-title">Exam Paper Timing &amp; Hourly Breakdown</span>
                      </div>
                      <p className="tw-urgent-callout-text">
                        Because your exam is {examDaysRemaining === 0 ? 'today' : `in ${examDaysRemaining} ${examDaysRemaining === 1 ? 'day' : 'days'}`}, Tark will calibrate an hourly countdown schedule with focused revision blocks leading directly up to your exam start time.
                      </p>
                      <label className="tw-label" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                        Exam Paper Start Time <span className="tw-required">*</span>
                        <input
                          type="time"
                          className="tw-input tw-time-input"
                          value={examTime}
                          onChange={(e) => setExamTime(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <label className="tw-label">
                  Full Exam Syllabus / Chapters Covered <span className="tw-required">*</span>
                  <textarea
                    className="tw-textarea"
                    rows={3}
                    placeholder={
                      isCustomExam
                        ? "e.g. Ch 1: Kinematics, Ch 2: Newton's Laws, Ch 3: Work & Energy, Ch 4: Rotational Motion"
                        : `e.g. Chapters 1 to 5, or Chapter names (Ch 1, 2, 3... Tark will resolve the official ${effectiveExamSubject} chapter titles for you)`
                    }
                    value={examSyllabus}
                    onChange={(e) => {
                      setExamSyllabus(e.target.value)
                      if (generationClarificationError) setGenerationClarificationError(null)
                    }}
                  />
                  <span className="tw-sub-hint">
                    {isCustomExam ? (
                      missingChapterContext ? (
                        <span className="tw-hint-warning">
                          For custom exams, please specify chapter names or topics (e.g. 'Ch 1: Optics, Ch 2: Thermodynamics') so Tark has proper context.
                        </span>
                      ) : (
                        "Specify the chapter names or topics included in your syllabus."
                      )
                    ) : (
                      `Tip: You can provide chapter names or chapter numbers (e.g. 'ch 1, 2, 3'). Tark knows your board's ${effectiveExamSubject} syllabus and will confirm the chapter titles for you.`
                    )}
                  </span>
                </label>

                {missingChapterContext && (
                  <div className="tw-context-warning">
                    <span className="tw-cw-icon">!</span>
                    <div className="tw-cw-text">
                      <strong>Chapter Names Needed for Custom Exam</strong>
                      <p>
                        Because this is a custom exam, Tark doesn't have an inbuilt textbook syllabus for it.
                        Please specify the names or topics of these {effectiveExamSubject} chapters (e.g., <em>Ch 1: Electric Current, Ch 2: Optics</em>) so your roadmap can be accurately generated.
                      </p>
                    </div>
                  </div>
                )}

                <label className="tw-label">
                  Priority Focus Chapters or Weak Areas <span className="tw-optional">(Optional)</span>
                  <textarea
                    className="tw-textarea"
                    rows={2}
                    placeholder="Which specific chapters or topics from the syllabus above do you struggle with or want to prioritize? (e.g. Numerical derivations, difficult word problems)"
                    value={examPriorityFocus}
                    onChange={(e) => setExamPriorityFocus(e.target.value)}
                  />
                  <span className="tw-sub-hint">
                    Tark will allocate extra review time and deep-dive problem sets for these topics.
                  </span>
                </label>

                <div className="tw-field-row">
                  <label className="tw-label">
                    Daily Study Commitment
                    <select
                      className="tw-input"
                      value={examDailyHours}
                      onChange={(e) => setExamDailyHours(e.target.value)}
                    >
                      <option value="1-2 hours/day">1-2 hours/day (Consistent review)</option>
                      <option value="3-4 hours/day">3-4 hours/day (Dedicated exam prep)</option>
                      <option value="5+ hours/day">5+ hours/day (Intensive exam sprint)</option>
                      <option value="__custom__">Other / Custom Hours…</option>
                    </select>
                    {examDailyHours === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="e.g. 2 hours on weekdays, 6 hours on weekends…"
                        value={customExamDailyHours}
                        autoFocus
                        onChange={(e) => setCustomExamDailyHours(e.target.value)}
                      />
                    )}
                  </label>

                  <label className="tw-label">
                    Exam Prep Strategy
                    <select
                      className="tw-input"
                      value={examDepth}
                      onChange={(e) => setExamDepth(e.target.value)}
                    >
                      <option value="High-yield formula revision & PYQs">High-yield formula revision &amp; PYQs</option>
                      <option value="Comprehensive chapter-by-chapter problem sets">Comprehensive chapter-by-chapter drill</option>
                      <option value="Mock test series & error log review">Mock test series &amp; error analysis</option>
                      <option value="__custom__">Other / Custom Strategy…</option>
                    </select>
                    {examDepth === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="Describe focus (e.g. Speed arithmetic & tricky options)…"
                        value={customExamDepth}
                        autoFocus
                        onChange={(e) => setCustomExamDepth(e.target.value)}
                      />
                    )}
                  </label>
                </div>

                <label className="tw-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeMocks}
                    onChange={(e) => setIncludeMocks(e.target.checked)}
                  />
                  <span>Schedule full-length mock tests and formula revision cycles</span>
                </label>

                <label className="tw-checkbox-label">
                  <input
                    type="checkbox"
                    checked={dailySpacedRepetition}
                    onChange={(e) => setDailySpacedRepetition(e.target.checked)}
                  />
                  <span>Include Daily 3-Question Spaced Repetition Workouts (Active Memory Recall)</span>
                </label>
              </div>
            )}

            {track === 'research' && (
              <div className="tw-form-fields">
                <div className="tw-field-row">
                  <label className="tw-label">
                    Scientific / Research Discipline
                    <select
                      className="tw-input"
                      value={resDomain}
                      onChange={(e) => setResDomain(e.target.value)}
                    >
                      <option value="Applied Physics & Nanotechnology">Applied Physics &amp; Nanotechnology</option>
                      <option value="Quantum Computing & Information">Quantum Computing &amp; Information</option>
                      <option value="Molecular Dynamics & Biochemistry">Molecular Dynamics &amp; Biochemistry</option>
                      <option value="Machine Learning & Theoretical CS">Machine Learning &amp; Theoretical CS</option>
                      <option value="Astrophysics & Cosmology">Astrophysics &amp; Cosmology</option>
                      <option value="__custom__">Other / Custom Discipline…</option>
                    </select>
                    {resDomain === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="Type research domain (e.g. Marine Robotics, Neurobiology)…"
                        value={customResDomain}
                        autoFocus
                        onChange={(e) => setCustomResDomain(e.target.value)}
                      />
                    )}
                  </label>

                  <label className="tw-label">
                    Project Duration
                    <select
                      className="tw-input"
                      value={resTimeline}
                      onChange={(e) => setResTimeline(e.target.value)}
                    >
                      <option value="2 weeks">2 weeks (Sprint)</option>
                      <option value="4 weeks">4 weeks (Comprehensive)</option>
                      <option value="8 weeks">8 weeks (Deep investigation)</option>
                      <option value="12 weeks">12 weeks (Semester thesis)</option>
                      <option value="__custom__">Other / Custom Duration…</option>
                    </select>
                    {resTimeline === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="e.g. 10 days, 3 weeks, 6 months…"
                        value={customResTimeline}
                        autoFocus
                        onChange={(e) => setCustomResTimeline(e.target.value)}
                      />
                    )}
                  </label>
                </div>

                <label className="tw-label">
                  Core Research Problem, Hypothesis, or Question
                  <textarea
                    className="tw-textarea"
                    rows={3}
                    placeholder="e.g. How do superconducting qubit decoherence rates scale under dynamic error mitigation protocols?"
                    value={resQuestion}
                    onChange={(e) => setResQuestion(e.target.value)}
                  />
                </label>

                <label className="tw-label">
                  Target Deliverable / Outcome
                  <select
                    className="tw-input"
                    value={resOutcome}
                    onChange={(e) => setResOutcome(e.target.value)}
                  >
                    <option value="Literature Review & Synthesis Document">Literature Review &amp; Synthesis Document</option>
                    <option value="Experimental Methodology Blueprint">Experimental Methodology Blueprint</option>
                    <option value="Theoretical Proof & Mathematical Derivation">Theoretical Proof &amp; Mathematical Derivation</option>
                    <option value="Research Paper Draft / Preprint">Research Paper Draft / Preprint</option>
                    <option value="__custom__">Other / Custom Deliverable…</option>
                  </select>
                  {resOutcome === '__custom__' && (
                    <input
                      type="text"
                      className="tw-input tw-custom-input"
                      placeholder="e.g. Working simulation prototype, Patent draft…"
                      value={customResOutcome}
                      autoFocus
                      onChange={(e) => setCustomResOutcome(e.target.value)}
                    />
                  )}
                </label>
              </div>
            )}

            {track === 'page_by_page' && (
              <div className="tw-form-fields">


                <div className="tw-field-row">
                  <label className="tw-label">
                    Subject <span className="tw-required">*</span>
                    <select
                      className="tw-input"
                      value={pbpSubject}
                      onChange={(e) => setPbpSubject(e.target.value)}
                    >
                      {pbpSubjectsList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__custom__">Other / Custom Subject…</option>
                    </select>
                    {pbpSubject === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="Type custom subject name…"
                        value={customPbpSubject}
                        autoFocus
                        onChange={(e) => setCustomPbpSubject(e.target.value)}
                      />
                    )}
                  </label>
                </div>

                <div className="tw-chapters-selection-section" style={{ margin: '14px 0 10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="tw-label" style={{ margin: 0 }}>
                      Select Chapter(s) <span className="tw-required">*</span>
                    </label>
                    {availableChapters.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="tw-btn-text"
                          style={{ fontSize: '11px', color: 'var(--accent, #3b82f6)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontWeight: 600 }}
                          onClick={selectAllChapters}
                        >
                          ✓ Select All ({availableChapters.length})
                        </button>
                        <span style={{ color: 'var(--muted)', fontSize: '11px' }}>•</span>
                        <button
                          type="button"
                          className="tw-btn-text"
                          style={{ fontSize: '11px', color: 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                          onClick={clearChapterSelection}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {loadingChapters ? (
                    <div className="tw-input tw-loading-input" style={{ opacity: 0.7 }}>Loading official textbook chapters…</div>
                  ) : availableChapters.length > 0 ? (
                    <div className="tw-chapters-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '8px',
                      maxHeight: '210px',
                      overflowY: 'auto',
                      padding: '8px',
                      background: 'var(--surface-alt, rgba(0,0,0,0.02))',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      marginBottom: '10px'
                    }}>
                      {availableChapters.map((c, i) => {
                        const isSelected = selectedChaptersList.includes(c.chapter)
                        const pageCount = c.end_page && c.start_page ? (c.end_page - c.start_page + 1) : 0
                        return (
                          <div
                            key={i}
                            onClick={() => toggleChapterSelection(c.chapter)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface, #ffffff)',
                              border: `1px solid ${isSelected ? 'var(--accent, #3b82f6)' : 'var(--border)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--accent, #3b82f6)' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12.5px', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--accent, #3b82f6)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.chapter}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                Pages {c.start_page}–{c.end_page} {pageCount > 0 ? `(${pageCount} pages)` : ''}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}

                  <div>
                    <input
                      type="text"
                      className="tw-input"
                      placeholder="Or type custom chapter(s) (e.g. Chapter 1, 2, 3 or Force and Moments)…"
                      value={customPbpChapter || (pbpChapter === '__custom__' ? '' : pbpChapter)}
                      onChange={(e) => {
                        setPbpChapter(e.target.value)
                        setCustomPbpChapter(e.target.value)
                      }}
                    />
                  </div>
                </div>

                <div className="tw-field-row">
                  <label className="tw-label">
                    Start Page
                    <input
                      type="number"
                      min={1}
                      className="tw-input"
                      value={pbpStartPage}
                      placeholder="e.g. 1"
                      onChange={(e) => setPbpStartPage(e.target.value ? Number(e.target.value) : '')}
                    />
                  </label>

                  <label className="tw-label">
                    End Page (Whole Chapter / Custom)
                    <input
                      type="number"
                      min={pbpStartPage ? Number(pbpStartPage) : 1}
                      className="tw-input"
                      value={pbpEndPage}
                      placeholder="e.g. 10"
                      onChange={(e) => setPbpEndPage(e.target.value ? Number(e.target.value) : '')}
                    />
                  </label>

                  <label className="tw-label">
                    Pacing Strategy
                    <select
                      className="tw-input"
                      value={pbpPacing}
                      onChange={(e) => setPbpPacing(e.target.value)}
                    >
                      <option value="1 page per session (Deep Line-by-Line Mastery)">1 page per session (Deep Line-by-Line Mastery)</option>
                      <option value="2 pages per session">2 pages per session</option>
                      <option value="3-4 pages per session (Accelerated Sprint)">3-4 pages per session (Accelerated Sprint)</option>
                      <option value="__custom__">Other / Custom Pacing…</option>
                    </select>
                    {pbpPacing === '__custom__' && (
                      <input
                        type="text"
                        className="tw-input tw-custom-input"
                        placeholder="e.g. 5 pages per weekend, 1 page every 2 days…"
                        value={customPbpPacing}
                        autoFocus
                        onChange={(e) => setCustomPbpPacing(e.target.value)}
                      />
                    )}
                  </label>
                </div>

                {selectedChaptersList.length > 1 ? (
                  <div className="tw-multi-chapter-badge" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    margin: '4px 0 12px 0',
                    fontSize: '12.5px',
                    color: 'var(--accent, #3b82f6)',
                    fontWeight: 600,
                  }}>
                    <span>📚</span>
                    <span>{selectedChaptersList.length} Chapters Selected for Sequential Page-by-Page Guided Mastery</span>
                  </div>
                ) : (
                  <div className="tw-page-presets" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '4px 0 12px 0' }}>
                    {(() => {
                      const found = availableChapters.find((c) => c.chapter === (selectedChaptersList[0] || pbpChapter))
                      const chStart = found?.start_page || (pbpStartPage ? Number(pbpStartPage) : 1)
                      const chEnd = found?.end_page || (chStart + 7)
                      return (
                        <>
                          <button
                            type="button"
                            className="tw-chip-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              borderRadius: '16px',
                              border: '1px solid var(--border)',
                              background: pbpStartPage === chStart && pbpEndPage === chEnd ? 'var(--accent, #3b82f6)' : 'var(--surface-alt, rgba(0,0,0,0.04))',
                              color: pbpStartPage === chStart && pbpEndPage === chEnd ? '#fff' : 'var(--text)',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setPbpStartPage(chStart)
                              setPbpEndPage(chEnd)
                            }}
                          >
                            📖 Entire Chapter (Pages {chStart}–{chEnd})
                          </button>
                          <button
                            type="button"
                            className="tw-chip-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              borderRadius: '16px',
                              border: '1px solid var(--border)',
                              background: pbpStartPage === chStart && pbpEndPage === (chStart + 2) ? 'var(--accent, #3b82f6)' : 'var(--surface-alt, rgba(0,0,0,0.04))',
                              color: pbpStartPage === chStart && pbpEndPage === (chStart + 2) ? '#fff' : 'var(--text)',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setPbpStartPage(chStart)
                              setPbpEndPage(chStart + 2)
                            }}
                          >
                            ⚡ First 3 Pages (Intro Sprint)
                          </button>
                          <button
                            type="button"
                            className="tw-chip-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              borderRadius: '16px',
                              border: '1px solid var(--border)',
                              background: pbpStartPage === chStart && pbpEndPage === (chStart + 4) ? 'var(--accent, #3b82f6)' : 'var(--surface-alt, rgba(0,0,0,0.04))',
                              color: pbpStartPage === chStart && pbpEndPage === (chStart + 4) ? '#fff' : 'var(--text)',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setPbpStartPage(chStart)
                              setPbpEndPage(chStart + 4)
                            }}
                          >
                            🎯 First 5 Pages
                          </button>
                        </>
                      )
                    })()}
                  </div>
                )}

                {selectedSource && (
                  <div className="tw-chapter-confirmation-card" style={{ marginTop: '0.5rem' }}>
                    <span className="tw-cc-icon">&#128214;</span>
                    <div className="tw-cc-content">
                      <span className="tw-cc-title">Official Textbook Scan Available</span>
                      <p className="tw-cc-desc">
                        Matched: <strong>{selectedSource}</strong>. Tark will render and display high-definition page scans directly inside each study session.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: AI Roadmap Review */}
        {step === 3 && (
          <div className="tw-body">
            {generating ? (
              <div className="tw-loading-state">
                <span className="tw-spinner" />
                <p className="tw-loading-title">Synthesizing personalized study roadmap…</p>
                <p className="tw-loading-sub">
                  Calibrating milestone checkpoints, formula drilling, and syllabus pacing with Tark AI.
                </p>
              </div>
            ) : (
              <div className="tw-plan-preview">
                <div className="plan-summary-card">
                  <h3 className="plan-title">{generatedTitle}</h3>
                  {generatedSummary && <p className="plan-sub">{generatedSummary}</p>}
                </div>

                {generatedChapterConfirmation && (
                  <div className="tw-chapter-confirmation-card">
                    <span className="tw-cc-icon">&#10003;</span>
                    <div className="tw-cc-content">
                      <span className="tw-cc-title">Syllabus &amp; Chapter Confirmation</span>
                      <p className="tw-cc-desc">{generatedChapterConfirmation}</p>
                    </div>
                  </div>
                )}

                <div className="milestones-timeline">
                  <span className="mt-header">Generated Milestones ({milestones.length})</span>
                  {milestones.map((m, idx) => (
                    <div key={m.id || idx} className="milestone-card">
                      <div className="mc-left">
                        <span className="mc-number">{idx + 1}</span>
                        <div className="mc-details">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="mc-title">{m.title}</span>
                            {m.page_number && (
                              <span className="tw-badge" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                Page {m.page_number} Scan
                              </span>
                            )}
                          </div>
                          {m.notes && <p className="mc-notes">{m.notes}</p>}
                        </div>
                      </div>
                      <div className="mc-right">
                        {m.target_date && <span className="mc-date-tag">{m.target_date}</span>}
                        {onStartLearning && (
                          <button
                            type="button"
                            className="mc-study-preview-btn"
                            title="Start dedicated study chat for this milestone"
                            onClick={() => handleSave(true, idx)}
                            disabled={saving}
                          >
                            Study Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="task-wizard-footer">
          {step > 1 && !generating && (
            <button
              type="button"
              className="tw-btn-secondary"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
            >
              Back
            </button>
          )}

          <div className="tw-foot-right">
            <button type="button" className="tw-btn-ghost" onClick={onClose}>
              Cancel
            </button>

            {step === 1 && (
              <button
                type="button"
                className="tw-btn-primary"
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            )}

            {step === 2 && (
              <div className="tw-step2-actions-wrap">
                {!isFormValid && (
                  <div className="tw-validation-banner">
                    Required: {validationErrors.join(', ')}
                  </div>
                )}
                <button
                  type="button"
                  className="tw-btn-primary"
                  disabled={!isFormValid || generating}
                  onClick={handleGenerate}
                >
                  Generate Study Schedule
                </button>
              </div>
            )}

            {step === 3 && !generating && (
              <div className="tw-step3-actions">
                <button
                  type="button"
                  className="tw-btn-secondary"
                  disabled={saving || milestones.length === 0}
                  onClick={() => handleSave(false)}
                >
                  Save &amp; View Plan
                </button>
                <button
                  type="button"
                  className="tw-btn-primary"
                  disabled={saving || milestones.length === 0}
                  onClick={() => handleSave(true)}
                >
                  {saving ? 'Activating…' : 'Start Learning Now'}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

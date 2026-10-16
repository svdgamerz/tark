import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { fetchCurriculum, type CurriculumItem } from '../api'
import { CustomSelect, type SelectOption } from './CustomSelect'
import { FocusAreaSelector } from './FocusAreaSelector'

interface Props {
  onClose: () => void
  onSuccess?: (profileData: { board: string; grade: string; exam?: string; school?: string }) => void
  isMandatory?: boolean
}

const GRADES_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Class ${i + 1}`,
  description: i >= 10 ? 'Senior Secondary' : i >= 8 ? 'Secondary' : 'Primary & Middle School',
}))

export const EXAM_TARGETS = [
  { id: 'boards', label: 'CBSE & State Board Examinations', desc: 'Standard board syllabus alignment, NCERT exercises, and structured scoring' },
  { id: 'jee', label: 'JEE Main & Advanced', desc: 'Engineering entrance — conceptual depth, rigorous multi-step derivations, and problem solving' },
  { id: 'neet', label: 'NEET UG (Medical)', desc: 'Medical entrance — NCERT precision, biological mechanisms, and speed numericals' },
  { id: 'olympiad', label: 'Olympiads & NTSE', desc: 'Advanced analytical problem sets, brain teasers, and higher-order thinking' },
  { id: 'foundation', label: 'School Foundation', desc: 'Fundamental concept building, homework assistance, and core curriculum clarity' },
]

export const TUTORING_STYLES = [
  {
    id: 'socratic_step_by_step',
    label: 'Step-by-Step Socratic Coach',
    desc: 'Never dumps full answers. Guides one micro-step at a time with hints, questions, and checks.',
    badge: 'Recommended',
  },
  {
    id: 'step_by_step',
    label: 'Step-by-Step Breakdown',
    desc: 'Systematic derivations, relevant formulas, and clearly numbered calculation stages.',
    badge: 'Standard',
  },
  {
    id: 'teach_acharya',
    label: 'Teach Tark (Feynman Mode)',
    desc: 'You explain the concept to Tark; Tark spots gaps, asks questions, and grades your mastery.',
    badge: 'Feynman Active',
  },
  {
    id: 'socratic',
    label: 'Socratic Inquiry',
    desc: 'Guides through inquiry, hints, and reflective questions before presenting the final conclusion.',
    badge: 'Inquiry',
  },
  {
    id: 'quick_direct',
    label: 'Concise & Direct',
    desc: 'High-yield bullet points, core formulas, and structured summaries without preamble.',
    badge: 'High-Yield',
  },
  {
    id: 'analogies_eli5',
    label: 'Conceptual Analogies',
    desc: 'Intuitive mental models, real-world physical parallels, and plain-language intuition.',
    badge: 'Intuitive',
  },
]

export const LANGUAGES = [
  { id: 'english', label: 'English (Academic)', desc: 'Standard formal terminology and academic prose' },
  { id: 'hinglish', label: 'Hinglish (Bilingual)', desc: 'Conversational Indian student explanation with standard English scientific terms' },
  { id: 'hindi', label: 'Hindi (हिन्दी)', desc: 'सरल हिन्दी में व्याख्या, साथ में मानक तकनीकी शब्दावली' },
  { id: 'marathi', label: 'Marathi (मराठी)', desc: 'सुलभ मराठीत स्पष्टीकरण, आवश्यक तांत्रिक संज्ञांसह' },
]

type QuestionStep = 1 | 2 | 3 | 4 | 5

export function ProfileSetupModal({ onClose, onSuccess, isMandatory = false }: Props) {
  const { user, updateProfile } = useAuth()
  const [currentStep, setCurrentStep] = useState<QuestionStep>(1)

  const [boards, setBoards] = useState<string[]>([])
  // For existing users with configured profile, use their values; for new users, leave unselected or default gracefully
  const [board, setBoard] = useState(user?.board ?? '')
  const [grade, setGrade] = useState(user?.grade ?? '')
  const [school, setSchool] = useState(user?.school ?? '')
  const [exam, setExam] = useState(user?.exam ?? 'boards')
  const [tutoringStyle, setTutoringStyle] = useState(user?.tutoring_style ?? 'socratic_step_by_step')
  const [language, setLanguage] = useState(user?.language ?? 'english')

  const [weakTopics, setWeakTopics] = useState<string[]>(() => {
    try {
      const raw = user?.weak_subjects
      if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {}
    return ['Calculus & Integrals', 'Mechanics & Laws of Motion']
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCurriculum().then((items: CurriculumItem[]) => {
      const distinct = Array.from(new Set(items.map((i) => i.board))).filter(Boolean)
      if (distinct.length > 0) setBoards(distinct)
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSkip() {
    sessionStorage.setItem('tark_profile_skipped', '1')
    localStorage.setItem('tark_profile_snoozed_at', String(Date.now()))
    onClose()
  }

  function toggleWeakTopic(topic: string) {
    setWeakTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    )
  }

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault()

    const resolvedBoard = board || 'CBSE'
    const resolvedGrade = grade || '10'

    setError('')
    setSaving(true)

    localStorage.setItem('tark_board', resolvedBoard)
    localStorage.setItem('tark_grade', resolvedGrade)
    localStorage.setItem('tark_school', school)
    localStorage.setItem('tark_target_exam', exam)
    localStorage.setItem('tark_tutoring_style', tutoringStyle)
    localStorage.setItem('tark_language_pref', language)
    localStorage.setItem('tark_weak_subjects', JSON.stringify(weakTopics))
    localStorage.setItem('tark_profile_completed', '1')
    sessionStorage.removeItem('tark_profile_skipped')

    if (user) {
      const res = await updateProfile({
        board: resolvedBoard,
        grade: resolvedGrade,
        school: school.trim() || undefined,
        exam: exam || undefined,
        tutoring_style: tutoringStyle || undefined,
        language: language || undefined,
        weak_subjects: JSON.stringify(weakTopics),
      })

      if (res.error) {
        setError(res.error)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    if (onSuccess) {
      onSuccess({ board: resolvedBoard, grade: resolvedGrade, exam, school })
    } else {
      onClose()
    }
  }

  const boardOptions: SelectOption[] = [
    { value: 'CBSE', label: 'CBSE (NCERT)', description: 'Central Board of Secondary Education' },
    { value: 'ICSE', label: 'ICSE / CISCE', description: 'Council for the Indian School Certificate Examinations' },
    { value: 'Maharashtra State Board', label: 'Maharashtra State Board', description: 'State Board Secondary & Higher Secondary' },
    ...boards
      .filter((b) => !['CBSE', 'ICSE', 'Maharashtra State Board'].includes(b))
      .map((b) => ({ value: b, label: b, description: 'Curriculum Textbook Grounding' })),
    { value: 'General', label: 'Other / General Curriculum', description: 'Standard National Framework' },
  ]

  const questionTitles: Record<QuestionStep, { q: string; sub: string }> = {
    1: {
      q: 'Which education board and class are you studying in?',
      sub: 'Tark will ground chapter exercises, NCERT solutions, and 3D simulations in your official curriculum.',
    },
    2: {
      q: 'What is your primary academic goal or target exam?',
      sub: 'This tunes the conceptual depth, multi-step problem rigor, and exam-specific derivations.',
    },
    3: {
      q: 'Which topics or subjects would you like extra guidance on?',
      sub: 'Tark will provide extra foundational steps, checks, and derivations when teaching these focus areas.',
    },
    4: {
      q: 'How would you like Tark to teach you?',
      sub: 'Choose the explanation methodology that matches your preferred learning pace.',
    },
    5: {
      q: 'What language do you prefer for your explanations?',
      sub: 'Select the primary language in which Tark communicates mathematical and scientific ideas.',
    },
  }

  return (
    <div className="modal-overlay" onClick={handleSkip} role="dialog" aria-modal="true">
      <div className="profile-setup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="profile-setup-header">
          <div className="profile-setup-badge">
            {isMandatory ? '🎓 Student Profile Setup' : '✨ Tark AI Personalized Setup'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="skip-btn"
              onClick={handleSkip}
              title="Skip setup for now and start learning"
              style={{ fontWeight: 600, color: 'var(--accent, #6366f1)', fontSize: 13 }}
            >
              Skip for now ➔
            </button>
            <button className="icon-btn close-btn" onClick={handleSkip} aria-label="Close modal" title="Close (Esc)">
              ✕
            </button>
          </div>
        </div>

        <div className="profile-setup-body">
          {/* Progress Indicators & Step Counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Question {currentStep} of 5
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  onClick={() => setCurrentStep(s as QuestionStep)}
                  style={{
                    width: s === currentStep ? 24 : 8,
                    height: 8,
                    borderRadius: 999,
                    background: s === currentStep ? 'var(--accent, #6366f1)' : s < currentStep ? 'var(--accent-soft, #c7d2fe)' : 'var(--border, #e2e8f0)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title={`Go to Question ${s}`}
                />
              ))}
            </div>
          </div>

          <h2 className="profile-setup-title" style={{ fontSize: 20, marginBottom: 4 }}>
            {questionTitles[currentStep].q}
          </h2>
          <p className="profile-setup-subtitle" style={{ fontSize: 13, marginBottom: 16 }}>
            {questionTitles[currentStep].sub}
          </p>

          <form onSubmit={handleSubmit} className="profile-setup-form">
            {/* QUESTION 1: Board & Class */}
            {currentStep === 1 && (
              <div className="tab-pane">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Education Board / Syllabus</label>
                    <CustomSelect
                      value={board || 'CBSE'}
                      options={boardOptions}
                      onChange={setBoard}
                      placeholder="Select your board…"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Grade / Academic Class</label>
                    <CustomSelect
                      value={grade || '10'}
                      options={GRADES_OPTIONS}
                      onChange={setGrade}
                      placeholder="Select your class…"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">
                    School / College Name <span className="optional-tag">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi Public School, Kendriya Vidyalaya…"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="profile-input"
                  />
                </div>
              </div>
            )}

            {/* QUESTION 2: Target Exam */}
            {currentStep === 2 && (
              <div className="tab-pane">
                <div className="form-group">
                  <label className="form-label">Select Your Academic Milestone</label>
                  <div className="profile-cards-grid">
                    {EXAM_TARGETS.map((item) => (
                      <div
                        key={item.id}
                        className={`profile-option-card ${exam === item.id ? 'selected' : ''}`}
                        onClick={() => setExam(item.id)}
                      >
                        <div className="option-card-header">
                          <div className="option-card-label">{item.label}</div>
                          {exam === item.id && (
                            <span className="check-indicator">Selected ✓</span>
                          )}
                        </div>
                        <div className="option-card-desc">{item.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* QUESTION 3: Focus Areas */}
            {currentStep === 3 && (
              <div className="tab-pane">
                <div className="form-group">
                  <label className="form-label">Select Topics for Extra Practice & Depth</label>
                  <FocusAreaSelector
                    selectedTopics={weakTopics}
                    onToggleTopic={toggleWeakTopic}
                    onClearAll={() => setWeakTopics([])}
                  />
                </div>
              </div>
            )}

            {/* QUESTION 4: Tutoring Style */}
            {currentStep === 4 && (
              <div className="tab-pane">
                <div className="form-group">
                  <label className="form-label">Select Tutoring & Explanation Style</label>
                  <div className="profile-cards-grid">
                    {TUTORING_STYLES.map((st) => (
                      <div
                        key={st.id}
                        className={`profile-option-card ${tutoringStyle === st.id ? 'selected' : ''}`}
                        onClick={() => setTutoringStyle(st.id)}
                      >
                        <div className="option-card-header">
                          <div className="option-card-label">{st.label}</div>
                          <span className="style-badge">{st.badge}</span>
                        </div>
                        <div className="option-card-desc">{st.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* QUESTION 5: Language */}
            {currentStep === 5 && (
              <div className="tab-pane">
                <div className="form-group">
                  <label className="form-label">Select Primary Explanation Language</label>
                  <div className="profile-cards-grid">
                    {LANGUAGES.map((lang) => (
                      <div
                        key={lang.id}
                        className={`profile-option-card ${language === lang.id ? 'selected' : ''}`}
                        onClick={() => setLanguage(lang.id)}
                      >
                        <div className="option-card-header">
                          <div className="option-card-label">{lang.label}</div>
                          {language === lang.id && (
                            <span className="check-indicator">Selected ✓</span>
                          )}
                        </div>
                        <div className="option-card-desc">{lang.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && <div className="modal-error">{error}</div>}

            <div className="profile-setup-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {currentStep > 1 && (
                  <button
                    type="button"
                    className="step-nav-btn prev"
                    onClick={() => setCurrentStep((s) => (s - 1) as QuestionStep)}
                  >
                    ← Previous
                  </button>
                )}
                <button
                  type="button"
                  className="skip-btn"
                  onClick={handleSkip}
                  title="Skip setup for now and start learning"
                >
                  Skip for now
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {currentStep < 5 ? (
                  <button
                    type="button"
                    className="save-profile-btn"
                    onClick={() => setCurrentStep((s) => (s + 1) as QuestionStep)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    Next Question ➔
                  </button>
                ) : (
                  <button
                    type="button"
                    className="save-profile-btn"
                    onClick={() => void handleSubmit()}
                    disabled={saving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {saving ? 'Saving Profile...' : 'Save & Start Learning 🎉'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

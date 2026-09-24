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
    id: 'step_by_step',
    label: 'Step-by-Step Breakdown',
    desc: 'Systematic derivations, relevant formulas, and clearly numbered calculation stages.',
    badge: 'Standard',
  },
  {
    id: 'socratic_step_by_step',
    label: 'Step-by-Step Socratic Coach',
    desc: 'Never dumps full answers. Guides one micro-step at a time with hints and checks.',
    badge: 'Socratic Coach',
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

type ProfileTab = 'exam' | 'weak_areas' | 'style' | 'language'

export function ProfileSetupModal({ onClose, onSuccess, isMandatory = false }: Props) {
  const { user, updateProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<ProfileTab>('exam')

  const [boards, setBoards] = useState<string[]>([])
  const [board, setBoard] = useState(user?.board ?? localStorage.getItem('tark_board') ?? 'CBSE')
  const [grade, setGrade] = useState(user?.grade ?? localStorage.getItem('tark_grade') ?? '10')
  const [school, setSchool] = useState(user?.school ?? localStorage.getItem('tark_school') ?? '')
  const [exam, setExam] = useState(user?.exam ?? localStorage.getItem('tark_target_exam') ?? 'boards')
  const [tutoringStyle, setTutoringStyle] = useState(
    user?.tutoring_style ?? localStorage.getItem('tark_tutoring_style') ?? 'step_by_step',
  )
  const [language, setLanguage] = useState(
    user?.language ?? localStorage.getItem('tark_language_pref') ?? 'english',
  )

  const [weakTopics, setWeakTopics] = useState<string[]>(() => {
    try {
      const raw = user?.weak_subjects || localStorage.getItem('tark_weak_subjects')
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
  }, [])

  function toggleWeakTopic(topic: string) {
    setWeakTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!board || !grade) {
      setError('Please select your Education Board and Class to personalize your curriculum.')
      setActiveTab('exam')
      return
    }

    setError('')
    setSaving(true)

    localStorage.setItem('tark_board', board)
    localStorage.setItem('tark_grade', grade)
    localStorage.setItem('tark_school', school)
    localStorage.setItem('tark_target_exam', exam)
    localStorage.setItem('tark_tutoring_style', tutoringStyle)
    localStorage.setItem('tark_language_pref', language)
    localStorage.setItem('tark_weak_subjects', JSON.stringify(weakTopics))
    localStorage.setItem('tark_profile_completed', '1')

    if (user) {
      const res = await updateProfile({
        board: board || undefined,
        grade: grade || undefined,
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
      onSuccess({ board, grade, exam, school })
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

  return (
    <div className="modal-overlay" onClick={() => { if (!isMandatory) onClose() }}>
      <div className="profile-setup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="profile-setup-header">
          <div className="profile-setup-badge">
            {isMandatory ? '🎓 Student Profile Required' : 'Profile Configuration'}
          </div>
          {!isMandatory && (
            <button className="icon-btn close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        <div className="profile-setup-body">
          <h2 className="profile-setup-title">
            {isMandatory ? 'Set Up Your Student Profile' : 'Personalize Student Profile'}
          </h2>
          <p className="profile-setup-subtitle">
            {isMandatory
              ? 'Select your Education Board and Grade so Tark can tailor your syllabus, exam milestones, and simulations accurately.'
              : 'Set your target examinations, focus areas, preferred explanation format, and language to receive tailored curriculum responses.'}
          </p>

          {/* Section Navigation Tabs */}
          <div className="profile-tabs-nav" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'exam'}
              className={`profile-tab-btn ${activeTab === 'exam' ? 'active' : ''}`}
              onClick={() => setActiveTab('exam')}
            >
              Target Exam
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'weak_areas'}
              className={`profile-tab-btn ${activeTab === 'weak_areas' ? 'active' : ''}`}
              onClick={() => setActiveTab('weak_areas')}
            >
              Focus Areas {weakTopics.length > 0 && <span className="tab-count">{weakTopics.length}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'style'}
              className={`profile-tab-btn ${activeTab === 'style' ? 'active' : ''}`}
              onClick={() => setActiveTab('style')}
            >
              Explanation Style
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'language'}
              className={`profile-tab-btn ${activeTab === 'language' ? 'active' : ''}`}
              onClick={() => setActiveTab('language')}
            >
              Language
            </button>
          </div>

          <form onSubmit={handleSubmit} className="profile-setup-form">
            {/* TAB 1: Target Exam & Academic Level */}
            {activeTab === 'exam' && (
              <div className="tab-pane">
                <div className="form-group">
                  <label className="form-label">Target Examination / Milestone</label>
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
                            <span className="check-indicator">Selected</span>
                          )}
                        </div>
                        <div className="option-card-desc">{item.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Education Board</label>
                    <CustomSelect
                      value={board}
                      options={boardOptions}
                      onChange={setBoard}
                      placeholder="Select board…"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Grade / Class</label>
                    <CustomSelect
                      value={grade}
                      options={GRADES_OPTIONS}
                      onChange={setGrade}
                      placeholder="Select class…"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Institution / School Name <span className="optional-tag">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter school name"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="profile-input"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: Focus Areas & Topics */}
            {activeTab === 'weak_areas' && (
              <div className="tab-pane">
                <div className="form-group">
                  <label className="form-label">Focus Areas Requiring Additional Guidance</label>
                  <p className="form-hint-desc">
                    Tark provides detailed foundational steps, conceptual checks, and derivations when explaining these areas.
                  </p>
                  <FocusAreaSelector
                    selectedTopics={weakTopics}
                    onToggleTopic={toggleWeakTopic}
                    onClearAll={() => setWeakTopics([])}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: Preferred Tutoring Style */}
            {activeTab === 'style' && (
              <div className="tab-pane">
                <div className="form-group">
                  <label className="form-label">Select Explanation Methodology</label>
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

            {/* TAB 4: Language & Medium */}
            {activeTab === 'language' && (
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
                            <span className="check-indicator">Selected</span>
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

            <div className="profile-setup-actions">
              <div className="tab-stepper-left">
                {activeTab !== 'exam' && (
                  <button
                    type="button"
                    className="step-nav-btn prev"
                    onClick={() => {
                      const tabs: ProfileTab[] = ['exam', 'weak_areas', 'style', 'language']
                      const idx = tabs.indexOf(activeTab)
                      if (idx > 0) setActiveTab(tabs[idx - 1])
                    }}
                  >
                    Previous
                  </button>
                )}
                {activeTab !== 'language' && (
                  <button
                    type="button"
                    className="step-nav-btn next"
                    onClick={() => {
                      const tabs: ProfileTab[] = ['exam', 'weak_areas', 'style', 'language']
                      const idx = tabs.indexOf(activeTab)
                      if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1])
                    }}
                  >
                    Next
                  </button>
                )}
              </div>

              <div className="action-buttons-right">
                {!isMandatory && (
                  <button
                    type="button"
                    className="skip-btn"
                    onClick={() => {
                      localStorage.setItem('tark_profile_snoozed_at', String(Date.now()))
                      onClose()
                    }}
                  >
                    Dismiss
                  </button>
                )}
                <button
                  type="submit"
                  className="save-profile-btn"
                  disabled={saving || !board || !grade}
                >
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth'
import type { ModelInfo } from '../api'
import {
  EXAM_TARGETS,
  TUTORING_STYLES,
  LANGUAGES,
} from './ProfileSetupModal'
import { CustomSelect, type SelectOption } from './CustomSelect'
import { FocusAreaSelector } from './FocusAreaSelector'

interface Props {
  boards: string[]
  models: ModelInfo[]
  modelId: string
  onModelChange: (id: string) => void
  onClose: () => void
}

type Tab = 'profile' | 'general' | 'learning' | 'voice' | 'account'

export function applyTheme(theme: string) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.setAttribute('data-theme', resolved)
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span className="switch-knob" />
    </button>
  )
}

function Row({
  label,
  sub,
  children,
}: {
  label: string
  sub?: string
  children: ReactNode
}) {
  return (
    <div className="set-row">
      <div className="set-row-label">
        <div className="set-label">{label}</div>
        {sub && <div className="set-sub">{sub}</div>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  )
}

const NAV: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Student Profile' },
  { id: 'general', label: 'General' },
  { id: 'learning', label: 'Tutor & Models' },
  { id: 'voice', label: 'Speech & Voice' },
  { id: 'account', label: 'Account' },
]

const THEME_OPTIONS: SelectOption[] = [
  { value: 'system', label: 'System Default', description: 'Match operating system appearance' },
  { value: 'light', label: 'Light Theme', description: 'Clean light background with high contrast' },
  { value: 'dark', label: 'Dark Theme', description: 'Low-light dark background' },
]

const GRADES_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Class ${i + 1}`,
  description: i >= 10 ? 'Senior Secondary' : i >= 8 ? 'Secondary' : 'Primary & Middle School',
}))

export function SettingsModal({
  boards,
  models,
  modelId,
  onModelChange,
  onClose,
}: Props) {
  const { user, updateProfile, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')
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
  const [saved, setSaved] = useState(false)
  const [naturalVoice, setNaturalVoice] = useState(
    () => localStorage.getItem('tark_natural_voice') !== '0',
  )
  const [voicePersona, setVoicePersona] = useState(
    () => localStorage.getItem('tark_voice_persona') || 'Aoede',
  )
  const [theme, setTheme] = useState(
    () => localStorage.getItem('tark_theme') ?? 'system',
  )

  if (!user) return null

  function toggleWeakTopic(topic: string) {
    setWeakTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    )
  }

  async function saveProfile() {
    setSaving(true)
    setSaved(false)

    localStorage.setItem('tark_board', board)
    localStorage.setItem('tark_grade', grade)
    localStorage.setItem('tark_school', school)
    localStorage.setItem('tark_target_exam', exam)
    localStorage.setItem('tark_tutoring_style', tutoringStyle)
    localStorage.setItem('tark_language_pref', language)
    localStorage.setItem('tark_weak_subjects', JSON.stringify(weakTopics))
    localStorage.setItem('tark_profile_completed', '1')

    await updateProfile({
      board: board || undefined,
      grade: grade || undefined,
      school: school.trim() || undefined,
      exam: exam || undefined,
      tutoring_style: tutoringStyle || undefined,
      language: language || undefined,
      weak_subjects: JSON.stringify(weakTopics),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  function changeTheme(t: string) {
    setTheme(t)
    localStorage.setItem('tark_theme', t)
    applyTheme(t)
  }

  const boardOptions: SelectOption[] = [
    { value: 'CBSE', label: 'CBSE (NCERT)', description: 'Central Board of Secondary Education' },
    { value: 'ICSE', label: 'ICSE / CISCE', description: 'Council for the Indian School Certificate Examinations' },
    { value: 'Maharashtra State Board', label: 'Maharashtra State Board', description: 'State Board Secondary & Higher Secondary' },
    ...boards
      .filter((b) => !['CBSE', 'ICSE', 'Maharashtra State Board'].includes(b))
      .map((b) => ({ value: b, label: b, description: 'Textbook Curriculum Grounding' })),
    { value: 'General', label: 'Other / General Curriculum', description: 'Standard National Framework' },
  ]

  const examOptions: SelectOption[] = EXAM_TARGETS.map((x) => ({
    value: x.id,
    label: x.label,
    description: x.desc,
  }))

  const styleOptions: SelectOption[] = TUTORING_STYLES.map((s) => ({
    value: s.id,
    label: s.label,
    description: s.desc,
    badge: s.badge,
  }))

  const languageOptions: SelectOption[] = LANGUAGES.map((l) => ({
    value: l.id,
    label: l.label,
    description: l.desc,
  }))

  const modelOptions: SelectOption[] = models.map((m) => ({
    value: m.id,
    label: m.label,
    description: m.description,
    badge: m.tier === 'admin' ? 'Admin' : m.grounded ? 'Grounded' : undefined,
  }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <aside className="settings-nav">
          <div className="settings-nav-head">
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
            <span className="settings-nav-title">Settings</span>
          </div>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`settings-nav-item${tab === n.id ? ' active' : ''}`}
              onClick={() => setTab(n.id)}
            >
              {n.label}
            </button>
          ))}
        </aside>

        <section className="settings-panel">
          <h2 className="settings-panel-title">
            {NAV.find((n) => n.id === tab)?.label}
          </h2>

          {tab === 'general' && (
            <>
              <Row label="Appearance" sub="Select interface color theme">
                <CustomSelect
                  value={theme}
                  options={THEME_OPTIONS}
                  onChange={changeTheme}
                  className="settings-custom-select"
                />
              </Row>
              <Row label="Interface Language" sub="Display language for buttons and controls">
                <CustomSelect
                  value={language}
                  options={languageOptions}
                  onChange={(val) => {
                    setLanguage(val)
                    localStorage.setItem('tark_language_pref', val)
                  }}
                  className="settings-custom-select"
                />
              </Row>
            </>
          )}

          {tab === 'account' && (
            <>
              <div className="settings-account">
                <span className="profile-av">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <div className="profile-meta">
                  <div className="profile-name">
                    {user.username}{' '}
                    {user.is_admin && <span className="admin-badge">Admin</span>}
                  </div>
                  <div className="profile-sub">{user.email}</div>
                </div>
              </div>
              <Row label="Sign Out" sub="End your current session on this device">
                <button
                  className="danger-btn"
                  onClick={() => {
                    signOut()
                    onClose()
                  }}
                >
                  Sign Out
                </button>
              </Row>
            </>
          )}

          {tab === 'profile' && (
            <div className="settings-profile-pane">
              <Row label="Target Examination" sub="Calibrates depth, derivations, and question complexity">
                <CustomSelect
                  value={exam}
                  options={examOptions}
                  onChange={setExam}
                  className="settings-custom-select"
                />
              </Row>

              <Row label="Education Board" sub="Aligns textbook grounding with your syllabus">
                <CustomSelect
                  value={board}
                  options={boardOptions}
                  onChange={setBoard}
                  className="settings-custom-select"
                />
              </Row>

              <Row label="Grade / Class" sub="Sets appropriate vocabulary and pedagogical depth">
                <CustomSelect
                  value={grade}
                  options={GRADES_OPTIONS}
                  onChange={setGrade}
                  className="settings-custom-select"
                />
              </Row>

              <Row label="Institution Name" sub="Optional">
                <input
                  className="set-input"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Enter school or college name"
                />
              </Row>

              <Row label="Explanation Style" sub="Preferred structure for theoretical and numerical answers">
                <CustomSelect
                  value={tutoringStyle}
                  options={styleOptions}
                  onChange={setTutoringStyle}
                  className="settings-custom-select"
                />
              </Row>

              <Row label="Explanation Medium" sub="Primary language medium for concept explanations">
                <CustomSelect
                  value={language}
                  options={languageOptions}
                  onChange={setLanguage}
                  className="settings-custom-select"
                />
              </Row>

              {/* Rich Focus Areas Section */}
              <div className="set-row-vertical" style={{ marginTop: 14 }}>
                <div className="set-label">Focus Areas Requiring Additional Guidance</div>
                <div className="set-sub" style={{ marginBottom: 12 }}>
                  The tutor provides step-by-step breakdowns and checks for understanding on these topics
                </div>

                <FocusAreaSelector
                  selectedTopics={weakTopics}
                  onToggleTopic={toggleWeakTopic}
                  onClearAll={() => setWeakTopics([])}
                />
              </div>

              <div className="settings-save-row" style={{ marginTop: 20 }}>
                <button
                  className="modal-primary"
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save Profile'}
                </button>
              </div>
            </div>
          )}

          {tab === 'learning' && (
            <>
              <Row label="Customize Tark — Teaching Mode" sub="Choose how Tark guides, explains, and interacts with you">
                <CustomSelect
                  value={tutoringStyle}
                  options={styleOptions}
                  onChange={async (val) => {
                    setTutoringStyle(val)
                    localStorage.setItem('tark_tutoring_style', val)
                    try {
                      await updateProfile({ tutoring_style: val })
                    } catch {}
                  }}
                  className="settings-custom-select"
                />
              </Row>
              <Row label="Default Model" sub="Preferred foundation model for session responses">
                <CustomSelect
                  value={modelId}
                  options={modelOptions}
                  onChange={onModelChange}
                  className="settings-custom-select"
                />
              </Row>
              <Row label="Curriculum Grounding" sub="Answers verified against syllabus and official textbooks">
                <span className="badge-pill">Active</span>
              </Row>
            </>
          )}

          {tab === 'voice' && (
            <>
              <Row
                label="Sweet High-Fidelity AI Tutor Voice"
                sub="Studio-grade natural neural voice with teacher breath pauses, formula pacing, and sweet tone. When disabled, uses local speech."
              >
                <Switch
                  on={naturalVoice}
                  onChange={(v) => {
                    setNaturalVoice(v)
                    localStorage.setItem('tark_natural_voice', v ? '1' : '0')
                  }}
                />
              </Row>

              {naturalVoice && (
                <Row
                  label="Teacher Voice Persona"
                  sub="Choose your teacher's voice style and personality."
                >
                  <CustomSelect
                    value={voicePersona}
                    options={[
                      { value: 'Aoede', label: '🌸 Aoede — Sweet & Warm Female Tutor (Default)' },
                      { value: 'Puck', label: '🌟 Puck — Upbeat & Friendly Male Tutor' },
                      { value: 'Kore', label: '🌿 Kore — Calm & Gentle Female Tutor' },
                      { value: 'Fenrir', label: '🏛️ Fenrir — Deep & Resonant Male Tutor' },
                    ]}
                    onChange={(val) => {
                      setVoicePersona(val)
                      localStorage.setItem('tark_voice_persona', val)
                    }}
                  />
                </Row>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

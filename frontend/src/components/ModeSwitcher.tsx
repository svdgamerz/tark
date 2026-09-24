import type { Mode } from '../api'

const MODES: { id: Mode; label: string; hint: string }[] = [
  {
    id: 'teacher',
    label: 'Teacher',
    hint: 'Structured lesson: concept → worked example → check',
  },
  {
    id: 'socratic',
    label: 'Socratic',
    hint: 'Guides you with questions — never just the answer',
  },
]

export function ModeSwitcher({
  mode,
  onChange,
  disabled,
}: {
  mode: Mode
  onChange: (m: Mode) => void
  disabled?: boolean
}) {
  return (
    <div className="mode-switcher">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`mode-btn ${mode === m.id ? 'active' : ''}`}
          onClick={() => onChange(m.id)}
          title={m.hint}
          disabled={disabled}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

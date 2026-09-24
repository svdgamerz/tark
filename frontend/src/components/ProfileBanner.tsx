interface Props {
  onOpenSetup: () => void
  onDismiss: () => void
}

export function ProfileBanner({ onOpenSetup, onDismiss }: Props) {
  return (
    <div className="profile-prompt-banner">
      <div className="banner-left">
        <span className="banner-icon-wrap" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </span>
        <div className="banner-content">
          <span className="banner-title">Personalize Your Syllabus</span>
          <span className="banner-sub">Configure your board, grade, and focus areas for targeted explanations.</span>
        </div>
      </div>
      <div className="banner-actions">
        <button className="banner-btn-primary" onClick={onOpenSetup}>
          Configure Profile
        </button>
        <button className="banner-btn-dismiss" onClick={onDismiss} aria-label="Dismiss banner">
          ✕
        </button>
      </div>
    </div>
  )
}

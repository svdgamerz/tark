import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

export interface SelectOption {
  value: string
  label: string
  description?: string
  badge?: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select an option…',
  disabled = false,
  className = '',
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((prev) => !prev)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleSelect(val: string) {
    onChange(val)
    setOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        disabled={disabled}
      >
        <span className="custom-select-value">
          {selectedOption ? (
            <span className="selected-text">{selectedOption.label}</span>
          ) : (
            <span className="placeholder-text">{placeholder}</span>
          )}
        </span>
        <svg
          className={`custom-select-chevron ${open ? 'rotated' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          className="custom-select-dropdown"
          role="listbox"
          tabIndex={-1}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                <div className="option-content">
                  <div className="option-label-row">
                    <span className="option-label">{opt.label}</span>
                    {opt.badge && <span className="option-badge">{opt.badge}</span>}
                  </div>
                  {opt.description && (
                    <span className="option-description">{opt.description}</span>
                  )}
                </div>
                {isSelected && (
                  <svg
                    className="option-check-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { useState, useRef, useEffect, useMemo, type KeyboardEvent, type ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: string
  description?: string
  badge?: string
  icon?: ReactNode
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  searchable?: boolean
  compact?: boolean
  align?: 'left' | 'right'
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select an option…',
  disabled = false,
  className = '',
  ariaLabel,
  searchable,
  compact = false,
  align = 'left',
}: Props) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [dropUp, setDropUp] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  )

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options
    const query = searchTerm.toLowerCase().trim()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query)) ||
        (opt.badge && opt.badge.toLowerCase().includes(query))
    )
  }, [options, searchTerm])

  const shouldShowSearch = searchable ?? options.length >= 6

  // Smart dropdown position check: open upwards if too close to bottom of screen
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      // If less than 280px below and more space above, open upwards
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setDropUp(true)
      } else {
        setDropUp(false)
      }

      // Auto-focus search input if searchable
      if (shouldShowSearch) {
        setTimeout(() => {
          searchInputRef.current?.focus()
        }, 50)
      }
    } else {
      setSearchTerm('')
      setActiveIndex(-1)
    }
  }, [open, shouldShowSearch])

  // Handle outside clicks to close
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

  // Scroll active option into view
  useEffect(() => {
    if (open && activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex, open])

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
      const currentIdx = filteredOptions.findIndex((o) => o.value === value)
      setActiveIndex(currentIdx >= 0 ? currentIdx : 0)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleDropdownKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        handleSelect(filteredOptions[activeIndex].value)
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(filteredOptions.length - 1)
    }
  }

  function handleSelect(val: string) {
    onChange(val)
    setOpen(false)
    setSearchTerm('')
  }

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${open ? 'open' : ''} ${dropUp ? 'drop-up' : 'drop-down'} ${
        disabled ? 'disabled' : ''
      } ${compact ? 'compact' : ''} ${align === 'right' ? 'align-right' : ''} ${className}`}
      onKeyDown={open ? handleDropdownKeyDown : undefined}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        disabled={disabled}
      >
        <span className="custom-select-value">
          {selectedOption ? (
            <span className="selected-item-row">
              {selectedOption.icon && <span className="selected-icon">{selectedOption.icon}</span>}
              <span className="selected-text">{selectedOption.label}</span>
              {selectedOption.badge && <span className="selected-badge">{selectedOption.badge}</span>}
            </span>
          ) : (
            <span className="placeholder-text">{placeholder}</span>
          )}
        </span>
        <span className="custom-select-chevron-wrapper">
          <svg
            className={`custom-select-chevron ${open ? 'rotated' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div className={`custom-select-popover ${dropUp ? 'popover-up' : 'popover-down'}`}>
          {shouldShowSearch && (
            <div className="custom-select-search-bar">
              <svg
                className="search-bar-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="custom-select-search-input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setActiveIndex(0)
                }}
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-bar-clear"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSearchTerm('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          )}

          <ul
            ref={listRef}
            className="custom-select-dropdown"
            role="listbox"
            tabIndex={-1}
          >
            {filteredOptions.length === 0 ? (
              <li className="custom-select-empty" role="presentation">
                No matching options found
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value
                const isActive = idx === activeIndex

                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? 'selected' : ''} ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <div className="option-content">
                      <div className="option-label-row">
                        {opt.icon && <span className="option-icon">{opt.icon}</span>}
                        <span className="option-label">{opt.label}</span>
                        {opt.badge && <span className="option-badge">{opt.badge}</span>}
                      </div>
                      {opt.description && (
                        <span className="option-description">{opt.description}</span>
                      )}
                    </div>

                    {isSelected && (
                      <span className="option-check-wrap">
                        <svg
                          className="option-check-icon"
                          width="14"
                          height="14"
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
                      </span>
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

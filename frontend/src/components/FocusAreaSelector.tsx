import { useState, useMemo, type KeyboardEvent } from 'react'

export interface CurriculumTopic {
  id: string
  name: string
  subject: string
  scope: string
}

export const CURRICULUM_TOPICS: CurriculumTopic[] = [
  // Mathematics
  {
    id: 'math_calculus',
    name: 'Calculus & Integrals',
    subject: 'Mathematics',
    scope: 'Differentiation, Definite & Indefinite Integrals, Differential Equations',
  },
  {
    id: 'math_trig',
    name: 'Trigonometry & Inverse Functions',
    subject: 'Mathematics',
    scope: 'Trigonometric Identities, Equations, Heights & Distances',
  },
  {
    id: 'math_coord',
    name: 'Coordinate Geometry & Conics',
    subject: 'Mathematics',
    scope: 'Straight Lines, Circles, Parabola, Ellipse, Hyperbola',
  },
  {
    id: 'math_vectors',
    name: 'Vectors & 3D Geometry',
    subject: 'Mathematics',
    scope: 'Dot & Cross Products, Direction Cosines, Equations of Planes & Lines',
  },
  {
    id: 'math_prob',
    name: 'Probability & Statistics',
    subject: 'Mathematics',
    scope: 'Conditional Probability, Bayes Theorem, Binomial Distribution',
  },
  {
    id: 'math_algebra',
    name: 'Algebra & Complex Numbers',
    subject: 'Mathematics',
    scope: 'Quadratic Equations, Sequences & Series, Complex Roots & Matrices',
  },

  // Physics
  {
    id: 'phy_mechanics',
    name: 'Mechanics & Laws of Motion',
    subject: 'Physics',
    scope: 'Newtonian Dynamics, Friction, Work-Energy Theorem, Momentum',
  },
  {
    id: 'phy_em',
    name: 'Electromagnetism & AC Circuits',
    subject: 'Physics',
    scope: 'Coulombs Law, Gauss Law, Biot-Savart, EMI, Alternating Current',
  },
  {
    id: 'phy_optics',
    name: 'Ray & Wave Optics',
    subject: 'Physics',
    scope: 'Refraction, Total Internal Reflection, Interference & Diffraction',
  },
  {
    id: 'phy_thermo',
    name: 'Thermodynamics & Kinetic Theory',
    subject: 'Physics',
    scope: 'First & Second Laws, Carnot Engine, Entropy, Gas Laws',
  },
  {
    id: 'phy_modern',
    name: 'Modern Physics & Quantum',
    subject: 'Physics',
    scope: 'Photoelectric Effect, De Broglie Wavelength, Bohr Model, Nuclear Binding',
  },
  {
    id: 'phy_rotation',
    name: 'Rotational Dynamics',
    subject: 'Physics',
    scope: 'Moment of Inertia, Torque, Conservation of Angular Momentum, Rolling Motion',
  },

  // Chemistry
  {
    id: 'chem_organic',
    name: 'Organic Reaction Mechanisms',
    subject: 'Chemistry',
    scope: 'Electrophilic/Nucleophilic Substitution, Elimination, Reaction Intermediates',
  },
  {
    id: 'chem_equil',
    name: 'Chemical & Ionic Equilibrium',
    subject: 'Chemistry',
    scope: 'Le Chateliers Principle, Buffer Solutions, Solubility Product, pH',
  },
  {
    id: 'chem_electro',
    name: 'Electrochemistry & Redox',
    subject: 'Chemistry',
    scope: 'Nernst Equation, Galvanic Cells, Conductance, Faradays Laws',
  },
  {
    id: 'chem_coord',
    name: 'Coordination Compounds',
    subject: 'Chemistry',
    scope: 'IUPAC Nomenclature, Werner Theory, Crystal Field Theory, Isomerism',
  },
  {
    id: 'chem_bonding',
    name: 'Chemical Bonding & Periodic Trends',
    subject: 'Chemistry',
    scope: 'VSEPR Theory, Hybridization, Molecular Orbital Theory, Electronegativity',
  },
  {
    id: 'chem_thermo',
    name: 'Chemical Thermodynamics',
    subject: 'Chemistry',
    scope: 'Enthalpy of Reaction, Entropy, Gibbs Free Energy & Spontaneity',
  },

  // Biology
  {
    id: 'bio_genetics',
    name: 'Genetics & Molecular Inheritance',
    subject: 'Biology',
    scope: 'Mendelian Genetics, DNA Replication, Transcription, Translation, Mutations',
  },
  {
    id: 'bio_physio',
    name: 'Human Physiology',
    subject: 'Biology',
    scope: 'Circulation, Neural Coordination, Chemical Integration, Excretory Products',
  },
  {
    id: 'bio_cell',
    name: 'Cell Biology & Division',
    subject: 'Biology',
    scope: 'Cell Organelle Functions, Mitosis, Meiosis, Cell Cycle Checkpoints',
  },
  {
    id: 'bio_plant',
    name: 'Plant Physiology',
    subject: 'Biology',
    scope: 'Photosynthesis (Light/Dark Reactions, C3/C4), Plant Hormones, Respiration',
  },
  {
    id: 'bio_biotech',
    name: 'Biotechnology Principles',
    subject: 'Biology',
    scope: 'Recombinant DNA Technology, PCR, Restriction Enzymes, Bio-ethics',
  },

  // Computer Science
  {
    id: 'cs_dsa',
    name: 'Data Structures & Algorithms',
    subject: 'Computer Science',
    scope: 'Arrays, Linked Lists, Stacks, Queues, Sorting & Searching Complexity',
  },
  {
    id: 'cs_python',
    name: 'Python Programming',
    subject: 'Computer Science',
    scope: 'Functions, Object-Oriented Programming, Modules, File Handling',
  },
  {
    id: 'cs_sql',
    name: 'Database Management & SQL',
    subject: 'Computer Science',
    scope: 'Relational Model, SELECT Queries, Joins, Group By, Table Constraints',
  },
  {
    id: 'cs_logic',
    name: 'Recursion & Problem Solving',
    subject: 'Computer Science',
    scope: 'Recursive Call Stacks, Base Conditions, Divide & Conquer, Backtracking',
  },
]

const SUBJECTS = ['All', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'] as const

interface Props {
  selectedTopics: string[]
  onToggleTopic: (topicName: string) => void
  onClearAll?: () => void
  className?: string
}

export function FocusAreaSelector({
  selectedTopics,
  onToggleTopic,
  onClearAll,
  className = '',
}: Props) {
  const [selectedSubject, setSelectedSubject] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [customInput, setCustomInput] = useState('')

  // Map of topic counts per subject
  const subjectSelectedCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    CURRICULUM_TOPICS.forEach((t) => {
      if (selectedTopics.includes(t.name)) {
        counts[t.subject] = (counts[t.subject] || 0) + 1
      }
    })
    return counts
  }, [selectedTopics])

  // Filtered topics based on search & subject tab
  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return CURRICULUM_TOPICS.filter((t) => {
      const matchSubject = selectedSubject === 'All' || t.subject === selectedSubject
      if (!matchSubject) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.scope.toLowerCase().includes(q)
      )
    })
  }, [selectedSubject, searchQuery])

  function handleAddCustom() {
    const trimmed = customInput.trim()
    if (trimmed && !selectedTopics.includes(trimmed)) {
      onToggleTopic(trimmed)
      setCustomInput('')
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddCustom()
    }
  }

  return (
    <div className={`focus-area-selector ${className}`}>
      {/* Search & Selection Summary Bar */}
      <div className="focus-header-bar">
        <div className="focus-search-wrap">
          <svg
            className="search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="focus-search-input"
            placeholder="Search topics, chapters, or syllabus concepts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="focus-status-badge">
          <span className="count-num">{selectedTopics.length}</span> active focus area{selectedTopics.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Subject Filter Segmented Bar */}
      <div className="focus-subject-tabs" role="tablist">
        {SUBJECTS.map((subj) => {
          const count = subj === 'All' ? selectedTopics.length : subjectSelectedCounts[subj] || 0
          return (
            <button
              key={subj}
              type="button"
              role="tab"
              aria-selected={selectedSubject === subj}
              className={`subject-tab-btn ${selectedSubject === subj ? 'active' : ''}`}
              onClick={() => setSelectedSubject(subj)}
            >
              <span className="tab-label">{subj}</span>
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Structured Curriculum Topic Cards Grid */}
      <div className="focus-cards-grid" role="list">
        {filteredTopics.length === 0 ? (
          <div className="no-topics-found">
            <p>No topics matching "{searchQuery}".</p>
            <span className="no-topics-hint">You can add it as a custom focus topic below.</span>
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const isSelected = selectedTopics.includes(topic.name)
            return (
              <div
                key={topic.id}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                className={`topic-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onToggleTopic(topic.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleTopic(topic.name)
                  }
                }}
              >
                <div className="topic-card-control">
                  <div className={`checkbox-box ${isSelected ? 'checked' : ''}`}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="topic-card-body">
                  <div className="topic-card-head">
                    <span className="topic-title">{topic.name}</span>
                    <span className="topic-subject-tag">{topic.subject}</span>
                  </div>
                  <p className="topic-scope">{topic.scope}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Selected Topics Token Tray */}
      {selectedTopics.length > 0 && (
        <div className="active-tokens-tray">
          <div className="tray-header">
            <span className="tray-title">Active Focus Topics ({selectedTopics.length})</span>
            {onClearAll && (
              <button type="button" className="clear-all-link" onClick={onClearAll}>
                Clear all
              </button>
            )}
          </div>
          <div className="tray-tokens">
            {selectedTopics.map((name) => {
              const matched = CURRICULUM_TOPICS.find((t) => t.name === name)
              const prefix = matched ? matched.subject.slice(0, 4) : 'Custom'
              return (
                <span key={name} className="active-token-badge">
                  <span className="token-prefix">{prefix}</span>
                  <span className="token-name">{name}</span>
                  <button
                    type="button"
                    className="token-remove-btn"
                    onClick={() => onToggleTopic(name)}
                    aria-label={`Remove ${name}`}
                  >
                    ✕
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Custom Topic Creation Input */}
      <div className="custom-topic-creator">
        <label className="creator-label" htmlFor="custom-topic-input">
          Need help with a specific chapter or concept?
        </label>
        <div className="creator-input-group">
          <input
            id="custom-topic-input"
            type="text"
            className="creator-input"
            placeholder="e.g. Centre of Mass, Transition Elements, Bayes Theorem…"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="creator-add-btn"
            onClick={handleAddCustom}
            disabled={!customInput.trim()}
          >
            Add Topic
          </button>
        </div>
      </div>
    </div>
  )
}

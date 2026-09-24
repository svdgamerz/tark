import { useState, useEffect, useMemo } from 'react'
import type { SimulationData, CatalogSimulationItem } from '../simulations/types'
import { InteractiveSimulation } from './InteractiveSimulation'

const FALLBACK_CATALOG: CatalogSimulationItem[] = [
  {
    id: 'sim_projectile',
    title: 'Projectile Motion Simulator',
    subject: 'Physics',
    category: 'Mechanics & Kinematics',
    emoji: '🚀',
    difficulty: 'Beginner',
    description: 'Explore 2D parabolic trajectories, launch angle optimization, flight time, and maximum range.',
    builtin_type: 'projectile',
    default_params: { angle: 45, speed: 25, gravity: 9.8 },
  },
  {
    id: 'sim_pendulum',
    title: 'Simple Pendulum & SHM',
    subject: 'Physics',
    category: 'Oscillations & Waves',
    emoji: '⏱️',
    difficulty: 'Beginner',
    description: 'Investigate simple harmonic motion, period vs length, and dynamic kinetic/potential energy transfer.',
    builtin_type: 'pendulum',
    default_params: { length: 1.5, angle: 30, gravity: 9.8 },
  },
  {
    id: 'sim_ohms_law',
    title: "Ohm's Law & Circuit Lab",
    subject: 'Physics',
    category: 'Electricity & Magnetism',
    emoji: '⚡',
    difficulty: 'Beginner',
    description: 'Adjust DC voltage and resistance to observe live current flow, lamp brightness, and electron drift.',
    builtin_type: 'ohms_law',
    default_params: { voltage: 9, resistance: 15 },
  },
  {
    id: 'sim_waves',
    title: 'Wave Interference & Double-Slit',
    subject: 'Physics',
    category: 'Wave Optics',
    emoji: '🌊',
    difficulty: 'Intermediate',
    description: "Young's double-slit experiment: see interference fringe patterns and light wave superposition in real time.",
    builtin_type: 'waves',
    default_params: { wavelength: 550, slitDist: 0.25, screenDist: 1.2 },
  },
  {
    id: 'sim_gas_law',
    title: 'Ideal Gas Law Piston',
    subject: 'Physics',
    category: 'Thermodynamics',
    emoji: '🔥',
    difficulty: 'Intermediate',
    description: 'Simulate kinetic molecular theory (PV = nRT) in a movable piston chamber with live pressure gauge.',
    builtin_type: 'gas_law',
    default_params: { temp: 300, volume: 5, moles: 1.0 },
  },
  {
    id: 'sim_ray_optics',
    title: 'Ray Optics & Thin Lens',
    subject: 'Physics',
    category: 'Geometric Optics',
    emoji: '🔍',
    difficulty: 'Intermediate',
    description: 'Trace principal rays through convex and concave lenses. Calculate image distance, magnification, and real vs virtual images.',
    builtin_type: 'ray_optics',
    default_params: { focal: 15, objDist: 30, objHeight: 25 },
  },
  {
    id: 'sim_magnetic_fields',
    title: 'Magnetic Field Lines & Dipole',
    subject: 'Physics',
    category: 'Magnetism',
    emoji: '🧲',
    difficulty: 'Intermediate',
    description: 'Visualize magnetic vector field lines around bar magnets, moving charges, and interactive compass needles.',
    builtin_type: 'magnetic_fields',
    default_params: { strength: 25, compassX: 65, compassY: -45 },
  },
  {
    id: 'sim_em_induction',
    title: "Electromagnetic Induction & Faraday's Law",
    subject: 'Physics',
    category: 'Electromagnetism',
    emoji: '💡',
    difficulty: 'Advanced',
    description: "Demonstrate Faraday's & Lenz's Laws: move a magnet through a wire coil to generate induced EMF and light up a bulb.",
    builtin_type: 'em_induction',
    default_params: { turns: 200, speed: 3, magnetStrength: 1.5 },
  },
  {
    id: 'sim_atomic_orbitals',
    title: 'Bohr Atom & Electron Orbitals',
    subject: 'Chemistry',
    category: 'Atomic Structure',
    emoji: '⚛️',
    difficulty: 'Beginner',
    description: 'Explore electron energy levels (n=1 to 5), photon absorption, and emission spectra for Hydrogen.',
    builtin_type: 'atomic_orbitals',
    default_params: { nInitial: 3, nFinal: 2 },
  },
  {
    id: 'sim_chemical_bonding',
    title: 'Chemical Bonding (Ionic vs Covalent)',
    subject: 'Chemistry',
    category: 'Chemical Structure',
    emoji: '🧪',
    difficulty: 'Intermediate',
    description: 'Compare electron transfer in Ionic bonds (NaCl) vs electron sharing in Covalent bonds (H2O, O2, CH4).',
    builtin_type: 'chemical_bonding',
    default_params: { distance: 74, bondMode: 1, enDiff: 0.4 },
  },
  {
    id: 'sim_titration',
    title: 'Acid-Base Titration Curve & pH',
    subject: 'Chemistry',
    category: 'Analytical Chemistry',
    emoji: '💧',
    difficulty: 'Intermediate',
    description: 'Titrate strong/weak acids with NaOH. Observe the S-shaped pH curve, indicator color transitions, and equivalence point.',
    builtin_type: 'titration',
    default_params: { vAdded: 18, cAcid: 0.1, cBase: 0.1 },
  },
  {
    id: 'sim_electrolysis',
    title: 'Electrolysis of Water & Faraday',
    subject: 'Chemistry',
    category: 'Electrochemistry',
    emoji: '🔋',
    difficulty: 'Intermediate',
    description: 'Split water into Hydrogen (2x volume at cathode) and Oxygen (at anode) with live gas volume collection tubes.',
    builtin_type: 'electrolysis',
    default_params: { voltage: 6, current: 2.0, timeElapsed: 25 },
  },
  {
    id: 'sim_periodic_trends',
    title: 'Periodic Table Trends Explorer',
    subject: 'Chemistry',
    category: 'Inorganic Chemistry',
    emoji: '📊',
    difficulty: 'Beginner',
    description: 'Visualize Atomic Radius, Electronegativity, and Ionization Energy trends across periods and groups.',
    builtin_type: null,
  },
  {
    id: 'sim_mitosis',
    title: 'Cell Division (Stages of Mitosis)',
    subject: 'Biology',
    category: 'Cell Biology',
    emoji: '🔬',
    difficulty: 'Intermediate',
    description: 'Step through Prophase, Metaphase, Anaphase, Telophase, and Cytokinesis with animated chromosome alignment and spindle fibers.',
    builtin_type: 'mitosis',
    default_params: { stage: 2 },
  },
  {
    id: 'sim_circulatory_heart',
    title: 'Heart & Double Circulation System',
    subject: 'Biology',
    category: 'Human Physiology',
    emoji: '🫀',
    difficulty: 'Intermediate',
    description: 'Pumping 4-chambered human heart with cardiac cycle valve animations, oxygenated vs deoxygenated blood circuits, and ECG readout.',
    builtin_type: 'circulatory_heart',
    default_params: { bpm: 72, strokeVol: 70 },
  },
  {
    id: 'sim_photosynthesis',
    title: 'Photosynthesis & Light Reactions',
    subject: 'Biology',
    category: 'Plant Physiology',
    emoji: '🌱',
    difficulty: 'Intermediate',
    description: 'Inside the Thylakoid membrane: photon excitation in PS II & I, photolysis of water, electron transport chain, and ATP synthesis.',
    builtin_type: 'photosynthesis',
    default_params: { lightIntensity: 80, co2Level: 400 },
  },
  {
    id: 'sim_neuron_action_potential',
    title: 'Neuron Action Potential & Synapse',
    subject: 'Biology',
    category: 'Neurobiology',
    emoji: '🧠',
    difficulty: 'Advanced',
    description: 'Simulate voltage-gated Na+/K+ ion channels, threshold stimulus (-55 mV), depolarization, and neurotransmitter vesicle release.',
    builtin_type: 'neuron_action_potential',
    default_params: { stimulus: -50, caLevel: 70 },
  },
  {
    id: 'sim_dna_replication',
    title: 'DNA Replication & Base Pairing',
    subject: 'Biology',
    category: 'Genetics & Molecular Biology',
    emoji: '🧬',
    difficulty: 'Advanced',
    description: 'Unwind the double helix with Helicase and watch DNA Polymerase synthesize leading and lagging strands with complementary base pairs.',
    builtin_type: 'dna_replication',
    default_params: { speed: 40, proofreading: 99 },
  },
  {
    id: 'sim_quadratic',
    title: 'Quadratic Curves & Parabola Explorer',
    subject: 'Mathematics',
    category: 'Algebra & Coordinate Geometry',
    emoji: '📐',
    difficulty: 'Beginner',
    description: 'Manipulate coefficients a, b, c in y = ax² + bx + c. Trace roots, vertex, axis of symmetry, and discriminant in real time.',
    builtin_type: 'quadratic',
    default_params: { a: 1, b: -2, c: -3 },
  },
  {
    id: 'sim_lorenz_chaos',
    title: 'Lorenz Strange Attractor & Chaos Theory',
    subject: 'Mathematics',
    category: 'Dynamical Systems & Nonlinear ODEs',
    emoji: '🦋',
    difficulty: 'Advanced',
    description: 'Explore 3D deterministic chaos and the butterfly effect in the Lorenz 1963 system. Compute the Maximal Lyapunov Exponent (MLE λ ≈ 0.902) and observe sensitive dependence on initial conditions.',
    builtin_type: 'lorenz',
    default_params: { sigma: 10, rho: 28, beta: 2.67 },
  },
  {
    id: 'sim_complex_roots',
    title: 'Durand-Kerner Complex Roots & Polynomials',
    subject: 'Mathematics',
    category: 'Complex Analysis & Numerical Algebra',
    emoji: '🌀',
    difficulty: 'Advanced',
    description: 'Visualize Weierstrass (Durand-Kerner) simultaneous root-finding on the Argand plane for degree-N monic polynomials. Observe Aberth-Ehrlich circle convergence and fractal basins.',
    builtin_type: 'complex_roots',
    default_params: { degree: 5, rotation: 0, scale: 1.2 },
  },
  {
    id: 'sim_fourier_spectral',
    title: 'Fourier Transform & Spectral Decomposition',
    subject: 'Mathematics',
    category: 'Harmonic Analysis & Signal Theory',
    emoji: '🎼',
    difficulty: 'Advanced',
    description: 'Deconstruct complex signals and wavepackets into orthogonal sinusoids via Radix-2 Fast Fourier Transform. Watch rotating epicycle phasors synthesize square, sawtooth, and chirp waves.',
    builtin_type: 'fourier_spectral',
    default_params: { freq: 2, harmonics: 9, waveform: 0 },
  },
  {
    id: 'sim_heat_pde',
    title: '2D Heat Diffusion & Fourier PDE Solver',
    subject: 'Mathematics',
    category: 'Partial Differential Equations',
    emoji: '🔥',
    difficulty: 'Advanced',
    description: 'Simulate the 2D parabolic heat equation (∂u/∂t = α∇²u) on an interactive grid. Watch thermal dissipation, Dirichlet boundary flux, and entropy growth.',
    builtin_type: 'heat_pde',
    default_params: { diffusivity: 0.25, sourceTemp: 100, decay: 0.01 },
  },
]

type SubjectTab = 'All' | 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics'

interface Props {
  onClose: () => void
  onSendToChat?: (query: string) => void
}

export function VirtualLabModal({ onClose, onSendToChat }: Props) {
  const [catalog, setCatalog] = useState<CatalogSimulationItem[]>(FALLBACK_CATALOG)
  const [selectedTab, setSelectedTab] = useState<SubjectTab>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All')

  // Active Simulation View State
  const [activeSimulation, setActiveSimulation] = useState<SimulationData | null>(null)
  const [loadingSimId, setLoadingSimId] = useState<string | null>(null)
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false)
  const [customGenPrompt, setCustomGenPrompt] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [groundingToast, setGroundingToast] = useState<{ title: string; subject: string } | null>(null)

  // Fetch live catalog from backend on mount
  useEffect(() => {
    fetch('/api/simulations/catalog')
      .then((res) => {
        if (!res.ok) return fetch('/simulations/catalog')
        return res
      })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.catalog && Array.isArray(data.catalog) && data.catalog.length > 0) {
          setCatalog(data.catalog)
        }
      })
      .catch(() => {
        // Fallback already pre-populated
      })
  }, [])

  // Keyboard shortcut: Escape to close modal (or return from active simulation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSimulation) {
          setActiveSimulation(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSimulation, onClose])

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchesTab = selectedTab === 'All' || item.subject === selectedTab
      const matchesDifficulty = difficultyFilter === 'All' || item.difficulty === difficultyFilter
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q)

      return matchesTab && matchesDifficulty && matchesSearch
    })
  }, [catalog, selectedTab, difficultyFilter, searchQuery])

  // Subject counts for badge labels
  const subjectCounts = useMemo(() => {
    const counts: Record<SubjectTab, number> = {
      All: catalog.length,
      Physics: 0,
      Chemistry: 0,
      Biology: 0,
      Mathematics: 0,
    }
    for (const item of catalog) {
      if (item.subject in counts) {
        counts[item.subject as SubjectTab]++
      }
    }
    return counts
  }, [catalog])

  // Launch a catalog item
  const handleLaunchItem = async (item: CatalogSimulationItem) => {
    setErrorMessage(null)

    // If built-in template, instant launch
    if (item.builtin_type) {
      setActiveSimulation({
        id: item.id,
        title: item.title,
        subject: item.subject,
        concept: item.category,
        type: item.builtin_type,
        description: item.description,
        params: item.default_params,
      })
      return
    }

    // Otherwise, fetch / generate custom HTML simulation from backend
    setLoadingSimId(item.id)
    try {
      const res = await fetch(`/api/simulations/catalog/${item.id}`)
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }
      const data = await res.json()
      if (data?.simulation) {
        setActiveSimulation(data.simulation)
      } else {
        throw new Error('Invalid simulation payload')
      }
    } catch (err: any) {
      // Fallback: try generating custom simulation endpoint
      try {
        const genRes = await fetch('/api/simulations/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: item.title,
            question: item.title,
            subject: item.subject,
            context: item.description,
          }),
        })
        const genData = await genRes.json()
        if (genData?.simulation || genData?.sim) {
          setActiveSimulation(genData.simulation || genData.sim)
        } else {
          setErrorMessage('Unable to generate simulation right now. Please try again.')
        }
      } catch {
        setErrorMessage('Failed to connect to simulation engine. Please check backend connection.')
      }
    } finally {
      setLoadingSimId(null)
    }
  }

  // Generate novel arbitrary simulation on demand
  const handleGenerateCustom = async (customTopic: string) => {
    const topic = customTopic.trim()
    if (!topic) return

    setErrorMessage(null)
    setIsGeneratingCustom(true)
    setCustomGenPrompt(topic)

    try {
      const res = await fetch('/api/simulations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          question: topic,
          context: 'Interactive virtual STEM laboratory playground',
        }),
      })

      if (!res.ok) {
        throw new Error(`Generation failed with code ${res.status}`)
      }

      const data = await res.json()
      const sim = data?.simulation || data?.sim
      if (sim) {
        setActiveSimulation(sim)
        setSearchQuery('')

        // When a new lab is generated and found/grounded in curriculum, add that lab to all labs in the particular subject!
        const catalogItem: CatalogSimulationItem = data.catalog_item || {
          id: sim.id,
          title: (sim.title || topic).replace(/^Lab:\s*/, ''),
          subject: (sim.subject && ['Physics', 'Chemistry', 'Biology', 'Mathematics'].includes(sim.subject))
            ? sim.subject
            : 'Physics',
          category: sim.concept || `${sim.subject || 'STEM'} Laboratory`,
          emoji: sim.emoji || (sim.subject === 'Biology' ? '🔬' : sim.subject === 'Chemistry' ? '🧪' : sim.subject === 'Mathematics' ? '📐' : '⚡'),
          difficulty: 'Intermediate',
          description: sim.description || `Interactive curriculum lab for ${topic}`,
          builtin_type: sim.type !== 'custom_html' ? sim.type : null,
          default_params: sim.params,
        }

        setCatalog((prev) => {
          const filtered = prev.filter(
            (it) => it.id !== catalogItem.id && it.title.toLowerCase() !== catalogItem.title.toLowerCase()
          )
          return [catalogItem, ...filtered]
        })

        setGroundingToast({
          title: catalogItem.title,
          subject: catalogItem.subject,
        })
        setTimeout(() => setGroundingToast(null), 7000)
      } else {
        setErrorMessage('Could not generate visual simulation for this prompt. Try a more specific scientific topic.')
      }
    } catch (err) {
      setErrorMessage('Error generating simulation. Please ensure the backend is active.')
    } finally {
      setIsGeneratingCustom(false)
      setCustomGenPrompt('')
    }
  }

  return (
    <div className="modal-overlay vl-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vl-modal" onClick={(e) => e.stopPropagation()}>
        {/* --- Top Modal Header --- */}
        <div className="vl-header">
          <div className="vl-header-branding">
            <div className="vl-icon-bubble">🧪</div>
            <div>
              <div className="vl-title-row">
                <h2 className="vl-title">Tark Virtual Lab</h2>
                <span className="vl-badge-pill">Interactive STEM</span>
              </div>
              <p className="vl-subtitle">
                Curriculum-aligned interactive simulations across Physics, Chemistry, Biology & Mathematics
              </p>
            </div>
          </div>
          <div className="vl-header-controls">
            {activeSimulation && (
              <button
                type="button"
                className="vl-btn vl-btn-back"
                onClick={() => setActiveSimulation(null)}
                title="Back to Catalog"
              >
                ← Catalog
              </button>
            )}
            <button
              type="button"
              className="vl-close-btn"
              onClick={onClose}
              title="Close Virtual Lab (Esc)"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* --- Textbook Grounding Toast Banner --- */}
        {groundingToast && (
          <div className="vl-toast-grounded">
            <span className="vl-toast-icon">📚</span>
            <span className="vl-toast-text">
              Grounded in curriculum textbooks! <strong>"{groundingToast.title}"</strong> has been added to <strong>{groundingToast.subject}</strong> Labs.
            </span>
            <button
              type="button"
              className="vl-toast-close"
              onClick={() => setGroundingToast(null)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* --- Error Banner if any --- */}
        {errorMessage && (
          <div className="vl-error-banner">
            <span>⚠️ {errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)}>
              ✕
            </button>
          </div>
        )}

        {/* --- Active Simulation View --- */}
        {activeSimulation ? (
          <div className="vl-active-view">
            <div className="vl-active-toolbar">
              <div className="vl-active-meta">
                <span className="vl-active-subject">{activeSimulation.subject}</span>
                <span className="vl-active-divider">/</span>
                <span className="vl-active-concept">{activeSimulation.concept || activeSimulation.title}</span>
                {activeSimulation.textbook_sources && activeSimulation.textbook_sources.length > 0 && (
                  <span className="vl-active-textbook-badge" title={activeSimulation.textbook_sources.join(', ')}>
                    📖 Aligned with Textbook ({activeSimulation.textbook_sources[0]})
                  </span>
                )}
              </div>
              <div className="vl-active-actions">
                {onSendToChat && (
                  <button
                    type="button"
                    className="vl-chat-attach-btn"
                    onClick={() => {
                      onSendToChat(`Explain the concepts and formulas behind ${activeSimulation.title} in detail.`)
                      onClose()
                    }}
                    title="Ask Tark tutor to explain this in chat"
                  >
                    💬 Discuss with Tark
                  </button>
                )}
                <button
                  type="button"
                  className="vl-btn vl-btn-back-main"
                  onClick={() => setActiveSimulation(null)}
                >
                  ← Back to Lab Catalog
                </button>
              </div>
            </div>

            <div className="vl-simulation-player-wrap">
              <InteractiveSimulation simulation={activeSimulation} />
            </div>
          </div>
        ) : (
          /* --- Catalog & Discovery View --- */
          <div className="vl-body">
            {/* Search & On-Demand Generation Bar */}
            <div className="vl-search-section">
              <div className="vl-search-input-wrap">
                <span className="vl-search-icon">🔍</span>
                <input
                  type="text"
                  className="vl-search-input"
                  placeholder="Search catalog or type any STEM concept (e.g. 'Hooke\'s law spring', 'ATP synthesis')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      void handleGenerateCustom(searchQuery)
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="vl-clear-search"
                    onClick={() => setSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>

              {searchQuery.trim().length > 2 && (
                <button
                  type="button"
                  className="vl-btn-generate"
                  onClick={() => void handleGenerateCustom(searchQuery)}
                  disabled={isGeneratingCustom}
                >
                  {isGeneratingCustom ? (
                    <>
                      <span className="vl-spinner" /> Generating Lab...
                    </>
                  ) : (
                    <>✨ Generate AI Lab for "{searchQuery.slice(0, 20)}..."</>
                  )}
                </button>
              )}
            </div>

            {/* Subject Tabs & Difficulty Filters */}
            <div className="vl-filters-bar">
              <div className="vl-tabs-row" role="tablist">
                {(['All', 'Physics', 'Chemistry', 'Biology', 'Mathematics'] as SubjectTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={selectedTab === tab}
                    className={`vl-tab ${selectedTab === tab ? 'active' : ''}`}
                    onClick={() => setSelectedTab(tab)}
                  >
                    <span>{tab}</span>
                    <span className="vl-tab-count">{subjectCounts[tab] ?? 0}</span>
                  </button>
                ))}
              </div>

              <div className="vl-difficulty-filter">
                <span className="vl-filter-label">Level:</span>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as any)}
                  className="vl-select-difficulty"
                >
                  <option value="All">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Generating HUD Overlay if creating a custom lab */}
            {isGeneratingCustom && (
              <div className="vl-generating-hud">
                <div className="vl-generating-card">
                  <div className="vl-generating-spinner" />
                  <h3>Synthesizing Interactive Laboratory</h3>
                  <p>
                    Consulting curriculum textbooks & preparing interactive laboratory for:
                    <br />
                    <strong>"{customGenPrompt}"</strong>
                  </p>
                  <div className="vl-generating-pulse">
                    <span>Searching textbooks</span>
                    <span>•</span>
                    <span>Configuring physical laws</span>
                    <span>•</span>
                    <span>Building interactive laboratory</span>
                  </div>
                </div>
              </div>
            )}

            {/* Catalog Grid */}
            <div className="vl-grid-container">
              {filteredCatalog.length === 0 ? (
                <div className="vl-empty-state">
                  <div className="vl-empty-icon">🔬</div>
                  <h3>No exact catalog match for "{searchQuery}"</h3>
                  <p>Don't worry! Tark can generate an interactive simulation for any concept on the fly.</p>
                  <button
                    type="button"
                    className="vl-btn-generate-direct"
                    onClick={() => void handleGenerateCustom(searchQuery)}
                    disabled={isGeneratingCustom || !searchQuery.trim()}
                  >
                    ✨ Generate Custom Simulation for "{searchQuery}"
                  </button>
                </div>
              ) : (
                <div className="vl-grid">
                  {filteredCatalog.map((item) => {
                    const isLoadingThis = loadingSimId === item.id
                    const isBuiltin = Boolean(item.builtin_type)

                    return (
                      <div
                        key={item.id}
                        className={`vl-card subject-${item.subject.toLowerCase()} ${
                          isLoadingThis ? 'loading' : ''
                        }`}
                        onClick={() => !isLoadingThis && handleLaunchItem(item)}
                      >
                        <div className="vl-card-header">
                          <span className="vl-card-emoji">{item.emoji}</span>
                          <div className="vl-card-badges">
                            <span className={`vl-diff-badge diff-${item.difficulty.toLowerCase()}`}>
                              {item.difficulty}
                            </span>
                            <span className="vl-subject-badge">{item.subject}</span>
                          </div>
                        </div>

                        <h4 className="vl-card-title">{item.title}</h4>
                        <span className="vl-card-category">{item.category}</span>
                        <p className="vl-card-desc">{item.description}</p>

                        <div className="vl-card-footer">
                          <span className="vl-engine-badge">
                            {isBuiltin ? '⚡ 60 FPS Native Canvas' : '✨ Gemini Interactive Lab'}
                          </span>
                          <button
                            type="button"
                            className="vl-card-launch-btn"
                            disabled={isLoadingThis}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLaunchItem(item)
                            }}
                          >
                            {isLoadingThis ? (
                              <span className="vl-mini-spinner" />
                            ) : (
                              'Launch Lab →'
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

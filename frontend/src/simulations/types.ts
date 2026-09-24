export type SimulationType =
  | 'projectile'
  | 'pendulum'
  | 'ohms_law'
  | 'waves'
  | 'gas_law'
  | 'quadratic'
  | 'ray_optics'
  | 'titration'
  | 'magnetic_fields'
  | 'em_induction'
  | 'atomic_orbitals'
  | 'electrolysis'
  | 'mitosis'
  | 'circulatory_heart'
  | 'dna_replication'
  | 'photosynthesis'
  | 'chemical_bonding'
  | 'neuron_action_potential'
  | 'osmosis'
  | 'lorenz'
  | 'complex_roots'
  | 'fourier_spectral'
  | 'heat_pde'
  | 'custom_html'

export interface SimulationParam {
  key: string
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
  unit: string
}

export interface SimulationReadout {
  label: string
  value: string | number
  unit?: string
  formula?: string
}

export interface SimulationData {
  id: string
  title: string
  subject: string
  concept: string
  type: SimulationType
  description: string
  params?: Record<string, number>
  htmlContent?: string
  textbook_sources?: string[]
}

export interface CatalogSimulationItem {
  id: string
  title: string
  subject: 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics' | string
  category: string
  emoji: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  description: string
  builtin_type?: SimulationType | null
  default_params?: Record<string, number>
}


export type SimulationType =
  | 'projectile'
  | 'projectile_3d'
  | 'solar_system_3d'
  | 'bohr_atom_3d'
  | 'molecules_3d'
  | 'dna_helix_3d'
  | 'heart_3d'
  | 'epidermis_3d'
  | 'lorenz_3d'
  | 'prism_optics_3d'
  | 'motor_3d'
  | 'eye_optics_3d'
  | 'cell_biology_3d'
  | 'ac_generator_3d'
  | 'rutherford_atom_3d'
  | 'titration_3d'
  | 'periodic_trends'
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


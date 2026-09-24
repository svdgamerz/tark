/* tslint:disable */
/* eslint-disable */
export function wasm_heat_diffusion_step(grid: Float64Array, size: number, alpha: number, decay: number): Float64Array;
export function wasm_double_pendulum_step(theta1: number, theta2: number, omega1: number, omega2: number, dt: number): Float64Array;
export function wasm_cas_differentiate(expr: string, _var: string): string;
export function wasm_cas_solve(equation: string, _var: string): string;
export function wasm_grade_submission(student_id: string, question_id: string, student_answer: string, expected_answer: string, question_type: string, tolerance: number): string;
export function wasm_analyze_logit_lens(num_layers: number, hidden_dim: number, vocab_size: number, flat_residuals: Float32Array, flat_unembed: Float32Array): string;
export class WasmHnswIndex {
  free(): void;
  constructor(dimension: number, m: number, ef_construction: number);
  size(): number;
  insert(id: number, vector: Float32Array): void;
  search(query: Float32Array, top_k: number): string;
  benchmark(query: Float32Array, top_k: number, iterations: number): string;
}
export class WasmLorenzSimulator {
  free(): void;
  /**
   * Generates N trajectory points in WebAssembly with zero JS allocation overhead
   */
  generate_trajectory(steps: number, dt: number): Float64Array;
  constructor(sigma: number, rho: number, beta: number, x: number, y: number, z: number);
  /**
   * Single Euler / RK2 step
   */
  step(dt: number): Float64Array;
}
export class WasmSteeringController {
  free(): void;
  set_active(active: boolean): void;
  num_vectors(): number;
  set_multiplier(mult: number): void;
  intervene_layer(layer: number, hidden_state: Float32Array): void;
  register_vector(name: string, layer: number, raw_vector: Float32Array, multiplier: number): void;
  constructor();
}
export class WasmVoiceActivityDetector {
  free(): void;
  process_frame(samples: Float32Array): string;
  set_tts_playing(playing: boolean): void;
  constructor(sample_rate: number, frame_size: number, energy_threshold_db: number, barge_in_threshold_db: number);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmhnswindex_free: (a: number, b: number) => void;
  readonly __wbg_wasmlorenzsimulator_free: (a: number, b: number) => void;
  readonly __wbg_wasmsteeringcontroller_free: (a: number, b: number) => void;
  readonly __wbg_wasmvoiceactivitydetector_free: (a: number, b: number) => void;
  readonly wasm_analyze_logit_lens: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
  readonly wasm_cas_differentiate: (a: number, b: number, c: number, d: number) => [number, number];
  readonly wasm_cas_solve: (a: number, b: number, c: number, d: number) => [number, number];
  readonly wasm_double_pendulum_step: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly wasm_grade_submission: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number];
  readonly wasm_heat_diffusion_step: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly wasmhnswindex_benchmark: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly wasmhnswindex_insert: (a: number, b: number, c: number, d: number) => void;
  readonly wasmhnswindex_new: (a: number, b: number, c: number) => number;
  readonly wasmhnswindex_search: (a: number, b: number, c: number, d: number) => [number, number];
  readonly wasmhnswindex_size: (a: number) => number;
  readonly wasmlorenzsimulator_generate_trajectory: (a: number, b: number, c: number) => any;
  readonly wasmlorenzsimulator_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly wasmlorenzsimulator_step: (a: number, b: number) => any;
  readonly wasmsteeringcontroller_intervene_layer: (a: number, b: number, c: number, d: number, e: any) => void;
  readonly wasmsteeringcontroller_new: () => number;
  readonly wasmsteeringcontroller_num_vectors: (a: number) => number;
  readonly wasmsteeringcontroller_register_vector: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly wasmsteeringcontroller_set_active: (a: number, b: number) => void;
  readonly wasmsteeringcontroller_set_multiplier: (a: number, b: number) => void;
  readonly wasmvoiceactivitydetector_new: (a: number, b: number, c: number, d: number) => number;
  readonly wasmvoiceactivitydetector_process_frame: (a: number, b: number, c: number) => [number, number];
  readonly wasmvoiceactivitydetector_set_tts_playing: (a: number, b: number) => void;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

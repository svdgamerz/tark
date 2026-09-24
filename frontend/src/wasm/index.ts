/**
 * Client-side WebAssembly Acceleration Engine for Tark.
 * Initializes tark_wasm.wasm and provides zero-latency physics and math solving.
 */

import initWasm, {
  WasmLorenzSimulator,
  WasmHnswIndex,
  WasmVoiceActivityDetector,
  WasmSteeringController,
  wasm_heat_diffusion_step,
  wasm_double_pendulum_step,
  wasm_cas_differentiate,
  wasm_cas_solve,
  wasm_grade_submission,
  wasm_analyze_logit_lens,
} from './tark_wasm'

let wasmReady = false
let wasmInitPromise: Promise<boolean> | null = null

export async function initTarkWasm(): Promise<boolean> {
  if (wasmReady) return true
  if (wasmInitPromise) return wasmInitPromise

  wasmInitPromise = (async () => {
    try {
      // In Vite, importing .wasm?url provides the static asset path
      const wasmUrl = new URL('./tark_wasm_bg.wasm', import.meta.url).href
      await initWasm(wasmUrl)
      wasmReady = true
      console.log('[+] Tark WebAssembly Core loaded successfully!')
      return true
    } catch (e) {
      console.warn('[-] Failed to load Tark WebAssembly, falling back to JS:', e)
      wasmReady = false
      return false
    }
  })()

  return wasmInitPromise
}

export function isWasmReady(): boolean {
  return wasmReady
}

export {
  WasmLorenzSimulator,
  WasmHnswIndex,
  WasmVoiceActivityDetector,
  WasmSteeringController,
  wasm_heat_diffusion_step,
  wasm_double_pendulum_step,
  wasm_cas_differentiate,
  wasm_cas_solve,
  wasm_grade_submission,
  wasm_analyze_logit_lens,
}

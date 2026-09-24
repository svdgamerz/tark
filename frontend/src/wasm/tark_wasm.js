let wasm;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedFloat64ArrayMemory0 = null;

function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let WASM_VECTOR_LEN = 0;

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {Float64Array} grid
 * @param {number} size
 * @param {number} alpha
 * @param {number} decay
 * @returns {Float64Array}
 */
export function wasm_heat_diffusion_step(grid, size, alpha, decay) {
    const ptr0 = passArrayF64ToWasm0(grid, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_heat_diffusion_step(ptr0, len0, size, alpha, decay);
    return ret;
}

/**
 * @param {number} theta1
 * @param {number} theta2
 * @param {number} omega1
 * @param {number} omega2
 * @param {number} dt
 * @returns {Float64Array}
 */
export function wasm_double_pendulum_step(theta1, theta2, omega1, omega2, dt) {
    const ret = wasm.wasm_double_pendulum_step(theta1, theta2, omega1, omega2, dt);
    return ret;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}
/**
 * @param {string} expr
 * @param {string} _var
 * @returns {string}
 */
export function wasm_cas_differentiate(expr, _var) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(expr, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(_var, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasm_cas_differentiate(ptr0, len0, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} equation
 * @param {string} _var
 * @returns {string}
 */
export function wasm_cas_solve(equation, _var) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(equation, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(_var, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasm_cas_solve(ptr0, len0, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} student_id
 * @param {string} question_id
 * @param {string} student_answer
 * @param {string} expected_answer
 * @param {string} question_type
 * @param {number} tolerance
 * @returns {string}
 */
export function wasm_grade_submission(student_id, question_id, student_answer, expected_answer, question_type, tolerance) {
    let deferred6_0;
    let deferred6_1;
    try {
        const ptr0 = passStringToWasm0(student_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(question_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(student_answer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(expected_answer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(question_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasm_grade_submission(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, tolerance);
        deferred6_0 = ret[0];
        deferred6_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred6_0, deferred6_1, 1);
    }
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {number} num_layers
 * @param {number} hidden_dim
 * @param {number} vocab_size
 * @param {Float32Array} flat_residuals
 * @param {Float32Array} flat_unembed
 * @returns {string}
 */
export function wasm_analyze_logit_lens(num_layers, hidden_dim, vocab_size, flat_residuals, flat_unembed) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArrayF32ToWasm0(flat_residuals, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(flat_unembed, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasm_analyze_logit_lens(num_layers, hidden_dim, vocab_size, ptr0, len0, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

const WasmHnswIndexFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmhnswindex_free(ptr >>> 0, 1));

export class WasmHnswIndex {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmHnswIndexFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmhnswindex_free(ptr, 0);
    }
    /**
     * @param {number} dimension
     * @param {number} m
     * @param {number} ef_construction
     */
    constructor(dimension, m, ef_construction) {
        const ret = wasm.wasmhnswindex_new(dimension, m, ef_construction);
        this.__wbg_ptr = ret >>> 0;
        WasmHnswIndexFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    size() {
        const ret = wasm.wasmhnswindex_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} id
     * @param {Float32Array} vector
     */
    insert(id, vector) {
        const ptr0 = passArrayF32ToWasm0(vector, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmhnswindex_insert(this.__wbg_ptr, id, ptr0, len0);
    }
    /**
     * @param {Float32Array} query
     * @param {number} top_k
     * @returns {string}
     */
    search(query, top_k) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArrayF32ToWasm0(query, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.wasmhnswindex_search(this.__wbg_ptr, ptr0, len0, top_k);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {Float32Array} query
     * @param {number} top_k
     * @param {number} iterations
     * @returns {string}
     */
    benchmark(query, top_k, iterations) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArrayF32ToWasm0(query, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.wasmhnswindex_benchmark(this.__wbg_ptr, ptr0, len0, top_k, iterations);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}

const WasmLorenzSimulatorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmlorenzsimulator_free(ptr >>> 0, 1));

export class WasmLorenzSimulator {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmLorenzSimulatorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmlorenzsimulator_free(ptr, 0);
    }
    /**
     * Generates N trajectory points in WebAssembly with zero JS allocation overhead
     * @param {number} steps
     * @param {number} dt
     * @returns {Float64Array}
     */
    generate_trajectory(steps, dt) {
        const ret = wasm.wasmlorenzsimulator_generate_trajectory(this.__wbg_ptr, steps, dt);
        return ret;
    }
    /**
     * @param {number} sigma
     * @param {number} rho
     * @param {number} beta
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(sigma, rho, beta, x, y, z) {
        const ret = wasm.wasmlorenzsimulator_new(sigma, rho, beta, x, y, z);
        this.__wbg_ptr = ret >>> 0;
        WasmLorenzSimulatorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Single Euler / RK2 step
     * @param {number} dt
     * @returns {Float64Array}
     */
    step(dt) {
        const ret = wasm.wasmlorenzsimulator_step(this.__wbg_ptr, dt);
        return ret;
    }
}

const WasmSteeringControllerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsteeringcontroller_free(ptr >>> 0, 1));

export class WasmSteeringController {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSteeringControllerFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsteeringcontroller_free(ptr, 0);
    }
    /**
     * @param {boolean} active
     */
    set_active(active) {
        wasm.wasmsteeringcontroller_set_active(this.__wbg_ptr, active);
    }
    /**
     * @returns {number}
     */
    num_vectors() {
        const ret = wasm.wasmsteeringcontroller_num_vectors(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} mult
     */
    set_multiplier(mult) {
        wasm.wasmsteeringcontroller_set_multiplier(this.__wbg_ptr, mult);
    }
    /**
     * @param {number} layer
     * @param {Float32Array} hidden_state
     */
    intervene_layer(layer, hidden_state) {
        var ptr0 = passArrayF32ToWasm0(hidden_state, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.wasmsteeringcontroller_intervene_layer(this.__wbg_ptr, layer, ptr0, len0, hidden_state);
    }
    /**
     * @param {string} name
     * @param {number} layer
     * @param {Float32Array} raw_vector
     * @param {number} multiplier
     */
    register_vector(name, layer, raw_vector, multiplier) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(raw_vector, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.wasmsteeringcontroller_register_vector(this.__wbg_ptr, ptr0, len0, layer, ptr1, len1, multiplier);
    }
    constructor() {
        const ret = wasm.wasmsteeringcontroller_new();
        this.__wbg_ptr = ret >>> 0;
        WasmSteeringControllerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const WasmVoiceActivityDetectorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmvoiceactivitydetector_free(ptr >>> 0, 1));

export class WasmVoiceActivityDetector {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmVoiceActivityDetectorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvoiceactivitydetector_free(ptr, 0);
    }
    /**
     * @param {Float32Array} samples
     * @returns {string}
     */
    process_frame(samples) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.wasmvoiceactivitydetector_process_frame(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {boolean} playing
     */
    set_tts_playing(playing) {
        wasm.wasmvoiceactivitydetector_set_tts_playing(this.__wbg_ptr, playing);
    }
    /**
     * @param {number} sample_rate
     * @param {number} frame_size
     * @param {number} energy_threshold_db
     * @param {number} barge_in_threshold_db
     */
    constructor(sample_rate, frame_size, energy_threshold_db, barge_in_threshold_db) {
        const ret = wasm.wasmvoiceactivitydetector_new(sample_rate, frame_size, energy_threshold_db, barge_in_threshold_db);
        this.__wbg_ptr = ret >>> 0;
        WasmVoiceActivityDetectorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_new_78c8a92080461d08 = function(arg0) {
        const ret = new Float64Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_93c8e0c1a479fa1a = function(arg0, arg1, arg2) {
        const ret = new Float64Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbindgen_copy_to_typed_array = function(arg0, arg1, arg2) {
        new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('tark_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;

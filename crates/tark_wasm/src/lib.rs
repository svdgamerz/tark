//! Tark WebAssembly In-Browser Acceleration Engine.
//! Executes physics simulations and symbolic computer algebra directly inside the browser at native 120 FPS.

use wasm_bindgen::prelude::*;

// =========================================================================
// 1. LORENZ CHAOTIC ATTRACTOR & LYAPUNOV EXPOSURE
// =========================================================================

#[wasm_bindgen]
pub struct WasmLorenzSimulator {
    sigma: f64,
    rho: f64,
    beta: f64,
    x: f64,
    y: f64,
    z: f64,
}

#[wasm_bindgen]
impl WasmLorenzSimulator {
    #[wasm_bindgen(constructor)]
    pub fn new(sigma: f64, rho: f64, beta: f64, x: f64, y: f64, z: f64) -> Self {
        Self { sigma, rho, beta, x, y, z }
    }

    /// Single Euler / RK2 step
    pub fn step(&mut self, dt: f64) -> js_sys::Float64Array {
        let dx = self.sigma * (self.y - self.x);
        let dy = self.x * (self.rho - self.z) - self.y;
        let dz = self.x * self.y - self.beta * self.z;

        self.x += dx * dt;
        self.y += dy * dt;
        self.z += dz * dt;

        let res = [self.x, self.y, self.z];
        js_sys::Float64Array::from(&res[..])
    }

    /// Generates N trajectory points in WebAssembly with zero JS allocation overhead
    pub fn generate_trajectory(&mut self, steps: usize, dt: f64) -> js_sys::Float64Array {
        let mut buffer = Vec::with_capacity(steps * 3);
        for _ in 0..steps {
            let dx = self.sigma * (self.y - self.x);
            let dy = self.x * (self.rho - self.z) - self.y;
            let dz = self.x * self.y - self.beta * self.z;

            self.x += dx * dt;
            self.y += dy * dt;
            self.z += dz * dt;

            buffer.push(self.x);
            buffer.push(self.y);
            buffer.push(self.z);
        }
        js_sys::Float64Array::from(&buffer[..])
    }
}

// =========================================================================
// 2. 2D HEAT DIFFUSION PDE
// =========================================================================

#[wasm_bindgen]
pub fn wasm_heat_diffusion_step(grid: &[f64], size: usize, alpha: f64, decay: f64) -> js_sys::Float64Array {
    let mut next = vec![0.0; size * size];

    for y in 1..(size - 1) {
        for x in 1..(size - 1) {
            let idx = y * size + x;
            let u = grid[idx];
            let laplacian = grid[idx - 1] + grid[idx + 1] + grid[idx - size] + grid[idx + size] - 4.0 * u;
            let val = u + alpha * laplacian - decay * u;
            next[idx] = if val > 0.0 { val } else { 0.0 };
        }
    }

    js_sys::Float64Array::from(&next[..])
}

// =========================================================================
// 3. CHAOTIC DOUBLE PENDULUM (RK4)
// =========================================================================

#[wasm_bindgen]
pub fn wasm_double_pendulum_step(
    mut theta1: f64,
    mut theta2: f64,
    mut omega1: f64,
    mut omega2: f64,
    dt: f64,
) -> js_sys::Float64Array {
    tark_core::physics::double_pendulum::rk4_step(
        &mut theta1,
        &mut theta2,
        &mut omega1,
        &mut omega2,
        dt,
    );
    let res = [theta1, theta2, omega1, omega2];
    js_sys::Float64Array::from(&res[..])
}

// =========================================================================
// 4. SYMBOLIC COMPUTER ALGEBRA (CAS) IN BROWSER
// =========================================================================

#[wasm_bindgen]
pub fn wasm_cas_differentiate(expr: &str, var: &str) -> String {
    match tark_core::cas::differentiate_expr(expr, var) {
        Ok((res, katex, steps)) => {
            let steps_json: Vec<String> = steps
                .into_iter()
                .map(|(rule, exp, lat)| {
                    format!(
                        r#"{{"rule":{},"explanation":{},"latex":{}}}"#,
                        json_str(&rule),
                        json_str(&exp),
                        json_str(&lat)
                    )
                })
                .collect();
            format!(
                r#"{{"success":true,"result":{},"katex":{},"steps":[{}]}}"#,
                json_str(&res),
                json_str(&katex),
                steps_json.join(",")
            )
        }
        Err(e) => format!(r#"{{"success":false,"error":{}}}"#, json_str(&e)),
    }
}

#[wasm_bindgen]
pub fn wasm_cas_solve(equation: &str, var: &str) -> String {
    match tark_core::cas::solve_equation(equation, var) {
        Ok((roots, steps)) => {
            let roots_json: Vec<String> = roots.into_iter().map(|r| json_str(&r)).collect();
            let steps_json: Vec<String> = steps
                .into_iter()
                .map(|(title, exp, lat)| {
                    format!(
                        r#"{{"title":{},"explanation":{},"latex":{}}}"#,
                        json_str(&title),
                        json_str(&exp),
                        json_str(&lat)
                    )
                })
                .collect();
            format!(
                r#"{{"success":true,"roots":[{}],"steps":[{}]}}"#,
                roots_json.join(","),
                steps_json.join(",")
            )
        }
        Err(e) => format!(r#"{{"success":false,"error":{}}}"#, json_str(&e)),
    }
}

// =========================================================================
// 4. HNSW VECTOR INDEX (O(log N) ANN TEXTBOOK SEARCH)
// =========================================================================

#[wasm_bindgen]
pub struct WasmHnswIndex {
    inner: tark_core::rag::hnsw::HnswIndex,
}

#[wasm_bindgen]
impl WasmHnswIndex {
    #[wasm_bindgen(constructor)]
    pub fn new(dimension: usize, m: usize, ef_construction: usize) -> Self {
        Self {
            inner: tark_core::rag::hnsw::HnswIndex::new(dimension, m, ef_construction),
        }
    }

    pub fn insert(&mut self, id: usize, vector: &[f32]) {
        self.inner.insert(id, vector.to_vec());
    }

    pub fn search(&self, query: &[f32], top_k: usize) -> String {
        let results = self.inner.search(query, top_k);
        let items: Vec<String> = results
            .into_iter()
            .map(|r| {
                format!(
                    r#"{{"id":{},"similarity":{:.6},"distance":{:.6}}}"#,
                    r.id, r.similarity, r.distance
                )
            })
            .collect();
        format!("[{}]", items.join(","))
    }

    pub fn benchmark(&self, query: &[f32], top_k: usize, iterations: usize) -> String {
        let report = self.inner.benchmark_retrieval(query, top_k, iterations);
        format!(
            r#"{{"num_vectors":{},"dimension":{},"top_k":{},"hnsw_micros":{:.2},"brute_force_micros":{:.2},"speedup_factor":{:.2},"recall_pct":{:.2}}}"#,
            report.num_vectors,
            report.dimension,
            report.top_k,
            report.hnsw_micros,
            report.brute_force_micros,
            report.speedup_factor,
            report.recall_pct
        )
    }

    pub fn size(&self) -> usize {
        self.inner.nodes.len()
    }
}

// =========================================================================
// 5. LOW-LATENCY VOICE ACTIVITY DETECTION (VAD) & BARGE-IN
// =========================================================================

#[wasm_bindgen]
pub struct WasmVoiceActivityDetector {
    inner: tark_core::audio::vad::VoiceActivityDetector,
}

#[wasm_bindgen]
impl WasmVoiceActivityDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: usize, frame_size: usize, energy_threshold_db: f32, barge_in_threshold_db: f32) -> Self {
        let mut config = tark_core::audio::vad::VadConfig::default();
        if sample_rate > 0 { config.sample_rate = sample_rate; }
        if frame_size > 0 { config.frame_size = frame_size; }
        if energy_threshold_db < 0.0 { config.energy_threshold_db = energy_threshold_db; }
        if barge_in_threshold_db < 0.0 { config.barge_in_threshold_db = barge_in_threshold_db; }

        Self {
            inner: tark_core::audio::vad::VoiceActivityDetector::new(config),
        }
    }

    pub fn set_tts_playing(&mut self, playing: bool) {
        self.inner.set_tts_playing(playing);
    }

    pub fn process_frame(&mut self, samples: &[f32]) -> String {
        let res = self.inner.process_frame(samples);
        let state_str = match res.state {
            tark_core::audio::vad::VadState::Silence => "Silence",
            tark_core::audio::vad::VadState::SpeechOnset => "SpeechOnset",
            tark_core::audio::vad::VadState::Speaking => "Speaking",
            tark_core::audio::vad::VadState::SpeechOffset => "SpeechOffset",
        };
        format!(
            r#"{{"rms_db":{:.2},"zcr":{:.4},"is_speech":{},"is_barge_in":{},"state":{},"noise_floor_db":{:.2}}}"#,
            res.rms_db,
            res.zcr,
            res.is_speech,
            res.is_barge_in,
            json_str(state_str),
            res.noise_floor_db
        )
    }
}

// =========================================================================
// 6. HOMEWORK & EXAM GRADER
// =========================================================================

#[wasm_bindgen]
pub fn wasm_grade_submission(
    student_id: &str,
    question_id: &str,
    student_answer: &str,
    expected_answer: &str,
    question_type: &str,
    tolerance: f64,
) -> String {
    let qtype = match question_type.to_lowercase().as_str() {
        "numeric" => tark_core::grader::eval::QuestionType::Numeric { tolerance: if tolerance <= 0.0 { 0.01 } else { tolerance } },
        "symbolic" => tark_core::grader::eval::QuestionType::Symbolic,
        _ => tark_core::grader::eval::QuestionType::ExactMatch,
    };

    let sub = tark_core::grader::eval::Submission {
        student_id: student_id.to_string(),
        question_id: question_id.to_string(),
        student_answer: student_answer.to_string(),
        expected_answer: expected_answer.to_string(),
        question_type: qtype,
    };

    let res = tark_core::grader::eval::grade_submission(&sub);
    format!(
        r#"{{"student_id":{},"question_id":{},"is_correct":{},"score":{:.2},"feedback":{}}}"#,
        json_str(&res.student_id),
        json_str(&res.question_id),
        res.is_correct,
        res.score,
        json_str(&res.feedback)
    )
}

// =========================================================================
// 7. TARK LENS (ACTIVATION STEERING & LOGIT LENS INTERPRETABILITY)
// =========================================================================

#[wasm_bindgen]
pub struct WasmSteeringController {
    inner: tark_core::lens::steering::SteeringController,
}

#[wasm_bindgen]
impl WasmSteeringController {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: tark_core::lens::steering::SteeringController::new(),
        }
    }

    pub fn register_vector(&mut self, name: &str, layer: usize, raw_vector: &[f32], multiplier: f32) {
        let vec = tark_core::lens::steering::SteeringVector::new(name, layer, raw_vector.to_vec(), multiplier);
        self.inner.register(vec);
    }

    pub fn set_active(&mut self, active: bool) {
        self.inner.set_active(active);
    }

    pub fn set_multiplier(&mut self, mult: f32) {
        self.inner.set_global_multiplier(mult);
    }

    pub fn intervene_layer(&self, layer: usize, hidden_state: &mut [f32]) {
        self.inner.intervene_layer(layer, hidden_state);
    }

    pub fn num_vectors(&self) -> usize {
        self.inner.num_vectors()
    }
}

#[wasm_bindgen]
pub fn wasm_analyze_logit_lens(
    num_layers: usize,
    hidden_dim: usize,
    vocab_size: usize,
    flat_residuals: &[f32],
    flat_unembed: &[f32],
) -> String {
    if flat_residuals.len() < num_layers * hidden_dim || flat_unembed.len() < vocab_size * hidden_dim {
        return "[]".to_string();
    }

    let lens = tark_core::lens::logit_lens::LogitLens::new(num_layers, hidden_dim, vocab_size);
    let mut stream = Vec::with_capacity(num_layers);
    for l in 0..num_layers {
        let start = l * hidden_dim;
        stream.push(flat_residuals[start..start + hidden_dim].to_vec());
    }

    let preds = lens.analyze_layers(&stream, flat_unembed);
    let items: Vec<String> = preds
        .into_iter()
        .map(|p| {
            format!(
                r#"{{"layer":{},"top_token_id":{},"top_probability":{:.4},"entropy":{:.4},"truth_confidence":{:.4}}}"#,
                p.layer, p.top_token_id, p.top_probability, p.entropy, p.truth_confidence
            )
        })
        .collect();
    format!("[{}]", items.join(","))
}

fn json_str(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n"))
}


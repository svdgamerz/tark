use pyo3::prelude::*;
use pyo3::types::PyBytes;

use crate::advanced_math;
use crate::cas;
use crate::math;
use crate::physics;
use crate::rag;
use crate::text;

// =========================================================================
// TEXT & ARITHMETIC GUARDS
// =========================================================================

/// Scans text (plain text and LaTeX equations) for equations (e.g., "12 × 8 = 94" or "$$12 \times 8 = 94$$")
/// and returns a verification string if any calculation is mathematically incorrect.
#[pyfunction]
#[pyo3(signature = (text, max_report = 3))]
fn check_arithmetic(text: &str, max_report: usize) -> String {
    math::check_arithmetic_fast(text, max_report)
}

/// Normalizes LaTeX math syntax into standard arithmetic string:
/// e.g. `\frac{100}{4}` -> `((100) / (4))`, `12 \times 8` -> `12 * 8`.
#[pyfunction]
fn normalize_latex(latex: &str) -> String {
    math::latex::normalize_latex_math(latex)
}

/// Fast text chunker for textbooks, syllabi, and study notes.
#[pyfunction]
#[pyo3(signature = (text, target_chunk_size = 1000, overlap = 200))]
fn chunk_text(text: &str, target_chunk_size: usize, overlap: usize) -> Vec<String> {
    text::chunk_text_fast(text, target_chunk_size, overlap)
}

// =========================================================================
// RAG VECTOR SEARCH & BM25
// =========================================================================

/// High-speed SIMD-capable Cosine Vector Search.
#[pyfunction]
#[pyo3(signature = (query, raw_embeddings, top_k = 5))]
fn search_vectors(
    query: Vec<f32>,
    raw_embeddings: Vec<Bound<'_, PyBytes>>,
    top_k: usize,
) -> Vec<(usize, f32)> {
    let byte_slices: Vec<&[u8]> = raw_embeddings.iter().map(|b| b.as_bytes()).collect();
    rag::fast_cosine_top_k(&query, &byte_slices, top_k)
}

/// In-memory BM25 Keyword Search over a corpus of document strings.
#[pyfunction]
#[pyo3(signature = (query, documents, top_k = 5, k1 = 1.2, b = 0.75))]
fn bm25_search(
    query: &str,
    documents: Vec<String>,
    top_k: usize,
    k1: f32,
    b: f32,
) -> Vec<(usize, f32)> {
    let doc_strs: Vec<&str> = documents.iter().map(|s| s.as_str()).collect();
    rag::fast_bm25_top_k(query, &doc_strs, top_k, k1, b)
}

/// Reciprocal Rank Fusion (RRF) to merge Vector Search and BM25 Search ranks.
#[pyfunction]
#[pyo3(signature = (vector_ranks, bm25_ranks, rrf_k = 60.0, top_k = 5))]
fn hybrid_fuse_ranks(
    vector_ranks: Vec<(usize, f32)>,
    bm25_ranks: Vec<(usize, f32)>,
    rrf_k: f32,
    top_k: usize,
) -> Vec<(usize, f32)> {
    rag::reciprocal_rank_fusion(&vector_ranks, &bm25_ranks, rrf_k, top_k)
}

// =========================================================================
// PHYSICS SIMULATION ENGINES
// =========================================================================

/// N-Body Gravitational Dynamics with Symplectic Velocity-Verlet Integration.
#[pyfunction]
#[pyo3(signature = (initial_bodies, dt, steps, softening = 0.05, g = 1.0))]
fn simulate_nbody(
    initial_bodies: Vec<(f64, f64, f64, f64, f64, f64, f64)>,
    dt: f64,
    steps: usize,
    softening: f64,
    g: f64,
) -> (Vec<(f64, f64, f64, f64, f64, f64, f64)>, f64) {
    let mut bodies: Vec<physics::nbody::Body> = initial_bodies
        .into_iter()
        .map(|(x, y, z, vx, vy, vz, mass)| physics::nbody::Body {
            x, y, z, vx, vy, vz, mass,
        })
        .collect();

    physics::nbody::nbody_velocity_verlet(&mut bodies, dt, steps, softening, g);
    let energy = physics::nbody::compute_total_energy(&bodies, softening, g);

    let result = bodies
        .into_iter()
        .map(|b| (b.x, b.y, b.z, b.vx, b.vy, b.vz, b.mass))
        .collect();

    (result, energy)
}

/// Chaotic Double Pendulum Simulator using 4th-Order Runge-Kutta (RK4).
#[pyfunction]
#[pyo3(signature = (theta1, theta2, omega1 = 0.0, omega2 = 0.0, num_steps = 10000, dt = 0.001, sample_stride = 10))]
fn simulate_double_pendulum(
    theta1: f64,
    theta2: f64,
    omega1: f64,
    omega2: f64,
    num_steps: usize,
    dt: f64,
    sample_stride: usize,
) -> Vec<(f64, f64, f64, f64)> {
    physics::double_pendulum::simulate_double_pendulum(
        theta1,
        theta2,
        omega1,
        omega2,
        num_steps,
        dt,
        sample_stride,
    )
}

/// 2D Parabolic Heat Diffusion PDE Solver using Finite Difference Method.
#[pyfunction]
#[pyo3(signature = (grid_size = 64, steps = 100, alpha = 0.25, initial_hotspots = None))]
fn simulate_heat_diffusion(
    grid_size: usize,
    steps: usize,
    alpha: f64,
    initial_hotspots: Option<Vec<(usize, usize, f64)>>,
) -> (Vec<f64>, f64) {
    let mut solver = physics::heat_equation::HeatEquation2D::new(grid_size, alpha);
    if let Some(hotspots) = initial_hotspots {
        for (x, y, temp) in hotspots {
            solver.set_hotspot(x, y, temp);
        }
    } else {
        let center = grid_size / 2;
        solver.set_hotspot(center, center, 100.0);
    }

    solver.step_n(steps);
    let max_temp = solver.max_temperature();
    (solver.grid().to_vec(), max_temp)
}

// =========================================================================
// ADVANCED MATHEMATICS
// =========================================================================

/// Simulates the 3D Lorenz Strange Attractor.
#[pyfunction]
#[pyo3(signature = (initial_state = (1.0, 1.0, 1.0), sigma = 10.0, rho = 28.0, beta = 2.6666666666666665, steps = 10000, dt = 0.01, sample_stride = 1))]
fn lorenz_trajectory(
    initial_state: (f64, f64, f64),
    sigma: f64,
    rho: f64,
    beta: f64,
    steps: usize,
    dt: f64,
    sample_stride: usize,
) -> Vec<(f64, f64, f64)> {
    advanced_math::simulate_lorenz_attractor(
        initial_state,
        sigma,
        rho,
        beta,
        steps,
        dt,
        sample_stride,
    )
}

/// Computes the Maximal Lyapunov Exponent (MLE) for the Lorenz system.
#[pyfunction]
#[pyo3(signature = (initial_state = (1.0, 1.0, 1.0), sigma = 10.0, rho = 28.0, beta = 2.6666666666666665, steps = 100000, dt = 0.005, tau_steps = 10))]
fn lorenz_lyapunov_exponent(
    initial_state: (f64, f64, f64),
    sigma: f64,
    rho: f64,
    beta: f64,
    steps: usize,
    dt: f64,
    tau_steps: usize,
) -> f64 {
    advanced_math::compute_lyapunov_exponent(
        initial_state,
        sigma,
        rho,
        beta,
        steps,
        dt,
        tau_steps,
    )
}

/// Evaluates the stiff Fermi-Dirac integral F_{1/2}(eta).
#[pyfunction]
fn fermi_dirac_integral(eta: f64) -> f64 {
    advanced_math::gauss_legendre_fermi_dirac(eta)
}

/// Evaluates the 3D Debye phonon heat capacity function D_3(x).
#[pyfunction]
fn debye_function(x: f64) -> f64 {
    advanced_math::gauss_legendre_debye(x)
}

/// Computes in-place Radix-2 Cooley-Tukey Fast Fourier Transform (FFT).
#[pyfunction]
#[pyo3(signature = (re, im, inverse = false))]
fn fft(mut re: Vec<f64>, mut im: Vec<f64>, inverse: bool) -> (Vec<f64>, Vec<f64>) {
    advanced_math::fft_radix2(&mut re, &mut im, inverse);
    (re, im)
}

/// Finds all complex roots of a monic polynomial P(z) = z^n + sum(coeffs[i]*z^i) = 0
/// using the Durand-Kerner (Weierstrass) simultaneous iterative solver.
#[pyfunction]
#[pyo3(signature = (coeffs, max_iter = 100, tol = 1e-10))]
fn polynomial_roots(coeffs: Vec<f64>, max_iter: usize, tol: f64) -> Vec<(f64, f64)> {
    advanced_math::durand_kerner_roots(&coeffs, max_iter, tol)
}

// =========================================================================
// COMPUTER ALGEBRA SYSTEM (CAS) & SYMBOLIC DERIVATIONS
// =========================================================================

/// Differentiates a symbolic mathematical expression string with respect to `var`.
/// Returns (simplified_derivative, katex_output, step_by_step_derivation_list).
#[pyfunction]
#[pyo3(signature = (expr, var = "x"))]
fn cas_differentiate(expr: &str, var: &str) -> PyResult<(String, String, Vec<(String, String, String)>)> {
    cas::differentiate_expr(expr, var)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Symbolically simplifies an algebraic expression string.
/// Returns (simplified_string, katex_output).
#[pyfunction]
fn cas_simplify(expr: &str) -> PyResult<(String, String)> {
    cas::simplify_expr(expr)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Solves an equation ("LHS = RHS" or "f(x) = 0") for `var`.
/// Returns (roots, step_by_step_solutions).
#[pyfunction]
#[pyo3(signature = (equation, var = "x"))]
fn cas_solve(equation: &str, var: &str) -> PyResult<(Vec<String>, Vec<(String, String, String)>)> {
    cas::solve_equation(equation, var)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))
}

/// Returns true to indicate that Tark is running with the native Rust acceleration module.
#[pyfunction]
fn is_rust_accelerated() -> bool {
    true
}

/// Tark Core native PyO3 extension module
#[pymodule]
pub fn tark_core(m: &Bound<'_, PyModule>) -> PyResult<()> {
    // Text & Math Guards
    m.add_function(wrap_pyfunction!(check_arithmetic, m)?)?;
    m.add_function(wrap_pyfunction!(normalize_latex, m)?)?;
    m.add_function(wrap_pyfunction!(chunk_text, m)?)?;

    // RAG Engine
    m.add_function(wrap_pyfunction!(search_vectors, m)?)?;
    m.add_function(wrap_pyfunction!(bm25_search, m)?)?;
    m.add_function(wrap_pyfunction!(hybrid_fuse_ranks, m)?)?;

    // Physics Simulation Engines
    m.add_function(wrap_pyfunction!(simulate_nbody, m)?)?;
    m.add_function(wrap_pyfunction!(simulate_double_pendulum, m)?)?;
    m.add_function(wrap_pyfunction!(simulate_heat_diffusion, m)?)?;

    // Advanced Mathematics
    m.add_function(wrap_pyfunction!(lorenz_trajectory, m)?)?;
    m.add_function(wrap_pyfunction!(lorenz_lyapunov_exponent, m)?)?;
    m.add_function(wrap_pyfunction!(fermi_dirac_integral, m)?)?;
    m.add_function(wrap_pyfunction!(debye_function, m)?)?;
    m.add_function(wrap_pyfunction!(fft, m)?)?;
    m.add_function(wrap_pyfunction!(polynomial_roots, m)?)?;

    // Computer Algebra System (CAS)
    m.add_function(wrap_pyfunction!(cas_differentiate, m)?)?;
    m.add_function(wrap_pyfunction!(cas_simplify, m)?)?;
    m.add_function(wrap_pyfunction!(cas_solve, m)?)?;

    m.add_function(wrap_pyfunction!(is_rust_accelerated, m)?)?;
    Ok(())
}

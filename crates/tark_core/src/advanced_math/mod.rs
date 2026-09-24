//! Advanced PhD-level mathematical engines and numerical solvers for Tark.

pub mod fft;
pub mod lorenz;
pub mod quadrature;
pub mod roots;

pub use fft::fft_radix2;
pub use lorenz::{simulate_lorenz_attractor, compute_lyapunov_exponent};
pub use quadrature::{gauss_legendre_fermi_dirac, gauss_legendre_debye};
pub use roots::durand_kerner_roots;

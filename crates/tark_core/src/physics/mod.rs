//! High-performance physics simulation engines for Tark.

pub mod double_pendulum;
pub mod heat_equation;
pub mod nbody;

pub use double_pendulum::{simulate_double_pendulum_rk4, DoublePendulumState};
pub use heat_equation::simulate_heat_2d_fdm;
pub use nbody::{simulate_nbody_gravity, Body};

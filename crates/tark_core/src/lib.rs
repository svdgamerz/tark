//! Tark Core acceleration library.

pub mod advanced_math;
pub mod audio;
pub mod cas;
pub mod grader;
pub mod lens;
pub mod math;
pub mod physics;
pub mod rag;
pub mod text;

#[cfg(feature = "python")]
pub mod python_bindings;

//! Tark Lens: Mechanistic Interpretability, Logit Lens, and Activation Steering.
//!
//! Provides real-time residual stream probing, anti-sycophancy steering, and
//! concept crystallization tracking across transformer layers.

pub mod logit_lens;
pub mod steering;

pub use logit_lens::*;
pub use steering::*;

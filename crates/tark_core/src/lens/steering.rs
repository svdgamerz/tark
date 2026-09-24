//! Activation Steering & Representation Intervention Engine for Tark Lens.
//!
//! Implements Contrastive Activation Addition (CAA) on transformer residual streams.
//! Steers model internal hidden representations towards pedagogical truthfulness,
//! anti-sycophancy, and mathematical rigor with sub-microsecond overhead.

use std::collections::HashMap;

/// Mode of representation steering intervention
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SteeringMode {
    /// Contrastive Activation Addition: h <- h + alpha * v
    Addition,
    /// Projection Clamp: remove sycophantic projection from h
    OrthogonalProjection,
    /// Directional Amplification: project h onto v and scale
    Amplification,
}

/// A calibrated steering vector for a specific transformer layer
#[derive(Clone, Debug)]
pub struct SteeringVector {
    pub name: String,
    pub layer: usize,
    pub dimension: usize,
    pub direction: Vec<f32>,
    pub default_multiplier: f32,
    pub mode: SteeringMode,
}

impl SteeringVector {
    pub fn new(name: &str, layer: usize, raw_vector: Vec<f32>, default_multiplier: f32) -> Self {
        let dimension = raw_vector.len();
        let mut direction = raw_vector;

        // Normalize direction to unit L2 norm
        let norm_sq: f32 = direction.iter().map(|&x| x * x).sum();
        let norm = norm_sq.sqrt();
        if norm > 1e-9 {
            for x in direction.iter_mut() {
                *x /= norm;
            }
        }

        Self {
            name: name.to_string(),
            layer,
            dimension,
            direction,
            default_multiplier,
            mode: SteeringMode::Addition,
        }
    }

    /// Apply steering intervention in-place to residual stream hidden state
    #[inline]
    pub fn apply(&self, hidden_state: &mut [f32], multiplier: f32) {
        if hidden_state.len() != self.dimension {
            return;
        }

        let alpha = self.default_multiplier * multiplier;
        if alpha.abs() < 1e-7 {
            return;
        }

        match self.mode {
            SteeringMode::Addition => {
                // Loop unrolled 4-way for fast auto-vectorization
                let n = self.dimension;
                let chunks = n / 4;
                for i in 0..chunks {
                    let idx = i * 4;
                    hidden_state[idx] += alpha * self.direction[idx];
                    hidden_state[idx + 1] += alpha * self.direction[idx + 1];
                    hidden_state[idx + 2] += alpha * self.direction[idx + 2];
                    hidden_state[idx + 3] += alpha * self.direction[idx + 3];
                }
                for i in (chunks * 4)..n {
                    hidden_state[i] += alpha * self.direction[i];
                }
            }
            SteeringMode::OrthogonalProjection => {
                // Remove projection along sycophancy vector: h <- h - (h . v) * v
                let dot: f32 = hidden_state.iter().zip(self.direction.iter()).map(|(&h, &v)| h * v).sum();
                for (h, &v) in hidden_state.iter_mut().zip(self.direction.iter()) {
                    *h -= alpha * dot * v;
                }
            }
            SteeringMode::Amplification => {
                let dot: f32 = hidden_state.iter().zip(self.direction.iter()).map(|(&h, &v)| h * v).sum();
                for (h, &v) in hidden_state.iter_mut().zip(self.direction.iter()) {
                    *h += alpha * dot * v;
                }
            }
        }
    }
}

/// Registry and controller for multi-layer activation steering
#[derive(Clone, Debug)]
pub struct SteeringController {
    vectors: HashMap<String, SteeringVector>,
    layer_indices: HashMap<usize, Vec<String>>,
    global_multiplier: f32,
    is_active: bool,
}

impl Default for SteeringController {
    fn default() -> Self {
        Self::new()
    }
}

impl SteeringController {
    pub fn new() -> Self {
        Self {
            vectors: HashMap::new(),
            layer_indices: HashMap::new(),
            global_multiplier: 1.0,
            is_active: true,
        }
    }

    /// Register a steering vector for a specific layer
    pub fn register(&mut self, vector: SteeringVector) {
        let name = vector.name.clone();
        let layer = vector.layer;

        self.layer_indices.entry(layer).or_default().push(name.clone());
        self.vectors.insert(name, vector);
    }

    /// Set whether steering interventions are globally active
    pub fn set_active(&mut self, active: bool) {
        self.is_active = active;
    }

    pub fn set_global_multiplier(&mut self, mult: f32) {
        self.global_multiplier = mult;
    }

    /// Apply all registered interventions for the given layer
    pub fn intervene_layer(&self, layer: usize, hidden_state: &mut [f32]) {
        if !self.is_active || self.global_multiplier.abs() < 1e-7 {
            return;
        }

        if let Some(vector_names) = self.layer_indices.get(&layer) {
            for name in vector_names {
                if let Some(vec) = self.vectors.get(name) {
                    vec.apply(hidden_state, self.global_multiplier);
                }
            }
        }
    }

    /// Count active steering vectors
    pub fn num_vectors(&self) -> usize {
        self.vectors.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steering_vector_addition() {
        let dim = 8;
        let dir = vec![1.0; dim];
        let vec = SteeringVector::new("anti_sycophancy", 5, dir, 2.0);

        let mut hidden = vec![0.0f32; dim];
        vec.apply(&mut hidden, 1.0);

        // Vector was normalized, so each component should be 2.0 * (1 / sqrt(8))
        let expected = 2.0 * (1.0 / (8.0f32).sqrt());
        for &h in &hidden {
            assert!((h - expected).abs() < 1e-5);
        }
    }

    #[test]
    fn test_steering_controller() {
        let mut controller = SteeringController::new();
        let v1 = SteeringVector::new("truth", 4, vec![1.0, 0.0, 0.0, 0.0], 1.5);
        let v2 = SteeringVector::new("rigor", 4, vec![0.0, 1.0, 0.0, 0.0], 2.0);

        controller.register(v1);
        controller.register(v2);

        let mut hidden = vec![0.0f32; 4];
        controller.intervene_layer(4, &mut hidden);

        assert!((hidden[0] - 1.5).abs() < 1e-5);
        assert!((hidden[1] - 2.0).abs() < 1e-5);
    }
}

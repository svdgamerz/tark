//! Logit Lens & Residual Stream Truth Probing Engine for Tark Lens.
//!
//! Projects intermediate residual activations across transformer layers to track
//! concept crystallization, token entropy, and latent truthfulness probabilities.

/// Layer-wise breakdown of residual stream predictions
#[derive(Clone, Debug)]
pub struct LayerPrediction {
    pub layer: usize,
    pub top_token_id: usize,
    pub top_probability: f32,
    pub entropy: f32,
    pub truth_confidence: f32,
}

/// Linear probe for detecting latent truthfulness vs sycophantic acquiescence
#[derive(Clone, Debug)]
pub struct TruthProbe {
    pub layer: usize,
    pub weights: Vec<f32>,
    pub bias: f32,
}

impl TruthProbe {
    pub fn new(layer: usize, weights: Vec<f32>, bias: f32) -> Self {
        Self { layer, weights, bias }
    }

    /// Evaluates the probe on a hidden state vector, returning calibrated probability in [0, 1]
    #[inline]
    pub fn evaluate(&self, hidden_state: &[f32]) -> f32 {
        if hidden_state.len() != self.weights.len() {
            return 0.5;
        }

        let mut dot = self.bias;
        let n = self.weights.len();
        let chunks = n / 4;
        for i in 0..chunks {
            let idx = i * 4;
            dot += hidden_state[idx] * self.weights[idx]
                + hidden_state[idx + 1] * self.weights[idx + 1]
                + hidden_state[idx + 2] * self.weights[idx + 2]
                + hidden_state[idx + 3] * self.weights[idx + 3];
        }
        for i in (chunks * 4)..n {
            dot += hidden_state[i] * self.weights[i];
        }

        // Standard logistic sigmoid: 1 / (1 + exp(-x))
        1.0 / (1.0 + (-dot).exp())
    }
}

/// Logit Lens analyzer for projecting residual streams across layers
#[derive(Clone, Debug)]
pub struct LogitLens {
    pub num_layers: usize,
    pub hidden_dim: usize,
    pub vocab_size: usize,
    pub probes: Vec<TruthProbe>,
}

impl LogitLens {
    pub fn new(num_layers: usize, hidden_dim: usize, vocab_size: usize) -> Self {
        Self {
            num_layers,
            hidden_dim,
            vocab_size,
            probes: Vec::new(),
        }
    }

    pub fn add_probe(&mut self, probe: TruthProbe) {
        self.probes.push(probe);
    }

    /// Analyze residual activations across all transformer layers
    pub fn analyze_layers(
        &self,
        residual_stream: &[Vec<f32>],
        unembedding_weights: &[f32], // Flattened (vocab_size, hidden_dim)
    ) -> Vec<LayerPrediction> {
        let mut predictions = Vec::with_capacity(residual_stream.len());

        for (layer_idx, hidden) in residual_stream.iter().enumerate() {
            if hidden.len() != self.hidden_dim {
                continue;
            }

            // 1. Compute intermediate logits = hidden * W_U^T
            let mut top_token = 0;
            let mut max_logit = -f32::INFINITY;
            let mut logits = Vec::with_capacity(self.vocab_size);

            for v in 0..self.vocab_size {
                let mut logit = 0.0f32;
                let offset = v * self.hidden_dim;
                for d in 0..self.hidden_dim {
                    logit += hidden[d] * unembedding_weights[offset + d];
                }
                logits.push(logit);
                if logit > max_logit {
                    max_logit = logit;
                    top_token = v;
                }
            }

            // 2. Softmax probabilities and Shannon entropy
            let mut sum_exp = 0.0f32;
            for logit in &logits {
                sum_exp += (logit - max_logit).exp();
            }

            let mut entropy = 0.0f32;
            let top_prob = (logits[top_token] - max_logit).exp() / sum_exp.max(1e-12);

            for logit in &logits {
                let p = (logit - max_logit).exp() / sum_exp.max(1e-12);
                if p > 1e-9 {
                    entropy -= p * p.ln();
                }
            }

            // 3. Truth probe confidence for this layer
            let truth_confidence = self
                .probes
                .iter()
                .find(|p| p.layer == layer_idx)
                .map(|p| p.evaluate(hidden))
                .unwrap_or(0.5);

            predictions.push(LayerPrediction {
                layer: layer_idx,
                top_token_id: top_token,
                top_probability: top_prob,
                entropy,
                truth_confidence,
            });
        }

        predictions
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truth_probe_evaluation() {
        let weights = vec![1.0, -1.0, 2.0];
        let probe = TruthProbe::new(0, weights, 0.0);

        let h_true = vec![2.0, -1.0, 1.0]; // dot = 2*1 + (-1)*(-1) + 1*2 = 2 + 1 + 2 = 5 -> high prob
        let p_true = probe.evaluate(&h_true);
        assert!(p_true > 0.95);

        let h_false = vec![-2.0, 2.0, -1.0]; // dot = -2*1 + 2*(-1) + (-1)*2 = -6 -> low prob
        let p_false = probe.evaluate(&h_false);
        assert!(p_false < 0.05);
    }

    #[test]
    fn test_logit_lens_entropy_reduction() {
        let lens = LogitLens::new(2, 4, 3);
        let w_u = vec![
            1.0, 0.0, 0.0, 0.0, // token 0
            0.0, 1.0, 0.0, 0.0, // token 1
            0.0, 0.0, 1.0, 0.0, // token 2
        ];

        let stream = vec![
            vec![1.0, 1.0, 1.0, 0.0], // Early layer: equal logits -> high entropy
            vec![5.0, 0.1, 0.1, 0.0], // Deep layer: sharp logit for token 0 -> low entropy
        ];

        let preds = lens.analyze_layers(&stream, &w_u);
        assert_eq!(preds.len(), 2);
        assert!(preds[0].entropy > preds[1].entropy, "Entropy must decrease as concept crystallizes");
        assert_eq!(preds[1].top_token_id, 0);
    }
}

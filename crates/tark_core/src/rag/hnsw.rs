//! Hierarchical Navigable Small World (HNSW) Vector Index for Tark RAG.
//!
//! Provides ultra-fast O(log N) approximate nearest neighbor search over high-dimensional
//! textbook chunk embeddings (768-dim, 1536-dim, etc.) with SIMD-friendly vector operations.

use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashSet};

/// Lightweight deterministic XorShift64 PRNG for fast level sampling.
#[derive(Clone, Debug)]
pub struct FastRng {
    state: u64,
}

impl FastRng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 { 0x8a5cd789635d2dff } else { seed },
        }
    }

    #[inline(always)]
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    /// Sample uniform f64 in range (0.0, 1.0)
    #[inline(always)]
    pub fn next_f64(&mut self) -> f64 {
        let val = (self.next_u64() >> 11) as f64;
        (val + 1.0) / 9007199254740992.0
    }
}

/// Computes normalized cosine distance: 1.0 - cosine_similarity.
/// Range: [0.0, 2.0] where 0.0 means identical direction.
#[inline]
pub fn cosine_distance(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len());
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    // 4-way loop unrolling for auto-vectorization
    let chunks = n / 4;
    for i in 0..chunks {
        let idx = i * 4;
        let a0 = a[idx];
        let a1 = a[idx + 1];
        let a2 = a[idx + 2];
        let a3 = a[idx + 3];

        let b0 = b[idx];
        let b1 = b[idx + 1];
        let b2 = b[idx + 2];
        let b3 = b[idx + 3];

        dot += a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
        norm_a += a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
        norm_b += b0 * b0 + b1 * b1 + b2 * b2 + b3 * b3;
    }

    for i in (chunks * 4)..n {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    let denom = (norm_a * norm_b).sqrt();
    if denom <= 1e-12 {
        1.0
    } else {
        (1.0 - (dot / denom)).max(0.0)
    }
}

/// Candidate node for priority queues.
#[derive(Clone, Debug, PartialEq)]
pub struct Candidate {
    pub node_idx: usize,
    pub dist: f32,
}

impl Eq for Candidate {}

// Ordering for Min-Heap (closest distance first)
impl Ord for Candidate {
    fn cmp(&self, other: &Self) -> Ordering {
        other.dist.partial_cmp(&self.dist).unwrap_or(Ordering::Equal)
    }
}

impl PartialOrd for Candidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Max-Heap item (furthest distance first)
#[derive(Clone, Debug, PartialEq)]
pub struct MaxCandidate {
    pub node_idx: usize,
    pub dist: f32,
}

impl Eq for MaxCandidate {}

impl Ord for MaxCandidate {
    fn cmp(&self, other: &Self) -> Ordering {
        self.dist.partial_cmp(&other.dist).unwrap_or(Ordering::Equal)
    }
}

impl PartialOrd for MaxCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Node in the HNSW multi-layer graph.
#[derive(Clone, Debug)]
pub struct HnswNode {
    pub id: usize,
    pub vector: Vec<f32>,
    pub level: usize,
    /// neighbors[l] is the list of node indices connected at level l
    pub neighbors: Vec<Vec<usize>>,
}

/// Result of an approximate nearest neighbor search.
#[derive(Clone, Debug)]
pub struct SearchResult {
    pub id: usize,
    pub similarity: f32,
    pub distance: f32,
}

/// Benchmark comparison between HNSW and exhaustive linear scan.
#[derive(Clone, Debug)]
pub struct HnswBenchmarkReport {
    pub num_vectors: usize,
    pub dimension: usize,
    pub top_k: usize,
    pub hnsw_micros: f64,
    pub brute_force_micros: f64,
    pub speedup_factor: f64,
    pub recall_pct: f64,
}

/// Hierarchical Navigable Small World (HNSW) index.
#[derive(Clone, Debug)]
pub struct HnswIndex {
    pub dimension: usize,
    pub m: usize,
    pub m0: usize,
    pub ef_construction: usize,
    pub ef_search: usize,
    pub ml: f64,
    pub enter_point: Option<usize>,
    pub max_level: usize,
    pub nodes: Vec<HnswNode>,
    rng: FastRng,
}

impl HnswIndex {
    /// Create a new HNSW index with standard hyperparameters.
    pub fn new(dimension: usize, m: usize, ef_construction: usize) -> Self {
        let m = m.max(4);
        let m0 = 2 * m;
        let ef_construction = ef_construction.max(m);
        let ml = 1.0 / (m as f64).ln();

        Self {
            dimension,
            m,
            m0,
            ef_construction,
            ef_search: 32,
            ml,
            enter_point: None,
            max_level: 0,
            nodes: Vec::new(),
            rng: FastRng::new(42),
        }
    }

    /// Sample a random layer level from an exponential decay distribution.
    fn sample_level(&mut self) -> usize {
        let u = self.rng.next_f64();
        (-u.ln() * self.ml).floor() as usize
    }

    /// Search layer `level` using greedy best-first search, returning `ef` closest candidates.
    fn search_layer(
        &self,
        query: &[f32],
        entry_points: &[usize],
        ef: usize,
        level: usize,
    ) -> Vec<Candidate> {
        let mut visited = HashSet::with_capacity(ef * 4);
        let mut candidates = BinaryHeap::new(); // Min-Heap: closest first
        let mut best_set = BinaryHeap::new();  // Max-Heap: furthest first

        for &ep in entry_points {
            if ep < self.nodes.len() {
                let d = cosine_distance(query, &self.nodes[ep].vector);
                visited.insert(ep);
                candidates.push(Candidate { node_idx: ep, dist: d });
                best_set.push(MaxCandidate { node_idx: ep, dist: d });
            }
        }

        while let Some(curr) = candidates.pop() {
            // If closest candidate is farther than the furthest in best_set (and best_set is full), stop
            if let Some(furthest) = best_set.peek() {
                if curr.dist > furthest.dist && best_set.len() >= ef {
                    break;
                }
            }

            let node = &self.nodes[curr.node_idx];
            if level < node.neighbors.len() {
                for &neighbor_idx in &node.neighbors[level] {
                    if visited.insert(neighbor_idx) && neighbor_idx < self.nodes.len() {
                        let d = cosine_distance(query, &self.nodes[neighbor_idx].vector);
                        let furthest_dist = best_set.peek().map(|c| c.dist).unwrap_or(f32::INFINITY);

                        if d < furthest_dist || best_set.len() < ef {
                            candidates.push(Candidate { node_idx: neighbor_idx, dist: d });
                            best_set.push(MaxCandidate { node_idx: neighbor_idx, dist: d });
                            if best_set.len() > ef {
                                best_set.pop();
                            }
                        }
                    }
                }
            }
        }

        // Return candidates sorted closest first
        let mut result: Vec<Candidate> = best_set
            .into_iter()
            .map(|mc| Candidate { node_idx: mc.node_idx, dist: mc.dist })
            .collect();
        result.sort_by(|a, b| a.dist.partial_cmp(&b.dist).unwrap_or(Ordering::Equal));
        result
    }

    /// Insert a vector into the HNSW graph.
    pub fn insert(&mut self, id: usize, vector: Vec<f32>) {
        assert_eq!(vector.len(), self.dimension, "Vector dimension mismatch");

        let node_idx = self.nodes.len();
        let target_level = self.sample_level();

        // Initialize node neighbors for all layers up to target_level
        let neighbors = vec![Vec::new(); target_level + 1];
        self.nodes.push(HnswNode {
            id,
            vector: vector.clone(),
            level: target_level,
            neighbors,
        });

        // If first node, set entry point
        if self.enter_point.is_none() {
            self.enter_point = Some(node_idx);
            self.max_level = target_level;
            return;
        }

        let mut curr_ep = self.enter_point.unwrap();
        let mut curr_dist = cosine_distance(&vector, &self.nodes[curr_ep].vector);

        // 1. Zoom down from max_level to target_level + 1 using 1-greedy search
        if self.max_level > target_level {
            for level in (target_level + 1..=self.max_level).rev() {
                let mut changed = true;
                while changed {
                    changed = false;
                    if level < self.nodes[curr_ep].neighbors.len() {
                        for &neighbor in &self.nodes[curr_ep].neighbors[level] {
                            let d = cosine_distance(&vector, &self.nodes[neighbor].vector);
                            if d < curr_dist {
                                curr_dist = d;
                                curr_ep = neighbor;
                                changed = true;
                            }
                        }
                    }
                }
            }
        }

        // 2. From min(max_level, target_level) down to 0, connect neighbors
        let start_level = self.max_level.min(target_level);
        let mut entry_candidates = vec![curr_ep];

        for level in (0..=start_level).rev() {
            let candidates = self.search_layer(&vector, &entry_candidates, self.ef_construction, level);
            let m_max = if level == 0 { self.m0 } else { self.m };

            // Select best m_max neighbors
            let selected_neighbors: Vec<usize> = candidates
                .iter()
                .take(m_max)
                .map(|c| c.node_idx)
                .collect();

            // Connect bidirectionally
            self.nodes[node_idx].neighbors[level] = selected_neighbors.clone();
            for &n_idx in &selected_neighbors {
                self.nodes[n_idx].neighbors[level].push(node_idx);
                // Prune neighbor if it exceeds capacity
                if self.nodes[n_idx].neighbors[level].len() > m_max {
                    self.prune_neighbors(n_idx, level, m_max);
                }
            }

            entry_candidates = selected_neighbors;
        }

        // 3. Update entry point if target_level is higher than max_level
        if target_level > self.max_level {
            self.max_level = target_level;
            self.enter_point = Some(node_idx);
        }
    }

    /// Prune connections of a node at given level to keep only the closest `m_max`.
    fn prune_neighbors(&mut self, node_idx: usize, level: usize, m_max: usize) {
        let node_vec = self.nodes[node_idx].vector.clone();
        let mut scored: Vec<(usize, f32)> = self.nodes[node_idx].neighbors[level]
            .iter()
            .map(|&nb| (nb, cosine_distance(&node_vec, &self.nodes[nb].vector)))
            .collect();

        scored.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(Ordering::Equal));
        self.nodes[node_idx].neighbors[level] = scored.into_iter().take(m_max).map(|s| s.0).collect();
    }

    /// Approximate nearest neighbor search.
    /// Returns the top-k results sorted descending by cosine similarity.
    pub fn search(&self, query: &[f32], top_k: usize) -> Vec<SearchResult> {
        if self.nodes.is_empty() || top_k == 0 || self.enter_point.is_none() {
            return Vec::new();
        }

        let mut curr_ep = self.enter_point.unwrap();
        let mut curr_dist = cosine_distance(query, &self.nodes[curr_ep].vector);

        // Greedy zoom down from max_level to 1
        for level in (1..=self.max_level).rev() {
            let mut changed = true;
            while changed {
                changed = false;
                if level < self.nodes[curr_ep].neighbors.len() {
                    for &neighbor in &self.nodes[curr_ep].neighbors[level] {
                        let d = cosine_distance(query, &self.nodes[neighbor].vector);
                        if d < curr_dist {
                            curr_dist = d;
                            curr_ep = neighbor;
                            changed = true;
                        }
                    }
                }
            }
        }

        // Layer 0 search with ef_search candidate pool
        let ef = self.ef_search.max(top_k);
        let candidates = self.search_layer(query, &[curr_ep], ef, 0);

        candidates
            .into_iter()
            .take(top_k)
            .map(|c| {
                let node = &self.nodes[c.node_idx];
                let similarity = (1.0 - c.dist).max(-1.0).min(1.0);
                SearchResult {
                    id: node.id,
                    similarity,
                    distance: c.dist,
                }
            })
            .collect()
    }

    /// Exact brute-force linear scan over all nodes for ground-truth recall verification.
    pub fn search_brute_force(&self, query: &[f32], top_k: usize) -> Vec<SearchResult> {
        if self.nodes.is_empty() || top_k == 0 {
            return Vec::new();
        }

        let mut scored: Vec<(usize, f32)> = self
            .nodes
            .iter()
            .map(|node| (node.id, cosine_distance(query, &node.vector)))
            .collect();

        scored.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(Ordering::Equal));

        scored
            .into_iter()
            .take(top_k)
            .map(|(id, dist)| SearchResult {
                id,
                similarity: (1.0 - dist).max(-1.0).min(1.0),
                distance: dist,
            })
            .collect()
    }

    /// Run side-by-side benchmark comparing HNSW log(N) traversal vs Brute Force linear scan.
    pub fn benchmark_retrieval(&self, query: &[f32], top_k: usize, iterations: usize) -> HnswBenchmarkReport {
        let iters = iterations.max(1);

        // Warmup
        let _ = self.search(query, top_k);
        let _ = self.search_brute_force(query, top_k);

        // HNSW timing
        let start_hnsw = std::time::Instant::now();
        let mut hnsw_res = Vec::new();
        for _ in 0..iters {
            hnsw_res = self.search(query, top_k);
        }
        let hnsw_micros = start_hnsw.elapsed().as_secs_f64() * 1_000_000.0 / (iters as f64);

        // Brute Force timing
        let start_bf = std::time::Instant::now();
        let mut bf_res = Vec::new();
        for _ in 0..iters {
            bf_res = self.search_brute_force(query, top_k);
        }
        let bf_micros = start_bf.elapsed().as_secs_f64() * 1_000_000.0 / (iters as f64);

        // Calculate recall @ k
        let bf_ids: HashSet<usize> = bf_res.iter().map(|r| r.id).collect();
        let matched = hnsw_res.iter().filter(|r| bf_ids.contains(&r.id)).count();
        let recall_pct = if !bf_ids.is_empty() {
            (matched as f64 / bf_ids.len() as f64) * 100.0
        } else {
            100.0
        };

        let speedup = if hnsw_micros > 0.0 {
            bf_micros / hnsw_micros
        } else {
            1.0
        };

        HnswBenchmarkReport {
            num_vectors: self.nodes.len(),
            dimension: self.dimension,
            top_k,
            hnsw_micros,
            brute_force_micros: bf_micros,
            speedup_factor: speedup,
            recall_pct,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hnsw_construction_and_search() {
        let dim = 32;
        let mut index = HnswIndex::new(dim, 16, 64);

        // Insert 100 vectors
        for i in 0..100 {
            let mut v = vec![0.0f32; dim];
            v[i % dim] = 1.0;
            v[(i * 3) % dim] += 0.5;
            index.insert(i, v);
        }

        assert_eq!(index.nodes.len(), 100);

        // Query with vector 5
        let mut query = vec![0.0f32; dim];
        query[5 % dim] = 1.0;
        query[(5 * 3) % dim] += 0.5;

        let res = index.search(&query, 5);
        assert!(!res.is_empty());
        // The top match should be id 5 with distance ~ 0
        assert_eq!(res[0].id, 5);
        assert!(res[0].distance < 1e-4);
    }

    #[test]
    fn test_hnsw_benchmark() {
        let dim = 64;
        let mut index = HnswIndex::new(dim, 16, 64);

        for i in 0..300 {
            let mut v = vec![0.0f32; dim];
            v[i % dim] = 1.0;
            v[(i * 7) % dim] += 0.3;
            index.insert(i, v);
        }

        let mut q = vec![0.0f32; dim];
        q[10] = 1.0;
        let report = index.benchmark_retrieval(&q, 10, 5);
        assert!(report.recall_pct >= 90.0);
    }
}

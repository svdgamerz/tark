//! High-performance vector cosine similarity and BM25 search engine for Tark RAG.

pub mod hnsw;
pub use hnsw::*;

use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet};

#[derive(Clone, Debug)]
struct ScoredItem {
    index: usize,
    score: f32,
}

impl PartialEq for ScoredItem {
    fn eq(&self, other: &Self) -> bool {
        self.score == other.score
    }
}

impl Eq for ScoredItem {}

// Reverse ordering for Min-Heap: smallest score on top
impl Ord for ScoredItem {
    fn cmp(&self, other: &Self) -> Ordering {
        // Handle NaN safely by ordering NaN as less
        other
            .score
            .partial_cmp(&self.score)
            .unwrap_or(Ordering::Equal)
    }
}

impl PartialOrd for ScoredItem {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Compute cosine similarity between query and float32 byte buffers.
/// Returns the top-k (index, score) pairs sorted descending by score.
pub fn fast_cosine_top_k(
    query: &[f32],
    raw_embeddings: &[&[u8]],
    top_k: usize,
) -> Vec<(usize, f32)> {
    if query.is_empty() || raw_embeddings.is_empty() || top_k == 0 {
        return Vec::new();
    }

    let q_norm_sq: f32 = query.iter().map(|&x| x * x).sum();
    if q_norm_sq <= 1e-12 {
        return Vec::new();
    }
    let q_norm = q_norm_sq.sqrt();

    let mut heap: BinaryHeap<ScoredItem> = BinaryHeap::with_capacity(top_k + 1);

    for (idx, &raw_bytes) in raw_embeddings.iter().enumerate() {
        if raw_bytes.len() != query.len() * 4 {
            continue; // Mismatched dimension
        }

        // Zero-copy reinterpret byte slice as &[f32]
        // Alignment: check if aligned or use chunks
        let is_aligned = (raw_bytes.as_ptr() as usize) % std::mem::align_of::<f32>() == 0;
        
        let (dot, emb_norm_sq) = if is_aligned {
            let float_slice = unsafe {
                std::slice::from_raw_parts(raw_bytes.as_ptr() as *const f32, query.len())
            };
            let mut dot = 0.0f32;
            let mut norm_sq = 0.0f32;
            for i in 0..query.len() {
                let a = query[i];
                let b = float_slice[i];
                dot += a * b;
                norm_sq += b * b;
            }
            (dot, norm_sq)
        } else {
            let mut dot = 0.0f32;
            let mut norm_sq = 0.0f32;
            for (i, chunk) in raw_bytes.chunks_exact(4).enumerate() {
                let b = f32::from_ne_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
                let a = query[i];
                dot += a * b;
                norm_sq += b * b;
            }
            (dot, norm_sq)
        };

        if emb_norm_sq <= 1e-12 {
            continue;
        }

        let sim = dot / (q_norm * emb_norm_sq.sqrt());

        if heap.len() < top_k {
            heap.push(ScoredItem { index: idx, score: sim });
        } else if let Some(min_item) = heap.peek() {
            if sim > min_item.score {
                heap.pop();
                heap.push(ScoredItem { index: idx, score: sim });
            }
        }
    }

    // Drain heap into descending order
    let mut results: Vec<ScoredItem> = heap.into_vec();
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(Ordering::Equal));

    results.into_iter().map(|item| (item.index, item.score)).collect()
}

/// Tokenize string into lowercase alphanumeric words
fn tokenize(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 2)
        .map(|w| w.to_lowercase())
        .collect()
}

/// Fast BM25 keyword search over a corpus of document strings.
/// Returns top_k (index, score) pairs sorted descending by BM25 score.
pub fn fast_bm25_top_k(
    query: &str,
    documents: &[&str],
    top_k: usize,
    k1: f32,
    b: f32,
) -> Vec<(usize, f32)> {
    let q_tokens = tokenize(query);
    if q_tokens.is_empty() || documents.is_empty() || top_k == 0 {
        return Vec::new();
    }

    let n = documents.len() as f32;
    let mut doc_tokens: Vec<Vec<String>> = Vec::with_capacity(documents.len());
    let mut total_len = 0usize;
    let mut doc_freqs: HashMap<String, usize> = HashMap::new();

    for &doc in documents {
        let tokens = tokenize(doc);
        total_len += tokens.len();

        let unique: HashSet<&str> = tokens.iter().map(|s| s.as_str()).collect();
        for word in unique {
            *doc_freqs.entry(word.to_string()).or_insert(0) += 1;
        }

        doc_tokens.push(tokens);
    }

    let avgdl = (total_len as f32) / n.max(1.0);

    // Compute IDFs for query tokens
    let mut idfs: HashMap<&str, f32> = HashMap::new();
    for token in &q_tokens {
        if let Some(&df) = doc_freqs.get(token.as_str()) {
            // Lucene BM25 IDF formulation: ln(1 + (N - df + 0.5) / (df + 0.5))
            let idf = ((n - (df as f32) + 0.5) / ((df as f32) + 0.5) + 1.0).ln().max(0.0);
            idfs.insert(token.as_str(), idf);
        }
    }

    let mut heap: BinaryHeap<ScoredItem> = BinaryHeap::with_capacity(top_k + 1);

    for (idx, tokens) in doc_tokens.iter().enumerate() {
        if tokens.is_empty() {
            continue;
        }

        let doc_len = tokens.len() as f32;
        let mut tf_map: HashMap<&str, f32> = HashMap::new();
        for tok in tokens {
            if idfs.contains_key(tok.as_str()) {
                *tf_map.entry(tok.as_str()).or_insert(0.0) += 1.0;
            }
        }

        let mut score = 0.0f32;
        for (&q_tok, &idf) in &idfs {
            if let Some(&tf) = tf_map.get(q_tok) {
                let numerator = tf * (k1 + 1.0);
                let denominator = tf + k1 * (1.0 - b + b * (doc_len / avgdl));
                score += idf * (numerator / denominator);
            }
        }

        if score > 0.0 {
            if heap.len() < top_k {
                heap.push(ScoredItem { index: idx, score });
            } else if let Some(min_item) = heap.peek() {
                if score > min_item.score {
                    heap.pop();
                    heap.push(ScoredItem { index: idx, score });
                }
            }
        }
    }

    let mut results: Vec<ScoredItem> = heap.into_vec();
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(Ordering::Equal));

    results.into_iter().map(|item| (item.index, item.score)).collect()
}

/// Reciprocal Rank Fusion (RRF) to merge Vector Hits and BM25 Hits.
/// rrf_score = sum(1.0 / (rrf_k + rank))
pub fn reciprocal_rank_fusion(
    vector_ranks: &[(usize, f32)],
    bm25_ranks: &[(usize, f32)],
    rrf_k: f32,
    top_k: usize,
) -> Vec<(usize, f32)> {
    let mut scores: HashMap<usize, f32> = HashMap::new();

    for (rank, &(idx, _)) in vector_ranks.iter().enumerate() {
        let rrf = 1.0 / (rrf_k + (rank as f32) + 1.0);
        *scores.entry(idx).or_insert(0.0) += rrf;
    }

    for (rank, &(idx, _)) in bm25_ranks.iter().enumerate() {
        let rrf = 1.0 / (rrf_k + (rank as f32) + 1.0);
        *scores.entry(idx).or_insert(0.0) += rrf;
    }

    let mut ranked: Vec<(usize, f32)> = scores.into_iter().collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));
    ranked.truncate(top_k);
    ranked
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let q = vec![1.0, 0.0, 0.0];
        let d1: Vec<f32> = vec![1.0, 0.0, 0.0];
        let d2: Vec<f32> = vec![0.0, 1.0, 0.0];
        let d3: Vec<f32> = vec![0.7071, 0.7071, 0.0];

        let b1 = unsafe { std::slice::from_raw_parts(d1.as_ptr() as *const u8, 12) };
        let b2 = unsafe { std::slice::from_raw_parts(d2.as_ptr() as *const u8, 12) };
        let b3 = unsafe { std::slice::from_raw_parts(d3.as_ptr() as *const u8, 12) };

        let hits = fast_cosine_top_k(&q, &[b1, b2, b3], 2);
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].0, 0); // d1 has score ~1.0
        assert_eq!(hits[1].0, 2); // d3 has score ~0.707
    }

    #[test]
    fn test_bm25_search() {
        let docs = vec![
            "Ohm's law states that current is directly proportional to voltage.",
            "Photosynthesis is the process used by plants to convert light energy into chemical energy.",
            "Newton's laws of motion describe the relationship between a body and the forces acting upon it.",
        ];

        let hits = fast_bm25_top_k("Ohm's law voltage current", &docs, 2, 1.2, 0.75);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].0, 0);
    }
}

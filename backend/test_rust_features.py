import struct
import sys
import numpy as np
import tark_core

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def test_features():
    print("[*] Testing tark_core expanded features...")

    # 1. LaTeX Normalization & LaTeX Equation Arithmetic Checking
    latex_text = r"""
    Let's derive the values:
    $$\frac{100}{4} = 22$$
    And also the square term:
    $$12 \times 8 = 94$$
    And a valid formula:
    $$2^{10} = 1024$$
    """
    check_res = tark_core.check_arithmetic(latex_text, 3)
    print(f"[+] LaTeX Arithmetic Verification:\n    {check_res.strip()}")
    assert "100" in check_res and "25" in check_res, "Expected (100) / (4) = 22 -> 25"
    assert "12 * 8 = 94" in check_res and "96" in check_res, "Expected 12 * 8 = 94 -> 96"
    assert "1024" not in check_res, "Valid equation should not be reported"

    # 2. High-speed Vector Search
    dim = 384
    query = np.random.randn(dim).astype(np.float32)
    query /= np.linalg.norm(query)

    num_docs = 2000
    docs = np.random.randn(num_docs, dim).astype(np.float32)
    # Make document 42 almost identical to query
    docs[42] = query * 0.99 + np.random.randn(dim) * 0.01

    raw_blobs = [d.tobytes() for d in docs]

    top_hits = tark_core.search_vectors(query.tolist(), raw_blobs, 5)
    print(f"[+] Top Vector Hits: {top_hits[:3]}")
    assert top_hits[0][0] == 42, f"Expected doc 42 at rank 0, got {top_hits[0][0]}"
    assert top_hits[0][1] > 0.95, f"Expected high cosine similarity, got {top_hits[0][1]}"

    # 3. BM25 Search
    corpus = [
        "Newton's second law states that acceleration is force divided by mass F = ma",
        "Ohm's law relates voltage, current, and resistance in electrical circuits V = IR",
        "Photosynthesis allows green plants to convert solar radiation into glucose and oxygen",
        "Mendelian inheritance principles govern genetic allele distribution in biology",
        "Snell's law describes the refraction of light rays passing between different media",
    ]
    bm25_hits = tark_core.bm25_search("Ohm's electrical resistance voltage", corpus, 3)
    print(f"[+] BM25 Hits for Ohm's law: {bm25_hits}")
    assert bm25_hits[0][0] == 1, f"Expected doc 1 for Ohm's law, got {bm25_hits[0][0]}"

    # 4. Hybrid Reciprocal Rank Fusion (RRF)
    # Merge dummy ranks
    v_ranks = [(1, 0.92), (0, 0.85), (4, 0.72)]
    b_ranks = [(1, 4.5), (4, 3.2), (2, 1.8)]
    hybrid = tark_core.hybrid_fuse_ranks(v_ranks, b_ranks, 60.0, 3)
    print(f"[+] Hybrid Fusion Ranks: {hybrid}")
    assert hybrid[0][0] == 1, "Doc 1 should rank first in hybrid fusion"

    print("\n[+] ALL TARK CORE RUST ENHANCEMENTS VERIFIED SUCCESSFULLY! 🚀")

if __name__ == "__main__":
    test_features()

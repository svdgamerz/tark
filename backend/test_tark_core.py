import sys
import time
import tark_core

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def test_rust_core():
    print(f"[+] tark_core.is_rust_accelerated(): {tark_core.is_rust_accelerated()}")

    # Test arithmetic checker
    text = "The user claims: 12 * 8 = 94, but earlier had 5 + 5 = 10, and 2^8 = 256."
    res = tark_core.check_arithmetic(text, 3)
    print(f"[+] check_arithmetic result:\n    {res}")

    # Test text chunker
    long_text = """Tark is an intelligent AI tutoring system designed to empower students.
It features adaptive difficulty, knowledge graph mapping, and interactive pedagogical guidance.

With the native Rust acceleration module, CPU-intensive operations such as mathematical verification and textbook chunking are offloaded from Python to Rust.
This results in virtually zero allocation overhead, sub-millisecond execution times, and zero memory leaks."""
    chunks = tark_core.chunk_text(long_text, 120, 20)
    print(f"[+] chunk_text produced {len(chunks)} chunks:")
    for i, c in enumerate(chunks):
        print(f"    Chunk {i+1} ({len(c)} chars): {repr(c[:40])}...")

if __name__ == "__main__":
    test_rust_core()

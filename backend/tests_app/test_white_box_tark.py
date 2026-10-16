"""White-Box Testing Suite for Tark STEM AI & Virtual Lab Architecture.

Tests internal logic, data structures, boundary conditions, error handling,
RAG retrieval, simulation compilation, curriculum resolution, and routing.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import unittest
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.curriculum_catalog import (
    KNOWN_TEXTBOOK_MAP,
    KNOWN_CHAPTERS_MAP,
)
from app.textbook_service import (
    get_chapter_grounding,
    normalize_board,
    normalize_grade,
    normalize_subject,
)
from app.router.prompt_engineer import _is_academic_query
from app.simulations.engine import (
    detect_simulation_candidate,
    is_simulation_eligible_topic,
    find_textbook_grounding_for_topic,
)
from app.simulations.harness import build_harness_html
from app.simulations.catalog import load_custom_catalog, get_catalog, get_catalog_item


class TestCurriculumCatalogWhiteBox(unittest.TestCase):
    """White-box tests for curriculum catalog data structures, lookup algorithms, and boundary cases."""

    def test_textbook_map_integrity(self):
        """Verify KNOWN_TEXTBOOK_MAP keys and values obey the (board, grade, subject) -> filename schema."""
        self.assertIsInstance(KNOWN_TEXTBOOK_MAP, dict)
        self.assertGreater(len(KNOWN_TEXTBOOK_MAP), 30)

        for (board, grade, subject), filename in KNOWN_TEXTBOOK_MAP.items():
            self.assertIsInstance(board, str)
            self.assertTrue(len(board) > 0, "Board must not be empty string")
            self.assertIsInstance(grade, str)
            self.assertTrue(len(grade) > 0, "Grade must not be empty string")
            self.assertIsInstance(subject, str)
            self.assertTrue(len(subject) > 0, "Subject must not be empty string")
            self.assertIsInstance(filename, str)
            self.assertTrue(filename.endswith(".pdf"), f"Textbook file must end with .pdf: {filename}")

    def test_chapters_map_integrity(self):
        """Verify KNOWN_CHAPTERS_MAP contains valid chapter lists with page bounds."""
        self.assertIsInstance(KNOWN_CHAPTERS_MAP, dict)
        self.assertGreater(len(KNOWN_CHAPTERS_MAP), 20)

        for (board, grade, subject), chapters in KNOWN_CHAPTERS_MAP.items():
            self.assertIsInstance(chapters, list)
            self.assertGreater(len(chapters), 0, f"Chapters list for {board}/{grade}/{subject} cannot be empty")
            for chap in chapters:
                self.assertIsInstance(chap, dict)
                self.assertIn("chapter", chap)
                self.assertIn("start_page", chap)
                self.assertIn("end_page", chap)
                self.assertGreaterEqual(chap["end_page"], chap["start_page"])

    def test_normalization_heuristics(self):
        """Test board, grade, and subject normalizers handle dirty input and case variations."""
        # Board normalization
        self.assertEqual(normalize_board("cbse"), "CBSE (NCERT)")
        self.assertEqual(normalize_board("ncert"), "CBSE (NCERT)")
        self.assertEqual(normalize_board("maharashtra"), "Maharashtra State Board (Balbharati)")
        self.assertEqual(normalize_board("balbharati"), "Maharashtra State Board (Balbharati)")
        self.assertEqual(normalize_board("icse"), "ICSE (CISCE)")

        # Grade normalization
        self.assertEqual(normalize_grade("class 10"), "10")
        self.assertEqual(normalize_grade("10th"), "10")
        self.assertEqual(normalize_grade("std 9"), "9")
        self.assertEqual(normalize_grade("grade 12"), "12")
        self.assertEqual(normalize_grade("X"), "10")
        self.assertEqual(normalize_grade("IX"), "9")

        # Subject normalization
        self.assertEqual(normalize_subject("sci"), "Science")
        self.assertEqual(normalize_subject("mathematics"), "Maths")
        self.assertEqual(normalize_subject("hist"), "History")


class TestChapterResolverWhiteBox(unittest.TestCase):
    """White-box testing of regex patterns, chapter resolution heuristics, and multi-turn state."""

    def test_exact_and_fuzzy_chapter_matching(self):
        """Test chapter resolver maps natural student queries to authentic textbook chapters."""
        cases = [
            ("what is chapter 5 of class 9 science cbse", "Fundamental Unit of Life"),
            ("which is the 1st chapter of 10th maths cbse", "Real Numbers"),
            ("what is 1st chapter of class 9 history cbse", "French Revolution"),
            ("name of chapter 1 of 10th science state board", "Gravitation"),
        ]
        for query, expected_keyword in cases:
            grounding = get_chapter_grounding(query)
            self.assertIsNotNone(grounding, f"Resolver failed on query: '{query}'")
            self.assertIn(
                expected_keyword.lower(),
                grounding.lower(),
                f"Expected '{expected_keyword}' in grounding for '{query}'. Got: {grounding}",
            )

    def test_boundary_empty_and_noise_queries(self):
        """Verify chapter resolver safely handles non-chapter, empty, or garbage input."""
        self.assertIsNone(get_chapter_grounding(""))
        self.assertIsNone(get_chapter_grounding("   "))
        self.assertIsNone(get_chapter_grounding("hello how are you"))
        self.assertIsNone(get_chapter_grounding("tell me a joke about physics"))


class TestAcademicRouterWhiteBox(unittest.TestCase):
    """White-box testing of academic safety classifier and jailbreak prevention."""

    def test_academic_query_positive_branches(self):
        """STEM and humanities academic queries must resolve to True."""
        academic_samples = [
            ("explain newton third law", {"board": "CBSE", "grade": "10"}),
            ("derive ohms law with circuit diagram", {"exam": "JEE"}),
            ("what is photosynthesis and light reaction", {"board": "ICSE", "grade": "9", "subject": "Biology"}),
            ("solve quadratic equation by factorization", {"grade": "10"}),
            ("calculate molar mass of sulphuric acid", {"subject": "Chemistry"}),
        ]
        for query, ctx in academic_samples:
            self.assertTrue(
                _is_academic_query(query, ctx),
                f"Query should be classified as academic: '{query}' with ctx {ctx}",
            )

    def test_academic_query_negative_branches(self):
        """Non-academic, general software development, or casual questions must resolve to False."""
        non_academic_samples = [
            ("how to install mongodb on ubuntu", None),
            ("write a python script for web scraping", None),
            ("how to deploy on render", None),
            ("give me a recipe for chocolate cake", None),
            ("how to create a react app", None),
            ("who won the 2024 cricket world cup", None),
        ]
        for query, ctx in non_academic_samples:
            self.assertFalse(
                _is_academic_query(query, ctx),
                f"Query should be classified as NON-academic: '{query}'",
            )


class TestSimulationHarnessWhiteBox(unittest.TestCase):
    """White-box verification of Master Virtual Lab Simulation Harness compiler and drawing primitives."""

    def test_build_harness_html_complete_spec(self):
        """Verify build_harness_html produces valid HTML5 with dual-panel layout, canvas, audio, and scripts."""
        spec: dict[str, Any] = {
            "title": "🧪 Test Electric Field Simulation",
            "subject": "Physics",
            "formula": "E = k·Q / r²",
            "readouts": [
                {"label": "Electric Field (E)", "calc_js": "((8.99 * p.Q) / (p.r * p.r)).toFixed(2)", "unit": "N/C"},
                {"label": "Force on Charge", "calc_js": "((p.Q * p.q0) / (p.r * p.r)).toFixed(3)", "unit": "N"},
            ],
            "params": [
                {"key": "Q", "label": "Source Charge (Q)", "min": 1, "max": 20, "step": 1, "default": 5, "unit": "μC"},
                {"key": "r", "label": "Distance (r)", "min": 0.5, "max": 5.0, "step": 0.1, "default": 2.0, "unit": "m"},
                {"key": "q0", "label": "Test Charge (q0)", "min": 1, "max": 5, "step": 0.5, "default": 1.0, "unit": "μC"},
            ],
            "presets": [
                {"label": "Standard (r = 2m)", "params": {"Q": 5, "r": 2.0, "q0": 1.0}},
                {"label": "Near Field (r = 0.5m)", "params": {"Q": 10, "r": 0.5, "q0": 1.0}},
                {"label": "Weak Source", "params": {"Q": 1, "r": 4.0, "q0": 1.0}},
            ],
            "components": [
                {"name": "Central Charge Q", "role": "Produces radial electrostatic field", "formula": "E = kQ/r²", "bounds_js": "{x: appW*0.25, y: appH*0.4, w: 40, h: 40}"},
                {"name": "Field Vector", "role": "Represents field direction and magnitude", "formula": "F = q0·E", "bounds_js": "{x: appW*0.35, y: appH*0.45, w: 100, h: 30}"},
            ],
            "graph": {
                "title": "Electric Field vs Distance (E vs r)",
                "formula": "E ∝ 1/r²",
                "xLabel": "Distance r (m)",
                "yLabel": "Field E (N/C)",
                "xMin": 0.5,
                "xMax": 5.0,
                "yMin": 0,
                "yMax": 100,
                "fn_js": "(8.99 * p.Q) / (x * x)",
                "getCurrentX_js": "p.r",
            },
            "draw_apparatus_code": """
            helpers.drawSphere({x: appW*0.28, y: appH*0.5, r: 22, color: '#ef4444', label: '+Q'});
            helpers.drawVector({x1: appW*0.35, y1: appH*0.5, x2: appW*0.65, y2: appH*0.5, color: '#38bdf8', label: 'E'});
            helpers.drawSphere({x: appW*0.65, y: appH*0.5, r: 12, color: '#10b981', label: '+q0'});
            """,
        }

        html = build_harness_html(spec)
        self.assertIsInstance(html, str)
        self.assertGreater(len(html), 15000, "Compiled harness HTML must be at least 15KB")

        # HTML Structure assertions
        self.assertTrue(html.startswith("<!DOCTYPE html>"))
        self.assertTrue(html.strip().endswith("</html>"))
        self.assertIn('<canvas id="simCanvas">', html)
        self.assertIn('id="topBar"', html)
        self.assertIn('id="dock"', html)
        self.assertIn('id="inspectorCard"', html)

        # Mathematical and Script assertions
        self.assertIn("Electric Field (E)", html)
        self.assertIn("Standard (r = 2m)", html)
        self.assertIn("drawSphere", html)
        self.assertIn("drawVector", html)
        self.assertIn("drawAnalyticalGraph", html)
        self.assertIn("AudioContext", html)

    def test_harness_compiler_escaped_braces_and_edge_inputs(self):
        """Verify harness does not crash on empty/minimal specs or JS functions containing curly braces."""
        minimal_spec: dict[str, Any] = {
            "title": "Minimal Spec Test",
            "subject": "STEM",
            "params": [{"key": "x", "label": "X Var", "min": 0, "max": 10, "default": 5}],
            "presets": [],
            "readouts": [],
            "components": [],
            "graph": {"fn_js": "x * 2"},
            "draw_apparatus_code": "if (true) { const val = 42; ctx.fillRect(10, 10, val, val); }",
        }
        # Must compile cleanly without KeyError or FormatError
        html = build_harness_html(minimal_spec)
        self.assertIn("Minimal Spec Test", html)
        self.assertIn("const val = 42;", html)


class TestSimulationEngineCandidateDetection(unittest.TestCase):
    """White-box testing of simulation eligibility filtering and topic candidate matching."""

    def test_eligible_topic_detection(self):
        """Verify STEM physical, biological, chemical, and mathematical topics pass eligibility checks."""
        positive_topics = [
            "Hydraulic lift and Pascal's principle",
            "Doppler effect in moving sirens",
            "Enzyme substrate kinetics and Michaelis-Menten",
            "Simple harmonic motion of spring pendulum",
            "Rutherford gold foil alpha scattering",
            "Acid base neutralization titration curve",
        ]
        for topic in positive_topics:
            self.assertTrue(
                is_simulation_eligible_topic(topic),
                f"Topic should be eligible for simulation: '{topic}'",
            )

    def test_ineligible_topics(self):
        """Verify non-STEM, non-simulatable queries are correctly rejected early."""
        negative_topics = [
            "What is the date of the Battle of Plassey",
            "Who was the second president of India",
            "Write a leave application letter to the principal",
            "Grammar rules for past participle in English",
        ]
        for topic in negative_topics:
            self.assertFalse(
                is_simulation_eligible_topic(topic),
                f"Topic should NOT be eligible for simulation: '{topic}'",
            )

    def test_detect_simulation_candidate_builtins(self):
        """Verify built-in simulation keywords correctly match their respective types."""
        cases = [
            ("demonstrate projectile motion", ("projectile_3d", "projectile")),
            ("explain human eye optics and myopia", ("eye_optics_3d", "eye")),
            ("show rutherford scattering experiment", ("rutherford_atom_3d", "rutherford")),
            ("simulate ac generator slip rings", ("ac_generator_3d", "generator")),
        ]
        for query, expected_types in cases:
            cand = detect_simulation_candidate(query)
            self.assertIsNotNone(cand, f"Candidate detector failed for: '{query}'")
            self.assertIn(
                cand["type"],
                expected_types,
                f"Candidate type {cand['type']} not in expected {expected_types} for '{query}'",
            )


class TestRAGDatabaseWhiteBox(unittest.TestCase):
    """White-box testing of the SQLite RAG database files, schemas, and integrity."""

    def test_tark_rag_database_schema(self):
        """Verify tark_rag.db exists and contains valid indexed chunks and metadata."""
        db_path = BACKEND_DIR / "tark_rag.db"
        self.assertTrue(db_path.exists(), f"tark_rag.db must exist at {db_path}")

        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Check existing tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        self.assertGreater(len(tables), 0, "tark_rag.db must contain at least one table")

        # Check chunk count
        cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='chunks';")
        has_chunks = cursor.fetchone()[0]
        if has_chunks:
            cursor.execute("SELECT count(*) FROM chunks;")
            chunk_count = cursor.fetchone()[0]
            self.assertGreater(chunk_count, 0, "chunks table must contain indexed curriculum data")

        conn.close()

    def test_tark_database_user_and_chat_tables(self):
        """Verify primary tark.db contains necessary tables for sessions and memory."""
        db_path = BACKEND_DIR / "tark.db"
        self.assertTrue(db_path.exists(), f"tark.db must exist at {db_path}")

        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        self.assertIn("users", tables)


class TestFastAPIEndpointsWhiteBox(unittest.TestCase):
    """White-box integration tests for REST API endpoints using TestClient."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_ping_endpoint(self):
        """Verify /ping returns HTTP 200 and PONG text."""
        res_ping = self.client.get("/ping")
        self.assertEqual(res_ping.status_code, 200)
        self.assertEqual(res_ping.text, "PONG")

    def test_root_endpoint(self):
        """Verify / returns HTTP 200 and PONG text."""
        res_root = self.client.get("/")
        self.assertEqual(res_root.status_code, 200)
        self.assertEqual(res_root.text, "PONG")

    def test_simulations_catalog_api(self):
        """Verify /api/simulations/catalog returns the curated and custom simulations."""
        res = self.client.get("/api/simulations/catalog")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("catalog", data)
        self.assertGreater(len(data["catalog"]), 15)

    def test_simulations_detail_api(self):
        """Verify /api/simulations/catalog/{id} returns the full simulation payload."""
        res = self.client.get("/api/simulations/catalog/sim_eye_optics_3d")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("simulation", data)
        self.assertEqual(data["simulation"]["id"], "sim_eye_optics_3d")

    def test_simulations_detail_not_found(self):
        """Verify non-existent simulation ID returns HTTP 404 with structured error."""
        res = self.client.get("/api/simulations/catalog/sim_non_existent_12345")
        self.assertEqual(res.status_code, 404)

    def test_cas_endpoints_symbolic_math(self):
        """Verify CAS differentiation and equation solving endpoints."""
        res_status = self.client.get("/api/cas/status")
        self.assertEqual(res_status.status_code, 200)
        self.assertEqual(res_status.json().get("status"), "online")

        # Test differentiation of x^3 + sin(x)
        res_diff = self.client.post("/api/cas/diff", json={"expr": "x^3 + sin(x)", "var": "x"})
        self.assertEqual(res_diff.status_code, 200)
        diff_data = res_diff.json()
        self.assertTrue(diff_data.get("success"))
        self.assertIn("cos", diff_data["result"])

        # Test solving quadratic x^2 - 9 = 0
        res_solve = self.client.post("/api/cas/solve", json={"equation": "x^2 - 9 = 0", "var": "x"})
        self.assertEqual(res_solve.status_code, 200)
        solve_data = res_solve.json()
        self.assertTrue(solve_data.get("success"))
        roots_str = str(solve_data.get("roots", []))
        self.assertIn("3", roots_str)
        self.assertIn("-3", roots_str)

    def test_grader_batch_evaluation(self):
        """Verify grading router handles numeric, symbolic, and exact match questions with tolerances."""
        payload = {
            "submissions": [
                {
                    "student_id": "std_01",
                    "question_id": "q1",
                    "student_answer": "9.81",
                    "expected_answer": "9.8",
                    "question_type": "numeric",
                    "tolerance": 0.05,
                },
                {
                    "student_id": "std_02",
                    "question_id": "q2",
                    "student_answer": "2*x + 3",
                    "expected_answer": "2x + 3",
                    "question_type": "symbolic",
                },
                {
                    "student_id": "std_03",
                    "question_id": "q3",
                    "student_answer": "Mitochondria",
                    "expected_answer": "mitochondria",
                    "question_type": "exact",
                },
            ]
        }
        res = self.client.post("/api/grader/batch", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("total_submissions"), 3)
        self.assertEqual(data.get("passed_count"), 3)
        self.assertEqual(data.get("pass_rate"), 100.0)


class TestCorrectnessCheckerWhiteBox(unittest.TestCase):
    """White-box testing of the arithmetic correctness guard and SymPy verification layer."""

    def test_arithmetic_verifier_correct_equations(self):
        """Correct equations must pass without false alarm notes."""
        from app.correctness.checker import check_arithmetic

        self.assertEqual(check_arithmetic("Since 12 * 8 = 96, the total cost is 96."), "")
        self.assertEqual(check_arithmetic("We know that 25 + 75 = 100."), "")
        self.assertEqual(check_arithmetic("50 - 15 = 35 meters."), "")

    def test_arithmetic_verifier_incorrect_equations(self):
        """Erroneous integer math statements must trigger a corrective note."""
        from app.correctness.checker import check_arithmetic

        err_text = "The area is calculated as 12 * 8 = 94 square units."
        note = check_arithmetic(err_text)
        self.assertNotEqual(note, "")
        self.assertIn("96", note)


class TestTextbookPageRendererWhiteBox(unittest.TestCase):
    """White-box testing of dynamic curriculum study card rendering when physical PDF page is requested."""

    def test_render_generated_textbook_page_png(self):
        """Verify fallback textbook page generator produces valid PNG bytes with proper headers."""
        from app.textbook_service import render_generated_textbook_page_png

        img_bytes = render_generated_textbook_page_png(
            board="CBSE",
            grade="10",
            subject="Science",
            chapter="Light - Reflection and Refraction",
            page_number=1,
            topic="Snell's Law",
        )
        self.assertIsNotNone(img_bytes)
        self.assertIsInstance(img_bytes, bytes)
        self.assertGreater(len(img_bytes), 1000)
        # Verify PNG signature bytes: 0x89 'P' 'N' 'G' 0x0D 0x0A 0x1A 0x0A
        self.assertEqual(img_bytes[:4], b"\x89PNG")


def run_white_box_suite():
    """Execute the full test suite and return pass/fail counts."""
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    suite.addTests(loader.loadTestsFromTestCase(TestCurriculumCatalogWhiteBox))
    suite.addTests(loader.loadTestsFromTestCase(TestChapterResolverWhiteBox))
    suite.addTests(loader.loadTestsFromTestCase(TestAcademicRouterWhiteBox))
    suite.addTests(loader.loadTestsFromTestCase(TestSimulationHarnessWhiteBox))
    suite.addTests(loader.loadTestsFromTestCase(TestSimulationEngineCandidateDetection))
    suite.addTests(loader.loadTestsFromTestCase(TestRAGDatabaseWhiteBox))
    suite.addTests(loader.loadTestsFromTestCase(TestFastAPIEndpointsWhiteBox))
    suite.addTests(loader.loadTestsFromTestCase(TestCorrectnessCheckerWhiteBox))
    suite.addTests(loader.loadTestsFromTestCase(TestTextbookPageRendererWhiteBox))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result


if __name__ == "__main__":
    result = run_white_box_suite()
    sys.exit(0 if result.wasSuccessful() else 1)

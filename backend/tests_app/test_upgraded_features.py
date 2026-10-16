"""Master Automated Test Suite for Tark Upgraded Features:
1. Bi-directional Lab Copilot Bridge (Simulation Iframe <-> Frontend Bridge)
2. Guided Discovery Quests (Inquiry Missions Engine with Verification & XP)
3. Authentic Textbook Reader with Concept Highlighting + Multi-State Board Support
4. Step-by-Step CAS Math Engine with Interactive Tangent Sliders & Derivations
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.main import app
from app.simulations.harness import build_harness_html
from app.curriculum_catalog import KNOWN_CHAPTERS_MAP, KNOWN_TEXTBOOK_MAP
from app.textbook_service import (
    normalize_board,
    normalize_grade,
    normalize_subject,
    render_generated_textbook_page_png,
)
from app.cas.solver import (
    differentiate,
    solve,
    simplify,
    get_function_graph_data,
    parse_math_expression,
)


class TestLabCopilotAndMissionsEngine(unittest.TestCase):
    """Tests for Feature 1 (Bi-directional Copilot) & Feature 2 (Discovery Quests)."""

    def setUp(self):
        self.spec = {
            "title": "Projectile Motion Virtual Lab",
            "subject": "Physics",
            "params": [
                {"key": "angle", "label": "Launch Angle", "min": 0, "max": 90, "default": 45, "unit": "deg"},
                {"key": "v0", "label": "Initial Velocity", "min": 5, "max": 60, "default": 25, "unit": "m/s"},
            ],
            "presets": [
                {"label": "Standard Earth", "params": {"angle": 45, "v0": 25}},
                {"label": "High Arc", "params": {"angle": 75, "v0": 35}},
            ],
            "readouts": [
                {"label": "Max Height", "unit": "m", "calc_js": "(p.v0*p.v0*Math.sin(p.angle*Math.PI/180)**2)/(2*9.8)"},
                {"label": "Range", "unit": "m", "calc_js": "(p.v0*p.v0*Math.sin(2*p.angle*Math.PI/180))/9.8"},
            ],
        }

    def test_harness_includes_bidirectional_copilot_bridge(self):
        html = build_harness_html(self.spec)
        # Inbound commands listener
        self.assertIn("tark_set_param", html)
        self.assertIn("tark_set_preset", html)
        self.assertIn("tark_reset", html)
        self.assertIn("tark_play_pause", html)
        self.assertIn("tark_query_state", html)
        # Outbound telemetry broadcast
        self.assertIn("tark_sim_telemetry", html)
        self.assertIn("window.parent.postMessage", html)

    def test_harness_synthesizes_discovery_quests(self):
        html = build_harness_html(self.spec)
        # Quests HUD markup
        self.assertIn("questCard", html)
        self.assertIn("questStep", html)
        self.assertIn("questTitle", html)
        self.assertIn("questBar", html)
        self.assertIn("questToast", html)
        # Missions data array
        self.assertIn("SPEC_MISSIONS", html)
        self.assertIn("Calibration: Launch Angle", html)
        self.assertIn("Dynamics: Initial Velocity Target", html)
        # Audio chime and particle celebration
        self.assertIn("playSuccessChime", html)
        self.assertIn("triggerConfetti", html)
        self.assertIn("tark_mission_completed", html)

    def test_custom_missions_in_spec(self):
        custom_spec = dict(self.spec)
        custom_spec["missions"] = [
            {
                "id": "target_80m",
                "title": "Hit the Bunker",
                "task": "Set velocity and angle so range is exactly 80m ± 2m.",
                "hint": "Try 30 m/s at 30 degrees.",
                "condition_js": "p.angle >= 28 && p.angle <= 32",
                "xp": 150,
            }
        ]
        html = build_harness_html(custom_spec)
        self.assertIn("Hit the Bunker", html)
        self.assertIn("Set velocity and angle so range is exactly 80m", html)
        self.assertIn("150", html)


class TestStateBoardAndTextbookHighlighting(unittest.TestCase):
    """Tests for Feature 3: State Board Curricula + Glowing Highlight Overlays."""

    def test_state_board_normalization_variants(self):
        variants = [
            "State Board",
            "state",
            "stateboard",
            "state boards",
            "Maharashtra State Board",
            "maharashtra",
            "balbharati",
            "msbshse",
            "ssc",
            "hsc",
        ]
        for v in variants:
            nb = normalize_board(v)
            self.assertEqual(
                nb,
                "Maharashtra State Board (Balbharati)",
                f"Failed to normalize variant: {v}",
            )

    def test_other_state_boards_normalization(self):
        self.assertEqual(normalize_board("Tamil Nadu State Board"), "Tamil Nadu State Board")
        self.assertEqual(normalize_board("tamil nadu"), "Tamil Nadu State Board")
        self.assertEqual(normalize_board("karnataka"), "Karnataka State Board")
        self.assertEqual(normalize_board("up board"), "Uttar Pradesh State Board")

    def test_state_board_high_school_chapters_presence(self):
        # Class 11 and 12 Physics, Chemistry, and Maths for State Board
        cl11_phys = KNOWN_CHAPTERS_MAP.get(("State Board", "11", "Physics"))
        self.assertIsNotNone(cl11_phys, "Class 11 State Board Physics must exist")
        self.assertTrue(len(cl11_phys) >= 10, "Class 11 Physics must have at least 10 chapters")
        chap_names = [c["chapter"].lower() for c in cl11_phys]
        self.assertTrue(any("units and measurements" in n for n in chap_names))
        self.assertTrue(any("laws of motion" in n for n in chap_names))

        cl12_phys = KNOWN_CHAPTERS_MAP.get(("State Board", "12", "Physics"))
        self.assertIsNotNone(cl12_phys, "Class 12 State Board Physics must exist")
        cl12_names = [c["chapter"].lower() for c in cl12_phys]
        self.assertTrue(any("rotational dynamics" in n for n in cl12_names))
        self.assertTrue(any("mechanical properties of fluids" in n for n in cl12_names))

        cl12_chem = KNOWN_CHAPTERS_MAP.get(("State Board", "12", "Chemistry"))
        self.assertIsNotNone(cl12_chem, "Class 12 State Board Chemistry must exist")
        chem_names = [c["chapter"].lower() for c in cl12_chem]
        self.assertTrue(any("solid state" in n for n in chem_names))
        self.assertTrue(any("solutions" in n for n in chem_names))

        cl12_math = KNOWN_CHAPTERS_MAP.get(("State Board", "12", "Maths"))
        self.assertIsNotNone(cl12_math, "Class 12 State Board Maths must exist")
        math_names = [c["chapter"].lower() for c in cl12_math]
        self.assertTrue(any("differentiation" in n for n in math_names))
        self.assertTrue(any("matrices" in n for n in math_names))

    def test_textbook_page_generator_with_concept_highlight(self):
        png_bytes = render_generated_textbook_page_png(
            board="Maharashtra State Board",
            grade="12",
            subject="Physics",
            chapter="Rotational Dynamics",
            page_number=1,
            highlight_terms="Radius of Gyration",
        )
        self.assertIsNotNone(png_bytes)
        self.assertEqual(png_bytes[:4], b"\x89PNG")
        self.assertTrue(len(png_bytes) > 20000)

    def test_textbook_endpoint_highlight_query_parameter(self):
        client = TestClient(app)
        res = client.get(
            "/api/textbook/page-image?board=State+Board&grade=10&subject=Science&chapter=Gravitation&page=1&highlight=Free+Fall"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "image/png")
        self.assertEqual(res.content[:4], b"\x89PNG")


class TestStepByStepCASMathEngine(unittest.TestCase):
    """Tests for Feature 4: Step-by-Step CAS Math Explanations with Interactive Tangent Sliders."""

    def test_polynomial_differentiation_steps_and_tangent(self):
        res = differentiate("x^3 - 3x^2 + 4", var="x", eval_x=2.0)
        self.assertTrue(res["success"])
        self.assertIn("3", res["result"])
        self.assertTrue(len(res["steps"]) >= 3)
        tangent = res.get("tangent")
        self.assertIsNotNone(tangent)
        self.assertEqual(tangent["x0"], 2.0)
        self.assertEqual(tangent["y0"], 0.0)
        self.assertEqual(tangent["slope"], 0.0)
        self.assertIn("y =", tangent["equation"])

    def test_trigonometric_derivative(self):
        res = differentiate("sin(x)", var="x", eval_x=0.0)
        self.assertTrue(res["success"])
        self.assertIn("cos", res["result"])
        self.assertEqual(res["tangent"]["slope"], 1.0)
        self.assertEqual(res["tangent"]["y0"], 0.0)

    def test_quadratic_equation_step_by_step_solving(self):
        res = solve("x^2 - 5x + 6 = 0", var="x")
        self.assertTrue(res["success"])
        # Roots must be 2 and 3
        roots_set = set(res["roots"])
        self.assertTrue({"2.0000", "3.0000"}.issubset(roots_set) or {"2", "3"}.issubset(roots_set))
        steps = res["steps"]
        self.assertTrue(len(steps) >= 4)
        step_titles = [s["title"] for s in steps]
        self.assertTrue(any("Standard" in t for t in step_titles), f"Standard step missing in {step_titles}")
        self.assertTrue(any("Discriminant" in t for t in step_titles), f"Discriminant step missing in {step_titles}")

    def test_complex_roots_quadratic(self):
        res = solve("x^2 + 4 = 0", var="x")
        self.assertTrue(res["success"])
        self.assertTrue(any("2.0000i" in r or "2*I" in r for r in res["roots"]))

    def test_function_graph_data_endpoint(self):
        graph = get_function_graph_data("x^2 - 4", var="x", x_min=-5.0, x_max=5.0, eval_x=1.0)
        self.assertTrue(graph["success"])
        self.assertEqual(len(graph["curve"]), 40)
        self.assertTrue(len(graph["tangent"]) >= 2)
        # At x=1, y = -3, slope = 2
        mid_tangent = graph["tangent"][1]
        self.assertEqual(mid_tangent["x"], 1.0)
        self.assertEqual(mid_tangent["y"], -3.0)

    def test_fastapi_cas_step_by_step_endpoint(self):
        client = TestClient(app)
        # Test equation dispatch
        eq_res = client.post(
            "/api/cas/step_by_step",
            json={"input_str": "3x^2 - 12 = 0", "var": "x"}
        )
        self.assertEqual(eq_res.status_code, 200)
        eq_data = eq_res.json()
        self.assertEqual(eq_data["type"], "equation_solution")
        self.assertTrue(any("2.0000" in r for r in eq_data["roots"]))

        # Test derivative dispatch with tangent evaluation
        diff_res = client.post(
            "/api/cas/step_by_step",
            json={"input_str": "x^2 + 5x", "var": "x", "eval_x": 3.0}
        )
        self.assertEqual(diff_res.status_code, 200)
        diff_data = diff_res.json()
        self.assertEqual(diff_data["type"], "calculus_derivative")
        self.assertIsNotNone(diff_data.get("tangent"))
        self.assertEqual(diff_data["tangent"]["slope"], 11.0)

    def test_fastapi_cas_graph_data_endpoint(self):
        client = TestClient(app)
        res = client.post(
            "/api/cas/graph_data",
            json={"expr": "x^3", "var": "x", "x_min": -4.0, "x_max": 4.0, "eval_x": 2.0}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["curve"]), 40)
        self.assertEqual(data["eval_x"], 2.0)


if __name__ == "__main__":
    unittest.main()

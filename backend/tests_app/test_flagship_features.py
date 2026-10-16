"""Test Suite for Category 2: Flagship New Features.

Tests backend endpoints for:
1. CAS 2D/3D Math Sandbox (Riemann sums, Taylor series, 3D surface, Electric field)
2. Scratchpad Homework Error Spotter (Line-by-line algebraic validation, sign error detection)
3. Concept Mastery Graph & Skill Tree (Curriculum DAG nodes, prerequisite edges, filtering)
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestFlagshipFeatures(unittest.TestCase):
    # =====================================================================
    # 1. CAS 2D/3D Math Sandbox Endpoints
    # =====================================================================
    def test_cas_riemann_sum_midpoint(self):
        resp = client.post(
            "/api/cas/riemann_sum",
            json={"expr": "x^2", "a": 0.0, "b": 3.0, "n": 6, "method": "midpoint"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["n"], 6)
        self.assertEqual(data["method"], "midpoint")
        self.assertEqual(data["exact_integral"], 9.0)
        self.assertLess(abs(data["approx_sum"] - 9.0), 0.2)
        self.assertEqual(len(data["rectangles"]), 6)

    def test_cas_taylor_series(self):
        resp = client.post(
            "/api/cas/taylor",
            json={"expr": "sin(x)", "order": 5, "x_min": -3.0, "x_max": 3.0},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["order"], 5)
        self.assertIn("x", data["latex_taylor"])
        self.assertGreater(len(data["orig_curve"]), 0)
        self.assertGreater(len(data["taylor_curve"]), 0)

    def test_cas_surface_3d(self):
        resp = client.post(
            "/api/cas/surface_3d",
            json={"expr": "sin(sqrt(x^2 + y^2) - t)", "resolution": 12, "t": 0.5},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["resolution"], 12)
        self.assertEqual(len(data["grid"]), 12)
        self.assertEqual(len(data["grid"][0]), 12)

    def test_cas_electric_field(self):
        resp = client.post(
            "/api/cas/electric_field",
            json={
                "charges": [{"x": -1.5, "y": 0.0, "q": 1.0}, {"x": 1.5, "y": 0.0, "q": -1.0}],
                "grid_size": 10,
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertGreater(len(data["vectors"]), 0)
        first_vec = data["vectors"][0]
        self.assertIn("ex", first_vec)
        self.assertIn("ey", first_vec)
        self.assertIn("mag", first_vec)

    # =====================================================================
    # 2. Scratchpad Homework Error Spotter
    # =====================================================================
    def test_scratchpad_spot_error_detected(self):
        resp = client.post(
            "/api/scratchpad/spot_error",
            json={
                "steps": [
                    "3*(x - 4) = 2*x + 7",
                    "3*x - 12 = 2*x + 7",
                    "x = 7 - 12",
                    "x = -5",
                ],
                "var_name": "x",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["has_error"])
        self.assertEqual(data["error_step_index"], 3)
        self.assertIn("Sign", data["error_details"]["error_type"])

    def test_scratchpad_valid_derivation(self):
        resp = client.post(
            "/api/scratchpad/spot_error",
            json={
                "steps": [
                    "x^2 - 5*x + 6 = 0",
                    "(x - 2)*(x - 3) = 0",
                    "x = 2 or x = 3",
                ],
                "var_name": "x",
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertFalse(data["has_error"])
        self.assertIsNone(data["error_step_index"])

    # =====================================================================
    # 3. Concept Mastery Graph & Skill Tree
    # =====================================================================
    def test_mastery_graph_all(self):
        resp = client.get("/api/mastery/graph?user_key=test_student&subject=All")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertGreaterEqual(data["total_nodes"], 15)
        self.assertGreaterEqual(data["total_edges"], 10)
        self.assertTrue(any(n["subject"] == "Physics" for n in data["nodes"]))
        self.assertTrue(any(n["subject"] == "Chemistry" for n in data["nodes"]))
        self.assertTrue(any(n["subject"] == "Mathematics" for n in data["nodes"]))

    def test_mastery_graph_subject_filter(self):
        resp = client.get("/api/mastery/graph?user_key=test_student&subject=Physics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertTrue(all(n["subject"] == "Physics" for n in data["nodes"]))


if __name__ == "__main__":
    unittest.main()

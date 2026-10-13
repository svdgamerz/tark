"""Unit tests for simulation endpoints and candidate detection."""
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.simulations.engine import detect_simulation_candidate


class TestSimulations(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_detect_laws_of_motion(self):
        sim = detect_simulation_candidate("what is the law of motion")
        self.assertIsNotNone(sim)
        self.assertEqual(sim["type"], "projectile")
        self.assertIn("Motion", sim["title"])

    def test_detect_osmosis(self):
        sim = detect_simulation_candidate("what is the process of osmosis")
        self.assertIsNotNone(sim)
        self.assertEqual(sim["type"], "osmosis")
        self.assertIn("Osmosis", sim["title"])

    def test_generate_motion_endpoint(self):
        res = self.client.post("/api/simulation/generate", json={"question": "what is the law of motion"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("sim", data)
        self.assertEqual(data["sim"]["type"], "projectile")

    def test_generate_osmosis_endpoint(self):
        res = self.client.post("/api/simulation/generate", json={"question": "what is the process of osmosis"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("sim", data)
        self.assertEqual(data["sim"]["type"], "osmosis")


if __name__ == "__main__":
    unittest.main()

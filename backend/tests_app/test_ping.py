"""Unit tests for /ping and root endpoints."""
import unittest
from fastapi.testclient import TestClient
from app.main import app

class TestPingEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_get_ping(self):
        response = self.client.get("/ping")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "PONG")
        self.assertIn("text/plain", response.headers.get("content-type", ""))

    def test_head_ping(self):
        response = self.client.head("/ping")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "")

    def test_get_root(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "PONG")

    def test_head_root(self):
        response = self.client.head("/")
        self.assertEqual(response.status_code, 200)

if __name__ == "__main__":
    unittest.main()

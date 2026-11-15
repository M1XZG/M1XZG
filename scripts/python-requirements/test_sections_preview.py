import importlib.util
from pathlib import Path
import unittest
from xml.etree import ElementTree as ET


SCRIPT = Path(__file__).resolve().parents[2] / "templates/sections-preview/build-preview.py"
spec = importlib.util.spec_from_file_location("sections_preview", SCRIPT)
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


class SectionsPreviewTest(unittest.TestCase):
    def test_workflow_states_do_not_report_pending_or_failed_runs_as_passing(self):
        for status, conclusion, expected in [
            ("completed", "success", "PASSING"),
            ("completed", "failure", "FAILURE"),
            ("completed", "cancelled", "CANCELLED"),
            ("completed", None, "UNKNOWN"),
            ("in_progress", None, "IN PROGRESS"),
            ("queued", None, "QUEUED"),
            ("no_runs", None, "NO RUNS"),
        ]:
            with self.subTest(status=status, conclusion=conclusion):
                self.assertEqual(preview.workflow_state({
                    "status": status, "conclusion": conclusion,
                })[0], expected)

    def test_card_escapes_world_names_and_preserves_exact_counts(self):
        card = preview.world_card({
            "name": "Wildy's <Home> & Space", "visits": 12345, "favorites": 0,
            "updatedAt": "2026-11-15T12:00:00Z", "thumbnailMime": "image/png",
        }, b"thumbnail")
        root = ET.fromstring(card)
        text = "".join(root.itertext())
        self.assertIn("Wildy's <Home> & Space", text)
        self.assertIn("12,345", text)
        self.assertIn("2026-11-15", text)
        self.assertIsNone(root.find(".//Home"))

    def test_rebuild_keeps_live_details_once(self):
        original = '<a href="https://example.com">Live badge</a>'
        once = preview.section(original, "<p>cards</p>", "2026-11-15T18:00:00Z", "World")
        twice = preview.section(once, "<p>new cards</p>", "2026-11-15T19:00:00Z", "World")
        self.assertEqual(twice.count("<details>"), 1)
        self.assertEqual(twice.count(original), 1)
        self.assertNotIn("<p>cards</p>", twice)
        self.assertIn("<p>new cards</p>", twice)


if __name__ == "__main__":
    unittest.main()

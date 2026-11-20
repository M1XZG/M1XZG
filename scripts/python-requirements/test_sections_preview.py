import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
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

    def test_compact_panel_preserves_each_workflow_status_and_time(self):
        workflows = [
            {"name": "Hours & updates", "status": "completed", "conclusion": "success",
             "updatedAt": "2026-11-15T17:49:00Z"},
            {"name": "Deploy", "status": "completed", "conclusion": "failure",
             "updatedAt": "2026-11-14T12:30:00Z"},
            {"name": "New workflow", "status": "no_runs", "conclusion": None,
             "updatedAt": None},
        ]
        root = ET.fromstring(preview.workflow_panel(workflows))
        content = "".join(root.itertext())
        for workflow in workflows:
            self.assertIn(workflow["name"], content)
            self.assertIn(preview.workflow_state(workflow)[0], content)
        self.assertIn("2026-11-15 17:49", content)
        self.assertIn("2026-11-14 12:30", content)
        self.assertIn("No runs recorded", content)

    def test_live_workflows_link_each_badge_to_its_workflow(self):
        root = ET.fromstring("<div>" + preview.live_workflows() + "</div>")
        rows = root.findall("./table/tbody/tr")
        self.assertEqual(len(rows), len(preview.WORKFLOWS))
        for row, (_, label, repo, workflow) in zip(rows, preview.WORKFLOWS):
            with self.subTest(workflow=workflow):
                url = f"https://github.com/M1XZG/{repo}/actions/workflows/{workflow}"
                links = row.findall("./td/a")
                self.assertEqual([link.attrib["href"] for link in links], [url, url])
                self.assertEqual(links[0].text, label)
                badge = links[1].find("img")
                self.assertTrue(badge.attrib["src"].startswith(
                    f"https://img.shields.io/github/actions/workflow/status/M1XZG/{repo}/{workflow}?"
                ))
                self.assertNotIn("&color=", badge.attrib["src"])

    def test_world_collection_can_skip_workflow_snapshots(self):
        scratch = SCRIPT.parents[2] / "tmp"
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            with patch.object(preview, "WORLDS", []), patch.object(
                preview.subprocess, "check_output"
            ) as request:
                snapshot = preview.collect(Path(directory), include_workflows=False)
            request.assert_not_called()
            self.assertEqual(snapshot["workflows"], [])

    def test_publishing_updates_template_and_pending_readme_without_touching_preview(self):
        scratch = SCRIPT.parents[2] / "tmp"
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            root = Path(directory)
            templates = root / "templates"
            templates.mkdir()
            assets = root / "assets/profile-sections"
            assets.mkdir(parents=True)
            content = (
                "Hours placeholders remain\n\n"
                "### 🥽🌐 Some of the worlds I've uploaded\n\n"
                '<a href="https://example.com/world">World badge</a>'
                "\n\n---\n\n## 🚦 Workflow Status\n\n"
                '<a href="https://example.com/workflow">Workflow badge</a>'
                "\n\n---\n\n## 📊 Stats\n\nKeep stats unchanged\n"
            )
            target = templates / "README-template.md"
            pending = root / "TMP-README-unified.md"
            target.write_text(content)
            pending.write_text(content)
            for name in ["test-readme.md", "test-readme.me"]:
                (templates / name).write_text("Preview stays unchanged")
            urls = [f"https://example.com/world/{i}" for i in range(4)]
            worlds = []
            for i, url in enumerate(urls):
                (assets / f"{i}.thumbnail").write_bytes(b"thumbnail")
                worlds.append({"slug": str(i), "url": url, "name": f"World {i}", "visits": 1,
                               "favorites": 0, "updatedAt": "2026-11-15", "thumbnailMime": "image/png"})
            snapshot = {"capturedAt": "2026-11-15T18:00:00Z", "worlds": worlds}
            with patch.object(preview, "TEMPLATES", templates):
                preview.build(snapshot, publish=True)
                first = target.read_text()
                preview.build(snapshot, publish=True)
            self.assertEqual(target.read_text(), first)
            self.assertEqual(pending.read_text(), first)
            table = ET.fromstring(first[first.index("<table"):first.index("</table>") + len("</table>")])
            self.assertEqual([[a.get("href") for a in row.findall("td/a")] for row in table.findall("tr")],
                             [urls[:2], urls[2:]])
            self.assertIn("Hours placeholders remain", first)
            self.assertIn("Keep stats unchanged", first)
            self.assertIn(preview.live_workflows(), first)
            self.assertNotIn("workflows.svg", first)
            self.assertNotIn("Workflow snapshot:", first)
            self.assertNotIn("Workflow badge", first)
            self.assertFalse((assets / "workflows.svg").exists())
            self.assertIn("Refreshed by the profile workflow.", first)
            self.assertNotIn("fixed design preview", first)
            self.assertEqual(first.count("<details>"), 1)
            self.assertEqual((templates / "test-readme.md").read_text(), "Preview stays unchanged")


if __name__ == "__main__":
    unittest.main()

import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "update-myhours-unified.py"
REPO = SCRIPT.parents[1]
spec = importlib.util.spec_from_file_location("hours_updater", SCRIPT)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class VRChatBadgeTest(unittest.TestCase):
    def test_badge_uses_exact_hours_and_url_encoding(self):
        badge = updater.format_vrchat_hours_badge(19048.7)
        self.assertIn("VRChat-19%2C048.7%20hrs-ae4aff", badge)
        self.assertIn('alt="19,048.7 VRChat hours"', badge)
        self.assertIn('href="#-my-current-hours"', badge)

    def test_badge_handles_zero_hours(self):
        self.assertIn("VRChat-0.0%20hrs-ae4aff", updater.format_vrchat_hours_badge(0))

    def test_unified_render_keeps_badge_in_sync_with_adjusted_main_hours(self):
        old_directory = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "templates").mkdir()
            template = (REPO / "templates/README-template.md").read_text()
            (root / "templates/README-template.md").write_text(template)
            (root / "README.md").write_text("Previous generated profile\n")
            try:
                os.chdir(root)
                with patch.object(updater, "load_steam_vars", return_value=("test-key", "test-id")), \
                     patch.object(updater, "get_playtime", side_effect=[19035.7, 1484.6]), \
                     patch.object(updater, "get_wigle_cache_version", return_value="test-version"):
                    for account in ("main", "afk"):
                        with patch.object(sys, "argv", ["updater", "438100", "unused", account]):
                            updater.main()
                rendered = (root / "TMP-README-unified.md").read_text()
                badge = updater.format_vrchat_hours_badge(19048.7)
                self.assertEqual(rendered.count(badge), 1)
                self.assertIn("19,048.7 <sup>lifetime hrs</sup>", rendered)
                self.assertIn("1,497.6 <sup>AFK lifetime hrs</sup>", rendered)
                self.assertNotIn("17.5k", rendered)
                self.assertIn("assets/gpg-public-key.asc", rendered)
                self.assertIn("## 📊 Stats", rendered)
                self.assertIn("<!-- start vrchatBadgeHERE -->", rendered)
                self.assertIn("<!-- end vrchatBadgeHERE -->", rendered)
                self.assertFalse((root / "TMP-hours-data.txt").exists())
            finally:
                os.chdir(old_directory)


if __name__ == "__main__":
    unittest.main()

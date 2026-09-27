import tempfile
import unittest
from pathlib import Path

from hours_history import append_history_row


class HoursHistoryTest(unittest.TestCase):
    def test_appends_only_when_hours_change(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vrchat-hours.csv"

            self.assertTrue(
                append_history_row(
                    path, "2026-09-27T09:26:00Z", 18764.0, 1497.6
                )
            )
            self.assertFalse(
                append_history_row(
                    path, "2026-09-27T10:26:00Z", 18764.0, 1497.6
                )
            )
            self.assertTrue(
                append_history_row(
                    path, "2026-09-27T11:26:00Z", 18765.0, 1497.6
                )
            )

            self.assertEqual(
                path.read_text().splitlines(),
                [
                    "recorded_at,main_hours,afk_hours",
                    "2026-09-27T09:26:00Z,18764.0,1497.6",
                    "2026-09-27T11:26:00Z,18765.0,1497.6",
                ],
            )

    def test_rejects_an_unexpected_schema(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "vrchat-hours.csv"
            path.write_text("timestamp,hours\n")

            with self.assertRaisesRegex(ValueError, "must use the columns"):
                append_history_row(
                    path, "2026-09-27T09:26:00Z", 18764.0, 1497.6
                )


if __name__ == "__main__":
    unittest.main()

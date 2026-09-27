import tempfile
import unittest
from pathlib import Path

from minsert import MarkdownFile, is_ender, is_starter


class MinsertTest(unittest.TestCase):
    def test_only_exact_markers_are_recognized(self):
        self.assertEqual(is_starter("<!-- start myhoursHERE -->"), "myhoursHERE")
        self.assertTrue(is_ender("<!-- end myhoursHERE -->"))
        self.assertIsNone(is_starter("<!-- ordinary comment -->"))
        self.assertFalse(is_ender("<!-- frontend note -->"))

    def test_ordinary_comments_and_surrounding_content_are_preserved(self):
        source = """Before
<!-- ordinary comment -->
Still before
<!-- start myhoursHERE -->
old value
<!-- end myhoursHERE -->
After
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_text(source)

            MarkdownFile(str(path)).insert({"myhoursHERE": "new value"})

            self.assertEqual(
                path.read_text(),
                """Before
<!-- ordinary comment -->
Still before
<!-- start myhoursHERE -->
new value
<!-- end myhoursHERE -->
After
""",
            )


if __name__ == "__main__":
    unittest.main()

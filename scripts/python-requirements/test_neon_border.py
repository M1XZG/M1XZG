import importlib.util
from pathlib import Path
import tempfile
import unittest
from xml.etree import ElementTree as ET


SCRIPT = Path(__file__).resolve().parents[1] / "apply-neon-border.py"
spec = importlib.util.spec_from_file_location("neon_border", SCRIPT)
neon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(neon)

SAMPLE = """<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">
<style>text { font-size: 14px; }</style>
<rect x="1" y="1" width="338" height="198" rx="5" fill="#15141b"/>
<text x="30" y="40">Sample &amp; stats</text>
<g transform="translate(0,40)"><path d="M1 2L3 4"/></g>
</svg>"""


class NeonBorderTest(unittest.TestCase):
    def test_ring_preserves_card_content_and_respects_reduced_motion(self):
        before = ET.fromstring(SAMPLE)
        after = ET.fromstring(neon.apply_neon_border(SAMPLE, neon.THEMES["aura"]))
        self.assertEqual(after.find(neon.tag("text")).text, before.find(neon.tag("text")).text)
        self.assertEqual(
            ET.tostring(after.findall(neon.tag("g"))[-1]),
            ET.tostring(before.findall(neon.tag("g"))[-1]),
        )
        self.assertEqual(after.find(neon.tag("rect")).get("fill"), "#15141b")
        self.assertEqual(after.find(neon.tag("rect")).get("rx"), "14")
        self.assertEqual(len(after.findall(f".//*[@class='gpsc-neon-trail']")), 2)
        style = after.find(f"./{neon.tag('defs')}/{neon.tag('style')}").text
        self.assertIn("@keyframes gpsc-neon-orbit", style)
        self.assertIn("prefers-reduced-motion: reduce", style)
        self.assertIn("animation: none; display: none;", style)

    def test_application_is_idempotent(self):
        once = neon.apply_neon_border(SAMPLE, neon.THEMES["aura"])
        self.assertEqual(neon.apply_neon_border(once, neon.THEMES["aura"]), once)

    def test_invalid_svg_is_rejected(self):
        with self.assertRaises((ValueError, ET.ParseError)):
            neon.apply_neon_border("<svg>", neon.THEMES["aura"])
        with self.assertRaises(ValueError):
            neon.apply_neon_border('<svg xmlns="http://www.w3.org/2000/svg"/>', neon.THEMES["aura"])

    def test_updates_both_themes_and_all_cards(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            for theme in neon.THEMES:
                (output / theme).mkdir()
                for filename in neon.CARD_FILES:
                    (output / theme / filename).write_text(SAMPLE, encoding="utf-8")
            self.assertEqual(neon.apply_to_output(output), 10)
            for theme in neon.THEMES:
                for filename in neon.CARD_FILES:
                    self.assertIn("gpsc-neon-orbit", (output / theme / filename).read_text(encoding="utf-8"))
            self.assertEqual(neon.apply_to_output(output), 0)

    def test_missing_card_does_not_change_any_output(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            for theme in neon.THEMES:
                (output / theme).mkdir()
                for filename in neon.CARD_FILES:
                    (output / theme / filename).write_text(SAMPLE, encoding="utf-8")
            (output / "aura_dark" / neon.CARD_FILES[-1]).unlink()
            with self.assertRaisesRegex(ValueError, "4-productive-time.svg"):
                neon.apply_to_output(output)
            self.assertEqual((output / "aura" / neon.CARD_FILES[0]).read_text(encoding="utf-8"), SAMPLE)


if __name__ == "__main__":
    unittest.main()

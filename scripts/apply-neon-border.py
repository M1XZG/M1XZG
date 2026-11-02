#!/usr/bin/env python3
"""Add the animated neon frame to the generated profile cards."""

import argparse
import math
import sys
from pathlib import Path
from xml.etree import ElementTree as ET


SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)

THEMES = {
    "aura": ("#a277ff", "#ffca85", "#a277ff"),
    "aura_dark": ("#ff7372", "#6cffd0", "#ff7372"),
}
CARD_FILES = (
    "0-profile-details.svg",
    "1-repos-per-language.svg",
    "2-most-commit-language.svg",
    "3-stats.svg",
    "4-productive-time.svg",
)
NEON_IDS = {"gpsc-neon-clip", "gpsc-neon-border", "gpsc-neon-wash", "gpsc-neon-glow"}
NEON_CSS = """
@keyframes gpsc-neon-orbit {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: -100; }
}
.gpsc-neon-trail { animation: gpsc-neon-orbit 4s linear infinite; }
@media (prefers-reduced-motion: reduce) {
    .gpsc-neon-trail { animation: none; display: none; }
}
"""


def tag(name):
    return f"{{{SVG_NS}}}{name}"


def element(name, attributes=None):
    return ET.Element(tag(name), {key: str(value) for key, value in (attributes or {}).items()})


def rounded_rect(width, height, inset, radius, attributes=None):
    values = {
        "x": inset,
        "y": inset,
        "width": f"{width - 2 * inset:g}",
        "height": f"{height - 2 * inset:g}",
        "rx": radius,
        "ry": radius,
    }
    values.update(attributes or {})
    return element("rect", values)


def add_gradient(defs, name, stops):
    gradient = element(
        "linearGradient", {"id": name, "x1": "0%", "y1": "0%", "x2": "100%", "y2": "100%"}
    )
    for offset, colour, opacity in stops:
        gradient.append(element("stop", {"offset": offset, "stop-color": colour, "stop-opacity": opacity}))
    defs.append(gradient)


def apply_neon_border(svg_text, colours):
    root = ET.fromstring(svg_text)
    if root.tag != tag("svg"):
        raise ValueError("the document is not an SVG")
    if root.find(f"./{tag('defs')}[@data-gpsc-neon-border]") is not None:
        return svg_text
    if any(item.get("id") in NEON_IDS for item in root.iter()):
        raise ValueError("the SVG already uses a neon border identifier")

    try:
        width = float(root.attrib["width"])
        height = float(root.attrib["height"])
    except (KeyError, ValueError) as error:
        raise ValueError("the SVG needs numeric width and height") from error
    background = root.find(f"./{tag('rect')}")
    if background is None or not all(math.isfinite(value) and value > 8 for value in (width, height)):
        raise ValueError("the SVG needs a background rectangle and positive dimensions")

    title, icon, chart = colours
    background.set("rx", "14")
    background.set("ry", "14")
    background.set("stroke", "none")

    defs = element("defs", {"data-gpsc-neon-border": "true"})
    clip = element("clipPath", {"id": "gpsc-neon-clip"})
    clip.append(rounded_rect(width, height, 1, 14))
    defs.append(clip)
    add_gradient(defs, "gpsc-neon-border", (("0%", title, 1), ("50%", icon, 1), ("100%", chart, 1)))
    add_gradient(defs, "gpsc-neon-wash", (("0%", title, 0.08), ("100%", icon, 0)))
    glow = element(
        "filter",
        {"id": "gpsc-neon-glow", "x": "-10%", "y": "-10%", "width": "120%", "height": "120%"},
    )
    glow.append(element("feGaussianBlur", {"stdDeviation": 2.5}))
    defs.append(glow)
    style = element("style")
    style.text = NEON_CSS
    defs.append(style)
    root.insert(0, defs)

    border = element("g", {"clip-path": "url(#gpsc-neon-clip)"})
    border.append(rounded_rect(width, height, 1, 14, {"fill": "url(#gpsc-neon-wash)"}))
    border.append(
        rounded_rect(
            width,
            height,
            4,
            12,
            {
                "fill": "none",
                "stroke": "url(#gpsc-neon-border)",
                "stroke-width": 4,
                "opacity": 0.45,
                "filter": "url(#gpsc-neon-glow)",
            },
        )
    )
    border.append(
        rounded_rect(
            width, height, 2, 13, {"fill": "none", "stroke": "url(#gpsc-neon-border)", "stroke-width": 1.5}
        )
    )
    trail = {
        "class": "gpsc-neon-trail",
        "fill": "none",
        "pathLength": 100,
        "stroke-dasharray": "14 86",
        "stroke-linecap": "round",
    }
    border.append(
        rounded_rect(
            width,
            height,
            2,
            13,
            {
                **trail,
                "stroke": "url(#gpsc-neon-border)",
                "stroke-width": 7,
                "opacity": 0.85,
                "filter": "url(#gpsc-neon-glow)",
            },
        )
    )
    border.append(
        rounded_rect(width, height, 2, 13, {**trail, "stroke": "#ffffff", "stroke-width": 2, "opacity": 0.85})
    )
    root.insert(list(root).index(background) + 1, border)
    return ET.tostring(root, encoding="unicode")


def apply_to_output(output):
    cards = []
    for theme, colours in THEMES.items():
        for filename in CARD_FILES:
            path = output / theme / filename
            try:
                original = path.read_text(encoding="utf-8")
                updated = apply_neon_border(original, colours)
            except (OSError, ET.ParseError, ValueError) as error:
                raise ValueError(f"{path}: {error}") from error
            cards.append((path, original, updated))
    for path, original, updated in cards:
        if updated != original:
            path.write_text(updated, encoding="utf-8")
    return sum(original != updated for _, original, updated in cards)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="profile-summary-card-output directory")
    args = parser.parse_args()
    try:
        count = apply_to_output(args.output)
    except (OSError, ValueError) as error:
        print(f"Could not add neon borders: {error}", file=sys.stderr)
        return 1
    print(f"Added neon borders to {count} cards.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

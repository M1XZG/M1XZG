"""Build the test README's cards from a public, fixed snapshot."""

import argparse
import base64
from hashlib import sha256
from datetime import datetime, timezone
from html import escape
import json
from pathlib import Path
import subprocess


HERE = Path(__file__).resolve().parent
TEMPLATES = HERE.parent
WORLDS = [
    ("cozy-house", "5931e6c9-1b23-4852-9c73-ee0bf273e224"),
    ("soft-comfy-space", "9f2d7f50-b918-4bab-9452-4b1c9a15ed69"),
    ("cozy-loft", "2bdb0569-b7d2-4d0c-8214-7adb3224a5fc"),
    ("afk-home", "e4542a42-3097-46be-ba0d-21e10f8c768a"),
    ("soft-haven", "dde3e2a3-cde3-4d4e-8a51-99d49f3d6f50"),
    ("neon-afk-home", "4941600b-e662-499c-b5fa-d8023190730a"),
]
WORKFLOWS = [
    ("vrchat-hours", "My VRChat Hours Update", "M1XZG", "update-vrchat-hours-unified.yaml"),
    ("uptime", "M1XZG Uptime Monitor", "uptime", "uptime.yml"),
    ("profile-cards", "M1XZG Profile Card Creator", "M1XZG", "profile-summary-cards.yml"),
    ("game-images", "Shared Game Images - GitHub Pages", "shared-game-images", "pages.yml"),
    ("posters", "Replace Posters Daily", "shared-game-images", "replace_posters.yml"),
]


def download(url):
    return subprocess.check_output([
        "curl", "--fail", "--silent", "--show-error", "--location",
        "--max-time", "60", "--user-agent", "Mozilla/5.0", url,
    ])


def collect(output=HERE):
    output.mkdir(parents=True, exist_ok=True)
    snapshot = {"capturedAt": datetime.now(timezone.utc).isoformat(), "worlds": [], "workflows": []}
    for slug, world_id in WORLDS:
        source = f"https://api.vrchat.cloud/api/1/worlds/wrld_{world_id}"
        world = json.loads(download(source))
        thumbnail = download(world["thumbnailImageUrl"])
        if thumbnail.startswith(b"\xff\xd8\xff"):
            mime = "image/jpeg"
        elif thumbnail.startswith(b"\x89PNG\r\n\x1a\n"):
            mime = "image/png"
        else:
            raise ValueError(f"Unsupported thumbnail format: {slug}")
        (output / f"{slug}.thumbnail").write_bytes(thumbnail)
        snapshot["worlds"].append({
            "slug": slug, "name": world["name"], "visits": world["visits"],
            "favorites": world["favorites"], "updatedAt": world["updated_at"],
            "url": f"https://vrchat.com/home/world/wrld_{world_id}",
            "source": source, "thumbnailSource": world["thumbnailImageUrl"], "thumbnailMime": mime,
        })
    for slug, label, repo, workflow in WORKFLOWS:
        endpoint = f"repos/M1XZG/{repo}/actions/workflows/{workflow}/runs?per_page=1"
        runs = json.loads(subprocess.check_output(["gh", "api", endpoint]))["workflow_runs"]
        run = runs[0] if runs else None
        snapshot["workflows"].append({
            "slug": slug, "name": label, "repo": f"M1XZG/{repo}",
            "url": f"https://github.com/M1XZG/{repo}/actions/workflows/{workflow}",
            "status": run["status"] if run else "no_runs",
            "conclusion": run["conclusion"] if run else None,
            "updatedAt": run["updated_at"] if run else None,
            "runUrl": run["html_url"] if run else None,
            "source": f"https://api.github.com/{endpoint}",
        })
    (output / "snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n")
    return snapshot


def text(x, y, value, size=16, color="#f5f2ff", weight=400, mono=False):
    family = "DejaVu Sans Mono,monospace" if mono else "DejaVu Sans,sans-serif"
    return (f'<text x="{x}" y="{y}" fill="{color}" font-family="{family}" '
            f'font-size="{size}" font-weight="{weight}">{escape(str(value))}</text>')


def frame(width, height, title, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">
<title>{escape(title)}</title>
<defs>
  <linearGradient id="border" x2="1" y2="1"><stop stop-color="#70e7ff"/><stop offset=".45" stop-color="#7861ca"/><stop offset=".75" stop-color="#c08bff"/><stop offset="1" stop-color="#70e7ff"/></linearGradient>
  <linearGradient id="panel" x2="1" y2="1"><stop stop-color="#211c32"/><stop offset="1" stop-color="#171827"/></linearGradient>
  <radialGradient id="glow" cx=".9" cy="0" r=".9"><stop stop-color="#312048"/><stop offset="1" stop-color="#11111d"/></radialGradient>
  <clipPath id="photo"><rect x="17" y="17" width="{width - 34}" height="158" rx="14"/></clipPath>
</defs>
<rect x="1.5" y="1.5" width="{width - 3}" height="{height - 3}" rx="25" fill="url(#glow)" stroke="url(#border)" stroke-width="3"/>
{body}
</svg>
'''


def world_card(world, thumbnail):
    title = world["name"]
    body = (
        f'<image x="17" y="17" width="506" height="158" preserveAspectRatio="xMidYMid slice" '
        f'clip-path="url(#photo)" xlink:href="data:{world["thumbnailMime"]};base64,{base64.b64encode(thumbnail).decode()}"/>'
        + text(28, 207, "VRCHAT / UPLOADED WORLD", 11, "#bc91ff", mono=True)
    )
    body += text(28, 239, title, 23 if len(title) < 30 else 19, weight=700)
    for x, label, value, color in [
        (28, "TOTAL VISITS", f'{world["visits"]:,}', "#6be7ff"),
        (210, "FAVORITES", f'{world["favorites"]:,}', "#bc91ff"),
    ]:
        body += text(x, 273, label, 11, "#aaa6c1", mono=True)
        body += text(x, 309, value, 30, color, 700)
    body += '<path d="M28 326H512" stroke="#39304f"/>'
    body += text(28, 350, f'LAST UPLOAD / {world["updatedAt"][:10]}', 11, "#aaa6c1", mono=True)
    body += text(415, 350, "VISIT WORLD", 11, "#6be7ff", mono=True)
    return frame(540, 374, title, body)


def workflow_state(workflow):
    if workflow["status"] == "completed":
        state = workflow["conclusion"] or "unknown"
    else:
        state = workflow["status"]
    if state == "success":
        return "PASSING", "#6be7ff"
    if state in {"failure", "timed_out", "action_required", "startup_failure"}:
        return state.replace("_", " ").upper(), "#ff879c"
    if state in {"in_progress", "queued", "waiting", "pending", "requested"}:
        return state.replace("_", " ").upper(), "#ffd58a"
    return state.replace("_", " ").upper(), "#aaa6c1"


def workflow_panel(workflows):
    body = text(28, 35, "M1XZG / WORKFLOW STATUS", 14, "#6be7ff", mono=True)
    body += text(28, 73, "WORKFLOW", 11, "#aaa6c1", mono=True)
    body += text(650, 73, "STATUS", 11, "#aaa6c1", mono=True)
    body += text(853, 73, "LAST RUN UPDATE / UTC", 11, "#aaa6c1", mono=True)
    for index, workflow in enumerate(workflows):
        y = 105 + index * 44
        state, color = workflow_state(workflow)
        updated = workflow["updatedAt"]
        updated = updated[:16].replace("T", " ") if updated else "No runs recorded"
        body += (
            f'<rect x="17" y="{y - 23}" width="1066" height="40" rx="10" '
            'fill="url(#panel)" stroke="#39304f"/>'
        )
        body += text(30, y + 3, workflow["name"], 19, weight=700)
        body += f'<circle cx="635" cy="{y - 3}" r="4" fill="{color}"/>'
        body += text(650, y + 2, state, 13, color, 700, mono=True)
        body += text(853, y + 2, updated, 13, "#aaa6c1", mono=True)
    return frame(1100, 100 + len(workflows) * 44, "Workflow status snapshot", body)


def section(old, cards, captured, kind, publish=False, asset_base="./sections-preview"):
    # Keep the original live badges and their individual links available.
    if "<!-- themed-section-preview -->" in old:
        old = old.split("<summary>Live badges and links</summary>\n\n", 1)[1]
        old = old.rsplit("\n</details>", 1)[0].strip()
    freshness = (
        "Refreshed by the hourly profile workflow. "
        if publish else "Cards are a fixed design preview, not live updates. "
    )
    return (
        "<!-- themed-section-preview -->\n\n"
        + cards
        + f"\n<p align=\"center\"><sub>{kind} snapshot: {captured[:16].replace('T', ' ')} UTC. "
        + freshness
        + f'<a href="{asset_base}/snapshot.json">Source data</a>.</sub></p>\n\n'
        "<details>\n<summary>Live badges and links</summary>\n\n"
        + old.strip() + "\n\n</details>"
    )


def build(snapshot, publish=False):
    output = TEMPLATES.parent / "assets/profile-sections" if publish else HERE
    asset_base = (
        "https://raw.githubusercontent.com/M1XZG/M1XZG/main/assets/profile-sections"
        if publish else "./sections-preview"
    )
    version = "?v=" + sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()[:16] if publish else ""
    world_links = []
    for world in snapshot["worlds"]:
        slug = world["slug"]
        (output / f"{slug}.svg").write_text(world_card(world, (output / f"{slug}.thumbnail").read_bytes()))
        alt = f'{world["name"]}: {world["visits"]:,} visits, {world["favorites"]:,} favorites; last upload {world["updatedAt"][:10]}'
        world_links.append(
            f'  <a href="{escape(world["url"], quote=True)}"><img src="{asset_base}/{slug}.svg{version}" '
            f'width="49%" alt="{escape(alt, quote=True)}" /></a>'
        )
    worlds = "\n".join(
        '<p align="center">\n' + "\n".join(world_links[i:i + 2]) + "\n</p>"
        for i in range(0, len(world_links), 2)
    ) + "\n"
    (output / "workflows.svg").write_text(workflow_panel(snapshot["workflows"]))
    alt = "; ".join(
        f'{workflow["name"]}: {workflow_state(workflow)[0]}, updated {workflow["updatedAt"] or "unknown"}'
        for workflow in snapshot["workflows"]
    )
    workflows = (
        '<p align="center">\n'
        f'  <img src="{asset_base}/workflows.svg{version}" width="100%" alt="{escape(alt, quote=True)}" />\n'
        '</p>\n'
    )
    paths = [TEMPLATES / name for name in ["test-readme.md", "test-readme.me"]]
    if publish:
        pending = TEMPLATES.parent / "TMP-README-unified.md"
        paths = [TEMPLATES / "README-template.md"] + ([pending] if pending.exists() else [])
    for path in paths:
        content = path.read_text()
        world_heading = "### 🥽🌐 Some of the worlds I've uploaded\n\n"
        workflow_heading = "## 🚦 Workflow Status\n\n"
        stats_heading = "## 📊 Stats"
        prefix, remainder = content.split(world_heading, 1)
        old_worlds, remainder = remainder.split("\n\n---\n\n" + workflow_heading, 1)
        old_workflows, suffix = remainder.split("\n\n---\n\n" + stats_heading, 1)
        path.write_text(
            prefix + world_heading
            + section(old_worlds, worlds, snapshot["capturedAt"], "World data", publish, asset_base)
            + "\n\n---\n\n" + workflow_heading
            + section(old_workflows, workflows, snapshot["capturedAt"], "Workflow", publish, asset_base)
            + "\n\n---\n\n" + stats_heading + suffix
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collect", action="store_true", help="Refresh public data and thumbnails first (requires curl and authenticated gh).")
    parser.add_argument("--publish", action="store_true", help="Update the production template and pending workflow README, using separate production assets.")
    args = parser.parse_args()
    output = TEMPLATES.parent / "assets/profile-sections" if args.publish else HERE
    data = collect(output) if args.collect else json.loads((output / "snapshot.json").read_text())
    build(data, publish=args.publish)

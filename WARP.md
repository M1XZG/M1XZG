# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository purpose

This repo is the source for the `M1XZG` GitHub profile README. The README is largely generated/updated by automation:

- **VRChat hours and AFK bot hours** are fetched from the Steam API and injected into the README.
- **Profile summary cards** (language stats, commit stats, etc.) are generated and stored under `profile-summary-card-output/`.
- **GitHub stats image** (`assets/userstats.svg`) is generated on a schedule.

Most code changes here affect how the README is generated, rather than application logic or a library.

## Important files and layout

- `README.md` – the live profile README on GitHub. Parts of this file are generated; see the dynamic content section below.
- `templates/`
  - `README-template.md` – primary template for the profile README with placeholders for VRChat hours (holiday themed).
  - `README-template-normal.md` / `README-template-xmas.md` – alternate templates with different theming.
- `scripts/`
  - `update-myhours-unified.py` – Python script that talks to the Steam API and prepares updated hours for main and AFK accounts.
  - `update-vrchours-unified.sh` – shell script that orchestrates a full README update + PR flow, using the Python script above.
  - `delete_failed_and_old_workflow_runs.py` – utility to prune old and failed GitHub Actions runs for this repo.
  - `python-requirements/minsert.py` – small library that inserts dynamic content into markdown between special HTML comment markers.
  - `requirements.txt` – Python dependency list used by some scripts (currently only `minsert`; other deps like `requests` are installed ad-hoc).
- `.github/workflows/`
  - `update-vrchat-hours-unified.yaml` – scheduled workflow that runs the unified VRChat hours update on a **self-hosted** runner.
  - `profile-summary-cards.yml` – scheduled workflow that generates GitHub profile summary cards and prunes themes to `aura` and `aura_dark`.
  - `user-statistician.yml` – scheduled workflow that generates `assets/userstats.svg` via `cicirello/user-statistician`.
- `profile-summary-card-output/` – generated assets from the profile-summary-cards workflow; generally not edited by hand.

## Dynamic README generation – architecture

### VRChat hours pipeline

1. **Steam credentials**
   - The Python script expects a config file containing:
     - `STEAM_API_KEY=...`
     - `STEAM_ID=...`
   - In CI, `update-vrchat-hours-unified.yaml` creates `steam_vars_main.txt` and `steam_vars_afk.txt` from GitHub Actions secrets (`STEAM_API_KEY`, `STEAM_USER_ID`, `STEAM_API_KEY_AFK`, `STEAM_USER_ID_AFK`).

2. **Fetching playtime** – `scripts/update-myhours-unified.py`:
   - Calls the Steam Web API (`IPlayerService/GetOwnedGames`) for a given `STEAM_ID` and `STEAM_GAME_ID`.
   - Converts total minutes played into hours, applies a fixed offset (`OFFSET_MISSING_HOURS`) to correct for under-reporting, and rounds to one decimal.
   - For each run, appends a line to `./TMP-hours-data.txt` with the placeholder key, formatted hours, suffix text (`lifetime hrs` or `AFK lifetime hrs`), and timestamp.

3. **Template filling** – `python-requirements/minsert.py` + `templates/README-template.md`:
   - The template contains HTML comment markers such as:
     - `<!-- start myhoursHERE --> ... <!-- end myhoursHERE -->`
     - `<!-- start afkhoursHERE --> ... <!-- end afkhoursHERE -->`
   - When the **AFK** run of `update-myhours-unified.py` completes, it:
     - Reads all entries from `TMP-hours-data.txt`.
     - Copies `README-template.md` to `TMP-README-unified.md`.
     - Uses `MarkdownFile.insert()` to replace each `start ... end` block with the formatted hours string for that placeholder.
     - Deletes `TMP-hours-data.txt` after successfully building `TMP-README-unified.md`.

4. **Branching and PR automation** – `scripts/update-vrchours-unified.sh`:
   - Expects arguments: `LOCAL_PATH_TO_REPO` and `STEAM_GAME_ID`, plus optional `cron` flag.
   - Steps in `updateprofile()`:
     - `gh repo sync` to ensure the local clone is up to date.
     - Runs `update-myhours-unified.py` twice:
       - Main account: `... steam_vars_main.txt main`
       - AFK account: `... steam_vars_afk.txt afk`
     - Checks for `TMP-README-unified.md` and exits early if it doesnt exist.
     - Compares `README.md` with `TMP-README-unified.md`; if unchanged, deletes the temp file and exits.
     - If different:
       - Creates a new branch named `z<TIMESTAMP>`.
       - Moves `TMP-README-unified.md` over `README.md`.
       - Commits (`git commit -a -m "Update VRChat Hours (Main + AFK) - <TIMESTAMP>"`).
       - Pushes branch and opens a PR via `gh pr create`, then enables auto-merge via `gh pr merge --auto -m`.
       - Switches back to `main`, runs `gh repo sync`, prunes merged branches, and prunes remotes.
   - The optional `cron` mode adds a random sleep (5–49 minutes) before running `updateprofile()` to jitter scheduled updates.

5. **GitHub Actions integration** – `.github/workflows/update-vrchat-hours-unified.yaml`:
   - Runs on a self-hosted runner every hour and on manual dispatch.
   - Sets up Python, installs `requests`, configures git identity, and rewrites the `origin` remote with a PAT (`MY_GH_PAT`) so the workflow can push branches and merge PRs.
   - Creates the `steam_vars_*.txt` files, then calls the shell script:
     - `./scripts/update-vrchours-unified.sh "$GITHUB_WORKSPACE" "$STEAM_GAME_ID"`

### Profile summary cards and stats assets

- **Profile summary cards** – `.github/workflows/profile-summary-cards.yml`:
  - Uses `m1xzg/github-profile-summary-cards@m1xzg-v1` to generate summary cards on a schedule (currently every 12 hours) on a self-hosted runner.
  - After generation, a step in the workflow prunes all themes except `aura` and `aura_dark` from `profile-summary-card-output/`.
  - The workflow commits and pushes updates to `profile-summary-card-output/` directly to `main`.

- **GitHub stats image** – `.github/workflows/user-statistician.yml`:
  - Uses `cicirello/user-statistician@v1` to generate `assets/userstats.svg` every 6 hours on a self-hosted runner.
  - The README references this image directly from `assets/userstats.svg`.

### Workflow run cleanup

- `scripts/delete_failed_and_old_workflow_runs.py` is a local/utility script that:
  - Uses `GITHUB_TOKEN` or `GH_TOKEN` from the environment to authenticate to the GitHub REST API.
  - Lists workflow runs for this repo and deletes:
    - All runs whose `conclusion == "failure"`.
    - All but the most recent `KEEP_RECENT_RUNS` non-failed runs (default 100).
  - Enforces API rate limits by inspecting `X-RateLimit-*` headers and sleeping until reset when usage exceeds 80% of the limit.

## Common commands (local development)

> These commands assume macOS / Linux with Python 3 and `gh` installed. Adapt paths and activation commands as needed.

### Set up a Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
pip install requests
```

### Run the VRChat hours updater locally

1. Create Steam config files in the repo root (mirroring what CI does):

   - `steam_vars_main.txt`:
     - `STEAM_API_KEY=...`
     - `STEAM_ID=...`
   - `steam_vars_afk.txt`:
     - `STEAM_API_KEY=...`
     - `STEAM_ID=...`

2. Run just the Python script for a single account (useful during debugging):

   ```bash
   python3 scripts/update-myhours-unified.py "<STEAM_GAME_ID>" steam_vars_main.txt main -v
   python3 scripts/update-myhours-unified.py "<STEAM_GAME_ID>" steam_vars_afk.txt afk -v
   ```

   - This will update `TMP-hours-data.txt` and, after the AFK run, generate `TMP-README-unified.md` from `templates/README-template.md`.

3. Run the full unified pipeline including git + PR flow (mirrors CI behavior):

   ```bash
   ./scripts/update-vrchours-unified.sh "$PWD" "<STEAM_GAME_ID>"
   ```

   - Requires:
     - A clean git working tree.
     - `gh` CLI authenticated with a token that can push branches and create/merge PRs to this repo.

### Clean up GitHub Actions runs locally

```bash
export GITHUB_TOKEN="<personal_access_token_with_actions_delete_scope>"
python3 scripts/delete_failed_and_old_workflow_runs.py
```

- This will delete failed runs and prune older successful runs according to `KEEP_RECENT_RUNS` in the script.

## Guidance for editing generated content

- Treat `README.md` as a **generated artifact** for the dynamic sections:
  - The VRChat hours blocks are between `<!-- start myhoursHERE --> ... <!-- end myhoursHERE -->` and `<!-- start afkhoursHERE --> ... <!-- end afkhoursHERE -->`.
  - Do **not** hand-edit text inside these markers; instead, change:
    - The templates under `templates/README-template*.md`, or
    - The formatting/logic in `scripts/update-myhours-unified.py`.

- If adding new dynamic sections that should be auto-filled:
  - Define markers in a template like: `<!-- start SOMEKEY --> ... <!-- end SOMEKEY -->`.
  - Extend `update-myhours-unified.py` (or a new script) to pass a `SOMEKEY` entry to `MarkdownFile.insert()`.

- The workflows expect a **self-hosted** runner with:
  - `gh` CLI available for the VRChat updater.
  - Git configured to allow non-interactive commits and pushes.
  - Network access to Steam and GitHub APIs.

There is currently no dedicated test suite in this repo; verification is typically done by running the scripts above and inspecting the resulting README and generated assets.
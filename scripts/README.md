# Scripts Directory

This directory contains utility scripts for managing and maintaining the GitHub repository workflows and related automation. This document focuses on the **v2 scripts**, which are improved and recommended for current use.

---

## Script Overview

### 1. `update-vrchours-workflow-v2.sh`
- **Purpose:**  
  Bash script to automate updating VRChat (or other Steam game) hours in the repository.
- **How it works:**  
  - Accepts the repository path and Steam Game ID as arguments.
  - Optionally introduces a random delay when run in "cron" mode.
  - Calls the Python script `update-myhours-workflow-v2.py` to fetch playtime data from the Steam API.
  - If the playtime has changed, creates a new branch, updates the README, and opens a pull request via the GitHub CLI.
  - Cleans up merged branches.
- **Relation:**  
  Used by the GitHub Actions workflow to keep your playtime stats up to date.

---

### 2. `update-myhours-workflow-v2.py`
- **Purpose:**  
  Python script to fetch playtime data from the Steam API and update the repository's README.
- **How it works:**  
  - Reads Steam API credentials from a `steam_vars.txt` file (created by the workflow).
  - Fetches playtime for the specified Steam game.
  - Updates a Markdown template with the latest playtime.
  - Used by `update-vrchours-workflow-v2.sh`.
- **Relation:**  
  Handles the data-fetching and file update logic for the v2 workflow.

---

### 3. `delete_failed_and_old_workflow_runs.py`
- **Purpose:**  
  Python script to clean up GitHub Actions workflow runs.
- **How it works:**  
  - Uses the GitHub API to list workflow runs.
  - Deletes all failed runs.
  - Keeps only the latest N non-failed runs (N is configurable).
- **Relation:**  
  Helps manage repository hygiene by removing old or failed workflow runs.

---

### 4. `python-requirements/`
- **Purpose:**  
  Directory containing Python modules or requirements needed by the scripts.
- **How it works:**  
  - Scripts may require packages listed here.
  - The workflow sets `PYTHONPATH` to include this directory if needed.
- **Relation:**  
  Supports the Python scripts in this directory by providing necessary dependencies.

---

## Required Repository Secrets for v2 Workflows

The following secrets **must be set in your GitHub repository** for the v2 workflow to function:

- `MY_GH_PAT`  
  **Description:** A GitHub Personal Access Token with repo permissions.  
  **Used for:** Authenticating git and GitHub CLI operations in the workflow.

- `STEAM_API_KEY`  
  **Description:** Your Steam Web API key.  
  **Used for:** Fetching playtime data from the Steam API.

- `STEAM_USER_ID`  
  **Description:** Your Steam 64-bit user ID.  
  **Used for:** Identifying which user's playtime to fetch.

- `STEAM_GAME_ID`  
  **Description:** The Steam App ID of the game to track (e.g., 438100 for VRChat).  
  **Used for:** Specifying which game's playtime to fetch.

---

## How the v2 Scripts Relate

- **Workflow Automation:**  
  The `update-vrchours-workflow-v2.sh` script is run by a GitHub Actions workflow to automate the process of updating playtime hours.
- **Data Fetching & Update:**  
  The `update-myhours-workflow-v2.py` script is called by the shell script to fetch data and update files.
- **Maintenance:**  
  The `delete_failed_and_old_workflow_runs_v2.py` script is used to keep the Actions history clean.
- **Dependencies:**  
  The `python-requirements/` directory provides shared Python dependencies for scripts in this folder.

---

## Usage

- **Run update script manually:**  
  ```bash
  ./update-vrchours-workflow-v2.sh /path/to/repo <STEAM_GAME_ID>
  ```
  Optionally add `cron` as a fourth argument to enable random delay.

- **Run cleanup script:**  
  ```bash
  python3 delete_failed_and_old_workflow_runs_v2.py
  ```

> **Note:**  
> Some scripts require environment variables or secrets to be set before execution. See the list above for required secrets.

---


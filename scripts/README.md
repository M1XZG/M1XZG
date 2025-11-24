# Scripts Directory

This directory contains utility scripts for managing and maintaining the GitHub repository workflows and related automation. This document focuses on the **unified workflow**, which consolidates both main and AFK account updates into a single, conflict-free process.

---

## Active Scripts

### 1. `update-vrchours-unified.sh`
- **Purpose:**  
  Unified bash script to automate updating VRChat hours for both main and AFK accounts in the repository.
- **How it works:**  
  - Accepts the repository path and Steam Game ID as arguments.
  - Optionally introduces a random delay when run in "cron" mode.
  - Calls `update-myhours-unified.py` twice (once for main account, once for AFK account).
  - Processes both accounts sequentially to avoid data conflicts.
  - If playtime has changed for either account, creates a new branch, updates the README, and opens a pull request via the GitHub CLI.
  - Cleans up merged branches.
- **Relation:**  
  Used by the unified GitHub Actions workflow to keep both account playtime stats up to date.

---

### 2. `update-myhours-unified.py`
- **Purpose:**  
  Unified Python script to fetch playtime data from the Steam API and update the repository's README for both accounts.
- **How it works:**  
  - Accepts three arguments: Steam Game ID, config file path, and user type (main/afk).
  - Reads Steam API credentials from the specified config file (`steam_vars_main.txt` or `steam_vars_afk.txt`).
  - Fetches playtime for the specified Steam game and user.
  - On first run (main account), collects data and stores it temporarily in `TMP-hours-data.txt`.
  - On second run (afk account), collects its data, then processes both datasets together.
  - Updates the Markdown template with both accounts' playtime in a single operation to avoid placeholder conflicts.
  - Applies a fixed offset of 13 hours to account for API delays.
- **Relation:**  
  Handles the data-fetching and file update logic for the unified workflow, eliminating conflicts between separate account updates.

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

### 4. `clean-workflows`
- **Purpose:**  
  Script to clean up workflow-related files and artifacts.
- **Relation:**  
  Maintenance utility for workflow management.

---

### 5. `python-requirements/`
- **Purpose:**  
  Directory containing Python modules or requirements needed by the scripts.
- **How it works:**  
  - Contains the `minsert` module for Markdown file manipulation.
  - Scripts add this directory to `PYTHONPATH` to import required modules.
- **Relation:**  
  Supports the Python scripts in this directory by providing necessary dependencies.

---

## Required Repository Secrets

The following secrets **must be set in your GitHub repository** for the unified workflow to function:

- `MY_GH_PAT`  
  **Description:** A GitHub Personal Access Token with repo permissions.  
  **Used for:** Authenticating git and GitHub CLI operations in the workflow.

- `STEAM_API_KEY`  
  **Description:** Your Steam Web API key for the main account.  
  **Used for:** Fetching playtime data from the Steam API for the main account.

- `STEAM_USER_ID`  
  **Description:** Your Steam 64-bit user ID for the main account.  
  **Used for:** Identifying the main account's playtime to fetch.

- `STEAM_API_KEY_AFK`  
  **Description:** Your Steam Web API key for the AFK account.  
  **Used for:** Fetching playtime data from the Steam API for the AFK account.

- `STEAM_USER_ID_AFK`  
  **Description:** Your Steam 64-bit user ID for the AFK account.  
  **Used for:** Identifying the AFK account's playtime to fetch.

- `STEAM_GAME_ID`  
  **Description:** The Steam App ID of the game to track (e.g., 438100 for VRChat).  
  **Used for:** Specifying which game's playtime to fetch for both accounts.

---

## How the Unified Scripts Work Together

- **Workflow Automation:**  
  The unified GitHub Actions workflow creates separate config files for each account and runs `update-vrchours-unified.sh`.
  
- **Sequential Processing:**  
  The shell script calls the Python script twice:
  1. First for the main account (collects data)
  2. Then for the AFK account (collects data and generates final README)
  
- **Conflict Prevention:**  
  By collecting all data before updating the template, the unified approach ensures both placeholders (`myhoursHERE` and `afkhoursHERE`) are available and updated in a single operation.
  
- **Single PR Creation:**  
  If either account's hours have changed, one pull request is created with both updates, avoiding merge conflicts.

- **Maintenance:**  
  The `delete_failed_and_old_workflow_runs.py` script keeps the Actions history clean.

---

## Usage

- **Run unified update script manually:**  
  ```bash
  # Create config files first
  echo "STEAM_API_KEY=your_key" > steam_vars_main.txt
  echo "STEAM_ID=your_id" >> steam_vars_main.txt
  echo "STEAM_API_KEY=your_key" > steam_vars_afk.txt
  echo "STEAM_ID=your_id" >> steam_vars_afk.txt
  
  # Run the unified script
  ./update-vrchours-unified.sh /path/to/repo <STEAM_GAME_ID>
  ```
  Optionally add `cron` as a third argument to enable random delay.

- **Run cleanup script:**  
  ```bash
  python3 delete_failed_and_old_workflow_runs.py
  ```

- **Run Python script directly (for testing):**  
  ```bash
  # Process main account
  ./update-myhours-unified.py <STEAM_GAME_ID> steam_vars_main.txt main -v
  
  # Process AFK account (must run after main)
  ./update-myhours-unified.py <STEAM_GAME_ID> steam_vars_afk.txt afk -v
  ```

> **Note:**  
> Scripts require secrets to be set in the repository. The workflow automatically creates the config files from secrets. For manual testing, create them as shown above.

---

## Legacy Scripts (Deprecated)

The following scripts have been replaced by the unified workflow and are no longer used:

- `update-vrchours-workflow-v2.sh` ❌
- `update-vrchours-workflow-v2-afk.sh` ❌
- `update-myhours-workflow-v2.py` ❌
- `update-myhours-workflow-v2-afk.py` ❌
- `update-myhours-workflow.py` ❌
- `update-myhours.py` ❌
- `update-vrchours-workflow.sh` ❌
- `update-vrchours.sh` ❌

These files can be safely removed from the repository.

---


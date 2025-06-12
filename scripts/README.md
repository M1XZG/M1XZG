# Scripts Directory

This directory contains utility scripts for managing and maintaining the GitHub repository workflows and related automation. Below is a description of each script and how they relate to each other.

---

## Script Overview

### 1. `update-vrchours-workflow.sh`
- **Purpose:**  
  This Bash script is used to update VRChat hours by fetching data from the Steam API and updating relevant files or records in the repository.
- **How it works:**  
  It is typically run as part of a scheduled GitHub Actions workflow. The script uses environment variables for Steam user and game IDs, and may call Python scripts for data processing.
- **Relation:**  
  This script is the main entry point for updating VRChat hours and may trigger or depend on other scripts for data handling.

---

### 2. `delete_failed_and_old_workflow_runs.py`
- **Purpose:**  
  This Python script cleans up GitHub Actions workflow runs by deleting failed runs and keeping only a specified number of the most recent successful or non-failed runs.
- **How it works:**  
  It uses the GitHub API to list workflow runs, deletes all failed runs, and ensures only the latest N non-failed runs are kept (where N is configurable in the script).
- **Relation:**  
  This script helps manage repository hygiene by preventing the accumulation of old or failed workflow runs, which can clutter the Actions UI and count against GitHub's storage limits.

---

### 3. `python-requirements/`
- **Purpose:**  
  This directory (if present) contains Python modules or requirements needed by the scripts, such as dependencies for API calls or data processing.
- **How it works:**  
  Scripts like `delete_failed_and_old_workflow_runs.py` may require packages listed here. The environment variable `PYTHONPATH` may be set to include this directory.
- **Relation:**  
  Supports the Python scripts in this directory by providing necessary dependencies.

---

## How the Scripts Relate

- **Workflow Automation:**  
  The `update-vrchours-workflow.sh` script is typically run by a GitHub Actions workflow to automate the process of updating VRChat hours.
- **Maintenance:**  
  The `delete_failed_and_old_workflow_runs.py` script is used to keep the Actions history clean, which is especially useful if the update workflow runs frequently.
- **Dependencies:**  
  The `python-requirements/` directory provides shared Python dependencies for scripts in this folder.

---

## Usage

- **Run update script:**  
  ```bash
  ./update-vrchours-workflow.sh
  ```
- **Run cleanup script:**  
  ```bash
  python3 delete_failed_and_old_workflow_runs.py
  ```

> **Note:**  
> Some scripts require environment variables (such as GitHub or Steam tokens) to be set before execution.

---
import requests
import os

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
REPO_OWNER = "M1XZG"
REPO_NAME = "M1XZG"
API_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"

session = requests.Session()
session.headers.update({"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"})

def get_all_runs():
    runs = []
    page = 1
    while True:
        resp = session.get(f"{API_URL}/actions/runs", params={"per_page": 100, "page": page})
        resp.raise_for_status()
        data = resp.json()
        runs.extend(data.get('workflow_runs', []))
        if len(data.get('workflow_runs', [])) < 100:
            break
        page += 1
    return runs

def delete_run(run_id):
    resp = session.delete(f"{API_URL}/actions/runs/{run_id}")
    if resp.status_code == 204:
        print(f"Deleted run {run_id}")
    else:
        print(f"Failed to delete run {run_id}: {resp.status_code} - {resp.text}")

def main():
    all_runs = get_all_runs()
    print(f"Total workflow runs found: {len(all_runs)}")

    # Always delete failed runs
    failed_runs = [run for run in all_runs if run["conclusion"] == "failure"]
    for run in failed_runs:
        delete_run(run["id"])

    # Exclude failed runs from the "recent 100" logic
    non_failed_runs = [run for run in all_runs if run["conclusion"] != "failure"]
    # Sort by created_at descending (most recent first)
    non_failed_runs.sort(key=lambda x: x["created_at"], reverse=True)
    # Keep the most recent 100
    keep_runs = set(run["id"] for run in non_failed_runs[:100])
    # Delete all other non-failed runs
    for run in non_failed_runs[100:]:
        delete_run(run["id"])

    print("Cleanup completed.")

if __name__ == "__main__":
    main()

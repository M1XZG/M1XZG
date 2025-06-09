import requests
import os
import time
from datetime import datetime

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
REPO_OWNER = "M1XZG"
REPO_NAME = "M1XZG"
API_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"
RATE_LIMIT_ALLOWANCE = 5000
RATE_LIMIT_THRESHOLD = int(RATE_LIMIT_ALLOWANCE * 0.8)  # 80%
SLEEP_INTERVAL = 1  # seconds between delete requests

session = requests.Session()
session.headers.update({"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"})

def check_rate_limit(headers):
    remaining = int(headers.get("X-RateLimit-Remaining", RATE_LIMIT_ALLOWANCE))
    limit = int(headers.get("X-RateLimit-Limit", RATE_LIMIT_ALLOWANCE))
    reset = int(headers.get("X-RateLimit-Reset", time.time() + 60))
    used = limit - remaining

    print(f"API Usage: Used {used} of {limit} (Remaining: {remaining})")
    if used >= RATE_LIMIT_THRESHOLD:
        reset_dt = datetime.utcfromtimestamp(reset)
        now = datetime.utcnow()
        wait_seconds = max((reset_dt - now).total_seconds(), 1)
        print(f"API usage exceeds 80% ({used}/{limit}). Sleeping until reset at {reset_dt} UTC ({int(wait_seconds)} seconds)...")
        time.sleep(wait_seconds)
    return remaining

def get_all_runs():
    runs = []
    page = 1
    while True:
        resp = session.get(f"{API_URL}/actions/runs", params={"per_page": 100, "page": page})
        check_rate_limit(resp.headers)
        resp.raise_for_status()
        data = resp.json()
        runs.extend(data.get('workflow_runs', []))
        if len(data.get('workflow_runs', [])) < 100:
            break
        page += 1
    return runs

def delete_run(run_id):
    while True:
        resp = session.delete(f"{API_URL}/actions/runs/{run_id}")
        check_rate_limit(resp.headers)
        if resp.status_code == 204:
            print(f"Deleted run {run_id}")
            break
        elif resp.status_code == 403:
            # Rate limit or permissions. Handle rate limit.
            reset = int(resp.headers.get('X-RateLimit-Reset', time.time() + 60))
            wait_seconds = max(reset - int(time.time()), 1)
            print(f"Rate limit hit while deleting. Sleeping for {wait_seconds} seconds.")
            time.sleep(wait_seconds)
        else:
            print(f"Failed to delete run {run_id}: {resp.status_code} - {resp.text}")
            break
    time.sleep(SLEEP_INTERVAL)

def main():
    all_runs = get_all_runs()
    print(f"Total workflow runs found: {len(all_runs)}")

    # Always delete failed runs
    failed_runs = [run for run in all_runs if run["conclusion"] == "failure"]
    for run in failed_runs:
        delete_run(run["id"])

    # Exclude failed runs from the "recent 100" logic
    non_failed_runs = [run for run in all_runs if run["conclusion"] != "failure"]
    non_failed_runs.sort(key=lambda x: x["created_at"], reverse=True)
    keep_runs = set(run["id"] for run in non_failed_runs[:100])
    for run in non_failed_runs[100:]:
        delete_run(run["id"])

    print("Cleanup completed.")

if __name__ == "__main__":
    main()

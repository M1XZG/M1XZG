#!/usr/bin/env python3

import sys
import os
import shutil
import requests
from datetime import datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python-requirements'))
from minsert import MarkdownFile

def load_steam_vars(filename="steam_vars.txt", debug=False):
    steam_vars = {}
    try:
        with open(filename, "r") as file:
            for line in file:
                key, value = line.strip().split("=")
                steam_vars[key] = value
    except FileNotFoundError:
        print(f"Error: '{filename}' not found. Please create it with your Steam API key and Steam ID.")
        sys.exit(1)
    except ValueError:
        print(f"Error: Invalid format in '{filename}'. Ensure it's formatted as KEY=VALUE.")
        sys.exit(1)
    if debug:
        print(f"[DEBUG] Loaded steam_vars: {steam_vars}")
    return steam_vars.get("STEAM_API_KEY"), steam_vars.get("STEAM_ID")

def get_playtime(steam_id, app_id, api_key, debug=False):
    url = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
    params = {
        "key": api_key,
        "steamid": steam_id,
        "include_played_free_games": True,
        "format": "json"
    }
    if debug:
        print(f"[DEBUG] Requesting URL: {url}")
        print(f"[DEBUG] Params: {params}")
    response = requests.get(url, params=params)
    if response.status_code != 200:
        print("Error: Failed to fetch data from Steam API.")
        if debug:
            print(f"[DEBUG] Response status: {response.status_code}")
            print(f"[DEBUG] Response text: {response.text}")
        sys.exit(1)
    data = response.json()
    if debug:
        print(f"[DEBUG] Response JSON: {data}")
    if "response" in data and "games" in data["response"]:
        games = data["response"]["games"]
        for game in games:
            if game["appid"] == int(app_id):
                playtime_minutes = game["playtime_forever"]
                playtime_hours = round(playtime_minutes / 60, 1)
                if debug:
                    print(f"[DEBUG] Found appid {app_id}: {playtime_minutes} min, {playtime_hours} hrs")
                return playtime_hours
    print("Game not found in the user's library.")
    sys.exit(1)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Update playtime in README from Steam API.")
    parser.add_argument("GAMEID", help="Steam App/Game ID")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose/debug output")
    args = parser.parse_args()

    GAMEID = args.GAMEID
    debug = args.verbose

    STEAM_API_KEY, STEAM_ID = load_steam_vars(debug=debug)
    if debug:
        print(f"[DEBUG] STEAM_API_KEY: {STEAM_API_KEY}")
        print(f"[DEBUG] STEAM_ID: {STEAM_ID}")
        print(f"[DEBUG] GAMEID: {GAMEID}")

    playtime_hours = get_playtime(STEAM_ID, GAMEID, STEAM_API_KEY, debug=debug)
    formatted_hours = f"{playtime_hours:,.1f}"

    current_date = datetime.now().astimezone().strftime("%Y-%m-%d @ %H:%M %Z")
    if debug:
        print(f"[DEBUG] Current date: {current_date}")
        print(f"[DEBUG] Playtime hours: {formatted_hours}")

    vrchours = {
        "myhoursHERE": f"As of <strong>{current_date}</strong> - {formatted_hours} <sup>lifetime hrs</sup>",
    }

    # Backup and copy template
    if debug:
        print("[DEBUG] Backing up README.md to README.md.bak")
    shutil.copy('./README.md', './README.md.bak')
    if debug:
        print("[DEBUG] Copying template to TMP-README.md")
    shutil.copy('./templates/README-template.md', './TMP-README.md')

    # Insert the hours into the Markdown file
    if debug:
        print("[DEBUG] Inserting hours into TMP-README.md")
    file = MarkdownFile("./TMP-README.md")
    file.insert(vrchours)
    if debug:
        print("[DEBUG] Done.")

if __name__ == "__main__":
    main()

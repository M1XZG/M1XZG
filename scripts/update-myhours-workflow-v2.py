#!/usr/bin/env python3

import sys
import os
import shutil
import requests
from datetime import datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python-requirements'))
from minsert import MarkdownFile

def load_steam_vars(filename="steam_vars.txt"):
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
    
    return steam_vars.get("STEAM_API_KEY"), steam_vars.get("STEAM_ID")

def get_playtime(steam_id, app_id, api_key):
    url = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
    params = {
        "key": api_key,
        "steamid": steam_id,
        "include_played_free_games": True,
        "format": "json"
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        print("Error: Failed to fetch data from Steam API.")
        sys.exit(1)
    
    data = response.json()
    
    if "response" in data and "games" in data["response"]:
        games = data["response"]["games"]
        for game in games:
            if game["appid"] == int(app_id):
                playtime_minutes = game["playtime_forever"]
                playtime_hours = round(playtime_minutes / 60, 1)
                return playtime_hours
    
    print("Game not found in the user's library.")
    sys.exit(1)

def main():
    if len(sys.argv) != 2:
        print("Usage: python update-myhours-workflow-v2.py <GAMEID>")
        sys.exit(1)

    GAMEID = sys.argv[1]

    STEAM_API_KEY, STEAM_ID = load_steam_vars()

    playtime_hours = get_playtime(STEAM_ID, GAMEID, STEAM_API_KEY)
    formatted_hours = f"{playtime_hours:,.1f}"

    current_date = datetime.now().strftime("%Y-%m-%d @ %H:%M")

    vrchours = {
        "myhoursHERE": f"As of <strong>{current_date}hrs</strong> - {formatted_hours} <sup>lifetime hrs</sup>",
    }

    # Backup and copy template
    shutil.copy('./README.md', './README.md.bak')
    shutil.copy('./templates/README-template.md', './TMP-README.md')

    # Insert the hours into the Markdown file
    file = MarkdownFile("./TMP-README.md")
    file.insert(vrchours)

if __name__ == "__main__":
    main()

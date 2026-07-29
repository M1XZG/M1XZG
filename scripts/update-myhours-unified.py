#!/usr/bin/env python3

import sys
import os
import re
import shutil
import requests
from datetime import datetime
from urllib.parse import quote
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python-requirements'))
from minsert import MarkdownFile

# Hours consistently missing from the API that we want to add back
OFFSET_MISSING_HOURS = 13.0
WIGLE_BADGE_URL = "https://wigle.net/bi/WkoSmTxhhOrSbz9bThNm+g.png"
WIGLE_CACHE_PLACEHOLDER = "WIGLE_CACHE_VERSION"

def get_existing_wigle_cache_version(filename):
    """Read the current WiGLE cache version from an existing README."""
    try:
        with open(filename, "r") as file:
            content = file.read()
    except FileNotFoundError:
        return None

    match = re.search(
        rf'{re.escape(WIGLE_BADGE_URL)}\?v=([^"&]+)',
        content
    )
    return match.group(1) if match else None

def get_wigle_cache_version(readme_filename, debug=False):
    """Return a URL-safe version derived from WiGLE's current image metadata."""
    try:
        response = requests.head(
            WIGLE_BADGE_URL,
            allow_redirects=True,
            timeout=15
        )
        response.raise_for_status()
        version_source = response.headers.get("ETag") or response.headers.get("Last-Modified")
        if not version_source:
            raise ValueError("WiGLE returned neither an ETag nor Last-Modified header")

        version = quote(version_source.strip('"'), safe="")
        if debug:
            print(f"[DEBUG] WiGLE cache version: {version}")
        return version
    except (requests.RequestException, ValueError) as error:
        existing_version = get_existing_wigle_cache_version(readme_filename)
        if existing_version:
            print(
                f"Warning: Failed to retrieve WiGLE image metadata ({error}); "
                f"preserving cache version {existing_version}.",
                file=sys.stderr
            )
            return existing_version

        print(
            f"Error: Failed to retrieve WiGLE image metadata and no existing "
            f"cache version is available: {error}",
            file=sys.stderr
        )
        sys.exit(1)

def insert_wigle_cache_version(filename, version):
    """Replace the WiGLE cache placeholder in a generated README."""
    with open(filename, "r") as file:
        content = file.read()

    if WIGLE_CACHE_PLACEHOLDER not in content:
        print(
            f"Error: '{WIGLE_CACHE_PLACEHOLDER}' was not found in '{filename}'.",
            file=sys.stderr
        )
        sys.exit(1)

    with open(filename, "w") as file:
        file.write(content.replace(WIGLE_CACHE_PLACEHOLDER, version))

def load_steam_vars(filename, debug=False):
    """Load Steam API credentials from config file"""
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
        print(f"[DEBUG] Loaded steam_vars from {filename}: {steam_vars}")
    return steam_vars.get("STEAM_API_KEY"), steam_vars.get("STEAM_ID")

def get_playtime(steam_id, app_id, api_key, debug=False):
    """Fetch playtime from Steam API"""
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
    parser = argparse.ArgumentParser(description="Update playtime in README from Steam API (Unified).")
    parser.add_argument("GAMEID", help="Steam App/Game ID")
    parser.add_argument("config_file", help="Steam config file (e.g., steam_vars_main.txt or steam_vars_afk.txt)")
    parser.add_argument("user_type", choices=['main', 'afk'], help="User type: main or afk")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose/debug output")
    args = parser.parse_args()

    GAMEID = args.GAMEID
    config_file = args.config_file
    user_type = args.user_type
    debug = args.verbose

    STEAM_API_KEY, STEAM_ID = load_steam_vars(config_file, debug=debug)
    if debug:
        print(f"[DEBUG] STEAM_API_KEY: {STEAM_API_KEY}")
        print(f"[DEBUG] STEAM_ID: {STEAM_ID}")
        print(f"[DEBUG] GAMEID: {GAMEID}")
        print(f"[DEBUG] User Type: {user_type}")

    playtime_hours = get_playtime(STEAM_ID, GAMEID, STEAM_API_KEY, debug=debug)

    # Apply the fixed offset and round to one decimal place
    adjusted_hours = round(playtime_hours + OFFSET_MISSING_HOURS, 1)
    if debug:
        print(f"[DEBUG] Raw playtime hours: {playtime_hours:.1f}")
        print(f"[DEBUG] Offset applied: +{OFFSET_MISSING_HOURS}")
        print(f"[DEBUG] Adjusted playtime hours: {adjusted_hours:.1f}")

    formatted_hours = f"{adjusted_hours:,.1f}"

    current_date = datetime.now().astimezone().strftime("%Y-%m-%d @ %H:%M %Z")
    if debug:
        print(f"[DEBUG] Current date: {current_date}")
        print(f"[DEBUG] Playtime hours (formatted): {formatted_hours}")

    # Determine placeholder and suffix based on user type
    if user_type == 'main':
        placeholder = "myhoursHERE"
        suffix = "lifetime hrs"
    else:  # afk
        placeholder = "afkhoursHERE"
        suffix = "AFK lifetime hrs"

    hours_data = {
        placeholder: f"As of <strong>{current_date}</strong> - {formatted_hours} <sup>{suffix}</sup>",
    }

    # The unified approach: collect data from both accounts before writing
    data_file = './TMP-hours-data.txt'
    
    # Store the hours data for this account
    if debug:
        print(f"[DEBUG] Writing {user_type} hours data to {data_file}")
    
    with open(data_file, 'a') as f:
        f.write(f"{placeholder}={formatted_hours}|{suffix}|{current_date}\n")
    
    # If this is the AFK account (last to run), process the complete README
    if user_type == 'afk':
        if debug:
            print("[DEBUG] Processing complete README with both accounts")
        
        # Read all collected data
        all_data = {}
        with open(data_file, 'r') as f:
            for line in f:
                key, value = line.strip().split('=', 1)
                hours, suffix_text, date = value.split('|')
                all_data[key] = f"As of <strong>{date}</strong> - {hours} <sup>{suffix_text}</sup>"
        
        # Backup and create final README
        if debug:
            print("[DEBUG] Backing up README.md to README.md.bak")
        shutil.copy('./README.md', './README.md.bak')
        
        temp_file = './TMP-README-unified.md'
        if debug:
            print(f"[DEBUG] Copying template to {temp_file}")
        shutil.copy('./templates/README-template.md', temp_file)

        wigle_cache_version = get_wigle_cache_version('./README.md', debug=debug)
        insert_wigle_cache_version(temp_file, wigle_cache_version)
        
        # Insert all hours data at once
        if debug:
            print(f"[DEBUG] Inserting all hours data into {temp_file}")
        file = MarkdownFile(temp_file)
        file.insert(all_data)
        
        # Clean up data file
        os.remove(data_file)
        if debug:
            print(f"[DEBUG] Done processing both accounts.")
    else:
        if debug:
            print(f"[DEBUG] Done collecting {user_type} account data.")

if __name__ == "__main__":
    main()

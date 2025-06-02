#!/usr/bin/env python3

import requests
import shutil
from datetime import datetime
import sys

STEAM_API_KEY = 'your_api_key_here'  # Replace with your Steam API key
STEAM_ID = 'your_steam_id'
GAME_ID = '438100'  # Replace with your desired game ID

# Backup existing README
shutil.copy('./README.md', './README.md.bak')

# Fetch playtime from Steam API
url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
params = {
    "key": STEAM_API_KEY,
    "steamid": STEAM_ID,
    "include_played_free_games": True,
    "format": "json"
}

response = requests.get(url, params=params)

if response.status_code != 200:
    print(f"Error fetching data from Steam API: {response.status_code}")
    sys.exit(1)

data = response.json()

playtime_hours = None
for game in data.get("response", {}).get("games", []):
    if game["appid"] == int(GAMEID):
        playtime_minutes = game["playtime_forever"]
        playtime_hours = round(playtime_minutes / 60, 1)
        break
else:
    print(f"Game with App ID {GAMEID} not found in user's library.")
    sys.exit(1)

formatted_hours = f"{playtime_hours:,.1f}"
current_date = datetime.now().strftime("%Y-%m-%d @ %H:%M")

# Backup and copy template
shutil.copy('./README.md', './README.md.bak')

with open('./templates/README-template.md', 'r') as template_file:
    content = template_file.read()

content = content.replace('{{VRCHOURS}}', formatted_hours)
content = content.replace('{{UPDATED_AT}}', current_date)

with open('./README.md', 'w') as readme_file:
    readme_file.write(content)

print("README updated successfully.")

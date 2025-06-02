#!/usr/bin/python3

import sys
import urllib.request
import shutil
from datetime import datetime

# Check if the correct number of arguments are passed
if len(sys.argv) != 3:
    print("Usage: python update.py <STEAMID> <GAMEID>")
    sys.exit(1)

# Assign variables from command line arguments
STEAMID = sys.argv[1]
GAMEID = sys.argv[2]

# Backup and copy template
shutil.copy('./README.md', './README.md.bak')
shutil.copy('./templates/README-template.md', './TMP-README.md')

# Fetch URL content
url = f"https://steamcommunity.com/profiles/{STEAMID}/stats/{GAMEID}/?xml=1"
try:
    with urllib.request.urlopen(url) as response:
        livehours = response.read().decode('utf-8').strip()
except Exception as e:
    print(f"Error fetching data: {e}")
    sys.exit(1)

# Validate and parse numeric hours
try:
    numeric_hours = float(livehours.split()[0])
except (ValueError, IndexError):
    print(f"Unexpected data format received: '{livehours}'")
    sys.exit(1)

rounded_hours = round(numeric_hours, 1)
formatted_hours = f"{rounded_hours:,.1f}"

current_date = datetime.now().strftime("%Y-%m-%d @ %H:%M")

# Replace placeholder in template
with open('./templates/README-template.md', 'r') as template_file:
    content = template_file.read()

content = content.replace('{{VRCHOURS}}', formatted_hours)
content = content.replace('{{UPDATED_AT}}', current_date)

with open('./README.md', 'w') as readme_file:
    readme_file.write(content)

print("README updated successfully.")

#!/usr/bin/python3

import sys
import urllib.request
from minsert import MarkdownFile
from datetime import datetime

# Check if the correct number of arguments are passed
if len(sys.argv) != 3:
    print("Usage: python update.py <STEAMID> <GAMEID>")
    sys.exit(1)

# Assign variables from command line arguments
STEAMID = sys.argv[1]
GAMEID = sys.argv[2]

# Fetch the URL content
url = f"https://decapi.me/steam/hours/{STEAMID}/{GAMEID}"
with urllib.request.urlopen(url) as response:
    livehours = response.read().decode("utf-8")

# Get the current date
current_date = datetime.now().strftime("%Y-%m-%d")

# Create a dictionary with the formatted hours
vrchours = {
    "myhours": f"## My VRChat Hours:\n\nAs of {current_date} - {livehours}",
}

# Insert the hours into the Markdown file
file = MarkdownFile("README-clone.md")
file.insert(vrchours)

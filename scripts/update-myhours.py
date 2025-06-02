#!/usr/bin/python3

import sys
import urllib.request
from minsert import MarkdownFile
from datetime import datetime
import shutil

# Check if the correct number of arguments are passed
if len(sys.argv) != 3:
    print("Usage: python update.py <STEAMID> <GAMEID>")
    sys.exit(1)

# Assign variables from command line arguments
STEAMID = sys.argv[1]
GAMEID = sys.argv[2]

# Copy the template file to README.md
shutil.copy('./README.md', './README.md.bak')
shutil.copy('./templates/README-template.md', './TMP-README.md')

# Fetch the URL content
url = f"https://decapi.me/steam/hours/{STEAMID}/{GAMEID}"
with urllib.request.urlopen(url) as response:
    livehours = response.read().decode("utf-8")

# Extract the numeric part (remove ' hours')
numeric_hours = float(livehours.split()[0])

# Round to one decimal place
rounded_hours = round(numeric_hours, 1)

# Format with a comma for thousands separator
formatted_hours = f"{rounded_hours:,.1f}"

# Get the current date
current_date = datetime.now().strftime("%Y-%m-%d @ %H:%M")

# Create a dictionary with the formatted hours
vrchours = {
    "myhours": f"As of **{current_date}hrs** - {formatted_hours} <sup>lifetime hrs</sup>",
}

# Insert the hours into the Markdown file
file = MarkdownFile("./TMP-README.md")
file.insert(vrchours)

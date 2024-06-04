# update.py

import urllib.request
from minsert import MarkdownFile

# Fetch the URL content
url = "https://decapi.me/steam/hours/76561198449494512/438100"
with urllib.request.urlopen(url) as response:
    livehours = response.read().decode("utf-8")

# Create a dictionary with the formatted hours
vrchours = {
    "myhours": f"### My VRChat Hours: {livehours}",
}

# Insert the hours into the Markdown file
file = MarkdownFile("README-clone.md")
file.insert(vrchours)

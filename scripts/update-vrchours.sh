#!/bin/zsh

SRC=<PATH TO YOUR PROFILE REPO ON DISK>

cd $SRC

# Pull the profile down
gh repo sync

# Fetch the current hours and update the README.md
# VRChat Game ID: 438100
./scripts/update-myhours.py <YOUR_STEAM_ID_NUMBER> <STEAM_GAME_ID>

git add README.md
git commit -a -m "Update VRC Hours"
git push


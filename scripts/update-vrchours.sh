#!/bin/zsh

# This is the path to your repo on local disk, ie: $HOME/myrepos/REPO_NAME
SRC=$1

TSTAMP=`date +%N`
NEWBRANCH="z$TSTAMP"
cd $SRC

gh repo sync

git switch --create $NEWBRANCH

# Fill in your STEAM_ID and the STEAM_GAME_ID here
# VRChat STEAM_GAME_ID = 438100
#
# Uncomment to hard code
#./scripts/update-myhours.py <YOUR_STEAM_ID_NUMBER> <STEAM_GAME_ID>

# use this with command line arguments
./scripts/update-myhours.py $2 $3

git commit -a -m "Update VRC Hours - $TSTAMP"
git push --set-upstream origin $NEWBRANCH
gh pr create --title "Update VRC Hours - $TSTAMP" --body "Update of VRChat hours via cron"
sleep 5
gh pr merge --auto -m
git checkout main

# Clean up branches that have been merged and deleted on remote
# git branch --merged| grep -Ev "(^\*|master|main|dev)" | xargs git branch -d


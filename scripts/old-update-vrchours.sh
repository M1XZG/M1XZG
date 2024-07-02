#!/bin/zsh

# This is the path to your repo on local disk, ie: $HOME/myrepos/REPO_NAME
SRC=$1
STEAM_USER_ID=$2
STEAM_GAME_ID=$3

# Grabbing the timestamp to use as part of the new branch
TSTAMP=`date +%N`
NEWBRANCH="z$TSTAMP"

cd $SRC

# Lets just sync the repo to be sure we have the current version
gh repo sync

# Fill in your STEAM_ID and the STEAM_GAME_ID here
# VRChat STEAM_GAME_ID = 438100
#
# Uncomment to hard code
#./scripts/update-myhours.py <YOUR_STEAM_ID_NUMBER> <STEAM_GAME_ID>

# use this with command line arguments
./scripts/update-myhours.py $STEAM_USER_ID $STEAM_GAME_ID

cmp $SRC/README.md $SRC/TMP-README.md
rv=$?
if [[ $rv == 0 ]]
then
	echo "No diff, exiting"
	# rm $SRC/TMP-README.md
    exit
fi

echo "Files are different.. continuing"

git switch --create $NEWBRANCH

mv $SRC/TMP-README.md ./README.md

git commit -a -m "Update VRC Hours - $TSTAMP"
git push --set-upstream origin $NEWBRANCH
gh pr create --title "Update VRC Hours - $TSTAMP" --body "Update of VRChat hours via cron"
sleep 5
gh pr merge --auto -m
git checkout main

# Clean up branches that have been merged and deleted on remote
gh repo sync
git branch --merged| grep -Ev "(^\*|master|main|dev)" | xargs git branch -d
git remote prune origin

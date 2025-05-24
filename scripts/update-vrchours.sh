#!/bin/zsh
# filepath: update-vrchours.sh

LOCKFILE="/tmp/update-vrchours.lock"

if [ -e "$LOCKFILE" ]; then
    echo "Script is already running. Exiting."
    exit 1
fi

touch "$LOCKFILE"
trap 'rm -f "$LOCKFILE"; exit' INT TERM EXIT


# Run this like:
#
# The first 3 paramaters are required:
#	1 - local path to the repo you've cloned from github
#	2 - YOUR long SteamID
#	3 - The STEAM_GAME_ID of the game to check
#
# Optional 4th param of the word `cron`. Running without this option the script
# execute instantly and complete as intended. Using the option will invoke a
# delay in the execution of the main fuction by a random number of minutes 
#
# update-vrchours.sh LOCAL_PATH_TO_REPO STEAM_ID STEAM_GAME_ID [cron]

# This is the path to your repo on local disk, ie: $HOME/myrepos/REPO_NAME
SRC=$1
STEAM_USER_ID=$2
STEAM_GAME_ID=$3

if [ "$4" = "cron" ]; then
	TDELAY=`printf "%02d\n" $[RANDOM%120+5]`
	CRON=yes
fi

updateprofile () {

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

	# Start to diff the times and not the file

	LASTTIME=`grep "As of" $SRC/README.md | awk '{print $7}'`
	NEWTIME=`grep "As of" $SRC/TMP-README.md | awk '{print $7}'`

	if [[ "$LASTTIME" == "$NEWTIME" ]]
	then
		echo "No diff, exiting"
		rm $SRC/TMP-README.md
	    exit
	fi

#	cmp $SRC/README.md $SRC/TMP-README.md
#	rv=$?
#	if [[ $rv == 0 ]]
#	then
#		echo "No diff, exiting"
#		# rm $SRC/TMP-README.md
#	    exit
#	fi

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

	echo "*****************"
	echo "End of updateprofile function"
	echo ""
}

crondelay () {

	date
	sleep `echo $TDELAY`m
	date
	updateprofile
}

cleanup () {
	rm -f "$LOCKFILE"
	trap - INT TERM EXIT
}

case $CRON in
	yes)
		crondelay	
	;;
	*)
		updateprofile
	;;
esac

cleanup


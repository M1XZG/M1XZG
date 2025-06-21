#!/bin/bash
# filepath: update-vrchours.sh

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
STEAM_GAME_ID=$2

if [ "$4" = "cron" ]; then
    TDELAY=$((RANDOM % 45 + 5))
    CRON=yes
fi

updateprofile () {

	# Grabbing the timestamp to use as part of the new branch
	TSTAMP=`date +%s`
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
    ./scripts/update-myhours-workflow-v2.py $STEAM_GAME_ID
    if [ $? -ne 0 ]; then
        echo "Python script failed, exiting."
        exit 1
    fi

	# Start to diff the times and not the file

	LASTTIME=$(grep "As of" $SRC/README.md | awk -F'- | <sup>lifetime hrs' '{print $2}')
	NEWTIME=$(grep "As of" $SRC/TMP-README.md | awk -F'- | <sup>lifetime hrs' '{print $2}')

	if [[ "$LASTTIME" == "$NEWTIME" ]]
	then
		echo "No diff, exiting"
		#rm $SRC/TMP-README.md
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
	sleep 5s
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
	if [ -z "$TDELAY" ]; then
	    echo "TDELAY is not set. Exiting."
	    exit 1
	fi
	echo "Sleeping for ${TDELAY} minutes before running updateprofile"
	sleep "${TDELAY}m"
	date
	updateprofile
}

case $CRON in
	yes)
		crondelay	
	;;
	*)
		updateprofile
	;;
esac

# cleanup


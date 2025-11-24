#!/bin/bash
# filepath: update-vrchours-unified.sh
# 
# Unified script to update VRChat hours for both main and AFK accounts
# Processes both users sequentially to avoid conflicts
#
# Usage: update-vrchours-unified.sh LOCAL_PATH_TO_REPO STEAM_GAME_ID [cron]

SRC=$1
STEAM_GAME_ID=$2

if [ "$3" = "cron" ]; then
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

    echo "================================"
    echo "Processing Main Account Hours"
    echo "================================"
    
    # Process main account
    ./scripts/update-myhours-unified.py $STEAM_GAME_ID steam_vars_main.txt main
    if [ $? -ne 0 ]; then
        echo "Python script failed for main account, exiting."
        exit 1
    fi

    echo ""
    echo "================================"
    echo "Processing AFK Account Hours"
    echo "================================"
    
    # Process AFK account
    ./scripts/update-myhours-unified.py $STEAM_GAME_ID steam_vars_afk.txt afk
    if [ $? -ne 0 ]; then
        echo "Python script failed for AFK account, exiting."
        exit 1
    fi

    # Check if there are any changes
    if [ ! -f "$SRC/TMP-README-unified.md" ]; then
        echo "No temporary README generated, exiting"
        exit
    fi

    # Compare the files
    cmp $SRC/README.md $SRC/TMP-README-unified.md
    rv=$?
    if [[ $rv == 0 ]]; then
        echo "No diff, exiting"
        rm $SRC/TMP-README-unified.md
        exit
    fi

    echo ""
    echo "Files are different.. continuing with PR"

    git switch --create $NEWBRANCH

    mv $SRC/TMP-README-unified.md ./README.md

    git commit -a -m "Update VRChat Hours (Main + AFK) - $TSTAMP"
    git push --set-upstream origin $NEWBRANCH
    gh pr create --title "Update VRChat Hours (Main + AFK) - $TSTAMP" --body "Update of VRChat hours for both accounts via cron"
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

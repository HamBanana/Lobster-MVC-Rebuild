#!/usr/bin/bash
#LOBSTER_ROOT=/home/thawasta/codespace/Lobster-MVC-Rebuild
cd $LOBSTER_ROOT
git config --global --add safe.directory $LOBSTER_ROOT
git commit -a -m "Commit from Pi"
git pull
npm install
node ./index.js
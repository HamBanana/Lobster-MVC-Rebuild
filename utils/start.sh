#!/usr/bin/bash
cd $LOBSTER_ROOT
git pull
npm install
node ./index.js
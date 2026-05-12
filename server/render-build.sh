#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# Build the app if necessary (not needed for this project usually)
# npm run build 

echo ">>> Installing Puppeteer Browser in project directory..."
# This will use the cacheDirectory defined in .puppeteerrc.cjs
npx puppeteer browsers install chrome

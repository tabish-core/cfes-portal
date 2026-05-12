#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# In Puppeteer 20+, we use this command to install the browser in the build environment
echo ">>> Installing Puppeteer Browser..."
npx puppeteer browsers install chrome

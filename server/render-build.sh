#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
npm install

# Install Chrome for Puppeteer on Render
# Note: This is a common way to ensure Puppeteer finds a browser on Render's Linux environment
if [[ ! -z "$RENDER_INSTANCE_ID" ]]; then
  echo ">>> Install Chrome dependencies for Puppeteer..."
  # Render's standard environment already has some libs, but for reliability:
  # This section is usually handled by the environment variables we set in the dashboard
  # However, we can also trigger a browser download here if needed.
  # For now, we rely on the PUPPETEER_EXECUTABLE_PATH pointing to Render's pre-installed Chrome.
fi

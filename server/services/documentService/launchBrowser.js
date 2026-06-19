/**
 * launchBrowser.js — Shared Puppeteer browser launcher.
 *
 * Production (Render):  Uses @sparticuz/chromium which bundles a minimal
 *                       statically-linked Chromium binary.
 * Local dev:            Uses the system-installed Chrome/Chromium, auto-detected
 *                       from common OS paths or via CHROME_EXECUTABLE_PATH env var.
 */

const puppeteer = require('puppeteer-core');

/**
 * Locate a locally installed Chrome/Chromium binary.
 * Checks common default install paths on Windows, macOS, and Linux.
 * Override with CHROME_EXECUTABLE_PATH env var if needed.
 */
const findLocalChrome = () => {
  const fs = require('fs');

  // Allow explicit override
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const candidates = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Chrome/Chromium not found. Install Google Chrome or set CHROME_EXECUTABLE_PATH env var.'
  );
};

/**
 * Launch a headless Chromium browser.
 *
 * @returns {Promise<import('puppeteer-core').Browser>}
 */
const launchBrowser = async () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: use @sparticuz/chromium (works on Render, Lambda, etc.)
    const chromium = require('@sparticuz/chromium');
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  // Local dev: use system-installed Chrome
  const executablePath = findLocalChrome();
  return puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
};

module.exports = { launchBrowser };

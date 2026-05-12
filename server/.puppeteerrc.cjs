const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  // This ensures the browser is installed INSIDE the project folder
  // so Render doesn't delete it after the build.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

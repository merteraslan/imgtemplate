/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Only install Chromium to reduce size and install time
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // Add any other required options for Chromium
      },
    },
  ],
  // Use a system path to store browsers
  use: {
    // Force a specific browser executable path
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH || undefined,
    },
  },
  // Skip installation of browser binaries when running in CI
  // since we'll handle that in our custom build step
  skipInstallBrowsers: !!process.env.CI,
};

module.exports = config;

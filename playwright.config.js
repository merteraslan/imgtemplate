/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Only install Chromium to reduce size and install time
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
};

module.exports = config;

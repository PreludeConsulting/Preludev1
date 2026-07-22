import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config.js";

export default defineConfig({
  ...baseConfig,
  grep: /@performance/,
  grepInvert: undefined,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  projects: [
    { name: "performance-chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});

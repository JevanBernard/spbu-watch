import { defineConfig } from "@playwright/test";

// Smoke test against a production build: `pnpm build && pnpm test:e2e`.
// Uses the locally installed Chrome (no browser download). Needs .env with Supabase + map style.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 1, // headless WebGL (software rendering) is occasionally flaky
  use: {
    baseURL: "http://localhost:3100",
    channel: "chrome",
    launchOptions: { args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
    viewport: { width: 375, height: 760 },
    permissions: ["geolocation"],
    geolocation: { latitude: -8.65, longitude: 115.2166 },
  },
  webServer: {
    command: "pnpm start -p 3100",
    url: "http://localhost:3100/api/official",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

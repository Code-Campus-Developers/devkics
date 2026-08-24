import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "DATABASE_URL=postgresql://abrahamogbu@localhost:5432/devkics?schema=public JWT_ACCESS_SECRET=test-access-secret-1234567890 JWT_REFRESH_SECRET=test-refresh-secret-1234567890 ACCESS_TOKEN_TTL=15m REFRESH_TOKEN_TTL=7d bun run dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

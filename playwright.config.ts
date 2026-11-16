import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    testMatch: "**/*.spec.ts",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [["list"], ["html", {open: "never"}]],
    use: {
        baseURL: process.env.BASE_URL ?? "http://127.0.0.1:4173",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: {...devices["Desktop Chrome"]},
        },
    ],
    webServer: {
        command: "npm run preview -- --host 127.0.0.1",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});

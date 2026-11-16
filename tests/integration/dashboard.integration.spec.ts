import {expect, test} from "@playwright/test";
import {signIn} from "../support/auth";

test.describe("dashboard integration", () => {
    test("rejects invalid credentials without opening the dashboard", async ({page}) => {
        await page.goto("/");
        await page.getByLabel("Email").fill("invalid-test-account@example.invalid");
        await page.getByLabel("Password").fill("invalid-password");
        await page.getByRole("button", {name: "Sign in"}).click();

        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("button", {name: "Logout"})).toHaveCount(0);
    });

    test("loads samples from the local backend after authentication", async ({page}) => {
        const samplesResponse = page.waitForResponse((response) =>
            response.url().endsWith("/api/samples") && response.request().method() === "GET");

        await signIn(page);

        const response = await samplesResponse;
        const responseBody = await response.text();
        expect(response.status(), `GET /api/samples returned ${response.status()}: ${responseBody}`).toBe(200);
        await expect(page.getByRole("region", {name: "Record list"})).toBeVisible();
        await expect(page.getByRole("button", {name: "Logout"})).toBeVisible();
    });
});

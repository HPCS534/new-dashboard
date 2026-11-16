import {expect, test, type Page} from "@playwright/test";

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

function credentials(): { email: string; password: string } {
    if (!email || !password) {
        throw new Error("Set TEST_EMAIL and TEST_PASSWORD before running authenticated integration tests.");
    }
    return {email, password};
}

async function signIn(page: Page, account: { email: string; password: string }) {
    await page.goto("/");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", {name: "Sign in"}).click();
    await expect(page.getByRole("heading", {name: "Record checking"})).toBeVisible();
}

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
        const account = credentials();
        const samplesResponse = page.waitForResponse((response) =>
            response.url().endsWith("/api/samples") && response.request().method() === "GET");

        await signIn(page, account);

        const response = await samplesResponse;
        expect(response.status()).toBe(200);
        await expect(page.getByRole("region", {name: "Record list"})).toBeVisible();
        await expect(page.getByRole("button", {name: "Logout"})).toBeVisible();
    });
});

import {expect, type Page} from "@playwright/test";

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

function credentials(): { email: string; password: string } {
    if (!email || !password) {
        throw new Error("Set TEST_EMAIL and TEST_PASSWORD before running authenticated browser tests.");
    }
    return {email, password};
}

export async function signIn(page: Page): Promise<void> {
    const account = credentials();
    await page.goto("/");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", {name: "Sign in"}).click();
    await expect(page.getByRole("heading", {name: "Record checking"})).toBeVisible();
}

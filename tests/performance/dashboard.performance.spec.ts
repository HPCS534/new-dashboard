import {expect, test} from "@playwright/test";
import {signIn} from "../support/auth";

const iterations = 5;
const listTargetMs = 3000;

test("measures dashboard list-load performance", async ({page}) => {
    await signIn(page);

    const durations: number[] = [];
    let errors = 0;
    let coldStartMs = 0;

    for (let index = 0; index < iterations; index += 1) {
        const start = Date.now();
        await signIn(page);
        await expect(page.getByText("No submissions yet.")).toBeVisible();
        const hasError = await page.getByRole("alert").count() > 0;
        const duration = Date.now() - start;

        if (index === 0) coldStartMs = duration;
        durations.push(duration);
        if (hasError) errors += 1;
        if (index < iterations - 1) {
            await page.getByRole("button", {name: "Logout"}).click();
            await expect(page.getByLabel("Email")).toBeVisible();
        }
    }

    const sorted = [...durations].sort((left, right) => left - right);
    const percentile = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
    const p50 = percentile(0.5);
    const p95 = percentile(0.95);
    const max = sorted[sorted.length - 1];
    const errorRate = errors / iterations;

    console.log(JSON.stringify({
        operation: "dashboard_list",
        iterations,
        users: 1,
        coldStartMs,
        p50Ms: p50,
        p95Ms: p95,
        maxMs: max,
        errorRate,
    }));

    expect(errorRate).toBe(0);
    expect(p95).toBeLessThanOrEqual(listTargetMs);
});

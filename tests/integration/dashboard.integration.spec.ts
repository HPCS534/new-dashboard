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

    test("preserves populated sample and replicate data from the local backend", async ({page}) => {
        const samplesResponse = page.waitForResponse((response) =>
            response.url().endsWith("/api/samples") && response.request().method() === "GET");

        await signIn(page);

        const response = await samplesResponse;
        expect(response.status()).toBe(200);
        const samples = await response.json();
        const sample = samples.find((item: { sampleId: string }) => item.sampleId === "2026WS-IND-001-S01");

        expect(sample).toMatchObject({
            sampleId: "2026WS-IND-001-S01",
            season: "2026WS",
            indexNumber: "IND-001",
            selectionName: "Local Test Selection",
            sampleNo: 1,
            replicateCount: 2,
            goodCount: 1,
            status: "accepted",
            averageWeight: 12.25,
            averagePercentage: 40.8,
            averageGrade: "Not Classified",
            meetsRecommendedValue: false,
        });
        expect(sample.replicates).toEqual([
            expect.objectContaining({
                replicateLabel: "2026WS-IND-001-S01-01",
                replicateNo: 1,
                immatureWeight: 12.4,
                percentage: 41.33,
                grade: "G1",
                reviewStatus: "accepted",
                quality: "good",
                confidence: 0.94,
                imagePublicId: "local/frontend-test/sample-001-replicate-01",
                imageSecureUrl: "https://placehold.co/1024x1024/png?text=Sample+001+Replicate+01",
                aiPredictedGrains: [
                    expect.objectContaining({x: 120, y: 180, width: 210, height: 180, confidence: 0.94}),
                ],
            }),
            expect.objectContaining({
                replicateLabel: "2026WS-IND-001-S01-02",
                replicateNo: 2,
                immatureWeight: 12.1,
                percentage: 40.33,
                grade: "G1",
                reviewStatus: "accepted",
                quality: "bad",
                confidence: 0.79,
                imagePublicId: "local/frontend-test/sample-001-replicate-02",
                imageSecureUrl: "https://placehold.co/1024x1024/png?text=Sample+001+Replicate+02",
                aiPredictedGrains: [
                    expect.objectContaining({x: 150, y: 200, width: 205, height: 175, confidence: 0.79}),
                ],
            }),
        ]);
        await expect(page.getByRole("region", {name: "Record list"})).toContainText("2026WS-IND-001-S01");
    });
});

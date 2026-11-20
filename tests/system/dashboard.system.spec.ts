import {expect, test} from "@playwright/test";
import {signIn} from "../support/auth";

test.describe("dashboard system flows", () => {
    test.describe.configure({mode: "serial"});

    test("navigates between dashboard views and logs out", async ({page}) => {
        await signIn(page);

        const dashboardNav = page.getByRole("navigation", {name: "Dashboard views"});
        await expect(dashboardNav.getByRole("button", {name: "Row view"})).toHaveClass(/current/);
        await dashboardNav.getByRole("button", {name: "Kanban View"}).click();
        await expect(page.locator("section.kanban-view.active")).toBeVisible();

        await dashboardNav.getByRole("button", {name: "Row view"}).click();
        await expect(page.getByRole("region", {name: "Record list"})).toBeVisible();

        await page.getByRole("button", {name: "Logout"}).click();
        await expect(page.getByRole("button", {name: "Sign in"})).toBeVisible();
    });

    test("shows populated dashboard controls and enables CSV export", async ({page}) => {
        await signIn(page);

        await expect(page.locator("table tbody tr").filter({hasText: "2026WS-IND-001-S01"})).toBeVisible();
        await expect(page.getByRole("button", {name: "Export CSV"})).toBeEnabled();
        await expect(page.getByRole("button", {name: "All"})).toBeVisible();
        await expect(page.getByPlaceholder(/Search sample/)).toBeVisible();
    });

    test("reviews a populated sample, filters it, opens details, and exports CSV", async ({page}) => {
        await signIn(page);

        const sampleId = "2026WS-IND-001-S01";
        const sampleRow = page.locator("table tbody tr").filter({hasText: sampleId});
        await expect(sampleRow).toBeVisible();
        await expect(sampleRow).toContainText("2026WS");
        await expect(sampleRow).toContainText("IND-001");
        await expect(sampleRow).toContainText("G1");

        await page.getByPlaceholder(/Search sample/).fill("IND-001");
        await expect(sampleRow).toBeVisible();
        await page.getByRole("button", {name: "Accepted", exact: true}).click();
        await expect(sampleRow).toBeVisible();

        await sampleRow.click();
        const detail = page.getByRole("dialog", {name: "Sample detail"});
        await expect(detail).toBeVisible();
        await expect(detail).toContainText(sampleId);
        await expect(detail).toContainText("2 (1 good)");
        await expect(detail).toContainText("12.25 g");
        await expect(detail).toContainText("Does not meet");
        await expect(detail.getByRole("tab")).toHaveCount(2);
        await expect(detail).toContainText("AI prediction (1)");
        await expect(detail).toContainText("Reviewer correction (1)");
        await expect(detail).toContainText("2026WS-IND-001-S01-01");

        const download = page.waitForEvent("download");
        await page.getByRole("button", {name: "Close sample detail"}).click();
        await page.getByRole("button", {name: "Export CSV"}).click();
        const exportedFile = await download;
        expect(exportedFile.suggestedFilename()).toMatch(/^granular-records-\d{8}\.csv$/);
    });

    test("keeps deployed replicate and sample review states consistent", async ({page}) => {
        await signIn(page);

        const row = page.locator("table tbody tr").filter({hasText: "Test1234"});
        await expect(row).toBeVisible();
        await expect(row).toContainText("Review");

        await page.getByRole("navigation", {name: "Dashboard views"})
            .getByRole("button", {name: "Kanban View"})
            .click();

        const replicateOne = page.locator(".kanban-card:visible").filter({hasText: "Test1234-01"});
        const replicateTwo = page.locator(".kanban-card:visible").filter({hasText: "ASDF1234-02"});
        await expect(replicateOne).toBeVisible();
        await expect(replicateTwo).toBeVisible();

        await page.getByRole("navigation", {name: "Dashboard views"})
            .getByRole("button", {name: "Row view"})
            .click();

        await expect(row).toBeVisible();
        await expect(row).toContainText("Review");
    });
});

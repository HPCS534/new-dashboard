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

    test("shows the empty-state dashboard when no records exist", async ({page}) => {
        await signIn(page);

        await expect(page.getByText("No submissions yet.")).toBeVisible();
        await expect(page.getByRole("button", {name: "Export CSV"})).toBeDisabled();
        await expect(page.getByRole("button", {name: "All"})).toBeVisible();
        await expect(page.getByPlaceholder(/Search sample/)).toBeVisible();
    });
});

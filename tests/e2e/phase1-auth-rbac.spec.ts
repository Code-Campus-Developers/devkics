import { expect, test } from "@playwright/test";

test.describe("Phase 1 foundation", () => {
  test("login and dashboard access works", async ({ page }) => {
    await page.goto("/auth");

    await page.getByRole("tab", { name: "Register" }).click();
    await page.getByPlaceholder("Ada Lovelace").fill("Phase One User");
    await page
      .getByRole("tabpanel", { name: "Register" })
      .getByPlaceholder("you@company.com")
      .fill("phase1-user@devkics.test");
    await page.getByPlaceholder("Choose a password").fill("devkics123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Player")).toBeVisible();
  });

  test("city organizer application can be submitted from public route", async ({ page }) => {
    await page.goto("/organize");

    await page.getByPlaceholder("Ada Lovelace").fill("Integration Applicant");
    await page.getByPlaceholder("you@company.com").fill("integration@applicant.dev");
    await page.getByPlaceholder("Abuja").fill("Lagos");
    await page
      .getByPlaceholder(
        "e.g. Lagos — a 1,200-member engineering community, two turf venues secured, targeting 8 teams.",
      )
      .fill("We have a strong local tech community and available venues.");

    await page.getByRole("button", { name: "Apply to organize" }).click();
    await expect(page.getByText("Application received")).toBeVisible();
  });
});

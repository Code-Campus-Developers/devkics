import { expect, test } from "@playwright/test";

test.describe("Phase 4.3 — Legal & Consent Flows", () => {
  test("legal portal renders all tabs and supports deep linking via URL parameter", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // 1. Visit root legal page (defaults to terms)
    await page.goto("/legal");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Legal, Privacy & Consent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();

    // 2. Click Privacy tab
    await page.getByRole("tab", { name: "Privacy" }).click();
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText("Strict Protection of Sensitive Data (§13)")).toBeVisible();

    // 3. Click Conduct tab
    await page.getByRole("tab", { name: "Conduct" }).click();
    await expect(page.getByRole("heading", { name: "Community Code of Conduct" })).toBeVisible();

    // 4. Click Waiver tab
    await page.getByRole("tab", { name: "Waiver" }).click();
    await expect(
      page.getByRole("heading", { name: "Player Participation Waiver & Media Consent" }),
    ).toBeVisible();

    // 5. Click Agreements tab
    await page.getByRole("tab", { name: "Agreements" }).click();
    await expect(
      page.getByRole("heading", { name: "City Organizer & Volunteer Agreements" }),
    ).toBeVisible();

    // 6. Direct deep-link to waiver tab
    await page.goto("/legal?tab=waiver");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Player Participation Waiver & Media Consent" }),
    ).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("site footer exposes functional links to all legal sections", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("Legal & Consent")).toBeVisible();

    // Click Privacy Policy link in footer
    const privacyLink = footer.getByRole("link", { name: "Privacy Policy" });
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();

    await page.waitForURL("**/legal?tab=privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("registration form blocks submission when terms agreement is unchecked and succeeds when checked", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    // Switch to Register tab
    await page.getByRole("tab", { name: "Register" }).click();

    // Find the agreement checkbox
    const termsCheckbox = page.locator("#register-terms");
    await expect(termsCheckbox).toBeVisible();
    await expect(termsCheckbox).toBeChecked();

    // Uncheck terms
    await termsCheckbox.uncheck();
    await expect(termsCheckbox).not.toBeChecked();

    // Fill registration fields
    await page.getByLabel("Full name").fill("Consent Test User");
    const uniqueEmail = `consent.test.${Date.now()}@devkics.test`;
    await page.locator("#register-email").fill(uniqueEmail);
    await page.locator("#register-password").fill("SuperSecret123!");

    // Attempt to submit while unchecked
    await page.getByRole("button", { name: "Create account" }).click();

    // Should display validation error / toast and not register
    await expect(
      page.getByText("You must agree to the Terms of Use, Privacy Policy, and Code of Conduct"),
    ).toBeVisible();

    // Now re-check the agreement
    await termsCheckbox.check();
    await expect(termsCheckbox).toBeChecked();

    // Submit again
    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect to dashboard upon successful registration
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await expect(page).toHaveURL(/dashboard/);

    expect(consoleErrors).toEqual([]);
  });

  test("GET /api/legal/consent-status returns consent status", async ({ request }) => {
    const res = await request.get("/api/legal/consent-status");
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty("authenticated");
    expect(data).toHaveProperty("legalVersions");
    expect(data.legalVersions).toHaveProperty("termsOfUse");
    expect(data.legalVersions).toHaveProperty("privacyPolicy");
    expect(data.legalVersions).toHaveProperty("codeOfConduct");
    expect(data.legalVersions).toHaveProperty("playerWaiver");
  });
});

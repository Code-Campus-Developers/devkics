import { expect, test } from "@playwright/test";

test.describe("Phase 4.2 Accessibility & Keyboard Navigation", () => {
  test("skip link allows keyboard users to jump straight to main content", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Tab into the page - the first focusable element is the skip-link
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    // Trigger skip link
    await page.keyboard.press("Enter");

    // Main landmark should be focused or targeted
    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("mobile navigation sheet opens with accessible dialog semantics and closes cleanly", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Emulate a mobile screen
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const menuButton = page.getByRole("button", { name: "Open navigation menu" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Sheet dialog should appear with accessible title
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("heading", { name: "Site Navigation" })).toBeAttached();

    // Press Escape to dismiss the sheet
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("form fields on /auth have valid accessible labels and id associations", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    // Verify Sign in form controls have associated labels
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("id", "signin-email");
    await expect(passwordInput).toHaveAttribute("id", "signin-password");

    // Switch to register tab
    await page.getByRole("tab", { name: "Register" }).click();

    const regNameInput = page.getByLabel("Full name");
    const regRoleSelect = page.getByLabel("I am joining as");

    await expect(regNameInput).toBeVisible();
    await expect(regRoleSelect).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("public city standings table exposes accessible table semantics and captions", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/abuja/standings");
    await page.waitForLoadState("networkidle");

    const table = page.getByRole("table", { name: "League standings table" });
    await expect(table).toBeVisible();

    // Check header abbreviations and column headers
    await expect(table.getByRole("columnheader", { name: "Team" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Pts" })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("newsroom expandable article toggle communicates aria-expanded state", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/abuja/news");
    await page.waitForLoadState("networkidle");

    // If there are articles, test aria-expanded
    const articleButtons = page.locator("article button");
    const count = await articleButtons.count();
    if (count > 0) {
      const firstBtn = articleButtons.first();
      await expect(firstBtn).toHaveAttribute("aria-expanded", "false");
      await firstBtn.click();
      await expect(firstBtn).toHaveAttribute("aria-expanded", "true");
      await firstBtn.click();
      await expect(firstBtn).toHaveAttribute("aria-expanded", "false");
    }

    expect(consoleErrors).toEqual([]);
  });
});

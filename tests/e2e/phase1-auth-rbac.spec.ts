import { expect, test } from "@playwright/test";
import { Role } from "@prisma/client";

import { prisma } from "../../src/lib/server/db";
import { hashPassword } from "../../src/lib/server/auth";

test.describe("Phase 1 foundation", () => {
  test("login and dashboard access works", async ({ page }) => {
    const email = `phase1-user-${Date.now()}@devkics.test`;

    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Register" }).click();
    await page.getByPlaceholder("Ada Lovelace").fill("Phase One User");
    await page
      .getByRole("tabpanel", { name: "Register" })
      .getByPlaceholder("you@company.com")
      .fill(email);
    await page.getByPlaceholder("Choose a password").fill("devkics123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Signed in as Phase One User")).toBeVisible();
  });

  test("city organizer application can be submitted from public route", async ({ page }) => {
    await page.goto("/organize");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("Ada Lovelace").fill("Integration Applicant");
    await page.getByPlaceholder("you@company.com").fill(`integration-${Date.now()}@applicant.dev`);
    await page.getByPlaceholder("Abuja").fill("Lagos");
    await page
      .getByPlaceholder(
        "e.g. Lagos — a 1,200-member engineering community, two turf venues secured, targeting 8 teams.",
      )
      .fill("We have a strong local tech community and available venues.");

    await page.getByRole("button", { name: "Apply to organize" }).click();
    await expect(page.getByText("Application received")).toBeVisible();
  });

  test("rejects unauthorized and non-admin city status updates", async ({ request }) => {
    const managerEmail = `rbac-manager-${Date.now()}@devkics.test`;

    const unauthenticatedPatch = await request.patch("/api/cities/abuja", {
      data: { status: "archived" },
    });
    expect(unauthenticatedPatch.status()).toBe(401);

    const registerRes = await request.post("/api/auth/register", {
      data: {
        name: "RBAC Manager",
        email: managerEmail,
        password: "devkics123",
        role: "manager",
        citySlug: "abuja",
      },
    });
    expect(registerRes.status()).toBe(201);

    const cookies = registerRes
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .join("; ");

    const managerPatch = await request.patch("/api/cities/abuja", {
      data: { status: "archived" },
      headers: { cookie: cookies },
    });
    expect(managerPatch.status()).toBe(403);
  });

  test("password show/hide toggle switches input type on auth page", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    const passwordInput = page.locator("#signin-password");
    await expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = page.getByRole("button", { name: "Show password" });
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    const hideButton = page.getByRole("button", { name: "Hide password" });
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("direct navigation to /admin redirects unauthenticated users to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: "Admin Sign In" })).toBeVisible();
  });

  test("return to standard login link on /admin/login routes to /auth", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Return to standard login" }).click();
    await page.waitForURL(/\/auth/);
    await expect(page.getByText("Your locker room")).toBeVisible();
  });

  test("admin login works at /admin/login and redirects to /admin", async ({ page }) => {
    const stamp = Date.now();
    const adminEmail = `admin-${stamp}@devkics.test`;
    const password = "devkics-admin-pass";
    const city = await prisma.city.findFirst({ where: { slug: "abuja" } });
    const admin = await prisma.user.create({
      data: {
        name: "Admin User",
        email: adminEmail,
        passwordHash: await hashPassword(password),
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: admin.id,
        role: Role.ADMIN,
        cityId: city?.id ?? null,
        countryCode: city?.countryCode ?? null,
      },
    });

    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    const passwordInput = page.locator("#admin-password");
    await expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = page.getByRole("button", { name: "Show password" });
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.locator("#admin-email").fill(adminEmail);
    await page.locator("#admin-password").fill(password);
    await page.getByRole("button", { name: "Sign in to Admin Portal" }).click();
    await expect(page.getByText("Platform Administration")).toBeVisible();
    expect(page.url()).toMatch(/\/admin\/?$/);
  });
});

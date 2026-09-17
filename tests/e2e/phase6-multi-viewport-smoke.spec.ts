import { expect, test } from "@playwright/test";
import { Role } from "@prisma/client";

import { prisma } from "../../src/lib/server/db";
import { hashPassword } from "../../src/lib/server/auth";

const VIEWPORTS = [
  { name: "Desktop", width: 1280, height: 800 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Mobile", width: 375, height: 667 },
];

test.describe("Phase 6 — Multi-Viewport Regression Smoke", () => {
  let adminEmail: string;
  let organizerEmail: string;
  let managerEmail: string;
  let playerEmail: string;

  test.beforeAll(async () => {
    // Ensure clean test state for key test entities
    const timestamp = Date.now();
    adminEmail = `admin-p6-${timestamp}@devkics.test`;
    organizerEmail = `organizer-p6-${timestamp}@devkics.test`;
    managerEmail = `manager-p6-${timestamp}@devkics.test`;
    playerEmail = `player-p6-${timestamp}@devkics.test`;

    // Upsert cities
    await prisma.city.upsert({
      where: { slug: "abuja" },
      update: { status: "LIVE" },
      create: {
        slug: "abuja",
        name: "Abuja",
        country: "Nigeria",
        countryCode: "NG",
        status: "LIVE",
        teams: 8,
        players: 96,
        tagline: "Capital chapter",
        accentImage: "abuja",
      },
    });

    await prisma.city.upsert({
      where: { slug: "lagos" },
      update: { status: "APPLICATIONS_OPEN" },
      create: {
        slug: "lagos",
        name: "Lagos",
        country: "Nigeria",
        countryCode: "NG",
        status: "APPLICATIONS_OPEN",
        teams: 12,
        players: 144,
        tagline: "Commercial hub",
        accentImage: "lagos",
      },
    });

    const abuja = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const passwordHash = await hashPassword("DevKics2026!");

    // 1. Admin user
    const adminUser = await prisma.user.create({
      data: {
        name: "Admin Tester",
        email: adminEmail,
        passwordHash,
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: adminUser.id, role: Role.ADMIN },
    });

    // 2. Organizer user
    const organizerUser = await prisma.user.create({
      data: {
        name: "Organizer Tester",
        email: organizerEmail,
        passwordHash,
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: organizerUser.id,
        role: Role.ORGANIZER,
        cityId: abuja.id,
        countryCode: abuja.countryCode,
      },
    });

    // 3. Manager user
    const managerUser = await prisma.user.create({
      data: {
        name: "Manager Tester",
        email: managerEmail,
        passwordHash,
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: managerUser.id,
        role: Role.MANAGER,
        cityId: abuja.id,
        countryCode: abuja.countryCode,
      },
    });

    // 4. Player user
    const playerUser = await prisma.user.create({
      data: {
        name: "Player Tester",
        email: playerEmail,
        passwordHash,
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: playerUser.id,
        role: Role.PLAYER,
        cityId: abuja.id,
        countryCode: abuja.countryCode,
      },
    });

    // Seed test application for admin reviews
    await prisma.organizerApplication.create({
      data: {
        name: "Smoke Candidate",
        email: `candidate-smoke-${timestamp}@test.dev`,
        city: "Abuja",
        cityId: abuja.id,
        country: "Nigeria",
        detail: "Comprehensive candidate proposal for multi-viewport testing.",
        communityExperience: "Extensive developer league leadership.",
        organizingExperience: "Directed 3 regional tournaments.",
        proposedOrganizingTeam: "Lead, Ops, Media.",
        expectedOrganizations: "Fintech, Edtech.",
        proposedVenue: "National Stadium",
        proposedTournamentPeriod: "Q4 2026",
        motivation: "Building grassroots competitive ecosystem.",
        status: "SUBMITTED",
      },
    });

    // Seed test organization for admin reviews
    await prisma.organization.create({
      data: {
        name: "Smoke Tech FC",
        slug: `smoke-tech-fc-${timestamp}`,
        cityId: abuja.id,
        ownerUserId: managerUser.id,
        email: "smoke-tech@org.test",
        description: "Innovative tech company club.",
        status: "SUBMITTED",
      },
    });
  });

  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("public forms: /organize and /volunteer render and submit cleanly", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        // 1. /organize
        await page.goto("/organize");
        await page.waitForLoadState("networkidle");
        await expect(
          page.getByRole("heading", { name: /Bring DevKics to your city/i }),
        ).toBeVisible();

        const ts = Date.now();
        await page.locator("#app-name").fill(`Lead ${vp.name}`);
        await page.locator("#app-email").fill(`lead-${vp.name.toLowerCase()}-${ts}@organize.test`);
        await page.locator("#app-city").fill("Abuja");
        await page
          .getByPlaceholder(
            "e.g. Lagos — a 1,200-member engineering community, two turf venues secured, targeting 8 teams.",
          )
          .fill("Experienced tech organizer ready to launch a standard chapter.");

        const organizeSubmit = page.getByRole("button", { name: "Apply to organize" });
        await expect(organizeSubmit).toBeEnabled();
        await organizeSubmit.click();
        await expect(page.getByText("Application received")).toBeVisible({ timeout: 10000 });

        // 2. /volunteer
        await page.goto("/volunteer");
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("heading", { name: /Volunteer on matchday/i })).toBeVisible();

        await page.locator("#app-name").fill(`Vol ${vp.name}`);
        await page.locator("#app-email").fill(`vol-${vp.name.toLowerCase()}-${ts}@volunteer.test`);
        await page.locator("#app-detail").fill("Full weekend availability");

        const volSubmit = page.getByRole("button", { name: "Submit Volunteer Application" });
        await expect(volSubmit).toBeEnabled();
        await volSubmit.click();
        await expect(page.getByText("Application received")).toBeVisible({ timeout: 10000 });

        expect(consoleErrors).toEqual([]);
      });

      test("auth flows: /auth login, register and role portals render responsively", async ({
        page,
      }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        await page.goto("/auth");
        await page.waitForLoadState("networkidle");

        // Verify tabs
        await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Register" })).toBeVisible();

        // Switch to Register tab
        await page.getByRole("tab", { name: "Register" }).click();
        await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

        // Switch back to Sign in
        await page.getByRole("tab", { name: "Sign in" }).click();
        await page.getByPlaceholder("you@company.com").fill(playerEmail);
        await page.getByPlaceholder("••••••••").fill("DevKics2026!");
        await page.getByRole("button", { name: "Sign in" }).click();

        await page.waitForURL("**/dashboard**", { timeout: 15000 });
        await expect(page).toHaveURL(/dashboard/);
        await expect(page.getByText("Signed in as Player Tester")).toBeVisible();

        expect(consoleErrors).toEqual([]);
      });

      test("dashboard role views: Organizer view renders chapter controls", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        await page.goto("/auth");
        await page.waitForLoadState("networkidle");

        await page.getByPlaceholder("you@company.com").fill(organizerEmail);
        await page.getByPlaceholder("••••••••").fill("DevKics2026!");
        await page.getByRole("button", { name: "Sign in" }).click();

        await page.waitForURL("**/dashboard**", { timeout: 15000 });
        await expect(page).toHaveURL(/dashboard/);

        // Verify organizer dashboard elements
        await expect(page.getByText("Signed in as Organizer Tester")).toBeVisible();
        await expect(page.getByText(/city organizer/i)).toBeVisible();

        expect(consoleErrors).toEqual([]);
      });

      test("admin surface: /admin tabs, review dialogs and visibility controls", async ({
        page,
      }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        // 1. Admin login at /admin/login
        await page.goto("/admin/login");
        await page.waitForLoadState("networkidle");

        await page.getByPlaceholder("admin@devkics.com").fill(adminEmail);
        await page.getByPlaceholder("••••••••").fill("DevKics2026!");
        await page.getByRole("button", { name: "Sign in to Admin Portal" }).click();

        await page.waitForURL("**/admin", { timeout: 15000 });
        await expect(page).toHaveURL(/\/admin/);

        // 2. Cities Tab
        await page.getByRole("tab", { name: /Cities/i }).click();
        await expect(page.getByRole("heading", { name: "Abuja" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Lagos" })).toBeVisible();

        // 3. City Applications Tab
        await page.getByRole("tab", { name: /City Applications/i }).click();
        await expect(page.getByText("Smoke Candidate").first()).toBeVisible();

        // Click "View Details" modal
        const viewDetailsBtn = page.getByRole("button", { name: "View Details" }).first();
        if (await viewDetailsBtn.isVisible()) {
          await viewDetailsBtn.click();
          await expect(page.getByText("Candidate Profile")).toBeVisible();
          await expect(page.getByText("Proposed Tournament Parameters")).toBeVisible();
          await page.getByRole("button", { name: "Close" }).first().click();
        }

        // 4. Organizations Tab
        await page.getByRole("tab", { name: /Organizations/i }).click();
        await expect(page.getByText("Smoke Tech FC").first()).toBeVisible();

        // 5. Sponsors Tabs
        await page.getByRole("tab", { name: "Sponsor enquiries" }).click();
        await expect(page.getByRole("heading", { name: "Sponsorship enquiries" })).toBeVisible();

        await page.getByRole("tab", { name: "Sponsors", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Sponsor management" })).toBeVisible();

        expect(consoleErrors).toEqual([]);
      });
    });
  }
});

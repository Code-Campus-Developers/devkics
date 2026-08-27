import { expect, test } from "@playwright/test";

import { Role } from "@prisma/client";

import { hashPassword } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

async function registerUser(
  page: import("@playwright/test").Page,
  input: {
    name: string;
    email: string;
    password: string;
    role?: "player" | "manager" | "organizer";
  },
) {
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Register" }).click();
  const registerPanel = page.getByRole("tabpanel", { name: "Register" });
  await registerPanel.getByPlaceholder("Ada Lovelace").fill(input.name);
  await registerPanel.getByPlaceholder("you@company.com").fill(input.email);
  await registerPanel.getByPlaceholder("Choose a password").fill(input.password);
  if (input.role === "organizer") {
    await registerPanel.getByRole("combobox").click();
    await page.getByRole("option", { name: "City organizer" }).click();
  }
  await registerPanel.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function signIn(
  page: import("@playwright/test").Page,
  input: { email: string; password: string },
) {
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  const signInPanel = page.getByRole("tabpanel", { name: "Sign in" });
  await signInPanel.getByPlaceholder("you@company.com").fill(input.email);
  await signInPanel.getByPlaceholder("••••••••").fill(input.password);
  await signInPanel.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function signOut(page: import("@playwright/test").Page, firstName: string) {
  await page.getByRole("button", { name: firstName }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("http://localhost:8080/");
}

test.describe("Phase 3 community and content", () => {
  test("submits a sponsorship enquiry from the city sponsor page", async ({ page }) => {
    await page.goto("/abuja/sponsors");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Ada Lovelace").fill("Phase Three Partner");
    await page.getByPlaceholder("you@company.com").fill(`phase3-${Date.now()}@devkics.test`);
    await page.getByPlaceholder("Company or community").fill("Phase Three Ltd");
    await page
      .getByLabel("How would you like to partner?")
      .fill("We would like to support the Abuja pilot as a community sponsor.");
    await page.getByRole("button", { name: "Request the deck" }).click();
    await expect(page.getByText("Sponsorship enquiry sent")).toBeVisible();
  });

  test("loads public news and gallery pages", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/abuja/news");
    await expect(page.getByRole("heading", { name: "News & announcements" })).toBeVisible();
    await page.goto("/abuja/gallery");
    await expect(page.getByRole("heading", { name: "Gallery" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("volunteer application is approved by an organizer and notifies the applicant", async ({
    page,
  }) => {
    const stamp = Date.now();
    const applicantName = `Volunteer Journey ${stamp}`;
    const applicantEmail = `volunteer-journey-${stamp}@devkics.test`;
    const organizerName = `Organizer Journey ${stamp}`;
    const organizerEmail = `organizer-journey-${stamp}@devkics.test`;
    const password = "devkics123";

    // Register and sign in as the volunteer applicant, then submit while authenticated
    // so the application links back to the applicant's account.
    await registerUser(page, { name: applicantName, email: applicantEmail, password });

    await page.goto("/volunteer");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Ada Lovelace").fill(applicantName);
    await page.getByPlaceholder("you@company.com").fill(applicantEmail);
    await page
      .getByPlaceholder("e.g. Match official — free most Saturdays, NFF grassroots certified.")
      .fill("Available every Saturday morning for the full tournament season.");
    await page.getByRole("button", { name: "Submit volunteer application" }).click();
    await expect(page.getByText("Application submitted")).toBeVisible();

    // Sign out and register a fresh city organizer for Abuja.
    await signOut(page, applicantName.split(" ")[0]!);
    await registerUser(page, {
      name: organizerName,
      email: organizerEmail,
      password,
      role: "organizer",
    });

    await page.getByRole("tab", { name: "Applications" }).click();
    const applicationRow = page.locator("li", { hasText: applicantName });
    await expect(applicationRow).toBeVisible();
    await applicationRow.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Volunteer approved and assigned")).toBeVisible();

    // Sign out and back in as the applicant to confirm the notification landed.
    await signOut(page, organizerName.split(" ")[0]!);
    await signIn(page, { email: applicantEmail, password });

    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("Volunteer application updated").first()).toBeVisible();
  });

  test("sponsorship enquiry submission appears in the admin notification queue", async ({
    page,
  }) => {
    const stamp = Date.now();
    const partnerName = `Admin Queue Partner ${stamp}`;
    const partnerEmail = `admin-queue-partner-${stamp}@devkics.test`;
    const adminEmail = `admin-queue-${stamp}@devkics.test`;
    const password = "devkics123";

    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const admin = await prisma.user.create({
      data: {
        name: "Admin Queue Reviewer",
        email: adminEmail,
        passwordHash: await hashPassword(password),
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: admin.id, role: Role.ADMIN, cityId: city.id, countryCode: city.countryCode },
    });

    await page.goto("/abuja/sponsors");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Ada Lovelace").fill(partnerName);
    await page.getByPlaceholder("you@company.com").fill(partnerEmail);
    await page.getByPlaceholder("Company or community").fill("Admin Queue Partners Ltd");
    await page
      .getByLabel("How would you like to partner?")
      .fill("We would like to discuss an official partnership for the pilot season.");
    await page.getByRole("button", { name: "Request the deck" }).click();
    await expect(page.getByText("Sponsorship enquiry sent")).toBeVisible();

    await signIn(page, { email: adminEmail, password });

    await page.getByRole("tab", { name: "Sponsor enquiries" }).click();
    await expect(page.locator("li", { hasText: partnerName })).toBeVisible();
  });

  test("organizer publishes an announcement and it appears on the public news page", async ({
    page,
  }) => {
    const stamp = Date.now();
    const organizerName = `Newsroom Organizer ${stamp}`;
    const organizerEmail = `newsroom-organizer-${stamp}@devkics.test`;
    const headline = `Matchday briefing ${stamp}`;
    const password = "devkics123";

    await registerUser(page, {
      name: organizerName,
      email: organizerEmail,
      password,
      role: "organizer",
    });

    await page.getByRole("tab", { name: "Newsroom" }).click();
    const newsroomPanel = page.getByRole("tabpanel", { name: "Newsroom" });
    await newsroomPanel.getByLabel("Headline").fill(headline);
    await newsroomPanel
      .getByLabel("Excerpt")
      .fill("Everything teams need to know before the next matchday.");
    await newsroomPanel
      .getByLabel("Announcement")
      .fill("Teams should arrive thirty minutes early with their confirmed squad lists.");
    await newsroomPanel.getByRole("combobox").click();
    await page.getByRole("option", { name: "Publish now" }).click();
    await newsroomPanel.getByRole("button", { name: "Save announcement" }).click();
    await expect(page.getByText("Announcement published")).toBeVisible();

    await page.goto("/abuja/news");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  });
});

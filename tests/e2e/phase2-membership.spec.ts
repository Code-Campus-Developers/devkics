import { expect, test } from "@playwright/test";
import { Role } from "@prisma/client";

import { hashPassword } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

async function createManagerWithTeam(suffix: string) {
  let city = await prisma.city.findUnique({ where: { slug: "abuja" } });
  if (!city) {
    city = await prisma.city.create({
      data: {
        name: "Abuja",
        slug: "abuja",
        country: "Nigeria",
        countryCode: "NG",
        tagline: "Tech Capital",
        accentImage: "/cities/abuja.jpg",
        status: "LIVE",
      },
    });
  }

  let tournament = await prisma.tournament.findFirst({
    where: { cityId: city.id },
  });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        cityId: city.id,
        name: "Abuja Tech Cup 2026",
        slug: "abuja-tech-cup-2026",
        season: "2026",
        format: "7-a-side group + knockout",
        venue: "DevKics Turf Arena, Abuja",
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-11-30"),
        status: "REGISTRATION_OPEN",
        summary: "Tournament edition",
      },
    });
  }

  const email = `manager-${suffix}@devkics.test`;
  const passwordHash = await hashPassword("devkics123");

  const managerUser = await prisma.user.create({
    data: {
      email,
      name: `Manager ${suffix}`,
      passwordHash,
      citySlug: "abuja",
      assignments: {
        create: {
          role: Role.MANAGER,
          cityId: city.id,
          countryCode: city.countryCode,
        },
      },
    },
  });

  const org = await prisma.organization.create({
    data: {
      cityId: city.id,
      name: `Org ${suffix}`,
      slug: `org-${suffix}`,
      email: `org-${suffix}@devkics.test`,
      description: "Tech Company",
      status: "APPROVED",
      submittedAt: new Date(),
      reviewedAt: new Date(),
    },
  });

  const team = await prisma.team.create({
    data: {
      tournamentId: tournament.id,
      organizationId: org.id,
      name: `FC ${suffix}`,
      shortName: `${suffix.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase()}${Math.floor(Math.random() * 10)}`,
      company: org.name,
      managerUserId: managerUser.id,
      status: "APPROVED",
      submittedAt: new Date(),
      reviewedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: managerUser.id },
    data: { teamId: team.id },
  });

  return { managerUser, email, password: "devkics123", team, city };
}

test.describe("Player ↔ Team Membership Frontend Flows", () => {
  test("Manager invites player -> Player reviews and accepts with waiver -> Manager confirms roster spot", async ({
    page,
    browser,
  }) => {
    const timestamp = Date.now().toString().slice(-6);
    const {
      email: managerEmail,
      password: managerPassword,
      team,
    } = await createManagerWithTeam(timestamp);

    const playerEmail = `player-invited-${timestamp}@devkics.test`;

    // 1. Manager logs in and sends invitation
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    const signInPanel = page.getByRole("tabpanel", { name: "Sign in" });
    await signInPanel.getByPlaceholder("you@company.com").fill(managerEmail);
    await signInPanel.getByPlaceholder("••••••••").fill(managerPassword);
    await signInPanel.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByText(`FC ${timestamp}`)).toBeVisible();

    // Fill invitation form
    await page.getByPlaceholder("Chidi Nwankwo").fill(`Invited Player ${timestamp}`);
    await page.getByPlaceholder("chidi@company.com").fill(playerEmail);
    await page.getByRole("button", { name: "Send team invitation" }).click();

    await expect(page.getByText(`Invitation sent to ${playerEmail}`)).toBeVisible();

    // 2. Player opens fresh incognito context to register
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();

    await playerPage.goto("/auth");
    await playerPage.waitForLoadState("networkidle");

    await playerPage.getByRole("tab", { name: "Register" }).click();
    const registerPanel = playerPage.getByRole("tabpanel", { name: "Register" });
    await registerPanel.getByPlaceholder("Ada Lovelace").fill(`Invited Player ${timestamp}`);
    await registerPanel.getByPlaceholder("you@company.com").fill(playerEmail);
    await registerPanel.getByPlaceholder("Choose a password").fill("devkics123");
    await registerPanel.getByRole("button", { name: "Create account" }).click();

    await playerPage.waitForURL("**/dashboard");

    // Player sees team invitation
    await expect(playerPage.getByText("Team Invitations")).toBeVisible();
    await expect(playerPage.getByText(`FC ${timestamp}`)).toBeVisible();

    // Click Review & Accept
    await playerPage.getByRole("button", { name: "Review & Accept" }).click();

    // Verify dialog opens and accept button requires waiver agreement
    const acceptDialog = playerPage.getByRole("dialog");
    await expect(acceptDialog.getByText("Accept Team Invitation")).toBeVisible();

    const submitBtn = acceptDialog.getByRole("button", { name: "Accept & Submit" });
    await expect(submitBtn).toBeDisabled();

    // Check waiver
    await acceptDialog.getByRole("checkbox").click();
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();
    await expect(
      playerPage.getByText(
        "Invitation accepted! Your spot is now pending team manager confirmation.",
      ),
    ).toBeVisible();

    // Player now sees Pending Confirmation
    await expect(playerPage.getByText("Waiting for manager approval")).toBeVisible();

    // 3. Manager reviews and approves player
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Switch to Requests & Invites tab where pending confirmations live
    await page.getByRole("tab", { name: /Requests & Invites/ }).click();
    await expect(page.getByText("Pending Confirmation")).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText(/approved and added to active squad/i)).toBeVisible();

    // Active roster on Squad tab now includes the player
    await page.getByRole("tab", { name: /Squad/ }).click();
    await expect(page.getByText(`Invited Player ${timestamp}`, { exact: true })).toBeVisible();

    // 4. Player refreshes and is now an approved squad member
    await playerPage.reload();
    await playerPage.waitForLoadState("networkidle");
    await expect(playerPage.getByText("Your next match")).toBeVisible();

    // 5. Public team page displays player in squad
    await playerPage.goto(`/abuja/teams/${team.id}`);
    await playerPage.waitForLoadState("networkidle");
    await expect(
      playerPage.getByText(`Invited Player ${timestamp}`, { exact: true }),
    ).toBeVisible();
    await expect(playerPage.getByText("You are on this squad")).toBeVisible();

    await playerContext.close();
  });

  test("Player requests to join from public team page -> Manager approves join request", async ({
    page,
  }) => {
    const timestamp = (Date.now() + 1000).toString().slice(-6);
    const { team } = await createManagerWithTeam(timestamp);

    const playerEmail = `applicant-${timestamp}@devkics.test`;

    // 1. Player registers
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Register" }).click();
    const registerPanel = page.getByRole("tabpanel", { name: "Register" });
    await registerPanel.getByPlaceholder("Ada Lovelace").fill(`Applicant ${timestamp}`);
    await registerPanel.getByPlaceholder("you@company.com").fill(playerEmail);
    await registerPanel.getByPlaceholder("Choose a password").fill("devkics123");
    await registerPanel.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("**/dashboard");

    // 2. Player navigates to public team page
    await page.goto(`/abuja/teams/${team.id}`);
    await page.waitForLoadState("networkidle");

    // Click Request to Join
    await page.getByRole("button", { name: "Request to Join" }).click();

    const joinDialog = page.getByRole("dialog");
    await expect(joinDialog.getByText(`Request to Join FC ${timestamp}`)).toBeVisible();

    // Submit button disabled initially (waiver not accepted)
    const submitRequestBtn = joinDialog.getByRole("button", { name: "Submit Request" });
    await expect(submitRequestBtn).toBeDisabled();

    // Fill optional number and check waiver
    await joinDialog.getByPlaceholder("e.g. 10").fill("7");
    await joinDialog.getByPlaceholder("e.g. Backend Dev").fill("Fullstack Engineer");
    await joinDialog.getByRole("checkbox").click();

    await expect(submitRequestBtn).toBeEnabled();
    await submitRequestBtn.click();

    await expect(
      page.getByText("Join request submitted! The team manager has been notified."),
    ).toBeVisible();
    await expect(page.getByText("Join Request Pending")).toBeVisible();
  });

  test("Manager invites player -> Player clarifies position -> Manager approves proposed position", async ({
    page,
    browser,
  }) => {
    const timestamp = (Date.now() + 2000).toString().slice(-6);
    const {
      email: managerEmail,
      password: managerPassword,
      team,
    } = await createManagerWithTeam(timestamp);

    const playerEmail = `player-clarify-${timestamp}@devkics.test`;

    // 1. Manager logs in and sends invitation as MID
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    const signInPanel = page.getByRole("tabpanel", { name: "Sign in" });
    await signInPanel.getByPlaceholder("you@company.com").fill(managerEmail);
    await signInPanel.getByPlaceholder("••••••••").fill(managerPassword);
    await signInPanel.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByText(`FC ${timestamp}`)).toBeVisible();

    await page.getByPlaceholder("Chidi Nwankwo").fill(`Clarify Player ${timestamp}`);
    await page.getByPlaceholder("chidi@company.com").fill(playerEmail);
    await page.getByRole("button", { name: "Send team invitation" }).click();

    await expect(page.getByText(`Invitation sent to ${playerEmail}`)).toBeVisible();

    // 2. Player registers and reviews invite
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();

    await playerPage.goto("/auth");
    await playerPage.waitForLoadState("networkidle");

    await playerPage.getByRole("tab", { name: "Register" }).click();
    const registerPanel = playerPage.getByRole("tabpanel", { name: "Register" });
    await registerPanel.getByPlaceholder("Ada Lovelace").fill(`Clarify Player ${timestamp}`);
    await registerPanel.getByPlaceholder("you@company.com").fill(playerEmail);
    await registerPanel.getByPlaceholder("Choose a password").fill("devkics123");
    await registerPanel.getByRole("button", { name: "Create account" }).click();

    await playerPage.waitForURL("**/dashboard");

    // Player sees team invitation and clicks "Clarify Position"
    await expect(playerPage.getByText("Team Invitations")).toBeVisible();
    await playerPage.getByRole("button", { name: "Clarify Position" }).click();

    const clarifyDialog = playerPage.getByRole("dialog");
    await expect(clarifyDialog.getByText("Clarify Position & Accept")).toBeVisible();

    // Change position to FWD
    await clarifyDialog.getByLabel("Preferred Playing Position *").click();
    await playerPage.getByRole("option", { name: "Forward (FWD)" }).click();

    // Add note
    await clarifyDialog
      .getByPlaceholder(/Prefer attacking midfield/i)
      .fill("Prefer playing as central striker");

    // Check waiver
    await clarifyDialog.getByRole("checkbox").click();

    // Submit clarification
    await clarifyDialog.getByRole("button", { name: "Submit Clarification" }).click();
    await expect(
      playerPage.getByText(
        /Position clarification submitted! Your proposed position is pending manager approval./i,
      ),
    ).toBeVisible();

    // Player dashboard indicates proposed position is pending
    await expect(playerPage.getByText("Clarification Pending")).toBeVisible();
    await expect(playerPage.getByText(/Proposed:\s*FWD/i)).toBeVisible();

    // 3. Manager approves proposed position
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: /Requests & Invites/ }).click();
    await expect(page.getByText("Position Clarification: FWD")).toBeVisible();
    await expect(page.getByText(/Prefer playing as central striker/)).toBeVisible();

    await page.getByRole("button", { name: "Approve (FWD)" }).click();
    await expect(page.getByText(/approved and added to active squad/i)).toBeVisible();

    // Manager squad tab shows promoted position FWD
    await page.getByRole("tab", { name: /Squad/ }).click();
    await expect(page.getByText(`Clarify Player ${timestamp}`, { exact: true })).toBeVisible();

    // 4. Player reloads and verifies approved squad membership on team page
    await playerPage.goto(`/abuja/teams/${team.id}`);
    await playerPage.waitForLoadState("networkidle");
    await expect(
      playerPage.getByText(`Clarify Player ${timestamp}`, { exact: true }),
    ).toBeVisible();

    await playerContext.close();
  });

  test("Manager three-dot roster actions: View Details, Edit Player, and Remove from Squad with confirmation", async ({
    page,
  }) => {
    const timestamp = Date.now().toString().slice(-6);
    const { email, password, team, city } = await createManagerWithTeam(`p5-${timestamp}`);

    // Create an approved player directly for this team
    const playerUser = await prisma.user.create({
      data: {
        email: `player-p5-${timestamp}@devkics.test`,
        name: `Roster Player ${timestamp}`,
        passwordHash: await hashPassword("player123"),
        citySlug: city.slug,
        assignments: {
          create: {
            role: Role.PLAYER,
            cityId: city.id,
            countryCode: city.countryCode,
          },
        },
      },
    });

    const player = await prisma.player.create({
      data: {
        teamId: team.id,
        userId: playerUser.id,
        fullName: playerUser.name,
        email: playerUser.email,
        position: "MID",
        number: 7,
        role: "Starter",
        status: "APPROVED",
        waiverAcceptedAt: new Date(),
        emergencyContactName: "Emergency Person",
        emergencyContactPhone: "+2348099887766",
      },
    });

    await prisma.user.update({
      where: { id: playerUser.id },
      data: { teamId: team.id, playerId: player.id },
    });

    // 1. Manager logs in
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    const signInPanel = page.getByRole("tabpanel", { name: "Sign in" });
    await signInPanel.getByPlaceholder("you@company.com").fill(email);
    await signInPanel.getByPlaceholder("••••••••").fill(password);
    await signInPanel.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/dashboard");

    // Navigate to squad tab
    await page.getByRole("tab", { name: /Squad/ }).click();
    await expect(page.getByText(`Roster Player ${timestamp}`, { exact: true })).toBeVisible();

    // 2. Click three-dot action button
    await page.getByRole("button", { name: `Actions for Roster Player ${timestamp}` }).click();

    // Click "View Details"
    await page.getByRole("menuitem", { name: /View Details/i }).click();
    const detailsDialog = page.getByRole("dialog");
    await expect(
      detailsDialog.getByText("Squad registration and verified operational information."),
    ).toBeVisible();
    await expect(detailsDialog.getByText("Emergency Person")).toBeVisible();
    await expect(detailsDialog.getByText("+2348099887766")).toBeVisible();
    await detailsDialog.getByRole("button", { name: "Close" }).first().click();

    // 3. Edit Player
    await page.getByRole("button", { name: `Actions for Roster Player ${timestamp}` }).click();
    await page.getByRole("menuitem", { name: /Edit Player/i }).click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByText(`Edit Player — Roster Player ${timestamp}`)).toBeVisible();

    // Change position to FWD
    await editDialog.getByLabel("Position").click();
    await page.getByRole("option", { name: "Forward (FWD)" }).click();

    // Change kit number to 10
    await editDialog.getByLabel("Kit Number (1–99)").fill("10");

    // Change role
    await editDialog.getByLabel("Squad Role (Optional)").fill("Captain");

    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Player details updated")).toBeVisible();

    // Verify row has updated info
    await expect(page.getByText("#10")).toBeVisible();
    await expect(page.getByText(/FWD · Captain/)).toBeVisible();

    // 4. Remove from squad with confirmation
    await page.getByRole("button", { name: `Actions for Roster Player ${timestamp}` }).click();
    await page.getByRole("menuitem", { name: /Remove from Squad/i }).click();

    const removeAlert = page.getByRole("alertdialog");
    await expect(removeAlert.getByText("Remove Player from Squad?")).toBeVisible();
    await expect(removeAlert.getByText(`Roster Player ${timestamp}`)).toBeVisible();

    // Click cancel first to verify non-destructive
    await removeAlert.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(`Roster Player ${timestamp}`, { exact: true })).toBeVisible();

    // Open again and confirm removal
    await page.getByRole("button", { name: `Actions for Roster Player ${timestamp}` }).click();
    await page.getByRole("menuitem", { name: /Remove from Squad/i }).click();
    const confirmAlert = page.getByRole("alertdialog");
    await confirmAlert.getByRole("button", { name: "Remove Player" }).click();

    await expect(page.getByText(/removed from squad/i)).toBeVisible();
    await expect(page.getByText(`Roster Player ${timestamp}`, { exact: true })).not.toBeVisible();
  });
});

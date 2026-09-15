import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  CityStatus,
  OrganizationStatus,
  PlayerStatus,
  Role,
  TeamStatus,
  TournamentStatus,
} from "@prisma/client";

import { handleApiRequest } from "@/lib/server/api";
import { hashPassword, issueSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

const DEFAULT_ENV = {
  DATABASE_URL: "postgresql://abrahamogbu@localhost:5432/devkics?schema=public",
  JWT_ACCESS_SECRET: "test-access-secret-1234567890",
  JWT_REFRESH_SECRET: "test-refresh-secret-1234567890",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "7d",
};

function collectSetCookies(response: Response) {
  const values: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      values.push(value);
    }
  });
  return values;
}

function toCookieHeader(setCookies: string[]) {
  return setCookies
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

describe("Player ↔ Team Membership Lifecycle", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.matchEvent.deleteMany();
    await prisma.match.deleteMany();
    await prisma.fixture.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.tournament.deleteMany();
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.city.deleteMany();
  });

  async function createTestFixtures() {
    const stamp = Date.now();
    const city = await prisma.city.create({
      data: {
        slug: `abuja-${stamp}`,
        name: "Abuja",
        country: "Nigeria",
        countryCode: "NG",
        status: CityStatus.LIVE,
        tagline: "Tech Football Pilot",
        accentImage: "/cities/abuja.jpg",
      },
    });

    const tournament = await prisma.tournament.create({
      data: {
        cityId: city.id,
        name: "DevKics Abuja Cup",
        slug: `abuja-cup-${stamp}`,
        season: "2026",
        format: "7-a-side",
        venue: "Riverplate Park",
        summary: "Tournament Pilot",
        status: TournamentStatus.REGISTRATION_OPEN,
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-08-31T23:59:59.000Z"),
      },
    });

    // Manager user
    const managerPassword = "manager-password-123";
    const managerUser = await prisma.user.create({
      data: {
        name: "Team Manager",
        email: `manager-${stamp}@devkics.test`,
        passwordHash: await hashPassword(managerPassword),
        citySlug: city.slug,
      },
    });
    const managerAssignment = await prisma.roleAssignment.create({
      data: {
        userId: managerUser.id,
        role: Role.MANAGER,
        cityId: city.id,
        countryCode: "NG",
      },
    });

    // Directly issue valid session cookies for manager
    const managerSession = await issueSession(managerUser, [managerAssignment]);
    const managerCookies = [managerSession.accessCookie, managerSession.refreshCookie];

    // Approved organization
    const org = await prisma.organization.create({
      data: {
        cityId: city.id,
        ownerUserId: managerUser.id,
        name: `Org ${stamp}`,
        slug: `org-${stamp}`,
        email: `org-${stamp}@devkics.test`,
        description: "Tech company side",
        status: OrganizationStatus.APPROVED,
      },
    });

    // Manager's Team
    const team = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: org.id,
        managerUserId: managerUser.id,
        name: `PayTech FC ${stamp}`,
        shortName: `PT${String(stamp).slice(-1)}`,
        company: "PayTech",
        status: TeamStatus.APPROVED,
      },
    });

    // Other user (not manager of this team)
    const otherPassword = "other-password-123";
    const otherUser = await prisma.user.create({
      data: {
        name: "Other User",
        email: `other-${stamp}@devkics.test`,
        passwordHash: await hashPassword(otherPassword),
        citySlug: city.slug,
      },
    });
    const otherAssignment = await prisma.roleAssignment.create({
      data: {
        userId: otherUser.id,
        role: Role.PLAYER,
        cityId: city.id,
        countryCode: "NG",
      },
    });

    // Directly issue valid session cookies for other user
    const otherSession = await issueSession(otherUser, [otherAssignment]);
    const otherCookies = [otherSession.accessCookie, otherSession.refreshCookie];

    return {
      city,
      tournament,
      managerUser,
      managerCookies,
      org,
      team,
      otherUser,
      otherCookies,
      stamp,
    };
  }

  it("manager can invite player by email; sets status INVITED, sends notification, never assigns manager userId", async () => {
    const { team, managerCookies, otherCookies, stamp } = await createTestFixtures();
    const playerEmail = `invitee-${stamp}@devkics.test`;

    // Non-manager cannot invite player to this team
    const unauthorizedInvite = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Invited Player",
          email: playerEmail,
          position: "MID",
          number: 7,
          role: "Frontend Engineer",
        }),
      }),
    );
    expect(unauthorizedInvite?.status).toBe(403);

    // Manager invites player
    const inviteRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Invited Player",
          email: playerEmail,
          position: "MID",
          number: 7,
          role: "Frontend Engineer",
        }),
      }),
    );
    expect(inviteRes?.status).toBe(201);
    const payload = (await inviteRes?.json()) as {
      player: { id: string; status: string; userId: string | null };
    };
    expect(payload.player.status).toBe("invited");
    expect(payload.player.userId).toBeNull(); // Must not be the manager's ID!

    // Verify notification was dispatched
    const notification = await prisma.notification.findFirst({
      where: {
        type: "team.invitation",
        resourceId: payload.player.id,
        recipientEmail: playerEmail,
      },
    });
    expect(notification).not.toBeNull();
    expect(notification?.title).toContain(team.name);
  });

  it("player registration automatically claims pending invitation by email", async () => {
    const { team, managerCookies, city, stamp } = await createTestFixtures();
    const playerEmail = `claimable-${stamp}@devkics.test`;

    // Manager creates invitation
    const inviteRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Claimable Player",
          email: playerEmail,
          position: "FWD",
          number: 9,
        }),
      }),
    );
    const invitePayload = (await inviteRes?.json()) as { player: { id: string } };

    // Player registers with matching email
    const regRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Claimable Player",
          email: playerEmail,
          password: "password-12345",
          role: "player",
          citySlug: city.slug,
          acceptedTerms: true,
        }),
      }),
    );
    expect(regRes?.status).toBe(201);
    const regPayload = (await regRes?.json()) as { user: { id: string } };

    // Verify Player record now links to the new User's ID
    const updatedPlayer = await prisma.player.findUnique({
      where: { id: invitePayload.player.id },
    });
    expect(updatedPlayer?.userId).toBe(regPayload.user.id);
  });

  it("player can accept invitation with waiver; transitions to PENDING_APPROVAL and notifies manager", async () => {
    const { team, managerCookies, city, stamp } = await createTestFixtures();
    const playerEmail = `accepter-${stamp}@devkics.test`;

    // Invite
    const inviteRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Accepting Player",
          email: playerEmail,
          position: "GK",
        }),
      }),
    );
    const invitePayload = (await inviteRes?.json()) as { player: { id: string } };

    // Register player
    const regRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Accepting Player",
          email: playerEmail,
          password: "password-12345",
          role: "player",
          citySlug: city.slug,
          acceptedTerms: true,
        }),
      }),
    );
    const playerCookies = collectSetCookies(regRes!);

    // Another player cannot accept it
    const otherCookies = (await createTestFixtures()).otherCookies;
    const forbiddenAccept = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({ action: "accept", waiverAccepted: true }),
      }),
    );
    expect(forbiddenAccept?.status).toBe(403);

    // Waiver is required to accept
    const missingWaiver = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(playerCookies),
        },
        body: JSON.stringify({ action: "accept", waiverAccepted: false }),
      }),
    );
    expect(missingWaiver?.status).toBe(400);

    // Valid accept
    const acceptRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(playerCookies),
        },
        body: JSON.stringify({ action: "accept", waiverAccepted: true }),
      }),
    );
    expect(acceptRes?.status).toBe(200);
    const acceptedData = (await acceptRes?.json()) as { player: { status: string } };
    expect(acceptedData.player.status).toBe("pending-approval");

    // Manager receives notification
    const notification = await prisma.notification.findFirst({
      where: {
        type: "team.invitation_accepted",
        resourceId: invitePayload.player.id,
      },
    });
    expect(notification).not.toBeNull();
  });

  it("player can decline invitation; transitions to WITHDRAWN and notifies manager", async () => {
    const { team, managerCookies, city, stamp } = await createTestFixtures();
    const playerEmail = `decliner-${stamp}@devkics.test`;

    const inviteRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Declining Player",
          email: playerEmail,
          position: "DEF",
        }),
      }),
    );
    const invitePayload = (await inviteRes?.json()) as { player: { id: string } };

    const regRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Declining Player",
          email: playerEmail,
          password: "password-12345",
          role: "player",
          citySlug: city.slug,
          acceptedTerms: true,
        }),
      }),
    );
    const playerCookies = collectSetCookies(regRes!);

    const declineRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(playerCookies),
        },
        body: JSON.stringify({ action: "decline" }),
      }),
    );
    expect(declineRes?.status).toBe(200);
    const declinedData = (await declineRes?.json()) as { player: { status: string } };
    expect(declinedData.player.status).toBe("withdrawn");

    const notification = await prisma.notification.findFirst({
      where: {
        type: "team.invitation_declined",
        resourceId: invitePayload.player.id,
      },
    });
    expect(notification).not.toBeNull();
  });

  it("player can submit join request, manager can approve it and synchronizes User.playerId/teamId", async () => {
    const { team, managerCookies, otherUser, otherCookies } = await createTestFixtures();

    // Player submits join request
    const joinReq = await handleApiRequest(
      new Request(`http://localhost:8080/api/teams/${team.id}/join-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({
          position: "MID",
          number: 8,
          role: "Product Manager",
          waiverAccepted: true,
        }),
      }),
    );
    expect(joinReq?.status).toBe(201);
    const joinPayload = (await joinReq?.json()) as {
      player: { id: string; status: string; userId: string };
    };
    expect(joinPayload.player.status).toBe("pending-approval");
    expect(joinPayload.player.userId).toBe(otherUser.id);

    // Manager receives join request notification
    const joinNotification = await prisma.notification.findFirst({
      where: {
        type: "team.join_request",
        resourceId: joinPayload.player.id,
      },
    });
    expect(joinNotification).not.toBeNull();

    // Player cannot submit duplicate request while pending
    const duplicateReq = await handleApiRequest(
      new Request(`http://localhost:8080/api/teams/${team.id}/join-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({
          position: "MID",
          waiverAccepted: true,
        }),
      }),
    );
    expect(duplicateReq?.status).toBe(409);

    // Manager approves join request
    const approveRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${joinPayload.player.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({ status: "approved" }),
      }),
    );
    expect(approveRes?.status).toBe(200);

    // Verify User record is now synchronized with playerId and teamId
    const syncedUser = await prisma.user.findUnique({
      where: { id: otherUser.id },
    });
    expect(syncedUser?.playerId).toBe(joinPayload.player.id);
    expect(syncedUser?.teamId).toBe(team.id);

    // Player receives approval notification
    const approvalNotification = await prisma.notification.findFirst({
      where: {
        type: "player.reviewed",
        resourceId: joinPayload.player.id,
        recipientUserId: otherUser.id,
      },
    });
    expect(approvalNotification).not.toBeNull();

    // Manager can remove/withdraw player
    const withdrawRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${joinPayload.player.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({ status: "withdrawn" }),
      }),
    );
    expect(withdrawRes?.status).toBe(200);

    // Verify User record clears playerId and teamId
    const withdrawnUser = await prisma.user.findUnique({
      where: { id: otherUser.id },
    });
    expect(withdrawnUser?.playerId).toBeNull();
    expect(withdrawnUser?.teamId).toBeNull();
  });

  it("lifecycle: direct approval of INVITED player is forbidden (409) and manager creation cannot bypass INVITED", async () => {
    const { team, managerCookies, stamp } = await createTestFixtures();
    const playerEmail = `lifecycle-${stamp}@devkics.test`;

    // Manager attempts to create player with status "approved" in payload
    const createRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Lifecycle Player",
          email: playerEmail,
          position: "MID",
          status: "approved",
        }),
      }),
    );
    expect(createRes?.status).toBe(201);
    const createdPayload = (await createRes?.json()) as { player: { id: string; status: string } };
    expect(createdPayload.player.status).toBe("invited");

    // Manager attempts to directly approve the INVITED player
    const directApproveRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${createdPayload.player.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({ status: "approved" }),
      }),
    );
    expect(directApproveRes?.status).toBe(409);
    const errorPayload = (await directApproveRes?.json()) as { error: string };
    expect(errorPayload.error).toContain("INVITED -> APPROVED is not allowed");
  });

  it("enforce PLAYER role on join-request: non-players receive 403 Forbidden", async () => {
    const { team, managerCookies } = await createTestFixtures();

    // Manager (who has Role.MANAGER but not Role.PLAYER) tries to create a join request
    const joinRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/teams/${team.id}/join-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          position: "DEF",
          waiverAccepted: true,
        }),
      }),
    );
    expect(joinRes?.status).toBe(403);
    const errorPayload = (await joinRes?.json()) as { error: string };
    expect(errorPayload.error).toContain("Only registered players can submit join requests");
  });

  it("wrong-user cannot accept or decline invitations", async () => {
    const { team, managerCookies, otherCookies, stamp } = await createTestFixtures();
    const targetEmail = `target-${stamp}@devkics.test`;

    const inviteRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Target Player",
          email: targetEmail,
          position: "MID",
        }),
      }),
    );
    const invitePayload = (await inviteRes?.json()) as { player: { id: string } };

    // otherCookies belongs to otherUser whose email is NOT targetEmail
    const wrongAccept = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({ action: "accept", waiverAccepted: true }),
      }),
    );
    expect(wrongAccept?.status).toBe(403);

    const wrongDecline = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({ action: "decline" }),
      }),
    );
    expect(wrongDecline?.status).toBe(403);
  });

  it("roster lock enforces 409 across invites, join requests, invite acceptance, and manager reviews", async () => {
    const { team, managerCookies, otherCookies, stamp, city } = await createTestFixtures();
    const inviteEmail = `locked-${stamp}@devkics.test`;

    // Create an invite before lock
    const inviteRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Pre-lock Player",
          email: inviteEmail,
          position: "GK",
        }),
      }),
    );
    const invitePayload = (await inviteRes?.json()) as { player: { id: string } };

    // Create player user and session directly
    const playerUser = await prisma.user.create({
      data: {
        name: "Pre-lock Player",
        email: inviteEmail,
        passwordHash: await hashPassword("password-12345"),
        citySlug: city.slug,
      },
    });
    const playerAssignment = await prisma.roleAssignment.create({
      data: {
        userId: playerUser.id,
        role: Role.PLAYER,
        cityId: city.id,
        countryCode: "NG",
      },
    });
    const playerSession = await issueSession(playerUser, [playerAssignment]);
    const playerCookies = [playerSession.accessCookie, playerSession.refreshCookie];

    // Lock the team roster
    await prisma.team.update({
      where: { id: team.id },
      data: { squadLockedAt: new Date() },
    });

    // 1. Inviting player to locked team fails
    const lockedInvite = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({
          teamId: team.id,
          fullName: "Blocked Player",
          email: `blocked-${stamp}@devkics.test`,
          position: "MID",
        }),
      }),
    );
    expect(lockedInvite?.status).toBe(409);

    // 2. Join request to locked team fails
    const lockedJoin = await handleApiRequest(
      new Request(`http://localhost:8080/api/teams/${team.id}/join-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({
          position: "FWD",
          waiverAccepted: true,
        }),
      }),
    );
    expect(lockedJoin?.status).toBe(409);

    // 3. Accepting invite on locked team fails
    const lockedAccept = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(playerCookies),
        },
        body: JSON.stringify({ action: "accept", waiverAccepted: true }),
      }),
    );
    expect(lockedAccept?.status).toBe(409);

    // 4. Manager review on locked team fails
    const lockedReview = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invitePayload.player.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({ status: "withdrawn" }),
      }),
    );
    expect(lockedReview?.status).toBe(409);
  });

  it("cross-city invitations are strictly isolated by user city", async () => {
    const { stamp, managerCookies } = await createTestFixtures();

    // Create Lagos city, tournament, org, and team
    const lagosCity = await prisma.city.create({
      data: {
        slug: `lagos-${stamp}`,
        name: "Lagos",
        country: "Nigeria",
        countryCode: "NG",
        status: CityStatus.LIVE,
        tagline: "Commercial Capital",
        accentImage: "/cities/lagos.jpg",
      },
    });
    const lagosTournament = await prisma.tournament.create({
      data: {
        cityId: lagosCity.id,
        name: "Lagos Tech Cup",
        slug: `lagos-cup-${stamp}`,
        season: "2026",
        format: "7-a-side",
        venue: "Onikan Stadium",
        summary: "Lagos Pilot",
        status: TournamentStatus.REGISTRATION_OPEN,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T23:59:59.000Z"),
      },
    });

    const lagosManager = await prisma.user.create({
      data: {
        name: "Lagos Manager",
        email: `lagos-mgr-${stamp}@devkics.test`,
        passwordHash: await hashPassword("password-12345"),
        citySlug: lagosCity.slug,
      },
    });
    const lagosAssignment = await prisma.roleAssignment.create({
      data: {
        userId: lagosManager.id,
        role: Role.MANAGER,
        cityId: lagosCity.id,
        countryCode: "NG",
      },
    });
    const lagosSession = await issueSession(lagosManager, [lagosAssignment]);
    const lagosCookies = [lagosSession.accessCookie, lagosSession.refreshCookie];

    const lagosOrg = await prisma.organization.create({
      data: {
        cityId: lagosCity.id,
        ownerUserId: lagosManager.id,
        name: `Lagos Org ${stamp}`,
        slug: `lagos-org-${stamp}`,
        email: `lagos-org-${stamp}@devkics.test`,
        description: "Lagos Tech side",
        status: OrganizationStatus.APPROVED,
      },
    });
    const lagosTeam = await prisma.team.create({
      data: {
        tournamentId: lagosTournament.id,
        organizationId: lagosOrg.id,
        managerUserId: lagosManager.id,
        name: `Lagos Tech Stars ${stamp}`,
        shortName: `LTS${String(stamp).slice(-1)}`,
        company: "LagosTech",
        status: TeamStatus.APPROVED,
      },
    });

    const inviteEmail = `cross-city-${stamp}@devkics.test`;
    // Lagos manager creates invite for player in Lagos
    const lagosInviteRes = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(lagosCookies),
        },
        body: JSON.stringify({
          teamId: lagosTeam.id,
          fullName: "Lagos Player",
          email: inviteEmail,
          position: "MID",
        }),
      }),
    );
    expect(lagosInviteRes?.status).toBe(201);
    const lagosInviteData = (await lagosInviteRes?.json()) as { player: { id: string } };

    // User registers in ABUJA with the same email
    const abujaCitySlug = (await prisma.city.findFirst({
      where: { slug: { startsWith: "abuja" } },
    }))!.slug;
    const abujaRegRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Abuja Registered Player",
          email: inviteEmail,
          password: "password-12345",
          role: "player",
          citySlug: abujaCitySlug,
          acceptedTerms: true,
        }),
      }),
    );
    expect(abujaRegRes?.status).toBe(201);

    // Verify the Lagos invitation was NOT claimed because user registered in Abuja
    const untouchedPlayer = await prisma.player.findUnique({
      where: { id: lagosInviteData.player.id },
    });
    expect(untouchedPlayer?.userId).toBeNull();
  });

  it("stale and out-of-sync playerId/teamId on user are cleansed or synchronized on login", async () => {
    const { city, stamp } = await createTestFixtures();
    const userEmail = `stale-${stamp}@devkics.test`;
    const password = "password-12345";

    // User with non-existent playerId and teamId
    const testUser = await prisma.user.create({
      data: {
        name: "Stale User",
        email: userEmail,
        passwordHash: await hashPassword(password),
        citySlug: city.slug,
        playerId: "non-existent-player-id",
        teamId: "non-existent-team-id",
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: testUser.id,
        role: Role.PLAYER,
        cityId: city.id,
        countryCode: "NG",
      },
    });

    // Logging in should audit and clear stale playerId and teamId
    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `192.168.10.${stamp % 250}`,
        },
        body: JSON.stringify({
          email: userEmail,
          password,
          portal: "standard",
        }),
      }),
    );
    expect(loginRes?.status).toBe(200);

    const refreshedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(refreshedUser?.playerId).toBeNull();
    expect(refreshedUser?.teamId).toBeNull();
  });

  it("withdrawing player only clears User.playerId/teamId if they still match the withdrawn player and team", async () => {
    const { team, managerCookies, stamp, city, org, tournament } = await createTestFixtures();
    const playerEmail = `multi-team-${stamp}@devkics.test`;
    const password = "password-12345";

    // User is created
    const multiUser = await prisma.user.create({
      data: {
        name: "Multi-team Player",
        email: playerEmail,
        passwordHash: await hashPassword(password),
        citySlug: city.slug,
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: multiUser.id,
        role: Role.PLAYER,
        cityId: city.id,
        countryCode: "NG",
      },
    });

    // Player record 1 on Team 1 (approved)
    const player1 = await prisma.player.create({
      data: {
        teamId: team.id,
        userId: multiUser.id,
        fullName: multiUser.name,
        email: playerEmail,
        position: "MID",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    // Create Team 2 and Player record 2 (approved)
    const team2 = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: org.id,
        managerUserId: multiUser.id,
        name: `Team 2 ${stamp}`,
        shortName: `T2${String(stamp).slice(-1)}`,
        company: "Team2Corp",
        status: TeamStatus.APPROVED,
      },
    });
    const player2 = await prisma.player.create({
      data: {
        teamId: team2.id,
        userId: multiUser.id,
        fullName: multiUser.name,
        email: playerEmail,
        position: "FWD",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    // User currently references Player 2 and Team 2
    await prisma.user.update({
      where: { id: multiUser.id },
      data: {
        playerId: player2.id,
        teamId: team2.id,
      },
    });

    // Team 1 manager withdraws Player 1
    const withdrawRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${player1.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(managerCookies),
        },
        body: JSON.stringify({ status: "withdrawn" }),
      }),
    );
    expect(withdrawRes?.status).toBe(200);

    // Verify User.playerId and teamId were NOT cleared because they reference Player 2 and Team 2!
    const unchangedUser = await prisma.user.findUnique({
      where: { id: multiUser.id },
    });
    expect(unchangedUser?.playerId).toBe(player2.id);
    expect(unchangedUser?.teamId).toBe(team2.id);
  });

  it("invitation acceptance fails with 409 if player already has an active squad in tournament", async () => {
    const { team, managerCookies, stamp, tournament, org, otherCookies, otherUser } =
      await createTestFixtures();

    // otherUser is already an approved player in this tournament on Team 1
    await prisma.player.create({
      data: {
        teamId: team.id,
        userId: otherUser.id,
        fullName: otherUser.name,
        email: otherUser.email,
        position: "GK",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });
    await prisma.user.update({
      where: { id: otherUser.id },
      data: { playerId: "some-p-id", teamId: team.id },
    });

    // Team 2 manager invites otherUser to Team 2 in same tournament
    const team2 = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: org.id,
        name: `Rival FC ${stamp}`,
        shortName: `RFC${String(stamp).slice(-1)}`,
        company: "RivalCo",
        status: TeamStatus.APPROVED,
      },
    });

    const invite2 = await prisma.player.create({
      data: {
        teamId: team2.id,
        userId: otherUser.id,
        fullName: otherUser.name,
        email: otherUser.email,
        position: "MID",
        status: PlayerStatus.INVITED,
      },
    });

    // otherUser tries to accept invite to Team 2
    const acceptRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players/${invite2.id}/invitation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(otherCookies),
        },
        body: JSON.stringify({ action: "accept", waiverAccepted: true }),
      }),
    );
    expect(acceptRes?.status).toBe(409);
    const errPayload = (await acceptRes?.json()) as { error: string };
    expect(errPayload.error).toContain(
      "already have an active or pending squad in this tournament",
    );
  });

  it("GET /api/players: rejects unauthenticated requests with 401", async () => {
    const res = await handleApiRequest(
      new Request("http://localhost:8080/api/players", {
        method: "GET",
      }),
    );
    expect(res?.status).toBe(401);
  });

  it("GET /api/players: unassigned authenticated user receives empty player list", async () => {
    const { otherCookies, tournament } = await createTestFixtures();
    const res = await handleApiRequest(
      new Request(`http://localhost:8080/api/players?tournamentId=${tournament.id}`, {
        method: "GET",
        headers: { cookie: toCookieHeader(otherCookies) },
      }),
    );
    expect(res?.status).toBe(200);
    const payload = (await res?.json()) as { ok: boolean; players: unknown[]; total: number };
    expect(payload.ok).toBe(true);
    expect(payload.players).toEqual([]);
    expect(payload.total).toBe(0);
  });

  it("GET /api/players: manager can only see their own team players and can view emails", async () => {
    const { team, managerCookies, tournament, org, stamp } = await createTestFixtures();

    // Create a player on manager's team
    const team1Player = await prisma.player.create({
      data: {
        teamId: team.id,
        fullName: "Squad Member 1",
        email: `squad1-${stamp}@devkics.test`,
        position: "DEF",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    // Create a rival team in the same tournament
    const rivalTeam = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: org.id,
        name: `Rival FC ${stamp}`,
        shortName: `RFC${String(stamp).slice(-1)}`,
        company: "Rival Corp",
        status: TeamStatus.APPROVED,
      },
    });

    // Create a player on rival team
    await prisma.player.create({
      data: {
        teamId: rivalTeam.id,
        fullName: "Rival Player 1",
        email: `rival-${stamp}@devkics.test`,
        position: "FWD",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    // Manager queries the tournament
    const tournamentQueryRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players?tournamentId=${tournament.id}`, {
        method: "GET",
        headers: { cookie: toCookieHeader(managerCookies) },
      }),
    );
    expect(tournamentQueryRes?.status).toBe(200);
    const tournamentPayload = (await tournamentQueryRes?.json()) as {
      ok: boolean;
      players: { id: string; teamId: string; email: string | null }[];
    };
    expect(tournamentPayload.players.length).toBe(1);
    const p0 = tournamentPayload.players[0]!;
    expect(p0.id).toBe(team1Player.id);
    expect(p0.email).toBe(`squad1-${stamp}@devkics.test`); // Manager sees own player email

    // Manager queries rival team directly -> returns empty list
    const rivalQueryRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/players?teamId=${rivalTeam.id}`, {
        method: "GET",
        headers: { cookie: toCookieHeader(managerCookies) },
      }),
    );
    expect(rivalQueryRes?.status).toBe(200);
    const rivalPayload = (await rivalQueryRes?.json()) as {
      ok: boolean;
      players: unknown[];
      total: number;
    };
    expect(rivalPayload.players).toEqual([]);
    expect(rivalPayload.total).toBe(0);
  });

  it("GET /api/players: player can only see self and approved teammates; teammate emails are masked", async () => {
    const { team, tournament, org, stamp, city } = await createTestFixtures();

    // User A (approved on Team 1)
    const playerAUser = await prisma.user.create({
      data: {
        name: "Player A",
        email: `player-a-${stamp}@devkics.test`,
        passwordHash: await hashPassword("password-123"),
        citySlug: city.slug,
      },
    });
    const playerAAssignment = await prisma.roleAssignment.create({
      data: { userId: playerAUser.id, role: Role.PLAYER, cityId: city.id, countryCode: "NG" },
    });
    const playerASession = await issueSession(playerAUser, [playerAAssignment]);
    const playerACookies = [playerASession.accessCookie, playerASession.refreshCookie];

    const playerARecord = await prisma.player.create({
      data: {
        teamId: team.id,
        userId: playerAUser.id,
        fullName: playerAUser.name,
        email: playerAUser.email,
        position: "MID",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    // Teammate B (approved on Team 1)
    const teammateB = await prisma.player.create({
      data: {
        teamId: team.id,
        fullName: "Teammate B",
        email: `teammate-b-${stamp}@devkics.test`,
        position: "DEF",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    // Rival Team & Rival Player
    const rivalTeam = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: org.id,
        name: `Rival FC ${stamp}`,
        shortName: `RFC${String(stamp).slice(-1)}`,
        company: "Rival Corp",
        status: TeamStatus.APPROVED,
      },
    });
    await prisma.player.create({
      data: {
        teamId: rivalTeam.id,
        fullName: "Rival Player",
        email: `rival-${stamp}@devkics.test`,
        position: "FWD",
        status: PlayerStatus.APPROVED,
        waiverAcceptedAt: new Date(),
      },
    });

    // Player A queries tournament players
    const res = await handleApiRequest(
      new Request(`http://localhost:8080/api/players?tournamentId=${tournament.id}`, {
        method: "GET",
        headers: { cookie: toCookieHeader(playerACookies) },
      }),
    );
    expect(res?.status).toBe(200);
    const payload = (await res?.json()) as {
      ok: boolean;
      players: { id: string; teamId: string; email: string | null }[];
    };

    // Exactly 2 players visible: player A (self) and teammate B
    expect(payload.players.length).toBe(2);
    const self = payload.players.find((p) => p.id === playerARecord.id);
    const teammate = payload.players.find((p) => p.id === teammateB.id);

    expect(self).toBeDefined();
    expect(self?.email).toBe(playerAUser.email); // Self email is visible

    expect(teammate).toBeDefined();
    expect(teammate?.email).toBeNull(); // Teammate email is MASKED (null)
  });

  it("GET /api/players: admin retains operational visibility across all teams with emails and reviewNotes", async () => {
    const { team, tournament, org, stamp, city } = await createTestFixtures();

    // Admin user
    const adminUser = await prisma.user.create({
      data: {
        name: "League Admin",
        email: `admin-${stamp}@devkics.test`,
        passwordHash: await hashPassword("admin-password-123"),
        citySlug: city.slug,
      },
    });
    const adminAssignment = await prisma.roleAssignment.create({
      data: { userId: adminUser.id, role: Role.ADMIN },
    });
    const adminSession = await issueSession(adminUser, [adminAssignment]);
    const adminCookies = [adminSession.accessCookie, adminSession.refreshCookie];

    // Player on Team 1 with review notes
    await prisma.player.create({
      data: {
        teamId: team.id,
        fullName: "Team 1 Player",
        email: `p1-${stamp}@devkics.test`,
        position: "GK",
        status: PlayerStatus.APPROVED,
        reviewNotes: "Admin verified ID and clearance",
        waiverAcceptedAt: new Date(),
      },
    });

    // Rival team and player
    const rivalTeam = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: org.id,
        name: `Rival FC ${stamp}`,
        shortName: `RFC${String(stamp).slice(-1)}`,
        company: "Rival Corp",
        status: TeamStatus.APPROVED,
      },
    });
    await prisma.player.create({
      data: {
        teamId: rivalTeam.id,
        fullName: "Rival Player",
        email: `rival-${stamp}@devkics.test`,
        position: "FWD",
        status: PlayerStatus.APPROVED,
        reviewNotes: "Clearance pending proof of work",
        waiverAcceptedAt: new Date(),
      },
    });

    const res = await handleApiRequest(
      new Request(`http://localhost:8080/api/players?tournamentId=${tournament.id}`, {
        method: "GET",
        headers: { cookie: toCookieHeader(adminCookies) },
      }),
    );
    expect(res?.status).toBe(200);
    const payload = (await res?.json()) as {
      ok: boolean;
      players: { id: string; email: string | null; reviewNotes: string | null }[];
    };
    expect(payload.players.length).toBe(2); // Admin sees both teams
    expect(payload.players.every((p) => p.email !== null)).toBe(true); // Admin sees all emails
    expect(payload.players.every((p) => p.reviewNotes !== null)).toBe(true); // Admin sees all review notes
  });

  describe("Phase 4: Player Position Clarification & Negotiation Lifecycle", () => {
    it("consent enforcement: rejects accept or clarify without participation waiver", async () => {
      const { team, otherCookies, otherUser } = await createTestFixtures();

      const invite = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "MID",
          status: PlayerStatus.INVITED,
        },
      });

      // 1. Trying to accept without waiver -> 400
      const acceptNoWaiver = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}/invitation`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(otherCookies),
          },
          body: JSON.stringify({ action: "accept", waiverAccepted: false }),
        }),
      );
      expect(acceptNoWaiver?.status).toBe(400);
      const acceptErr = (await acceptNoWaiver?.json()) as { error: string };
      expect(acceptErr.error).toContain("Participation waiver acceptance is required");

      // 2. Trying to clarify without waiver -> 400
      const clarifyNoWaiver = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}/invitation`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(otherCookies),
          },
          body: JSON.stringify({
            action: "clarify",
            preferredPosition: "FWD",
            waiverAccepted: false,
          }),
        }),
      );
      expect(clarifyNoWaiver?.status).toBe(400);
      const clarifyErr = (await clarifyNoWaiver?.json()) as { error: string };
      expect(clarifyErr.error).toContain("Participation waiver acceptance is required");
    });

    it("clarify validation: rejects clarify action without preferredPosition", async () => {
      const { team, otherCookies, otherUser } = await createTestFixtures();

      const invite = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "MID",
          status: PlayerStatus.INVITED,
        },
      });

      const clarifyNoPosition = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}/invitation`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(otherCookies),
          },
          body: JSON.stringify({
            action: "clarify",
            waiverAccepted: true,
          }),
        }),
      );
      expect(clarifyNoPosition?.status).toBe(400);
      const err = (await clarifyNoPosition?.json()) as { error: string };
      expect(err.error).toContain("Preferred position is required");
    });

    it("direct accept flow: transitions to PENDING_APPROVAL and maintains canonical position", async () => {
      const { team, managerCookies, otherCookies, otherUser } = await createTestFixtures();

      const invite = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "DEF",
          status: PlayerStatus.INVITED,
        },
      });

      const res = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}/invitation`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(otherCookies),
          },
          body: JSON.stringify({
            action: "accept",
            waiverAccepted: true,
          }),
        }),
      );
      expect(res?.status).toBe(200);

      const dbPlayer = await prisma.player.findUnique({ where: { id: invite.id } });
      expect(dbPlayer?.status).toBe(PlayerStatus.PENDING_APPROVAL);
      expect(dbPlayer?.position).toBe("DEF");
      expect(dbPlayer?.proposedPosition).toBeNull();
      expect(dbPlayer?.positionNotes).toBeNull();
      expect(dbPlayer?.waiverAcceptedAt).not.toBeNull();

      // Manager approves
      const approveRes = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(managerCookies),
          },
          body: JSON.stringify({ status: "approved" }),
        }),
      );
      expect(approveRes?.status).toBe(200);

      const approvedDb = await prisma.player.findUnique({ where: { id: invite.id } });
      expect(approvedDb?.status).toBe(PlayerStatus.APPROVED);
      expect(approvedDb?.position).toBe("DEF");
      expect(approvedDb?.proposedPosition).toBeNull();
      expect(approvedDb?.positionNotes).toBeNull();
    });

    it("clarify flow & approval: player proposes position, manager approves and promotes proposed position to canonical", async () => {
      const { team, managerCookies, managerUser, otherCookies, otherUser } =
        await createTestFixtures();

      const invite = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "MID",
          status: PlayerStatus.INVITED,
        },
      });

      // Player responds with clarify
      const clarifyRes = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}/invitation`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(otherCookies),
          },
          body: JSON.stringify({
            action: "clarify",
            preferredPosition: "FWD",
            positionNotes: "Prefer central striker or winger",
            waiverAccepted: true,
            mediaConsentAccepted: true,
          }),
        }),
      );
      expect(clarifyRes?.status).toBe(200);

      // Verify DB state while pending approval:
      // Canonical position stays original ("MID")
      // proposedPosition is "FWD"
      // positionNotes is saved
      const pendingDb = await prisma.player.findUnique({ where: { id: invite.id } });
      expect(pendingDb?.status).toBe(PlayerStatus.PENDING_APPROVAL);
      expect(pendingDb?.position).toBe("MID"); // Original canonical position preserved
      expect(pendingDb?.proposedPosition).toBe("FWD");
      expect(pendingDb?.positionNotes).toBe("Prefer central striker or winger");
      expect(pendingDb?.waiverAcceptedAt).not.toBeNull();
      expect(pendingDb?.mediaConsentAcceptedAt).not.toBeNull();

      // Verify manager received immediate notification
      const managerNotification = await prisma.notification.findFirst({
        where: {
          recipientUserId: managerUser.id,
          type: "team.invitation_clarified",
        },
      });
      expect(managerNotification).not.toBeNull();
      expect(managerNotification?.title).toContain("Player proposed position change");
      expect(managerNotification?.body).toContain("FWD");

      // Verify audit log
      const clarifyAudit = await prisma.auditLog.findFirst({
        where: {
          resourceId: invite.id,
          action: "player.invitation.clarified",
        },
      });
      expect(clarifyAudit).not.toBeNull();

      // Manager approves the player
      const approveRes = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(managerCookies),
          },
          body: JSON.stringify({ status: "approved" }),
        }),
      );
      expect(approveRes?.status).toBe(200);

      // Verify approved DB state:
      // Position promoted to "FWD"
      // proposedPosition and positionNotes cleared
      const approvedDb = await prisma.player.findUnique({ where: { id: invite.id } });
      expect(approvedDb?.status).toBe(PlayerStatus.APPROVED);
      expect(approvedDb?.position).toBe("FWD"); // Promoted!
      expect(approvedDb?.proposedPosition).toBeNull(); // Cleared!
      expect(approvedDb?.positionNotes).toBeNull(); // Cleared!

      // Verify player received review notification mentioning approved position
      const playerNotification = await prisma.notification.findFirst({
        where: {
          recipientUserId: otherUser.id,
          type: "player.reviewed",
        },
      });
      expect(playerNotification?.body).toContain("approved as FWD");
    });

    it("clarify flow & rejection: manager rejects clarification, keeping reviewNotes separate and clearing negotiation fields", async () => {
      const { team, managerCookies, otherCookies, otherUser } = await createTestFixtures();

      const invite = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "GK",
          status: PlayerStatus.INVITED,
        },
      });

      // Player clarifies
      const clarifyRes = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}/invitation`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(otherCookies),
          },
          body: JSON.stringify({
            action: "clarify",
            preferredPosition: "DEF",
            positionNotes: "Prefer center back",
            waiverAccepted: true,
          }),
        }),
      );
      expect(clarifyRes?.status).toBe(200);

      // Manager rejects with review comments
      const rejectRes = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${invite.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(managerCookies),
          },
          body: JSON.stringify({
            status: "withdrawn",
            reviewNotes: "Only GK slot was open on this roster",
          }),
        }),
      );
      expect(rejectRes?.status).toBe(200);

      const rejectedDb = await prisma.player.findUnique({ where: { id: invite.id } });
      expect(rejectedDb?.status).toBe(PlayerStatus.WITHDRAWN);
      expect(rejectedDb?.position).toBe("GK"); // Original canonical position unchanged
      expect(rejectedDb?.proposedPosition).toBeNull(); // Cleared!
      expect(rejectedDb?.positionNotes).toBeNull(); // Cleared!
      expect(rejectedDb?.reviewNotes).toBe("Only GK slot was open on this roster"); // Review notes separate!
    });
  });

  describe("Phase 5: Manager Roster Management, Editing, Removal, and Operational Privacy", () => {
    it("manager can safely edit player position, kit number (1–99), and role on their own team without status transition, dispatching player.squad.updated notification", async () => {
      const { team, managerCookies, otherUser } = await createTestFixtures();

      const player = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "MID",
          number: 7,
          role: "Starter",
          status: PlayerStatus.APPROVED,
          waiverAcceptedAt: new Date(),
        },
      });

      const res = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${player.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(managerCookies),
          },
          body: JSON.stringify({
            position: "FWD",
            number: 10,
            role: "Captain",
          }),
        }),
      );

      expect(res?.status).toBe(200);
      const data = await res?.json();
      expect(data.ok).toBe(true);
      expect(data.player.position).toBe("FWD");
      expect(data.player.number).toBe(10);
      expect(data.player.role).toBe("Captain");
      expect(data.player.status).toBe("approved");

      // Verify DB
      const updatedDb = await prisma.player.findUnique({ where: { id: player.id } });
      expect(updatedDb?.position).toBe("FWD");
      expect(updatedDb?.number).toBe(10);
      expect(updatedDb?.role).toBe("Captain");
      expect(updatedDb?.status).toBe(PlayerStatus.APPROVED);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          resourceId: player.id,
          action: "player.squad.updated",
        },
      });
      expect(audit).not.toBeNull();
      expect((audit?.oldValue as Record<string, unknown>)["position"]).toBe("MID");
      expect((audit?.oldValue as Record<string, unknown>)["number"]).toBe(7);
      expect((audit?.newValue as Record<string, unknown>)["position"]).toBe("FWD");
      expect((audit?.newValue as Record<string, unknown>)["number"]).toBe(10);

      // Verify dedicated notification
      const notification = await prisma.notification.findFirst({
        where: {
          recipientUserId: otherUser.id,
          type: "player.squad.updated",
        },
      });
      expect(notification).not.toBeNull();
      expect(notification?.title).toBe("Squad details updated");
      expect(notification?.body).toContain(team.name);
    });

    it("blocks cross-team edits: rival manager receives 403 Forbidden when trying to edit another team's player", async () => {
      const { city, tournament, team, otherUser } = await createTestFixtures();

      // Rival manager and team
      const stamp = Date.now();
      const rivalManager = await prisma.user.create({
        data: {
          name: "Rival Manager",
          email: `rival-${stamp}@devkics.test`,
          passwordHash: await hashPassword("password123"),
          citySlug: city.slug,
        },
      });
      const rivalAssignment = await prisma.roleAssignment.create({
        data: {
          userId: rivalManager.id,
          role: Role.MANAGER,
          cityId: city.id,
          countryCode: "NG",
        },
      });
      const rivalOrg = await prisma.organization.create({
        data: {
          name: `Rival Org ${stamp}`,
          slug: `rival-org-${stamp}`,
          description: "Rival organization",
          email: rivalManager.email,
          cityId: city.id,
          ownerUserId: rivalManager.id,
          status: OrganizationStatus.APPROVED,
        },
      });
      await prisma.team.create({
        data: {
          tournamentId: tournament.id,
          organizationId: rivalOrg.id,
          name: `Rival FC ${stamp}`,
          shortName: "RFC",
          company: "Rival Co",
          managerUserId: rivalManager.id,
          status: TeamStatus.APPROVED,
        },
      });
      const rivalSession = await issueSession(rivalManager, [rivalAssignment]);
      const rivalCookies = [rivalSession.accessCookie, rivalSession.refreshCookie];

      const player = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "MID",
          number: 7,
          role: "Starter",
          status: PlayerStatus.APPROVED,
          waiverAcceptedAt: new Date(),
        },
      });

      const res = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${player.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(rivalCookies),
          },
          body: JSON.stringify({
            position: "FWD",
            number: 99,
          }),
        }),
      );

      expect(res?.status).toBe(403);
    });

    it("enforces roster locks: manager cannot edit player squad details when team squad is locked", async () => {
      const { team, managerCookies, otherUser } = await createTestFixtures();

      await prisma.team.update({
        where: { id: team.id },
        data: { squadLockedAt: new Date() },
      });

      const player = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "MID",
          number: 7,
          role: "Starter",
          status: PlayerStatus.APPROVED,
          waiverAcceptedAt: new Date(),
        },
      });

      const res = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${player.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(managerCookies),
          },
          body: JSON.stringify({
            number: 11,
          }),
        }),
      );

      expect(res?.status).toBe(409);
      const data = await res?.json();
      expect(data.error).toMatch(/roster.*locked/i);
    });

    it("manager can remove player from squad, setting status WITHDRAWN and dispatching player.squad.removed notification", async () => {
      const { team, managerCookies, otherUser } = await createTestFixtures();

      const player = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "MID",
          number: 7,
          role: "Starter",
          status: PlayerStatus.APPROVED,
          waiverAcceptedAt: new Date(),
        },
      });

      // Also set user's pointers to simulate active squad membership
      await prisma.user.update({
        where: { id: otherUser.id },
        data: {
          playerId: player.id,
          teamId: team.id,
        },
      });

      const res = await handleApiRequest(
        new Request(`http://localhost:8080/api/players/${player.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: toCookieHeader(managerCookies),
          },
          body: JSON.stringify({
            status: "withdrawn",
          }),
        }),
      );

      expect(res?.status).toBe(200);

      // Verify DB
      const updatedDb = await prisma.player.findUnique({ where: { id: player.id } });
      expect(updatedDb?.status).toBe(PlayerStatus.WITHDRAWN);

      // Verify user pointers cleared
      const updatedUser = await prisma.user.findUnique({ where: { id: otherUser.id } });
      expect(updatedUser?.teamId).toBeNull();
      expect(updatedUser?.playerId).toBeNull();

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          resourceId: player.id,
          action: "player.squad.removed",
        },
      });
      expect(audit).not.toBeNull();

      // Verify dedicated notification
      const notification = await prisma.notification.findFirst({
        where: {
          recipientUserId: otherUser.id,
          type: "player.squad.removed",
        },
      });
      expect(notification).not.toBeNull();
      expect(notification?.title).toBe("Removed from squad");
      expect(notification?.body).toContain(team.name);
    });

    it("operational data disclosure: emergency contact and waiver timestamps are exposed only to authorized viewers (manager/self/admin), while medical data is protected", async () => {
      const { city, team, managerCookies, otherUser } = await createTestFixtures();

      const stamp = Date.now();
      // Create a teammate
      const teammateUser = await prisma.user.create({
        data: {
          name: "Teammate User",
          email: `teammate-${stamp}@devkics.test`,
          passwordHash: await hashPassword("password123"),
          citySlug: city.slug,
        },
      });
      const teammateAssignment = await prisma.roleAssignment.create({
        data: {
          userId: teammateUser.id,
          role: Role.PLAYER,
          cityId: city.id,
          countryCode: "NG",
        },
      });
      const teammateSession = await issueSession(teammateUser, [teammateAssignment]);
      const teammateCookies = [teammateSession.accessCookie, teammateSession.refreshCookie];

      await prisma.player.create({
        data: {
          teamId: team.id,
          userId: teammateUser.id,
          fullName: teammateUser.name,
          email: teammateUser.email,
          position: "DEF",
          number: 4,
          status: PlayerStatus.APPROVED,
          waiverAcceptedAt: new Date(),
        },
      });

      const player = await prisma.player.create({
        data: {
          teamId: team.id,
          userId: otherUser.id,
          fullName: otherUser.name,
          email: otherUser.email,
          position: "FWD",
          number: 9,
          role: "Striker",
          status: PlayerStatus.APPROVED,
          emergencyContactName: "Jane Doe",
          emergencyContactPhone: "+2348012345678",
          medicalDeclaration: "Asthma - uses inhaler",
          waiverAcceptedAt: new Date(),
          mediaConsentAcceptedAt: new Date(),
        },
      });

      // 1. Manager queries players
      const managerRes = await handleApiRequest(
        new Request(`http://localhost:8080/api/players?teamId=${team.id}`, {
          method: "GET",
          headers: {
            cookie: toCookieHeader(managerCookies),
          },
        }),
      );
      expect(managerRes?.status).toBe(200);
      const managerData = await managerRes?.json();
      const managerPlayer = managerData.players.find((p: { id: string }) => p.id === player.id);
      expect(managerPlayer).toBeDefined();
      expect(managerPlayer.emergencyContactName).toBe("Jane Doe");
      expect(managerPlayer.emergencyContactPhone).toBe("+2348012345678");
      expect(managerPlayer.waiverAcceptedAt).toBeTruthy();
      expect(managerPlayer.mediaConsentAcceptedAt).toBeTruthy();
      // Medical declaration must NEVER be exposed
      expect((managerPlayer as Record<string, unknown>)["medicalDeclaration"]).toBeUndefined();

      // 2. Teammate queries players
      const teammateRes = await handleApiRequest(
        new Request(`http://localhost:8080/api/players?teamId=${team.id}`, {
          method: "GET",
          headers: {
            cookie: toCookieHeader(teammateCookies),
          },
        }),
      );
      expect(teammateRes?.status).toBe(200);
      const teammateData = await teammateRes?.json();
      const teammateViewOfPlayer = teammateData.players.find(
        (p: { id: string }) => p.id === player.id,
      );
      expect(teammateViewOfPlayer).toBeDefined();
      // Operational fields hidden from teammate
      expect(teammateViewOfPlayer.emergencyContactName).toBeNull();
      expect(teammateViewOfPlayer.emergencyContactPhone).toBeNull();
      expect(teammateViewOfPlayer.waiverAcceptedAt).toBeNull();
      expect(teammateViewOfPlayer.mediaConsentAcceptedAt).toBeNull();
      expect(
        (teammateViewOfPlayer as Record<string, unknown>)["medicalDeclaration"],
      ).toBeUndefined();
    });
  });
});

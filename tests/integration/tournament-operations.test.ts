import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@prisma/client";

import { handleApiRequest } from "@/lib/server/api";
import { hashPassword } from "@/lib/server/auth";
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

describe("Phase 2 tournament operations", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.mediaFile.deleteMany();
    await prisma.gallery.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.sponsorshipEnquiry.deleteMany();
    await prisma.sponsorship.deleteMany();
    await prisma.sponsor.deleteMany();
    await prisma.volunteer.deleteMany();
    await prisma.volunteerApplication.deleteMany();
    await prisma.awardAssignment.deleteMany();
    await prisma.award.deleteMany();
    await prisma.knockoutLink.deleteMany();
    await prisma.knockoutRound.deleteMany();
    await prisma.standing.deleteMany();
    await prisma.matchEvent.deleteMany();
    await prisma.match.deleteMany();
    await prisma.fixture.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.group.deleteMany();
    await prisma.tournament.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.organizerApplication.deleteMany();
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.city.deleteMany();

    await prisma.city.upsert({
      where: { slug: "abuja" },
      update: {
        name: "Abuja",
        country: "Nigeria",
        countryCode: "NG",
        status: "LIVE",
        teams: 8,
        players: 96,
        tagline: "Pilot city",
        accentImage: "abuja",
      },
      create: {
        slug: "abuja",
        name: "Abuja",
        country: "Nigeria",
        countryCode: "NG",
        status: "LIVE",
        teams: 8,
        players: 96,
        tagline: "Pilot city",
        accentImage: "abuja",
      },
    });
  });

  it("runs organization -> team -> player approvals and result->standings pipeline", async () => {
    const city = await prisma.city.findUnique({ where: { slug: "abuja" } });

    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: "phase2-admin@devkics.com",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
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

    const managerEmail = `phase2-manager-${Date.now()}@devkics.test`;
    const registerManagerReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Phase2 Manager",
        email: managerEmail,
        password: "devkics123",
        role: "manager",
        citySlug: "abuja",
      }),
    });

    const managerRes = await handleApiRequest(registerManagerReq);
    expect(managerRes?.status).toBe(201);
    const managerCookies = collectSetCookies(managerRes as Response);

    const loginAdminReq = new Request("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "phase2-admin@devkics.com", password: "devkics123" }),
    });
    const adminLoginRes = await handleApiRequest(loginAdminReq);
    const adminCookies = collectSetCookies(adminLoginRes as Response);

    const createTournamentReq = new Request("http://localhost:8080/api/tournaments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(adminCookies),
      },
      body: JSON.stringify({
        citySlug: "abuja",
        name: "Abuja Cup",
        slug: "abuja-cup-2026",
        season: "Season 1",
        format: "Group + Knockout",
        venue: "Jabi Turf",
        summary: "Official Abuja tournament",
        startDate: "2026-09-01",
        endDate: "2026-10-01",
      }),
    });

    const createTournamentRes = await handleApiRequest(createTournamentReq);
    expect(createTournamentRes?.status).toBe(201);
    const tournamentPayload = (await createTournamentRes?.json()) as {
      tournament: { id: string };
    };

    const createOrganizationReq = new Request("http://localhost:8080/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(managerCookies),
      },
      body: JSON.stringify({
        citySlug: "abuja",
        name: "Interswitch Engineering",
        email: "org@devkics.test",
        description: "Tech org entering a competitive squad.",
      }),
    });

    const createOrganizationRes = await handleApiRequest(createOrganizationReq);
    expect(createOrganizationRes?.status).toBe(201);
    const organizationPayload = (await createOrganizationRes?.json()) as {
      organization: { id: string };
    };

    const approveOrgReq = new Request(
      `http://localhost:8080/api/organizations/${organizationPayload.organization.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(adminCookies),
        },
        body: JSON.stringify({ status: "under-review" }),
      },
    );
    expect((await handleApiRequest(approveOrgReq))?.status).toBe(200);

    const finalizeOrgReq = new Request(
      `http://localhost:8080/api/organizations/${organizationPayload.organization.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(adminCookies),
        },
        body: JSON.stringify({ status: "approved" }),
      },
    );
    expect((await handleApiRequest(finalizeOrgReq))?.status).toBe(200);

    const createTeamReq = new Request("http://localhost:8080/api/teams", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(managerCookies),
      },
      body: JSON.stringify({
        tournamentId: tournamentPayload.tournament.id,
        organizationId: organizationPayload.organization.id,
        name: "Interswitch Devs",
        shortName: "ISD",
        company: "Interswitch",
      }),
    });

    const createTeamRes = await handleApiRequest(createTeamReq);
    expect(createTeamRes?.status).toBe(201);
    const teamPayload = (await createTeamRes?.json()) as { team: { id: string } };

    const reviewTeamReq = new Request(`http://localhost:8080/api/teams/${teamPayload.team.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(adminCookies),
      },
      body: JSON.stringify({ status: "under-review" }),
    });
    expect((await handleApiRequest(reviewTeamReq))?.status).toBe(200);

    const approveTeamReq = new Request(`http://localhost:8080/api/teams/${teamPayload.team.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(adminCookies),
      },
      body: JSON.stringify({ status: "approved" }),
    });
    const approveTeamRes = await handleApiRequest(approveTeamReq);
    expect(approveTeamRes?.status).toBe(200);
    await expect(
      prisma.notification.findFirst({
        where: {
          type: "team.reviewed",
          resourceId: teamPayload.team.id,
          recipientEmail: managerEmail,
          channel: "EMAIL",
        },
      }),
    ).resolves.not.toBeNull();

    const createPlayerReq = new Request("http://localhost:8080/api/players", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(managerCookies),
      },
      body: JSON.stringify({
        teamId: teamPayload.team.id,
        fullName: "Manager Player",
        position: "MID",
        number: 10,
        role: "Engineer",
        waiverAccepted: true,
      }),
    });

    const createPlayerRes = await handleApiRequest(createPlayerReq);
    expect(createPlayerRes?.status).toBe(201);
    const playerPayload = (await createPlayerRes?.json()) as { player: { id: string } };

    const approvePlayerReq = new Request(
      `http://localhost:8080/api/players/${playerPayload.player.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(adminCookies),
        },
        body: JSON.stringify({ status: "approved" }),
      },
    );
    expect((await handleApiRequest(approvePlayerReq))?.status).toBe(200);
    await expect(
      prisma.notification.findFirst({
        where: { type: "player.reviewed", resourceId: playerPayload.player.id, channel: "IN_APP" },
      }),
    ).resolves.not.toBeNull();

    const awayTeam = await prisma.team.create({
      data: {
        tournamentId: tournamentPayload.tournament.id,
        organizationId: organizationPayload.organization.id,
        name: "Interswitch QA",
        shortName: "ISQ",
        company: "Interswitch",
        status: "APPROVED",
      },
    });

    const fixtureReq = new Request("http://localhost:8080/api/fixtures", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(adminCookies),
      },
      body: JSON.stringify({
        tournamentId: tournamentPayload.tournament.id,
        homeTeamId: teamPayload.team.id,
        awayTeamId: awayTeam.id,
        matchday: 1,
        date: "2026-09-10",
        time: "10:00",
        venue: "Jabi Turf",
      }),
    });

    const fixtureRes = await handleApiRequest(fixtureReq);
    expect(fixtureRes?.status).toBe(201);
    const fixturePayload = (await fixtureRes?.json()) as { fixture: { id: string } };

    const resultReq = new Request(
      `http://localhost:8080/api/matches/${fixturePayload.fixture.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(adminCookies),
        },
        body: JSON.stringify({
          homeScore: 2,
          awayScore: 1,
          events: [
            {
              type: "goal",
              minute: 12,
              teamId: teamPayload.team.id,
              playerId: playerPayload.player.id,
            },
            {
              type: "assist",
              minute: 12,
              teamId: teamPayload.team.id,
              playerId: playerPayload.player.id,
            },
            {
              type: "goal",
              minute: 40,
              teamId: teamPayload.team.id,
              playerId: playerPayload.player.id,
            },
            { type: "goal", minute: 55, teamId: awayTeam.id },
            {
              type: "yellow-card",
              minute: 67,
              teamId: teamPayload.team.id,
              playerId: playerPayload.player.id,
            },
          ],
        }),
      },
    );

    const resultRes = await handleApiRequest(resultReq);
    expect(resultRes?.status).toBe(200);

    const standingsReq = new Request(
      `http://localhost:8080/api/standings?tournamentId=${encodeURIComponent(tournamentPayload.tournament.id)}`,
      {
        method: "GET",
      },
    );

    const standingsRes = await handleApiRequest(standingsReq);
    expect(standingsRes?.status).toBe(200);
    const standingsPayload = (await standingsRes?.json()) as {
      standings: Array<{ teamId: string; points: number }>;
    };
    expect(standingsPayload.standings.length).toBeGreaterThan(0);
    expect(standingsPayload.standings[0]?.teamId).toBe(teamPayload.team.id);
    expect(standingsPayload.standings[0]?.points).toBe(3);
  });

  it("notifies the city audience on registration status changes and fixture publication", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const admin = await prisma.user.create({
      data: {
        name: "Ops Admin",
        email: "phase2-ops-admin@devkics.test",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: admin.id, role: Role.ADMIN, cityId: city.id, countryCode: "NG" },
    });
    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: admin.email, password: "devkics123" }),
      }),
    );
    const cookie = toCookieHeader(collectSetCookies(login as Response));

    const createTournamentRes = await handleApiRequest(
      new Request("http://localhost:8080/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          citySlug: "abuja",
          name: "Ops Cup",
          slug: "ops-cup-2026",
          season: "Season 1",
          format: "League",
          venue: "Jabi Turf",
          summary: "Notification lifecycle coverage",
          startDate: "2026-09-01",
          endDate: "2026-10-01",
        }),
      }),
    );
    expect(createTournamentRes?.status).toBe(201);
    const { tournament } = (await createTournamentRes?.json()) as { tournament: { id: string } };

    const openRegistration = await handleApiRequest(
      new Request(`http://localhost:8080/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ status: "registration-open" }),
      }),
    );
    expect(openRegistration?.status).toBe(200);
    await expect(
      prisma.notification.findFirst({
        where: {
          type: "registration.status",
          resourceId: tournament.id,
          recipientUserId: admin.id,
        },
      }),
    ).resolves.not.toBeNull();

    const closeRegistration = await handleApiRequest(
      new Request(`http://localhost:8080/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ status: "registration-closed" }),
      }),
    );
    expect(closeRegistration?.status).toBe(200);

    const publishFixtures = await handleApiRequest(
      new Request(`http://localhost:8080/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ status: "fixtures-published" }),
      }),
    );
    expect(publishFixtures?.status).toBe(200);
    await expect(
      prisma.notification.findFirst({
        where: { type: "fixtures.published", resourceId: tournament.id, recipientUserId: admin.id },
      }),
    ).resolves.not.toBeNull();
  }, 15_000);

  it("blocks cross-city tournament operations for non-scoped users", async () => {
    const city = await prisma.city.upsert({
      where: { slug: "lagos" },
      update: {
        name: "Lagos",
        country: "Nigeria",
        countryCode: "NG",
        status: "LIVE",
        teams: 0,
        players: 0,
        tagline: "Lagos",
        accentImage: "lagos",
      },
      create: {
        slug: "lagos",
        name: "Lagos",
        country: "Nigeria",
        countryCode: "NG",
        status: "LIVE",
        teams: 0,
        players: 0,
        tagline: "Lagos",
        accentImage: "lagos",
      },
    });

    const organizer = await prisma.user.create({
      data: {
        name: "Organizer",
        email: "scoped-organizer@devkics.com",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: organizer.id,
        role: Role.ORGANIZER,
        cityId: (await prisma.city.findUnique({ where: { slug: "abuja" } }))?.id ?? null,
        countryCode: "NG",
      },
    });

    const loginReq = new Request("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: organizer.email, password: "devkics123" }),
    });
    const loginRes = await handleApiRequest(loginReq);
    const cookies = collectSetCookies(loginRes as Response);

    const forbiddenTournamentReq = new Request("http://localhost:8080/api/tournaments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(cookies),
      },
      body: JSON.stringify({
        citySlug: city.slug,
        name: "Lagos Cup",
        slug: "lagos-cup",
        season: "Season 1",
        format: "Group",
        venue: "Yaba Turf",
        summary: "Forbidden scope",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      }),
    });

    const forbiddenRes = await handleApiRequest(forbiddenTournamentReq);
    expect(forbiddenRes?.status).toBe(403);
  });
});

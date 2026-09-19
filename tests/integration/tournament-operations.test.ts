import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Role, TournamentStatus } from "@prisma/client";

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
    await expect(
      prisma.auditLog.findFirst({
        where: { action: "tournament.created", resourceId: tournamentPayload.tournament.id },
      }),
    ).resolves.toMatchObject({
      actorId: admin.id,
      cityId: city?.id,
      newValue: { name: "Abuja Cup", season: "Season 1", status: "DRAFT" },
    });

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
    const resultAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "match.result.recorded", resourceId: fixturePayload.fixture.id },
      orderBy: { createdAt: "desc" },
    });
    expect(resultAudit.oldValue).toEqual({ match: null });
    expect(resultAudit.newValue).toMatchObject({ homeScore: 2, awayScore: 1 });

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

  it("sanitizes reviewNotes for public callers while exposing them to organizers and managers", async () => {
    // 1. Fetch teams unauthenticated (public)
    const publicTeamsReq = new Request("http://localhost:8080/api/teams");
    const publicTeamsRes = await handleApiRequest(publicTeamsReq);
    expect(publicTeamsRes?.status).toBe(200);
    const publicTeamsPayload = (await publicTeamsRes?.json()) as {
      ok: boolean;
      teams: Array<{ id: string; reviewNotes: string | null }>;
    };
    expect(publicTeamsPayload.ok).toBe(true);
    for (const team of publicTeamsPayload.teams) {
      expect(team.reviewNotes).toBeNull();
    }

    // 2. Sign in as admin to verify internal access
    const adminLoginReq = new Request("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "phase2-admin@devkics.com", password: "devkics123" }),
    });
    const adminLoginRes = await handleApiRequest(adminLoginReq);
    const adminCookies = collectSetCookies(adminLoginRes as Response);

    const adminTeamsReq = new Request("http://localhost:8080/api/teams", {
      headers: { cookie: toCookieHeader(adminCookies) },
    });
    const adminTeamsRes = await handleApiRequest(adminTeamsReq);
    expect(adminTeamsRes?.status).toBe(200);
    const adminTeamsPayload = (await adminTeamsRes?.json()) as {
      ok: boolean;
      teams: Array<{ id: string; reviewNotes: string | null }>;
    };
    expect(adminTeamsPayload.ok).toBe(true);
    expect(Array.isArray(adminTeamsPayload.teams)).toBe(true);
  });

  it("exposes squadLockedAt across GET /api/teams and updates it when locking team", async () => {
    const stamp = Date.now().toString().slice(-6);
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const tournament = await prisma.tournament.create({
      data: {
        cityId: city.id,
        name: `Lock Tourn ${stamp}`,
        slug: `lock-tourn-${stamp}`,
        status: TournamentStatus.REGISTRATION_OPEN,
        season: "2026",
        format: "Group + Knockout",
        venue: "Jabi Turf",
        summary: "Lock test tournament summary",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      },
    });
    const organization = await prisma.organization.create({
      data: {
        cityId: city.id,
        name: `Lock Org ${stamp}`,
        slug: `lock-org-${stamp}`,
        email: `lock-org-${stamp}@devkics.test`,
        description: "Lock org description",
        status: "APPROVED",
      },
    });
    const admin = await prisma.user.create({
      data: {
        name: "Admin Lock",
        email: `admin-lock-${stamp}@devkics.com`,
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: admin.id,
        role: Role.ADMIN,
        cityId: city.id,
        countryCode: "NG",
      },
    });
    const targetTeam = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        organizationId: organization.id,
        name: `Lock FC ${stamp}`,
        shortName: `LFC${stamp.slice(0, 3)}`,
        company: "Lock Corp",
        status: "APPROVED",
      },
    });

    // 1. Check that GET /api/teams returns squadLockedAt for all teams (null or ISO string)
    const listRes = await handleApiRequest(new Request("http://localhost:8080/api/teams"));
    expect(listRes?.status).toBe(200);
    const listPayload = (await listRes?.json()) as {
      ok: boolean;
      teams: Array<{ id: string; squadLockedAt?: string | null }>;
    };
    expect(listPayload.ok).toBe(true);
    expect(listPayload.teams.length).toBeGreaterThan(0);
    const createdTeamInList = listPayload.teams.find((t) => t.id === targetTeam.id);
    expect(createdTeamInList).toBeDefined();
    expect("squadLockedAt" in (createdTeamInList ?? {})).toBe(true);
    expect(createdTeamInList?.squadLockedAt).toBeNull();

    // 2. Lock a team via PATCH /api/teams/:id and verify squadLockedAt is set in the response
    const adminLoginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: admin.email, password: "devkics123" }),
      }),
    );
    const adminCookies = collectSetCookies(adminLoginRes as Response);

    const lockRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/teams/${targetTeam.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(adminCookies),
        },
        body: JSON.stringify({ status: "locked" }),
      }),
    );
    expect(lockRes?.status).toBe(200);
    const lockPayload = (await lockRes?.json()) as {
      ok: boolean;
      team: { id: string; status: string; squadLockedAt: string | null };
    };
    expect(lockPayload.ok).toBe(true);
    expect(lockPayload.team.status).toBe("locked");
    expect(lockPayload.team.squadLockedAt).not.toBeNull();
    expect(typeof lockPayload.team.squadLockedAt).toBe("string");

    // 3. Verify GET /api/teams now returns the squadLockedAt ISO string for the locked team
    const updatedListRes = await handleApiRequest(new Request("http://localhost:8080/api/teams"));
    const updatedListPayload = (await updatedListRes?.json()) as {
      ok: boolean;
      teams: Array<{ id: string; squadLockedAt: string | null }>;
    };
    const lockedTeamInList = updatedListPayload.teams.find((t) => t.id === targetTeam.id);
    expect(lockedTeamInList?.squadLockedAt).toBe(lockPayload.team.squadLockedAt);
  });
});

describe("Organizer-scoped tournament create and status lifecycle", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.organizerApplication.deleteMany();
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tournament.deleteMany();
    await prisma.city.deleteMany();

    await prisma.city.createMany({
      data: [
        {
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
        {
          slug: "lagos",
          name: "Lagos",
          country: "Nigeria",
          countryCode: "NG",
          status: "LIVE",
          teams: 8,
          players: 96,
          tagline: "Lagos chapter",
          accentImage: "lagos",
        },
      ],
    });
  });

  async function seedOrganizerForCity(citySlug: string) {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: citySlug } });
    const passwordHash = await hashPassword("OrgSecret123!");
    const user = await prisma.user.create({
      data: { email: `org-${citySlug}@devkics.test`, passwordHash, name: "Organizer" },
    });
    await prisma.roleAssignment.create({
      data: { userId: user.id, role: Role.ORGANIZER, cityId: city.id, countryCode: "NG" },
    });
    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `org-${citySlug}@devkics.test`, password: "OrgSecret123!" }),
      }),
    );
    expect(loginRes?.status).toBe(200);
    return { user, city, cookies: collectSetCookies(loginRes!) };
  }

  async function seedAdmin() {
    const passwordHash = await hashPassword("AdminSecret123!");
    const user = await prisma.user.create({
      data: { email: "admin@devkics.test", passwordHash, name: "Admin" },
    });
    await prisma.roleAssignment.create({ data: { userId: user.id, role: Role.ADMIN } });
    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@devkics.test", password: "AdminSecret123!" }),
      }),
    );
    expect(loginRes?.status).toBe(200);
    return { user, cookies: collectSetCookies(loginRes!) };
  }

  const tournamentBody = {
    citySlug: "abuja",
    name: "Abuja Cup 2026",
    slug: "abuja-cup-2026",
    season: "2026",
    format: "Round Robin",
    venue: "Jabi Turf",
    summary: "Annual DevKics Abuja tournament.",
    startDate: "2026-10-01",
    endDate: "2026-12-01",
  };

  it("organizer can create a tournament for their own city", async () => {
    const organizer = await seedOrganizerForCity("abuja");

    const res = await handleApiRequest(
      new Request("http://localhost:8080/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: toCookieHeader(organizer.cookies) },
        body: JSON.stringify(tournamentBody),
      }),
    );
    expect(res?.status).toBe(201);

    const body = (await res?.json()) as { ok: boolean; tournament: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.tournament.status).toBe("draft");

    const record = await prisma.tournament.findFirst({ where: { slug: "abuja-cup-2026" } });
    expect(record).not.toBeNull();
    expect(record?.status).toBe(TournamentStatus.DRAFT);
  });

  it("organizer cannot create a tournament for a different city", async () => {
    // Organizer scoped to lagos, attempts to create for abuja
    const organizer = await seedOrganizerForCity("lagos");

    const res = await handleApiRequest(
      new Request("http://localhost:8080/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: toCookieHeader(organizer.cookies) },
        body: JSON.stringify(tournamentBody), // citySlug: abuja
      }),
    );
    expect(res?.status).toBe(403);
  });

  it("organizer can advance tournament status from draft to registration-open", async () => {
    const organizer = await seedOrganizerForCity("abuja");

    // Create tournament first
    const createRes = await handleApiRequest(
      new Request("http://localhost:8080/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: toCookieHeader(organizer.cookies) },
        body: JSON.stringify(tournamentBody),
      }),
    );
    expect(createRes?.status).toBe(201);
    const { tournament } = (await createRes?.json()) as { tournament: { id: string } };

    // Advance to registration-open
    const patchRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: toCookieHeader(organizer.cookies) },
        body: JSON.stringify({ status: "registration-open" }),
      }),
    );
    expect(patchRes?.status).toBe(200);

    const updated = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(updated.status).toBe(TournamentStatus.REGISTRATION_OPEN);
  });

  it("admin can create and advance a tournament in any city", async () => {
    const admin = await seedAdmin();

    const createRes = await handleApiRequest(
      new Request("http://localhost:8080/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: toCookieHeader(admin.cookies) },
        body: JSON.stringify(tournamentBody),
      }),
    );
    expect(createRes?.status).toBe(201);
    const { tournament } = (await createRes?.json()) as { tournament: { id: string } };

    const patchRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: toCookieHeader(admin.cookies) },
        body: JSON.stringify({ status: "registration-open" }),
      }),
    );
    expect(patchRes?.status).toBe(200);

    const updated = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(updated.status).toBe(TournamentStatus.REGISTRATION_OPEN);
  });
});

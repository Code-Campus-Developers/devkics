import { beforeAll, beforeEach, describe, expect, it } from "vitest";

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

describe("Phase 5 — Organizer Approval → Account & Access Lifecycle", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.matchEvent.deleteMany();
    await prisma.match.deleteMany();
    await prisma.fixture.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.tournament.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.organizerApplication.deleteMany();
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.city.deleteMany();

    await prisma.city.create({
      data: {
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

    await prisma.city.create({
      data: {
        slug: "lagos",
        name: "Lagos",
        country: "Nigeria",
        countryCode: "NG",
        status: "LIVE",
        teams: 12,
        players: 144,
        tagline: "Commercial hub",
        accentImage: "lagos",
      },
    });
  });

  async function createAdminUser() {
    const passwordHash = await hashPassword("AdminSecret123!");
    const user = await prisma.user.create({
      data: {
        email: "admin@devkics.test",
        passwordHash,
        name: "Super Admin",
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: "ADMIN",
      },
    });

    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin@devkics.test",
          password: "AdminSecret123!",
        }),
      }),
    );
    expect(loginRes?.status).toBe(200);
    return { user, cookies: collectSetCookies(loginRes!) };
  }

  it("approving an existing user immediately grants RoleAssignment(role: ORGANIZER) and writes audit log", async () => {
    const abuja = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });

    // 1. Existing user registers as player
    const regReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Existing Candidate",
        email: "existing@candidate.test",
        password: "SecretPassword123!",
        role: "player",
        citySlug: "abuja",
      }),
    });
    const regRes = await handleApiRequest(regReq);
    expect(regRes?.status).toBe(201);
    const existingUser = await prisma.user.findUniqueOrThrow({
      where: { email: "existing@candidate.test" },
    });

    // 2. Candidate submits organizer application
    const appReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Existing Candidate",
        email: "existing@candidate.test",
        city: "Abuja",
        detail: "Pitch details for Abuja organizer.",
        agreementAccepted: true,
      }),
    });
    const appRes = await handleApiRequest(appReq);
    expect(appRes?.status).toBe(201);
    const { application } = (await appRes?.json()) as { application: { id: string } };

    // 3. Admin approves application
    const admin = await createAdminUser();
    const approveReq = new Request(`http://localhost:8080/api/applications/${application.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(admin.cookies),
      },
      body: JSON.stringify({
        status: "approved",
        reviewNotes: "Strong background, approved immediately.",
      }),
    });
    const approveRes = await handleApiRequest(approveReq);
    expect(approveRes?.status).toBe(200);

    // 4. Verify role assignment was created for the existing user
    const assignments = await prisma.roleAssignment.findMany({
      where: { userId: existingUser.id },
    });
    const orgRole = assignments.find((a) => a.role === "ORGANIZER");
    expect(orgRole).toBeDefined();
    expect(orgRole?.cityId).toBe(abuja.id);

    // 5. Verify audit logs
    const roleAudit = await prisma.auditLog.findFirst({
      where: {
        action: "role-assignment.created",
        resourceType: "role-assignment",
        resourceId: orgRole!.id,
      },
    });
    expect(roleAudit).toBeDefined();
    expect(roleAudit?.actorId).toBe(admin.user.id);
    expect((roleAudit?.newValue as Record<string, unknown> | null)?.["role"]).toBe("ORGANIZER");

    // 6. Verify notification dispatched
    const notification = await prisma.notification.findFirst({
      where: {
        recipientEmail: "existing@candidate.test",
        type: "organizer.application.approved",
      },
    });
    expect(notification).toBeDefined();
    expect(notification?.title).toContain("Approved");

    // 7. Verify user session now resolves to activeRole "organizer"
    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "existing@candidate.test",
          password: "SecretPassword123!",
        }),
      }),
    );
    expect(loginRes?.status).toBe(200);
    const loginData = (await loginRes?.json()) as {
      user: { role: string; activeRole: string; roles: Array<{ role: string }> };
    };
    expect(loginData.user.role).toBe("organizer");
    expect(loginData.user.activeRole).toBe("organizer");
    expect(loginData.user.roles.some((r) => r.role === "organizer")).toBe(true);
  });

  it("registering after application approval claims the organizer role automatically", async () => {
    const abuja = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });

    // 1. Candidate submits application prior to creating an account
    const appReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Future Organizer",
        email: "future@lead.test",
        city: "Abuja",
        detail: "Proposal before registration.",
        agreementAccepted: true,
      }),
    });
    const appRes = await handleApiRequest(appReq);
    expect(appRes?.status).toBe(201);
    const { application } = (await appRes?.json()) as { application: { id: string } };

    // 2. Admin approves application
    const admin = await createAdminUser();
    const approveReq = new Request(`http://localhost:8080/api/applications/${application.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(admin.cookies),
      },
      body: JSON.stringify({
        status: "approved",
        reviewNotes: "Pre-approved candidate.",
      }),
    });
    const approveRes = await handleApiRequest(approveReq);
    expect(approveRes?.status).toBe(200);

    // 3. User registers account with matching email
    const regReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Future Organizer",
        email: "future@lead.test",
        password: "NewPassword123!",
        role: "player",
      }),
    });
    const regRes = await handleApiRequest(regReq);
    expect(regRes?.status).toBe(201);
    const regData = (await regRes?.json()) as {
      user: { id: string; role: string; activeRole: string; citySlug: string | null };
    };

    // 4. Verify organizer role was claimed and set as active role
    expect(regData.user.role).toBe("organizer");
    expect(regData.user.activeRole).toBe("organizer");
    expect(regData.user.citySlug).toBe("abuja");

    // 5. Verify application is linked to user
    const updatedApp = await prisma.organizerApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(updatedApp.applicantUserId).toBe(regData.user.id);
    expect(updatedApp.cityId).toBe(abuja.id);

    // 6. Verify role assignment exists in DB
    const assignments = await prisma.roleAssignment.findMany({
      where: { userId: regData.user.id },
    });
    const orgRole = assignments.find((a) => a.role === "ORGANIZER");
    expect(orgRole).toBeDefined();
    expect(orgRole?.cityId).toBe(abuja.id);

    // 7. Verify claim audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "role-assignment.created",
        resourceType: "role-assignment",
        resourceId: orgRole!.id,
      },
    });
    expect(audit).toBeDefined();
  });

  it("unapproved applicants are forbidden from accessing organizer endpoints", async () => {
    // 1. User registers as player
    const regReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Pending Applicant",
        email: "pending@lead.test",
        password: "UserPassword123!",
        role: "player",
        citySlug: "abuja",
      }),
    });
    const regRes = await handleApiRequest(regReq);
    expect(regRes?.status).toBe(201);
    const cookies = collectSetCookies(regRes!);

    // 2. Submits application (status remains SUBMITTED)
    await handleApiRequest(
      new Request("http://localhost:8080/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "city-organizer",
          name: "Pending Applicant",
          email: "pending@lead.test",
          city: "Abuja",
          detail: "Proposal under review.",
          agreementAccepted: true,
        }),
      }),
    );

    // 3. Tries to create tournament (requires organizer permissions for city)
    const tourneyReq = new Request("http://localhost:8080/api/tournaments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(cookies),
      },
      body: JSON.stringify({
        citySlug: "abuja",
        name: "Unauthorized Cup",
        slug: "unauthorized-cup",
        season: "2026",
        format: "group-knockout",
        venue: "Secret Ground",
        summary: "Not allowed",
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-10-10T00:00:00.000Z",
      }),
    });
    const tourneyRes = await handleApiRequest(tourneyReq);
    expect(tourneyRes?.status).toBe(403);
  });

  it("city-scoped organizer permissions are strictly enforced between cities", async () => {
    const abuja = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const lagos = await prisma.city.findUniqueOrThrow({ where: { slug: "lagos" } });

    // 1. Approved organizer for Abuja
    const appReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Abuja Lead",
        email: "abujalead@city.test",
        city: "Abuja",
        detail: "Abuja chapter lead proposal.",
        agreementAccepted: true,
      }),
    });
    const appRes = await handleApiRequest(appReq);
    const { application } = (await appRes?.json()) as { application: { id: string } };

    const admin = await createAdminUser();
    await handleApiRequest(
      new Request(`http://localhost:8080/api/applications/${application.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(admin.cookies),
        },
        body: JSON.stringify({ status: "approved" }),
      }),
    );

    const regReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Abuja Lead",
        email: "abujalead@city.test",
        password: "LeadPassword123!",
        role: "player",
      }),
    });
    const regRes = await handleApiRequest(regReq);
    expect(regRes?.status).toBe(201);
    const cookies = collectSetCookies(regRes!);

    // 2. Abuja organizer attempts to create tournament in Lagos -> 403 Forbidden
    const crossReq = new Request("http://localhost:8080/api/tournaments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(cookies),
      },
      body: JSON.stringify({
        citySlug: "lagos",
        name: "Lagos Hack & Kick",
        slug: "lagos-hack-kick",
        season: "2026",
        format: "group-knockout",
        venue: "TBD",
        summary: "Cross-city attempt",
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-10-10T00:00:00.000Z",
      }),
    });
    const crossRes = await handleApiRequest(crossReq);
    expect(crossRes?.status).toBe(403);

    // 3. Abuja organizer creates tournament in Abuja -> 201 Created
    const validReq = new Request("http://localhost:8080/api/tournaments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(cookies),
      },
      body: JSON.stringify({
        citySlug: "abuja",
        name: "Abuja Tech Cup 2026",
        slug: "abuja-tech-cup-2026",
        season: "2026",
        format: "group-knockout",
        venue: "National Stadium Turf",
        summary: "Premier tech tournament",
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-10-10T00:00:00.000Z",
      }),
    });
    const validRes = await handleApiRequest(validReq);
    expect(validRes?.status).toBe(201);
    const validData = (await validRes?.json()) as { tournament: { cityId: string; name: string } };
    expect(validData.tournament.cityId).toBe(abuja.id);
    expect(validData.tournament.name).toBe("Abuja Tech Cup 2026");
  });
});

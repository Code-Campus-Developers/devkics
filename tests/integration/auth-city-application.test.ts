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

describe("Phase 1 API integration", () => {
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

  it("registers, authenticates, and returns current user", async () => {
    const registerReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@devkics.com",
        password: "secret123",
        role: "manager",
        citySlug: "abuja",
      }),
    });

    const registerRes = await handleApiRequest(registerReq);
    expect(registerRes).not.toBeNull();
    expect(registerRes?.status).toBe(201);

    const cookies = collectSetCookies(registerRes as Response);
    expect(cookies.length).toBeGreaterThan(0);

    const meReq = new Request("http://localhost:8080/api/auth/me", {
      method: "GET",
      headers: { cookie: toCookieHeader(cookies) },
    });
    const meRes = await handleApiRequest(meReq);
    expect(meRes?.status).toBe(200);
    const meJson = (await meRes?.json()) as { ok: boolean; user: { email: string } | null };
    expect(meJson.ok).toBe(true);
    expect(meJson.user?.email).toBe("test@devkics.com");
  });

  it("allows admin to update city status", async () => {
    const city = await prisma.city.findUnique({ where: { slug: "abuja" } });
    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@devkics.com",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: admin.id,
        role: "ADMIN",
        cityId: city?.id ?? null,
        countryCode: city?.countryCode ?? null,
      },
    });

    const loginAdminReq = new Request("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@devkics.com",
        password: "devkics123",
      }),
    });
    const adminRes = await handleApiRequest(loginAdminReq);
    const adminCookies = collectSetCookies(adminRes as Response);

    const patchReq = new Request("http://localhost:8080/api/cities/abuja", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(adminCookies),
      },
      body: JSON.stringify({ status: "applications-open" }),
    });

    const patchRes = await handleApiRequest(patchReq);
    expect(patchRes?.status).toBe(200);
    const payload = (await patchRes?.json()) as { city: { status: string } };
    expect(payload.city.status).toBe("applications-open");
  });

  it("creates and reviews organizer applications", async () => {
    const submitReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "City Lead",
        email: "lead@example.com",
        city: "Lagos",
        detail: "We can run this chapter with a strong organizer team and confirmed venues.",
      }),
    });

    const submitRes = await handleApiRequest(submitReq);
    expect(submitRes?.status).toBe(201);
    const submitPayload = (await submitRes?.json()) as { application: { id: string } };

    const city = await prisma.city.findUnique({ where: { slug: "abuja" } });
    const admin = await prisma.user.create({
      data: {
        name: "Admin 2",
        email: "admin2@devkics.com",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: admin.id,
        role: "ADMIN",
        cityId: city?.id ?? null,
        countryCode: city?.countryCode ?? null,
      },
    });

    const adminLoginReq = new Request("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin2@devkics.com",
        password: "devkics123",
      }),
    });
    const adminRegisterRes = await handleApiRequest(adminLoginReq);
    const adminCookies = collectSetCookies(adminRegisterRes as Response);

    const reviewReq = new Request(
      `http://localhost:8080/api/applications/${submitPayload.application.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(adminCookies),
        },
        body: JSON.stringify({ status: "approved", reviewNotes: "Looks good" }),
      },
    );

    const reviewRes = await handleApiRequest(reviewReq);
    expect(reviewRes?.status).toBe(200);
    const reviewPayload = (await reviewRes?.json()) as { application: { status: string } };
    expect(reviewPayload.application.status).toBe("approved");
  });

  it("rejects privileged self-registration and blocks non-admin city updates", async () => {
    const registerAdminReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Unauthorized Admin",
        email: "unauthorized-admin@devkics.com",
        password: "devkics123",
        role: "admin",
        citySlug: "abuja",
      }),
    });

    const registerAdminRes = await handleApiRequest(registerAdminReq);
    expect(registerAdminRes?.status).toBe(400);

    const managerRegisterReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Manager",
        email: "manager-denied@devkics.com",
        password: "devkics123",
        role: "manager",
        citySlug: "abuja",
      }),
    });

    const managerRegisterRes = await handleApiRequest(managerRegisterReq);
    const managerCookies = collectSetCookies(managerRegisterRes as Response);

    const patchReq = new Request("http://localhost:8080/api/cities/abuja", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(managerCookies),
      },
      body: JSON.stringify({ status: "archived" }),
    });

    const patchRes = await handleApiRequest(patchReq);
    expect(patchRes?.status).toBe(403);
  });

  it("enforces auth rate limit on repeated login attempts", async () => {
    await prisma.user.create({
      data: {
        name: "Rate Limit User",
        email: "rate-limit@devkics.com",
        passwordHash: await hashPassword("devkics123"),
      },
    });

    let status = 0;
    for (let i = 0; i < 13; i += 1) {
      const loginReq = new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.10" },
        body: JSON.stringify({ email: "rate-limit@devkics.com", password: "wrong-password" }),
      });
      const res = await handleApiRequest(loginReq);
      status = res?.status ?? 0;
      if (status === 429) break;
    }

    expect(status).toBe(429);
  });
});

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handleApiRequest } from "@/lib/server/api";
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
    await prisma.auditLog.deleteMany();
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
    const registerAdminReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Admin",
        email: "admin@devkics.com",
        password: "devkics123",
        role: "admin",
        citySlug: "abuja",
      }),
    });
    const adminRes = await handleApiRequest(registerAdminReq);
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

    const adminRegisterReq = new Request("http://localhost:8080/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Admin 2",
        email: "admin2@devkics.com",
        password: "devkics123",
        role: "admin",
        citySlug: "abuja",
      }),
    });
    const adminRegisterRes = await handleApiRequest(adminRegisterReq);
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
});

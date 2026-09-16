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

describe("Phase 1 — Submission Protection & Idempotency Integration Tests", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.organization.deleteMany();
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

  it("rejects duplicate organizer applications for the same email and city with 409 Conflict", async () => {
    const firstReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Amara Okeke",
        email: "amara@example.com",
        city: "Abuja",
        detail: "Experienced tournament lead ready to launch Season 1.",
        agreementAccepted: true,
      }),
    });

    const firstRes = await handleApiRequest(firstReq);
    expect(firstRes?.status).toBe(201);
    const firstPayload = (await firstRes?.json()) as { ok: boolean; application: { id: string } };
    expect(firstPayload.ok).toBe(true);
    expect(firstPayload.application.id).toBeDefined();

    // Second submission with same email and city while previous is still pending
    const duplicateReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Amara Okeke",
        email: "AMARA@example.com", // case-insensitive check
        city: "Abuja",
        detail: "Duplicate submission attempt.",
        agreementAccepted: true,
      }),
    });

    const duplicateRes = await handleApiRequest(duplicateReq);
    expect(duplicateRes?.status).toBe(409);
    const duplicatePayload = (await duplicateRes?.json()) as { ok: boolean; error: string };
    expect(duplicatePayload.ok).toBe(false);
    expect(duplicatePayload.error).toContain("already pending review");

    // Only 1 record exists in DB
    const count = await prisma.organizerApplication.count({
      where: { email: "amara@example.com" },
    });
    expect(count).toBe(1);
  });

  it("rejects duplicate organization registrations with 409 Conflict", async () => {
    const manager = await prisma.user.create({
      data: {
        name: "Team Manager",
        email: "manager@company.test",
        passwordHash: await hashPassword("secure123"),
        citySlug: "abuja",
      },
    });

    const loginReq = new Request("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "manager@company.test",
        password: "secure123",
      }),
    });
    const loginRes = await handleApiRequest(loginReq);
    const cookies = collectSetCookies(loginRes as Response);

    const firstOrgReq = new Request("http://localhost:8080/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(cookies),
      },
      body: JSON.stringify({
        citySlug: "abuja",
        name: "Paystack Nigeria",
        email: "sports@paystack.com",
        description: "Payment infrastructure team.",
      }),
    });

    const firstOrgRes = await handleApiRequest(firstOrgReq);
    expect(firstOrgRes?.status).toBe(201);
    const firstOrgPayload = (await firstOrgRes?.json()) as {
      ok: boolean;
      organization: { id: string };
    };
    expect(firstOrgPayload.ok).toBe(true);

    // Duplicate submission: same user submitting another org while one is pending
    const duplicateUserOrgReq = new Request("http://localhost:8080/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(cookies),
      },
      body: JSON.stringify({
        citySlug: "abuja",
        name: "Paystack Second Entry",
        email: "sports2@paystack.com",
        description: "Second squad attempt.",
      }),
    });

    const duplicateUserRes = await handleApiRequest(duplicateUserOrgReq);
    expect(duplicateUserRes?.status).toBe(409);
    const duplicateUserPayload = (await duplicateUserRes?.json()) as { ok: boolean; error: string };
    expect(duplicateUserPayload.ok).toBe(false);
    expect(duplicateUserPayload.error).toContain("already have an organization");

    // Another manager attempting to use the identical slug/name in the same city
    const manager2 = await prisma.user.create({
      data: {
        name: "Second Manager",
        email: "manager2@company.test",
        passwordHash: await hashPassword("secure123"),
        citySlug: "abuja",
      },
    });

    const loginReq2 = new Request("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "manager2@company.test",
        password: "secure123",
      }),
    });
    const loginRes2 = await handleApiRequest(loginReq2);
    const cookies2 = collectSetCookies(loginRes2 as Response);

    const duplicateSlugReq = new Request("http://localhost:8080/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(cookies2),
      },
      body: JSON.stringify({
        citySlug: "abuja",
        name: "Paystack Nigeria", // Collides with existing slug
        email: "sports-alternate@paystack.com",
        description: "Colliding team name.",
      }),
    });

    const duplicateSlugRes = await handleApiRequest(duplicateSlugReq);
    expect(duplicateSlugRes?.status).toBe(409);
    const duplicateSlugPayload = (await duplicateSlugRes?.json()) as { ok: boolean; error: string };
    expect(duplicateSlugPayload.ok).toBe(false);
    expect(duplicateSlugPayload.error).toContain("already exists in this city");
  });
});

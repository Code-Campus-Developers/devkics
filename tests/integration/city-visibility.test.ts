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

describe("Phase 2 — City Visibility & Status Management", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.organizerApplication.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.city.deleteMany();

    // Seed cities with all five status variants
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
          status: "APPLICATIONS_OPEN",
          teams: 0,
          players: 0,
          tagline: "Coming next",
          accentImage: "lagos",
        },
        {
          slug: "kigali",
          name: "Kigali",
          country: "Rwanda",
          countryCode: "RW",
          status: "COMING_SOON",
          teams: 0,
          players: 0,
          tagline: "On the way",
          accentImage: "kigali",
        },
        {
          slug: "nairobi",
          name: "Nairobi",
          country: "Kenya",
          countryCode: "KE",
          status: "SUSPENDED",
          teams: 0,
          players: 0,
          tagline: "Paused",
          accentImage: "nairobi",
        },
        {
          slug: "accra",
          name: "Accra",
          country: "Ghana",
          countryCode: "GH",
          status: "ARCHIVED",
          teams: 0,
          players: 0,
          tagline: "Archived",
          accentImage: "accra",
        },
      ],
    });
  });

  it("public GET /api/cities returns only LIVE cities without auth", async () => {
    const req = new Request("http://localhost:8080/api/cities", { method: "GET" });
    const res = await handleApiRequest(req);
    expect(res?.status).toBe(200);
    const payload = (await res?.json()) as {
      ok: boolean;
      cities: { slug: string; status: string }[];
    };
    expect(payload.ok).toBe(true);
    expect(payload.cities.length).toBe(1);
    expect(payload.cities[0]!.slug).toBe("abuja");
    expect(payload.cities[0]!.status).toBe("live");
  });

  it("public GET /api/cities?includeAll=true still returns only LIVE cities (security: param ignored for non-admin)", async () => {
    const req = new Request("http://localhost:8080/api/cities?includeAll=true", { method: "GET" });
    const res = await handleApiRequest(req);
    expect(res?.status).toBe(200);
    const payload = (await res?.json()) as { ok: boolean; cities: { slug: string }[] };
    expect(payload.ok).toBe(true);
    // Must still only return LIVE cities
    expect(payload.cities.length).toBe(1);
    expect(payload.cities[0]!.slug).toBe("abuja");
  });

  it("admin GET /api/cities receives all cities across all statuses", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@devkics.com",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });

    const city = await prisma.city.findUnique({ where: { slug: "abuja" } });
    await prisma.roleAssignment.create({
      data: {
        userId: admin.id,
        role: "ADMIN",
        cityId: city?.id ?? null,
        countryCode: city?.countryCode ?? null,
      },
    });

    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@devkics.com", password: "devkics123" }),
      }),
    );
    const cookies = collectSetCookies(loginRes as Response);

    const req = new Request("http://localhost:8080/api/cities", {
      method: "GET",
      headers: { cookie: toCookieHeader(cookies) },
    });
    const res = await handleApiRequest(req);
    expect(res?.status).toBe(200);
    const payload = (await res?.json()) as {
      ok: boolean;
      cities: { slug: string; status: string }[];
    };
    expect(payload.ok).toBe(true);
    // Admin must receive all 5 cities
    expect(payload.cities.length).toBe(5);
    const slugs = payload.cities.map((c) => c.slug).sort();
    expect(slugs).toEqual(["abuja", "accra", "kigali", "lagos", "nairobi"]);
  });

  it("admin PATCH /api/cities/:slug updates city status with audit log", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@devkics.com",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });
    const city = await prisma.city.findUnique({ where: { slug: "lagos" } });
    await prisma.roleAssignment.create({
      data: {
        userId: admin.id,
        role: "ADMIN",
        cityId: city?.id ?? null,
        countryCode: city?.countryCode ?? null,
      },
    });

    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@devkics.com", password: "devkics123" }),
      }),
    );
    const cookies = collectSetCookies(loginRes as Response);

    const patchRes = await handleApiRequest(
      new Request("http://localhost:8080/api/cities/lagos", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: toCookieHeader(cookies) },
        body: JSON.stringify({ status: "suspended" }),
      }),
    );
    expect(patchRes?.status).toBe(200);
    const payload = (await patchRes?.json()) as { ok: boolean; city: { status: string } };
    expect(payload.ok).toBe(true);
    expect(payload.city.status).toBe("suspended");

    // Verify DB and audit log
    const updated = await prisma.city.findUnique({ where: { slug: "lagos" } });
    expect(updated?.status).toBe("SUSPENDED");

    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "city.status.updated", actorId: admin.id },
    });
    expect(auditLog).not.toBeNull();
    expect((auditLog?.newValue as { status: string }).status).toBe("SUSPENDED");
  });

  it("non-admin PATCH /api/cities/:slug is forbidden with 403", async () => {
    const manager = await prisma.user.create({
      data: {
        name: "Team Manager",
        email: "manager@devkics.com",
        passwordHash: await hashPassword("devkics123"),
        citySlug: "abuja",
      },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: manager.id,
        role: "MANAGER",
        cityId: null,
        countryCode: null,
      },
    });

    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "manager@devkics.com", password: "devkics123" }),
      }),
    );
    const cookies = collectSetCookies(loginRes as Response);

    const patchRes = await handleApiRequest(
      new Request("http://localhost:8080/api/cities/abuja", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: toCookieHeader(cookies) },
        body: JSON.stringify({ status: "suspended" }),
      }),
    );
    expect(patchRes?.status).toBe(403);
    const payload = (await patchRes?.json()) as { ok: boolean; error: string };
    expect(payload.ok).toBe(false);

    // City status must remain unchanged
    const unchanged = await prisma.city.findUnique({ where: { slug: "abuja" } });
    expect(unchanged?.status).toBe("LIVE");
  });

  it("unauthenticated PATCH /api/cities/:slug is rejected with 401", async () => {
    const patchRes = await handleApiRequest(
      new Request("http://localhost:8080/api/cities/abuja", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "suspended" }),
      }),
    );
    expect(patchRes?.status).toBe(401);
  });
});

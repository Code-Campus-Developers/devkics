import { CityStatus } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";

import { handleApiRequest } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";

const DEFAULT_ENV = {
  DATABASE_URL: "postgresql://abrahamogbu@localhost:5432/devkics?schema=public",
  JWT_ACCESS_SECRET: "test-access-secret-1234567890",
  JWT_REFRESH_SECRET: "test-refresh-secret-1234567890",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "7d",
};

async function executeRequest(input: string, init?: RequestInit): Promise<Response> {
  const response = await handleApiRequest(new Request(input, init));
  if (!response) {
    throw new Error(`handleApiRequest returned null for ${input}`);
  }
  return response;
}

describe("SEO & Caching Integration Tests", () => {
  beforeAll(async () => {
    Object.assign(process.env, DEFAULT_ENV);
    const existing = await prisma.city.findUnique({ where: { slug: "abuja" } });
    if (!existing) {
      await prisma.city.create({
        data: {
          slug: "abuja",
          name: "Abuja",
          country: "Nigeria",
          countryCode: "NG",
          status: CityStatus.LIVE,
          tagline: "Pilot city",
          accentImage: "abuja",
        },
      });
    }
  });

  it("serves sitemap.xml with XML content type and cache headers", async () => {
    const response = await executeRequest("http://localhost:3000/sitemap.xml", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );

    const body = await response.text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain("<urlset");
    expect(body).toContain("https://devkics.org/");
    expect(body).toContain("https://devkics.org/abuja");
  });

  it("serves robots.txt with text content type and references sitemap", async () => {
    const response = await executeRequest("http://localhost:3000/robots.txt", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );

    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: https://devkics.org/sitemap.xml");
  });

  it("serves read-only public endpoints with sensible caching headers", async () => {
    const citiesResponse = await executeRequest("http://localhost:3000/api/cities", {
      method: "GET",
    });
    expect(citiesResponse.status).toBe(200);
    expect(citiesResponse.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=120",
    );

    const tournamentsResponse = await executeRequest(
      "http://localhost:3000/api/tournaments?citySlug=abuja",
      { method: "GET" },
    );
    expect(tournamentsResponse.status).toBe(200);
    expect(tournamentsResponse.headers.get("cache-control")).toBe(
      "public, max-age=30, stale-while-revalidate=60",
    );
  });

  it("serves sensitive/authenticated endpoints with no-store cache headers", async () => {
    const authMeResponse = await executeRequest("http://localhost:3000/api/auth/me", {
      method: "GET",
    });
    expect(authMeResponse.headers.get("cache-control")).toBe(
      "no-store, no-cache, must-revalidate, private",
    );
  });

  it("serves /api/health with database connectivity status", async () => {
    const healthResponse = await executeRequest("http://localhost:3000/api/health", {
      method: "GET",
    });
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers.get("content-type")).toContain("application/json");
    const json = (await healthResponse.json()) as {
      ok: boolean;
      status: string;
      database: string;
      timestamp: string;
    };
    expect(json.ok).toBe(true);
    expect(json.status).toBe("healthy");
    expect(json.database).toBe("connected");
    expect(json.timestamp).toBeDefined();
  });
});

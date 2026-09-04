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

function toCookieHeader(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

describe("report exports", () => {
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
    await prisma.volunteerCheckIn.deleteMany();
    await prisma.volunteerRequirement.deleteMany();
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
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.city.deleteMany();
  });

  it("exports scoped real data and rejects unauthorized or cross-city report access", async () => {
    const [abuja, lagos] = await Promise.all([
      prisma.city.create({
        data: {
          slug: "abuja",
          name: "Abuja",
          country: "Nigeria",
          countryCode: "NG",
          status: "LIVE",
          tagline: "Abuja",
          accentImage: "abuja",
        },
      }),
      prisma.city.create({
        data: {
          slug: "lagos",
          name: "Lagos",
          country: "Nigeria",
          countryCode: "NG",
          status: "LIVE",
          tagline: "Lagos",
          accentImage: "lagos",
        },
      }),
    ]);
    const organizer = await prisma.user.create({
      data: {
        name: "Abuja Organizer",
        email: "reports-organizer@devkics.test",
        passwordHash: await hashPassword("devkics123"),
        citySlug: abuja.slug,
      },
    });
    await prisma.roleAssignment.create({
      data: { userId: organizer.id, role: Role.ORGANIZER, cityId: abuja.id, countryCode: "NG" },
    });
    const [abujaTournament, lagosTournament] = await Promise.all([
      prisma.tournament.create({
        data: {
          cityId: abuja.id,
          name: "Abuja Cup",
          slug: "abuja-cup",
          season: "2026",
          format: "League",
          venue: "Jabi",
          summary: "Abuja season",
          startDate: new Date("2026-09-01"),
          endDate: new Date("2026-10-01"),
        },
      }),
      prisma.tournament.create({
        data: {
          cityId: lagos.id,
          name: "Lagos Cup",
          slug: "lagos-cup",
          season: "2026",
          format: "League",
          venue: "Lekki",
          summary: "Lagos season",
          startDate: new Date("2026-09-01"),
          endDate: new Date("2026-10-01"),
        },
      }),
    ]);
    const [abujaOrganization, lagosOrganization] = await Promise.all([
      prisma.organization.create({
        data: {
          cityId: abuja.id,
          name: "Abuja Engineers",
          slug: "abuja-engineers",
          email: "abuja@example.test",
          description: "Abuja organization",
          status: "APPROVED",
        },
      }),
      prisma.organization.create({
        data: {
          cityId: lagos.id,
          name: "Lagos Engineers",
          slug: "lagos-engineers",
          email: "lagos@example.test",
          description: "Lagos organization",
          status: "APPROVED",
        },
      }),
    ]);
    await Promise.all([
      prisma.team.create({
        data: {
          tournamentId: abujaTournament.id,
          organizationId: abujaOrganization.id,
          name: "Abuja XI",
          shortName: "ABJ",
          company: "Abuja Engineers",
          status: "APPROVED",
        },
      }),
      prisma.team.create({
        data: {
          tournamentId: lagosTournament.id,
          organizationId: lagosOrganization.id,
          name: "Lagos XI",
          shortName: "LAG",
          company: "Lagos Engineers",
          status: "APPROVED",
        },
      }),
    ]);

    const unauthenticated = await handleApiRequest(
      new Request("http://localhost:8080/api/reports/export?type=teams&format=csv"),
    );
    expect(unauthenticated?.status).toBe(401);

    const login = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: organizer.email, password: "devkics123" }),
      }),
    );
    const cookie = toCookieHeader(login as Response);
    const forbidden = await handleApiRequest(
      new Request("http://localhost:8080/api/reports/export?type=teams&format=csv&citySlug=lagos", {
        headers: { cookie },
      }),
    );
    expect(forbidden?.status).toBe(403);

    const csv = await handleApiRequest(
      new Request("http://localhost:8080/api/reports/export?type=teams&format=csv&citySlug=abuja", {
        headers: { cookie },
      }),
    );
    expect(csv?.status).toBe(200);
    expect(csv?.headers.get("content-type")).toContain("text/csv");
    expect(csv?.headers.get("content-disposition")).toContain("devkics-teams.csv");
    const csvText = await csv?.text();
    expect(csvText).toContain("Abuja XI");
    expect(csvText).not.toContain("Lagos XI");

    const pdf = await handleApiRequest(
      new Request("http://localhost:8080/api/reports/export?type=teams&format=pdf&citySlug=abuja", {
        headers: { cookie },
      }),
    );
    expect(pdf?.status).toBe(200);
    expect(pdf?.headers.get("content-type")).toContain("application/pdf");
    await expect(pdf?.text()).resolves.toMatch(/^%PDF-1\.4/);
  });
});

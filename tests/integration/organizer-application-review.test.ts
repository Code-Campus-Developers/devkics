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

describe("Phase 4 — Organizer Application Details Modal & Actions Menu", () => {
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
        tagline: "Federal capital chapter",
        accentImage: "abuja",
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

  async function createRegularUser(email: string) {
    const passwordHash = await hashPassword("UserSecret123!");
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Standard User",
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: "PLAYER",
      },
    });

    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password: "UserSecret123!",
        }),
      }),
    );
    expect(loginRes?.status).toBe(200);
    return { user, cookies: collectSetCookies(loginRes!) };
  }

  it("GET /api/applications returns complete candidate fields for admin", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });

    // Submit full application
    const submitReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Chioma Okonjo",
        email: "chioma@lead.test",
        city: "Abuja",
        country: "Nigeria",
        detail: "Experienced tech community lead and grassroots soccer organizer.",
        communityExperience: "Founded Abuja Devs Network with 2,500 active members.",
        organizingExperience: "Organized 3 annual Hack-and-Kick regional tournaments.",
        proposedOrganizingTeam: "Chioma (Lead), Emeka (Operations), Zainab (Media).",
        expectedOrganizations: "Kuda, Moniepoint, Interswitch, Andela.",
        proposedVenue: "Riverplate Meadow Turf, Wuse 2",
        proposedTournamentPeriod: "November - December 2026",
        motivation: "Empowering developers through competitive sports and community unity.",
        agreementAccepted: true,
      }),
    });

    const submitRes = await handleApiRequest(submitReq);
    expect(submitRes?.status).toBe(201);

    const admin = await createAdminUser();

    // Query applications as admin
    const getReq = new Request("http://localhost:8080/api/applications?page=1&pageSize=20", {
      method: "GET",
      headers: {
        cookie: toCookieHeader(admin.cookies),
      },
    });

    const getRes = await handleApiRequest(getReq);
    expect(getRes?.status).toBe(200);

    const data = (await getRes?.json()) as {
      ok: boolean;
      applications: {
        id: string;
        kind: string;
        name: string;
        email: string;
        city: string;
        country: string | null;
        detail: string;
        communityExperience: string | null;
        organizingExperience: string | null;
        proposedOrganizingTeam: string | null;
        expectedOrganizations: string | null;
        proposedVenue: string | null;
        proposedTournamentPeriod: string | null;
        motivation: string | null;
        reviewNotes: string | null;
        applicantUserId: string | null;
        cityId: string | null;
        status: string;
      }[];
    };

    expect(data.ok).toBe(true);
    expect(data.applications.length).toBe(1);

    const app = data.applications[0]!;
    expect(app.name).toBe("Chioma Okonjo");
    expect(app.email).toBe("chioma@lead.test");
    expect(app.city).toBe("Abuja");
    expect(app.country).toBe("Nigeria");
    expect(app.detail).toBe("Experienced tech community lead and grassroots soccer organizer.");
    expect(app.communityExperience).toBe("Founded Abuja Devs Network with 2,500 active members.");
    expect(app.organizingExperience).toBe("Organized 3 annual Hack-and-Kick regional tournaments.");
    expect(app.proposedOrganizingTeam).toBe("Chioma (Lead), Emeka (Operations), Zainab (Media).");
    expect(app.expectedOrganizations).toBe("Kuda, Moniepoint, Interswitch, Andela.");
    expect(app.proposedVenue).toBe("Riverplate Meadow Turf, Wuse 2");
    expect(app.proposedTournamentPeriod).toBe("November - December 2026");
    expect(app.motivation).toBe(
      "Empowering developers through competitive sports and community unity.",
    );
    expect(app.cityId).toBe(city.id);
    expect(app.status).toBe("pending");
    expect(app.reviewNotes).toBeNull();
  });

  it("non-admin users are forbidden from querying organizer applications", async () => {
    const regularUser = await createRegularUser("player@devkics.test");

    const getReq = new Request("http://localhost:8080/api/applications", {
      method: "GET",
      headers: {
        cookie: toCookieHeader(regularUser.cookies),
      },
    });

    const res = await handleApiRequest(getReq);
    expect(res?.status).toBe(403);
  });

  it("admin can transition application to approved, more-info-required, and rejected with review notes", async () => {
    const submitReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Babatunde Lawal",
        email: "babatunde@lead.test",
        city: "Abuja",
        detail: "Ecosystem builder ready to establish chapter operations.",
        agreementAccepted: true,
      }),
    });
    const submitRes = await handleApiRequest(submitReq);
    const { application } = (await submitRes?.json()) as { application: { id: string } };

    const admin = await createAdminUser();

    // 1. Request more info
    const infoReq = new Request(`http://localhost:8080/api/applications/${application.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(admin.cookies),
      },
      body: JSON.stringify({
        status: "more-info-required",
        reviewNotes: "Please clarify venue booking confirmation.",
      }),
    });
    const infoRes = await handleApiRequest(infoReq);
    expect(infoRes?.status).toBe(200);
    const infoData = (await infoRes?.json()) as {
      application: { status: string; reviewNotes: string };
    };
    expect(infoData.application.status).toBe("more-info-required");
    expect(infoData.application.reviewNotes).toBe("Please clarify venue booking confirmation.");

    // Verify audit log for more-info-required
    const infoLog = await prisma.auditLog.findFirst({
      where: {
        resourceType: "organizer-application",
        resourceId: application.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(infoLog?.actorId).toBe(admin.user.id);
    expect((infoLog?.newValue as Record<string, unknown> | null)?.["status"]).toBe(
      "MORE_INFO_REQUIRED",
    );

    // 2. Approve application
    const approveReq = new Request(`http://localhost:8080/api/applications/${application.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(admin.cookies),
      },
      body: JSON.stringify({
        status: "approved",
        reviewNotes: "Venue confirmed. Candidate approved for onboarding.",
      }),
    });
    const approveRes = await handleApiRequest(approveReq);
    expect(approveRes?.status).toBe(200);
    const approveData = (await approveRes?.json()) as {
      application: { status: string; reviewNotes: string };
    };
    expect(approveData.application.status).toBe("approved");
    expect(approveData.application.reviewNotes).toBe(
      "Venue confirmed. Candidate approved for onboarding.",
    );

    // 3. Reject another application
    const submit2Req = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Ineligible Applicant",
        email: "ineligible@lead.test",
        city: "Abuja",
        detail: "Lacks organizing experience or confirmed committee.",
        agreementAccepted: true,
      }),
    });
    const submit2Res = await handleApiRequest(submit2Req);
    const app2 = (await submit2Res?.json()) as { application: { id: string } };

    const rejectReq = new Request(`http://localhost:8080/api/applications/${app2.application.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(admin.cookies),
      },
      body: JSON.stringify({
        status: "rejected",
        reviewNotes: "Does not meet chapter organizer requirements.",
      }),
    });
    const rejectRes = await handleApiRequest(rejectReq);
    expect(rejectRes?.status).toBe(200);
    const rejectData = (await rejectRes?.json()) as {
      application: { status: string; reviewNotes: string };
    };
    expect(rejectData.application.status).toBe("rejected");
    expect(rejectData.application.reviewNotes).toBe(
      "Does not meet chapter organizer requirements.",
    );
  });

  it("non-admin users are forbidden from reviewing applications", async () => {
    const submitReq = new Request("http://localhost:8080/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "city-organizer",
        name: "Sample Applicant",
        email: "sample@lead.test",
        city: "Abuja",
        detail: "Applicant proposal details.",
        agreementAccepted: true,
      }),
    });
    const submitRes = await handleApiRequest(submitReq);
    const { application } = (await submitRes?.json()) as { application: { id: string } };

    const regularUser = await createRegularUser("unauth@devkics.test");

    const patchReq = new Request(`http://localhost:8080/api/applications/${application.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: toCookieHeader(regularUser.cookies),
      },
      body: JSON.stringify({ status: "approved" }),
    });

    const res = await handleApiRequest(patchReq);
    expect(res?.status).toBe(403);
  });
});

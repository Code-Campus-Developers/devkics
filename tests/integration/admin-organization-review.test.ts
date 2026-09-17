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

describe("Phase 3 — Admin Organization Review Surface", () => {
  beforeAll(() => {
    Object.assign(process.env, DEFAULT_ENV);
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.organizerApplication.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.roleAssignment.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
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
          tagline: "Pilot chapter",
          accentImage: "abuja",
        },
        {
          slug: "lagos",
          name: "Lagos",
          country: "Nigeria",
          countryCode: "NG",
          status: "LIVE",
          teams: 4,
          players: 48,
          tagline: "Coastal chapter",
          accentImage: "lagos",
        },
      ],
    });
  });

  async function createAdminUser() {
    const passwordHash = await hashPassword("AdminSecret123!");
    const user = await prisma.user.create({
      data: {
        email: "admin@devkics.test",
        passwordHash,
        name: "DevKics Admin",
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

  async function createOrganizerUser(citySlug: string) {
    const city = await prisma.city.findUnique({ where: { slug: citySlug } });
    const passwordHash = await hashPassword("OrgSecret123!");
    const user = await prisma.user.create({
      data: {
        email: `organizer-${citySlug}@devkics.test`,
        passwordHash,
        name: `${citySlug} Organizer`,
        citySlug,
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: "ORGANIZER",
        cityId: city?.id ?? null,
      },
    });

    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `organizer-${citySlug}@devkics.test`,
          password: "OrgSecret123!",
        }),
      }),
    );
    expect(loginRes?.status).toBe(200);
    return { user, cookies: collectSetCookies(loginRes!) };
  }

  async function createManagerUser(email: string) {
    const passwordHash = await hashPassword("ManagerSecret123!");
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Team Manager",
      },
    });

    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: "MANAGER",
      },
    });

    const loginRes = await handleApiRequest(
      new Request("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password: "ManagerSecret123!",
        }),
      }),
    );
    expect(loginRes?.status).toBe(200);
    return { user, cookies: collectSetCookies(loginRes!) };
  }

  it("admin queries all organizations cross-city including city details", async () => {
    const abuja = await prisma.city.findUniqueOrThrow({ where: { slug: "abuja" } });
    const lagos = await prisma.city.findUniqueOrThrow({ where: { slug: "lagos" } });

    const manager1 = await createManagerUser("mgr1@devkics.test");
    const manager2 = await createManagerUser("mgr2@devkics.test");

    // Submit organization in Abuja
    const org1Res = await handleApiRequest(
      new Request("http://localhost:8080/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager1.cookies),
        },
        body: JSON.stringify({
          citySlug: "abuja",
          name: "Paystack Tech",
          email: "paystack@devkics.test",
          description: "Abuja tech company squad.",
        }),
      }),
    );
    expect(org1Res?.status).toBe(201);

    // Submit organization in Lagos
    const org2Res = await handleApiRequest(
      new Request("http://localhost:8080/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager2.cookies),
        },
        body: JSON.stringify({
          citySlug: "lagos",
          name: "Flutterwave Engineering",
          email: "flutterwave@devkics.test",
          description: "Lagos tech collective.",
        }),
      }),
    );
    expect(org2Res?.status).toBe(201);

    // Admin queries cross-city without citySlug
    const admin = await createAdminUser();
    const adminListReq = new Request("http://localhost:8080/api/organizations?page=1&pageSize=50", {
      method: "GET",
      headers: {
        cookie: toCookieHeader(admin.cookies),
      },
    });

    const adminListRes = await handleApiRequest(adminListReq);
    expect(adminListRes?.status).toBe(200);
    const adminData = (await adminListRes?.json()) as {
      ok: boolean;
      organizations: {
        id: string;
        name: string;
        cityId: string;
        city?: { name: string; slug: string };
      }[];
      total: number;
    };

    expect(adminData.ok).toBe(true);
    expect(adminData.total).toBe(2);
    expect(adminData.organizations.length).toBe(2);

    const names = adminData.organizations.map((o) => o.name);
    expect(names).toContain("Paystack Tech");
    expect(names).toContain("Flutterwave Engineering");

    // Verify city details are included
    const paystack = adminData.organizations.find((o) => o.name === "Paystack Tech");
    expect(paystack?.cityId).toBe(abuja.id);
    expect(paystack?.city?.name).toBe("Abuja");
    expect(paystack?.city?.slug).toBe("abuja");

    const flutterwave = adminData.organizations.find((o) => o.name === "Flutterwave Engineering");
    expect(flutterwave?.cityId).toBe(lagos.id);
    expect(flutterwave?.city?.name).toBe("Lagos");
  });

  it("organizer query is scoped to their city", async () => {
    const manager1 = await createManagerUser("mgr1@devkics.test");
    const manager2 = await createManagerUser("mgr2@devkics.test");

    await handleApiRequest(
      new Request("http://localhost:8080/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager1.cookies),
        },
        body: JSON.stringify({
          citySlug: "abuja",
          name: "Abuja Org",
          email: "abuja@org.test",
          description: "Abuja organization.",
        }),
      }),
    );

    await handleApiRequest(
      new Request("http://localhost:8080/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager2.cookies),
        },
        body: JSON.stringify({
          citySlug: "lagos",
          name: "Lagos Org",
          email: "lagos@org.test",
          description: "Lagos organization.",
        }),
      }),
    );

    const abujaOrg = await createOrganizerUser("abuja");
    const listRes = await handleApiRequest(
      new Request("http://localhost:8080/api/organizations?citySlug=abuja&page=1&pageSize=50", {
        method: "GET",
        headers: {
          cookie: toCookieHeader(abujaOrg.cookies),
        },
      }),
    );

    expect(listRes?.status).toBe(200);
    const data = (await listRes?.json()) as {
      organizations: { name: string }[];
      total: number;
    };
    expect(data.total).toBe(1);
    expect(data.organizations[0]?.name).toBe("Abuja Org");
  });

  it("admin can directly approve submitted organization in a single call with review notes", async () => {
    const manager = await createManagerUser("mgr@devkics.test");
    const createRes = await handleApiRequest(
      new Request("http://localhost:8080/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager.cookies),
        },
        body: JSON.stringify({
          citySlug: "abuja",
          name: "Moniepoint FC",
          email: "moniepoint@devkics.test",
          description: "Fintech squad registration.",
        }),
      }),
    );
    expect(createRes?.status).toBe(201);
    const { organization } = (await createRes?.json()) as {
      organization: { id: string; status: string };
    };
    expect(organization.status).toBe("submitted");

    // Single direct PATCH to approved
    const admin = await createAdminUser();
    const patchRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(admin.cookies),
        },
        body: JSON.stringify({
          status: "approved",
          reviewNotes: "All documents verified and compliant.",
        }),
      }),
    );

    expect(patchRes?.status).toBe(200);
    const patched = (await patchRes?.json()) as {
      ok: boolean;
      organization: { status: string; reviewNotes: string; city?: { name: string } };
    };
    expect(patched.ok).toBe(true);
    expect(patched.organization.status).toBe("approved");
    expect(patched.organization.reviewNotes).toBe("All documents verified and compliant.");
    expect(patched.organization.city?.name).toBe("Abuja");

    // Verify DB record and audit log
    const dbOrg = await prisma.organization.findUniqueOrThrow({
      where: { id: organization.id },
    });
    expect(dbOrg.status).toBe("APPROVED");
    expect(dbOrg.reviewNotes).toBe("All documents verified and compliant.");
    expect(dbOrg.reviewerUserId).toBe(admin.user.id);
    expect(dbOrg.reviewedAt).not.toBeNull();

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        resourceType: "organization",
        resourceId: organization.id,
        action: "organization.reviewed",
      },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(admin.user.id);
  });

  it("admin can directly reject and request info on submitted organization in a single call", async () => {
    const manager = await createManagerUser("mgr@devkics.test");
    const createRes = await handleApiRequest(
      new Request("http://localhost:8080/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager.cookies),
        },
        body: JSON.stringify({
          citySlug: "abuja",
          name: "Direct Reject Org",
          email: "reject@devkics.test",
          description: "Org with missing information.",
        }),
      }),
    );
    const { organization } = (await createRes?.json()) as {
      organization: { id: string };
    };

    const admin = await createAdminUser();

    // Direct transition to more-info-required
    const moreInfoRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(admin.cookies),
        },
        body: JSON.stringify({
          status: "more-info-required",
          reviewNotes: "Please upload official registration document.",
        }),
      }),
    );
    expect(moreInfoRes?.status).toBe(200);
    const moreInfoData = (await moreInfoRes?.json()) as {
      organization: { status: string };
    };
    expect(moreInfoData.organization.status).toBe("more-info-required");

    // Direct transition to rejected
    const rejectRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(admin.cookies),
        },
        body: JSON.stringify({
          status: "rejected",
          reviewNotes: "Failed compliance review.",
        }),
      }),
    );
    expect(rejectRes?.status).toBe(200);
    const rejectData = (await rejectRes?.json()) as {
      organization: { status: string; reviewNotes: string };
    };
    expect(rejectData.organization.status).toBe("rejected");
    expect(rejectData.organization.reviewNotes).toBe("Failed compliance review.");
  });

  it("forbids non-admin non-organizer from reviewing organizations", async () => {
    const manager1 = await createManagerUser("mgr1@devkics.test");
    const manager2 = await createManagerUser("mgr2@devkics.test");

    const createRes = await handleApiRequest(
      new Request("http://localhost:8080/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager1.cookies),
        },
        body: JSON.stringify({
          citySlug: "abuja",
          name: "Test Org",
          email: "test@org.test",
          description: "Test organization squad description.",
        }),
      }),
    );
    expect(createRes?.status).toBe(201);
    const { organization } = (await createRes?.json()) as {
      organization: { id: string };
    };

    const patchRes = await handleApiRequest(
      new Request(`http://localhost:8080/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: toCookieHeader(manager2.cookies),
        },
        body: JSON.stringify({ status: "approved" }),
      }),
    );
    expect(patchRes?.status).toBe(403);
  });
});

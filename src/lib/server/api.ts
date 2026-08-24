import {
  CityStatus,
  OrganizerApplicationStatus,
  Role,
  type RoleAssignment,
  type User,
} from "@prisma/client";
import { z } from "zod";

import {
  clearSessionCookies,
  getAuthenticatedUser,
  hashPassword,
  issueSession,
  revokeSessionByRefreshToken,
  parseCookies,
  toPublicUser,
  verifyPassword,
} from "./auth";
import { prisma } from "./db";
import { hasScopedRole } from "./rbac";

type Json = Record<string, unknown>;

function jsonResponse(status: number, data: Json, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

function setCookies(headers: Headers, cookies: string[]) {
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
}

function mapCityStatus(status: CityStatus) {
  if (status === CityStatus.LIVE) return "live";
  if (status === CityStatus.APPLICATIONS_OPEN) return "applications-open";
  if (status === CityStatus.COMING_SOON) return "coming-soon";
  if (status === CityStatus.SUSPENDED) return "suspended";
  return "archived";
}

function mapOrganizerStatus(status: OrganizerApplicationStatus) {
  switch (status) {
    case OrganizerApplicationStatus.DRAFT:
      return "draft";
    case OrganizerApplicationStatus.SUBMITTED:
      return "pending";
    case OrganizerApplicationStatus.UNDER_REVIEW:
      return "under-review";
    case OrganizerApplicationStatus.MORE_INFO_REQUIRED:
      return "more-info-required";
    case OrganizerApplicationStatus.APPROVED:
      return "approved";
    case OrganizerApplicationStatus.REJECTED:
      return "rejected";
    case OrganizerApplicationStatus.SUSPENDED:
      return "suspended";
    case OrganizerApplicationStatus.WITHDRAWN:
      return "withdrawn";
    default:
      return "pending";
  }
}

function mapCityPayload(city: {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  status: CityStatus;
  teams: number;
  players: number;
  tagline: string;
  accentImage: string;
}) {
  return {
    slug: city.slug,
    name: city.name,
    country: city.country,
    countryCode: city.countryCode,
    status: mapCityStatus(city.status),
    teams: city.teams,
    players: city.players,
    tagline: city.tagline,
    accentImage: city.accentImage,
  };
}

function mapApplicationPayload(application: {
  id: string;
  name: string;
  email: string;
  city: string;
  detail: string;
  submittedAt: Date;
  status: OrganizerApplicationStatus;
}) {
  return {
    id: application.id,
    kind: "city-organizer",
    name: application.name,
    email: application.email,
    city: application.city,
    detail: application.detail,
    submittedAt: application.submittedAt.toISOString().slice(0, 10),
    status: mapOrganizerStatus(application.status),
  };
}

function isAdmin(user: User, assignments: RoleAssignment[]) {
  return user.email.toLowerCase() === "admin@devkics.com" || hasScopedRole(assignments, Role.ADMIN);
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "organizer", "manager", "player"]),
  citySlug: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const cityStatusSchema = z.object({
  status: z.enum(["live", "applications-open", "coming-soon", "suspended", "archived"]),
});

const organizerApplicationSchema = z.object({
  kind: z.literal("city-organizer"),
  name: z.string().min(2),
  email: z.string().email(),
  city: z.string().min(2),
  detail: z.string().min(10),
  country: z.string().optional(),
  communityExperience: z.string().optional(),
  organizingExperience: z.string().optional(),
  proposedOrganizingTeam: z.string().optional(),
  expectedOrganizations: z.string().optional(),
  proposedVenue: z.string().optional(),
  proposedTournamentPeriod: z.string().optional(),
  motivation: z.string().optional(),
});

const reviewSchema = z.object({
  status: z.enum([
    "submitted",
    "under-review",
    "more-info-required",
    "approved",
    "rejected",
    "suspended",
    "withdrawn",
  ]),
  reviewNotes: z.string().optional(),
});

function toOrganizerStatus(status: string): OrganizerApplicationStatus {
  if (status === "submitted") return OrganizerApplicationStatus.SUBMITTED;
  if (status === "under-review") return OrganizerApplicationStatus.UNDER_REVIEW;
  if (status === "more-info-required") return OrganizerApplicationStatus.MORE_INFO_REQUIRED;
  if (status === "approved") return OrganizerApplicationStatus.APPROVED;
  if (status === "rejected") return OrganizerApplicationStatus.REJECTED;
  if (status === "suspended") return OrganizerApplicationStatus.SUSPENDED;
  return OrganizerApplicationStatus.WITHDRAWN;
}

function toCityStatus(status: string): CityStatus {
  if (status === "live") return CityStatus.LIVE;
  if (status === "applications-open") return CityStatus.APPLICATIONS_OPEN;
  if (status === "coming-soon") return CityStatus.COMING_SOON;
  if (status === "suspended") return CityStatus.SUSPENDED;
  return CityStatus.ARCHIVED;
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as Json;
  } catch {
    return null;
  }
}

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  const auth = await getAuthenticatedUser(request);
  const authHeaders = new Headers();
  setCookies(authHeaders, auth.headers);

  // auth
  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await parseJsonBody(request);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonResponse(409, { ok: false, error: "Email already in use" }, authHeaders);
    }

    const city = parsed.data.citySlug
      ? await prisma.city.findUnique({ where: { slug: parsed.data.citySlug } })
      : await prisma.city.findUnique({ where: { slug: "abuja" } });

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash: await hashPassword(parsed.data.password),
        citySlug: city?.slug ?? null,
      },
    });

    const assignment = await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: parsed.data.role.toUpperCase() as Role,
        cityId: city?.id ?? null,
        countryCode: city?.countryCode ?? null,
      },
    });

    const issued = await issueSession(user, [assignment]);
    const headers = new Headers(authHeaders);
    headers.append("set-cookie", issued.accessCookie);
    headers.append("set-cookie", issued.refreshCookie);

    return jsonResponse(201, { ok: true, user: toPublicUser(user, [assignment]) }, headers);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await parseJsonBody(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return jsonResponse(401, { ok: false, error: "Invalid credentials" }, authHeaders);
    }

    const assignments = await prisma.roleAssignment.findMany({ where: { userId: user.id } });
    const issued = await issueSession(user, assignments);
    const headers = new Headers(authHeaders);
    headers.append("set-cookie", issued.accessCookie);
    headers.append("set-cookie", issued.refreshCookie);

    return jsonResponse(200, { ok: true, user: toPublicUser(user, assignments) }, headers);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const cookies = parseCookies(request);
    if (cookies.refresh) {
      await revokeSessionByRefreshToken(cookies.refresh);
    }
    const headers = new Headers(authHeaders);
    for (const cookie of clearSessionCookies()) {
      headers.append("set-cookie", cookie);
    }
    return jsonResponse(200, { ok: true }, headers);
  }

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    if (!auth.user) {
      return jsonResponse(200, { ok: true, user: null }, authHeaders);
    }

    return jsonResponse(
      200,
      { ok: true, user: toPublicUser(auth.user, auth.assignments) },
      authHeaders,
    );
  }

  // cities
  if (request.method === "GET" && url.pathname === "/api/cities") {
    const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });
    return jsonResponse(200, { ok: true, cities: cities.map(mapCityPayload) }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/cities/")) {
    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    if (!isAdmin(auth.user, auth.assignments)) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const slug = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const body = await parseJsonBody(request);
    const parsed = cityStatusSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const city = await prisma.city.findUnique({ where: { slug } });
    if (!city) {
      return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    }

    const updated = await prisma.city.update({
      where: { slug },
      data: { status: toCityStatus(parsed.data.status) },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.user.id,
        action: "city.status.updated",
        resourceType: "city",
        resourceId: updated.id,
        cityId: updated.id,
        oldValue: { status: city.status },
        newValue: { status: updated.status },
      },
    });

    return jsonResponse(200, { ok: true, city: mapCityPayload(updated) }, authHeaders);
  }

  // organizer applications
  if (request.method === "GET" && url.pathname === "/api/applications") {
    const applications = await prisma.organizerApplication.findMany({
      orderBy: { submittedAt: "desc" },
    });

    return jsonResponse(
      200,
      { ok: true, applications: applications.map(mapApplicationPayload) },
      authHeaders,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/applications") {
    const body = await parseJsonBody(request);
    const parsed = organizerApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const city = await prisma.city.findUnique({ where: { slug: parsed.data.city.toLowerCase() } });

    const application = await prisma.organizerApplication.create({
      data: {
        applicantUserId: auth.user?.id ?? null,
        cityId: city?.id ?? null,
        name: parsed.data.name,
        email: parsed.data.email,
        city: parsed.data.city,
        country: parsed.data.country ?? null,
        detail: parsed.data.detail,
        communityExperience: parsed.data.communityExperience ?? null,
        organizingExperience: parsed.data.organizingExperience ?? null,
        proposedOrganizingTeam: parsed.data.proposedOrganizingTeam ?? null,
        expectedOrganizations: parsed.data.expectedOrganizations ?? null,
        proposedVenue: parsed.data.proposedVenue ?? null,
        proposedTournamentPeriod: parsed.data.proposedTournamentPeriod ?? null,
        motivation: parsed.data.motivation ?? null,
        status: OrganizerApplicationStatus.SUBMITTED,
      },
    });

    return jsonResponse(
      201,
      { ok: true, application: mapApplicationPayload(application) },
      authHeaders,
    );
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/applications/")) {
    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    if (!isAdmin(auth.user, auth.assignments)) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const appId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const body = await parseJsonBody(request);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const existing = await prisma.organizerApplication.findUnique({ where: { id: appId } });
    if (!existing) {
      return jsonResponse(404, { ok: false, error: "Application not found" }, authHeaders);
    }

    const updated = await prisma.organizerApplication.update({
      where: { id: appId },
      data: {
        status: toOrganizerStatus(parsed.data.status),
        reviewNotes: parsed.data.reviewNotes ?? null,
        reviewerUserId: auth.user.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.user.id,
        action: "organizer-application.reviewed",
        resourceType: "organizer-application",
        resourceId: updated.id,
        cityId: updated.cityId,
        oldValue: { status: existing.status },
        newValue: { status: updated.status, reviewNotes: updated.reviewNotes },
      },
    });

    return jsonResponse(
      200,
      { ok: true, application: mapApplicationPayload(updated) },
      authHeaders,
    );
  }

  return jsonResponse(404, { ok: false, error: "Not found" }, authHeaders);
}

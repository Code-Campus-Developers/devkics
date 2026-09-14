import {
  AwardRecipientType,
  CityStatus,
  ContentPublishStatus,
  MatchEventType,
  MatchStage,
  MatchStatus,
  OrganizationStatus,
  OrganizerApplicationStatus,
  PlayerStatus,
  Role,
  SponsorshipTier,
  TeamStatus,
  TournamentStatus,
  VolunteerApplicationStatus,
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
import { applyRateLimit, getClientIp, toRateLimitHeaders } from "./rate-limit";
import { hasScopedRole } from "./rbac";
import {
  aggregateMatchStatistics,
  assertOrganizationTransition,
  assertPlayerTransition,
  assertTeamTransition,
  assertTournamentTransition,
  computeStandingsProjection,
  generateRoundRobinFixtures,
  resolveFixtureWinner,
} from "./tournament-ops";
import {
  assertAnnouncementTransition,
  assertVolunteerApplicationTransition,
  deliverQueuedEmailNotifications,
  dispatchNotification,
} from "./community-content";
import { getEmailTransport } from "./email-transport";
import { deleteGalleryMedia, publicGalleryUrl, uploadGalleryMedia } from "./supabase-storage";
import { writeAuditLog } from "./audit-log";
import { buildReport, reportTypes, toCsv, toExcelXml, toPdf } from "./reports";
import { generateSitemapXml } from "./sitemap";

type Json = Record<string, unknown>;

function jsonResponse(status: number, data: Json, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  if (!responseHeaders.has("cache-control")) {
    responseHeaders.set("cache-control", "no-store, no-cache, must-revalidate, private");
  }
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

function mapOrganizationStatus(status: OrganizationStatus) {
  return status.toLowerCase().replaceAll("_", "-");
}

function mapTournamentStatus(status: TournamentStatus) {
  return status.toLowerCase().replaceAll("_", "-");
}

function mapTeamStatus(status: TeamStatus) {
  return status.toLowerCase().replaceAll("_", "-");
}

function mapPlayerStatus(status: PlayerStatus) {
  return status.toLowerCase().replaceAll("_", "-");
}

function mapMatchStatus(status: MatchStatus) {
  return status.toLowerCase();
}

function mapMatchStage(stage: MatchStage) {
  return stage.toLowerCase();
}

function mapOrganizationPayload(organization: {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  country: string | null;
  website: string | null;
  description: string;
  status: OrganizationStatus;
  reviewNotes: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    id: organization.id,
    cityId: organization.cityId,
    name: organization.name,
    slug: organization.slug,
    email: organization.email,
    phone: organization.phone,
    country: organization.country,
    website: organization.website,
    description: organization.description,
    status: mapOrganizationStatus(organization.status),
    reviewNotes: organization.reviewNotes,
    submittedAt: organization.submittedAt.toISOString(),
    reviewedAt: organization.reviewedAt?.toISOString() ?? null,
  };
}

function mapTournamentPayload(tournament: {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  season: string;
  format: string;
  venue: string;
  summary: string;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date;
  tieBreakers: unknown;
  publishedAt: Date | null;
}) {
  return {
    id: tournament.id,
    cityId: tournament.cityId,
    name: tournament.name,
    slug: tournament.slug,
    season: tournament.season,
    format: tournament.format,
    venue: tournament.venue,
    summary: tournament.summary,
    status: mapTournamentStatus(tournament.status),
    startDate: tournament.startDate.toISOString().slice(0, 10),
    endDate: tournament.endDate.toISOString().slice(0, 10),
    tieBreakers: Array.isArray(tournament.tieBreakers)
      ? tournament.tieBreakers
      : ["points", "goalDifference", "goalsFor"],
    publishedAt: tournament.publishedAt?.toISOString() ?? null,
  };
}

function mapTeamPayload(
  team: {
    id: string;
    tournamentId: string;
    organizationId: string;
    groupId: string | null;
    name: string;
    shortName: string;
    company: string;
    color: string | null;
    founded: string | null;
    status: TeamStatus;
    reviewNotes: string | null;
    managerUserId: string | null;
    submittedAt: Date;
  },
  options: { includeReviewNotes?: boolean } = {},
) {
  return {
    id: team.id,
    tournamentId: team.tournamentId,
    organizationId: team.organizationId,
    groupId: team.groupId,
    name: team.name,
    shortName: team.shortName,
    company: team.company,
    color: team.color,
    founded: team.founded,
    status: mapTeamStatus(team.status),
    reviewNotes: options.includeReviewNotes ? team.reviewNotes : null,
    managerUserId: team.managerUserId,
    submittedAt: team.submittedAt.toISOString(),
  };
}

function mapPlayerPayload(
  player: {
    id: string;
    teamId: string;
    userId: string | null;
    fullName: string;
    email?: string | null;
    position: string;
    number: number | null;
    role: string | null;
    status: PlayerStatus;
    reviewNotes: string | null;
    submittedAt: Date;
  },
  options: { includeReviewNotes?: boolean } = {},
) {
  return {
    id: player.id,
    teamId: player.teamId,
    userId: player.userId,
    fullName: player.fullName,
    email: player.email,
    position: player.position,
    number: player.number,
    role: player.role,
    status: mapPlayerStatus(player.status),
    reviewNotes: options.includeReviewNotes ? player.reviewNotes : null,
    submittedAt: player.submittedAt.toISOString(),
  };
}

function mapFixturePayload(fixture: {
  id: string;
  tournamentId: string;
  groupId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  stage: MatchStage;
  roundLabel: string | null;
  matchday: number;
  kickoffAt: Date;
  venue: string;
  status: MatchStatus;
  match: {
    homeScore: number | null;
    awayScore: number | null;
    halfTimeHome: number | null;
    halfTimeAway: number | null;
    extraTimeHome: number | null;
    extraTimeAway: number | null;
    penaltyHome: number | null;
    penaltyAway: number | null;
  } | null;
}) {
  return {
    id: fixture.id,
    tournamentId: fixture.tournamentId,
    groupId: fixture.groupId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    stage: mapMatchStage(fixture.stage),
    roundLabel: fixture.roundLabel,
    matchday: fixture.matchday,
    date: fixture.kickoffAt.toISOString().slice(0, 10),
    time: fixture.kickoffAt.toISOString().slice(11, 16),
    venue: fixture.venue,
    status: mapMatchStatus(fixture.status),
    homeScore: fixture.match?.homeScore ?? null,
    awayScore: fixture.match?.awayScore ?? null,
    halfTimeHome: fixture.match?.halfTimeHome ?? null,
    halfTimeAway: fixture.match?.halfTimeAway ?? null,
    extraTimeHome: fixture.match?.extraTimeHome ?? null,
    extraTimeAway: fixture.match?.extraTimeAway ?? null,
    penaltyHome: fixture.match?.penaltyHome ?? null,
    penaltyAway: fixture.match?.penaltyAway ?? null,
  };
}

function statusFromKebab<T extends string>(value: string, all: readonly T[]): T {
  const normalized = value.toUpperCase().replaceAll("-", "_");
  const resolved = all.find((item) => item === normalized);
  if (!resolved) throw new Error(`Unsupported status: ${value}`);
  return resolved;
}

function isAdmin(_user: User, assignments: RoleAssignment[]) {
  return hasScopedRole(assignments, Role.ADMIN);
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["manager", "player"]),
  citySlug: z.string().optional(),
  acceptedTerms: z.boolean().default(true),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  portal: z.enum(["standard", "admin"]).optional(),
});

const cityStatusSchema = z.object({
  status: z.enum(["live", "applications-open", "coming-soon", "suspended", "archived"]),
});

const createCitySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  country: z.string().trim().min(2).max(80),
  countryCode: z.string().trim().min(2).max(3).toUpperCase(),
  tagline: z.string().trim().max(160).optional(),
  accentImage: z.string().trim().max(80).optional(),
  status: z.enum(["live", "applications-open", "coming-soon", "suspended", "archived"]).optional(),
});

const organizerApplicationSchema = z.object({
  kind: z.literal("city-organizer"),
  name: z.string().min(2),
  email: z.string().email(),
  city: z.string().min(2),
  detail: z.string().min(10).max(2_000),
  country: z.string().optional(),
  communityExperience: z.string().optional(),
  organizingExperience: z.string().optional(),
  proposedOrganizingTeam: z.string().optional(),
  expectedOrganizations: z.string().optional(),
  proposedVenue: z.string().optional(),
  proposedTournamentPeriod: z.string().optional(),
  motivation: z.string().optional(),
  agreementAccepted: z.boolean().default(true),
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

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const organizationCreateSchema = z.object({
  citySlug: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  country: z.string().optional(),
  website: z.string().url().optional(),
  description: z.string().min(10).max(2000),
});

const organizationReviewSchema = z.object({
  status: z.enum([
    "submitted",
    "under-review",
    "more-info-required",
    "approved",
    "rejected",
    "suspended",
    "withdrawn",
  ]),
  reviewNotes: z.string().max(2000).optional(),
});

const tournamentCreateSchema = z.object({
  citySlug: z.string().min(2),
  name: z.string().min(2),
  slug: z.string().min(2),
  season: z.string().min(2),
  format: z.string().min(2),
  venue: z.string().min(2),
  summary: z.string().min(5).max(2000),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  tieBreakers: z.array(z.enum(["points", "goalDifference", "goalsFor", "won"])).optional(),
});

const tournamentStatusSchema = z.object({
  status: z.enum([
    "draft",
    "registration-open",
    "registration-closed",
    "fixtures-published",
    "ongoing",
    "completed",
    "postponed",
    "cancelled",
    "archived",
  ]),
});

const reportQuerySchema = z.object({
  type: z.enum(reportTypes),
  format: z.enum(["csv", "excel", "pdf"]),
  citySlug: z.string().min(2).optional(),
  countryCode: z.string().length(2).optional(),
  tournamentId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  playerId: z.string().min(1).optional(),
  volunteerId: z.string().min(1).optional(),
  sponsorId: z.string().min(1).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const teamCreateSchema = z.object({
  tournamentId: z.string().min(1),
  organizationId: z.string().min(1),
  groupId: z.string().optional(),
  name: z.string().min(2),
  shortName: z.string().min(2).max(8),
  company: z.string().min(2),
  color: z.string().optional(),
  founded: z.string().optional(),
});

const teamReviewSchema = z.object({
  status: z.enum([
    "submitted",
    "under-review",
    "approved",
    "rejected",
    "suspended",
    "disqualified",
    "locked",
  ]),
  reviewNotes: z.string().max(2000).optional(),
});

const playerCreateSchema = z.object({
  teamId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  position: z.string().min(1),
  number: z.number().int().min(1).max(99).optional(),
  role: z.string().optional(),
  status: z.enum(["invited", "pending-approval", "approved"]).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalDeclaration: z.string().max(2000).optional(),
  waiverAccepted: z.boolean().optional().default(false),
  mediaConsentAccepted: z.boolean().optional(),
});

const playerInvitationRespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  waiverAccepted: z.boolean().optional(),
  mediaConsentAccepted: z.boolean().optional(),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalDeclaration: z.string().max(2000).optional(),
});

const playerJoinRequestSchema = z.object({
  position: z.string().min(1),
  number: z.number().int().min(1).max(99).optional(),
  role: z.string().optional(),
  waiverAccepted: z.boolean(),
  mediaConsentAccepted: z.boolean().optional(),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalDeclaration: z.string().max(2000).optional(),
});

const playerReviewSchema = z.object({
  status: z.enum([
    "registration-incomplete",
    "pending-approval",
    "approved",
    "suspended",
    "withdrawn",
    "disqualified",
  ]),
  reviewNotes: z.string().max(2000).optional(),
});

const fixtureCreateSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().optional(),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  stage: z.enum(["group", "knockout"]).optional(),
  roundLabel: z.string().optional(),
  matchday: z.number().int().min(1),
  date: z.string().min(8),
  time: z.string().min(4),
  venue: z.string().min(2),
});

const fixtureGenerateSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().optional(),
  kickoffStart: z.string().min(8),
  venue: z.string().min(2),
  matchIntervalMinutes: z.number().int().min(30).max(360).optional(),
});

const matchEventSchema = z.object({
  type: z.enum([
    "goal",
    "assist",
    "yellow-card",
    "red-card",
    "substitution",
    "half-time",
    "extra-time-start",
    "extra-time-end",
    "penalty-scored",
    "penalty-missed",
  ]),
  teamId: z.string().optional(),
  playerId: z.string().optional(),
  relatedPlayerId: z.string().optional(),
  period: z.string().default("regular"),
  minute: z.number().int().min(0).max(150).optional(),
  stoppageMinute: z.number().int().min(0).max(30).optional(),
  detail: z.string().max(500).optional(),
});

const matchResultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  halfTimeHome: z.number().int().min(0).optional(),
  halfTimeAway: z.number().int().min(0).optional(),
  extraTimeHome: z.number().int().min(0).optional(),
  extraTimeAway: z.number().int().min(0).optional(),
  penaltyHome: z.number().int().min(0).optional(),
  penaltyAway: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  events: z.array(matchEventSchema).default([]),
});

const awardCreateSchema = z.object({
  tournamentId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().max(2000).optional(),
  recipientType: z.enum(["team", "player"]),
  teamId: z.string().optional(),
  playerId: z.string().optional(),
  note: z.string().max(500).optional(),
});

const volunteerApplicationSchema = z.object({
  citySlug: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  role: z.string().min(2).max(120),
  availability: z.string().min(10).max(2_000),
  agreementAccepted: z.boolean().default(true),
});

const volunteerReviewSchema = z.object({
  status: z.enum(["under-review", "approved", "rejected"]),
  reviewNotes: z.string().max(2_000).optional(),
  tournamentId: z.string().optional(),
});

const sponsorshipEnquirySchema = z.object({
  citySlug: z.string().min(2),
  tournamentId: z.string().optional(),
  name: z.string().min(2),
  email: z.string().email(),
  organization: z.string().max(200).optional(),
  message: z.string().min(10).max(2_000),
});

const sponsorSchema = z.object({
  citySlug: z.string().min(2),
  tournamentId: z.string().optional(),
  name: z.string().min(2),
  slug: z.string().min(2).max(100),
  description: z.string().min(10).max(2_000),
  tier: z.enum(["headline", "official", "community"]),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  startsAt: z.string().date().optional(),
  endsAt: z.string().date().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

const sponsorshipUpdateSchema = sponsorSchema
  .omit({ citySlug: true, slug: true, name: true, description: true })
  .partial();

const volunteerRequirementSchema = z.object({
  tournamentId: z.string().min(1),
  role: z.string().min(2).max(120),
  requiredCount: z.number().int().min(0).max(500),
});

const volunteerCheckInSchema = z.object({ note: z.string().max(500).optional() });

const announcementSchema = z.object({
  citySlug: z.string().min(2),
  tournamentId: z.string().optional(),
  headline: z.string().min(5).max(200),
  excerpt: z.string().min(10).max(500),
  body: z.string().min(20).max(10_000),
  category: z.string().min(2).max(80),
  featuredImageUrl: z.string().url().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

const announcementUpdateSchema = announcementSchema.omit({ citySlug: true }).partial();

const gallerySchema = z.object({
  citySlug: z.string().min(2),
  title: z.string().min(2).max(200),
  description: z.string().max(2_000).optional(),
});

const mediaMetadataSchema = z.object({
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
  isCover: z.boolean().optional(),
});

const AUTH_RATE_LIMIT = { limit: 12, windowMs: 60_000 };
const APPLICATION_SUBMIT_RATE_LIMIT = { limit: 10, windowMs: 60_000 };
const APPLICATION_REVIEW_RATE_LIMIT = { limit: 60, windowMs: 60_000 };
const TOURNAMENT_MUTATION_RATE_LIMIT = { limit: 80, windowMs: 60_000 };

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

function toMatchEventType(value: string): MatchEventType {
  return statusFromKebab(value, Object.values(MatchEventType));
}

async function canAccessCityOperations(user: User, assignments: RoleAssignment[], cityId: string) {
  if (hasScopedRole(assignments, Role.ADMIN)) return true;
  return hasScopedRole(assignments, Role.ORGANIZER, { cityId });
}

async function notifyCityAudience(input: {
  cityId: string;
  createdByUserId: string;
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
}) {
  const assignments = await prisma.roleAssignment.findMany({
    where: { OR: [{ cityId: input.cityId }, { role: Role.ADMIN }] },
    distinct: ["userId"],
    select: { userId: true, user: { select: { email: true } } },
  });
  const transport = getEmailTransport();
  await Promise.all(
    assignments.map((assignment) =>
      dispatchNotification(
        prisma,
        {
          recipientUserId: assignment.userId,
          recipientEmail: assignment.user.email,
          createdByUserId: input.createdByUserId,
          type: input.type,
          title: input.title,
          body: input.body,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          email: true,
        },
        transport,
      ),
    ),
  );
}

async function resolveTournamentScope(tournamentId: string) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, cityId: true, tieBreakers: true },
  });
}

async function refreshStandings(tournamentId: string) {
  const [teams, fixtures, groups, tournament] = await Promise.all([
    prisma.team.findMany({
      where: { tournamentId, status: TeamStatus.APPROVED },
      select: { id: true, groupId: true },
    }),
    prisma.fixture.findMany({
      where: { tournamentId },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        status: true,
        kickoffAt: true,
        groupId: true,
        match: {
          select: {
            homeScore: true,
            awayScore: true,
          },
        },
      },
    }),
    prisma.group.findMany({ where: { tournamentId }, select: { id: true } }),
    prisma.tournament.findUnique({ where: { id: tournamentId }, select: { tieBreakers: true } }),
  ]);

  const tieBreakers = Array.isArray(tournament?.tieBreakers)
    ? (tournament?.tieBreakers as string[])
    : ["points", "goalDifference", "goalsFor"];

  const fixtureByGroup = new Map<string | null, typeof fixtures>();
  fixtureByGroup.set(
    null,
    fixtures.filter((fixture) => fixture.groupId === null),
  );
  for (const group of groups) {
    fixtureByGroup.set(
      group.id,
      fixtures.filter((fixture) => fixture.groupId === group.id),
    );
  }

  await prisma.standing.deleteMany({ where: { tournamentId } });

  for (const [groupId, groupFixtures] of fixtureByGroup.entries()) {
    const groupedTeams = teams
      .filter((team) => (groupId ? team.groupId === groupId : true))
      .map((team) => ({ id: team.id }));
    if (!groupedTeams.length) continue;

    const standings = computeStandingsProjection({
      teams: groupedTeams,
      fixtures: groupFixtures,
      tieBreakers,
    });

    if (!standings.length) continue;

    await prisma.standing.createMany({
      data: standings.map((standing) => ({
        tournamentId,
        groupId,
        teamId: standing.teamId,
        played: standing.played,
        won: standing.won,
        drawn: standing.drawn,
        lost: standing.lost,
        goalsFor: standing.goalsFor,
        goalsAgainst: standing.goalsAgainst,
        goalDifference: standing.goalDifference,
        points: standing.points,
        form: standing.form,
        rank: standing.rank,
      })),
    });
  }
}

async function maybeAdvanceKnockout(fixtureId: string) {
  const [fixture, links] = await Promise.all([
    prisma.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        stage: true,
        match: {
          select: {
            homeScore: true,
            awayScore: true,
            penaltyHome: true,
            penaltyAway: true,
          },
        },
      },
    }),
    prisma.knockoutLink.findMany({
      where: { fromFixtureId: fixtureId },
      select: { toFixtureId: true, winnerToSide: true },
    }),
  ]);

  if (!fixture || fixture.stage !== MatchStage.KNOCKOUT || !links.length) return;

  const winnerTeamId = resolveFixtureWinner(fixture);
  if (!winnerTeamId) return;

  for (const link of links) {
    await prisma.fixture.update({
      where: { id: link.toFixtureId },
      data:
        link.winnerToSide === "HOME" ? { homeTeamId: winnerTeamId } : { awayTeamId: winnerTeamId },
    });
  }
}

async function claimMatchingPlayerInvitations(
  prismaClient: typeof prisma,
  user: User,
): Promise<User> {
  const normalizedEmail = user.email.toLowerCase().trim();
  let current = user;

  // Audit stale / wrong-account playerId and teamId
  if (current.playerId) {
    const activePlayer = await prismaClient.player.findUnique({
      where: { id: current.playerId },
      select: { id: true, status: true, teamId: true, userId: true },
    });
    if (
      !activePlayer ||
      activePlayer.status !== PlayerStatus.APPROVED ||
      (activePlayer.userId && activePlayer.userId !== current.id)
    ) {
      current = await prismaClient.user.update({
        where: { id: current.id },
        data: { playerId: null, teamId: null },
      });
    } else if (current.teamId !== activePlayer.teamId) {
      current = await prismaClient.user.update({
        where: { id: current.id },
        data: { teamId: activePlayer.teamId },
      });
    }
  }

  // Audit orphaned teamId (teamId set without playerId on a non-manager user)
  if (current.teamId && !current.playerId) {
    const isManager = await prismaClient.team.findFirst({
      where: { id: current.teamId, managerUserId: current.id },
      select: { id: true },
    });
    if (!isManager) {
      current = await prismaClient.user.update({
        where: { id: current.id },
        data: { teamId: null },
      });
    }
  }

  // Resolve user city if assigned
  let userCityId: string | null = null;
  if (current.citySlug) {
    const city = await prismaClient.city.findUnique({
      where: { slug: current.citySlug },
      select: { id: true },
    });
    if (city) userCityId = city.id;
  }

  const unclaimed = await prismaClient.player.findMany({
    where: {
      email: normalizedEmail,
      userId: null,
      status: { in: [PlayerStatus.INVITED, PlayerStatus.PENDING_APPROVAL, PlayerStatus.APPROVED] },
    },
    include: { team: { select: { tournament: { select: { cityId: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  for (const inv of unclaimed) {
    // Cross-city boundary: do not claim invitations from another city if user city is set
    if (userCityId && inv.team.tournament.cityId !== userCityId) {
      continue;
    }

    await prismaClient.player.update({
      where: { id: inv.id },
      data: { userId: current.id },
    });

    // If an unclaimed invite was already approved and user has no squad, link it
    if (inv.status === PlayerStatus.APPROVED && !current.playerId) {
      current = await prismaClient.user.update({
        where: { id: current.id },
        data: { playerId: inv.id, teamId: inv.teamId },
      });
    }
  }

  // If user still has no playerId, check if an existing APPROVED player record is already linked to this user
  if (!current.playerId) {
    const activeApproved = await prismaClient.player.findFirst({
      where: {
        userId: current.id,
        status: PlayerStatus.APPROVED,
        ...(userCityId ? { team: { tournament: { cityId: userCityId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    if (activeApproved) {
      current = await prismaClient.user.update({
        where: { id: current.id },
        data: { playerId: activeApproved.id, teamId: activeApproved.teamId },
      });
    }
  }

  return current;
}

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/sitemap.xml") {
    const xml = await generateSitemapXml(prisma);
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/robots.txt") {
    const robots = `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /api/\n\nSitemap: https://devkics.org/sitemap.xml\n`;
    return new Response(robots, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  if (!url.pathname.startsWith("/api/")) return null;
  const clientIp = getClientIp(request);

  const auth = await getAuthenticatedUser(request);
  const authHeaders = new Headers();
  setCookies(authHeaders, auth.headers);

  const applyEndpointRateLimit = (key: string, limit: { limit: number; windowMs: number }) => {
    const result = applyRateLimit(`${clientIp}:${key}`, limit);
    if (!result.allowed) {
      const headers = new Headers(authHeaders);
      for (const [name, value] of Object.entries(toRateLimitHeaders(result))) {
        headers.set(name, value);
      }
      headers.set(
        "retry-after",
        String(Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1)),
      );

      return jsonResponse(
        429,
        { ok: false, error: "Too many requests. Try again shortly." },
        headers,
      );
    }

    for (const [name, value] of Object.entries(toRateLimitHeaders(result))) {
      authHeaders.set(name, value);
    }

    return null;
  };

  if (request.method === "GET" && url.pathname === "/api/health") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return jsonResponse(200, {
        ok: true,
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return jsonResponse(503, {
        ok: false,
        status: "unhealthy",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Database connection failed",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // auth
  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const guard = applyEndpointRateLimit("auth:register", AUTH_RATE_LIMIT);
    if (guard) return guard;

    const body = await parseJsonBody(request);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    if (parsed.data.acceptedTerms === false) {
      return jsonResponse(
        400,
        {
          ok: false,
          error: "You must accept the Terms of Use, Privacy Policy, and Code of Conduct",
        },
        authHeaders,
      );
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

    await writeAuditLog(prisma, {
      actorId: user.id,
      action: "user.registered",
      resourceType: "user",
      resourceId: user.id,
      cityId: city?.id ?? null,
      newValue: {
        role: assignment.role,
        citySlug: user.citySlug,
        consent: {
          termsOfUse: true,
          privacyPolicy: true,
          codeOfConduct: true,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    const registeredUser = await claimMatchingPlayerInvitations(prisma, user);
    const issued = await issueSession(registeredUser, [assignment]);
    const headers = new Headers(authHeaders);
    headers.append("set-cookie", issued.accessCookie);
    headers.append("set-cookie", issued.refreshCookie);

    return jsonResponse(
      201,
      { ok: true, user: toPublicUser(registeredUser, [assignment]) },
      headers,
    );
  }

  if (request.method === "GET" && url.pathname === "/api/legal/consent-status") {
    const legalVersions = {
      termsOfUse: "2026-09-01",
      privacyPolicy: "2026-09-01",
      codeOfConduct: "2026-09-01",
      playerWaiver: "2026-09-01",
    };

    if (!auth.user) {
      return jsonResponse(
        200,
        { ok: true, authenticated: false, consent: null, legalVersions },
        authHeaders,
      );
    }
    const player = await prisma.player.findFirst({
      where: { userId: auth.user.id },
      select: { waiverAcceptedAt: true, mediaConsentAcceptedAt: true },
    });
    return jsonResponse(
      200,
      {
        ok: true,
        authenticated: true,
        legalVersions,
        consent: {
          userId: auth.user.id,
          termsAccepted: true,
          privacyAccepted: true,
          codeOfConductAccepted: true,
          playerWaiverAcceptedAt: player?.waiverAcceptedAt
            ? player.waiverAcceptedAt.toISOString()
            : null,
          playerMediaConsentAcceptedAt: player?.mediaConsentAcceptedAt
            ? player.mediaConsentAcceptedAt.toISOString()
            : null,
        },
      },
      authHeaders,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const guard = applyEndpointRateLimit("auth:login", AUTH_RATE_LIMIT);
    if (guard) return guard;

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

    if (parsed.data.portal === "admin") {
      if (!isAdmin(user, assignments)) {
        return jsonResponse(
          403,
          { ok: false, error: "Access denied. Administrator privileges required." },
          authHeaders,
        );
      }
    } else if (parsed.data.portal === "standard") {
      if (isAdmin(user, assignments)) {
        return jsonResponse(
          403,
          { ok: false, error: "Administrator accounts must sign in at /admin/login." },
          authHeaders,
        );
      }
    }

    const authenticatedUser = await claimMatchingPlayerInvitations(prisma, user);
    const issued = await issueSession(authenticatedUser, assignments);
    const headers = new Headers(authHeaders);
    headers.append("set-cookie", issued.accessCookie);
    headers.append("set-cookie", issued.refreshCookie);

    return jsonResponse(
      200,
      { ok: true, user: toPublicUser(authenticatedUser, assignments) },
      headers,
    );
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

  if (request.method === "GET" && url.pathname === "/api/reports/export") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const parsed = reportQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid report query" }, authHeaders);

    const requestedCity = parsed.data.citySlug
      ? await prisma.city.findUnique({ where: { slug: parsed.data.citySlug } })
      : null;
    if (parsed.data.citySlug && !requestedCity)
      return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);

    let cityIds: string[] | undefined;
    if (!isAdmin(auth.user, auth.assignments)) {
      const organizerCityIds = auth.assignments
        .filter((assignment) => assignment.role === Role.ORGANIZER && assignment.cityId)
        .map((assignment) => assignment.cityId!);
      if (!organizerCityIds.length)
        return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
      if (requestedCity && !organizerCityIds.includes(requestedCity.id))
        return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
      cityIds = requestedCity ? [requestedCity.id] : organizerCityIds;
    } else if (requestedCity) {
      cityIds = [requestedCity.id];
    }

    const report = await buildReport(prisma, parsed.data.type, {
      ...(cityIds ? { cityIds } : {}),
      ...(parsed.data.countryCode ? { countryCode: parsed.data.countryCode.toUpperCase() } : {}),
      ...(parsed.data.tournamentId ? { tournamentId: parsed.data.tournamentId } : {}),
      ...(parsed.data.organizationId ? { organizationId: parsed.data.organizationId } : {}),
      ...(parsed.data.teamId ? { teamId: parsed.data.teamId } : {}),
      ...(parsed.data.playerId ? { playerId: parsed.data.playerId } : {}),
      ...(parsed.data.volunteerId ? { volunteerId: parsed.data.volunteerId } : {}),
      ...(parsed.data.sponsorId ? { sponsorId: parsed.data.sponsorId } : {}),
      ...(parsed.data.from ? { from: new Date(`${parsed.data.from}T00:00:00.000Z`) } : {}),
      ...(parsed.data.to ? { to: new Date(`${parsed.data.to}T23:59:59.999Z`) } : {}),
    });
    const content =
      parsed.data.format === "csv"
        ? toCsv(report)
        : parsed.data.format === "excel"
          ? toExcelXml(report)
          : toPdf(report);
    const extension = parsed.data.format === "excel" ? "xls" : parsed.data.format;
    const contentType =
      parsed.data.format === "csv"
        ? "text/csv; charset=utf-8"
        : parsed.data.format === "excel"
          ? "application/vnd.ms-excel"
          : "application/pdf";
    const headers = new Headers(authHeaders);
    headers.set("content-type", contentType);
    headers.set(
      "content-disposition",
      `attachment; filename="devkics-${parsed.data.type}.${extension}"`,
    );
    return new Response(content, { status: 200, headers });
  }

  // cities
  if (request.method === "GET" && url.pathname === "/api/cities") {
    const includeAll = url.searchParams.get("includeAll") === "true";
    const userIsAdmin = auth.user ? isAdmin(auth.user, auth.assignments) : false;
    const where = includeAll || userIsAdmin ? {} : { status: CityStatus.LIVE };

    const cities = await prisma.city.findMany({ where, orderBy: { name: "asc" } });
    const headers = new Headers(authHeaders);
    headers.set("cache-control", "public, max-age=60, stale-while-revalidate=120");
    return jsonResponse(200, { ok: true, cities: cities.map(mapCityPayload) }, headers);
  }

  if (request.method === "POST" && url.pathname === "/api/cities") {
    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    if (!isAdmin(auth.user, auth.assignments)) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = createCitySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        400,
        { ok: false, error: "Invalid payload", issues: parsed.error.issues },
        authHeaders,
      );
    }

    const rawSlug =
      parsed.data.slug?.trim() ||
      parsed.data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const slug = rawSlug || "city";

    const existing = await prisma.city.findUnique({ where: { slug } });
    if (existing) {
      return jsonResponse(
        409,
        { ok: false, error: "A city with this slug already exists" },
        authHeaders,
      );
    }

    const city = await prisma.city.create({
      data: {
        name: parsed.data.name.trim(),
        slug,
        country: parsed.data.country.trim(),
        countryCode: parsed.data.countryCode.trim().toUpperCase(),
        tagline: parsed.data.tagline?.trim() || `${parsed.data.name.trim()} chapter`,
        accentImage: parsed.data.accentImage?.trim() || slug,
        status: toCityStatus(parsed.data.status ?? "applications-open"),
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "city.created",
      resourceType: "city",
      resourceId: city.id,
      cityId: city.id,
      newValue: {
        slug: city.slug,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        status: city.status,
      },
    });

    return jsonResponse(201, { ok: true, city: mapCityPayload(city) }, authHeaders);
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

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "city.status.updated",
      resourceType: "city",
      resourceId: updated.id,
      cityId: updated.id,
      oldValue: { status: city.status },
      newValue: { status: updated.status },
    });

    return jsonResponse(200, { ok: true, city: mapCityPayload(updated) }, authHeaders);
  }

  // organizer applications
  if (request.method === "GET" && url.pathname === "/api/applications") {
    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    if (!isAdmin(auth.user, auth.assignments)) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const pagination = paginationSchema.safeParse({
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "20",
    });

    if (!pagination.success) {
      return jsonResponse(400, { ok: false, error: "Invalid pagination" }, authHeaders);
    }

    const { page, pageSize } = pagination.data;
    const skip = (page - 1) * pageSize;

    const applications = await prisma.organizerApplication.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        detail: true,
        submittedAt: true,
        status: true,
      },
      orderBy: { submittedAt: "desc" },
      skip,
      take: pageSize,
    });

    const total = await prisma.organizerApplication.count();

    return jsonResponse(
      200,
      {
        ok: true,
        applications: applications.map(mapApplicationPayload),
        page,
        pageSize,
        total,
      },
      authHeaders,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/applications") {
    const guard = applyEndpointRateLimit("applications:create", APPLICATION_SUBMIT_RATE_LIMIT);
    if (guard) return guard;

    const body = await parseJsonBody(request);
    const parsed = organizerApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    if (parsed.data.agreementAccepted === false) {
      return jsonResponse(
        400,
        { ok: false, error: "You must accept the City Organizer Agreement and Code of Conduct" },
        authHeaders,
      );
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

    await writeAuditLog(prisma, {
      actorId: auth.user?.id ?? null,
      action: "organizer-application.submitted",
      resourceType: "organizer-application",
      resourceId: application.id,
      cityId: application.cityId,
      newValue: {
        city: application.city,
        status: application.status,
        consent: {
          organizerAgreement: true,
          codeOfConduct: true,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    return jsonResponse(
      201,
      { ok: true, application: mapApplicationPayload(application) },
      authHeaders,
    );
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/applications/")) {
    const guard = applyEndpointRateLimit("applications:review", APPLICATION_REVIEW_RATE_LIMIT);
    if (guard) return guard;

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

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "organizer-application.reviewed",
      resourceType: "organizer-application",
      resourceId: updated.id,
      cityId: updated.cityId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, reviewNotes: updated.reviewNotes },
    });

    return jsonResponse(
      200,
      { ok: true, application: mapApplicationPayload(updated) },
      authHeaders,
    );
  }

  // organizations
  if (request.method === "GET" && url.pathname === "/api/organizations") {
    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const pagination = paginationSchema.safeParse({
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "20",
    });

    if (!pagination.success) {
      return jsonResponse(400, { ok: false, error: "Invalid pagination" }, authHeaders);
    }

    const citySlug = url.searchParams.get("citySlug") ?? undefined;
    const city = citySlug
      ? await prisma.city.findUnique({ where: { slug: citySlug }, select: { id: true } })
      : null;

    const isScopedAdmin = city
      ? await canAccessCityOperations(auth.user, auth.assignments, city.id)
      : hasScopedRole(auth.assignments, Role.ADMIN);

    const { page, pageSize } = pagination.data;
    const where = isScopedAdmin
      ? city
        ? { cityId: city.id }
        : undefined
      : {
          ...(city ? { cityId: city.id } : {}),
          ownerUserId: auth.user.id,
        };

    const organizationArgs = {
      select: {
        id: true,
        cityId: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        country: true,
        website: true,
        description: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
        reviewedAt: true,
      },
      orderBy: { submittedAt: "desc" as const },
      skip: (page - 1) * pageSize,
      take: pageSize,
    };

    const organizations = where
      ? await prisma.organization.findMany({ ...organizationArgs, where })
      : await prisma.organization.findMany(organizationArgs);
    const total = where
      ? await prisma.organization.count({ where })
      : await prisma.organization.count();

    return jsonResponse(
      200,
      {
        ok: true,
        organizations: organizations.map(mapOrganizationPayload),
        page,
        pageSize,
        total,
      },
      authHeaders,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/organizations") {
    const guard = applyEndpointRateLimit("organizations:create", APPLICATION_SUBMIT_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = organizationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const city = await prisma.city.findUnique({
      where: { slug: parsed.data.citySlug },
      select: { id: true },
    });
    if (!city) {
      return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    }

    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const created = await prisma.organization.create({
      data: {
        cityId: city.id,
        ownerUserId: auth.user.id,
        name: parsed.data.name,
        slug,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        country: parsed.data.country ?? null,
        website: parsed.data.website ?? null,
        description: parsed.data.description,
        status: OrganizationStatus.SUBMITTED,
      },
      select: {
        id: true,
        cityId: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        country: true,
        website: true,
        description: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "organization.created",
      resourceType: "organization",
      resourceId: created.id,
      cityId: created.cityId,
      newValue: { name: created.name, status: created.status },
    });

    return jsonResponse(
      201,
      { ok: true, organization: mapOrganizationPayload(created) },
      authHeaders,
    );
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/organizations/")) {
    const guard = applyEndpointRateLimit("organizations:review", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const orgId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        cityId: true,
        status: true,
      },
    });

    if (!existing) {
      return jsonResponse(404, { ok: false, error: "Organization not found" }, authHeaders);
    }

    if (!(await canAccessCityOperations(auth.user, auth.assignments, existing.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = organizationReviewSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const nextStatus = statusFromKebab(parsed.data.status, Object.values(OrganizationStatus));
    try {
      assertOrganizationTransition(existing.status, nextStatus);
    } catch (error) {
      return jsonResponse(
        409,
        { ok: false, error: error instanceof Error ? error.message : "Invalid transition" },
        authHeaders,
      );
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        status: nextStatus,
        reviewNotes: parsed.data.reviewNotes ?? null,
        reviewerUserId: auth.user.id,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        cityId: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        country: true,
        website: true,
        description: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "organization.reviewed",
      resourceType: "organization",
      resourceId: updated.id,
      cityId: updated.cityId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, reviewNotes: updated.reviewNotes },
    });

    return jsonResponse(
      200,
      { ok: true, organization: mapOrganizationPayload(updated) },
      authHeaders,
    );
  }

  // tournaments
  if (request.method === "GET" && url.pathname === "/api/tournaments") {
    const citySlug = url.searchParams.get("citySlug") ?? undefined;
    const where = citySlug
      ? {
          city: {
            slug: citySlug,
          },
        }
      : undefined;

    const tournamentQuery = {
      select: {
        id: true,
        cityId: true,
        name: true,
        slug: true,
        season: true,
        format: true,
        venue: true,
        summary: true,
        status: true,
        startDate: true,
        endDate: true,
        tieBreakers: true,
        publishedAt: true,
      },
      orderBy: { startDate: "desc" as const },
    };

    const tournaments = where
      ? await prisma.tournament.findMany({ ...tournamentQuery, where })
      : await prisma.tournament.findMany(tournamentQuery);

    const headers = new Headers(authHeaders);
    headers.set("cache-control", "public, max-age=30, stale-while-revalidate=60");
    return jsonResponse(
      200,
      { ok: true, tournaments: tournaments.map(mapTournamentPayload) },
      headers,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/tournaments") {
    const guard = applyEndpointRateLimit("tournaments:create", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = tournamentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const city = await prisma.city.findUnique({
      where: { slug: parsed.data.citySlug },
      select: { id: true },
    });
    if (!city) {
      return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    }
    if (!(await canAccessCityOperations(auth.user, auth.assignments, city.id))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const created = await prisma.tournament.create({
      data: {
        cityId: city.id,
        updatedByUserId: auth.user.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        season: parsed.data.season,
        format: parsed.data.format,
        venue: parsed.data.venue,
        summary: parsed.data.summary,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        tieBreakers: parsed.data.tieBreakers ?? ["points", "goalDifference", "goalsFor"],
        status: TournamentStatus.DRAFT,
      },
      select: {
        id: true,
        cityId: true,
        name: true,
        slug: true,
        season: true,
        format: true,
        venue: true,
        summary: true,
        status: true,
        startDate: true,
        endDate: true,
        tieBreakers: true,
        publishedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "tournament.created",
      resourceType: "tournament",
      resourceId: created.id,
      cityId: created.cityId,
      newValue: { name: created.name, season: created.season, status: created.status },
    });

    return jsonResponse(201, { ok: true, tournament: mapTournamentPayload(created) }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/tournaments/")) {
    const guard = applyEndpointRateLimit("tournaments:update", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const tournamentId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const existing = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, cityId: true, status: true },
    });
    if (!existing) {
      return jsonResponse(404, { ok: false, error: "Tournament not found" }, authHeaders);
    }
    if (!(await canAccessCityOperations(auth.user, auth.assignments, existing.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = tournamentStatusSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const nextStatus = statusFromKebab(parsed.data.status, Object.values(TournamentStatus));
    try {
      assertTournamentTransition(existing.status, nextStatus);
    } catch (error) {
      return jsonResponse(
        409,
        { ok: false, error: error instanceof Error ? error.message : "Invalid transition" },
        authHeaders,
      );
    }

    const updated = await prisma.tournament.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        updatedByUserId: auth.user.id,
        ...(nextStatus === TournamentStatus.FIXTURES_PUBLISHED ? { publishedAt: new Date() } : {}),
      },
      select: {
        id: true,
        cityId: true,
        name: true,
        slug: true,
        season: true,
        format: true,
        venue: true,
        summary: true,
        status: true,
        startDate: true,
        endDate: true,
        tieBreakers: true,
        publishedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "tournament.status.updated",
      resourceType: "tournament",
      resourceId: updated.id,
      cityId: updated.cityId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    if (nextStatus === TournamentStatus.FIXTURES_PUBLISHED) {
      await notifyCityAudience({
        cityId: updated.cityId,
        createdByUserId: auth.user.id,
        type: "fixtures.published",
        title: "Fixtures published",
        body: `${updated.name} fixtures are now available.`,
        resourceType: "tournament",
        resourceId: updated.id,
      });
    }
    if (
      nextStatus === TournamentStatus.REGISTRATION_OPEN ||
      nextStatus === TournamentStatus.REGISTRATION_CLOSED
    ) {
      await notifyCityAudience({
        cityId: updated.cityId,
        createdByUserId: auth.user.id,
        type: "registration.status",
        title:
          nextStatus === TournamentStatus.REGISTRATION_OPEN
            ? "Registration is open"
            : "Registration is closed",
        body: `${updated.name} registration status has changed.`,
        resourceType: "tournament",
        resourceId: updated.id,
      });
    }

    return jsonResponse(200, { ok: true, tournament: mapTournamentPayload(updated) }, authHeaders);
  }

  // teams
  if (request.method === "GET" && url.pathname === "/api/teams") {
    const tournamentId = url.searchParams.get("tournamentId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "30"), 50);

    const where = {
      ...(tournamentId ? { tournamentId } : {}),
      ...(status ? { status: statusFromKebab(status, Object.values(TeamStatus)) } : {}),
    };

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        select: {
          id: true,
          tournamentId: true,
          organizationId: true,
          groupId: true,
          name: true,
          shortName: true,
          company: true,
          color: true,
          founded: true,
          status: true,
          reviewNotes: true,
          managerUserId: true,
          submittedAt: true,
        },
        orderBy: { submittedAt: "desc" },
        skip: (Math.max(page, 1) - 1) * Math.max(pageSize, 1),
        take: Math.max(pageSize, 1),
      }),
      prisma.team.count({ where }),
    ]);

    const canViewAllTeamReviewNotes =
      Boolean(auth.user) &&
      (isAdmin(auth.user!, auth.assignments) || hasScopedRole(auth.assignments, Role.ORGANIZER));

    return jsonResponse(
      200,
      {
        ok: true,
        teams: teams.map((team) =>
          mapTeamPayload(team, {
            includeReviewNotes:
              canViewAllTeamReviewNotes ||
              (Boolean(auth.user) && team.managerUserId === auth.user?.id),
          }),
        ),
        page,
        pageSize,
        total,
      },
      authHeaders,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/teams") {
    const guard = applyEndpointRateLimit("teams:create", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = teamCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const [tournament, organization] = await Promise.all([
      prisma.tournament.findUnique({
        where: { id: parsed.data.tournamentId },
        select: { id: true, cityId: true },
      }),
      prisma.organization.findUnique({
        where: { id: parsed.data.organizationId },
        select: { id: true, cityId: true, status: true },
      }),
    ]);

    if (!tournament || !organization || organization.cityId !== tournament.cityId) {
      return jsonResponse(
        400,
        { ok: false, error: "Organization/tournament mismatch" },
        authHeaders,
      );
    }
    if (organization.status !== OrganizationStatus.APPROVED) {
      return jsonResponse(409, { ok: false, error: "Organization must be approved" }, authHeaders);
    }

    const created = await prisma.team.create({
      data: {
        tournamentId: parsed.data.tournamentId,
        organizationId: parsed.data.organizationId,
        groupId: parsed.data.groupId ?? null,
        managerUserId: auth.user.id,
        name: parsed.data.name,
        shortName: parsed.data.shortName.toUpperCase(),
        company: parsed.data.company,
        color: parsed.data.color ?? null,
        founded: parsed.data.founded ?? null,
        status: TeamStatus.SUBMITTED,
      },
      select: {
        id: true,
        tournamentId: true,
        organizationId: true,
        groupId: true,
        name: true,
        shortName: true,
        company: true,
        color: true,
        founded: true,
        status: true,
        reviewNotes: true,
        managerUserId: true,
        submittedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "team.created",
      resourceType: "team",
      resourceId: created.id,
      cityId: tournament.cityId,
      newValue: { name: created.name, shortName: created.shortName, status: created.status },
    });

    return jsonResponse(
      201,
      { ok: true, team: mapTeamPayload(created, { includeReviewNotes: true }) },
      authHeaders,
    );
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/teams/")) {
    const guard = applyEndpointRateLimit("teams:review", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const teamId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const existing = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        status: true,
        manager: { select: { email: true } },
        tournament: { select: { cityId: true } },
      },
    });
    if (!existing) {
      return jsonResponse(404, { ok: false, error: "Team not found" }, authHeaders);
    }

    if (!(await canAccessCityOperations(auth.user, auth.assignments, existing.tournament.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = teamReviewSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const nextStatus = statusFromKebab(parsed.data.status, Object.values(TeamStatus));
    try {
      assertTeamTransition(existing.status, nextStatus);
    } catch (error) {
      return jsonResponse(
        409,
        { ok: false, error: error instanceof Error ? error.message : "Invalid transition" },
        authHeaders,
      );
    }

    const updated = await prisma.team.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        reviewNotes: parsed.data.reviewNotes ?? null,
        reviewerUserId: auth.user.id,
        reviewedAt: new Date(),
        ...(nextStatus === TeamStatus.LOCKED ? { squadLockedAt: new Date() } : {}),
      },
      select: {
        id: true,
        tournamentId: true,
        organizationId: true,
        groupId: true,
        name: true,
        shortName: true,
        company: true,
        color: true,
        founded: true,
        status: true,
        reviewNotes: true,
        managerUserId: true,
        submittedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "team.reviewed",
      resourceType: "team",
      resourceId: updated.id,
      cityId: existing.tournament.cityId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, reviewNotes: updated.reviewNotes },
    });
    if (nextStatus === TeamStatus.APPROVED || nextStatus === TeamStatus.REJECTED) {
      await dispatchNotification(
        prisma,
        {
          recipientUserId: null,
          recipientEmail: existing.manager?.email ?? null,
          createdByUserId: auth.user.id,
          type: "team.reviewed",
          title: "Team application updated",
          body: `Your team is ${parsed.data.status}.`,
          resourceType: "team",
          resourceId: updated.id,
          email: true,
        },
        getEmailTransport(),
      );
    }

    return jsonResponse(
      200,
      { ok: true, team: mapTeamPayload(updated, { includeReviewNotes: true }) },
      authHeaders,
    );
  }

  // players
  if (request.method === "GET" && url.pathname === "/api/players") {
    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const tournamentId = url.searchParams.get("tournamentId") ?? undefined;
    const teamId = url.searchParams.get("teamId") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "30"), 300);

    const where = {
      ...(teamId ? { teamId } : {}),
      ...(tournamentId ? { team: { tournamentId } } : {}),
    };

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        select: {
          id: true,
          teamId: true,
          userId: true,
          fullName: true,
          email: true,
          position: true,
          number: true,
          role: true,
          status: true,
          reviewNotes: true,
          submittedAt: true,
        },
        orderBy: { submittedAt: "desc" },
        skip: (Math.max(page, 1) - 1) * Math.max(pageSize, 1),
        take: Math.max(pageSize, 1),
      }),
      prisma.player.count({ where }),
    ]);

    const canViewAllPlayerReviewNotes =
      isAdmin(auth.user, auth.assignments) || hasScopedRole(auth.assignments, Role.ORGANIZER);

    return jsonResponse(
      200,
      {
        ok: true,
        players: players.map((player) =>
          mapPlayerPayload(player, {
            includeReviewNotes: canViewAllPlayerReviewNotes || player.userId === auth.user.id,
          }),
        ),
        page,
        pageSize,
        total,
      },
      authHeaders,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/players") {
    const guard = applyEndpointRateLimit("players:create", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = playerCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const team = await prisma.team.findUnique({
      where: { id: parsed.data.teamId },
      select: {
        id: true,
        name: true,
        status: true,
        managerUserId: true,
        squadLockedAt: true,
        tournamentId: true,
        tournament: { select: { cityId: true } },
      },
    });
    if (!team) {
      return jsonResponse(404, { ok: false, error: "Team not found" }, authHeaders);
    }
    if (
      team.status === TeamStatus.LOCKED ||
      team.status === TeamStatus.DISQUALIFIED ||
      team.squadLockedAt
    ) {
      return jsonResponse(409, { ok: false, error: "Team roster is not open" }, authHeaders);
    }

    const cityId = team.tournament.cityId;
    const isTeamManager = team.managerUserId === auth.user.id;
    const isInternal = await canAccessCityOperations(auth.user, auth.assignments, cityId);
    if (!isTeamManager && !isInternal) {
      return jsonResponse(
        403,
        {
          ok: false,
          error: "Forbidden. Only the team manager or authorized organizers can add players.",
        },
        authHeaders,
      );
    }

    const email = parsed.data.email ? parsed.data.email.toLowerCase().trim() : null;

    let targetUserId: string | null = null;
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        targetUserId = existingUser.id;
      }

      const existingActivePlayer = await prisma.player.findFirst({
        where: {
          team: { tournamentId: team.tournamentId },
          OR: [{ email }, ...(targetUserId ? [{ userId: targetUserId }] : [])],
          status: {
            in: [PlayerStatus.APPROVED, PlayerStatus.PENDING_APPROVAL, PlayerStatus.INVITED],
          },
        },
      });
      if (existingActivePlayer) {
        return jsonResponse(
          409,
          {
            ok: false,
            error: "Player already has an active roster spot or invitation in this tournament",
          },
          authHeaders,
        );
      }
    }

    let initialStatus: PlayerStatus = PlayerStatus.INVITED;
    if (isInternal && parsed.data.status) {
      initialStatus = statusFromKebab(parsed.data.status, Object.values(PlayerStatus));
    } else if (!email && parsed.data.waiverAccepted) {
      initialStatus = PlayerStatus.PENDING_APPROVAL;
    }

    const created = await prisma.player.create({
      data: {
        teamId: parsed.data.teamId,
        userId: targetUserId,
        fullName: parsed.data.fullName,
        email,
        position: parsed.data.position,
        number: parsed.data.number ?? null,
        role: parsed.data.role ?? null,
        dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
        gender: parsed.data.gender ?? null,
        emergencyContactName: parsed.data.emergencyContactName ?? null,
        emergencyContactPhone: parsed.data.emergencyContactPhone ?? null,
        medicalDeclaration: parsed.data.medicalDeclaration ?? null,
        waiverAcceptedAt: parsed.data.waiverAccepted ? new Date() : null,
        mediaConsentAcceptedAt: parsed.data.mediaConsentAccepted ? new Date() : null,
        status: initialStatus,
      },
      select: {
        id: true,
        teamId: true,
        userId: true,
        fullName: true,
        email: true,
        position: true,
        number: true,
        role: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "player.created",
      resourceType: "player",
      resourceId: created.id,
      cityId,
      newValue: {
        fullName: created.fullName,
        position: created.position,
        status: created.status,
        email: created.email,
        consent: {
          waiverAccepted: Boolean(parsed.data.waiverAccepted),
          mediaConsentAccepted: Boolean(parsed.data.mediaConsentAccepted),
        },
      },
    });

    if (created.status === PlayerStatus.INVITED) {
      await dispatchNotification(
        prisma,
        {
          recipientUserId: targetUserId,
          recipientEmail: email,
          createdByUserId: auth.user.id,
          type: "team.invitation",
          title: `Invitation to join ${team.name}`,
          body: `${auth.user.name} has invited you to join ${team.name} as a ${created.position}.`,
          resourceType: "player",
          resourceId: created.id,
          email: Boolean(email),
        },
        getEmailTransport(),
      );
    }

    return jsonResponse(
      201,
      { ok: true, player: mapPlayerPayload(created, { includeReviewNotes: true }) },
      authHeaders,
    );
  }

  // Player invitation accept/decline endpoint
  if (
    request.method === "POST" &&
    (url.pathname.match(/^\/api\/players\/[^/]+\/invitation$/) ||
      url.pathname.match(/^\/api\/players\/[^/]+\/respond$/))
  ) {
    const guard = applyEndpointRateLimit("players:respond", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const segments = url.pathname.split("/");
    const playerId = decodeURIComponent(segments[3] ?? "");

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            status: true,
            squadLockedAt: true,
            managerUserId: true,
            tournamentId: true,
            tournament: { select: { cityId: true } },
          },
        },
      },
    });

    if (!player) {
      return jsonResponse(404, { ok: false, error: "Invitation not found" }, authHeaders);
    }

    if (player.status !== PlayerStatus.INVITED) {
      return jsonResponse(
        409,
        { ok: false, error: "Invitation is no longer pending" },
        authHeaders,
      );
    }

    const normalizedUserEmail = auth.user.email.toLowerCase().trim();
    const normalizedPlayerEmail = player.email ? player.email.toLowerCase().trim() : null;
    const isOwner =
      player.userId === auth.user.id ||
      (normalizedPlayerEmail !== null && normalizedPlayerEmail === normalizedUserEmail);
    if (!isOwner) {
      return jsonResponse(
        403,
        { ok: false, error: "Forbidden. You are not the recipient of this invitation." },
        authHeaders,
      );
    }

    const body = await parseJsonBody(request);
    const parsed = playerInvitationRespondSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    if (parsed.data.action === "accept") {
      if (!parsed.data.waiverAccepted && !player.waiverAcceptedAt) {
        return jsonResponse(
          400,
          {
            ok: false,
            error: "Participation waiver acceptance is required to accept an invitation",
          },
          authHeaders,
        );
      }

      if (
        player.team.status === TeamStatus.LOCKED ||
        player.team.status === TeamStatus.DISQUALIFIED ||
        player.team.squadLockedAt
      ) {
        return jsonResponse(409, { ok: false, error: "Team roster is locked" }, authHeaders);
      }

      const existingSquad = await prisma.player.findFirst({
        where: {
          id: { not: player.id },
          team: { tournamentId: player.team.tournamentId },
          OR: [{ userId: auth.user.id }, { email: normalizedUserEmail }],
          status: {
            in: [PlayerStatus.APPROVED, PlayerStatus.PENDING_APPROVAL],
          },
        },
        include: { team: { select: { name: true } } },
      });

      if (existingSquad) {
        return jsonResponse(
          409,
          {
            ok: false,
            error: `You already have an active or pending squad in this tournament with ${existingSquad.team.name}.`,
          },
          authHeaders,
        );
      }

      const updated = await prisma.player.update({
        where: { id: player.id },
        data: {
          status: PlayerStatus.PENDING_APPROVAL,
          userId: auth.user.id,
          email: normalizedUserEmail,
          waiverAcceptedAt: new Date(),
          mediaConsentAcceptedAt: parsed.data.mediaConsentAccepted
            ? new Date()
            : player.mediaConsentAcceptedAt,
          ...(parsed.data.dateOfBirth ? { dateOfBirth: new Date(parsed.data.dateOfBirth) } : {}),
          ...(parsed.data.emergencyContactName
            ? { emergencyContactName: parsed.data.emergencyContactName }
            : {}),
          ...(parsed.data.emergencyContactPhone
            ? { emergencyContactPhone: parsed.data.emergencyContactPhone }
            : {}),
          ...(parsed.data.medicalDeclaration
            ? { medicalDeclaration: parsed.data.medicalDeclaration }
            : {}),
        },
        select: {
          id: true,
          teamId: true,
          userId: true,
          fullName: true,
          email: true,
          position: true,
          number: true,
          role: true,
          status: true,
          reviewNotes: true,
          submittedAt: true,
        },
      });

      await writeAuditLog(prisma, {
        actorId: auth.user.id,
        action: "player.invitation.accepted",
        resourceType: "player",
        resourceId: updated.id,
        cityId: player.team.tournament.cityId,
        newValue: { status: updated.status, teamId: updated.teamId },
      });

      if (player.team.managerUserId) {
        await dispatchNotification(
          prisma,
          {
            recipientUserId: player.team.managerUserId,
            recipientEmail: null,
            createdByUserId: auth.user.id,
            type: "team.invitation_accepted",
            title: "Player accepted invitation",
            body: `${auth.user.name} accepted the invitation to join ${player.team.name} and is pending roster confirmation.`,
            resourceType: "player",
            resourceId: updated.id,
            email: true,
          },
          getEmailTransport(),
        );
      }

      return jsonResponse(
        200,
        { ok: true, player: mapPlayerPayload(updated, { includeReviewNotes: true }) },
        authHeaders,
      );
    } else {
      const updated = await prisma.player.update({
        where: { id: player.id },
        data: {
          status: PlayerStatus.WITHDRAWN,
          reviewNotes: "Declined by player",
        },
        select: {
          id: true,
          teamId: true,
          userId: true,
          fullName: true,
          email: true,
          position: true,
          number: true,
          role: true,
          status: true,
          reviewNotes: true,
          submittedAt: true,
        },
      });

      if (player.userId) {
        await prisma.user.updateMany({
          where: {
            id: player.userId,
            playerId: player.id,
            teamId: player.teamId,
          },
          data: {
            playerId: null,
            teamId: null,
          },
        });
      }

      await writeAuditLog(prisma, {
        actorId: auth.user.id,
        action: "player.invitation.declined",
        resourceType: "player",
        resourceId: updated.id,
        cityId: player.team.tournament.cityId,
        newValue: { status: updated.status },
      });

      if (player.team.managerUserId) {
        await dispatchNotification(
          prisma,
          {
            recipientUserId: player.team.managerUserId,
            recipientEmail: null,
            createdByUserId: auth.user.id,
            type: "team.invitation_declined",
            title: "Player declined invitation",
            body: `${auth.user.name} declined the invitation to join ${player.team.name}.`,
            resourceType: "player",
            resourceId: updated.id,
            email: true,
          },
          getEmailTransport(),
        );
      }

      return jsonResponse(
        200,
        { ok: true, player: mapPlayerPayload(updated, { includeReviewNotes: true }) },
        authHeaders,
      );
    }
  }

  // Player request-to-join endpoint
  if (request.method === "POST" && url.pathname.match(/^\/api\/teams\/[^/]+\/join-requests$/)) {
    const guard = applyEndpointRateLimit("players:join_request", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const isPlayer = hasScopedRole(auth.assignments, Role.PLAYER);
    if (!isPlayer) {
      return jsonResponse(
        403,
        { ok: false, error: "Forbidden. Only registered players can submit join requests." },
        authHeaders,
      );
    }

    const segments = url.pathname.split("/");
    const teamId = decodeURIComponent(segments[3] ?? "");

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        status: true,
        squadLockedAt: true,
        managerUserId: true,
        tournamentId: true,
        tournament: { select: { cityId: true } },
      },
    });

    if (!team) {
      return jsonResponse(404, { ok: false, error: "Team not found" }, authHeaders);
    }

    if (
      team.status === TeamStatus.LOCKED ||
      team.status === TeamStatus.DISQUALIFIED ||
      team.squadLockedAt
    ) {
      return jsonResponse(409, { ok: false, error: "Team roster is not open" }, authHeaders);
    }

    const normalizedUserEmail = auth.user.email.toLowerCase().trim();

    const existingMembership = await prisma.player.findFirst({
      where: {
        team: { tournamentId: team.tournamentId },
        OR: [{ userId: auth.user.id }, { email: normalizedUserEmail }],
        status: { in: [PlayerStatus.APPROVED, PlayerStatus.PENDING_APPROVAL] },
      },
      include: { team: { select: { name: true } } },
    });

    if (existingMembership) {
      return jsonResponse(
        409,
        {
          ok: false,
          error: `You already have an active or pending squad membership with ${existingMembership.team.name}.`,
        },
        authHeaders,
      );
    }

    const body = await parseJsonBody(request);
    const parsed = playerJoinRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    if (!parsed.data.waiverAccepted) {
      return jsonResponse(
        400,
        { ok: false, error: "Player waiver acceptance is required" },
        authHeaders,
      );
    }

    const created = await prisma.player.create({
      data: {
        teamId: team.id,
        userId: auth.user.id,
        fullName: auth.user.name,
        email: normalizedUserEmail,
        position: parsed.data.position,
        number: parsed.data.number ?? null,
        role: parsed.data.role ?? null,
        dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
        emergencyContactName: parsed.data.emergencyContactName ?? null,
        emergencyContactPhone: parsed.data.emergencyContactPhone ?? null,
        medicalDeclaration: parsed.data.medicalDeclaration ?? null,
        waiverAcceptedAt: new Date(),
        mediaConsentAcceptedAt: parsed.data.mediaConsentAccepted ? new Date() : null,
        status: PlayerStatus.PENDING_APPROVAL,
        reviewNotes: "Player submitted join request",
      },
      select: {
        id: true,
        teamId: true,
        userId: true,
        fullName: true,
        email: true,
        position: true,
        number: true,
        role: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "player.join_request.created",
      resourceType: "player",
      resourceId: created.id,
      cityId: team.tournament.cityId,
      newValue: {
        fullName: created.fullName,
        position: created.position,
        status: created.status,
        teamId: team.id,
      },
    });

    if (team.managerUserId) {
      await dispatchNotification(
        prisma,
        {
          recipientUserId: team.managerUserId,
          recipientEmail: null,
          createdByUserId: auth.user.id,
          type: "team.join_request",
          title: `Join request for ${team.name}`,
          body: `${auth.user.name} has requested to join ${team.name} as a ${created.position}.`,
          resourceType: "player",
          resourceId: created.id,
          email: true,
        },
        getEmailTransport(),
      );
    }

    return jsonResponse(
      201,
      { ok: true, player: mapPlayerPayload(created, { includeReviewNotes: true }) },
      authHeaders,
    );
  }

  // PATCH /api/players/:id (Manager / Organizer player review and roster management)
  if (
    request.method === "PATCH" &&
    url.pathname.startsWith("/api/players/") &&
    !url.pathname.includes("/invitation") &&
    !url.pathname.includes("/respond")
  ) {
    const guard = applyEndpointRateLimit("players:review", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const playerId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const existing = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        teamId: true,
        userId: true,
        status: true,
        email: true,
        fullName: true,
        waiverAcceptedAt: true,
        user: { select: { id: true, email: true } },
        team: {
          select: {
            id: true,
            name: true,
            managerUserId: true,
            status: true,
            squadLockedAt: true,
            tournament: { select: { cityId: true } },
          },
        },
      },
    });

    if (!existing) {
      return jsonResponse(404, { ok: false, error: "Player not found" }, authHeaders);
    }

    const cityId = existing.team.tournament.cityId;
    const isTeamManager = existing.team.managerUserId === auth.user.id;
    const isInternal = await canAccessCityOperations(auth.user, auth.assignments, cityId);
    if (!isTeamManager && !isInternal) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    if (
      !isInternal &&
      (existing.team.status === TeamStatus.LOCKED ||
        existing.team.status === TeamStatus.DISQUALIFIED ||
        existing.team.squadLockedAt)
    ) {
      return jsonResponse(409, { ok: false, error: "Team roster is locked" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = playerReviewSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const nextStatus = statusFromKebab(parsed.data.status, Object.values(PlayerStatus));
    try {
      assertPlayerTransition(existing.status, nextStatus);
    } catch (error) {
      return jsonResponse(
        409,
        { ok: false, error: error instanceof Error ? error.message : "Invalid transition" },
        authHeaders,
      );
    }

    if (nextStatus === PlayerStatus.APPROVED && !existing.waiverAcceptedAt) {
      return jsonResponse(
        400,
        { ok: false, error: "Cannot approve player without accepted participation waiver" },
        authHeaders,
      );
    }

    const updated = await prisma.player.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        reviewNotes: parsed.data.reviewNotes ?? null,
        reviewerUserId: auth.user.id,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        teamId: true,
        userId: true,
        fullName: true,
        email: true,
        position: true,
        number: true,
        role: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
      },
    });

    if (existing.userId) {
      if (nextStatus === PlayerStatus.APPROVED) {
        await prisma.user.update({
          where: { id: existing.userId },
          data: {
            playerId: updated.id,
            teamId: updated.teamId,
          },
        });
      } else if (
        nextStatus === PlayerStatus.WITHDRAWN ||
        nextStatus === PlayerStatus.DISQUALIFIED
      ) {
        await prisma.user.updateMany({
          where: {
            id: existing.userId,
            playerId: existing.id,
            teamId: existing.teamId,
          },
          data: {
            playerId: null,
            teamId: null,
          },
        });
      }
    }

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "player.reviewed",
      resourceType: "player",
      resourceId: updated.id,
      cityId,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, reviewNotes: updated.reviewNotes },
    });

    const targetRecipientEmail = existing.user?.email ?? existing.email;
    if (nextStatus === PlayerStatus.APPROVED) {
      await dispatchNotification(
        prisma,
        {
          recipientUserId: existing.userId,
          recipientEmail: targetRecipientEmail,
          createdByUserId: auth.user.id,
          type: "player.reviewed",
          title: "Player registration approved",
          body: `Your squad membership for ${existing.team.name} has been approved.`,
          resourceType: "player",
          resourceId: updated.id,
          email: Boolean(targetRecipientEmail),
        },
        getEmailTransport(),
      );
    } else if (nextStatus === PlayerStatus.WITHDRAWN || nextStatus === PlayerStatus.DISQUALIFIED) {
      await dispatchNotification(
        prisma,
        {
          recipientUserId: existing.userId,
          recipientEmail: targetRecipientEmail,
          createdByUserId: auth.user.id,
          type: "player.reviewed",
          title: "Player registration updated",
          body: `Your squad membership for ${existing.team.name} is ${parsed.data.status}.`,
          resourceType: "player",
          resourceId: updated.id,
          email: Boolean(targetRecipientEmail),
        },
        getEmailTransport(),
      );
    }

    return jsonResponse(
      200,
      { ok: true, player: mapPlayerPayload(updated, { includeReviewNotes: true }) },
      authHeaders,
    );
  }

  // fixtures and results
  if (request.method === "GET" && url.pathname === "/api/fixtures") {
    const tournamentId = url.searchParams.get("tournamentId");
    if (!tournamentId) {
      return jsonResponse(400, { ok: false, error: "tournamentId is required" }, authHeaders);
    }

    const fixtures = await prisma.fixture.findMany({
      where: { tournamentId },
      select: {
        id: true,
        tournamentId: true,
        groupId: true,
        homeTeamId: true,
        awayTeamId: true,
        stage: true,
        roundLabel: true,
        matchday: true,
        kickoffAt: true,
        venue: true,
        status: true,
        match: {
          select: {
            homeScore: true,
            awayScore: true,
            halfTimeHome: true,
            halfTimeAway: true,
            extraTimeHome: true,
            extraTimeAway: true,
            penaltyHome: true,
            penaltyAway: true,
          },
        },
      },
      orderBy: [{ matchday: "asc" }, { kickoffAt: "asc" }],
    });

    const headers = new Headers(authHeaders);
    headers.set("cache-control", "public, max-age=10, stale-while-revalidate=30");
    return jsonResponse(200, { ok: true, fixtures: fixtures.map(mapFixturePayload) }, headers);
  }

  if (request.method === "POST" && url.pathname === "/api/fixtures") {
    const guard = applyEndpointRateLimit("fixtures:create", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = fixtureCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }
    if (parsed.data.homeTeamId === parsed.data.awayTeamId) {
      return jsonResponse(400, { ok: false, error: "Teams must be different" }, authHeaders);
    }

    const tournament = await resolveTournamentScope(parsed.data.tournamentId);
    if (!tournament) {
      return jsonResponse(404, { ok: false, error: "Tournament not found" }, authHeaders);
    }
    if (!(await canAccessCityOperations(auth.user, auth.assignments, tournament.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const kickoffAt = new Date(`${parsed.data.date}T${parsed.data.time}:00.000Z`);

    const created = await prisma.fixture.create({
      data: {
        tournamentId: parsed.data.tournamentId,
        groupId: parsed.data.groupId ?? null,
        homeTeamId: parsed.data.homeTeamId,
        awayTeamId: parsed.data.awayTeamId,
        stage: parsed.data.stage === "knockout" ? MatchStage.KNOCKOUT : MatchStage.GROUP,
        roundLabel: parsed.data.roundLabel ?? null,
        matchday: parsed.data.matchday,
        kickoffAt,
        venue: parsed.data.venue,
        createdByUserId: auth.user.id,
      },
      select: {
        id: true,
        tournamentId: true,
        groupId: true,
        homeTeamId: true,
        awayTeamId: true,
        stage: true,
        roundLabel: true,
        matchday: true,
        kickoffAt: true,
        venue: true,
        status: true,
        match: {
          select: {
            homeScore: true,
            awayScore: true,
            halfTimeHome: true,
            halfTimeAway: true,
            extraTimeHome: true,
            extraTimeAway: true,
            penaltyHome: true,
            penaltyAway: true,
          },
        },
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "fixture.created",
      resourceType: "fixture",
      resourceId: created.id,
      cityId: tournament.cityId,
      newValue: {
        homeTeamId: created.homeTeamId,
        awayTeamId: created.awayTeamId,
        matchday: created.matchday,
        venue: created.venue,
      },
    });

    return jsonResponse(201, { ok: true, fixture: mapFixturePayload(created) }, authHeaders);
  }

  if (request.method === "POST" && url.pathname === "/api/fixtures/generate") {
    const guard = applyEndpointRateLimit("fixtures:generate", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = fixtureGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const tournament = await resolveTournamentScope(parsed.data.tournamentId);
    if (!tournament) {
      return jsonResponse(404, { ok: false, error: "Tournament not found" }, authHeaders);
    }
    if (!(await canAccessCityOperations(auth.user, auth.assignments, tournament.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const teams = await prisma.team.findMany({
      where: {
        tournamentId: parsed.data.tournamentId,
        status: TeamStatus.APPROVED,
        ...(parsed.data.groupId ? { groupId: parsed.data.groupId } : {}),
      },
      select: { id: true },
      orderBy: { name: "asc" },
    });

    const generated = generateRoundRobinFixtures({
      teamIds: teams.map((team) => team.id),
      kickoffStart: new Date(parsed.data.kickoffStart),
      venue: parsed.data.venue,
      groupId: parsed.data.groupId ?? null,
      ...(parsed.data.matchIntervalMinutes
        ? { matchIntervalMinutes: parsed.data.matchIntervalMinutes }
        : {}),
    });

    if (!generated.length) {
      return jsonResponse(200, { ok: true, fixtures: [] }, authHeaders);
    }

    const created = await prisma.$transaction(
      generated.map((fixture) =>
        prisma.fixture.create({
          data: {
            tournamentId: parsed.data.tournamentId,
            groupId: fixture.groupId,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            stage: fixture.stage,
            roundLabel: fixture.roundLabel,
            matchday: fixture.matchday,
            kickoffAt: fixture.kickoffAt,
            venue: fixture.venue,
            createdByUserId: auth.user.id,
          },
          select: {
            id: true,
            tournamentId: true,
            groupId: true,
            homeTeamId: true,
            awayTeamId: true,
            stage: true,
            roundLabel: true,
            matchday: true,
            kickoffAt: true,
            venue: true,
            status: true,
            match: {
              select: {
                homeScore: true,
                awayScore: true,
                halfTimeHome: true,
                halfTimeAway: true,
                extraTimeHome: true,
                extraTimeAway: true,
                penaltyHome: true,
                penaltyAway: true,
              },
            },
          },
        }),
      ),
    );

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "fixtures.generated",
      resourceType: "tournament",
      resourceId: tournament.id,
      cityId: tournament.cityId,
      newValue: { fixtureCount: created.length, groupId: parsed.data.groupId ?? null },
    });

    return jsonResponse(201, { ok: true, fixtures: created.map(mapFixturePayload) }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/matches/")) {
    const guard = applyEndpointRateLimit("matches:result", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const fixtureId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const fixture = await prisma.fixture.findUnique({
      where: { id: fixtureId },
      select: {
        id: true,
        tournamentId: true,
        stage: true,
        homeTeamId: true,
        awayTeamId: true,
        match: {
          select: {
            homeScore: true,
            awayScore: true,
            halfTimeHome: true,
            halfTimeAway: true,
            extraTimeHome: true,
            extraTimeAway: true,
            penaltyHome: true,
            penaltyAway: true,
            notes: true,
          },
        },
        tournament: { select: { cityId: true } },
      },
    });

    if (!fixture) {
      return jsonResponse(404, { ok: false, error: "Fixture not found" }, authHeaders);
    }
    if (!(await canAccessCityOperations(auth.user, auth.assignments, fixture.tournament.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = matchResultSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const saved = await prisma.$transaction(async (tx) => {
      const match = await tx.match.upsert({
        where: { fixtureId: fixture.id },
        update: {
          homeScore: parsed.data.homeScore,
          awayScore: parsed.data.awayScore,
          halfTimeHome: parsed.data.halfTimeHome ?? null,
          halfTimeAway: parsed.data.halfTimeAway ?? null,
          extraTimeHome: parsed.data.extraTimeHome ?? null,
          extraTimeAway: parsed.data.extraTimeAway ?? null,
          penaltyHome: parsed.data.penaltyHome ?? null,
          penaltyAway: parsed.data.penaltyAway ?? null,
          notes: parsed.data.notes ?? null,
          reviewerUserId: auth.user.id,
          verifiedAt: new Date(),
        },
        create: {
          fixtureId: fixture.id,
          homeScore: parsed.data.homeScore,
          awayScore: parsed.data.awayScore,
          halfTimeHome: parsed.data.halfTimeHome ?? null,
          halfTimeAway: parsed.data.halfTimeAway ?? null,
          extraTimeHome: parsed.data.extraTimeHome ?? null,
          extraTimeAway: parsed.data.extraTimeAway ?? null,
          penaltyHome: parsed.data.penaltyHome ?? null,
          penaltyAway: parsed.data.penaltyAway ?? null,
          notes: parsed.data.notes ?? null,
          reviewerUserId: auth.user.id,
          verifiedAt: new Date(),
        },
      });

      await tx.matchEvent.deleteMany({ where: { matchId: match.id } });
      if (parsed.data.events.length) {
        await tx.matchEvent.createMany({
          data: parsed.data.events.map((event) => ({
            matchId: match.id,
            type: toMatchEventType(event.type),
            teamId: event.teamId ?? null,
            playerId: event.playerId ?? null,
            relatedPlayerId: event.relatedPlayerId ?? null,
            period: event.period,
            minute: event.minute ?? null,
            stoppageMinute: event.stoppageMinute ?? null,
            detail: event.detail ?? null,
          })),
        });
      }

      await tx.fixture.update({
        where: { id: fixture.id },
        data: { status: MatchStatus.COMPLETED },
      });

      return match;
    });

    const eventStats = aggregateMatchStatistics(
      await prisma.matchEvent.findMany({
        where: { matchId: saved.id },
        select: { teamId: true, playerId: true, type: true },
      }),
    );

    await refreshStandings(fixture.tournamentId);
    if (fixture.stage === MatchStage.KNOCKOUT) {
      await maybeAdvanceKnockout(fixture.id);
    }

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "match.result.recorded",
      resourceType: "fixture",
      resourceId: fixture.id,
      cityId: fixture.tournament.cityId,
      oldValue: fixture.match
        ? {
            homeScore: fixture.match.homeScore,
            awayScore: fixture.match.awayScore,
            halfTimeHome: fixture.match.halfTimeHome,
            halfTimeAway: fixture.match.halfTimeAway,
            extraTimeHome: fixture.match.extraTimeHome,
            extraTimeAway: fixture.match.extraTimeAway,
            penaltyHome: fixture.match.penaltyHome,
            penaltyAway: fixture.match.penaltyAway,
            notes: fixture.match.notes,
          }
        : { match: null },
      newValue: {
        homeScore: parsed.data.homeScore,
        awayScore: parsed.data.awayScore,
        goalsTrackedTeams: [...eventStats.teamGoals.keys()],
      },
    });

    const updatedFixture = await prisma.fixture.findUnique({
      where: { id: fixture.id },
      select: {
        id: true,
        tournamentId: true,
        groupId: true,
        homeTeamId: true,
        awayTeamId: true,
        stage: true,
        roundLabel: true,
        matchday: true,
        kickoffAt: true,
        venue: true,
        status: true,
        match: {
          select: {
            homeScore: true,
            awayScore: true,
            halfTimeHome: true,
            halfTimeAway: true,
            extraTimeHome: true,
            extraTimeAway: true,
            penaltyHome: true,
            penaltyAway: true,
          },
        },
      },
    });

    return jsonResponse(
      200,
      { ok: true, fixture: updatedFixture ? mapFixturePayload(updatedFixture) : null },
      authHeaders,
    );
  }

  if (request.method === "GET" && url.pathname === "/api/standings") {
    const tournamentId = url.searchParams.get("tournamentId");
    if (!tournamentId) {
      return jsonResponse(400, { ok: false, error: "tournamentId is required" }, authHeaders);
    }

    const standings = await prisma.standing.findMany({
      where: { tournamentId },
      select: {
        teamId: true,
        groupId: true,
        played: true,
        won: true,
        drawn: true,
        lost: true,
        goalsFor: true,
        goalsAgainst: true,
        goalDifference: true,
        points: true,
        form: true,
        rank: true,
      },
      orderBy: [{ groupId: "asc" }, { rank: "asc" }],
    });

    const headers = new Headers(authHeaders);
    headers.set("cache-control", "public, max-age=10, stale-while-revalidate=30");
    return jsonResponse(200, { ok: true, standings }, headers);
  }

  if (request.method === "GET" && url.pathname === "/api/knockout") {
    const tournamentId = url.searchParams.get("tournamentId");
    if (!tournamentId) {
      return jsonResponse(400, { ok: false, error: "tournamentId is required" }, authHeaders);
    }

    const rounds = await prisma.knockoutRound.findMany({
      where: { tournamentId },
      select: {
        id: true,
        name: true,
        roundOrder: true,
        links: {
          select: {
            id: true,
            fromFixtureId: true,
            toFixtureId: true,
            winnerToSide: true,
          },
        },
      },
      orderBy: { roundOrder: "asc" },
    });

    return jsonResponse(200, { ok: true, rounds }, authHeaders);
  }

  // awards
  if (request.method === "GET" && url.pathname === "/api/awards") {
    const tournamentId = url.searchParams.get("tournamentId");
    if (!tournamentId) {
      return jsonResponse(400, { ok: false, error: "tournamentId is required" }, authHeaders);
    }

    const awards = await prisma.award.findMany({
      where: { tournamentId },
      select: {
        id: true,
        name: true,
        description: true,
        assignments: {
          select: {
            id: true,
            recipientType: true,
            teamId: true,
            playerId: true,
            note: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return jsonResponse(200, { ok: true, awards }, authHeaders);
  }

  if (request.method === "POST" && url.pathname === "/api/awards") {
    const guard = applyEndpointRateLimit("awards:create", TOURNAMENT_MUTATION_RATE_LIMIT);
    if (guard) return guard;

    if (!auth.user) {
      return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    }

    const body = await parseJsonBody(request);
    const parsed = awardCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    const tournament = await resolveTournamentScope(parsed.data.tournamentId);
    if (!tournament) {
      return jsonResponse(404, { ok: false, error: "Tournament not found" }, authHeaders);
    }
    if (!(await canAccessCityOperations(auth.user, auth.assignments, tournament.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }

    if (parsed.data.recipientType === "team" && !parsed.data.teamId) {
      return jsonResponse(
        400,
        { ok: false, error: "teamId is required for team awards" },
        authHeaders,
      );
    }
    if (parsed.data.recipientType === "player" && !parsed.data.playerId) {
      return jsonResponse(
        400,
        { ok: false, error: "playerId is required for player awards" },
        authHeaders,
      );
    }

    const award = await prisma.award.create({
      data: {
        tournamentId: parsed.data.tournamentId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        assignments: {
          create: {
            recipientType:
              parsed.data.recipientType === "team"
                ? AwardRecipientType.TEAM
                : AwardRecipientType.PLAYER,
            teamId: parsed.data.teamId ?? null,
            playerId: parsed.data.playerId ?? null,
            assignedByUserId: auth.user.id,
            note: parsed.data.note ?? null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        assignments: {
          select: {
            id: true,
            recipientType: true,
            teamId: true,
            playerId: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "award.assigned",
      resourceType: "award",
      resourceId: award.id,
      cityId: tournament.cityId,
      newValue: {
        recipientType: parsed.data.recipientType,
        teamId: parsed.data.teamId ?? null,
        playerId: parsed.data.playerId ?? null,
      },
    });

    return jsonResponse(201, { ok: true, award }, authHeaders);
  }

  // Phase 3: volunteers
  if (request.method === "POST" && url.pathname === "/api/volunteer-applications") {
    const guard = applyEndpointRateLimit("volunteers:create", APPLICATION_SUBMIT_RATE_LIMIT);
    if (guard) return guard;

    const parsed = volunteerApplicationSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    }

    if (parsed.data.agreementAccepted === false) {
      return jsonResponse(
        400,
        { ok: false, error: "You must accept the Volunteer Agreement and Code of Conduct" },
        authHeaders,
      );
    }

    const city = await prisma.city.findUnique({ where: { slug: parsed.data.citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);

    const application = await prisma.volunteerApplication.create({
      data: {
        cityId: city.id,
        applicantUserId: auth.user?.id ?? null,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        availability: parsed.data.availability,
      },
    });
    await writeAuditLog(prisma, {
      actorId: auth.user?.id ?? null,
      action: "volunteer.application.submitted",
      resourceType: "volunteer_application",
      resourceId: application.id,
      cityId: city.id,
      newValue: {
        role: application.role,
        consent: {
          volunteerAgreement: true,
          codeOfConduct: true,
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    return jsonResponse(201, { ok: true, application }, authHeaders);
  }

  if (request.method === "GET" && url.pathname === "/api/volunteer-applications") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const citySlug = url.searchParams.get("citySlug");
    if (!citySlug)
      return jsonResponse(400, { ok: false, error: "citySlug is required" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, city.id))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }
    const pagination = paginationSchema.safeParse({
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "20",
    });
    if (!pagination.success)
      return jsonResponse(400, { ok: false, error: "Invalid pagination" }, authHeaders);
    const { page, pageSize } = pagination.data;
    const [applications, total] = await Promise.all([
      prisma.volunteerApplication.findMany({
        where: { cityId: city.id },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.volunteerApplication.count({ where: { cityId: city.id } }),
    ]);
    return jsonResponse(200, { ok: true, applications, page, pageSize, total }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/volunteer-applications/")) {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const application = await prisma.volunteerApplication.findUnique({ where: { id } });
    if (!application)
      return jsonResponse(
        404,
        { ok: false, error: "Volunteer application not found" },
        authHeaders,
      );
    if (!(await canAccessCityOperations(auth.user, auth.assignments, application.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }
    const parsed = volunteerReviewSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const status = statusFromKebab(parsed.data.status, Object.values(VolunteerApplicationStatus));
    try {
      assertVolunteerApplicationTransition(application.status, status);
    } catch (error) {
      return jsonResponse(
        409,
        { ok: false, error: error instanceof Error ? error.message : "Invalid transition" },
        authHeaders,
      );
    }
    if (parsed.data.tournamentId) {
      const tournament = await resolveTournamentScope(parsed.data.tournamentId);
      if (!tournament || tournament.cityId !== application.cityId) {
        return jsonResponse(
          400,
          { ok: false, error: "Invalid tournament assignment" },
          authHeaders,
        );
      }
    }
    const updated = await prisma.$transaction(async (tx) => {
      const reviewed = await tx.volunteerApplication.update({
        where: { id },
        data: {
          status,
          reviewNotes: parsed.data.reviewNotes ?? null,
          reviewerUserId: auth.user!.id,
          reviewedAt: new Date(),
        },
      });
      if (status === VolunteerApplicationStatus.APPROVED) {
        await tx.volunteer.upsert({
          where: { applicationId: id },
          update: { role: application.role, tournamentId: parsed.data.tournamentId ?? null },
          create: {
            cityId: application.cityId,
            applicationId: id,
            userId: application.applicantUserId,
            role: application.role,
            tournamentId: parsed.data.tournamentId ?? null,
          },
        });
      }
      return reviewed;
    });
    await dispatchNotification(
      prisma,
      {
        recipientUserId: application.applicantUserId,
        recipientEmail: application.email,
        createdByUserId: auth.user.id,
        type: "volunteer.application.status",
        title: "Volunteer application updated",
        body: `Your volunteer application is ${parsed.data.status}.`,
        resourceType: "volunteer_application",
        resourceId: id,
        email: true,
      },
      getEmailTransport(),
    );
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "volunteer.application.reviewed",
      resourceType: "volunteer_application",
      resourceId: id,
      cityId: application.cityId,
      oldValue: { status: application.status },
      newValue: { status, tournamentId: parsed.data.tournamentId ?? null },
    });
    return jsonResponse(200, { ok: true, application: updated }, authHeaders);
  }

  if (request.method === "GET" && url.pathname === "/api/volunteer-requirements") {
    const tournamentId = url.searchParams.get("tournamentId");
    if (!tournamentId)
      return jsonResponse(400, { ok: false, error: "tournamentId is required" }, authHeaders);
    const tournament = await resolveTournamentScope(tournamentId);
    if (!tournament)
      return jsonResponse(404, { ok: false, error: "Tournament not found" }, authHeaders);
    const requirements = await prisma.volunteerRequirement.findMany({
      where: { tournamentId },
      orderBy: { role: "asc" },
    });
    const volunteers = await prisma.volunteer.groupBy({
      where: { tournamentId },
      by: ["role"],
      _count: { id: true },
    });
    return jsonResponse(
      200,
      {
        ok: true,
        requirements: requirements.map((item) => ({
          ...item,
          approvedCount:
            volunteers.find((volunteer) => volunteer.role === item.role)?._count.id ?? 0,
        })),
      },
      authHeaders,
    );
  }

  if (request.method === "PUT" && url.pathname === "/api/volunteer-requirements") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const parsed = volunteerRequirementSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const tournament = await resolveTournamentScope(parsed.data.tournamentId);
    if (!tournament)
      return jsonResponse(404, { ok: false, error: "Tournament not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, tournament.cityId)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const existingRequirement = await prisma.volunteerRequirement.findUnique({
      where: {
        tournamentId_role: { tournamentId: parsed.data.tournamentId, role: parsed.data.role },
      },
    });
    const requirement = await prisma.volunteerRequirement.upsert({
      where: {
        tournamentId_role: { tournamentId: parsed.data.tournamentId, role: parsed.data.role },
      },
      update: { requiredCount: parsed.data.requiredCount },
      create: parsed.data,
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "volunteer.requirement.updated",
      resourceType: "volunteer_requirement",
      resourceId: requirement.id,
      cityId: tournament.cityId,
      oldValue: existingRequirement
        ? { role: existingRequirement.role, requiredCount: existingRequirement.requiredCount }
        : { requirement: null },
      newValue: { role: requirement.role, requiredCount: requirement.requiredCount },
    });
    return jsonResponse(200, { ok: true, requirement }, authHeaders);
  }

  if (
    request.method === "POST" &&
    url.pathname.startsWith("/api/volunteers/") &&
    url.pathname.endsWith("/check-ins")
  ) {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const volunteerId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: volunteerId },
      include: { tournament: true },
    });
    if (!volunteer)
      return jsonResponse(404, { ok: false, error: "Volunteer not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, volunteer.cityId)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const parsed = volunteerCheckInSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const checkIn = await prisma.$transaction(async (tx) => {
      const created = await tx.volunteerCheckIn.create({
        data: { volunteerId, note: parsed.data.note ?? null },
      });
      await tx.volunteer.update({
        where: { id: volunteerId },
        data: { attendanceCount: { increment: 1 } },
      });
      return created;
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "volunteer.checked_in",
      resourceType: "volunteer",
      resourceId: volunteerId,
      cityId: volunteer.cityId,
      newValue: { checkInId: checkIn.id },
    });
    return jsonResponse(201, { ok: true, checkIn }, authHeaders);
  }

  if (request.method === "GET" && url.pathname === "/api/volunteers") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const tournamentId = url.searchParams.get("tournamentId");
    if (!tournamentId)
      return jsonResponse(400, { ok: false, error: "tournamentId is required" }, authHeaders);
    const tournament = await resolveTournamentScope(tournamentId);
    if (!tournament)
      return jsonResponse(404, { ok: false, error: "Tournament not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, tournament.cityId)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const volunteers = await prisma.volunteer.findMany({
      where: { tournamentId },
      include: { application: { select: { name: true, email: true } } },
      orderBy: { role: "asc" },
    });
    return jsonResponse(
      200,
      {
        ok: true,
        volunteers: volunteers.map((volunteer) => ({
          id: volunteer.id,
          role: volunteer.role,
          attendanceCount: volunteer.attendanceCount,
          applicant: { name: volunteer.application.name, email: volunteer.application.email },
        })),
      },
      authHeaders,
    );
  }

  // Phase 3: sponsorship enquiries and sponsor publishing
  if (request.method === "POST" && url.pathname === "/api/sponsorship-enquiries") {
    const guard = applyEndpointRateLimit(
      "sponsorship-enquiries:create",
      APPLICATION_SUBMIT_RATE_LIMIT,
    );
    if (guard) return guard;
    const parsed = sponsorshipEnquirySchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: parsed.data.citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    if (parsed.data.tournamentId) {
      const tournament = await resolveTournamentScope(parsed.data.tournamentId);
      if (!tournament || tournament.cityId !== city.id) {
        return jsonResponse(400, { ok: false, error: "Invalid tournament" }, authHeaders);
      }
    }
    const enquiry = await prisma.sponsorshipEnquiry.create({
      data: {
        cityId: city.id,
        tournamentId: parsed.data.tournamentId ?? null,
        name: parsed.data.name,
        email: parsed.data.email,
        organization: parsed.data.organization ?? null,
        message: parsed.data.message,
      },
    });
    const admins = await prisma.roleAssignment.findMany({
      where: { role: Role.ADMIN },
      select: { userId: true, user: { select: { email: true } } },
    });
    await Promise.all(
      admins.map((admin) =>
        dispatchNotification(
          prisma,
          {
            recipientUserId: admin.userId,
            recipientEmail: admin.user.email,
            type: "sponsorship.enquiry.submitted",
            title: "New sponsorship enquiry",
            body: `${enquiry.name} submitted a sponsorship enquiry for ${city.name}.`,
            resourceType: "sponsorship_enquiry",
            resourceId: enquiry.id,
            email: true,
          },
          getEmailTransport(),
        ),
      ),
    );
    await writeAuditLog(prisma, {
      actorId: auth.user?.id ?? null,
      action: "sponsorship.enquiry.submitted",
      resourceType: "sponsorship_enquiry",
      resourceId: enquiry.id,
      cityId: city.id,
    });
    return jsonResponse(201, { ok: true, enquiry }, authHeaders);
  }

  if (request.method === "GET" && url.pathname === "/api/sponsorship-enquiries") {
    if (!auth.user || !isAdmin(auth.user, auth.assignments)) {
      return jsonResponse(
        auth.user ? 403 : 401,
        { ok: false, error: auth.user ? "Forbidden" : "Unauthorized" },
        authHeaders,
      );
    }
    const pagination = paginationSchema.safeParse({
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "20",
    });
    if (!pagination.success) {
      return jsonResponse(400, { ok: false, error: "Invalid pagination" }, authHeaders);
    }
    const { page, pageSize } = pagination.data;
    const [enquiries, total] = await Promise.all([
      prisma.sponsorshipEnquiry.findMany({
        include: { city: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sponsorshipEnquiry.count(),
    ]);
    return jsonResponse(200, { ok: true, enquiries, page, pageSize, total }, authHeaders);
  }

  if (request.method === "GET" && url.pathname === "/api/sponsorships") {
    const citySlug = url.searchParams.get("citySlug");
    if (!citySlug)
      return jsonResponse(400, { ok: false, error: "citySlug is required" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    const isScopedOperator =
      auth.user && (await canAccessCityOperations(auth.user, auth.assignments, city.id));
    const sponsorships = await prisma.sponsorship.findMany({
      where: { cityId: city.id, ...(isScopedOperator ? {} : { isPublished: true }) },
      include: { sponsor: true },
      orderBy: [{ tier: "asc" }, { sortOrder: "asc" }],
    });
    return jsonResponse(200, { ok: true, sponsorships }, authHeaders);
  }

  if (request.method === "POST" && url.pathname === "/api/sponsorships") {
    if (!auth.user || !isAdmin(auth.user, auth.assignments)) {
      return jsonResponse(
        auth.user ? 403 : 401,
        { ok: false, error: auth.user ? "Forbidden" : "Unauthorized" },
        authHeaders,
      );
    }
    const parsed = sponsorSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: parsed.data.citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    const sponsor = await prisma.sponsor.upsert({
      where: { slug: parsed.data.slug },
      update: {
        name: parsed.data.name,
        description: parsed.data.description,
        website: parsed.data.website ?? null,
        logoUrl: parsed.data.logoUrl ?? null,
      },
      create: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description,
        website: parsed.data.website ?? null,
        logoUrl: parsed.data.logoUrl ?? null,
      },
    });
    const sponsorship = await prisma.sponsorship.create({
      data: {
        sponsorId: sponsor.id,
        cityId: city.id,
        tournamentId: parsed.data.tournamentId ?? null,
        tier: statusFromKebab(parsed.data.tier, Object.values(SponsorshipTier)),
        isPublished: parsed.data.isPublished ?? false,
        sortOrder: parsed.data.sortOrder ?? 0,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      },
      include: { sponsor: true },
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "sponsorship.created",
      resourceType: "sponsorship",
      resourceId: sponsorship.id,
      cityId: city.id,
      newValue: {
        sponsorId: sponsor.id,
        tier: sponsorship.tier,
        isPublished: sponsorship.isPublished,
        sortOrder: sponsorship.sortOrder,
      },
    });
    return jsonResponse(201, { ok: true, sponsorship }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/sponsorships/")) {
    if (!auth.user || !isAdmin(auth.user, auth.assignments))
      return jsonResponse(
        auth.user ? 403 : 401,
        { ok: false, error: auth.user ? "Forbidden" : "Unauthorized" },
        authHeaders,
      );
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const existing = await prisma.sponsorship.findUnique({ where: { id } });
    if (!existing)
      return jsonResponse(404, { ok: false, error: "Sponsorship not found" }, authHeaders);
    const parsed = sponsorshipUpdateSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    if (parsed.data.tournamentId) {
      const tournament = await resolveTournamentScope(parsed.data.tournamentId);
      if (!tournament || tournament.cityId !== existing.cityId)
        return jsonResponse(400, { ok: false, error: "Invalid tournament" }, authHeaders);
    }
    const sponsorship = await prisma.sponsorship.update({
      where: { id },
      data: {
        ...(parsed.data.tournamentId === undefined
          ? {}
          : { tournamentId: parsed.data.tournamentId ?? null }),
        ...(parsed.data.tier
          ? { tier: statusFromKebab(parsed.data.tier, Object.values(SponsorshipTier)) }
          : {}),
        ...(parsed.data.isPublished === undefined ? {} : { isPublished: parsed.data.isPublished }),
        ...(parsed.data.sortOrder === undefined ? {} : { sortOrder: parsed.data.sortOrder }),
        ...(parsed.data.startsAt === undefined
          ? {}
          : { startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null }),
        ...(parsed.data.endsAt === undefined
          ? {}
          : { endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null }),
      },
      include: { sponsor: true },
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "sponsorship.updated",
      resourceType: "sponsorship",
      resourceId: id,
      cityId: existing.cityId,
      oldValue: {
        tournamentId: existing.tournamentId,
        tier: existing.tier,
        isPublished: existing.isPublished,
        sortOrder: existing.sortOrder,
      },
      newValue: {
        tournamentId: sponsorship.tournamentId,
        tier: sponsorship.tier,
        isPublished: sponsorship.isPublished,
        sortOrder: sponsorship.sortOrder,
      },
    });
    return jsonResponse(200, { ok: true, sponsorship }, authHeaders);
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/sponsorships/")) {
    if (!auth.user || !isAdmin(auth.user, auth.assignments))
      return jsonResponse(
        auth.user ? 403 : 401,
        { ok: false, error: auth.user ? "Forbidden" : "Unauthorized" },
        authHeaders,
      );
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const existing = await prisma.sponsorship.findUnique({ where: { id } });
    if (!existing)
      return jsonResponse(404, { ok: false, error: "Sponsorship not found" }, authHeaders);
    await prisma.sponsorship.delete({ where: { id } });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "sponsorship.deleted",
      resourceType: "sponsorship",
      resourceId: id,
      cityId: existing.cityId,
      oldValue: {
        sponsorId: existing.sponsorId,
        tournamentId: existing.tournamentId,
        tier: existing.tier,
        isPublished: existing.isPublished,
        sortOrder: existing.sortOrder,
      },
      newValue: { sponsorship: null },
    });
    return jsonResponse(200, { ok: true }, authHeaders);
  }

  // Phase 3: announcements
  if (request.method === "GET" && url.pathname === "/api/announcements") {
    const citySlug = url.searchParams.get("citySlug");
    if (!citySlug)
      return jsonResponse(400, { ok: false, error: "citySlug is required" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    const isScopedOperator =
      auth.user && (await canAccessCityOperations(auth.user, auth.assignments, city.id));
    const announcements = await prisma.announcement.findMany({
      where: {
        cityId: city.id,
        ...(isScopedOperator ? {} : { status: ContentPublishStatus.PUBLISHED }),
      },
      include: { author: { select: { name: true } } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    const headers = new Headers(authHeaders);
    if (!isScopedOperator) {
      headers.set("cache-control", "public, max-age=30, stale-while-revalidate=60");
    } else {
      headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
    }
    return jsonResponse(
      200,
      {
        ok: true,
        announcements: announcements.map(({ author, ...announcement }) => ({
          ...announcement,
          authorName: author?.name ?? null,
        })),
      },
      headers,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/announcements") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const parsed = announcementSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: parsed.data.citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, city.id)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const status = statusFromKebab(parsed.data.status, Object.values(ContentPublishStatus));
    const announcement = await prisma.announcement.create({
      data: {
        cityId: city.id,
        tournamentId: parsed.data.tournamentId ?? null,
        authorUserId: auth.user.id,
        headline: parsed.data.headline,
        excerpt: parsed.data.excerpt,
        body: parsed.data.body,
        category: parsed.data.category,
        featuredImageUrl: parsed.data.featuredImageUrl ?? null,
        status,
        publishedAt: status === ContentPublishStatus.PUBLISHED ? new Date() : null,
      },
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "announcement.created",
      resourceType: "announcement",
      resourceId: announcement.id,
      cityId: city.id,
      newValue: {
        headline: announcement.headline,
        category: announcement.category,
        status,
      },
    });
    if (status === ContentPublishStatus.PUBLISHED) {
      await notifyCityAudience({
        cityId: city.id,
        createdByUserId: auth.user.id,
        type: "announcement.published",
        title: "New city announcement",
        body: announcement.headline,
        resourceType: "announcement",
        resourceId: announcement.id,
      });
    }
    return jsonResponse(201, { ok: true, announcement }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/announcements/")) {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement)
      return jsonResponse(404, { ok: false, error: "Announcement not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, announcement.cityId)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const parsed = announcementUpdateSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const status = parsed.data.status
      ? statusFromKebab(parsed.data.status, Object.values(ContentPublishStatus))
      : announcement.status;
    try {
      assertAnnouncementTransition(announcement.status, status);
    } catch (error) {
      return jsonResponse(
        409,
        { ok: false, error: error instanceof Error ? error.message : "Invalid transition" },
        authHeaders,
      );
    }
    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(parsed.data.tournamentId === undefined
          ? {}
          : { tournamentId: parsed.data.tournamentId ?? null }),
        ...(parsed.data.headline === undefined ? {} : { headline: parsed.data.headline }),
        ...(parsed.data.excerpt === undefined ? {} : { excerpt: parsed.data.excerpt }),
        ...(parsed.data.body === undefined ? {} : { body: parsed.data.body }),
        ...(parsed.data.category === undefined ? {} : { category: parsed.data.category }),
        ...(parsed.data.featuredImageUrl === undefined
          ? {}
          : { featuredImageUrl: parsed.data.featuredImageUrl ?? null }),
        status,
        publishedAt:
          status === ContentPublishStatus.PUBLISHED
            ? (announcement.publishedAt ?? new Date())
            : null,
      },
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "announcement.updated",
      resourceType: "announcement",
      resourceId: id,
      cityId: announcement.cityId,
      oldValue: { status: announcement.status },
      newValue: { status },
    });
    if (
      status === ContentPublishStatus.PUBLISHED &&
      announcement.status !== ContentPublishStatus.PUBLISHED
    ) {
      await notifyCityAudience({
        cityId: announcement.cityId,
        createdByUserId: auth.user.id,
        type: "announcement.published",
        title: "New city announcement",
        body: updated.headline,
        resourceType: "announcement",
        resourceId: updated.id,
      });
    }
    return jsonResponse(200, { ok: true, announcement: updated }, authHeaders);
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/announcements/")) {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement)
      return jsonResponse(404, { ok: false, error: "Announcement not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, announcement.cityId)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const archived = await prisma.announcement.update({
      where: { id },
      data: { status: ContentPublishStatus.ARCHIVED, publishedAt: null },
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "announcement.archived",
      resourceType: "announcement",
      resourceId: id,
      cityId: announcement.cityId,
      oldValue: { status: announcement.status },
      newValue: { status: archived.status },
    });
    return jsonResponse(200, { ok: true, announcement: archived }, authHeaders);
  }

  if (request.method === "GET" && url.pathname === "/api/notifications") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const where = { recipientUserId: auth.user.id, channel: "IN_APP" as const };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return jsonResponse(200, { ok: true, notifications, unreadCount }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname === "/api/notifications/read") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    await prisma.notification.updateMany({
      where: { recipientUserId: auth.user.id, channel: "IN_APP", readAt: null },
      data: { readAt: new Date() },
    });
    return jsonResponse(200, { ok: true }, authHeaders);
  }

  if (request.method === "POST" && url.pathname === "/api/notifications/deliver-queued") {
    if (!auth.user || !isAdmin(auth.user, auth.assignments)) {
      return jsonResponse(
        auth.user ? 403 : 401,
        { ok: false, error: auth.user ? "Forbidden" : "Unauthorized" },
        authHeaders,
      );
    }
    const transport = getEmailTransport();
    if (!transport) {
      return jsonResponse(
        503,
        { ok: false, error: "Email delivery is not configured" },
        authHeaders,
      );
    }
    const result = await deliverQueuedEmailNotifications(prisma, transport);
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "notification.email_queue.delivered",
      resourceType: "notification_email_queue",
      resourceId: "queued-email-delivery",
      newValue: result,
    });
    return jsonResponse(200, { ok: true, ...result }, authHeaders);
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/notifications/")) {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const notification = await prisma.notification.updateMany({
      where: { id, recipientUserId: auth.user.id },
      data: { readAt: new Date() },
    });
    if (!notification.count)
      return jsonResponse(404, { ok: false, error: "Notification not found" }, authHeaders);
    return jsonResponse(200, { ok: true }, authHeaders);
  }

  // Phase 3: galleries and media. Files are stored in Supabase Storage; Prisma keeps metadata only.
  if (request.method === "GET" && url.pathname === "/api/galleries") {
    const citySlug = url.searchParams.get("citySlug");
    if (!citySlug)
      return jsonResponse(400, { ok: false, error: "citySlug is required" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    const galleries = await prisma.gallery.findMany({
      where: { cityId: city.id },
      include: { media: { orderBy: [{ isCover: "desc" }, { createdAt: "desc" }] } },
      orderBy: { createdAt: "desc" },
    });
    const headers = new Headers(authHeaders);
    headers.set("cache-control", "public, max-age=30, stale-while-revalidate=60");
    return jsonResponse(
      200,
      {
        ok: true,
        galleries: galleries.map((gallery) => ({
          ...gallery,
          media: gallery.media.map((media) => ({
            ...media,
            publicUrl: publicGalleryUrl(media.storagePath),
          })),
        })),
      },
      headers,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/galleries") {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const parsed = gallerySchema.safeParse(await parseJsonBody(request));
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid payload" }, authHeaders);
    const city = await prisma.city.findUnique({ where: { slug: parsed.data.citySlug } });
    if (!city) return jsonResponse(404, { ok: false, error: "City not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, city.id)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const gallery = await prisma.gallery.create({
      data: {
        cityId: city.id,
        createdByUserId: auth.user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
      },
    });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "gallery.created",
      resourceType: "gallery",
      resourceId: gallery.id,
      cityId: city.id,
      newValue: { title: gallery.title, description: gallery.description },
    });
    return jsonResponse(201, { ok: true, gallery }, authHeaders);
  }

  if (
    request.method === "POST" &&
    url.pathname.startsWith("/api/galleries/") &&
    url.pathname.endsWith("/media")
  ) {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const galleryId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
    const gallery = await prisma.gallery.findUnique({ where: { id: galleryId } });
    if (!gallery) return jsonResponse(404, { ok: false, error: "Gallery not found" }, authHeaders);
    if (!(await canAccessCityOperations(auth.user, auth.assignments, gallery.cityId)))
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonResponse(400, { ok: false, error: "Image file is required" }, authHeaders);
    }
    const parsed = mediaMetadataSchema.safeParse({
      caption: formData.get("caption") || undefined,
      credit: formData.get("credit") || undefined,
      isCover: formData.get("isCover") === "true",
    });
    if (!parsed.success)
      return jsonResponse(400, { ok: false, error: "Invalid media payload" }, authHeaders);
    let uploaded: Awaited<ReturnType<typeof uploadGalleryMedia>>;
    try {
      uploaded = await uploadGalleryMedia({
        galleryId,
        fileName: file.name,
        mimeType: file.type,
        bytes: await file.arrayBuffer(),
      });
    } catch (error) {
      return jsonResponse(
        400,
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to upload gallery media",
        },
        authHeaders,
      );
    }
    let media;
    try {
      media = await prisma.$transaction(async (tx) => {
        if (parsed.data.isCover)
          await tx.mediaFile.updateMany({ where: { galleryId }, data: { isCover: false } });
        return tx.mediaFile.create({
          data: {
            galleryId,
            fileName: file.name,
            mimeType: file.type,
            storagePath: uploaded.storagePath,
            caption: parsed.data.caption ?? null,
            credit: parsed.data.credit ?? null,
            isCover: parsed.data.isCover ?? false,
          },
        });
      });
    } catch {
      try {
        await deleteGalleryMedia(uploaded.storagePath);
      } catch {
        /* best-effort orphan cleanup */
      }
      return jsonResponse(
        500,
        { ok: false, error: "Unable to persist gallery media" },
        authHeaders,
      );
    }
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "gallery.media.uploaded",
      resourceType: "media_file",
      resourceId: media.id,
      cityId: gallery.cityId,
      newValue: {
        fileName: media.fileName,
        mimeType: media.mimeType,
        caption: media.caption,
        credit: media.credit,
        isCover: media.isCover,
      },
    });
    await notifyCityAudience({
      cityId: gallery.cityId,
      createdByUserId: auth.user.id,
      type: "gallery.media.uploaded",
      title: "New gallery media",
      body: parsed.data.caption ?? `New media added to ${gallery.title}`,
      resourceType: "media_file",
      resourceId: media.id,
    });
    return jsonResponse(
      201,
      { ok: true, media: { ...media, publicUrl: uploaded.publicUrl } },
      authHeaders,
    );
  }

  if (
    request.method === "DELETE" &&
    url.pathname.startsWith("/api/galleries/") &&
    url.pathname.includes("/media/")
  ) {
    if (!auth.user) return jsonResponse(401, { ok: false, error: "Unauthorized" }, authHeaders);
    const [, , , galleryId, , mediaId] = url.pathname.split("/");
    if (!galleryId || !mediaId)
      return jsonResponse(404, { ok: false, error: "Not found" }, authHeaders);
    const media = await prisma.mediaFile.findUnique({
      where: { id: decodeURIComponent(mediaId) },
      include: { gallery: true },
    });
    if (!media || media.galleryId !== decodeURIComponent(galleryId)) {
      return jsonResponse(404, { ok: false, error: "Media not found" }, authHeaders);
    }
    if (!(await canAccessCityOperations(auth.user, auth.assignments, media.gallery.cityId))) {
      return jsonResponse(403, { ok: false, error: "Forbidden" }, authHeaders);
    }
    try {
      await deleteGalleryMedia(media.storagePath);
    } catch (error) {
      return jsonResponse(
        502,
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to delete gallery media",
        },
        authHeaders,
      );
    }
    await prisma.mediaFile.delete({ where: { id: media.id } });
    await writeAuditLog(prisma, {
      actorId: auth.user.id,
      action: "gallery.media.deleted",
      resourceType: "media_file",
      resourceId: media.id,
      cityId: media.gallery.cityId,
      oldValue: {
        fileName: media.fileName,
        mimeType: media.mimeType,
        caption: media.caption,
        credit: media.credit,
        isCover: media.isCover,
      },
      newValue: { mediaFile: null },
    });
    return jsonResponse(200, { ok: true }, authHeaders);
  }

  return jsonResponse(404, { ok: false, error: "Not found" }, authHeaders);
}

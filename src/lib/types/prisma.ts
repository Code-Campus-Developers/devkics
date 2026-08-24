/**
 * Prisma type exports fix for VS Code TypeScript language server compatibility.
 *
 * This file provides a central re-export point for Prisma enums and types
 * to work around VS Code's TypeScript language server import resolution issues
 * with Prisma's package.json exports field.
 *
 * Usage: Import types from @/lib/types/prisma instead of @prisma/client
 * Or directly from .prisma/client for best VS Code compatibility
 */

// Re-export all Prisma types and enums
export type {
  User,
  City,
  RoleAssignment,
  MatchEvent,
  Match,
  Standing,
  KnockoutLink,
  Fixture,
  Player,
  Team,
  Tournament,
  Organization,
  Award,
  AwardAssignment,
  Prisma,
} from ".prisma/client";

// Re-export Prisma enums explicitly
export {
  Role,
  CityStatus,
  OrganizerApplicationStatus,
  OrganizationStatus,
  TournamentStatus,
  TeamStatus,
  PlayerStatus,
  MatchStatus,
  MatchStage,
  MatchEventType,
  KnockoutSide,
  AwardRecipientType,
} from ".prisma/client";

// Re-export the Prisma client instance
export { prisma } from "../server/db";

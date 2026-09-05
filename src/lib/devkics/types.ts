export type Role = "admin" | "organizer" | "manager" | "player";

export interface RoleAssignment {
  role: Role;
  cityId: string | null;
}

export interface City {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  status: "live" | "coming-soon" | "applications-open" | "suspended" | "archived";
  teams: number;
  players: number;
  tagline: string;
  accentImage: string;
}

export interface VolunteerApplication {
  id: string;
  cityId: string;
  name: string;
  email: string;
  role: string;
  availability: string;
  status: "submitted" | "under-review" | "approved" | "rejected" | "withdrawn";
  reviewNotes?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface VolunteerRequirement {
  id: string;
  tournamentId: string;
  role: string;
  requiredCount: number;
  approvedCount: number;
}

export interface VolunteerListItem {
  id: string;
  role: string;
  attendanceCount: number;
  applicant: { name: string; email: string };
}

export interface SponsorshipEnquiry {
  id: string;
  name: string;
  email: string;
  organization?: string | null;
  message: string;
  status: "submitted" | "in-review" | "responded" | "closed";
  createdAt: string;
  city: { name: string; slug: string };
}

export interface Announcement {
  id: string;
  cityId: string;
  tournamentId?: string | null;
  headline: string;
  excerpt: string;
  body: string;
  category: string;
  featuredImageUrl?: string | null;
  status: "draft" | "published" | "archived";
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  authorName?: string | null;
}

export interface GalleryMedia {
  id: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  publicUrl: string;
  caption?: string | null;
  credit?: string | null;
  isCover: boolean;
  createdAt: string;
}

export interface Gallery {
  id: string;
  cityId: string;
  title: string;
  description?: string | null;
  createdAt: string;
  media: GalleryMedia[];
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType?: string | null;
  resourceId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface Tournament {
  id: string;
  slug?: string;
  cityId?: string;
  citySlug: string;
  name: string;
  season: string;
  format: string;
  venue: string;
  startDate: string;
  endDate: string;
  status:
    | "draft"
    | "registration-open"
    | "registration-closed"
    | "fixtures-published"
    | "ongoing"
    | "completed"
    | "postponed"
    | "cancelled"
    | "archived"
    | "upcoming"
    | "in-progress";
  summary: string;
  tieBreakers?: string[];
  publishedAt?: string | null;
}

export interface Organization {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  website?: string | null;
  description: string;
  status:
    | "draft"
    | "submitted"
    | "under-review"
    | "more-info-required"
    | "approved"
    | "rejected"
    | "suspended"
    | "withdrawn";
  reviewNotes?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface Team {
  id: string;
  tournamentId: string;
  organizationId?: string;
  groupId?: string | null;
  name: string;
  shortName: string;
  company: string;
  managerUserId: string;
  managerName: string;
  color: string;
  group: string;
  founded: string;
  status?:
    | "draft"
    | "submitted"
    | "under-review"
    | "approved"
    | "rejected"
    | "suspended"
    | "disqualified"
    | "locked";
  reviewNotes?: string | null;
  squadLockedAt?: string | null;
}

export interface Player {
  id: string;
  teamId: string;
  userId?: string | null;
  name: string;
  fullName?: string;
  email?: string | null;
  position: "GK" | "DEF" | "MID" | "FWD";
  number: number;
  role: string;
  status:
    | "active"
    | "invited"
    | "registration-incomplete"
    | "pending-approval"
    | "approved"
    | "suspended"
    | "withdrawn"
    | "disqualified";
  reviewNotes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  medicalDeclaration?: string | null;
  waiverAcceptedAt?: string | null;
  mediaConsentAcceptedAt?: string | null;
  goals: number;
  assists: number;
}

export interface Fixture {
  id: string;
  tournamentId: string;
  groupId?: string | null;
  stage?: "group" | "knockout";
  roundLabel?: string | null;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  venue: string;
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  extraTimeHome?: number | null;
  extraTimeAway?: number | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  scorers?: string[];
}

export interface MatchEvent {
  type:
    | "goal"
    | "assist"
    | "yellow-card"
    | "red-card"
    | "substitution"
    | "half-time"
    | "extra-time-start"
    | "extra-time-end"
    | "penalty-scored"
    | "penalty-missed";
  teamId?: string;
  playerId?: string;
  relatedPlayerId?: string;
  period?: string;
  minute?: number;
  stoppageMinute?: number;
  detail?: string;
}

export interface KnockoutRound {
  id: string;
  name: string;
  roundOrder: number;
  links: Array<{
    id: string;
    fromFixtureId: string;
    toFixtureId: string;
    winnerToSide: "HOME" | "AWAY";
  }>;
}

export interface Award {
  id: string;
  name: string;
  description?: string | null;
  assignments: Array<{
    id: string;
    recipientType: "TEAM" | "PLAYER";
    teamId?: string | null;
    playerId?: string | null;
    note?: string | null;
    createdAt: string;
  }>;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: "Headline" | "Official" | "Community";
  blurb: string;
  initials: string;
}

export interface NewsItem {
  id: string;
  citySlug: string;
  title: string;
  excerpt: string;
  body: string;
  date: string;
  tag: string;
}

export interface MediaItem {
  id: string;
  citySlug: string;
  caption: string;
  kind: "photo" | "highlight";
  hue: number;
}

export type ApplicationKind = "volunteer" | "city-organizer" | "team" | "player";

export interface Application {
  id: string;
  kind: ApplicationKind;
  name: string;
  email: string;
  city: string;
  detail: string;
  submittedAt: string;
  status:
    | "draft"
    | "pending"
    | "under-review"
    | "more-info-required"
    | "approved"
    | "rejected"
    | "suspended"
    | "withdrawn";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  activeRole: Role;
  roles: RoleAssignment[];
  citySlug?: string;
  teamId?: string;
  playerId?: string;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string[];
}

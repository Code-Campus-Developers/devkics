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
  status: "live" | "coming-soon" | "applications-open";
  teams: number;
  players: number;
  tagline: string;
  accentImage: string;
}

export interface Tournament {
  id: string;
  citySlug: string;
  name: string;
  season: string;
  format: string;
  venue: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "in-progress" | "completed";
  summary: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  shortName: string;
  company: string;
  managerUserId: string;
  managerName: string;
  color: string;
  group: string;
  founded: string;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  number: number;
  role: string;
  status: "active" | "invited";
  goals: number;
  assists: number;
}

export interface Fixture {
  id: string;
  tournamentId: string;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  venue: string;
  status: "scheduled" | "completed";
  homeScore: number | null;
  awayScore: number | null;
  scorers?: string[];
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

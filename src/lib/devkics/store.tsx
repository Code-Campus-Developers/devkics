import { createContext, useCallback, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import * as seed from "./seed";
import type {
  Application,
  ApplicationKind,
  Award,
  Announcement,
  AppNotification,
  City,
  Fixture,
  Gallery,
  KnockoutRound,
  MatchEvent,
  Organization,
  Player,
  StandingRow,
  Team,
  Tournament,
  User,
  VolunteerApplication,
  SponsorshipEnquiry,
} from "./types";

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  role: User["role"];
  acceptedTerms?: boolean;
};

type ResultDetail = {
  halfTimeHome?: number;
  halfTimeAway?: number;
  extraTimeHome?: number;
  extraTimeAway?: number;
  penaltyHome?: number;
  penaltyAway?: number;
  notes?: string;
  events?: MatchEvent[];
};

interface StoreValue {
  teams: Team[];
  players: Player[];
  fixtures: Fixture[];
  applications: Application[];
  organizations: Organization[];
  tournaments: Tournament[];
  standings: StandingRow[];
  knockoutRounds: KnockoutRound[];
  awards: Award[];
  announcements: Announcement[];
  galleries: Gallery[];
  volunteerApplications: VolunteerApplication[];
  sponsorshipEnquiries: SponsorshipEnquiry[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  cities: City[];
  currentUser: User | null;
  bootstrapped: boolean;
  loadingTournamentOps: boolean;
  login: (email: string, password: string, portal?: "standard" | "admin") => Promise<User | null>;
  register: (input: SignUpInput) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  createTeam: (input: {
    name: string;
    shortName: string;
    company: string;
    group: string;
    organizationId?: string;
  }) => Promise<Team>;
  updateTeam: (teamId: string, patch: Partial<Team>) => Promise<void>;
  reviewOrganization: (
    organizationId: string,
    status: Organization["status"],
    reviewNotes?: string,
  ) => Promise<void>;
  addPlayer: (input: {
    teamId: string;
    name: string;
    email?: string;
    position: Player["position"];
    number?: number;
    role?: string;
    status?: Player["status"];
    waiverAccepted?: boolean;
  }) => Promise<Player>;
  invitePlayer: (input: {
    teamId: string;
    name: string;
    email: string;
    position: Player["position"];
    number?: number;
    role?: string;
  }) => Promise<Player>;
  respondToInvitation: (
    playerId: string,
    action: "accept" | "decline" | "clarify",
    options?: {
      preferredPosition?: Player["position"];
      positionNotes?: string | null;
      waiverAccepted?: boolean;
      mediaConsentAccepted?: boolean;
      dateOfBirth?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      medicalDeclaration?: string;
    },
  ) => Promise<Player>;
  requestToJoinTeam: (
    teamId: string,
    input: {
      position: Player["position"];
      number?: number;
      role?: string;
      waiverAccepted: boolean;
      mediaConsentAccepted?: boolean;
      dateOfBirth?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      medicalDeclaration?: string;
    },
  ) => Promise<Player>;
  removePlayer: (playerId: string) => Promise<void>;
  updatePlayer: (
    playerId: string,
    input: {
      position?: Player["position"];
      number?: number | null;
      role?: string | null;
    },
  ) => Promise<void>;
  reviewPlayer: (
    playerId: string,
    status: "approved" | "withdrawn" | "suspended" | "disqualified",
    reviewNotes?: string,
    position?: Player["position"],
  ) => Promise<void>;
  addFixture: (input: {
    homeTeamId: string;
    awayTeamId: string;
    date: string;
    time: string;
    matchday: number;
  }) => Promise<void>;
  updateResult: (
    fixtureId: string,
    homeScore: number,
    awayScore: number,
    detail?: ResultDetail,
  ) => Promise<void>;
  submitApplication: (input: {
    kind: ApplicationKind;
    name: string;
    email: string;
    city: string;
    detail: string;
  }) => Promise<void>;
  reviewApplication: (
    id: string,
    status: Application["status"],
    reviewNotes?: string,
  ) => Promise<void>;
  submitVolunteerApplication: (input: {
    citySlug: string;
    name: string;
    email: string;
    role: string;
    availability: string;
  }) => Promise<void>;
  reviewVolunteerApplication: (
    id: string,
    status: "under-review" | "approved" | "rejected",
    options?: { reviewNotes?: string; tournamentId?: string },
  ) => Promise<void>;
  createAnnouncement: (input: {
    headline: string;
    excerpt: string;
    body: string;
    category: string;
    featuredImageUrl?: string;
    status: "draft" | "published";
  }) => Promise<void>;
  updateAnnouncement: (
    id: string,
    input: Partial<{
      headline: string;
      excerpt: string;
      body: string;
      category: string;
      featuredImageUrl: string;
      status: "draft" | "published";
    }>,
  ) => Promise<void>;
  createGallery: (input: { title: string; description?: string }) => Promise<void>;
  uploadGalleryMedia: (input: {
    galleryId: string;
    file: File;
    caption?: string;
    credit?: string;
    isCover?: boolean;
  }) => Promise<void>;
  deleteGalleryMedia: (galleryId: string, mediaId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  createCity: (input: {
    name: string;
    slug?: string | undefined;
    country: string;
    countryCode: string;
    tagline?: string | undefined;
    accentImage?: string | undefined;
    status?: City["status"] | undefined;
  }) => Promise<City>;
  updateCityStatus: (slug: string, status: City["status"]) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

const QUERY_KEYS = {
  auth: ["auth", "me"] as const,
  cities: ["cities"] as const,
  applications: ["applications"] as const,
  organizations: ["organizations"] as const,
  tournaments: ["tournaments"] as const,
  teams: ["teams"] as const,
  players: ["players"] as const,
  fixtures: ["fixtures"] as const,
  standings: ["standings"] as const,
  knockout: ["knockout"] as const,
  awards: ["awards"] as const,
  announcements: ["announcements"] as const,
  galleries: ["galleries"] as const,
  volunteerApplications: ["volunteer-applications"] as const,
  sponsorshipEnquiries: ["sponsorship-enquiries"] as const,
  notifications: ["notifications"] as const,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "content-type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    [key: string]: unknown;
  };

  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error ?? `Request failed: ${res.status}`);
  }

  return payload as T;
}

function toCurrentUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value["id"] !== "string" ||
    typeof value["name"] !== "string" ||
    typeof value["email"] !== "string"
  ) {
    return null;
  }

  const user: User = {
    id: value["id"],
    name: value["name"],
    email: value["email"],
    role: (value["activeRole"] as User["role"]) ?? "player",
    activeRole: (value["activeRole"] as User["role"]) ?? "player",
    roles: Array.isArray(value["roles"])
      ? (value["roles"]
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const role = (entry as Record<string, unknown>)["role"];
            const cityId = (entry as Record<string, unknown>)["cityId"];
            if (typeof role !== "string") return null;
            return {
              role: role as User["role"],
              cityId: typeof cityId === "string" ? cityId : null,
            };
          })
          .filter(Boolean) as User["roles"])
      : [],
  };

  if (typeof value["citySlug"] === "string") user.citySlug = value["citySlug"];
  if (typeof value["teamId"] === "string") user.teamId = value["teamId"];
  if (typeof value["playerId"] === "string") user.playerId = value["playerId"];

  return user;
}

function normalizeTeam(raw: Partial<Team>): Team {
  const team: Team = {
    id: raw.id ?? "",
    tournamentId: raw.tournamentId ?? "",
    name: raw.name ?? "",
    shortName: raw.shortName ?? "",
    company: raw.company ?? "",
    managerUserId: raw.managerUserId ?? "",
    managerName: raw.managerName ?? "Team manager",
    color: raw.color ?? "green",
    group: raw.group ?? "A",
    founded: raw.founded ?? "2026",
  };
  if (raw.organizationId !== undefined) team.organizationId = raw.organizationId;
  if (raw.groupId !== undefined) team.groupId = raw.groupId;
  if (raw.status !== undefined) team.status = raw.status;
  if (raw.reviewNotes !== undefined) team.reviewNotes = raw.reviewNotes;
  if (raw.squadLockedAt !== undefined) team.squadLockedAt = raw.squadLockedAt;
  return team;
}

function normalizePlayer(raw: Partial<Player>): Player {
  const name = raw.name ?? raw.fullName ?? "";
  const player: Player = {
    id: raw.id ?? "",
    teamId: raw.teamId ?? "",
    name,
    position: (raw.position as Player["position"]) ?? "MID",
    number: raw.number ?? 0,
    role: raw.role ?? "",
    status: raw.status ?? "pending-approval",
    goals: raw.goals ?? 0,
    assists: raw.assists ?? 0,
  };
  if (raw.userId !== undefined) player.userId = raw.userId;
  if (raw.fullName !== undefined || raw.name !== undefined) player.fullName = name;
  if (raw.email !== undefined) player.email = raw.email;
  if (raw.reviewNotes !== undefined) player.reviewNotes = raw.reviewNotes;
  if (raw.emergencyContactName !== undefined)
    player.emergencyContactName = raw.emergencyContactName;
  if (raw.emergencyContactPhone !== undefined)
    player.emergencyContactPhone = raw.emergencyContactPhone;
  if (raw.waiverAcceptedAt !== undefined) player.waiverAcceptedAt = raw.waiverAcceptedAt;
  if (raw.mediaConsentAcceptedAt !== undefined)
    player.mediaConsentAcceptedAt = raw.mediaConsentAcceptedAt;
  if (raw.proposedPosition !== undefined) player.proposedPosition = raw.proposedPosition;
  if (raw.positionNotes !== undefined) player.positionNotes = raw.positionNotes;
  return player;
}

function normalizeVolunteerApplication(raw: VolunteerApplication): VolunteerApplication {
  return {
    ...raw,
    status: raw.status.toLowerCase() as VolunteerApplication["status"],
  };
}

function normalizeSponsorshipEnquiry(raw: SponsorshipEnquiry): SponsorshipEnquiry {
  return {
    ...raw,
    status: raw.status.toLowerCase().replaceAll("_", "-") as SponsorshipEnquiry["status"],
  };
}

function normalizeAnnouncement(raw: Announcement): Announcement {
  return {
    ...raw,
    status: raw.status.toLowerCase() as Announcement["status"],
  };
}

export function DevKicsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: QUERY_KEYS.auth,
    queryFn: async () => {
      const payload = await api<{ user: unknown }>("/api/auth/me", { method: "GET" });
      return toCurrentUser(payload.user);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const currentUser = authQuery.data ?? null;
  const bootstrapped = authQuery.isFetched;
  const citySlug = currentUser?.citySlug ?? "abuja";

  const citiesQuery = useQuery({
    queryKey: QUERY_KEYS.cities,
    queryFn: async () => {
      const payload = await api<{ cities: City[] }>("/api/cities", { method: "GET" });
      return payload.cities;
    },
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const tournamentsQuery = useQuery({
    queryKey: [...QUERY_KEYS.tournaments, citySlug],
    queryFn: async () => {
      const payload = await api<{ tournaments: Tournament[] }>(
        `/api/tournaments?citySlug=${encodeURIComponent(citySlug)}`,
        { method: "GET" },
      );
      return payload.tournaments;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const activeTournament = tournamentsQuery.data?.[0];
  const activeTournamentId = activeTournament?.id;
  const activeTournamentVenue = activeTournament?.venue ?? "Jabi Astro Turf";

  const isAdmin = currentUser?.role === "admin";
  const organizationsQuery = useQuery({
    queryKey: isAdmin
      ? [...QUERY_KEYS.organizations, "all"]
      : [...QUERY_KEYS.organizations, citySlug],
    queryFn: async () => {
      const endpoint = isAdmin
        ? "/api/organizations?page=1&pageSize=100"
        : `/api/organizations?citySlug=${encodeURIComponent(citySlug)}&page=1&pageSize=50`;
      const payload = await api<{ organizations: Organization[] }>(endpoint, { method: "GET" });
      return payload.organizations;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!currentUser,
  });

  const volunteerApplicationsQuery = useQuery({
    queryKey: [...QUERY_KEYS.volunteerApplications, citySlug],
    queryFn: async () => {
      const payload = await api<{ applications: VolunteerApplication[] }>(
        `/api/volunteer-applications?citySlug=${encodeURIComponent(citySlug)}&page=1&pageSize=50`,
        { method: "GET" },
      );
      return payload.applications.map(normalizeVolunteerApplication);
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: currentUser?.role === "admin" || currentUser?.role === "organizer",
  });

  const sponsorshipEnquiriesQuery = useQuery({
    queryKey: QUERY_KEYS.sponsorshipEnquiries,
    queryFn: async () => {
      const payload = await api<{ enquiries: SponsorshipEnquiry[] }>(
        "/api/sponsorship-enquiries?page=1&pageSize=50",
        { method: "GET" },
      );
      return payload.enquiries.map(normalizeSponsorshipEnquiry);
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: currentUser?.role === "admin",
  });

  const announcementsQuery = useQuery({
    queryKey: [...QUERY_KEYS.announcements, citySlug],
    queryFn: async () => {
      const payload = await api<{ announcements: Announcement[] }>(
        `/api/announcements?citySlug=${encodeURIComponent(citySlug)}`,
        { method: "GET" },
      );
      return payload.announcements.map(normalizeAnnouncement);
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!currentUser,
  });

  const galleriesQuery = useQuery({
    queryKey: [...QUERY_KEYS.galleries, citySlug],
    queryFn: async () => {
      const payload = await api<{ galleries: Gallery[] }>(
        `/api/galleries?citySlug=${encodeURIComponent(citySlug)}`,
        { method: "GET" },
      );
      return payload.galleries;
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!currentUser,
  });

  const notificationsQuery = useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: async () => {
      return api<{ notifications: AppNotification[]; unreadCount: number }>("/api/notifications", {
        method: "GET",
      });
    },
    staleTime: 10_000,
    refetchInterval: currentUser ? 10_000 : false,
    refetchOnWindowFocus: true,
    retry: false,
    enabled: !!currentUser,
  });

  const teamsQuery = useQuery({
    queryKey: [...QUERY_KEYS.teams, activeTournamentId],
    queryFn: async () => {
      if (!activeTournamentId) return [] as Team[];
      const payload = await api<{ teams: Team[] }>(
        `/api/teams?tournamentId=${encodeURIComponent(activeTournamentId)}&page=1&pageSize=50`,
        { method: "GET" },
      );
      return payload.teams.map(normalizeTeam);
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!activeTournamentId,
  });

  const playersQuery = useQuery({
    queryKey: [...QUERY_KEYS.players, activeTournamentId, currentUser?.id],
    queryFn: async () => {
      if (!activeTournamentId) return [] as Player[];
      const payload = await api<{ players: Player[] }>(
        `/api/players?tournamentId=${encodeURIComponent(activeTournamentId)}&page=1&pageSize=300`,
        { method: "GET" },
      );
      return payload.players.map(normalizePlayer);
    },
    staleTime: 10_000,
    refetchInterval: currentUser ? 10_000 : false,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!activeTournamentId && !!currentUser,
  });

  const fixturesQuery = useQuery({
    queryKey: [...QUERY_KEYS.fixtures, activeTournamentId],
    queryFn: async () => {
      if (!activeTournamentId) return [] as Fixture[];
      const payload = await api<{ fixtures: Fixture[] }>(
        `/api/fixtures?tournamentId=${encodeURIComponent(activeTournamentId)}`,
        { method: "GET" },
      );
      return payload.fixtures;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!activeTournamentId,
  });

  const standingsQuery = useQuery({
    queryKey: [...QUERY_KEYS.standings, activeTournamentId],
    queryFn: async () => {
      if (!activeTournamentId) return [] as StandingRow[];
      const payload = await api<{ standings: StandingRow[] }>(
        `/api/standings?tournamentId=${encodeURIComponent(activeTournamentId)}`,
        { method: "GET" },
      );
      return payload.standings;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!activeTournamentId,
  });

  const knockoutQuery = useQuery({
    queryKey: [...QUERY_KEYS.knockout, activeTournamentId],
    queryFn: async () => {
      if (!activeTournamentId) return [] as KnockoutRound[];
      const payload = await api<{ rounds: KnockoutRound[] }>(
        `/api/knockout?tournamentId=${encodeURIComponent(activeTournamentId)}`,
        { method: "GET" },
      );
      return payload.rounds;
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!activeTournamentId,
  });

  const awardsQuery = useQuery({
    queryKey: [...QUERY_KEYS.awards, activeTournamentId],
    queryFn: async () => {
      if (!activeTournamentId) return [] as Award[];
      const payload = await api<{ awards: Award[] }>(
        `/api/awards?tournamentId=${encodeURIComponent(activeTournamentId)}`,
        { method: "GET" },
      );
      return payload.awards;
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!activeTournamentId,
  });

  const canViewOrganizerApplications = currentUser?.role === "admin";
  const applicationsQuery = useQuery({
    queryKey: QUERY_KEYS.applications,
    queryFn: async () => {
      const payload = await api<{ applications: Application[] }>(
        "/api/applications?page=1&pageSize=50",
        { method: "GET" },
      );
      return payload.applications;
    },
    enabled: canViewOrganizerApplications,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!canViewOrganizerApplications) {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.applications });
    }
  }, [canViewOrganizerApplications, queryClient]);

  const refreshDomain = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizations }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tournaments }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teams }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixtures }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.standings }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.knockout }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.awards }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.galleries }),
    ]);
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auth });
    await queryClient.refetchQueries({ queryKey: QUERY_KEYS.auth, exact: true });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tournaments }),
      refreshDomain(),
    ]);
  }, [queryClient, refreshDomain]);

  const login = useCallback<StoreValue["login"]>(
    async (email, password, portal) => {
      const payload = await api<{ user: unknown }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, ...(portal ? { portal } : {}) }),
      });
      const user = toCurrentUser(payload.user);
      queryClient.setQueryData(QUERY_KEYS.auth, user);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sponsorshipEnquiries }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
        refreshDomain(),
      ]);
      return user;
    },
    [queryClient, refreshDomain],
  );

  const register = useCallback<StoreValue["register"]>(
    async (input) => {
      const payload = await api<{ user: unknown }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const user = toCurrentUser(payload.user);
      queryClient.setQueryData(QUERY_KEYS.auth, user);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sponsorshipEnquiries }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
        refreshDomain(),
      ]);
      return user;
    },
    [queryClient, refreshDomain],
  );

  const logout = useCallback<StoreValue["logout"]>(async () => {
    await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    queryClient.setQueryData(QUERY_KEYS.auth, null);
    queryClient.removeQueries({ queryKey: QUERY_KEYS.applications });
    queryClient.removeQueries({ queryKey: QUERY_KEYS.sponsorshipEnquiries });
    queryClient.removeQueries({ queryKey: QUERY_KEYS.notifications });
    await refreshDomain();
  }, [queryClient, refreshDomain]);

  const createTeam = useCallback<StoreValue["createTeam"]>(
    async (input) => {
      if (!activeTournamentId) {
        throw new Error("No active tournament available.");
      }
      const approvedOrg = (organizationsQuery.data ?? []).find((org) => org.status === "approved");
      if (!approvedOrg) {
        throw new Error("An approved organization is required before team registration.");
      }

      const payload = await api<{ team: Team }>("/api/teams", {
        method: "POST",
        body: JSON.stringify({
          tournamentId: activeTournamentId,
          organizationId: input.organizationId ?? approvedOrg.id,
          name: input.name,
          shortName: input.shortName,
          company: input.company,
          founded: "2026",
        }),
      });

      await refreshDomain();
      return normalizeTeam(payload.team);
    },
    [activeTournamentId, organizationsQuery.data, refreshDomain],
  );

  const updateTeam = useCallback<StoreValue["updateTeam"]>(
    async (teamId, patch) => {
      if (!patch.status) return;
      await api<{ team: Team }>(`/api/teams/${encodeURIComponent(teamId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: patch.status, reviewNotes: patch.reviewNotes }),
      });
      await refreshDomain();
    },
    [refreshDomain],
  );

  const reviewOrganization = useCallback<StoreValue["reviewOrganization"]>(
    async (organizationId, status, reviewNotes) => {
      await api<{ organization: Organization }>(
        `/api/organizations/${encodeURIComponent(organizationId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, reviewNotes }),
        },
      );
      await refreshDomain();
    },
    [refreshDomain],
  );

  const addPlayer = useCallback<StoreValue["addPlayer"]>(
    async (input) => {
      const payload = await api<{ player: Player }>("/api/players", {
        method: "POST",
        body: JSON.stringify({
          teamId: input.teamId,
          fullName: input.name,
          email: input.email,
          position: input.position,
          number: input.number,
          role: input.role,
          status: input.status,
          waiverAccepted: input.waiverAccepted ?? true,
        }),
      });
      await refreshDomain();
      return normalizePlayer(payload.player);
    },
    [refreshDomain],
  );

  const invitePlayer = useCallback<StoreValue["invitePlayer"]>(
    async (input) => {
      const payload = await api<{ player: Player }>("/api/players", {
        method: "POST",
        body: JSON.stringify({
          teamId: input.teamId,
          fullName: input.name,
          email: input.email,
          position: input.position,
          number: input.number,
          role: input.role,
        }),
      });
      await refreshDomain();
      return normalizePlayer(payload.player);
    },
    [refreshDomain],
  );

  const respondToInvitation = useCallback<StoreValue["respondToInvitation"]>(
    async (playerId, action, options) => {
      const payload = await api<{ player: Player }>(
        `/api/players/${encodeURIComponent(playerId)}/invitation`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            preferredPosition: options?.preferredPosition,
            positionNotes: options?.positionNotes,
            waiverAccepted: options?.waiverAccepted,
            mediaConsentAccepted: options?.mediaConsentAccepted,
            dateOfBirth: options?.dateOfBirth,
            emergencyContactName: options?.emergencyContactName,
            emergencyContactPhone: options?.emergencyContactPhone,
            medicalDeclaration: options?.medicalDeclaration,
          }),
        },
      );
      await refreshDomain();
      return normalizePlayer(payload.player);
    },
    [refreshDomain],
  );

  const requestToJoinTeam = useCallback<StoreValue["requestToJoinTeam"]>(
    async (teamId, input) => {
      const payload = await api<{ player: Player }>(
        `/api/teams/${encodeURIComponent(teamId)}/join-requests`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      await refreshDomain();
      return normalizePlayer(payload.player);
    },
    [refreshDomain],
  );

  const removePlayer = useCallback<StoreValue["removePlayer"]>(
    async (playerId) => {
      await api<{ player: Player }>(`/api/players/${encodeURIComponent(playerId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "withdrawn" }),
      });
      await refreshDomain();
    },
    [refreshDomain],
  );

  const updatePlayer = useCallback<StoreValue["updatePlayer"]>(
    async (playerId, input) => {
      await api<{ player: Player }>(`/api/players/${encodeURIComponent(playerId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      await refreshDomain();
    },
    [refreshDomain],
  );

  const reviewPlayer = useCallback<StoreValue["reviewPlayer"]>(
    async (playerId, status, reviewNotes, position) => {
      await api<{ player: Player }>(`/api/players/${encodeURIComponent(playerId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNotes, position }),
      });
      await refreshDomain();
    },
    [refreshDomain],
  );

  const addFixture = useCallback<StoreValue["addFixture"]>(
    async (input) => {
      if (!activeTournamentId) {
        throw new Error("No active tournament available.");
      }
      await api<{ fixture: Fixture }>("/api/fixtures", {
        method: "POST",
        body: JSON.stringify({
          tournamentId: activeTournamentId,
          homeTeamId: input.homeTeamId,
          awayTeamId: input.awayTeamId,
          date: input.date,
          time: input.time,
          matchday: input.matchday,
          venue: activeTournamentVenue,
          stage: "group",
        }),
      });
      await refreshDomain();
    },
    [activeTournamentId, activeTournamentVenue, refreshDomain],
  );

  const updateResult = useCallback<StoreValue["updateResult"]>(
    async (fixtureId, homeScore, awayScore, detail) => {
      await api<{ fixture: Fixture }>(`/api/matches/${encodeURIComponent(fixtureId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          homeScore,
          awayScore,
          halfTimeHome: detail?.halfTimeHome,
          halfTimeAway: detail?.halfTimeAway,
          extraTimeHome: detail?.extraTimeHome,
          extraTimeAway: detail?.extraTimeAway,
          penaltyHome: detail?.penaltyHome,
          penaltyAway: detail?.penaltyAway,
          notes: detail?.notes,
          events: detail?.events ?? [],
        }),
      });
      await refreshDomain();
    },
    [refreshDomain],
  );

  const submitApplication = useCallback<StoreValue["submitApplication"]>(
    async (input) => {
      if (input.kind === "city-organizer") {
        await api<{ application: Application }>("/api/applications", {
          method: "POST",
          body: JSON.stringify(input),
        });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications });
        return;
      }

      if (input.kind === "team") {
        await api<{ organization: Organization }>("/api/organizations", {
          method: "POST",
          body: JSON.stringify({
            citySlug,
            name: input.name,
            email: input.email,
            description: input.detail,
          }),
        });
        await refreshDomain();
        return;
      }

      throw new Error("This application flow is not available yet.");
    },
    [citySlug, queryClient, refreshDomain],
  );

  const reviewApplication = useCallback<StoreValue["reviewApplication"]>(
    async (id, status, reviewNotes) => {
      await api<{ application: Application }>(`/api/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNotes }),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications });
    },
    [queryClient],
  );

  const submitVolunteerApplication = useCallback<StoreValue["submitVolunteerApplication"]>(
    async (input) => {
      await api<{ application: VolunteerApplication }>("/api/volunteer-applications", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    [],
  );

  const reviewVolunteerApplication = useCallback<StoreValue["reviewVolunteerApplication"]>(
    async (id, status, options) => {
      await api<{ application: VolunteerApplication }>(
        `/api/volunteer-applications/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, ...options }),
        },
      );
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.volunteerApplications });
    },
    [queryClient],
  );

  const createAnnouncement = useCallback<StoreValue["createAnnouncement"]>(
    async (input) => {
      await api<{ announcement: Announcement }>("/api/announcements", {
        method: "POST",
        body: JSON.stringify({ citySlug, ...input }),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements });
    },
    [citySlug, queryClient],
  );

  const updateAnnouncement = useCallback<StoreValue["updateAnnouncement"]>(
    async (id, input) => {
      await api<{ announcement: Announcement }>(`/api/announcements/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements });
    },
    [queryClient],
  );

  const createGallery = useCallback<StoreValue["createGallery"]>(
    async (input) => {
      await api<{ gallery: Gallery }>("/api/galleries", {
        method: "POST",
        body: JSON.stringify({ citySlug, ...input }),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.galleries });
    },
    [citySlug, queryClient],
  );

  const uploadGalleryMedia = useCallback<StoreValue["uploadGalleryMedia"]>(
    async ({ galleryId, file, caption, credit, isCover }) => {
      const formData = new FormData();
      formData.set("file", file);
      if (caption) formData.set("caption", caption);
      if (credit) formData.set("credit", credit);
      if (isCover) formData.set("isCover", "true");
      await api(`/api/galleries/${encodeURIComponent(galleryId)}/media`, {
        method: "POST",
        body: formData,
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.galleries });
    },
    [queryClient],
  );

  const deleteGalleryMedia = useCallback<StoreValue["deleteGalleryMedia"]>(
    async (galleryId, mediaId) => {
      await api(
        `/api/galleries/${encodeURIComponent(galleryId)}/media/${encodeURIComponent(mediaId)}`,
        {
          method: "DELETE",
        },
      );
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.galleries });
    },
    [queryClient],
  );

  const markNotificationRead = useCallback<StoreValue["markNotificationRead"]>(
    async (id) => {
      await api(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH" });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
    [queryClient],
  );

  const markAllNotificationsRead = useCallback<StoreValue["markAllNotificationsRead"]>(async () => {
    await api("/api/notifications/read", { method: "PATCH" });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
  }, [queryClient]);

  const createCity = useCallback<StoreValue["createCity"]>(
    async (input) => {
      const payload = await api<{ ok: boolean; city: City }>("/api/cities", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
      return payload.city;
    },
    [queryClient],
  );

  const updateCityStatus = useCallback<StoreValue["updateCityStatus"]>(
    async (slug, status) => {
      await api<{ city: City }>(`/api/cities/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
    },
    [queryClient],
  );

  const resetDemo = useCallback<StoreValue["resetDemo"]>(async () => {
    await Promise.all([refreshDomain(), refreshSession()]);
  }, [refreshDomain, refreshSession]);

  const teams = teamsQuery.isError ? seed.teams : (teamsQuery.data ?? []);
  const players = !currentUser ? [] : (playersQuery.data ?? []);
  const fixtures = fixturesQuery.isError ? seed.fixtures : (fixturesQuery.data ?? []);

  const value: StoreValue = {
    teams,
    players,
    fixtures,
    applications: applicationsQuery.data ?? [],
    organizations: organizationsQuery.data ?? [],
    tournaments: tournamentsQuery.isError ? seed.tournaments : (tournamentsQuery.data ?? []),
    standings: standingsQuery.data ?? [],
    knockoutRounds: knockoutQuery.data ?? [],
    awards: awardsQuery.data ?? [],
    announcements: announcementsQuery.data ?? [],
    galleries: galleriesQuery.data ?? [],
    volunteerApplications: volunteerApplicationsQuery.data ?? [],
    sponsorshipEnquiries: sponsorshipEnquiriesQuery.data ?? [],
    notifications: notificationsQuery.data?.notifications ?? [],
    unreadNotificationCount: notificationsQuery.data?.unreadCount ?? 0,
    cities: citiesQuery.data ?? seed.cities,
    currentUser,
    bootstrapped,
    loadingTournamentOps:
      tournamentsQuery.isLoading ||
      teamsQuery.isLoading ||
      playersQuery.isLoading ||
      fixturesQuery.isLoading,
    login,
    register,
    logout,
    refreshSession,
    createTeam,
    updateTeam,
    reviewOrganization,
    addPlayer,
    invitePlayer,
    respondToInvitation,
    requestToJoinTeam,
    removePlayer,
    updatePlayer,
    reviewPlayer,
    addFixture,
    updateResult,
    submitApplication,
    reviewApplication,
    submitVolunteerApplication,
    reviewVolunteerApplication,
    createAnnouncement,
    updateAnnouncement,
    createGallery,
    uploadGalleryMedia,
    deleteGalleryMedia,
    markNotificationRead,
    markAllNotificationsRead,
    createCity,
    updateCityStatus,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDevKics() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useDevKics must be used inside DevKicsProvider");
  return ctx;
}

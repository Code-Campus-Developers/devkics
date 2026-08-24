import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import * as seed from "./seed";
import type { Application, ApplicationKind, City, Fixture, Player, Team, User } from "./types";

interface ApiResponse<T> {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
  data?: T;
}

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  role: User["role"];
};

interface State {
  teams: Team[];
  players: Player[];
  fixtures: Fixture[];
  localApplications: Application[];
}

const initialState: State = {
  teams: seed.teams,
  players: seed.players,
  fixtures: seed.fixtures,
  localApplications: seed.applications.filter((a) => a.kind !== "city-organizer"),
};

const QUERY_KEYS = {
  auth: ["auth", "me"] as const,
  cities: ["cities"] as const,
  applications: ["applications"] as const,
};

interface StoreValue {
  teams: Team[];
  players: Player[];
  fixtures: Fixture[];
  applications: Application[];
  cities: City[];
  currentUser: User | null;
  bootstrapped: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  register: (input: SignUpInput) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  createTeam: (input: { name: string; shortName: string; company: string; group: string }) => Team;
  updateTeam: (teamId: string, patch: Partial<Team>) => void;
  addPlayer: (input: {
    teamId: string;
    name: string;
    position: Player["position"];
    number: number;
    role: string;
    status?: Player["status"];
  }) => Player;
  removePlayer: (playerId: string) => void;
  addFixture: (input: {
    homeTeamId: string;
    awayTeamId: string;
    date: string;
    time: string;
    matchday: number;
  }) => void;
  updateResult: (fixtureId: string, homeScore: number, awayScore: number) => void;
  submitApplication: (input: {
    kind: ApplicationKind;
    name: string;
    email: string;
    city: string;
    detail: string;
  }) => Promise<void>;
  reviewApplication: (id: string, status: "approved" | "rejected") => Promise<void>;
  updateCityStatus: (slug: string, status: City["status"]) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await res.json().catch(() => ({}))) as ApiResponse<T> & Record<string, unknown>;
  if (!res.ok || payload.ok === false) {
    throw new Error((payload.error as string | undefined) ?? `Request failed: ${res.status}`);
  }

  return payload as unknown as T;
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

  const activeRole =
    typeof value["activeRole"] === "string"
      ? (value["activeRole"] as User["role"])
      : ("player" as User["role"]);

  const roles = Array.isArray(value["roles"])
    ? value["roles"]
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
        .filter(Boolean)
    : [];

  return {
    id: value["id"],
    name: value["name"],
    email: value["email"],
    role: activeRole,
    activeRole,
    roles,
    citySlug: typeof value["citySlug"] === "string" ? value["citySlug"] : undefined,
    teamId: typeof value["teamId"] === "string" ? value["teamId"] : undefined,
    playerId: typeof value["playerId"] === "string" ? value["playerId"] : undefined,
  } as User;
}

export function DevKicsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: QUERY_KEYS.auth,
    queryFn: async () => {
      const authPayload = await api<{ user: unknown }>("/api/auth/me", { method: "GET" });
      return toCurrentUser((authPayload as Record<string, unknown>)["user"]);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const currentUser = authQuery.data ?? null;
  const bootstrapped = authQuery.isFetched;

  const citiesQuery = useQuery({
    queryKey: QUERY_KEYS.cities,
    queryFn: async () => {
      const payload = await api<{ cities: City[] }>("/api/cities", { method: "GET" });
      return ((payload as unknown as { cities?: City[] }).cities ?? seed.cities) as City[];
    },
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const canViewOrganizerApplications = currentUser?.role === "admin";

  const applicationsQuery = useQuery({
    queryKey: QUERY_KEYS.applications,
    queryFn: async () => {
      const payload = await api<{ applications: Application[] }>(
        "/api/applications?page=1&pageSize=50",
        { method: "GET" },
      );
      return ((payload as unknown as { applications?: Application[] }).applications ??
        []) as Application[];
    },
    enabled: canViewOrganizerApplications,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const cities = citiesQuery.data ?? seed.cities;
  const remoteApplications = useMemo(
    () => (canViewOrganizerApplications ? (applicationsQuery.data ?? []) : []),
    [applicationsQuery.data, canViewOrganizerApplications],
  );

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auth });
    await queryClient.refetchQueries({ queryKey: QUERY_KEYS.auth, exact: true });
  }, [queryClient]);

  const refreshCities = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
  }, [queryClient]);

  const refreshOrganizerApplications = useCallback(async () => {
    if (!canViewOrganizerApplications) {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.applications });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications });
  }, [canViewOrganizerApplications, queryClient]);

  useEffect(() => {
    if (!canViewOrganizerApplications) {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.applications });
    }
  }, [canViewOrganizerApplications, queryClient]);

  const login = useCallback<StoreValue["login"]>(
    async (email, password) => {
      const payload = await api<{ user: unknown }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const user = toCurrentUser((payload as unknown as { user: unknown }).user);
      queryClient.setQueryData(QUERY_KEYS.auth, user);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications });
      return user;
    },
    [queryClient],
  );

  const register = useCallback<StoreValue["register"]>(
    async (input) => {
      const payload = await api<{ user: unknown }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const user = toCurrentUser((payload as unknown as { user: unknown }).user);
      queryClient.setQueryData(QUERY_KEYS.auth, user);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cities });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications });
      return user;
    },
    [queryClient],
  );

  const logout = useCallback<StoreValue["logout"]>(async () => {
    await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    queryClient.setQueryData(QUERY_KEYS.auth, null);
    queryClient.removeQueries({ queryKey: QUERY_KEYS.applications });
  }, [queryClient]);

  const createTeam = useCallback<StoreValue["createTeam"]>(
    (input) => {
      const team: Team = {
        id: `tm-${Date.now()}`,
        tournamentId: "t-abuja-s1",
        name: input.name,
        shortName: input.shortName.toUpperCase().slice(0, 3),
        company: input.company,
        managerUserId: currentUser?.id ?? "u-manager",
        managerName: currentUser?.name ?? "Team Manager",
        color: "green",
        group: input.group,
        founded: "2026",
      };
      setState((s) => ({
        ...s,
        teams: [...s.teams, team],
      }));
      return team;
    },
    [currentUser],
  );

  const updateTeam = useCallback<StoreValue["updateTeam"]>((teamId, patch) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)),
    }));
  }, []);

  const addPlayer = useCallback<StoreValue["addPlayer"]>((input) => {
    const player: Player = {
      id: `pl-${Date.now()}`,
      teamId: input.teamId,
      name: input.name,
      position: input.position,
      number: input.number,
      role: input.role,
      status: input.status ?? "active",
      goals: 0,
      assists: 0,
    };
    setState((s) => ({ ...s, players: [...s.players, player] }));
    return player;
  }, []);

  const removePlayer = useCallback<StoreValue["removePlayer"]>((playerId) => {
    setState((s) => ({ ...s, players: s.players.filter((p) => p.id !== playerId) }));
  }, []);

  const addFixture = useCallback<StoreValue["addFixture"]>((input) => {
    const fixture: Fixture = {
      id: `fx-${Date.now()}`,
      tournamentId: "t-abuja-s1",
      matchday: input.matchday,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      date: input.date,
      time: input.time,
      venue: "Jabi Astro Turf",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
    };
    setState((s) => ({ ...s, fixtures: [...s.fixtures, fixture] }));
  }, []);

  const updateResult = useCallback<StoreValue["updateResult"]>((fixtureId, home, away) => {
    setState((s) => ({
      ...s,
      fixtures: s.fixtures.map((f) =>
        f.id === fixtureId
          ? { ...f, homeScore: home, awayScore: away, status: "completed" as const }
          : f,
      ),
    }));
  }, []);

  const submitApplication = useCallback<StoreValue["submitApplication"]>(
    async (input) => {
      if (input.kind === "city-organizer") {
        await api<{ application: Application }>("/api/applications", {
          method: "POST",
          body: JSON.stringify(input),
        });
        await refreshOrganizerApplications();
        return;
      }

      const application: Application = {
        id: `ap-${Date.now()}`,
        ...input,
        submittedAt: new Date().toISOString().slice(0, 10),
        status: "pending",
      };
      setState((s) => ({ ...s, localApplications: [application, ...s.localApplications] }));
    },
    [refreshOrganizerApplications],
  );

  const reviewApplication = useCallback<StoreValue["reviewApplication"]>(
    async (id, status) => {
      const isRemote = remoteApplications.some((a) => a.id === id);
      if (isRemote) {
        await api<{ application: Application }>(`/api/applications/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        await refreshOrganizerApplications();
        return;
      }

      setState((s) => ({
        ...s,
        localApplications: s.localApplications.map((a) => (a.id === id ? { ...a, status } : a)),
      }));
    },
    [remoteApplications, refreshOrganizerApplications],
  );

  const updateCityStatus = useCallback<StoreValue["updateCityStatus"]>(
    async (slug, status) => {
      await api<{ city: City }>(`/api/cities/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshCities();
    },
    [refreshCities],
  );

  const resetDemo = useCallback<StoreValue["resetDemo"]>(async () => {
    setState((s) => ({
      ...s,
      teams: seed.teams,
      players: seed.players,
      fixtures: seed.fixtures,
      localApplications: seed.applications.filter((a) => a.kind !== "city-organizer"),
    }));
    await Promise.all([refreshOrganizerApplications(), refreshCities(), refreshSession()]);
  }, [refreshCities, refreshOrganizerApplications, refreshSession]);

  const applications = useMemo(
    () => [...remoteApplications, ...state.localApplications],
    [remoteApplications, state.localApplications],
  );

  const value: StoreValue = {
    teams: state.teams,
    players: state.players,
    fixtures: state.fixtures,
    applications,
    cities,
    currentUser,
    bootstrapped,
    login,
    register,
    logout,
    refreshSession,
    createTeam,
    updateTeam,
    addPlayer,
    removePlayer,
    addFixture,
    updateResult,
    submitApplication,
    reviewApplication,
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

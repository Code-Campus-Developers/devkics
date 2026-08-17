import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as seed from "./seed";
import type {
  Application,
  ApplicationKind,
  Fixture,
  Player,
  StandingRow,
  Team,
  User,
} from "./types";

const STORAGE_KEY = "devkics.state.v1";

interface State {
  teams: Team[];
  players: Player[];
  fixtures: Fixture[];
  applications: Application[];
  users: User[];
  currentUserId: string | null;
}

const initialState: State = {
  teams: seed.teams,
  players: seed.players,
  fixtures: seed.fixtures,
  applications: seed.applications,
  users: seed.users,
  currentUserId: null,
};

interface StoreValue extends State {
  currentUser: User | null;
  login: (email: string, password: string) => User | null;
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
  }) => User;
  logout: () => void;
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
  }) => void;
  reviewApplication: (id: string, status: "approved" | "rejected") => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function DevKicsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialState, ...(JSON.parse(raw) as State) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId],
  );

  const login = useCallback<StoreValue["login"]>(
    (email, password) => {
      const user = state.users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
      );
      if (user) setState((s) => ({ ...s, currentUserId: user.id }));
      return user ?? null;
    },
    [state.users],
  );

  const register = useCallback<StoreValue["register"]>((input) => {
    const user: User = {
      id: `u-${Date.now()}`,
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
      citySlug: "abuja",
    };
    setState((s) => ({ ...s, users: [...s.users, user], currentUserId: user.id }));
    return user;
  }, []);

  const logout = useCallback(() => setState((s) => ({ ...s, currentUserId: null })), []);

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
        users: s.users.map((u) => (u.id === currentUser?.id ? { ...u, teamId: team.id } : u)),
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

  const submitApplication = useCallback<StoreValue["submitApplication"]>((input) => {
    const application: Application = {
      id: `ap-${Date.now()}`,
      ...input,
      submittedAt: new Date().toISOString().slice(0, 10),
      status: "pending",
    };
    setState((s) => ({ ...s, applications: [application, ...s.applications] }));
  }, []);

  const reviewApplication = useCallback<StoreValue["reviewApplication"]>((id, status) => {
    setState((s) => ({
      ...s,
      applications: s.applications.map((a) => (a.id === id ? { ...a, status } : a)),
    }));
  }, []);

  const resetDemo = useCallback(() => setState(initialState), []);

  const value: StoreValue = {
    ...state,
    currentUser,
    login,
    register,
    logout,
    createTeam,
    updateTeam,
    addPlayer,
    removePlayer,
    addFixture,
    updateResult,
    submitApplication,
    reviewApplication,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDevKics() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useDevKics must be used inside DevKicsProvider");
  return ctx;
}

export function computeStandings(teams: Team[], fixtures: Fixture[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const team of teams) {
    rows.set(team.id, {
      teamId: team.id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    });
  }

  const played = fixtures
    .filter((f) => f.status === "completed" && f.homeScore !== null && f.awayScore !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const fx of played) {
    const home = rows.get(fx.homeTeamId);
    const away = rows.get(fx.awayTeamId);
    if (!home || !away) continue;
    const hs = fx.homeScore as number;
    const as = fx.awayScore as number;
    home.played++;
    away.played++;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;
    if (hs > as) {
      home.won++;
      home.points += 3;
      away.lost++;
      home.form.push("W");
      away.form.push("L");
    } else if (hs < as) {
      away.won++;
      away.points += 3;
      home.lost++;
      home.form.push("L");
      away.form.push("W");
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      home.form.push("D");
      away.form.push("D");
    }
  }

  return [...rows.values()]
    .map((r) => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst, form: r.form.slice(-5) }))
    .sort(
      (a, b) =>
        b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor,
    );
}

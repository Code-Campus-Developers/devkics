import {
  MatchEventType,
  MatchStage,
  MatchStatus,
  OrganizationStatus,
  PlayerStatus,
  TeamStatus,
  TournamentStatus,
  type Fixture,
  type Match,
  type MatchEvent,
  type Team,
} from ".prisma/client";

type StandingRow = {
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
  rank: number;
};

type TeamFixtureSeed = {
  homeTeamId: string;
  awayTeamId: string;
  matchday: number;
  kickoffAt: Date;
  venue: string;
  stage: MatchStage;
  roundLabel: string | null;
  groupId: string | null;
};

type Transition<T extends string> = Record<T, T[]>;

const ORGANIZATION_TRANSITIONS: Transition<OrganizationStatus> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["MORE_INFO_REQUIRED", "APPROVED", "REJECTED", "SUSPENDED"],
  MORE_INFO_REQUIRED: ["UNDER_REVIEW", "WITHDRAWN"],
  APPROVED: ["SUSPENDED"],
  REJECTED: ["UNDER_REVIEW"],
  SUSPENDED: ["UNDER_REVIEW"],
  WITHDRAWN: [],
};

const TEAM_TRANSITIONS: Transition<TeamStatus> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "SUSPENDED"],
  APPROVED: ["LOCKED", "SUSPENDED", "DISQUALIFIED"],
  REJECTED: ["UNDER_REVIEW"],
  SUSPENDED: ["UNDER_REVIEW", "DISQUALIFIED"],
  DISQUALIFIED: [],
  LOCKED: ["SUSPENDED", "DISQUALIFIED"],
};

const PLAYER_TRANSITIONS: Transition<PlayerStatus> = {
  INVITED: ["REGISTRATION_INCOMPLETE", "PENDING_APPROVAL", "WITHDRAWN"],
  REGISTRATION_INCOMPLETE: ["PENDING_APPROVAL", "WITHDRAWN"],
  PENDING_APPROVAL: ["APPROVED", "SUSPENDED", "DISQUALIFIED", "WITHDRAWN"],
  APPROVED: ["SUSPENDED", "WITHDRAWN", "DISQUALIFIED"],
  SUSPENDED: ["APPROVED", "DISQUALIFIED", "WITHDRAWN"],
  WITHDRAWN: [],
  DISQUALIFIED: [],
};

const TOURNAMENT_TRANSITIONS: Transition<TournamentStatus> = {
  DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "POSTPONED", "CANCELLED"],
  REGISTRATION_CLOSED: ["FIXTURES_PUBLISHED", "POSTPONED", "CANCELLED"],
  FIXTURES_PUBLISHED: ["ONGOING", "POSTPONED", "CANCELLED"],
  ONGOING: ["COMPLETED", "POSTPONED", "CANCELLED"],
  COMPLETED: ["ARCHIVED"],
  POSTPONED: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "FIXTURES_PUBLISHED", "ONGOING"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function assertTransition<T extends string>(
  map: Transition<T>,
  currentStatus: T,
  nextStatus: T,
  resourceName: string,
) {
  if (currentStatus === nextStatus) return;
  const allowed = map[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`${resourceName} transition ${currentStatus} -> ${nextStatus} is not allowed`);
  }
}

export function assertOrganizationTransition(
  current: OrganizationStatus,
  next: OrganizationStatus,
) {
  assertTransition(ORGANIZATION_TRANSITIONS, current, next, "Organization");
}

export function assertTeamTransition(current: TeamStatus, next: TeamStatus) {
  assertTransition(TEAM_TRANSITIONS, current, next, "Team");
}

export function assertPlayerTransition(current: PlayerStatus, next: PlayerStatus) {
  assertTransition(PLAYER_TRANSITIONS, current, next, "Player");
}

export function assertTournamentTransition(current: TournamentStatus, next: TournamentStatus) {
  assertTransition(TOURNAMENT_TRANSITIONS, current, next, "Tournament");
}

export function generateRoundRobinFixtures(input: {
  teamIds: string[];
  kickoffStart: Date;
  matchIntervalMinutes?: number;
  venue: string;
  groupId?: string | null;
}): TeamFixtureSeed[] {
  const teamIds = [...input.teamIds];
  if (teamIds.length < 2) return [];

  const hasBye = teamIds.length % 2 === 1;
  if (hasBye) {
    teamIds.push("__bye__");
  }

  const rounds = teamIds.length - 1;
  const halfSize = teamIds.length / 2;
  let rotation = [...teamIds];
  const fixtures: TeamFixtureSeed[] = [];
  const intervalMs = (input.matchIntervalMinutes ?? 75) * 60_000;

  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < halfSize; i += 1) {
      const home = rotation[i]!;
      const away = rotation[rotation.length - 1 - i]!;
      if (home === "__bye__" || away === "__bye__") continue;

      fixtures.push({
        homeTeamId: round % 2 === 0 ? home : away,
        awayTeamId: round % 2 === 0 ? away : home,
        matchday: round + 1,
        kickoffAt: new Date(input.kickoffStart.getTime() + (round * halfSize + i) * intervalMs),
        venue: input.venue,
        stage: MatchStage.GROUP,
        roundLabel: null,
        groupId: input.groupId ?? null,
      });
    }

    const fixed = rotation[0]!;
    const moving = rotation.slice(1);
    moving.unshift(moving.pop()!);
    rotation = [fixed, ...moving];
  }

  return fixtures;
}

export function computeStandingsProjection(input: {
  teams: Pick<Team, "id">[];
  fixtures: Array<
    Pick<Fixture, "id" | "homeTeamId" | "awayTeamId" | "status" | "kickoffAt"> & {
      match: Pick<Match, "homeScore" | "awayScore"> | null;
    }
  >;
  tieBreakers?: string[];
}): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const team of input.teams) {
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
      rank: 0,
    });
  }

  const played = input.fixtures
    .filter((fixture) => {
      if (fixture.status !== MatchStatus.COMPLETED) return false;
      if (!fixture.match) return false;
      return fixture.match.homeScore !== null && fixture.match.awayScore !== null;
    })
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());

  for (const fixture of played) {
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home || !away || !fixture.match) continue;

    const homeScore = fixture.match.homeScore as number;
    const awayScore = fixture.match.awayScore as number;

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
      home.form.push("W");
      away.form.push("L");
    } else if (awayScore > homeScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
      away.form.push("W");
      home.form.push("L");
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push("D");
      away.form.push("D");
    }
  }

  const tieBreakers = input.tieBreakers ?? ["points", "goalDifference", "goalsFor"];

  const sorted = [...rows.values()]
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
      form: row.form.slice(-5),
    }))
    .sort((a, b) => compareWithTieBreakers(a, b, tieBreakers));

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

function compareWithTieBreakers(a: StandingRow, b: StandingRow, tieBreakers: string[]) {
  for (const tiebreaker of tieBreakers) {
    if (tiebreaker === "points" && b.points !== a.points) return b.points - a.points;
    if (tiebreaker === "goalDifference" && b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    if (tiebreaker === "goalsFor" && b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (tiebreaker === "won" && b.won !== a.won) return b.won - a.won;
  }
  return a.teamId.localeCompare(b.teamId);
}

export function aggregateMatchStatistics(
  events: Pick<MatchEvent, "teamId" | "playerId" | "type">[],
): {
  teamGoals: Map<string, number>;
  playerGoals: Map<string, number>;
  playerAssists: Map<string, number>;
  yellowCards: Map<string, number>;
  redCards: Map<string, number>;
} {
  const teamGoals = new Map<string, number>();
  const playerGoals = new Map<string, number>();
  const playerAssists = new Map<string, number>();
  const yellowCards = new Map<string, number>();
  const redCards = new Map<string, number>();

  for (const event of events) {
    if (event.type === MatchEventType.GOAL || event.type === MatchEventType.PENALTY_SCORED) {
      if (event.teamId) teamGoals.set(event.teamId, (teamGoals.get(event.teamId) ?? 0) + 1);
      if (event.playerId) {
        playerGoals.set(event.playerId, (playerGoals.get(event.playerId) ?? 0) + 1);
      }
    }

    if (event.type === MatchEventType.ASSIST && event.playerId) {
      playerAssists.set(event.playerId, (playerAssists.get(event.playerId) ?? 0) + 1);
    }

    if (event.type === MatchEventType.YELLOW_CARD && event.playerId) {
      yellowCards.set(event.playerId, (yellowCards.get(event.playerId) ?? 0) + 1);
    }

    if (event.type === MatchEventType.RED_CARD && event.playerId) {
      redCards.set(event.playerId, (redCards.get(event.playerId) ?? 0) + 1);
    }
  }

  return { teamGoals, playerGoals, playerAssists, yellowCards, redCards };
}

export function resolveFixtureWinner(fixture: {
  homeTeamId: string;
  awayTeamId: string;
  match: Pick<Match, "homeScore" | "awayScore" | "penaltyHome" | "penaltyAway"> | null;
}) {
  if (!fixture.match) return null;
  const { homeScore, awayScore, penaltyHome, penaltyAway } = fixture.match;
  if (homeScore === null || awayScore === null) return null;
  if (homeScore > awayScore) return fixture.homeTeamId;
  if (awayScore > homeScore) return fixture.awayTeamId;
  if (penaltyHome === null || penaltyAway === null) return null;
  if (penaltyHome > penaltyAway) return fixture.homeTeamId;
  if (penaltyAway > penaltyHome) return fixture.awayTeamId;
  return null;
}

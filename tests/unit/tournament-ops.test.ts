import {
  MatchEventType,
  MatchStage,
  MatchStatus,
  OrganizationStatus,
  TournamentStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  aggregateMatchStatistics,
  assertOrganizationTransition,
  assertTournamentTransition,
  computeStandingsProjection,
  generateRoundRobinFixtures,
  resolveFixtureWinner,
} from "@/lib/server/tournament-ops";

describe("tournament-ops", () => {
  it("generates round-robin fixtures without duplicate team pairings", () => {
    const fixtures = generateRoundRobinFixtures({
      teamIds: ["t1", "t2", "t3", "t4"],
      kickoffStart: new Date("2026-09-01T10:00:00.000Z"),
      venue: "Main turf",
    });

    expect(fixtures.length).toBe(6);
    const pairs = new Set(
      fixtures.map((fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join("::")),
    );
    expect(pairs.size).toBe(6);
  });

  it("computes standings using configured tie-breakers", () => {
    const standings = computeStandingsProjection({
      teams: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
      fixtures: [
        {
          id: "f1",
          homeTeamId: "t1",
          awayTeamId: "t2",
          status: MatchStatus.COMPLETED,
          kickoffAt: new Date("2026-09-01T10:00:00.000Z"),
          match: { homeScore: 1, awayScore: 0 },
        },
        {
          id: "f2",
          homeTeamId: "t3",
          awayTeamId: "t1",
          status: MatchStatus.COMPLETED,
          kickoffAt: new Date("2026-09-02T10:00:00.000Z"),
          match: { homeScore: 2, awayScore: 0 },
        },
        {
          id: "f3",
          homeTeamId: "t2",
          awayTeamId: "t3",
          status: MatchStatus.COMPLETED,
          kickoffAt: new Date("2026-09-03T10:00:00.000Z"),
          match: { homeScore: 3, awayScore: 1 },
        },
      ],
      tieBreakers: ["points", "goalDifference", "goalsFor"],
    });

    expect(standings[0]?.teamId).toBe("t2");
    expect(standings[1]?.teamId).toBe("t3");
    expect(standings[2]?.teamId).toBe("t1");
  });

  it("aggregates goal, assist, and card statistics from events", () => {
    const stats = aggregateMatchStatistics([
      { teamId: "t1", playerId: "p1", type: MatchEventType.GOAL },
      { teamId: "t1", playerId: "p2", type: MatchEventType.ASSIST },
      { teamId: "t2", playerId: "p3", type: MatchEventType.YELLOW_CARD },
      { teamId: "t2", playerId: "p4", type: MatchEventType.RED_CARD },
      { teamId: "t1", playerId: "p1", type: MatchEventType.PENALTY_SCORED },
    ]);

    expect(stats.teamGoals.get("t1")).toBe(2);
    expect(stats.playerGoals.get("p1")).toBe(2);
    expect(stats.playerAssists.get("p2")).toBe(1);
    expect(stats.yellowCards.get("p3")).toBe(1);
    expect(stats.redCards.get("p4")).toBe(1);
  });

  it("resolves knockout winners with penalties when tied", () => {
    const winner = resolveFixtureWinner({
      homeTeamId: "t1",
      awayTeamId: "t2",
      match: {
        homeScore: 1,
        awayScore: 1,
        penaltyHome: 4,
        penaltyAway: 3,
      },
    });

    expect(winner).toBe("t1");
  });

  it("enforces tournament status transitions", () => {
    expect(() =>
      assertTournamentTransition(TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN),
    ).not.toThrow();
    expect(() =>
      assertTournamentTransition(TournamentStatus.DRAFT, TournamentStatus.COMPLETED),
    ).toThrow();
  });

  it("enforces organization status transitions allowing direct review transitions", () => {
    // Direct SUBMITTED transitions
    expect(() =>
      assertOrganizationTransition(OrganizationStatus.SUBMITTED, OrganizationStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertOrganizationTransition(OrganizationStatus.SUBMITTED, OrganizationStatus.REJECTED),
    ).not.toThrow();
    expect(() =>
      assertOrganizationTransition(
        OrganizationStatus.SUBMITTED,
        OrganizationStatus.MORE_INFO_REQUIRED,
      ),
    ).not.toThrow();
    expect(() =>
      assertOrganizationTransition(OrganizationStatus.SUBMITTED, OrganizationStatus.UNDER_REVIEW),
    ).not.toThrow();

    // Invalid transition
    expect(() =>
      assertOrganizationTransition(OrganizationStatus.APPROVED, OrganizationStatus.SUBMITTED),
    ).toThrow();
  });

  it("keeps generated fixtures in group stage", () => {
    const fixtures = generateRoundRobinFixtures({
      teamIds: ["t1", "t2"],
      kickoffStart: new Date("2026-09-01T10:00:00.000Z"),
      venue: "Main turf",
    });

    expect(fixtures[0]?.stage).toBe(MatchStage.GROUP);
  });
});

import { describe, expect, it } from "vitest";

import { computeStandings } from "@/lib/devkics/store";
import type { Fixture, Team } from "@/lib/devkics/types";

describe("computeStandings", () => {
  it("computes points and ordering", () => {
    const teams: Team[] = [
      {
        id: "t1",
        tournamentId: "tour",
        name: "Team A",
        shortName: "A",
        company: "A Inc",
        managerUserId: "u1",
        managerName: "Manager A",
        color: "green",
        group: "A",
        founded: "2026",
      },
      {
        id: "t2",
        tournamentId: "tour",
        name: "Team B",
        shortName: "B",
        company: "B Inc",
        managerUserId: "u2",
        managerName: "Manager B",
        color: "wine",
        group: "A",
        founded: "2026",
      },
    ];

    const fixtures: Fixture[] = [
      {
        id: "f1",
        tournamentId: "tour",
        matchday: 1,
        homeTeamId: "t1",
        awayTeamId: "t2",
        date: "2026-08-01",
        time: "10:00",
        venue: "Pitch",
        status: "completed",
        homeScore: 2,
        awayScore: 1,
      },
    ];

    const rows = computeStandings(teams, fixtures);
    expect(rows[0]?.teamId).toBe("t1");
    expect(rows[0]?.points).toBe(3);
    expect(rows[1]?.teamId).toBe("t2");
    expect(rows[1]?.points).toBe(0);
  });
});

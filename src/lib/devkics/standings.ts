import type { Fixture, StandingRow, Team } from "./types";

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

import { Link } from "@tanstack/react-router";

import { FormPill, TeamCrest } from "./brand";
import { computeStandings } from "@/lib/devkics/standings";
import type { Fixture, StandingRow, Team } from "@/lib/devkics/types";
import { cn } from "@/lib/utils";

export function MatchRow({
  fixture,
  teams,
  citySlug,
}: {
  fixture: Fixture;
  teams: Team[];
  citySlug: string;
}) {
  const home = teams.find((t) => t.id === fixture.homeTeamId);
  const away = teams.find((t) => t.id === fixture.awayTeamId);
  if (!home || !away) return null;
  const done = fixture.status === "completed";

  return (
    <div className="card-lift rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">Matchday {fixture.matchday}</span>
        <span>
          {fixture.date} · {fixture.time}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Link
          to="/$city/teams/$teamId"
          params={{ city: citySlug, teamId: home.id }}
          className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
        >
          <TeamCrest team={home} size="sm" />
          <span className="truncate text-sm font-medium">{home.name}</span>
        </Link>

        <span
          className={cn(
            "shrink-0 rounded-xl px-3 py-1.5 font-display text-base font-bold tabular-nums",
            done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {done ? `${fixture.homeScore} – ${fixture.awayScore}` : fixture.time}
        </span>

        <Link
          to="/$city/teams/$teamId"
          params={{ city: citySlug, teamId: away.id }}
          className="flex min-w-0 flex-1 items-center justify-end gap-3 text-right hover:opacity-80"
        >
          <span className="truncate text-sm font-medium">{away.name}</span>
          <TeamCrest team={away} size="sm" />
        </Link>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">{fixture.venue}</p>
    </div>
  );
}

export function StandingsTable({
  teams,
  fixtures,
  citySlug,
  rows,
  compact = false,
}: {
  teams: Team[];
  fixtures: Fixture[];
  citySlug: string;
  rows?: StandingRow[];
  compact?: boolean;
}) {
  const computedRows = rows && rows.length > 0 ? rows : computeStandings(teams, fixtures);

  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm" aria-label="League standings table">
        <caption className="sr-only">League Standings Table</caption>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              <span className="sr-only">Position</span>#
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Team
            </th>
            <th scope="col" className="px-3 py-3 text-center font-semibold">
              <abbr title="Played">P</abbr>
            </th>
            <th scope="col" className="px-3 py-3 text-center font-semibold">
              <abbr title="Won">W</abbr>
            </th>
            <th scope="col" className="px-3 py-3 text-center font-semibold">
              <abbr title="Drawn">D</abbr>
            </th>
            <th scope="col" className="px-3 py-3 text-center font-semibold">
              <abbr title="Lost">L</abbr>
            </th>
            <th scope="col" className="px-3 py-3 text-center font-semibold">
              <abbr title="Goal Difference">GD</abbr>
            </th>
            <th scope="col" className="px-3 py-3 text-center font-semibold">
              <abbr title="Points">Pts</abbr>
            </th>
            {!compact && (
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Form
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {computedRows.map((row, i) => {
            const team = teams.find((t) => t.id === row.teamId);
            if (!team) return null;
            return (
              <tr
                key={row.teamId}
                className={cn(
                  "border-b border-border/60 last:border-0 transition-colors hover:bg-muted/50",
                  i < 4 && "bg-primary/[0.03]",
                )}
              >
                <td className="px-4 py-3 font-display font-bold text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    to="/$city/teams/$teamId"
                    params={{ city: citySlug, teamId: team.id }}
                    className="flex items-center gap-3 font-medium hover:text-primary"
                  >
                    <TeamCrest team={team} size="sm" />
                    <span className="truncate">{team.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-center tabular-nums">{row.played}</td>
                <td className="px-3 py-3 text-center tabular-nums">{row.won}</td>
                <td className="px-3 py-3 text-center tabular-nums">{row.drawn}</td>
                <td className="px-3 py-3 text-center tabular-nums">{row.lost}</td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {row.goalDifference > 0 ? "+" : ""}
                  {row.goalDifference}
                </td>
                <td className="px-3 py-3 text-center font-display font-bold tabular-nums">
                  {row.points}
                </td>
                {!compact && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {row.form.length ? (
                        row.form.map((r, idx) => <FormPill key={idx} result={r} />)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

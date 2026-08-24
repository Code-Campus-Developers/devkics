import { Link } from "@tanstack/react-router";

import { FormPill, SectionHeading, StatCard, TeamCrest } from "@/components/devkics/brand";
import { MatchRow } from "@/components/devkics/match";
import { Button } from "@/components/ui/button";
import { computeStandings, useDevKics } from "@/lib/devkics/store";

export function PlayerDashboard() {
  const { currentUser, teams, players, fixtures } = useDevKics();
  const player = players.find((p) => p.id === currentUser?.playerId);
  const team = teams.find((t) => t.id === (player?.teamId ?? currentUser?.teamId));

  if (!team) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-10 text-center">
        <h2 className="text-xl font-bold">You are not on a squad yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse the teams competing in Abuja and ask a manager for an invite, or apply as a free
          agent.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild className="rounded-full">
            <Link to="/$city/teams" params={{ city: "abuja" }}>
              Browse teams
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/volunteer">Volunteer</Link>
          </Button>
        </div>
      </div>
    );
  }

  const row = computeStandings(teams, fixtures).find((s) => s.teamId === team.id);
  const teamFixtures = fixtures.filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id);
  const next = teamFixtures.find((f) => f.status === "scheduled");
  const squad = players.filter((p) => p.teamId === team.id);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-7 sm:flex-row sm:items-center">
        <TeamCrest team={team} size="lg" />
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold">{player?.name ?? currentUser?.name}</h2>
          <p className="text-sm text-muted-foreground">
            {player ? `#${player.number} · ${player.position} · ${player.role}` : "Squad member"}
          </p>
          <Link
            to="/$city/teams/$teamId"
            params={{ city: "abuja", teamId: team.id }}
            className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
          >
            {team.name}
          </Link>
        </div>
        <div className="flex gap-1.5">
          {(row?.form ?? []).map((r, i) => (
            <FormPill key={i} result={r} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Goals" value={player?.goals ?? 0} />
        <StatCard label="Assists" value={player?.assists ?? 0} tone="flare" />
        <StatCard label="Team points" value={row?.points ?? 0} />
        <StatCard label="Squad size" value={squad.length} tone="wine" />
      </div>

      {next && (
        <section>
          <SectionHeading title="Your next match" />
          <div className="mt-5 max-w-lg">
            <MatchRow fixture={next} teams={teams} citySlug="abuja" />
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          title="Season schedule"
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/$city/fixtures" params={{ city: "abuja" }}>
                All fixtures
              </Link>
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {teamFixtures.map((f) => (
            <MatchRow key={f.id} fixture={f} teams={teams} citySlug="abuja" />
          ))}
        </div>
      </section>
    </div>
  );
}

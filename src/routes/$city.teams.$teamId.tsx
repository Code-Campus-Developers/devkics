import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { FormPill, TeamCrest } from "@/components/devkics/brand";
import { MatchRow } from "@/components/devkics/match";
import { Badge } from "@/components/ui/badge";
import { teams as seedTeams } from "@/lib/devkics/seed";
import { useDevKics } from "@/lib/devkics/store";
import { computeStandings } from "@/lib/devkics/standings";

export const Route = createFileRoute("/$city/teams/$teamId")({
  beforeLoad: ({ params }) => {
    // Seed teams are always resolvable server-side; user-created teams resolve client-side.
    if (params.teamId.startsWith("tm-") === false) throw notFound();
  },
  head: ({ params }) => {
    const team = seedTeams.find((t) => t.id === params.teamId);
    return {
      meta: [
        { title: `${team?.name ?? "Team"} — DevKics Abuja` },
        {
          name: "description",
          content: `Squad list, fixtures and form for ${team?.name ?? "this team"} in the DevKics Abuja Cup.`,
        },
        { property: "og:title", content: `${team?.name ?? "Team"} — DevKics Abuja` },
        {
          property: "og:description",
          content: `Squad, results and standing for ${team?.name ?? "this DevKics team"}.`,
        },
      ],
    };
  },
  component: TeamDetail,
});

function TeamDetail() {
  const { city, teamId } = Route.useParams();
  const { teams, players, fixtures } = useDevKics();
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return <p className="text-muted-foreground">Team not found.</p>;
  }

  const squad = players.filter((p) => p.teamId === team.id);
  const row = computeStandings(teams, fixtures).find((s) => s.teamId === team.id);
  const teamFixtures = fixtures.filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id);

  return (
    <div className="space-y-12">
      <Link
        to="/$city/teams"
        params={{ city }}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All teams
      </Link>

      <div className="rise-in flex flex-col gap-6 sm:flex-row sm:items-center">
        <TeamCrest team={team} size="lg" />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{team.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {team.company} · Group {team.group} · Managed by {team.managerName}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(row?.form ?? []).map((r, i) => (
            <FormPill key={i} result={r} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Played", row?.played ?? 0],
          ["Won", row?.won ?? 0],
          ["Goals for", row?.goalsFor ?? 0],
          ["Points", row?.points ?? 0],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-2xl font-bold">Squad</h2>
        <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-4 py-3 text-left font-semibold">Player</th>
                <th className="px-4 py-3 text-left font-semibold">Position</th>
                <th className="px-4 py-3 text-left font-semibold">Day job</th>
                <th className="px-3 py-3 text-center font-semibold">G</th>
                <th className="px-3 py-3 text-center font-semibold">A</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-display font-bold text-muted-foreground">
                    {p.number}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.status === "invited" && (
                      <Badge variant="outline" className="ml-2 rounded-full text-[10px]">
                        invited
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.position}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.role}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{p.goals}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{p.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Matches</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {teamFixtures.map((f) => (
            <MatchRow key={f.id} fixture={f} teams={teams} citySlug={city} />
          ))}
        </div>
      </section>
    </div>
  );
}

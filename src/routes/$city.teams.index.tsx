import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, TeamCrest } from "@/components/devkics/brand";
import { computeStandings, useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/$city/teams/")({
  head: () => ({
    meta: [
      { title: "Teams — DevKics Abuja" },
      {
        name: "description",
        content:
          "Meet the company and community teams competing in the DevKics Abuja Cup Season 1.",
      },
      { property: "og:title", content: "Teams — DevKics Abuja" },
      { property: "og:description", content: "The eight sides of the DevKics Abuja Cup." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { city } = Route.useParams();
  const { teams, players, fixtures } = useDevKics();
  const standings = computeStandings(teams, fixtures);

  return (
    <div>
      <PageHeader
        eyebrow="Season 1"
        title="Teams"
        description="Eight sides drawn from Abuja's engineering, product and design community."
      />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const squad = players.filter((p) => p.teamId === team.id);
          const row = standings.find((s) => s.teamId === team.id);
          return (
            <Link
              key={team.id}
              to="/$city/teams/$teamId"
              params={{ city, teamId: team.id }}
              className="card-lift rounded-3xl border border-border bg-card p-6"
            >
              <div className="flex items-start gap-4">
                <TeamCrest team={team} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-bold">{team.name}</h2>
                  <p className="truncate text-sm text-muted-foreground">{team.company}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Group {team.group}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <Stat label="Squad" value={squad.length} />
                <Stat label="Played" value={row?.played ?? 0} />
                <Stat label="Points" value={row?.points ?? 0} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

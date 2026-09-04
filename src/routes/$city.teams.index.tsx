import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState, PageHeader, TeamCrest } from "@/components/devkics/brand";
import { useDevKics } from "@/lib/devkics/store";
import { computeStandings } from "@/lib/devkics/standings";
import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/$city/teams/")({
  head: ({ params }) => {
    const name = params.city.charAt(0).toUpperCase() + params.city.slice(1);
    return {
      links: [canonicalLink(`/${params.city}/teams`)],
      meta: seoMeta({
        title: `Teams — DevKics ${name}`,
        description: `Meet the company and community teams competing in DevKics ${name}.`,
        path: `/${params.city}/teams`,
      }),
    };
  },
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
        description="Sides drawn from the local engineering, product, and technology community."
      />

      {teams.length === 0 && (
        <div className="mt-10">
          <EmptyState
            title="No teams registered yet"
            description="Team registration will appear here once organizations submit squads for this season."
          />
        </div>
      )}

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

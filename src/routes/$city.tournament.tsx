import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, TeamCrest } from "@/components/devkics/brand";
import { StandingsTable } from "@/components/devkics/match";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDevKics } from "@/lib/devkics/store";
import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/$city/tournament")({
  head: ({ params }) => {
    const title = "Tournament Overview — DevKics Abuja Cup";
    const description =
      "Format, schedule, groups and rules for the DevKics Abuja Cup Season 1 tech football tournament.";
    return {
      links: [canonicalLink(`/${params.city}/tournament`)],
      meta: seoMeta({
        title,
        description,
        path: `/${params.city}/tournament`,
      }),
    };
  },
  component: TournamentPage,
});

function TournamentPage() {
  const { city } = Route.useParams();
  const { teams, fixtures, tournaments, standings, knockoutRounds, awards } = useDevKics();
  const tournament = tournaments[0];
  const groups = ["A", "B"];

  if (!tournament) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Tournament"
          title="No active tournament"
          description="The organizer has not published tournament details yet."
        />
      </div>
    );
  }

  return (
    <div className="space-y-14">
      <PageHeader
        eyebrow={tournament.season}
        title={tournament.name}
        description={tournament.summary}
        action={
          <Badge className="rounded-full bg-primary/12 px-3 py-1.5 text-primary capitalize hover:bg-primary/12">
            {tournament.status.replace("-", " ")}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Format", tournament.format],
          ["Venue", tournament.venue],
          ["Season window", `${tournament.startDate} → ${tournament.endDate}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {k}
            </p>
            <p className="mt-2 font-medium">{v}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-2xl font-bold">Groups</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">Group {g}</h3>
              <ul className="mt-4 space-y-3">
                {teams
                  .filter((t) => t.group === g)
                  .map((t) => (
                    <li key={t.id}>
                      <Link
                        to="/$city/teams/$teamId"
                        params={{ city, teamId: t.id }}
                        className="flex items-center gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-muted"
                      >
                        <TeamCrest team={t} size="sm" />
                        <span className="truncate text-sm font-medium">{t.name}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {t.company}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Live table</h2>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/$city/standings" params={{ city }}>
              Full standings
            </Link>
          </Button>
        </div>
        <div className="mt-6">
          <StandingsTable
            teams={teams}
            fixtures={fixtures}
            citySlug={city}
            rows={standings}
            compact
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Knockout bracket</h2>
        {knockoutRounds.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Knockout rounds will appear once fixtures are linked.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {knockoutRounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-display text-lg font-bold">{round.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {round.links.length} links configured
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold">Awards</h2>
        {awards.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No awards assigned yet.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {awards.map((award) => (
              <div key={award.id} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-semibold">{award.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {award.description ?? "No description"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {award.assignments.length} assignment{award.assignments.length === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-secondary/40 p-8">
        <h2 className="text-2xl font-bold">Competition rules</h2>
        <ul className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          {[
            "7-a-side, 2 × 25 minute halves, rolling substitutions.",
            "Squads of up to 14 players; minimum 60% must work in tech.",
            "3 points for a win, 1 for a draw, 0 for a loss.",
            "Ties broken by goal difference, then goals scored.",
            "Top two from each group advance to the semi-finals.",
            "All players must be registered on DevKics before matchday.",
          ].map((r) => (
            <li key={r} className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

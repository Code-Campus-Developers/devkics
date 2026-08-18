import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { SectionHeading, StatCard } from "@/components/devkics/brand";
import { MatchRow, StandingsTable } from "@/components/devkics/match";
import { Button } from "@/components/ui/button";
import { news, tournaments } from "@/lib/devkics/seed";
import { useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/$city/")({
  head: ({ params }) => {
    const name = params.city.charAt(0).toUpperCase() + params.city.slice(1);
    return {
      meta: [
        { title: `DevKics ${name} — City Portal` },
        {
          name: "description",
          content: `Fixtures, results, standings, teams and news for the DevKics ${name} tech football league.`,
        },
        { property: "og:title", content: `DevKics ${name} — City Portal` },
        {
          property: "og:description",
          content: `Everything happening in the DevKics ${name} season.`,
        },
      ],
    };
  },
  component: CityOverview,
});

function CityOverview() {
  const { city } = Route.useParams();
  const { teams, players, fixtures } = useDevKics();
  const tournament = tournaments[0]!;
  const upcoming = fixtures.filter((f) => f.status === "scheduled").slice(0, 3);
  const recent = fixtures
    .filter((f) => f.status === "completed")
    .slice(-3)
    .reverse();

  return (
    <div className="space-y-16">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Teams" value={teams.length} hint="Company & community sides" />
        <StatCard label="Players" value={players.length} hint="Registered this season" />
        <StatCard
          label="Matches played"
          value={fixtures.filter((f) => f.status === "completed").length}
          tone="flare"
        />
        <StatCard
          label="Goals scored"
          value={fixtures.reduce((n, f) => n + (f.homeScore ?? 0) + (f.awayScore ?? 0), 0)}
          tone="wine"
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-7 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Active tournament
          </p>
          <h2 className="mt-2 text-2xl font-bold">{tournament.name}</h2>
          <p className="mt-3 text-muted-foreground">{tournament.summary}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Format", tournament.format],
              ["Venue", tournament.venue],
              ["Dates", `${tournament.startDate} → ${tournament.endDate}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <Button asChild className="mt-7 rounded-full">
            <Link to="/$city/tournament" params={{ city }}>
              Tournament overview <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-border bg-card p-7">
          <h3 className="text-lg font-semibold">Latest news</h3>
          <ul className="mt-4 space-y-4">
            {news.slice(0, 3).map((n) => (
              <li key={n.id}>
                <Link
                  to="/$city/news"
                  params={{ city }}
                  className="block rounded-xl p-2 -mx-2 transition-colors hover:bg-muted"
                >
                  <p className="text-xs text-muted-foreground">
                    {n.date} · {n.tag}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug">{n.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionHeading
          title="Next fixtures"
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/$city/fixtures" params={{ city }}>
                All fixtures
              </Link>
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {upcoming.map((f) => (
            <MatchRow key={f.id} fixture={f} teams={teams} citySlug={city} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Recent results"
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/$city/results" params={{ city }}>
                All results
              </Link>
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {recent.map((f) => (
            <MatchRow key={f.id} fixture={f} teams={teams} citySlug={city} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Standings"
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/$city/standings" params={{ city }}>
                Full table
              </Link>
            </Button>
          }
        />
        <div className="mt-6">
          <StandingsTable teams={teams} fixtures={fixtures} citySlug={city} compact />
        </div>
      </section>
    </div>
  );
}

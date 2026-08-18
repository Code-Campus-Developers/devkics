import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/devkics/brand";
import { MatchRow } from "@/components/devkics/match";
import { useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/$city/fixtures")({
  head: () => ({
    meta: [
      { title: "Fixtures — DevKics Abuja" },
      {
        name: "description",
        content: "Every scheduled DevKics Abuja Cup match, by matchday, at Jabi Astro Turf.",
      },
      { property: "og:title", content: "Fixtures — DevKics Abuja" },
      { property: "og:description", content: "The full DevKics Abuja Cup match schedule." },
    ],
  }),
  component: FixturesPage,
});

function FixturesPage() {
  const { city } = Route.useParams();
  const { fixtures, teams } = useDevKics();
  const upcoming = fixtures.filter((f) => f.status === "scheduled");
  const matchdays = [...new Set(upcoming.map((f) => f.matchday))].sort((a, b) => a - b);

  return (
    <div>
      <PageHeader
        eyebrow="Schedule"
        title="Fixtures"
        description="All upcoming matches. Saturdays at Jabi Astro Turf."
      />

      {matchdays.length === 0 && (
        <p className="mt-10 text-muted-foreground">All matches have been played this season.</p>
      )}

      <div className="mt-10 space-y-12">
        {matchdays.map((md) => (
          <section key={md}>
            <div className="flex items-center gap-4">
              <h2 className="font-display text-xl font-bold">Matchday {md}</h2>
              <span className="h-px flex-1 bg-border" />
              <span className="text-sm text-muted-foreground">
                {upcoming.find((f) => f.matchday === md)?.date}
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {upcoming
                .filter((f) => f.matchday === md)
                .map((f) => (
                  <MatchRow key={f.id} fixture={f} teams={teams} citySlug={city} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

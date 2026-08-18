import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/devkics/brand";
import { MatchRow } from "@/components/devkics/match";
import { useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/$city/results")({
  head: () => ({
    meta: [
      { title: "Results — DevKics Abuja" },
      {
        name: "description",
        content: "Final scores from every completed DevKics Abuja Cup matchday.",
      },
      { property: "og:title", content: "Results — DevKics Abuja" },
      { property: "og:description", content: "All completed DevKics Abuja Cup results." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { city } = Route.useParams();
  const { fixtures, teams } = useDevKics();
  const played = fixtures.filter((f) => f.status === "completed");
  const matchdays = [...new Set(played.map((f) => f.matchday))].sort((a, b) => b - a);

  return (
    <div>
      <PageHeader
        eyebrow="Scores"
        title="Results"
        description="Results update the league table the moment an organizer confirms them."
      />

      {played.length === 0 && (
        <p className="mt-10 text-muted-foreground">No matches have been played yet.</p>
      )}

      <div className="mt-10 space-y-12">
        {matchdays.map((md) => (
          <section key={md}>
            <div className="flex items-center gap-4">
              <h2 className="font-display text-xl font-bold">Matchday {md}</h2>
              <span className="h-px flex-1 bg-border" />
              <span className="text-sm text-muted-foreground">
                {played.find((f) => f.matchday === md)?.date}
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {played
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

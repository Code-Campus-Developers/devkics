import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/devkics/brand";
import { StandingsTable } from "@/components/devkics/match";
import { useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/$city/standings")({
  head: () => ({
    meta: [
      { title: "Standings — DevKics Abuja" },
      {
        name: "description",
        content: "The live DevKics Abuja Cup league table, updated after every confirmed result.",
      },
      { property: "og:title", content: "Standings — DevKics Abuja" },
      { property: "og:description", content: "Live league table for the DevKics Abuja Cup." },
    ],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const { city } = Route.useParams();
  const { teams, fixtures, standings } = useDevKics();

  return (
    <div>
      <PageHeader
        eyebrow="League table"
        title="Standings"
        description="Top two from each group qualify for the semi-finals."
      />
      <div className="mt-10">
        <StandingsTable teams={teams} fixtures={fixtures} citySlug={city} rows={standings} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Highlighted rows indicate current qualification positions.
      </p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/devkics/brand";
import { StandingsTable } from "@/components/devkics/match";
import { useDevKics } from "@/lib/devkics/store";
import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/$city/standings")({
  head: ({ params }) => {
    const name = params.city.charAt(0).toUpperCase() + params.city.slice(1);
    return {
      links: [canonicalLink(`/${params.city}/standings`)],
      meta: seoMeta({
        title: `Standings — DevKics ${name}`,
        description: `The live DevKics ${name} league table, updated live after every confirmed result.`,
        path: `/${params.city}/standings`,
      }),
    };
  },
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

import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { sponsors } from "@/lib/devkics/seed";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$city/sponsors")({
  head: () => ({
    meta: [
      { title: "Sponsors & Partners — DevKics Abuja" },
      {
        name: "description",
        content:
          "The headline, official and community partners powering the DevKics Abuja pilot season.",
      },
      { property: "og:title", content: "Sponsors & Partners — DevKics Abuja" },
      { property: "og:description", content: "Partners behind the DevKics Abuja pilot season." },
    ],
  }),
  component: SponsorsPage,
});

const tiers = ["Headline", "Official", "Community"] as const;

function SponsorsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Partners"
        title="Sponsors"
        description="DevKics Abuja runs on the support of partners who back the local tech community."
      />

      <div className="mt-10 space-y-12">
        {tiers.map((tier) => (
          <section key={tier}>
            <h2 className="font-display text-lg font-bold">{tier} partners</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sponsors
                .filter((s) => s.tier === tier)
                .map((s) => (
                  <div
                    key={s.id}
                    className="card-lift rounded-3xl border border-border bg-card p-6"
                  >
                    <span
                      className={cn(
                        "grid size-14 place-items-center rounded-2xl font-display text-lg font-bold",
                        tier === "Headline" && "bg-primary/12 text-primary",
                        tier === "Official" && "bg-flare/18 text-flare-foreground",
                        tier === "Community" && "bg-wine/10 text-wine",
                      )}
                    >
                      {s.initials}
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{s.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{s.blurb}</p>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 flex flex-col items-start gap-4 rounded-3xl border border-border bg-secondary/40 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Partner with DevKics Abuja</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reach hundreds of engineers, designers and founders every matchday.
          </p>
        </div>
        <Button asChild className="rounded-full px-6">
          <a href="mailto:partners@devkics.com">Request the deck</a>
        </Button>
      </div>
    </div>
  );
}

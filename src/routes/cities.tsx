import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/devkics/brand";
import { StatusDot } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cities } from "@/lib/devkics/seed";

export const Route = createFileRoute("/cities")({
  head: () => ({
    meta: [
      { title: "Find a City — DevKics" },
      {
        name: "description",
        content:
          "Browse DevKics cities worldwide. Join a live league, get on a waitlist, or apply to open a new chapter.",
      },
      { property: "og:title", content: "Find a City — DevKics" },
      {
        property: "og:description",
        content: "Browse DevKics cities worldwide and join your local tech football league.",
      },
    ],
  }),
  component: CitiesPage,
});

function CitiesPage() {
  const [query, setQuery] = useState("");
  const filtered = cities.filter((c) =>
    `${c.name} ${c.country}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <PageHeader
        eyebrow="Global network"
        title="Find a city"
        description="DevKics runs city by city. Abuja is our live pilot — the next chapters are being built now."
      />

      <div className="relative mt-8 max-w-md">
        <label htmlFor="city-search" className="sr-only">
          Search cities or countries
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="city-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city or country"
          className="h-12 rounded-full pl-10"
        />
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((city) => (
          <div
            key={city.slug}
            className="card-lift flex flex-col rounded-3xl border border-border bg-card p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold">{city.name}</h2>
                <p className="text-sm text-muted-foreground">{city.country}</p>
              </div>
              <StatusDot status={city.status} />
            </div>
            <p className="mt-4 flex-1 text-sm text-muted-foreground">{city.tagline}</p>
            {city.status === "live" && (
              <div className="mt-5 flex gap-6 border-t border-border pt-4 text-sm">
                <span>
                  <strong className="font-display">{city.teams}</strong>{" "}
                  <span className="text-muted-foreground">teams</span>
                </span>
                <span>
                  <strong className="font-display">{city.players}</strong>{" "}
                  <span className="text-muted-foreground">players</span>
                </span>
              </div>
            )}
            <div className="mt-6">
              {city.status === "live" ? (
                <Button asChild className="w-full rounded-full">
                  <Link to="/$city" params={{ city: city.slug }}>
                    Enter city portal
                  </Link>
                </Button>
              ) : city.status === "applications-open" ? (
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link to="/organize">Apply to organize</Link>
                </Button>
              ) : (
                <Button variant="ghost" className="w-full rounded-full" disabled>
                  Coming soon
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-16 text-center text-muted-foreground">
          No city matches “{query}”. Want to start one?{" "}
          <Link to="/organize" className="font-medium text-primary hover:underline">
            Apply here
          </Link>
          .
        </p>
      )}
    </div>
  );
}

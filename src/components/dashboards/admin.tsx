import { Link } from "@tanstack/react-router";

import { SectionHeading, StatCard } from "@/components/devkics/brand";
import { ApplicationQueue } from "./applications";
import { StatusDot } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cities } from "@/lib/devkics/seed";
import { useDevKics } from "@/lib/devkics/store";

export function AdminDashboard() {
  const { teams, players, applications, fixtures } = useDevKics();
  const pending = applications.filter((a) => a.status === "pending");

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live cities" value={cities.filter((c) => c.status === "live").length} />
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Players" value={players.length} tone="flare" />
        <StatCard label="Pending applications" value={pending.length} tone="wine" />
      </div>

      <Tabs defaultValue="cities">
        <TabsList className="rounded-full">
          <TabsTrigger value="cities" className="rounded-full">
            Cities
          </TabsTrigger>
          <TabsTrigger value="applications" className="rounded-full">
            City applications
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-full">
            Platform activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cities" className="mt-8 space-y-6">
          <SectionHeading title="City network" description="Every chapter across the platform." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => (
              <div key={c.slug} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">{c.name}</h3>
                  <StatusDot status={c.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.country}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {c.teams} teams · {c.players} players
                </p>
                {c.status === "live" && (
                  <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
                    <Link to="/$city" params={{ city: c.slug }}>
                      Open portal
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="applications" className="mt-8">
          <ApplicationQueue kinds={["city-organizer"]} title="City organizer applications" />
        </TabsContent>

        <TabsContent value="activity" className="mt-8 space-y-4">
          <SectionHeading title="Recent activity" />
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {fixtures
              .filter((f) => f.status === "completed")
              .slice(-6)
              .reverse()
              .map((f) => {
                const home = teams.find((t) => t.id === f.homeTeamId);
                const away = teams.find((t) => t.id === f.awayTeamId);
                return (
                  <li key={f.id} className="flex items-center justify-between px-5 py-4 text-sm">
                    <span>
                      Result confirmed · {home?.name} {f.homeScore}–{f.awayScore} {away?.name}
                    </span>
                    <span className="text-muted-foreground">{f.date}</span>
                  </li>
                );
              })}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

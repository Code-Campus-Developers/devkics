import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { SectionHeading, StatCard } from "@/components/devkics/brand";
import { ApplicationQueue } from "./applications";
import { AnnouncementManager } from "./announcements";
import { ReportsManager } from "./reports";
import { SponsorshipManager } from "./sponsorships";
import { StatusDot } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDevKics } from "@/lib/devkics/store";

export function AdminDashboard() {
  const { teams, players, applications, fixtures, cities, sponsorshipEnquiries, updateCityStatus } =
    useDevKics();
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
          <TabsTrigger value="sponsors" className="rounded-full">
            Sponsor enquiries
          </TabsTrigger>
          <TabsTrigger value="sponsor-management" className="rounded-full">
            Sponsors
          </TabsTrigger>
          <TabsTrigger value="news" className="rounded-full">
            Newsroom
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full">
            Reports
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={async () => {
                      try {
                        await updateCityStatus(c.slug, "live");
                        toast.success(`${c.name} set to live`);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Unable to update city",
                        );
                      }
                    }}
                  >
                    Mark live
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={async () => {
                      try {
                        await updateCityStatus(c.slug, "applications-open");
                        toast.success(`${c.name} set to applications open`);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Unable to update city",
                        );
                      }
                    }}
                  >
                    Open applications
                  </Button>
                </div>
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

        <TabsContent value="sponsors" className="mt-8 space-y-4">
          <SectionHeading
            title="Sponsorship enquiries"
            description="New partnership requests submitted from city sponsor pages."
          />
          {sponsorshipEnquiries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No sponsorship enquiries yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {sponsorshipEnquiries.map((enquiry) => (
                <li key={enquiry.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{enquiry.name}</p>
                    <span className="text-xs text-muted-foreground capitalize">
                      {enquiry.status.replaceAll("-", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {enquiry.organization ?? "Independent partner"} · {enquiry.city.name}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">{enquiry.message}</p>
                  <a
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    href={`mailto:${enquiry.email}`}
                  >
                    {enquiry.email}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="sponsor-management" className="mt-8">
          <SponsorshipManager />
        </TabsContent>
        <TabsContent value="news" className="mt-8">
          <AnnouncementManager />
        </TabsContent>
        <TabsContent value="reports" className="mt-8">
          <ReportsManager />
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

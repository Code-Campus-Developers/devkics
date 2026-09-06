import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

import { EmptyState } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { useDevKics } from "@/lib/devkics/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$city")({
  component: CityLayout,
});

const tabs = [
  { label: "Overview", to: "/$city" as const, exact: true },
  { label: "Tournament", to: "/$city/tournament" as const },
  { label: "Teams", to: "/$city/teams" as const },
  { label: "Players", to: "/$city/players" as const },
  { label: "Fixtures", to: "/$city/fixtures" as const },
  { label: "Results", to: "/$city/results" as const },
  { label: "Standings", to: "/$city/standings" as const },
  { label: "News", to: "/$city/news" as const },
  { label: "Gallery", to: "/$city/gallery" as const },
  { label: "Sponsors", to: "/$city/sponsors" as const },
];

function CityLayout() {
  const { city } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cities, bootstrapped } = useDevKics();
  const cityData = cities.find((c) => c.slug === city);

  if (bootstrapped && (!cityData || cityData.status !== "live")) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20">
        <EmptyState
          title="City Portal Not Active"
          description={`The city "${city}" is not currently running an active tournament season.`}
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/cities">Browse All Cities</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="surface-pitch">
        <div className="pitch-lines">
          <div className="mx-auto max-w-6xl px-5 pb-6 pt-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pitch-foreground/60">
              DevKics city portal
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold capitalize text-pitch-foreground sm:text-5xl">
              {cityData?.name ?? city}
            </h1>
            <p className="mt-2 text-pitch-foreground/70">
              {cityData?.country ?? "Global"} · Season 1 · 2026
            </p>
          </div>
        </div>
        <div className="border-t border-pitch-foreground/10">
          <div className="mx-auto max-w-6xl overflow-x-auto px-5">
            <nav className="flex gap-1 py-2" aria-label="City section navigation">
              {tabs.map((tab) => {
                const href = tab.to.replace("$city", city);
                const active = tab.exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={tab.label}
                    to={tab.to}
                    params={{ city }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-foreground text-pitch"
                        : "text-pitch-foreground/70 hover:bg-primary-foreground/10 hover:text-pitch-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <Outlet />
      </div>
    </div>
  );
}

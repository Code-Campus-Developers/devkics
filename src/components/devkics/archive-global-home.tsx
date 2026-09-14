import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin, Trophy, Users } from "lucide-react";

import heroPitch from "@/assets/hero-pitch.jpg";
import community from "@/assets/community.jpg";
import { SectionHeading, TeamCrest } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { tournaments } from "@/lib/devkics/seed";
import { useDevKics } from "@/lib/devkics/store";
import { computeStandings } from "@/lib/devkics/standings";
import { StatusDot } from "@/routes/index";

/**
 * Clean Archive of the original global multi-city DevKics landing page.
 * Preserved for future multi-city expansion reference.
 */
export function ArchiveGlobalHome() {
  const { teams, fixtures, players, cities, tournaments: liveTournaments } = useDevKics();
  const standings = computeStandings(teams, fixtures).slice(0, 4);
  const next = fixtures.filter((f) => f.status === "scheduled").slice(0, 3);
  const teamById = (id: string) => teams.find((t) => t.id === id);
  const tournament = liveTournaments[0] ?? tournaments[0]!;

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroPitch}
          alt="Five-a-side football match under floodlights in Abuja"
          width={1600}
          height={1008}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-[oklch(0.19_0.04_158/0.82)]" />
        <div className="pitch-lines absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <div className="rise-in max-w-3xl">
            <Badge className="rounded-full border-0 bg-primary-foreground/12 px-3 py-1 text-primary-foreground/90 backdrop-blur">
              Season 1 live in Abuja
            </Badge>
            <h1 className="mt-6 text-balance font-display text-5xl font-bold leading-[1.03] text-pitch-foreground sm:text-7xl">
              Where tech
              <br />
              comes to <span className="text-gradient-brand">play</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pitch-foreground/75">
              DevKics turns technology communities into football clubs. Engineers, designers and
              founders, one pitch, one city at a time.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link to="/cities">
                  Find your city <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-pitch-foreground/25 bg-transparent px-7 text-pitch-foreground hover:bg-primary-foreground/10 hover:text-pitch-foreground"
              >
                <Link to="/$city" params={{ city: "abuja" }}>
                  Explore Abuja
                </Link>
              </Button>
            </div>
            <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-pitch-foreground/15 pt-8">
              {[
                { k: "8", v: "Teams competing" },
                { k: `${players.length}`, v: "Registered players" },
                { k: "6", v: "Cities in pipeline" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-3xl font-bold text-pitch-foreground">{s.k}</dt>
                  <dd className="mt-1 text-sm text-pitch-foreground/60">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Live city */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Pilot city"
          title={tournament.name}
          description={tournament.summary}
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/$city" params={{ city: "abuja" }}>
                City portal
              </Link>
            </Button>
          }
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          <div className="card-lift rounded-3xl border border-border bg-card p-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Standings</h3>
              <Link
                to="/$city/standings"
                params={{ city: "abuja" }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Full table
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {standings.map((row, i) => {
                const team = teamById(row.teamId);
                if (!team) return null;
                return (
                  <li key={row.teamId} className="flex items-center gap-4 py-3">
                    <span className="w-5 font-display text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <TeamCrest team={team} size="sm" />
                    <span className="flex-1 truncate font-medium">{team.name}</span>
                    <span className="text-sm text-muted-foreground">{row.played} pl</span>
                    <span className="w-8 text-right font-display font-bold">{row.points}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card-lift rounded-3xl border border-border bg-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Next up</h3>
              <Link
                to="/$city/fixtures"
                params={{ city: "abuja" }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Fixtures
              </Link>
            </div>
            <ul className="mt-4 space-y-3">
              {next.map((fx) => {
                const home = teamById(fx.homeTeamId);
                const away = teamById(fx.awayTeamId);
                return (
                  <li key={fx.id} className="rounded-2xl bg-muted/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <CalendarDays className="mr-1.5 inline size-3.5" />
                      {fx.date} · {fx.time}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {home?.name} <span className="text-muted-foreground">vs</span> {away?.name}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeading
            eyebrow="How it works"
            title="Three steps from Slack channel to kick-off"
            align="center"
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: MapPin,
                title: "Find your city",
                body: "Join a live DevKics city or apply to open a new chapter for your community.",
              },
              {
                icon: Users,
                title: "Build your team",
                body: "Register your company or community side and invite players into your squad.",
              },
              {
                icon: Trophy,
                title: "Compete",
                body: "Play the season, track live standings, and fight for the city cup.",
              },
            ].map((s, i) => (
              <div key={s.title} className="card-lift rounded-3xl border border-border bg-card p-7">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-display text-sm font-bold text-muted-foreground">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Global map"
          title="Cities on the DevKics map"
          description="Abuja is live. The next chapters are opening now."
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/cities">All cities</Link>
            </Button>
          }
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.slice(0, 6).map((city) => (
            <Link
              key={city.slug}
              to={city.status === "live" ? "/$city" : "/cities"}
              params={{ city: city.slug }}
              className="card-lift group rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">{city.name}</h3>
                <StatusDot status={city.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{city.country}</p>
              <p className="mt-4 text-sm text-muted-foreground">{city.tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Community CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-4">
        <div className="grid overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-2">
          <img
            src={community}
            alt="DevKics players celebrating with a trophy"
            width={1400}
            height={900}
            loading="lazy"
            decoding="async"
            className="h-64 w-full object-cover lg:h-full"
          />
          <div className="p-8 sm:p-12">
            <h2 className="text-3xl font-bold">Bring DevKics to your city</h2>
            <p className="mt-4 text-muted-foreground">
              We provide the playbook, the platform and sponsorship support. You bring the community
              and the pitch.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="rounded-full px-6">
                <Link to="/organize">Become a city organizer</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/volunteer">Volunteer instead</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

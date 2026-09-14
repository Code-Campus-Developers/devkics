import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { EmptyState, PageHeader, TeamCrest } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDevKics } from "@/lib/devkics/store";
import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/$city/players")({
  head: ({ params }) => {
    const title = "Squad Registry — DevKics Abuja";
    const description =
      "Approved squad directory for the DevKics Abuja Cup: engineers, designers and founders on the pitch.";
    return {
      links: [canonicalLink(`/${params.city}/players`)],
      meta: seoMeta({
        title,
        description,
        path: `/${params.city}/players`,
      }),
    };
  },
  component: PlayersPage,
});

function PlayersPage() {
  const { players, teams, currentUser } = useDevKics();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("all");

  if (!currentUser) {
    return (
      <div>
        <PageHeader
          eyebrow="Registry"
          title="Squad Roster Access"
          description="Player registry access is restricted to authenticated squad members, managers, and officials."
        />
        <div className="mt-8">
          <EmptyState
            title="Sign In Required"
            description="Player identities and squad directories are private. Please sign in to view your squad and teammates."
            action={
              <Button asChild size="sm" className="rounded-full">
                <Link to="/auth">Sign In</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Registry"
          title="Squad Players"
          description="View approved teammates and squad members."
        />
        <div className="mt-8">
          <EmptyState
            title="No Squad Members Found"
            description="You do not currently have an approved squad membership. Join a team or await manager confirmation to view your squad."
          />
        </div>
      </div>
    );
  }

  const filtered = players
    .filter((p) => (position === "all" ? true : p.position === position))
    .filter((p) => `${p.name} ${p.role}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.goals - a.goals);

  return (
    <div>
      <PageHeader
        eyebrow="Registry"
        title="Squad Players"
        description={`${players.length} squad member${players.length === 1 ? "" : "s"} visible in your approved roster.`}
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="player-search" className="sr-only">
            Search players or roles
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="player-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players or roles"
            className="h-11 rounded-full pl-10"
          />
        </div>
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger
            aria-label="Filter by position"
            className="h-11 w-full rounded-full sm:w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All positions</SelectItem>
            <SelectItem value="GK">Goalkeepers</SelectItem>
            <SelectItem value="DEF">Defenders</SelectItem>
            <SelectItem value="MID">Midfielders</SelectItem>
            <SelectItem value="FWD">Forwards</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No Players Found"
            description={
              query
                ? `No players matched "${query}". Try adjusting your search query or position filter.`
                : "No registered players found for this category."
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 60).map((p) => {
            const team = teams.find((t) => t.id === p.teamId);
            return (
              <div
                key={p.id}
                className="card-lift flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
              >
                {team && <TeamCrest team={team} size="md" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.position} · {p.role}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{team?.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold">{p.goals}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    goals
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

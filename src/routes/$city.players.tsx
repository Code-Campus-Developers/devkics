import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { PageHeader, TeamCrest } from "@/components/devkics/brand";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/$city/players")({
  head: () => ({
    meta: [
      { title: "Players — DevKics Abuja" },
      {
        name: "description",
        content:
          "The full player registry for the DevKics Abuja Cup: engineers, designers and founders on the pitch.",
      },
      { property: "og:title", content: "Players — DevKics Abuja" },
      { property: "og:description", content: "Every registered DevKics Abuja player." },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const { players, teams } = useDevKics();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("all");

  const filtered = players
    .filter((p) => (position === "all" ? true : p.position === position))
    .filter((p) => `${p.name} ${p.role}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.goals - a.goals);

  return (
    <div>
      <PageHeader
        eyebrow="Registry"
        title="Players"
        description={`${players.length} registered players across the Abuja season.`}
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
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">goals</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

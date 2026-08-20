import { useState } from "react";
import { toast } from "sonner";

import { SectionHeading, StatCard, TeamCrest } from "@/components/devkics/brand";
import { StandingsTable } from "@/components/devkics/match";
import { ApplicationQueue } from "./applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tournaments } from "@/lib/devkics/seed";
import { useDevKics } from "@/lib/devkics/store";

export function OrganizerDashboard() {
  const { teams, players, fixtures, applications } = useDevKics();
  const tournament = tournaments[0]!;
  const pending = applications.filter((a) => a.status === "pending" && a.kind !== "city-organizer");

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tournament" value={tournament.season} hint={tournament.name} />
        <StatCard label="Teams" value={teams.length} />
        <StatCard
          label="Matches remaining"
          value={fixtures.filter((f) => f.status === "scheduled").length}
          tone="flare"
        />
        <StatCard label="Pending reviews" value={pending.length} tone="wine" />
      </div>

      <Tabs defaultValue="matches">
        <TabsList className="rounded-full">
          <TabsTrigger value="matches" className="rounded-full">
            Fixtures & results
          </TabsTrigger>
          <TabsTrigger value="teams" className="rounded-full">
            Teams
          </TabsTrigger>
          <TabsTrigger value="table" className="rounded-full">
            Table
          </TabsTrigger>
          <TabsTrigger value="applications" className="rounded-full">
            Applications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-8 space-y-10">
          <ScheduleForm />
          <ResultsManager />
        </TabsContent>

        <TabsContent value="teams" className="mt-8 space-y-6">
          <SectionHeading
            title="Registered teams"
            description="Squad sizes and group assignments for this season."
          />
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center gap-4 px-5 py-4">
                <TeamCrest team={t} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.company} · {t.managerName}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">Group {t.group}</span>
                <span className="w-20 text-right text-sm text-muted-foreground">
                  {players.filter((p) => p.teamId === t.id).length} players
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="table" className="mt-8">
          <StandingsTable teams={teams} fixtures={fixtures} citySlug="abuja" />
        </TabsContent>

        <TabsContent value="applications" className="mt-8 space-y-10">
          <ApplicationQueue kinds={["team", "player"]} title="Team & player applications" />
          <ApplicationQueue kinds={["volunteer"]} title="Volunteer applications" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScheduleForm() {
  const { teams, addFixture } = useDevKics();
  const [form, setForm] = useState({
    homeTeamId: teams[0]?.id ?? "",
    awayTeamId: teams[1]?.id ?? "",
    date: "2026-09-05",
    time: "10:00",
    matchday: "6",
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-xl font-bold">Schedule a match</h2>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.homeTeamId === form.awayTeamId) {
            toast.error("Pick two different teams");
            return;
          }
          addFixture({ ...form, matchday: Number(form.matchday) });
          toast.success("Fixture added");
        }}
      >
        <div className="space-y-2 sm:col-span-1">
          <Label className="text-xs">Home</Label>
          <Select
            value={form.homeTeamId}
            onValueChange={(v) => setForm({ ...form, homeTeamId: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Away</Label>
          <Select
            value={form.awayTeamId}
            onValueChange={(v) => setForm({ ...form, awayTeamId: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Kick-off</Label>
          <Input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Matchday</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={form.matchday}
              onChange={(e) => setForm({ ...form, matchday: e.target.value })}
            />
            <Button type="submit" className="rounded-full px-5">
              Add
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function ResultsManager() {
  const { fixtures, teams, updateResult } = useDevKics();
  const ordered = [...fixtures].sort((a, b) => a.matchday - b.matchday);

  return (
    <section>
      <SectionHeading
        title="Match results"
        description="Enter a score and the league table updates instantly."
      />
      <ul className="mt-6 space-y-3">
        {ordered.map((f) => (
          <ResultRow
            key={f.id}
            fixtureId={f.id}
            label={`${teams.find((t) => t.id === f.homeTeamId)?.name ?? ""} vs ${
              teams.find((t) => t.id === f.awayTeamId)?.name ?? ""
            }`}
            meta={`MD${f.matchday} · ${f.date}`}
            home={f.homeScore}
            away={f.awayScore}
            done={f.status === "completed"}
            onSave={updateResult}
          />
        ))}
      </ul>
    </section>
  );
}

function ResultRow({
  fixtureId,
  label,
  meta,
  home,
  away,
  done,
  onSave,
}: {
  fixtureId: string;
  label: string;
  meta: string;
  home: number | null;
  away: number | null;
  done: boolean;
  onSave: (id: string, h: number, a: number) => void;
}) {
  const [h, setH] = useState(home === null ? "" : String(home));
  const [a, setA] = useState(away === null ? "" : String(away));

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {meta} {done && "· confirmed"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="w-16 text-center"
          inputMode="numeric"
          value={h}
          onChange={(e) => setH(e.target.value)}
          placeholder="–"
        />
        <span className="text-muted-foreground">:</span>
        <Input
          className="w-16 text-center"
          inputMode="numeric"
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="–"
        />
        <Button
          size="sm"
          variant={done ? "outline" : "default"}
          className="rounded-full"
          onClick={() => {
            const hs = Number(h);
            const as = Number(a);
            if (Number.isNaN(hs) || Number.isNaN(as) || h === "" || a === "") {
              toast.error("Enter both scores");
              return;
            }
            onSave(fixtureId, hs, as);
            toast.success("Result saved — standings updated");
          }}
        >
          {done ? "Update" : "Confirm"}
        </Button>
      </div>
    </li>
  );
}

import { useState } from "react";
import { toast } from "sonner";

import { LoadingSkeleton, SectionHeading, StatCard, TeamCrest } from "@/components/devkics/brand";
import { StandingsTable } from "@/components/devkics/match";
import { ApplicationQueue } from "./applications";
import { AnnouncementManager } from "./announcements";
import { GalleryManager } from "./gallery";
import { VolunteerOperationsManager } from "./volunteer-operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDevKics } from "@/lib/devkics/store";
import type { MatchEvent } from "@/lib/devkics/types";

export function OrganizerDashboard() {
  const {
    teams,
    players,
    fixtures,
    applications,
    organizations,
    tournaments,
    standings,
    volunteerApplications,
    updateTeam,
    reviewOrganization,
    reviewPlayer,
    reviewVolunteerApplication,
    loadingTournamentOps,
  } = useDevKics();
  const tournament = tournaments[0];

  const pending = applications.filter((a) => a.status === "pending" && a.kind !== "city-organizer");
  const pendingOrganizations = organizations.filter(
    (organization) =>
      organization.status === "submitted" ||
      organization.status === "under-review" ||
      organization.status === "more-info-required",
  );
  const pendingTeams = teams.filter(
    (team) => team.status === "submitted" || team.status === "under-review",
  );
  const pendingPlayers = players.filter(
    (player) => player.status === "pending-approval" || player.status === "registration-incomplete",
  );
  const pendingVolunteerApplications = volunteerApplications.filter(
    (application) => application.status === "submitted" || application.status === "under-review",
  );

  if (loadingTournamentOps) {
    return (
      <div className="space-y-8" role="status" aria-label="Loading tournament operations">
        <LoadingSkeleton variant="stats" count={4} />
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tournament"
          value={tournament?.season ?? "No season"}
          hint={tournament?.name ?? "Create or publish a tournament"}
        />
        <StatCard label="Teams" value={teams.length} />
        <StatCard
          label="Matches remaining"
          value={fixtures.filter((f) => f.status === "scheduled").length}
          tone="flare"
        />
        <StatCard label="Pending reviews" value={pending.length} tone="wine" />
      </div>

      <Tabs defaultValue="matches">
        <TabsList className="rounded-full" aria-label="Organizer management sections">
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
          <TabsTrigger value="volunteer-ops" className="rounded-full">
            Volunteer ops
          </TabsTrigger>
          <TabsTrigger value="news" className="rounded-full">
            Newsroom
          </TabsTrigger>
          <TabsTrigger value="gallery" className="rounded-full">
            Gallery
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
          <StandingsTable teams={teams} fixtures={fixtures} citySlug="abuja" rows={standings} />
        </TabsContent>

        <TabsContent value="applications" className="mt-8 space-y-10">
          <section className="space-y-4">
            <SectionHeading
              title="Volunteer applications"
              description="Review matchday volunteers and assign approved applicants to this season."
            />
            <ul className="space-y-3">
              {pendingVolunteerApplications.map((application) => (
                <li key={application.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-medium">{application.name}</p>
                  <p className="text-xs text-muted-foreground">{application.email}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{application.availability}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          if (application.status === "submitted") {
                            await reviewVolunteerApplication(application.id, "under-review");
                          }
                          await reviewVolunteerApplication(
                            application.id,
                            "approved",
                            tournament ? { tournamentId: tournament.id } : undefined,
                          );
                          toast.success("Volunteer approved and assigned");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Unable to approve volunteer",
                          );
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          if (application.status === "submitted") {
                            await reviewVolunteerApplication(application.id, "under-review");
                          }
                          await reviewVolunteerApplication(application.id, "rejected");
                          toast.success("Volunteer application rejected");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Unable to reject volunteer",
                          );
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
              {pendingVolunteerApplications.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No volunteer applications awaiting review.
                </p>
              )}
            </ul>
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Organization approvals"
              description="Review organizations before team registration and match operations."
            />
            <ul className="space-y-3">
              {pendingOrganizations.map((organization) => (
                <li key={organization.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-medium">{organization.name}</p>
                  <p className="text-xs text-muted-foreground">{organization.email}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{organization.description}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await reviewOrganization(organization.id, "under-review");
                          await reviewOrganization(organization.id, "approved");
                          toast.success("Organization approved");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Unable to approve organization",
                          );
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await reviewOrganization(organization.id, "rejected");
                          toast.success("Organization rejected");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Unable to reject organization",
                          );
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
              {pendingOrganizations.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No pending organization approvals.
                </p>
              )}
            </ul>
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Team approvals"
              description="Approve teams before fixture publication."
            />
            <ul className="space-y-3">
              {pendingTeams.map((team) => (
                <li key={team.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-medium">{team.name}</p>
                  <p className="text-xs text-muted-foreground">{team.company}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await updateTeam(team.id, { status: "under-review" });
                          await updateTeam(team.id, { status: "approved" });
                          toast.success("Team approved");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Unable to approve team",
                          );
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await updateTeam(team.id, { status: "rejected" });
                          toast.success("Team rejected");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Unable to reject team",
                          );
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
              {pendingTeams.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No pending team approvals.
                </p>
              )}
            </ul>
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Player approvals"
              description="Approve players after consent and registration checks."
            />
            <ul className="space-y-3">
              {pendingPlayers.map((player) => (
                <li key={player.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-medium">{player.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {player.position} · #{player.number || "--"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await reviewPlayer(player.id, "approved");
                          toast.success("Player approved");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Unable to approve player",
                          );
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await reviewPlayer(player.id, "disqualified");
                          toast.success("Player disqualified");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Unable to update player",
                          );
                        }
                      }}
                    >
                      Disqualify
                    </Button>
                  </div>
                </li>
              ))}
              {pendingPlayers.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No pending player approvals.
                </p>
              )}
            </ul>
          </section>

          <ApplicationQueue kinds={["team", "player"]} title="Team & player applications" />
          <ApplicationQueue kinds={["volunteer"]} title="Volunteer applications" />
        </TabsContent>

        <TabsContent value="volunteer-ops" className="mt-8">
          <VolunteerOperationsManager />
        </TabsContent>

        <TabsContent value="news" className="mt-8">
          <AnnouncementManager />
        </TabsContent>

        <TabsContent value="gallery" className="mt-8">
          <GalleryManager />
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
  onSave: (
    id: string,
    h: number,
    a: number,
    detail?: {
      halfTimeHome?: number;
      halfTimeAway?: number;
      extraTimeHome?: number;
      extraTimeAway?: number;
      penaltyHome?: number;
      penaltyAway?: number;
      notes?: string;
      events?: MatchEvent[];
    },
  ) => Promise<void>;
}) {
  const [h, setH] = useState(home === null ? "" : String(home));
  const [a, setA] = useState(away === null ? "" : String(away));
  const [htHome, setHtHome] = useState("");
  const [htAway, setHtAway] = useState("");
  const [etHome, setEtHome] = useState("");
  const [etAway, setEtAway] = useState("");
  const [penHome, setPenHome] = useState("");
  const [penAway, setPenAway] = useState("");
  const [notes, setNotes] = useState("");
  const [eventText, setEventText] = useState("");

  const parseEvents = (): MatchEvent[] => {
    if (!eventText.trim()) return [];
    const lines = eventText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const events: MatchEvent[] = [];
    for (const line of lines) {
      const [typeRaw, minuteRaw, teamIdRaw, playerIdRaw, detailRaw] = line.split("|");
      const type = typeRaw?.trim();
      if (!type) continue;
      const event: MatchEvent = { type: type as MatchEvent["type"] };
      if (minuteRaw?.trim()) {
        const parsedMinute = Number(minuteRaw.trim());
        if (Number.isFinite(parsedMinute)) event.minute = parsedMinute;
      }
      if (teamIdRaw?.trim()) event.teamId = teamIdRaw.trim();
      if (playerIdRaw?.trim()) event.playerId = playerIdRaw.trim();
      if (detailRaw?.trim()) event.detail = detailRaw.trim();
      events.push(event);
    }
    return events;
  };

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
          onClick={async () => {
            const hs = Number(h);
            const as = Number(a);
            if (Number.isNaN(hs) || Number.isNaN(as) || h === "" || a === "") {
              toast.error("Enter both scores");
              return;
            }
            try {
              const detail: {
                halfTimeHome?: number;
                halfTimeAway?: number;
                extraTimeHome?: number;
                extraTimeAway?: number;
                penaltyHome?: number;
                penaltyAway?: number;
                notes?: string;
                events?: MatchEvent[];
              } = { events: parseEvents() };
              if (htHome !== "") detail.halfTimeHome = Number(htHome);
              if (htAway !== "") detail.halfTimeAway = Number(htAway);
              if (etHome !== "") detail.extraTimeHome = Number(etHome);
              if (etAway !== "") detail.extraTimeAway = Number(etAway);
              if (penHome !== "") detail.penaltyHome = Number(penHome);
              if (penAway !== "") detail.penaltyAway = Number(penAway);
              if (notes.trim()) detail.notes = notes.trim();
              await onSave(fixtureId, hs, as, detail);
              toast.success("Result and events saved");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to save result");
            }
          }}
        >
          {done ? "Update" : "Confirm"}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={htHome} onChange={(e) => setHtHome(e.target.value)} placeholder="HT home" />
        <Input value={htAway} onChange={(e) => setHtAway(e.target.value)} placeholder="HT away" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
        <Input value={etHome} onChange={(e) => setEtHome(e.target.value)} placeholder="ET home" />
        <Input value={etAway} onChange={(e) => setEtAway(e.target.value)} placeholder="ET away" />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={penHome}
            onChange={(e) => setPenHome(e.target.value)}
            placeholder="Pens H"
          />
          <Input
            value={penAway}
            onChange={(e) => setPenAway(e.target.value)}
            placeholder="Pens A"
          />
        </div>
      </div>
      <Textarea
        value={eventText}
        onChange={(e) => setEventText(e.target.value)}
        className="min-h-20"
        placeholder="Events: goal|12|teamId|playerId|Left-foot finish (one per line)"
      />
    </li>
  );
}

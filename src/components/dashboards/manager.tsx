import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { SectionHeading, StatCard, TeamCrest } from "@/components/devkics/brand";
import { MatchRow } from "@/components/devkics/match";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useDevKics } from "@/lib/devkics/store";
import { computeStandings } from "@/lib/devkics/standings";
import type { Player } from "@/lib/devkics/types";

export function ManagerDashboard() {
  const {
    currentUser,
    teams,
    players,
    fixtures,
    organizations,
    submitApplication,
    createTeam,
    addPlayer,
    removePlayer,
  } = useDevKics();
  const team = teams.find(
    (t) => t.id === currentUser?.teamId || t.managerUserId === currentUser?.id,
  );
  const approvedOrganization = organizations.find(
    (organization) => organization.status === "approved",
  );
  const pendingOrganization = organizations.find(
    (organization) => organization.status !== "approved",
  );
  const [newTeam, setNewTeam] = useState({ name: "", shortName: "", company: "", group: "A" });
  const [organizationForm, setOrganizationForm] = useState({
    name: "",
    email: currentUser?.email ?? "",
    detail: "",
  });
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    position: "MID" as Player["position"],
    number: "",
    role: "",
  });
  const [waiverConfirmed, setWaiverConfirmed] = useState(true);

  if (!team) {
    if (!approvedOrganization) {
      return (
        <div className="mx-auto max-w-xl">
          <SectionHeading
            title="Register your organization"
            description="Phase 2 requires an approved organization before team registration can continue."
          />
          <form
            className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-7"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await submitApplication({
                  kind: "team",
                  name: organizationForm.name,
                  email: organizationForm.email,
                  city: currentUser?.citySlug ?? "abuja",
                  detail: organizationForm.detail,
                });
                toast.success("Organization submitted for review");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Unable to submit organization",
                );
              }
            }}
          >
            <div className="space-y-2">
              <Label>Organization name</Label>
              <Input
                required
                value={organizationForm.name}
                onChange={(e) => setOrganizationForm({ ...organizationForm, name: e.target.value })}
                placeholder="Interswitch Engineering"
              />
            </div>
            <div className="space-y-2">
              <Label>Organization contact email</Label>
              <Input
                required
                type="email"
                value={organizationForm.email}
                onChange={(e) =>
                  setOrganizationForm({ ...organizationForm, email: e.target.value })
                }
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                required
                value={organizationForm.detail}
                onChange={(e) =>
                  setOrganizationForm({ ...organizationForm, detail: e.target.value })
                }
                placeholder="Your team, community profile, and readiness"
              />
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full">
              Submit organization
            </Button>
          </form>
          {pendingOrganization && (
            <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Current status: {pendingOrganization.status.replace("-", " ")}. Team creation unlocks
              after approval.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl">
        <SectionHeading
          title="Create your team"
          description="Register your company or community side to enter the DevKics Abuja Cup."
        />
        <form
          className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-7"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createTeam(newTeam);
              toast.success("Team registration submitted");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to create team");
            }
          }}
        >
          <div className="space-y-2">
            <Label>Team name</Label>
            <Input
              required
              value={newTeam.name}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
              placeholder="Interswitch Devs"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Short name (3 letters)</Label>
              <Input
                required
                maxLength={3}
                value={newTeam.shortName}
                onChange={(e) => setNewTeam({ ...newTeam, shortName: e.target.value })}
                placeholder="ISW"
              />
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={newTeam.group}
                onValueChange={(v) => setNewTeam({ ...newTeam, group: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Group A</SelectItem>
                  <SelectItem value="B">Group B</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company or community</Label>
            <Input
              required
              value={newTeam.company}
              onChange={(e) => setNewTeam({ ...newTeam, company: e.target.value })}
              placeholder="Interswitch"
            />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-full">
            Create team
          </Button>
        </form>
      </div>
    );
  }

  const squad = players.filter((p) => p.teamId === team.id);
  const row = computeStandings(teams, fixtures).find((s) => s.teamId === team.id);
  const teamFixtures = fixtures.filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id);

  const submitPlayer = (status: Player["status"]) => {
    if (!newPlayer.name) {
      toast.error("Enter a player name");
      return;
    }
    if (status === "active" && !waiverConfirmed) {
      toast.error(
        "Player must have confirmed acceptance of the Participation Waiver & Media Consent",
      );
      return;
    }
    addPlayer({
      teamId: team.id,
      name: newPlayer.name,
      position: newPlayer.position,
      number: Number(newPlayer.number) || squad.length + 1,
      role: newPlayer.role || "Team member",
      status,
    })
      .then(() => {
        setNewPlayer({ name: "", position: "MID", number: "", role: "" });
        toast.success(status === "invited" ? "Invitation sent" : "Player registration submitted");
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Unable to add player");
      });
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <TeamCrest team={team} size="lg" />
        <div>
          <h2 className="font-display text-2xl font-bold">{team.name}</h2>
          <p className="text-sm text-muted-foreground">
            {team.company} · Group {team.group}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Squad size" value={squad.length} />
        <StatCard label="Played" value={row?.played ?? 0} />
        <StatCard label="Points" value={row?.points ?? 0} tone="flare" />
        <StatCard label="Goals for" value={row?.goalsFor ?? 0} tone="wine" />
      </div>

      <Tabs defaultValue="squad">
        <TabsList className="rounded-full" aria-label="Team manager sections">
          <TabsTrigger value="squad" className="rounded-full">
            Squad
          </TabsTrigger>
          <TabsTrigger value="matches" className="rounded-full">
            Matches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="squad" className="mt-8 space-y-8">
          <section className="rounded-3xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Add or invite a player</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-5">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  placeholder="Chidi Nwankwo"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Position</Label>
                <Select
                  value={newPlayer.position}
                  onValueChange={(v) =>
                    setNewPlayer({ ...newPlayer, position: v as Player["position"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["GK", "DEF", "MID", "FWD"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Number</Label>
                <Input
                  inputMode="numeric"
                  value={newPlayer.number}
                  onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
                  placeholder="14"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Day job</Label>
                <Input
                  value={newPlayer.role}
                  onChange={(e) => setNewPlayer({ ...newPlayer, role: e.target.value })}
                  placeholder="Backend Engineer"
                />
              </div>
            </div>
            <div className="mt-4 flex items-start space-x-3">
              <Checkbox
                id="manager-player-waiver"
                checked={waiverConfirmed}
                onCheckedChange={(c) => setWaiverConfirmed(c === true)}
              />
              <Label
                htmlFor="manager-player-waiver"
                className="text-xs font-normal leading-relaxed text-muted-foreground"
              >
                Player has signed and accepted the{" "}
                <Link
                  to="/legal"
                  search={{ tab: "waiver" }}
                  target="_blank"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                >
                  Player Participation Waiver & Media Consent
                </Link>
                .
              </Label>
            </div>
            <div className="mt-5 flex gap-3">
              <Button className="rounded-full px-6" onClick={() => submitPlayer("active")}>
                Add to squad
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => submitPlayer("invited")}
              >
                Send invite
              </Button>
            </div>
          </section>

          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {squad.map((p) => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-6 font-display font-bold text-muted-foreground">{p.number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.name}
                    {p.status === "invited" && (
                      <Badge variant="outline" className="ml-2 rounded-full text-[10px]">
                        invited
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.position} · {p.role}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${p.name}`}
                  onClick={async () => {
                    try {
                      await removePlayer(p.id);
                      toast(`${p.name} removed from squad`);
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Unable to remove player",
                      );
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="matches" className="mt-8">
          <div className="grid gap-4 md:grid-cols-2">
            {teamFixtures.map((f) => (
              <MatchRow key={f.id} fixture={f} teams={teams} citySlug="abuja" />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

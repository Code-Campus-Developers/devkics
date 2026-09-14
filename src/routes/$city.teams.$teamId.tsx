import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Lock, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { FormPill, TeamCrest, EmptyState } from "@/components/devkics/brand";
import { MatchRow } from "@/components/devkics/match";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teams as seedTeams } from "@/lib/devkics/seed";
import { useDevKics } from "@/lib/devkics/store";
import { computeStandings } from "@/lib/devkics/standings";
import type { Player } from "@/lib/devkics/types";
import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/$city/teams/$teamId")({
  head: ({ params }) => {
    const team = seedTeams.find((t) => t.id === params.teamId);
    const title = `${team?.name ?? "Team"} — DevKics Abuja`;
    const description = `Squad list, fixtures and form for ${team?.name ?? "this team"} in the DevKics Abuja Cup.`;
    return {
      links: [canonicalLink(`/${params.city}/teams/${params.teamId}`)],
      meta: seoMeta({
        title,
        description,
        path: `/${params.city}/teams/${params.teamId}`,
      }),
    };
  },
  component: TeamDetail,
});

function TeamDetail() {
  const { city, teamId } = Route.useParams();
  const { currentUser, teams, players, fixtures, requestToJoinTeam } = useDevKics();
  const team = teams.find((t) => t.id === teamId);

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinPosition, setJoinPosition] = useState<Player["position"]>("MID");
  const [joinNumber, setJoinNumber] = useState("");
  const [joinRole, setJoinRole] = useState("");
  const [joinWaiver, setJoinWaiver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!team) {
    return (
      <EmptyState
        title="Team Not Found"
        description="The team you are looking for does not exist or has not registered yet for this tournament edition."
        action={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/$city/teams" params={{ city }}>
              Back to teams
            </Link>
          </Button>
        }
      />
    );
  }

  const squad = players.filter((p) => p.teamId === team.id && p.status === "approved");
  const standings = computeStandings(teams, fixtures);
  const rank = standings.findIndex((s) => s.teamId === team.id) + 1;
  const row = standings.find((s) => s.teamId === team.id);
  const teamFixtures = fixtures.filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id);

  const isRosterLocked = team.status === "locked" || Boolean(team.squadLockedAt);

  const userMembership = currentUser
    ? players.find((p) => p.userId === currentUser.id && p.teamId === team.id)
    : undefined;

  const isApprovedOnThisTeam = userMembership?.status === "approved";
  const isPendingOnThisTeam = userMembership?.status === "pending-approval";
  const isInvitedOnThisTeam =
    userMembership?.status === "invited" ||
    players.some(
      (p) =>
        p.teamId === team.id &&
        p.status === "invited" &&
        p.email &&
        currentUser?.email &&
        p.email.toLowerCase() === currentUser.email.toLowerCase(),
    );

  const isApprovedOnOtherTeam = currentUser
    ? players.some(
        (p) => p.userId === currentUser.id && p.teamId !== team.id && p.status === "approved",
      )
    : false;

  const isTeamManager = currentUser?.id === team.managerUserId;
  const isLeagueOfficial = currentUser?.role === "admin" || currentUser?.role === "organizer";
  const canViewSquadDetails = isApprovedOnThisTeam || isTeamManager || isLeagueOfficial;

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinPosition || !joinWaiver) return;

    try {
      setIsSubmitting(true);
      const joinPayload: {
        position: Player["position"];
        number?: number;
        role?: string;
        waiverAccepted: boolean;
      } = {
        position: joinPosition,
        waiverAccepted: true,
      };
      if (joinNumber) {
        joinPayload.number = Number(joinNumber);
      }
      if (joinRole.trim()) {
        joinPayload.role = joinRole.trim();
      }
      await requestToJoinTeam(team.id, joinPayload);
      toast.success("Join request submitted! The team manager has been notified.");
      setIsJoinOpen(false);
      setJoinPosition("MID");
      setJoinNumber("");
      setJoinRole("");
      setJoinWaiver(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit request";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderJoinAction = () => {
    if (isApprovedOnThisTeam) {
      return (
        <Badge className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-500">
          <CheckCircle2 className="mr-1 size-3" /> You are on this squad
        </Badge>
      );
    }

    if (isPendingOnThisTeam) {
      return (
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs text-amber-500">
          Join Request Pending
        </Badge>
      );
    }

    if (isInvitedOnThisTeam) {
      return (
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs text-sky-400">
          Invitation Received — Check Dashboard
        </Badge>
      );
    }

    if (isApprovedOnOtherTeam) {
      return (
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs text-muted-foreground">
          Playing for another team
        </Badge>
      );
    }

    if (isRosterLocked) {
      return (
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs text-muted-foreground">
          <Lock className="mr-1 size-3" /> Roster locked
        </Badge>
      );
    }

    if (!currentUser) {
      return (
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/auth" search={{ redirect: `/${city}/teams/${teamId}` }}>
            Sign in to Join
          </Link>
        </Button>
      );
    }

    if (currentUser.role === "player") {
      return (
        <Button
          size="sm"
          className="rounded-full"
          onClick={() => {
            setIsJoinOpen(true);
            setJoinWaiver(false);
          }}
        >
          <UserPlus className="mr-1.5 size-4" /> Request to Join
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-12">
      <Link
        to="/$city/teams"
        params={{ city }}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All teams
      </Link>

      <div className="rise-in flex flex-col gap-6 sm:flex-row sm:items-center">
        <TeamCrest team={team} size="lg" />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{team.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {team.company} · Group {team.group} · Managed by {team.managerName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {renderJoinAction()}
          <div className="flex gap-1.5">
            {team.status && (
              <Badge variant="outline" className="rounded-full capitalize">
                {team.status}
              </Badge>
            )}
            {row && rank > 0 && (
              <Badge variant="secondary" className="rounded-full">
                #{rank} in table
              </Badge>
            )}
            {(row?.form ?? []).map((r, i) => (
              <FormPill key={i} result={r} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          ["Founded", team.founded],
          ["Company", team.company],
          ["Points", row?.points ?? 0],
          [
            "Goal diff",
            (row?.goalDifference ?? 0) > 0 ? `+${row?.goalDifference}` : (row?.goalDifference ?? 0),
          ],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-2xl font-bold">Squad</h2>
          {canViewSquadDetails && (
            <span className="text-xs text-muted-foreground">{squad.length} confirmed players</span>
          )}
        </div>
        {canViewSquadDetails ? (
          <div className="mt-4 overflow-x-auto rounded-3xl border border-border bg-card">
            <table className="w-full min-w-[560px] text-sm" aria-label="Team squad roster">
              <caption className="sr-only">Team Squad Roster</caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    <span className="sr-only">Kit Number</span>#
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Player
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Position
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Day job
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">
                    <abbr title="Goals">G</abbr>
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">
                    <abbr title="Assists">A</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {squad.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No players have been officially confirmed to the active roster yet.
                    </td>
                  </tr>
                ) : (
                  squad.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-display font-bold text-muted-foreground">
                        {p.number}
                      </td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.position}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.role}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{p.goals}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{p.assists}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/60 text-muted-foreground">
                <Lock className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">Squad Roster Protected</h3>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                Individual player identities and squad details are restricted to confirmed squad
                members, team managers, and league officials.
              </p>
              {!currentUser && (
                <div className="mt-5">
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/auth" search={{ redirect: `/${city}/teams/${teamId}` }}>
                      Sign In to View Squad
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold">Matches</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {teamFixtures.map((f) => (
            <MatchRow key={f.id} fixture={f} teams={teams} citySlug={city} />
          ))}
        </div>
      </section>

      <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request to Join {team.name}</DialogTitle>
            <DialogDescription>
              Submit your squad application. The team manager will review and confirm your roster
              spot.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="join-position">Position *</Label>
              <Select
                value={joinPosition}
                onValueChange={(val) => setJoinPosition(val as Player["position"])}
              >
                <SelectTrigger id="join-position">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FWD">Forward (FWD)</SelectItem>
                  <SelectItem value="MID">Midfielder (MID)</SelectItem>
                  <SelectItem value="DEF">Defender (DEF)</SelectItem>
                  <SelectItem value="GK">Goalkeeper (GK)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="join-number">Preferred Number</Label>
                <Input
                  id="join-number"
                  type="number"
                  min={1}
                  max={99}
                  placeholder="e.g. 10"
                  value={joinNumber}
                  onChange={(e) => setJoinNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="join-role">Day Job / Role</Label>
                <Input
                  id="join-role"
                  placeholder="e.g. Backend Dev"
                  value={joinRole}
                  onChange={(e) => setJoinRole(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start space-x-3 pt-2">
              <Checkbox
                id="join-waiver"
                checked={joinWaiver}
                onCheckedChange={(checked) => setJoinWaiver(Boolean(checked))}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="join-waiver"
                  className="text-xs font-normal leading-relaxed cursor-pointer"
                >
                  I have read, understood, and agree to the{" "}
                  <a
                    href="/legal?tab=waiver"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    DevKics Participation Waiver and Release of Liability
                  </a>
                  .
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsJoinOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!joinPosition || !joinWaiver || isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

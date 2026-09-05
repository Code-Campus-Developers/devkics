import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";

import { FormPill, SectionHeading, StatCard, TeamCrest } from "@/components/devkics/brand";
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
import { Label } from "@/components/ui/label";
import { useDevKics } from "@/lib/devkics/store";
import { computeStandings } from "@/lib/devkics/standings";

export function PlayerDashboard() {
  const { currentUser, teams, players, fixtures, respondToInvitation } = useDevKics();
  const [selectedInvite, setSelectedInvite] = useState<(typeof players)[0] | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const invitations = players.filter((p) => {
    const matchesUser = p.userId === currentUser?.id;
    const matchesEmail = Boolean(
      p.email && currentUser?.email && p.email.toLowerCase() === currentUser.email.toLowerCase(),
    );
    return (matchesUser || matchesEmail) && p.status === "invited";
  });

  const pendingRequests = players.filter((p) => {
    const matchesUser = p.userId === currentUser?.id;
    return matchesUser && p.status === "pending-approval";
  });

  const approvedPlayer = players.find(
    (p) =>
      (p.userId === currentUser?.id || (currentUser?.playerId && p.id === currentUser.playerId)) &&
      p.status === "approved",
  );
  const team = approvedPlayer ? teams.find((t) => t.id === approvedPlayer.teamId) : undefined;

  const handleDecline = async (invId: string) => {
    try {
      setDecliningId(invId);
      await respondToInvitation(invId, "decline");
      toast.info("Invitation declined");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to decline invitation");
    } finally {
      setDecliningId(null);
    }
  };

  const handleAccept = async () => {
    if (!selectedInvite) return;
    try {
      setIsSubmitting(true);
      await respondToInvitation(selectedInvite.id, "accept", { waiverAccepted: true });
      toast.success("Invitation accepted! Your spot is now pending team manager confirmation.");
      setSelectedInvite(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMembershipAlerts = () => (
    <>
      {invitations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Team Invitations</h3>
            <Badge variant="secondary" className="rounded-full text-xs">
              {invitations.length}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {invitations.map((inv) => {
              const invTeam = teams.find((t) => t.id === inv.teamId);
              return (
                <div
                  key={inv.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/30 bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    {invTeam && <TeamCrest team={invTeam} size="md" />}
                    <div className="space-y-1">
                      <h4 className="font-bold">{invTeam?.name ?? "Team Invitation"}</h4>
                      <p className="text-xs text-muted-foreground">
                        Position:{" "}
                        <span className="font-medium text-foreground">{inv.position}</span>
                        {inv.number ? ` · Kit #${inv.number}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Role: <span className="font-medium text-foreground">{inv.role}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-xs text-destructive hover:bg-destructive/10"
                      disabled={decliningId === inv.id}
                      onClick={() => handleDecline(inv.id)}
                    >
                      <XCircle className="mr-1.5 size-3.5" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => {
                        setSelectedInvite(inv);
                        setWaiverAccepted(false);
                      }}
                    >
                      <CheckCircle2 className="mr-1.5 size-3.5" />
                      Review & Accept
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pendingRequests.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-500" />
            <h3 className="font-display text-lg font-bold">Pending Confirmation</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingRequests.map((req) => {
              const reqTeam = teams.find((t) => t.id === req.teamId);
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {reqTeam && <TeamCrest team={reqTeam} size="sm" />}
                    <div>
                      <h4 className="font-bold text-sm">{reqTeam?.name ?? "Team"}</h4>
                      <p className="text-xs text-muted-foreground">
                        {req.position} · Waiting for manager approval
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full text-xs border-amber-500/40 text-amber-600 bg-amber-500/10"
                  >
                    Pending
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );

  const inviteDialog = (
    <Dialog
      open={Boolean(selectedInvite)}
      onOpenChange={(open) => !open && setSelectedInvite(null)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accept Team Invitation</DialogTitle>
          <DialogDescription>
            Join {teams.find((t) => t.id === selectedInvite?.teamId)?.name ?? "the squad"}. Once
            accepted, your roster spot will be submitted for final team manager confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1">
            <p>
              <span className="font-semibold">Position:</span>{" "}
              {selectedInvite?.position ?? "Flexible"}
            </p>
            <p>
              <span className="font-semibold">Kit Number:</span>{" "}
              {selectedInvite?.number ? `#${selectedInvite.number}` : "Assigned by manager"}
            </p>
          </div>

          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="waiver-acceptance"
              checked={waiverAccepted}
              onCheckedChange={(checked) => setWaiverAccepted(Boolean(checked))}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="waiver-acceptance"
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelectedInvite(null)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!waiverAccepted || isSubmitting} onClick={handleAccept}>
            {isSubmitting ? "Accepting..." : "Accept & Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!team || !approvedPlayer) {
    return (
      <div className="space-y-8">
        {renderMembershipAlerts()}

        {invitations.length === 0 && pendingRequests.length === 0 && (
          <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-10 text-center">
            <h2 className="text-xl font-bold">You are not on a squad yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse the teams competing in Abuja and ask a manager for an invite, or request to
              join a squad directly from their team page.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild className="rounded-full">
                <Link to="/$city/teams" params={{ city: "abuja" }}>
                  Browse teams
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/volunteer">Volunteer</Link>
              </Button>
            </div>
          </div>
        )}

        {(invitations.length > 0 || pendingRequests.length > 0) && (
          <div className="flex justify-center gap-3 pt-4">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/$city/teams" params={{ city: "abuja" }}>
                Browse other teams
              </Link>
            </Button>
          </div>
        )}

        {inviteDialog}
      </div>
    );
  }

  const row = computeStandings(teams, fixtures).find((s) => s.teamId === team.id);
  const teamFixtures = fixtures.filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id);
  const next = teamFixtures.find((f) => f.status === "scheduled");
  const squad = players.filter((p) => p.teamId === team.id && p.status === "approved");

  return (
    <div className="space-y-10">
      {renderMembershipAlerts()}

      <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-7 sm:flex-row sm:items-center">
        <TeamCrest team={team} size="lg" />
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold">
            {approvedPlayer.name ?? currentUser?.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {`#${approvedPlayer.number} · ${approvedPlayer.position} · ${approvedPlayer.role}`}
          </p>
          <Link
            to="/$city/teams/$teamId"
            params={{ city: "abuja", teamId: team.id }}
            className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
          >
            {team.name}
          </Link>
        </div>
        <div className="flex gap-1.5">
          {(row?.form ?? []).map((r, i) => (
            <FormPill key={i} result={r} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Goals" value={approvedPlayer.goals ?? 0} />
        <StatCard label="Assists" value={approvedPlayer.assists ?? 0} tone="flare" />
        <StatCard label="Team points" value={row?.points ?? 0} />
        <StatCard label="Squad size" value={squad.length} tone="wine" />
      </div>

      {next && (
        <section>
          <SectionHeading title="Your next match" />
          <div className="mt-5 max-w-lg">
            <MatchRow fixture={next} teams={teams} citySlug="abuja" />
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          title="Season schedule"
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/$city/fixtures" params={{ city: "abuja" }}>
                All fixtures
              </Link>
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {teamFixtures.map((f) => (
            <MatchRow key={f.id} fixture={f} teams={teams} citySlug="abuja" />
          ))}
        </div>
      </section>

      {inviteDialog}
    </div>
  );
}

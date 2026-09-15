import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, HelpCircle, Mail, XCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDevKics } from "@/lib/devkics/store";
import { computeStandings } from "@/lib/devkics/standings";
import type { Player } from "@/lib/devkics/types";

export function PlayerDashboard() {
  const { currentUser, teams, players, fixtures, respondToInvitation } = useDevKics();
  const [selectedInvite, setSelectedInvite] = useState<(typeof players)[0] | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [inviteMode, setInviteMode] = useState<"accept" | "clarify">("accept");
  const [preferredPosition, setPreferredPosition] = useState<Player["position"]>("MID");
  const [positionNotes, setPositionNotes] = useState("");

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

  const openInviteModal = (inv: (typeof players)[0], mode: "accept" | "clarify") => {
    setSelectedInvite(inv);
    setInviteMode(mode);
    setPreferredPosition(inv.position);
    setPositionNotes("");
    setWaiverAccepted(false);
  };

  const handleSubmitResponse = async () => {
    if (!selectedInvite) return;
    try {
      setIsSubmitting(true);
      if (inviteMode === "clarify") {
        await respondToInvitation(selectedInvite.id, "clarify", {
          preferredPosition,
          positionNotes: positionNotes.trim() || null,
          waiverAccepted: true,
          mediaConsentAccepted: true,
        });
        toast.success(
          "Position clarification submitted! Your proposed position is pending manager approval.",
        );
      } else {
        await respondToInvitation(selectedInvite.id, "accept", {
          waiverAccepted: true,
          mediaConsentAccepted: true,
        });
        toast.success("Invitation accepted! Your spot is now pending team manager confirmation.");
      }
      setSelectedInvite(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to respond to invitation");
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
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
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
                      variant="outline"
                      className="rounded-full text-xs"
                      onClick={() => openInviteModal(inv, "clarify")}
                    >
                      <HelpCircle className="mr-1.5 size-3.5 text-amber-500" />
                      Clarify Position
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => openInviteModal(inv, "accept")}
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
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {reqTeam && <TeamCrest team={reqTeam} size="sm" />}
                      <div>
                        <h4 className="font-bold text-sm">{reqTeam?.name ?? "Team"}</h4>
                        <p className="text-xs text-muted-foreground">
                          {req.proposedPosition ? (
                            <>
                              Proposed:{" "}
                              <strong className="text-foreground">{req.proposedPosition}</strong>{" "}
                              <span className="text-[11px]">(Invited: {req.position})</span>
                            </>
                          ) : (
                            <strong className="text-foreground">{req.position}</strong>
                          )}
                          {" · "}Waiting for manager approval
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full text-xs border-amber-500/40 text-amber-600 bg-amber-500/10 shrink-0"
                    >
                      {req.proposedPosition ? "Clarification Pending" : "Pending"}
                    </Badge>
                  </div>
                  {req.positionNotes && (
                    <p className="rounded-lg border border-border bg-muted/40 p-2 text-xs italic text-muted-foreground">
                      &ldquo;{req.positionNotes}&rdquo;
                    </p>
                  )}
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
          <DialogTitle>
            {inviteMode === "clarify" ? "Clarify Position & Accept" : "Accept Team Invitation"}
          </DialogTitle>
          <DialogDescription>
            {inviteMode === "clarify"
              ? `Propose your preferred playing position for ${teams.find((t) => t.id === selectedInvite?.teamId)?.name ?? "the squad"}. The team manager will review and confirm your squad spot.`
              : `Join ${teams.find((t) => t.id === selectedInvite?.teamId)?.name ?? "the squad"}. Once accepted, your roster spot will be submitted for final team manager confirmation.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode switch pills */}
          <div className="flex rounded-xl bg-muted/60 p-1 border border-border/50 text-xs">
            <button
              type="button"
              className={`flex-1 rounded-lg py-1.5 font-medium transition-colors ${
                inviteMode === "accept"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setInviteMode("accept")}
            >
              Accept ({selectedInvite?.position ?? "Flexible"})
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg py-1.5 font-medium transition-colors ${
                inviteMode === "clarify"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setInviteMode("clarify")}
            >
              Propose Position
            </button>
          </div>

          {inviteMode === "accept" ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1">
              <p>
                <span className="font-semibold">Manager-Requested Position:</span>{" "}
                {selectedInvite?.position ?? "Flexible"}
              </p>
              <p>
                <span className="font-semibold">Kit Number:</span>{" "}
                {selectedInvite?.number ? `#${selectedInvite.number}` : "Assigned by manager"}
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="preferred-position" className="text-xs font-semibold">
                  Preferred Playing Position *
                </Label>
                <Select
                  value={preferredPosition}
                  onValueChange={(val) => setPreferredPosition(val as Player["position"])}
                >
                  <SelectTrigger id="preferred-position" className="w-full bg-background text-xs">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GK">Goalkeeper (GK)</SelectItem>
                    <SelectItem value="DEF">Defender (DEF)</SelectItem>
                    <SelectItem value="MID">Midfielder (MID)</SelectItem>
                    <SelectItem value="FWD">Forward (FWD)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Manager originally requested: <strong>{selectedInvite?.position}</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="position-notes" className="text-xs font-semibold">
                    Position Note (optional)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {positionNotes.length}/500
                  </span>
                </div>
                <Textarea
                  id="position-notes"
                  rows={2}
                  maxLength={500}
                  value={positionNotes}
                  onChange={(e) => setPositionNotes(e.target.value)}
                  placeholder="e.g., Prefer attacking midfield or wing based on tactical fit"
                  className="bg-background text-xs resize-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-start space-x-3 pt-1">
            <Checkbox
              id="waiver-acceptance"
              checked={waiverAccepted}
              onCheckedChange={(checked) => setWaiverAccepted(Boolean(checked))}
            />
            <div className="grid gap-1 leading-none">
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
                  DevKics Participation Waiver, Media Consent, and Release of Liability
                </a>
                . *
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
          <Button
            type="button"
            disabled={
              !waiverAccepted || (inviteMode === "clarify" && !preferredPosition) || isSubmitting
            }
            onClick={handleSubmitResponse}
          >
            {isSubmitting
              ? inviteMode === "clarify"
                ? "Submitting..."
                : "Accepting..."
              : inviteMode === "clarify"
                ? "Submit Clarification"
                : "Accept & Submit"}
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

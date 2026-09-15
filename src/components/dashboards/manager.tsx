import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Eye, Lock, Mail, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";

import { LoadingSkeleton, SectionHeading, StatCard, TeamCrest } from "@/components/devkics/brand";
import { MatchRow } from "@/components/devkics/match";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    invitePlayer,
    reviewPlayer,
    removePlayer,
    updatePlayer,
    loadingTournamentOps,
  } = useDevKics();

  const [selectedPlayerForDetails, setSelectedPlayerForDetails] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState<{
    position: Player["position"];
    number: number | "";
    role: string;
  }>({ position: "MID", number: 1, role: "" });
  const [playerToRemove, setPlayerToRemove] = useState<Player | null>(null);
  const [isUpdatingPlayer, setIsUpdatingPlayer] = useState(false);
  const [isRemovingPlayer, setIsRemovingPlayer] = useState(false);
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
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    position: "MID" as Player["position"],
    number: "",
    role: "",
  });
  const [isInviting, setIsInviting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  if (loadingTournamentOps) {
    return (
      <div className="space-y-8" role="status" aria-label="Loading team dashboard">
        <LoadingSkeleton variant="stats" count={4} />
        <LoadingSkeleton variant="cards" count={2} />
      </div>
    );
  }

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
                placeholder="PayTech Global"
              />
            </div>
            <div className="space-y-2">
              <Label>Official email</Label>
              <Input
                type="email"
                required
                value={organizationForm.email}
                onChange={(e) =>
                  setOrganizationForm({ ...organizationForm, email: e.target.value })
                }
                placeholder="sports@paytech.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Organization background</Label>
              <Input
                required
                value={organizationForm.detail}
                onChange={(e) =>
                  setOrganizationForm({ ...organizationForm, detail: e.target.value })
                }
                placeholder="HQ address, RC number or company website"
              />
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full">
              Submit for review
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

    if (pendingOrganization) {
      return (
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-10 text-center">
          <Badge variant="outline" className="rounded-full text-xs">
            Application pending
          </Badge>
          <h2 className="mt-4 font-display text-2xl font-bold">{pendingOrganization.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your organization application is under review by city organizers. Team registration will
            unlock once approved.
          </p>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl">
        <SectionHeading
          title="Register your team"
          description="Create your corporate team under your approved organization."
        />
        <form
          className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-7"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createTeam({
                name: newTeam.name,
                shortName: newTeam.shortName || newTeam.name.slice(0, 3).toUpperCase(),
                company: newTeam.company,
                group: newTeam.group,
                organizationId: approvedOrganization.id,
              });
              toast.success("Team created successfully");
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
              placeholder="Interswitch FC"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Short name (3-4 chars)</Label>
              <Input
                required
                maxLength={4}
                value={newTeam.shortName}
                onChange={(e) =>
                  setNewTeam({ ...newTeam, shortName: e.target.value.toUpperCase() })
                }
                placeholder="ISW"
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned group</Label>
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
            <Label>Company</Label>
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
  const approvedSquad = squad.filter((p) => p.status === "approved");
  const pendingApprovals = squad.filter((p) => p.status === "pending-approval");
  const pendingInvites = squad.filter((p) => p.status === "invited");

  const row = computeStandings(teams, fixtures).find((s) => s.teamId === team.id);
  const teamFixtures = fixtures.filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id);
  const isRosterLocked = team.status === "locked" || Boolean(team.squadLockedAt);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name.trim()) {
      toast.error("Please enter the player's full name");
      return;
    }
    if (!inviteForm.email.trim()) {
      toast.error("Please enter the player's email address");
      return;
    }
    setIsInviting(true);
    try {
      const invitePayload: {
        teamId: string;
        name: string;
        email: string;
        position: Player["position"];
        number?: number;
        role?: string;
      } = {
        teamId: team.id,
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        position: inviteForm.position,
      };
      if (inviteForm.number) {
        invitePayload.number = Number(inviteForm.number);
      }
      if (inviteForm.role.trim()) {
        invitePayload.role = inviteForm.role.trim();
      }
      await invitePlayer(invitePayload);
      setInviteForm({ name: "", email: "", position: "MID", number: "", role: "" });
      toast.success(`Invitation sent to ${inviteForm.email.trim()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleApprove = async (playerId: string, playerName: string) => {
    setActionInProgressId(playerId);
    try {
      await reviewPlayer(playerId, "approved");
      toast.success(`${playerName} approved and added to active squad`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve player");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRejectOrCancel = async (
    playerId: string,
    playerName: string,
    actionLabel: string,
  ) => {
    setActionInProgressId(playerId);
    try {
      await reviewPlayer(playerId, "withdrawn");
      toast.success(`${playerName}: ${actionLabel}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update player status");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRemoveFromRoster = async (playerId: string, playerName: string) => {
    setActionInProgressId(playerId);
    try {
      await removePlayer(playerId);
      toast.success(`${playerName} removed from squad`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove player");
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <TeamCrest team={team} size="lg" />
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-bold">{team.name}</h2>
            {isRosterLocked && (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
                <Lock className="size-3" /> Roster locked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {team.company} · Group {team.group}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Approved squad" value={approvedSquad.length} />
        <StatCard label="Played" value={row?.played ?? 0} />
        <StatCard label="Points" value={row?.points ?? 0} tone="flare" />
        <StatCard label="Goals for" value={row?.goalsFor ?? 0} tone="wine" />
      </div>

      <Tabs defaultValue="squad">
        <TabsList className="rounded-full" aria-label="Team manager sections">
          <TabsTrigger value="squad" className="rounded-full">
            Squad ({approvedSquad.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="rounded-full">
            Requests & Invites ({pendingApprovals.length + pendingInvites.length})
          </TabsTrigger>
          <TabsTrigger value="matches" className="rounded-full">
            Matches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="squad" className="mt-8 space-y-8">
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Invite player to team</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send an official team invitation by email. The player must accept the
                  participation waiver before final confirmation.
                </p>
              </div>
              {isRosterLocked && (
                <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
                  <Lock className="size-3" /> Locked
                </Badge>
              )}
            </div>

            {isRosterLocked ? (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
                Team roster is locked for competition. Player invitations and changes are disabled.
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-5">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">Full Name</Label>
                    <Input
                      required
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      placeholder="Chidi Nwankwo"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">Email address</Label>
                    <Input
                      type="email"
                      required
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="chidi@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={inviteForm.position}
                      onValueChange={(v) =>
                        setInviteForm({ ...inviteForm, position: v as Player["position"] })
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Squad Number (optional)</Label>
                    <Input
                      inputMode="numeric"
                      value={inviteForm.number}
                      onChange={(e) => setInviteForm({ ...inviteForm, number: e.target.value })}
                      placeholder={String(approvedSquad.length + 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Day job / Role (optional)</Label>
                    <Input
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                      placeholder="Software Engineer"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={isInviting} className="gap-2 rounded-full px-6">
                    <Mail className="size-4" />
                    {isInviting ? "Sending invite..." : "Send team invitation"}
                  </Button>
                </div>
              </form>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Active Roster ({approvedSquad.length})</h3>
            </div>

            {approvedSquad.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
                <p className="font-medium">No approved players on the squad yet</p>
                <p className="mt-1 text-xs">
                  Send invitations above or review pending join requests to build your roster.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
                {approvedSquad.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="w-8 text-center font-display font-bold text-muted-foreground">
                      #{p.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.position} {p.role ? `· ${p.role}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px] uppercase">
                      {p.position}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={actionInProgressId === p.id}
                          aria-label={`Actions for ${p.name}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => setSelectedPlayerForDetails(p)}
                          className="gap-2 cursor-pointer"
                        >
                          <Eye className="size-4" />
                          <span>View Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isRosterLocked}
                          onClick={() => {
                            setEditingPlayer(p);
                            setEditForm({
                              position: p.position,
                              number: p.number || 1,
                              role: p.role || "",
                            });
                          }}
                          className="gap-2 cursor-pointer"
                        >
                          <Pencil className="size-4" />
                          <span>Edit Player</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={isRosterLocked}
                          onClick={() => setPlayerToRemove(p)}
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          <span>Remove from Squad</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="requests" className="mt-8 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Pending Confirmation</h3>
              <Badge variant="secondary" className="rounded-full text-xs">
                {pendingApprovals.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Players who submitted a join request or accepted your invitation with a signed waiver.
              Confirm to add them to your active roster.
            </p>

            {pendingApprovals.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                No pending player confirmations.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
                {pendingApprovals.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{p.name}</span>
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/5 text-xs text-primary"
                        >
                          Pending Approval
                        </Badge>
                        {p.proposedPosition && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 font-medium"
                          >
                            Position Clarification: {p.proposedPosition}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.proposedPosition ? (
                          <>
                            Proposed Position:{" "}
                            <strong className="text-foreground">{p.proposedPosition}</strong>{" "}
                            <span className="text-[11px]">(Invited as: {p.position})</span>
                          </>
                        ) : (
                          <>
                            Position: <strong className="text-foreground">{p.position}</strong>
                          </>
                        )}
                        {p.role ? ` · Role: ${p.role}` : ""}
                        {p.email ? ` · ${p.email}` : ""}
                      </p>
                      {p.positionNotes && (
                        <p className="mt-1.5 rounded-lg border border-border bg-muted/40 p-2 text-xs italic text-muted-foreground">
                          &ldquo;{p.positionNotes}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={isRosterLocked || actionInProgressId === p.id}
                        onClick={() => handleApprove(p.id, p.name)}
                        className="gap-1.5 rounded-full"
                      >
                        <Check className="size-3.5" />
                        {p.proposedPosition ? `Approve (${p.proposedPosition})` : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isRosterLocked || actionInProgressId === p.id}
                        onClick={() => handleRejectOrCancel(p.id, p.name, "rejected")}
                        className="gap-1.5 rounded-full text-destructive hover:text-destructive"
                      >
                        <X className="size-3.5" /> Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Sent Invitations</h3>
              <Badge variant="secondary" className="rounded-full text-xs">
                {pendingInvites.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Invitations awaiting player response and participation waiver acceptance.
            </p>

            {pendingInvites.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                No outgoing pending invitations.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
                {pendingInvites.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{p.name}</span>
                        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" /> Awaiting response
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.email ? `${p.email} · ` : ""}
                        Position: {p.position}
                        {p.role ? ` · ${p.role}` : ""}
                      </p>
                    </div>
                    <div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isRosterLocked || actionInProgressId === p.id}
                        onClick={() => handleRejectOrCancel(p.id, p.name, "invitation cancelled")}
                        className="rounded-full text-xs text-muted-foreground hover:text-destructive"
                      >
                        Cancel invite
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="matches" className="mt-8">
          <div className="grid gap-4 md:grid-cols-2">
            {teamFixtures.map((f) => (
              <MatchRow key={f.id} fixture={f} teams={teams} citySlug="abuja" />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* View Player Details Modal */}
      <Dialog
        open={Boolean(selectedPlayerForDetails)}
        onOpenChange={(open) => !open && setSelectedPlayerForDetails(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedPlayerForDetails?.name}</span>
              {selectedPlayerForDetails?.number ? (
                <Badge variant="secondary">#{selectedPlayerForDetails.number}</Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Squad registration and verified operational information.
            </DialogDescription>
          </DialogHeader>
          {selectedPlayerForDetails && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Position</p>
                  <p className="font-semibold text-foreground">
                    {selectedPlayerForDetails.position}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Kit Number</p>
                  <p className="font-semibold text-foreground">
                    {selectedPlayerForDetails.number
                      ? `#${selectedPlayerForDetails.number}`
                      : "Not assigned"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Role</p>
                  <p className="font-semibold text-foreground">
                    {selectedPlayerForDetails.role || "Squad Member"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <Badge variant="outline" className="text-xs capitalize">
                    {selectedPlayerForDetails.status}
                  </Badge>
                </div>
                {selectedPlayerForDetails.email && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                    <p className="font-semibold text-foreground">
                      {selectedPlayerForDetails.email}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Operational & Compliance
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium text-foreground">
                      {selectedPlayerForDetails.emergencyContactName || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact Phone</p>
                    <p className="font-medium text-foreground">
                      {selectedPlayerForDetails.emergencyContactPhone || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Waiver Signed</p>
                    <p className="font-medium text-foreground">
                      {selectedPlayerForDetails.waiverAcceptedAt
                        ? new Date(selectedPlayerForDetails.waiverAcceptedAt).toLocaleDateString()
                        : "Pending"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Media Consent</p>
                    <p className="font-medium text-foreground">
                      {selectedPlayerForDetails.mediaConsentAcceptedAt
                        ? "Accepted"
                        : "Not Provided"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPlayerForDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Player Modal */}
      <Dialog
        open={Boolean(editingPlayer)}
        onOpenChange={(open) => !open && setEditingPlayer(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Player — {editingPlayer?.name}</DialogTitle>
            <DialogDescription>
              Update squad position, kit number, and role for this player.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editingPlayer) return;
              const num = Number(editForm.number);
              if (isNaN(num) || num < 1 || num > 99) {
                toast.error("Kit number must be between 1 and 99");
                return;
              }
              setIsUpdatingPlayer(true);
              try {
                await updatePlayer(editingPlayer.id, {
                  position: editForm.position,
                  number: num,
                  role: editForm.role.trim() || null,
                });
                toast.success("Player details updated");
                setEditingPlayer(null);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to update player");
              } finally {
                setIsUpdatingPlayer(false);
              }
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-position">Position</Label>
              <Select
                value={editForm.position}
                onValueChange={(val) =>
                  setEditForm((prev) => ({ ...prev, position: val as Player["position"] }))
                }
              >
                <SelectTrigger id="edit-position">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GK">Goalkeeper (GK)</SelectItem>
                  <SelectItem value="DEF">Defender (DEF)</SelectItem>
                  <SelectItem value="MID">Midfielder (MID)</SelectItem>
                  <SelectItem value="FWD">Forward (FWD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-kit-number">Kit Number (1–99)</Label>
              <Input
                id="edit-kit-number"
                type="number"
                min={1}
                max={99}
                required
                value={editForm.number}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    number: e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Squad Role (Optional)</Label>
              <Input
                id="edit-role"
                placeholder="e.g. Captain, Vice Captain, Starter"
                value={editForm.role}
                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPlayer(null)}
                disabled={isUpdatingPlayer}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingPlayer}>
                {isUpdatingPlayer ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Player Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(playerToRemove)}
        onOpenChange={(open) => !open && setPlayerToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Player from Squad?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong className="text-foreground">{playerToRemove?.name}</strong> from{" "}
              <strong className="text-foreground">{team?.name ?? "the squad"}</strong>? This will
              withdraw them from active participation and notify the player.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingPlayer}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemovingPlayer}
              onClick={async (e) => {
                e.preventDefault();
                if (!playerToRemove) return;
                setIsRemovingPlayer(true);
                try {
                  await removePlayer(playerToRemove.id);
                  toast.success(`${playerToRemove.name} removed from squad`);
                  setPlayerToRemove(null);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to remove player");
                } finally {
                  setIsRemovingPlayer(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingPlayer ? "Removing..." : "Remove Player"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

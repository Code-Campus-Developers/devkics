import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Eye,
  CheckCircle2,
  HelpCircle,
  XCircle,
  MapPin,
  Mail,
  Calendar,
  Building,
  Trophy,
  Users,
  ShieldCheck,
  FileText,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDevKics } from "@/lib/devkics/store";
import type { Application, ApplicationKind } from "@/lib/devkics/types";

const kindLabel: Record<ApplicationKind, string> = {
  volunteer: "Volunteer",
  "city-organizer": "City organizer",
  team: "Team entry",
  player: "Player",
};

const statusBadgeStyles: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  submitted: {
    label: "Submitted",
    variant: "secondary",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  pending: {
    label: "Pending",
    variant: "secondary",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  "under-review": {
    label: "Under review",
    variant: "secondary",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  },
  "more-info-required": {
    label: "More info required",
    variant: "secondary",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  },
  approved: {
    label: "Approved",
    variant: "default",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
  },
  suspended: {
    label: "Suspended",
    variant: "destructive",
  },
  withdrawn: {
    label: "Withdrawn",
    variant: "outline",
  },
};

type ReviewAction = "approved" | "rejected" | "more-info-required";

export function ApplicationQueue({ kinds, title }: { kinds: ApplicationKind[]; title: string }) {
  const { applications, reviewApplication } = useDevKics();
  const list = applications.filter((a) => kinds.includes(a.kind));

  const [detailsApp, setDetailsApp] = useState<Application | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{
    app: Application;
    action: ReviewAction;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openReview(app: Application, action: ReviewAction) {
    setReviewNotes(app.reviewNotes ?? "");
    setReviewDialog({ app, action });
  }

  async function handleConfirmReview() {
    if (!reviewDialog) return;
    setIsSubmitting(true);
    try {
      await reviewApplication(
        reviewDialog.app.id,
        reviewDialog.action,
        reviewNotes.trim() || undefined,
      );
      toast.success(`Application for ${reviewDialog.app.name} updated: ${reviewDialog.action}`);
      if (detailsApp?.id === reviewDialog.app.id) {
        setDetailsApp((prev) =>
          prev
            ? {
                ...prev,
                status: reviewDialog.action,
                reviewNotes: reviewNotes.trim() || null,
              }
            : null,
        );
      }
      setReviewDialog(null);
      setReviewNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review application");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {list.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing in the queue right now.
        </p>
      )}
      <ul className="space-y-3">
        {list.map((a) => {
          const statusConfig = statusBadgeStyles[a.status] ?? {
            label: a.status,
            variant: "outline" as const,
          };

          return (
            <li
              key={a.id}
              id={`application-item-${a.id}`}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{a.name}</p>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {kindLabel[a.kind]}
                  </Badge>
                  <Badge
                    variant={statusConfig.variant}
                    className={`rounded-full text-[10px] ${statusConfig.className ?? ""}`}
                  >
                    {statusConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {a.city}
                    {a.country ? `, ${a.country}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.detail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{a.email}</span>
                  <span>·</span>
                  <span>Submitted {a.submittedAt}</span>
                  {a.proposedVenue && (
                    <>
                      <span>·</span>
                      <span>Venue: {a.proposedVenue}</span>
                    </>
                  )}
                </div>
                {a.reviewNotes && (
                  <p className="mt-2 text-xs text-muted-foreground italic">Note: {a.reviewNotes}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  id={`app-${a.id}-view-details`}
                  onClick={() => setDetailsApp(a)}
                >
                  <Eye className="mr-1.5 size-3.5" />
                  View Details
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      id={`app-${a.id}-actions-trigger`}
                    >
                      Actions
                      <ChevronDown className="ml-1.5 size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      id={`app-${a.id}-action-view`}
                      onClick={() => setDetailsApp(a)}
                    >
                      <Eye className="mr-2 size-4" />
                      View Full Application
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {a.status !== "approved" && (
                      <DropdownMenuItem
                        id={`app-${a.id}-action-approve`}
                        onClick={() => openReview(a, "approved")}
                      >
                        <CheckCircle2 className="mr-2 size-4 text-emerald-500" />
                        Approve Application
                      </DropdownMenuItem>
                    )}
                    {a.status !== "more-info-required" && a.status !== "approved" && (
                      <DropdownMenuItem
                        id={`app-${a.id}-action-request-info`}
                        onClick={() => openReview(a, "more-info-required")}
                      >
                        <HelpCircle className="mr-2 size-4 text-orange-500" />
                        Request More Info
                      </DropdownMenuItem>
                    )}
                    {a.status !== "rejected" && (
                      <DropdownMenuItem
                        id={`app-${a.id}-action-reject`}
                        className="text-destructive focus:text-destructive"
                        onClick={() => openReview(a, "rejected")}
                      >
                        <XCircle className="mr-2 size-4" />
                        Reject Application
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Full Application Details Modal */}
      <Dialog
        open={detailsApp !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsApp(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-xl font-bold">{detailsApp?.name}</DialogTitle>
              {detailsApp && (
                <Badge
                  variant={statusBadgeStyles[detailsApp.status]?.variant ?? "outline"}
                  className={`rounded-full text-xs ${
                    statusBadgeStyles[detailsApp.status]?.className ?? ""
                  }`}
                >
                  {statusBadgeStyles[detailsApp.status]?.label ?? detailsApp.status}
                </Badge>
              )}
            </div>
            <DialogDescription>
              Organizer candidate proposal for {detailsApp?.city}
              {detailsApp?.country ? `, ${detailsApp.country}` : ""}
            </DialogDescription>
          </DialogHeader>

          {detailsApp && (
            <div className="space-y-6 py-2 text-sm">
              {/* Profile & Contact */}
              <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Candidate Profile
                  </span>
                  <p className="font-medium text-foreground">{detailsApp.name}</p>
                  <a
                    href={`mailto:${detailsApp.email}`}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {detailsApp.email}
                  </a>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Target City &amp; Submission
                  </span>
                  <p className="flex items-center gap-1.5 text-foreground">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {detailsApp.city}
                    {detailsApp.country ? `, ${detailsApp.country}` : ""}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" />
                    Submitted {detailsApp.submittedAt}
                  </p>
                </div>
              </div>

              {/* Proposal & Summary */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileText className="size-4 text-primary" />
                  Proposal Overview
                </h4>
                <div className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground">
                  {detailsApp.detail}
                </div>
              </div>

              {/* Experience */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="size-4 text-primary" />
                    Community Experience
                  </h4>
                  <div className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
                    {detailsApp.communityExperience || "No community experience recorded."}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Trophy className="size-4 text-primary" />
                    Organizing Experience
                  </h4>
                  <div className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
                    {detailsApp.organizingExperience || "No tournament experience recorded."}
                  </div>
                </div>
              </div>

              {/* Tournament Parameters */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building className="size-4 text-primary" />
                  Proposed Tournament Parameters
                </h4>
                <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="font-medium text-foreground">Proposed Venue:</span>
                    <p className="mt-0.5 text-muted-foreground">
                      {detailsApp.proposedVenue || "To be determined"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Target Period:</span>
                    <p className="mt-0.5 text-muted-foreground">
                      {detailsApp.proposedTournamentPeriod || "To be scheduled"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Organizing Team:</span>
                    <p className="mt-0.5 text-muted-foreground">
                      {detailsApp.proposedOrganizingTeam || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      Expected Tech Organizations:
                    </span>
                    <p className="mt-0.5 text-muted-foreground">
                      {detailsApp.expectedOrganizations || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Motivation */}
              {detailsApp.motivation && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Motivation &amp; Chapter Vision
                  </h4>
                  <div className="rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
                    {detailsApp.motivation}
                  </div>
                </div>
              )}

              {/* Governance & Consent */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  <span>City Organizer Agreement &amp; Code of Conduct Accepted</span>
                </div>
                <span>Candidate ID: {detailsApp.id}</span>
              </div>

              {/* Review Notes */}
              {detailsApp.reviewNotes && (
                <div className="rounded-xl border border-border/80 bg-muted/40 p-4 text-xs">
                  <span className="font-semibold text-foreground">Admin Review Notes:</span>
                  <p className="mt-1 text-muted-foreground">{detailsApp.reviewNotes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDetailsApp(null)}>
              Close
            </Button>
            {detailsApp && (
              <div className="flex flex-wrap gap-2">
                {detailsApp.status !== "approved" && (
                  <Button
                    type="button"
                    id="modal-action-approve"
                    onClick={() => openReview(detailsApp, "approved")}
                  >
                    <CheckCircle2 className="mr-1.5 size-3.5" />
                    Approve
                  </Button>
                )}
                {detailsApp.status !== "more-info-required" && detailsApp.status !== "approved" && (
                  <Button
                    type="button"
                    variant="outline"
                    id="modal-action-request-info"
                    onClick={() => openReview(detailsApp, "more-info-required")}
                  >
                    <HelpCircle className="mr-1.5 size-3.5" />
                    Request Info
                  </Button>
                )}
                {detailsApp.status !== "rejected" && (
                  <Button
                    type="button"
                    variant="destructive"
                    id="modal-action-reject"
                    onClick={() => openReview(detailsApp, "rejected")}
                  >
                    <XCircle className="mr-1.5 size-3.5" />
                    Reject
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Action Notes Dialog */}
      <Dialog
        open={reviewDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialog(null);
            setReviewNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "approved" && "Approve Organizer Application"}
              {reviewDialog?.action === "rejected" && "Reject Organizer Application"}
              {reviewDialog?.action === "more-info-required" && "Request More Information"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog?.app.name} · {reviewDialog?.app.city}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="app-review-notes">
                Review Notes{" "}
                {reviewDialog?.action === "rejected" ||
                reviewDialog?.action === "more-info-required"
                  ? "(Recommended)"
                  : "(Optional)"}
              </Label>
              <Textarea
                id="app-review-notes"
                placeholder="Enter feedback or instructions for the candidate..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewDialog(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={reviewDialog?.action === "rejected" ? "destructive" : "default"}
              loading={isSubmitting}
              loadingText={
                reviewDialog?.action === "approved"
                  ? "Approving..."
                  : reviewDialog?.action === "rejected"
                    ? "Rejecting..."
                    : "Saving..."
              }
              disabled={isSubmitting}
              id="app-review-confirm-btn"
              onClick={handleConfirmReview}
            >
              {reviewDialog?.action === "approved" && "Confirm Approval"}
              {reviewDialog?.action === "rejected" && "Confirm Rejection"}
              {reviewDialog?.action === "more-info-required" && "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";

import { SectionHeading } from "@/components/devkics/brand";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDevKics } from "@/lib/devkics/store";
import type { Organization } from "@/lib/devkics/types";

type ReviewAction = "approved" | "rejected" | "more-info-required";

const statusConfig: Record<
  Organization["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  draft: { label: "Draft", variant: "outline" },
  submitted: {
    label: "Submitted",
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
  rejected: { label: "Rejected", variant: "destructive" },
  suspended: { label: "Suspended", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "outline" },
};

export function OrganizationReviewManager() {
  const { organizations, reviewOrganization } = useDevKics();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [reviewDialog, setReviewDialog] = useState<{
    org: Organization;
    action: ReviewAction;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingStatuses = ["submitted", "under-review", "more-info-required"];
  const pendingCount = organizations.filter((o) => pendingStatuses.includes(o.status)).length;
  const approvedCount = organizations.filter((o) => o.status === "approved").length;
  const rejectedCount = organizations.filter((o) =>
    ["rejected", "suspended", "withdrawn"].includes(o.status),
  ).length;

  const filtered = organizations.filter((org) => {
    if (filter === "pending" && !pendingStatuses.includes(org.status)) return false;
    if (filter === "approved" && org.status !== "approved") return false;
    if (filter === "rejected" && !["rejected", "suspended", "withdrawn"].includes(org.status))
      return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cityName = org.city?.name ?? "";
      return (
        org.name.toLowerCase().includes(q) ||
        org.slug.toLowerCase().includes(q) ||
        org.email.toLowerCase().includes(q) ||
        cityName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleConfirmReview() {
    if (!reviewDialog) return;
    setIsSubmitting(true);
    try {
      await reviewOrganization(
        reviewDialog.org.id,
        reviewDialog.action,
        reviewNotes.trim() || undefined,
      );
      toast.success(`Organization "${reviewDialog.org.name}" ${reviewDialog.action}.`);
      setReviewDialog(null);
      setReviewNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review organization");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getCityName(org?: Organization | null) {
    return org?.city?.name ?? "City chapter";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading
          title="Organization review"
          description="Review team-manager organizations across all city chapters."
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 rounded-full border border-border bg-card px-4 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Search organizations"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All ({organizations.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filter === "pending"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Pending review ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("approved")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filter === "approved"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Approved ({approvedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("rejected")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filter === "rejected"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Rejected &amp; Suspended ({rejectedCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No organizations found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search criteria."
              : "No organization submissions in this category."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((org) => {
            const statusInfo = statusConfig[org.status] ?? {
              label: org.status,
              variant: "outline" as const,
            };
            const cityName = getCityName(org);

            return (
              <div
                key={org.id}
                id={`org-card-${org.id}`}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold">{org.name}</h3>
                      <p className="text-xs text-muted-foreground">@{org.slug}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={statusInfo.variant}
                        className={`rounded-full text-[10px] ${statusInfo.className ?? ""}`}
                      >
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">{org.description}</p>

                  <div className="flex flex-wrap gap-y-1.5 gap-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {cityName}
                      {org.country ? `, ${org.country}` : ""}
                    </span>
                    <a
                      href={`mailto:${org.email}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Mail className="size-3.5" />
                      {org.email}
                    </a>
                    {org.phone && (
                      <a
                        href={`tel:${org.phone}`}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <Phone className="size-3.5" />
                        {org.phone}
                      </a>
                    )}
                    {org.website && (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        Website
                      </a>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {new Date(org.submittedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {org.reviewNotes && (
                    <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs">
                      <p className="font-medium text-foreground">Review Notes:</p>
                      <p className="mt-0.5 text-muted-foreground">{org.reviewNotes}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  {org.status !== "approved" && (
                    <Button
                      size="sm"
                      className="rounded-full"
                      id={`org-${org.id}-approve`}
                      onClick={() => {
                        setReviewNotes(org.reviewNotes ?? "");
                        setReviewDialog({ org, action: "approved" });
                      }}
                    >
                      <CheckCircle2 className="mr-1 size-3.5" />
                      Approve
                    </Button>
                  )}

                  {org.status !== "more-info-required" && org.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      id={`org-${org.id}-request-info`}
                      onClick={() => {
                        setReviewNotes(org.reviewNotes ?? "");
                        setReviewDialog({ org, action: "more-info-required" });
                      }}
                    >
                      <HelpCircle className="mr-1 size-3.5" />
                      Request Info
                    </Button>
                  )}

                  {org.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-full"
                      id={`org-${org.id}-reject`}
                      onClick={() => {
                        setReviewNotes(org.reviewNotes ?? "");
                        setReviewDialog({ org, action: "rejected" });
                      }}
                    >
                      <XCircle className="mr-1 size-3.5" />
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Dialog with Notes */}
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
              {reviewDialog?.action === "approved" && "Approve Organization"}
              {reviewDialog?.action === "rejected" && "Reject Organization"}
              {reviewDialog?.action === "more-info-required" && "Request More Information"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog ? `${reviewDialog.org.name} (${getCityName(reviewDialog.org)})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="org-review-notes">
                Review notes {reviewDialog?.action === "rejected" ? "(Recommended)" : "(Optional)"}
              </Label>
              <Textarea
                id="org-review-notes"
                placeholder="Enter feedback or instructions for the team manager..."
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
              id="org-review-confirm-btn"
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

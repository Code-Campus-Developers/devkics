import { Link } from "@tanstack/react-router";
import { AlertCircle, Inbox, RotateCcw } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/devkics/types";

export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5">
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl font-display text-sm font-bold transition-transform group-hover:-rotate-6",
          variant === "light"
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground",
        )}
      >
        DK
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-lg font-bold tracking-tight",
            variant === "light" ? "text-pitch-foreground" : "text-foreground",
          )}
        >
          DevKics
        </span>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.18em]",
            variant === "light" ? "text-pitch-foreground/60" : "text-muted-foreground",
          )}
        >
          Tech comes to play
        </span>
      </span>
    </Link>
  );
}

const crestTone: Record<string, string> = {
  green: "bg-primary/12 text-primary ring-primary/20",
  wine: "bg-wine/12 text-wine ring-wine/20",
  orange: "bg-flare/18 text-flare-foreground ring-flare/30",
};

export function TeamCrest({
  team,
  size = "md",
}: {
  team: Pick<Team, "shortName" | "color">;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-display font-bold uppercase ring-1",
        crestTone[team.color] ?? crestTone["green"],
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-11 text-sm",
        size === "lg" && "size-16 text-lg",
      )}
    >
      {team.shortName}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rise-in flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "wine" | "flare";
}) {
  return (
    <div className="card-lift rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-3xl font-bold",
          tone === "default" && "text-foreground",
          tone === "wine" && "text-wine",
          tone === "flare" && "text-[oklch(0.48_0.16_45)] dark:text-[oklch(0.78_0.16_55)]",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

const formResultLabels: Record<string, string> = {
  W: "Win",
  D: "Draw",
  L: "Loss",
};

export function FormPill({ result }: { result: string }) {
  return (
    <span
      role="img"
      aria-label={formResultLabels[result] ?? result}
      className={cn(
        "grid size-6 place-items-center rounded-md text-[11px] font-bold",
        result === "W" && "bg-primary/15 text-primary",
        result === "D" && "bg-muted text-muted-foreground",
        result === "L" && "bg-wine/12 text-wine",
      )}
    >
      {result}
    </span>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center sm:p-12",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data",
  description = "Something went wrong while loading this section. Please try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-destructive/25 bg-destructive/[0.04] p-8 text-center sm:p-12",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="size-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-6 rounded-full border-destructive/30 hover:bg-destructive/10"
        >
          <RotateCcw className="mr-2 size-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingSkeleton({
  variant = "cards",
  count = 3,
  className,
}: {
  variant?: "cards" | "rows" | "stats" | "grid";
  count?: number;
  className?: string;
}) {
  if (variant === "stats") {
    return (
      <div
        role="status"
        aria-label="Loading statistics..."
        className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "rows") {
    return (
      <div role="status" aria-label="Loading items..." className={cn("space-y-3", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading content..."
      className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

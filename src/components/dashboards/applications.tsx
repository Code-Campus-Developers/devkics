import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDevKics } from "@/lib/devkics/store";
import type { ApplicationKind } from "@/lib/devkics/types";

const kindLabel: Record<ApplicationKind, string> = {
  volunteer: "Volunteer",
  "city-organizer": "City organizer",
  team: "Team entry",
  player: "Player",
};

export function ApplicationQueue({
  kinds,
  title,
}: {
  kinds: ApplicationKind[];
  title: string;
}) {
  const { applications, reviewApplication } = useDevKics();
  const list = applications.filter((a) => kinds.includes(a.kind));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {list.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing in the queue right now.
        </p>
      )}
      <ul className="space-y-3">
        {list.map((a) => (
          <li
            key={a.id}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{a.name}</p>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {kindLabel[a.kind]}
                </Badge>
                <span className="text-xs text-muted-foreground">{a.city}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.email} · submitted {a.submittedAt}
              </p>
            </div>

            {a.status === "pending" ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    reviewApplication(a.id, "approved");
                    toast.success(`${a.name} approved`);
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    reviewApplication(a.id, "rejected");
                    toast(`${a.name} rejected`);
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : (
              <Badge
                className={
                  a.status === "approved"
                    ? "rounded-full bg-primary/12 text-primary hover:bg-primary/12"
                    : "rounded-full bg-wine/10 text-wine hover:bg-wine/10"
                }
              >
                {a.status}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

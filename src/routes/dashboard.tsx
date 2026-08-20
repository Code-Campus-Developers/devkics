import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { PageHeader } from "@/components/devkics/brand";
import { AdminDashboard } from "@/components/dashboards/admin";
import { OrganizerDashboard } from "@/components/dashboards/organizer";
import { ManagerDashboard } from "@/components/dashboards/manager";
import { PlayerDashboard } from "@/components/dashboards/player";
import { Button } from "@/components/ui/button";
import { useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — DevKics" },
      {
        name: "description",
        content:
          "Your DevKics workspace: manage cities, tournaments, teams, squads and your player profile.",
      },
      { property: "og:title", content: "Dashboard — DevKics" },
      { property: "og:description", content: "Your DevKics workspace." },
    ],
  }),
  component: DashboardPage,
});

const titles: Record<string, { title: string; description: string }> = {
  admin: {
    title: "Global admin",
    description: "Oversee every DevKics city, chapter application and platform-wide activity.",
  },
  organizer: {
    title: "City organizer",
    description: "Run the Abuja season: teams, fixtures, results and applications.",
  },
  manager: {
    title: "Team manager",
    description: "Build your squad, invite players and follow your team's season.",
  },
  player: {
    title: "Player",
    description: "Your profile, your squad and your next match.",
  },
};

function DashboardPage() {
  const { currentUser, logout } = useDevKics();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate({ to: "/auth" });
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  const meta = titles[currentUser.role]!;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader
        eyebrow={`Signed in as ${currentUser.name}`}
        title={meta.title}
        description={meta.description}
        action={
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              logout();
              navigate({ to: "/" });
            }}
          >
            Sign out
          </Button>
        }
      />

      <div className="mt-10">
        {currentUser.role === "admin" && <AdminDashboard />}
        {currentUser.role === "organizer" && <OrganizerDashboard />}
        {currentUser.role === "manager" && <ManagerDashboard />}
        {currentUser.role === "player" && <PlayerDashboard />}
      </div>
    </div>
  );
}

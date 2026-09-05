import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { PageHeader } from "@/components/devkics/brand";
import { AdminDashboard } from "@/components/dashboards/admin";
import { Button } from "@/components/ui/button";
import { useDevKics } from "@/lib/devkics/store";
import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    links: [canonicalLink("/admin")],
    meta: [
      { title: "Admin Portal — DevKics" },
      { name: "robots", content: "noindex, nofollow" },
      ...seoMeta({
        title: "Admin Portal — DevKics",
        description: "DevKics administration and platform oversight.",
        path: "/admin",
      }),
    ],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const { currentUser, logout, bootstrapped } = useDevKics();
  const navigate = useNavigate();

  useEffect(() => {
    if (bootstrapped && (!currentUser || currentUser.role !== "admin")) {
      navigate({ to: "/admin/login" });
    }
  }, [bootstrapped, currentUser, navigate]);

  if (!bootstrapped || !currentUser || currentUser.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader
        eyebrow={`Signed in as System Administrator · ${currentUser.name}`}
        title="Platform Administration"
        description="Oversee every DevKics city, organization review, chapter application and platform governance."
        action={
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/dashboard">General Dashboard</Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                await logout();
                navigate({ to: "/admin/login" });
              }}
            >
              Sign out
            </Button>
          </div>
        }
      />
      <div className="mt-10">
        <AdminDashboard />
      </div>
    </div>
  );
}

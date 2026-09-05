import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { useDevKics } from "@/lib/devkics/store";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const { currentUser, bootstrapped } = useDevKics();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!bootstrapped) return;
    // Only guard admin routes that require authentication
    if (!pathname.startsWith("/admin") || pathname === "/admin/login") return;

    // Direct navigation to any /admin/* route without an active ADMIN session redirects safely to /admin/login
    if (!currentUser || currentUser.role !== "admin") {
      navigate({ to: "/admin/login" });
    }
  }, [bootstrapped, currentUser, pathname, navigate]);

  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    (!bootstrapped || !currentUser || currentUser.role !== "admin")
  ) {
    return null;
  }

  return <Outlet />;
}

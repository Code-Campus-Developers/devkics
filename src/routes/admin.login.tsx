import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldAlert, Lock } from "lucide-react";

import { Logo } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevKics } from "@/lib/devkics/store";
import { canonicalLink } from "@/lib/seo";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  head: () => ({
    links: [canonicalLink("/admin/login")],
    meta: [{ title: "Admin Sign In — DevKics" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { login, currentUser, bootstrapped } = useDevKics();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user already has an active ADMIN session, redirect directly to admin workspace
  useEffect(() => {
    if (bootstrapped && currentUser?.role === "admin") {
      navigate({ to: "/admin" });
    }
  }, [bootstrapped, currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = await login(email, password, "admin");
      if (!user) {
        toast.error("Invalid administrator credentials");
        return;
      }
      toast.success(`Welcome back, Administrator ${user.name.split(" ")[0]}`);
      navigate({ to: "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Logo />
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Lock className="size-3.5" aria-hidden="true" />
            <span>Admin Portal</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold">Admin Sign In</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Restricted access. Authorized system administrators only.
          </p>
        </div>

        {currentUser && currentUser.role !== "admin" && (
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <ShieldAlert className="size-4 shrink-0 translate-y-0.5" />
            <p>
              You are signed in as <strong>{currentUser.email}</strong> ({currentUser.role}).
              Administrator credentials are required. Signing in below will switch sessions.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Administrator Email</Label>
            <Input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@devkics.com"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full rounded-full" disabled={isSubmitting}>
            {isSubmitting ? "Authenticating..." : "Sign in to Admin Portal"}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Looking for player or team sign in?{" "}
            <Link
              to="/auth"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Return to standard login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

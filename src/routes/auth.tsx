import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Role } from "@/lib/devkics/types";

import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    links: [canonicalLink("/auth")],
    meta: seoMeta({
      title: "Sign in or Register — DevKics",
      description:
        "Sign in to your DevKics account to manage your team, run your city tournament, or track your player profile.",
      path: "/auth",
    }),
  }),
  component: AuthPage,
});

function AuthPage() {
  const { login, register, currentUser, bootstrapped } = useDevKics();
  const navigate = useNavigate();
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [signUp, setSignUp] = useState({
    name: "",
    email: "",
    password: "",
    role: "player" as "player" | "manager",
  });

  useEffect(() => {
    if (bootstrapped && currentUser) navigate({ to: "/dashboard" });
  }, [bootstrapped, currentUser, navigate]);

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 lg:grid-cols-2">
      <div className="rise-in">
        <Logo />
        <h1 className="mt-8 text-3xl font-bold sm:text-4xl">Your locker room</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Sign in to manage your squad, run your city tournament, or follow your own player profile.
        </p>

        <div className="mt-10 rounded-3xl border border-border bg-secondary/30 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Community Football Platform
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            DevKics brings tech communities together through football. Each city chapter operates
            under official governance standards with local organizers, verified squads, and
            real-time tournament tracking.
          </p>
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Interested in organizing DevKics in your city?{" "}
              <Link
                to="/organize"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                Apply to become a city organizer
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-7">
        <Tabs defaultValue="signin">
          <TabsList
            className="grid w-full grid-cols-2 rounded-full"
            aria-label="Authentication modes"
          >
            <TabsTrigger value="signin" className="rounded-full">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="register" className="rounded-full">
              Register
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6">
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const user = await login(signIn.email, signIn.password);
                  if (!user) {
                    toast.error("Invalid email or password");
                    return;
                  }
                  toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
                  navigate({ to: "/dashboard" });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Sign in failed");
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  required
                  type="email"
                  value={signIn.email}
                  onChange={(e) => setSignIn({ ...signIn, email: e.target.value })}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  required
                  type="password"
                  value={signIn.password}
                  onChange={(e) => setSignIn({ ...signIn, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" size="lg" className="w-full rounded-full">
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-6">
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!acceptedTerms) {
                  toast.error(
                    "You must agree to the Terms of Use, Privacy Policy, and Code of Conduct",
                  );
                  return;
                }
                try {
                  const user = await register({ ...signUp, acceptedTerms });
                  if (!user) {
                    toast.error("Registration failed");
                    return;
                  }
                  toast.success("Account created");
                  navigate({ to: "/dashboard" });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Registration failed");
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="register-name">Full name</Label>
                <Input
                  id="register-name"
                  required
                  value={signUp.name}
                  onChange={(e) => setSignUp({ ...signUp, name: e.target.value })}
                  placeholder="Ada Lovelace"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  required
                  type="email"
                  value={signUp.email}
                  onChange={(e) => setSignUp({ ...signUp, email: e.target.value })}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  required
                  type="password"
                  value={signUp.password}
                  onChange={(e) => setSignUp({ ...signUp, password: e.target.value })}
                  placeholder="Choose a password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-role">I am joining as</Label>
                <Select
                  value={signUp.role}
                  onValueChange={(v) => setSignUp({ ...signUp, role: v as "player" | "manager" })}
                >
                  <SelectTrigger id="register-role" aria-label="I am joining as">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="manager">Team manager</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Want to run DevKics in your city?{" "}
                  <Link
                    to="/organize"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    Apply to become a city organizer
                  </Link>
                </p>
              </div>
              <div className="flex items-start space-x-3 pt-1">
                <Checkbox
                  id="register-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                />
                <Label
                  htmlFor="register-terms"
                  className="text-xs font-normal leading-relaxed text-muted-foreground"
                >
                  I agree to the{" "}
                  <Link
                    to="/legal"
                    search={{ tab: "terms" }}
                    target="_blank"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    Terms of Use
                  </Link>
                  ,{" "}
                  <Link
                    to="/legal"
                    search={{ tab: "privacy" }}
                    target="_blank"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    Privacy Policy
                  </Link>
                  , and{" "}
                  <Link
                    to="/legal"
                    search={{ tab: "conduct" }}
                    target="_blank"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    Code of Conduct
                  </Link>
                  .
                </Label>
              </div>
              <Button type="submit" size="lg" className="w-full rounded-full">
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

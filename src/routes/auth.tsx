import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or Register — DevKics" },
      {
        name: "description",
        content:
          "Sign in to your DevKics account to manage your team, run your city tournament, or track your player profile.",
      },
      { property: "og:title", content: "Sign in or Register — DevKics" },
      { property: "og:description", content: "Access your DevKics dashboard." },
    ],
  }),
  component: AuthPage,
});

const demoAccounts: { role: Role; email: string; label: string }[] = [
  { role: "admin", email: "admin@devkics.com", label: "Global admin" },
  { role: "organizer", email: "organizer@devkics.com", label: "City organizer" },
  { role: "manager", email: "manager@devkics.com", label: "Team manager" },
  { role: "player", email: "player@devkics.com", label: "Player" },
];

function AuthPage() {
  const { login, register, currentUser } = useDevKics();
  const navigate = useNavigate();
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const [signUp, setSignUp] = useState({
    name: "",
    email: "",
    password: "",
    role: "player" as Role,
  });

  useEffect(() => {
    if (currentUser) navigate({ to: "/dashboard" });
  }, [currentUser, navigate]);

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 lg:grid-cols-2">
      <div className="rise-in">
        <Logo />
        <h1 className="mt-8 text-3xl font-bold sm:text-4xl">Your locker room</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Sign in to manage your squad, run your city tournament, or follow your own player
          profile.
        </p>

        <div className="mt-10 rounded-3xl border border-border bg-secondary/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Prototype demo accounts
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Password for all accounts: <code className="font-medium text-foreground">devkics</code>
          </p>
          <div className="mt-4 grid gap-2">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                onClick={() => setSignIn({ email: a.email, password: "devkics" })}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/40"
              >
                <span className="font-medium">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-7">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2 rounded-full">
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
              onSubmit={(e) => {
                e.preventDefault();
                const user = login(signIn.email, signIn.password);
                if (user) {
                  toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
                  navigate({ to: "/dashboard" });
                } else {
                  toast.error("Invalid email or password");
                }
              }}
            >
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  required
                  type="email"
                  value={signIn.email}
                  onChange={(e) => setSignIn({ ...signIn, email: e.target.value })}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
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
              onSubmit={(e) => {
                e.preventDefault();
                register(signUp);
                toast.success("Account created");
                navigate({ to: "/dashboard" });
              }}
            >
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  required
                  value={signUp.name}
                  onChange={(e) => setSignUp({ ...signUp, name: e.target.value })}
                  placeholder="Ada Lovelace"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  required
                  type="email"
                  value={signUp.email}
                  onChange={(e) => setSignUp({ ...signUp, email: e.target.value })}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  required
                  type="password"
                  value={signUp.password}
                  onChange={(e) => setSignUp({ ...signUp, password: e.target.value })}
                  placeholder="Choose a password"
                />
              </div>
              <div className="space-y-2">
                <Label>I am joining as</Label>
                <Select
                  value={signUp.role}
                  onValueChange={(v) => setSignUp({ ...signUp, role: v as Role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="manager">Team manager</SelectItem>
                    <SelectItem value="organizer">City organizer</SelectItem>
                  </SelectContent>
                </Select>
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

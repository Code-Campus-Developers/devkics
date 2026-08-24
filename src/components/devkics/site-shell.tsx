import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Logo } from "./brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDevKics } from "@/lib/devkics/store";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Cities", to: "/cities" },
  { label: "Abuja", to: "/abuja" },
  { label: "News", to: "/abuja/news" },
  { label: "Volunteer", to: "/volunteer" },
  { label: "Host a city", to: "/organize" },
];

export function SiteHeader() {
  const { currentUser, logout } = useDevKics();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleLogout = () => {
    void (async () => {
      await logout();
      navigate({ to: "/" });
    })();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname === item.to && "bg-accent text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  {currentUser.name.split(" ")[0]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="capitalize">
                  {currentUser.role} account
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/dashboard" })}>
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6">
              <div className="mt-8 flex flex-col gap-1">
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to={currentUser ? "/dashboard" : "/auth"}
                  onClick={() => setOpen(false)}
                  className="mt-3 rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                >
                  {currentUser ? "Dashboard" : "Sign in"}
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="surface-pitch mt-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo variant="light" />
          <p className="mt-4 max-w-sm text-sm text-pitch-foreground/70">
            DevKics is a global football league for technology communities. Pilot season live in
            Abuja, with new cities opening every quarter.
          </p>
        </div>
        <FooterCol
          title="Compete"
          links={[
            { label: "Find a city", to: "/cities" },
            { label: "Abuja portal", to: "/abuja" },
            { label: "Fixtures", to: "/abuja/fixtures" },
            { label: "Standings", to: "/abuja/standings" },
          ]}
        />
        <FooterCol
          title="Get involved"
          links={[
            { label: "Volunteer", to: "/volunteer" },
            { label: "Become an organizer", to: "/organize" },
            { label: "Sponsors", to: "/abuja/sponsors" },
            { label: "Sign in", to: "/auth" },
          ]}
        />
      </div>
      <div className="border-t border-pitch-foreground/10">
        <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-pitch-foreground/55">
          © 2026 DevKics · A CodeCampus Online initiative · Prototype build
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch-foreground/50">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link
              to={l.to}
              className="text-sm text-pitch-foreground/80 transition-colors hover:text-pitch-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

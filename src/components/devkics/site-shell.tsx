import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, CheckCheck, Menu } from "lucide-react";
import { useState } from "react";

import { Logo } from "./brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const {
    currentUser,
    logout,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useDevKics();
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

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
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
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={`Notifications${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} unread` : ""}`}
                  >
                    <Bell className="size-4" />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="font-semibold">Notifications</p>
                    {unreadNotificationCount > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto px-1 text-xs"
                        onClick={() => void markAllNotificationsRead()}
                      >
                        <CheckCheck className="size-3" />
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        className={cn(
                          "w-full border-b border-border px-4 py-3 text-left text-sm last:border-0 hover:bg-accent",
                          !notification.readAt && "bg-primary/[0.04]",
                        )}
                        onClick={() => {
                          if (!notification.readAt) void markNotificationRead(notification.id);
                        }}
                      >
                        <p className="font-medium">{notification.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                      </button>
                    ))}
                    {notifications.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                        You&apos;re all caught up.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    aria-label={`${currentUser.name.split(" ")[0]} account menu`}
                  >
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
            </>
          ) : (
            <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6">
              <SheetTitle className="sr-only">Site Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Navigation links for DevKics mobile menu
              </SheetDescription>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile navigation">
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
              </nav>
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
        <div>
          <Logo variant="light" />
          <p className="mt-4 max-w-xs text-sm text-pitch-foreground/70">
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
        <FooterCol
          title="Legal & Consent"
          links={[
            { label: "Terms of Use", to: "/legal", search: { tab: "terms" } },
            { label: "Privacy Policy", to: "/legal", search: { tab: "privacy" } },
            { label: "Code of Conduct", to: "/legal", search: { tab: "conduct" } },
            { label: "Player Waiver", to: "/legal", search: { tab: "waiver" } },
            { label: "Agreements", to: "/legal", search: { tab: "agreements" } },
          ]}
        />
      </div>
      <div className="border-t border-pitch-foreground/10">
        <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-pitch-foreground/55">
          © 2026 DevKics · A CodeCampus Online initiative
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string; search?: Record<string, string> }[];
}) {
  return (
    <nav aria-label={`${title} links`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch-foreground/50">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            {l.search ? (
              <Link
                to={l.to}
                search={l.search}
                className="text-sm text-pitch-foreground/80 transition-colors hover:text-pitch-foreground"
              >
                {l.label}
              </Link>
            ) : (
              <Link
                to={l.to}
                className="text-sm text-pitch-foreground/80 transition-colors hover:text-pitch-foreground"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionHeading, StatCard } from "@/components/devkics/brand";
import { ApplicationQueue } from "./applications";
import { AnnouncementManager } from "./announcements";
import { ReportsManager } from "./reports";
import { SponsorshipManager } from "./sponsorships";
import { StatusDot } from "@/routes/index";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDevKics } from "@/lib/devkics/store";
import type { City } from "@/lib/devkics/types";

type CityStatus = City["status"];

const STATUS_ACTIONS: {
  status: CityStatus;
  label: string;
  confirmMessage: string;
}[] = [
  { status: "live", label: "Mark live", confirmMessage: "Set this city to Live?" },
  {
    status: "applications-open",
    label: "Open applications",
    confirmMessage: "Open organizer applications for this city?",
  },
  {
    status: "coming-soon",
    label: "Mark coming soon",
    confirmMessage: "Set this city to Coming Soon?",
  },
  {
    status: "suspended",
    label: "Suspend",
    confirmMessage: "Suspend this city? It will be hidden from public users but not deleted.",
  },
  {
    status: "archived",
    label: "Archive",
    confirmMessage:
      "Archive this city? All historical records are preserved. This cannot be undone easily.",
  },
];

const ACTIVE_STATUSES: CityStatus[] = ["live", "applications-open", "coming-soon"];
const INACTIVE_STATUSES: CityStatus[] = ["suspended", "archived"];

interface CityCardProps {
  city: City;
  onStatusChange: (slug: string, status: CityStatus) => Promise<void>;
}

function CityCard({ city, onStatusChange }: CityCardProps) {
  const [loadingStatus, setLoadingStatus] = useState<CityStatus | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    status: CityStatus;
    label: string;
    confirmMessage: string;
  } | null>(null);

  const actions = STATUS_ACTIONS.filter((a) => a.status !== city.status);

  async function executeStatusChange(status: CityStatus) {
    setLoadingStatus(status);
    try {
      await onStatusChange(city.slug, status);
      const label = STATUS_ACTIONS.find((a) => a.status === status)?.label ?? status;
      toast.success(`${city.name}: ${label}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update city");
    } finally {
      setLoadingStatus(null);
    }
  }

  return (
    <>
      <div
        key={city.slug}
        id={`city-card-${city.slug}`}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold">{city.name}</h3>
          <StatusDot status={city.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{city.country}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {city.teams} teams · {city.players} players
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.status}
              size="sm"
              variant={
                action.status === "suspended" || action.status === "archived"
                  ? "destructive"
                  : "outline"
              }
              className="rounded-full"
              id={`city-${city.slug}-action-${action.status}`}
              loading={loadingStatus === action.status}
              loadingText={action.label + "..."}
              disabled={loadingStatus !== null}
              onClick={() => setPendingAction(action)}
            >
              {action.label}
            </Button>
          ))}
          {city.status === "live" && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/$city" params={{ city: city.slug }}>
                Open portal
              </Link>
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.label} — {city.name}
            </AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              id={`city-${city.slug}-confirm-${pendingAction?.status}`}
              onClick={async () => {
                if (pendingAction) {
                  const status = pendingAction.status;
                  setPendingAction(null);
                  await executeStatusChange(status);
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AdminDashboard() {
  const {
    teams,
    players,
    applications,
    fixtures,
    cities,
    sponsorshipEnquiries,
    updateCityStatus,
    createCity,
  } = useDevKics();
  const pending = applications.filter((a) => a.status === "pending");

  const activeCities = cities.filter((c) => (ACTIVE_STATUSES as string[]).includes(c.status));
  const inactiveCities = cities.filter((c) => (INACTIVE_STATUSES as string[]).includes(c.status));

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cityName, setCityName] = useState("");
  const [cityCountry, setCityCountry] = useState("");
  const [cityCountryCode, setCityCountryCode] = useState("");
  const [citySlug, setCitySlug] = useState("");
  const [cityTagline, setCityTagline] = useState("");
  const [cityStatus, setCityStatus] = useState<CityStatus>("applications-open");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateCity(e: FormEvent) {
    e.preventDefault();
    if (!cityName.trim() || !cityCountry.trim() || !cityCountryCode.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      const newCity = await createCity({
        name: cityName.trim(),
        country: cityCountry.trim(),
        countryCode: cityCountryCode.trim().toUpperCase(),
        slug: citySlug.trim() || undefined,
        tagline: cityTagline.trim() || undefined,
        status: cityStatus,
      });
      toast.success(`City "${newCity.name}" created successfully.`);
      setIsCreateOpen(false);
      setCityName("");
      setCityCountry("");
      setCityCountryCode("");
      setCitySlug("");
      setCityTagline("");
      setCityStatus("applications-open");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create city");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live cities" value={cities.filter((c) => c.status === "live").length} />
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Players" value={players.length} tone="flare" />
        <StatCard label="Pending applications" value={pending.length} tone="wine" />
      </div>

      <Tabs defaultValue="cities">
        <TabsList className="rounded-full" aria-label="Admin dashboard sections">
          <TabsTrigger value="cities" className="rounded-full">
            Cities
          </TabsTrigger>
          <TabsTrigger value="applications" className="rounded-full">
            City applications
          </TabsTrigger>
          <TabsTrigger value="sponsors" className="rounded-full">
            Sponsor enquiries
          </TabsTrigger>
          <TabsTrigger value="sponsor-management" className="rounded-full">
            Sponsors
          </TabsTrigger>
          <TabsTrigger value="news" className="rounded-full">
            Newsroom
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full">
            Reports
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-full">
            Platform activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cities" className="mt-8 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SectionHeading title="City network" description="Every chapter across the platform." />
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-full"
              id="admin-create-city-btn"
            >
              <Plus className="mr-1.5 size-4" />
              Create City
            </Button>
          </div>

          {/* Active Chapters */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Active chapters ({activeCities.length})
            </h2>
            {activeCities.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No active chapters.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeCities.map((c) => (
                  <CityCard key={c.slug} city={c} onStatusChange={updateCityStatus} />
                ))}
              </div>
            )}
          </div>

          {/* Inactive & Archived Chapters */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Inactive &amp; archived ({inactiveCities.length})
            </h2>
            {inactiveCities.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No inactive or archived chapters.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactiveCities.map((c) => (
                  <CityCard key={c.slug} city={c} onStatusChange={updateCityStatus} />
                ))}
              </div>
            )}
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New City Chapter</DialogTitle>
                <DialogDescription>
                  Add a new city to the DevKics network. Once added, organizers can apply or you can
                  activate the city portal.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCity} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="city-name">City Name</Label>
                  <Input
                    id="city-name"
                    required
                    placeholder="e.g. Kigali"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city-country">Country</Label>
                    <Input
                      id="city-country"
                      required
                      placeholder="e.g. Rwanda"
                      value={cityCountry}
                      onChange={(e) => setCityCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city-country-code">Country Code</Label>
                    <Input
                      id="city-country-code"
                      required
                      maxLength={3}
                      placeholder="e.g. RW"
                      value={cityCountryCode}
                      onChange={(e) => setCityCountryCode(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city-slug">Custom Slug (Optional)</Label>
                  <Input
                    id="city-slug"
                    placeholder="Leave blank to auto-generate (e.g. kigali)"
                    value={citySlug}
                    onChange={(e) =>
                      setCitySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city-tagline">Tagline (Optional)</Label>
                  <Input
                    id="city-tagline"
                    placeholder="e.g. Tech kicks off in the heart of Africa."
                    value={cityTagline}
                    onChange={(e) => setCityTagline(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city-status">Initial Status</Label>
                  <select
                    id="city-status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={cityStatus}
                    onChange={(e) => setCityStatus(e.target.value as CityStatus)}
                  >
                    <option value="applications-open">Applications Open</option>
                    <option value="coming-soon">Coming Soon</option>
                    <option value="live">Live</option>
                    <option value="suspended">Suspended</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    loadingText="Creating..."
                    disabled={
                      isSubmitting ||
                      !cityName.trim() ||
                      !cityCountry.trim() ||
                      !cityCountryCode.trim()
                    }
                    id="admin-submit-create-city"
                  >
                    Create City
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="applications" className="mt-8">
          <ApplicationQueue kinds={["city-organizer"]} title="City organizer applications" />
        </TabsContent>

        <TabsContent value="sponsors" className="mt-8 space-y-4">
          <SectionHeading
            title="Sponsorship enquiries"
            description="New partnership requests submitted from city sponsor pages."
          />
          {sponsorshipEnquiries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No sponsorship enquiries yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {sponsorshipEnquiries.map((enquiry) => (
                <li key={enquiry.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{enquiry.name}</p>
                    <span className="text-xs text-muted-foreground capitalize">
                      {enquiry.status.replaceAll("-", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {enquiry.organization ?? "Independent partner"} · {enquiry.city.name}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">{enquiry.message}</p>
                  <a
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    href={`mailto:${enquiry.email}`}
                  >
                    {enquiry.email}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="sponsor-management" className="mt-8">
          <SponsorshipManager />
        </TabsContent>
        <TabsContent value="news" className="mt-8">
          <AnnouncementManager />
        </TabsContent>
        <TabsContent value="reports" className="mt-8">
          <ReportsManager />
        </TabsContent>

        <TabsContent value="activity" className="mt-8 space-y-4">
          <SectionHeading title="Recent activity" />
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {fixtures
              .filter((f) => f.status === "completed")
              .slice(-6)
              .reverse()
              .map((f) => {
                const home = teams.find((t) => t.id === f.homeTeamId);
                const away = teams.find((t) => t.id === f.awayTeamId);
                return (
                  <li key={f.id} className="flex items-center justify-between px-5 py-4 text-sm">
                    <span>
                      Result confirmed · {home?.name} {f.homeScore}–{f.awayScore} {away?.name}
                    </span>
                    <span className="text-muted-foreground">{f.date}</span>
                  </li>
                );
              })}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

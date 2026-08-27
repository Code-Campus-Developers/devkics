import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$city/sponsors")({
  head: () => ({
    meta: [
      { title: "Sponsors & Partners — DevKics Abuja" },
      {
        name: "description",
        content:
          "The headline, official and community partners powering the DevKics Abuja pilot season.",
      },
      { property: "og:title", content: "Sponsors & Partners — DevKics Abuja" },
      { property: "og:description", content: "Partners behind the DevKics Abuja pilot season." },
    ],
  }),
  component: SponsorsPage,
});

const tiers = ["HEADLINE", "OFFICIAL", "COMMUNITY"] as const;

const enquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  organization: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10, "Tell us a little more.").max(2_000),
});

type EnquiryInput = z.infer<typeof enquirySchema>;

type Sponsorship = {
  id: string;
  tier: (typeof tiers)[number];
  sortOrder: number;
  sponsor: {
    id: string;
    name: string;
    description: string;
    website: string | null;
    logoUrl: string | null;
  };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
  };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload;
}

function SponsorsPage() {
  const { city } = Route.useParams();
  const queryClient = useQueryClient();
  const sponsorsQuery = useQuery({
    queryKey: ["sponsorships", city],
    queryFn: async () => {
      const payload = await api<{ sponsorships: Sponsorship[] }>(
        `/api/sponsorships?citySlug=${encodeURIComponent(city)}`,
      );
      return payload.sponsorships;
    },
    staleTime: 60_000,
    retry: 1,
  });
  const form = useForm<EnquiryInput>({ resolver: zodResolver(enquirySchema) });
  const enquiryMutation = useMutation({
    mutationFn: (input: EnquiryInput) =>
      api("/api/sponsorship-enquiries", {
        method: "POST",
        body: JSON.stringify({
          citySlug: city,
          ...input,
          organization: input.organization || undefined,
        }),
      }),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["sponsorship-enquiries"] });
      toast.success("Sponsorship enquiry sent");
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Partners"
        title="Sponsors"
        description="DevKics Abuja runs on the support of partners who back the local tech community."
      />

      <div className="mt-10 space-y-12">
        {sponsorsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading partners...</p>
        )}
        {sponsorsQuery.isError && (
          <p className="rounded-2xl border border-destructive/30 p-5 text-sm text-destructive">
            Unable to load sponsors. Please refresh and try again.
          </p>
        )}
        {!sponsorsQuery.isLoading &&
          !sponsorsQuery.isError &&
          tiers.map((tier) => (
            <section key={tier}>
              <h2 className="font-display text-lg font-bold capitalize">
                {tier.toLowerCase()} partners
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sponsorsQuery.data
                  ?.filter((sponsorship) => sponsorship.tier === tier)
                  .map((sponsorship) => (
                    <div
                      key={sponsorship.id}
                      className="card-lift rounded-3xl border border-border bg-card p-6"
                    >
                      <span
                        className={cn(
                          "grid size-14 place-items-center rounded-2xl font-display text-lg font-bold",
                          tier === "HEADLINE" && "bg-primary/12 text-primary",
                          tier === "OFFICIAL" && "bg-flare/18 text-flare-foreground",
                          tier === "COMMUNITY" && "bg-wine/10 text-wine",
                        )}
                      >
                        {sponsorship.sponsor.name.slice(0, 2).toUpperCase()}
                      </span>
                      <h3 className="mt-5 text-lg font-semibold">{sponsorship.sponsor.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {sponsorship.sponsor.description}
                      </p>
                      {sponsorship.sponsor.website && (
                        <a
                          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                          href={sponsorship.sponsor.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Visit partner
                        </a>
                      )}
                    </div>
                  ))}
                {sponsorsQuery.data?.every((sponsorship) => sponsorship.tier !== tier) && (
                  <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    Partner opportunities are open for this tier.
                  </p>
                )}
              </div>
            </section>
          ))}
      </div>

      <div className="mt-16 grid gap-8 rounded-3xl border border-border bg-secondary/40 p-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-xl font-bold">Partner with DevKics Abuja</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reach hundreds of engineers, designers and founders every matchday.
          </p>
        </div>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((input) => enquiryMutation.mutate(input))}
        >
          <div className="space-y-2">
            <Label htmlFor="sponsor-name">Name</Label>
            <Input id="sponsor-name" placeholder="Ada Lovelace" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sponsor-email">Email</Label>
            <Input
              id="sponsor-email"
              type="email"
              placeholder="you@company.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sponsor-organization">Organization</Label>
            <Input
              id="sponsor-organization"
              placeholder="Company or community"
              {...form.register("organization")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sponsor-message">How would you like to partner?</Label>
            <Textarea id="sponsor-message" rows={4} {...form.register("message")} />
            {form.formState.errors.message && (
              <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>
            )}
          </div>
          {enquiryMutation.isError && (
            <p className="sm:col-span-2 text-sm text-destructive">
              {enquiryMutation.error instanceof Error
                ? enquiryMutation.error.message
                : "Unable to send your enquiry."}
            </p>
          )}
          <Button
            type="submit"
            className="rounded-full sm:col-span-2 sm:justify-self-start"
            disabled={enquiryMutation.isPending}
          >
            {enquiryMutation.isPending ? "Sending enquiry..." : "Request the deck"}
          </Button>
        </form>
      </div>
    </div>
  );
}

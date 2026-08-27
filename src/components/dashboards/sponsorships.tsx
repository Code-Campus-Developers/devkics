import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SectionHeading } from "@/components/devkics/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDevKics } from "@/lib/devkics/store";

type Sponsorship = {
  id: string;
  tier: "HEADLINE" | "OFFICIAL" | "COMMUNITY";
  sortOrder: number;
  isPublished: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sponsor: { name: string; description: string };
};
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error ?? "Request failed");
  return payload;
}

export function SponsorshipManager() {
  const { cities } = useDevKics();
  const citySlug = cities.find((city) => city.status === "live")?.slug ?? "abuja";
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    tier: "official",
    startsAt: "",
    endsAt: "",
  });
  const query = useQuery({
    queryKey: ["sponsorships", citySlug, "admin"],
    queryFn: () =>
      api<{ sponsorships: Sponsorship[] }>(
        `/api/sponsorships?citySlug=${encodeURIComponent(citySlug)}`,
      ),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sponsorships", citySlug] });
  const create = useMutation({
    mutationFn: () =>
      api("/api/sponsorships", {
        method: "POST",
        body: JSON.stringify({
          citySlug,
          ...form,
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
        }),
      }),
    onSuccess: () => {
      setForm({ name: "", slug: "", description: "", tier: "official", startsAt: "", endsAt: "" });
      void invalidate();
      toast.success("Sponsorship created");
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Sponsor management"
        description="Create partner profiles, set campaign dates, publish, and set display order."
      />
      <form
        className="grid gap-3 rounded-3xl border border-border bg-card p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Input
          required
          placeholder="Partner name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          required
          placeholder="partner-slug"
          value={form.slug}
          onChange={(event) => setForm({ ...form, slug: event.target.value })}
        />
        <Textarea
          required
          className="sm:col-span-2"
          placeholder="Partner description"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <Select value={form.tier} onValueChange={(tier) => setForm({ ...form, tier })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="headline">Headline</SelectItem>
            <SelectItem value="official">Official</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="date"
            value={form.startsAt}
            onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
          />
          <Input
            type="date"
            value={form.endsAt}
            onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
          />
        </div>
        <Button
          type="submit"
          disabled={create.isPending}
          className="rounded-full sm:col-span-2 sm:justify-self-start"
        >
          Create sponsorship
        </Button>
      </form>
      <ul className="space-y-3">
        {query.data?.sponsorships.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="min-w-40 flex-1">
              <p className="font-semibold">{item.sponsor.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.tier.toLowerCase()} · order {item.sortOrder}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                api(`/api/sponsorships/${item.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ isPublished: !item.isPublished }),
                }).then(invalidate)
              }
            >
              {item.isPublished ? "Unpublish" : "Publish"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                api(`/api/sponsorships/${item.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ sortOrder: Math.max(0, item.sortOrder - 1) }),
                }).then(invalidate)
              }
            >
              Move up
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                api(`/api/sponsorships/${item.id}`, { method: "DELETE" }).then(invalidate)
              }
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

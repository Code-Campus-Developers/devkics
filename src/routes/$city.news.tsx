import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/devkics/brand";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/$city/news")({
  head: () => ({
    meta: [
      { title: "News & Announcements — DevKics Abuja" },
      {
        name: "description",
        content:
          "Matchday reports, announcements and community updates from the DevKics Abuja season.",
      },
      { property: "og:title", content: "News & Announcements — DevKics Abuja" },
      { property: "og:description", content: "Latest updates from DevKics Abuja." },
    ],
  }),
  component: NewsPage,
});

type Announcement = {
  id: string;
  headline: string;
  excerpt: string;
  body: string;
  category: string;
  publishedAt: string | null;
  featuredImageUrl: string | null;
  authorName: string | null;
};

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const payload = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
  };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload;
}

function NewsPage() {
  const { city } = Route.useParams();
  const newsQuery = useQuery({
    queryKey: ["announcements", city, "public"],
    queryFn: async () => {
      const payload = await api<{ announcements: Announcement[] }>(
        `/api/announcements?citySlug=${encodeURIComponent(city)}`,
      );
      return payload.announcements;
    },
    staleTime: 60_000,
    retry: 1,
  });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Newsroom"
        title="News & announcements"
        description="Matchday reports, league announcements and community updates."
      />

      <div className="mt-10 space-y-4">
        {newsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading news...</p>}
        {newsQuery.isError && (
          <p className="rounded-2xl border border-destructive/30 p-5 text-sm text-destructive">
            Unable to load news. Please refresh and try again.
          </p>
        )}
        {newsQuery.data?.map((item) => {
          const open = openId === item.id;
          return (
            <article
              key={item.id}
              className="card-lift overflow-hidden rounded-3xl border border-border bg-card"
            >
              {item.featuredImageUrl && (
                <img
                  src={item.featuredImageUrl}
                  alt=""
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
              )}
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full flex-col gap-2 p-6 text-left"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full bg-primary/12 text-primary hover:bg-primary/12">
                    {item.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "Draft"}
                  </span>
                  {item.authorName && (
                    <span className="text-xs text-muted-foreground">By {item.authorName}</span>
                  )}
                </div>
                <h2 className="text-xl font-bold">{item.headline}</h2>
                <p className="text-sm text-muted-foreground">{item.excerpt}</p>
              </button>
              {open && (
                <div className="border-t border-border px-6 py-5 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </div>
              )}
            </article>
          );
        })}
        {!newsQuery.isLoading && !newsQuery.isError && newsQuery.data?.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No announcements have been published yet.
          </p>
        )}
      </div>
    </div>
  );
}

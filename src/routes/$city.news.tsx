import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Newspaper } from "lucide-react";

import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components/devkics/brand";
import { Badge } from "@/components/ui/badge";
import { canonicalLink, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/$city/news")({
  head: ({ params }) => {
    const title = "News & Announcements — DevKics Abuja";
    const description =
      "Matchday reports, announcements and community updates from the DevKics Abuja season.";
    return {
      links: [canonicalLink(`/${params.city}/news`)],
      meta: seoMeta({
        title,
        description,
        path: `/${params.city}/news`,
      }),
    };
  },
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
        {newsQuery.isLoading && <LoadingSkeleton variant="cards" count={3} />}
        {newsQuery.isError && (
          <ErrorState
            title="Unable to load news"
            description={
              newsQuery.error instanceof Error
                ? newsQuery.error.message
                : "An error occurred while fetching the latest announcements."
            }
            onRetry={() => newsQuery.refetch()}
          />
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
                  decoding="async"
                />
              )}
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`announcement-body-${item.id}`}
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
                <div
                  id={`announcement-body-${item.id}`}
                  className="border-t border-border px-6 py-5 text-sm leading-relaxed text-muted-foreground"
                >
                  {item.body}
                </div>
              )}
            </article>
          );
        })}
        {!newsQuery.isLoading && !newsQuery.isError && newsQuery.data?.length === 0 && (
          <EmptyState
            icon={Newspaper}
            title="No Announcements Yet"
            description="Matchday reports, tournament schedules, and community news will be published here soon."
          />
        )}
      </div>
    </div>
  );
}

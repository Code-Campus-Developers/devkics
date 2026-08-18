import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/devkics/brand";
import { Badge } from "@/components/ui/badge";
import { news } from "@/lib/devkics/seed";

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

function NewsPage() {
  const [openId, setOpenId] = useState<string | null>(news[0]?.id ?? null);

  return (
    <div>
      <PageHeader
        eyebrow="Newsroom"
        title="News & announcements"
        description="Matchday reports, league announcements and community updates."
      />

      <div className="mt-10 space-y-4">
        {news.map((item) => {
          const open = openId === item.id;
          return (
            <article
              key={item.id}
              className="card-lift overflow-hidden rounded-3xl border border-border bg-card"
            >
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full flex-col gap-2 p-6 text-left"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full bg-primary/12 text-primary hover:bg-primary/12">
                    {item.tag}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                </div>
                <h2 className="text-xl font-bold">{item.title}</h2>
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
      </div>
    </div>
  );
}

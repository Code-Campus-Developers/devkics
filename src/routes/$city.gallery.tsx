import { createFileRoute } from "@tanstack/react-router";
import { Play } from "lucide-react";

import { PageHeader } from "@/components/devkics/brand";
import heroPitch from "@/assets/hero-pitch.jpg";
import community from "@/assets/community.jpg";
import pitchTop from "@/assets/pitch-top.jpg";
import { media } from "@/lib/devkics/seed";

const images = [heroPitch, community, pitchTop];

export const Route = createFileRoute("/$city/gallery")({
  head: () => ({
    meta: [
      { title: "Media & Gallery — DevKics Abuja" },
      {
        name: "description",
        content: "Photos and highlights from DevKics Abuja matchdays at Jabi Astro Turf.",
      },
      { property: "og:title", content: "Media & Gallery — DevKics Abuja" },
      { property: "og:description", content: "Matchday photography and highlights." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Media"
        title="Gallery"
        description="Shot by the DevKics volunteer media crew across the season."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {media.map((item, i) => (
          <figure
            key={item.id}
            className="card-lift group relative overflow-hidden rounded-3xl border border-border bg-card"
          >
            <img
              src={images[i % images.length]}
              alt={item.caption}
              width={800}
              height={560}
              loading="lazy"
              className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {item.kind === "highlight" && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Play className="size-3" /> Highlight
              </span>
            )}
            <figcaption className="p-4 text-sm font-medium">{item.caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

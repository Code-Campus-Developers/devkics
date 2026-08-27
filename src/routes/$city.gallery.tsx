import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/devkics/brand";

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

type Gallery = {
  id: string;
  title: string;
  description: string | null;
  media: Array<{
    id: string;
    fileName: string;
    publicUrl: string;
    caption: string | null;
    credit: string | null;
    isCover: boolean;
  }>;
};

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const payload = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false)
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  return payload;
}

function GalleryPage() {
  const { city } = Route.useParams();
  const galleryQuery = useQuery({
    queryKey: ["galleries", city, "public"],
    queryFn: async () => {
      const payload = await api<{ galleries: Gallery[] }>(
        `/api/galleries?citySlug=${encodeURIComponent(city)}`,
      );
      return payload.galleries;
    },
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Media"
        title="Gallery"
        description="Shot by the DevKics volunteer media crew across the season."
      />

      <div className="mt-10 space-y-10">
        {galleryQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading gallery...</p>
        )}
        {galleryQuery.isError && (
          <p className="rounded-2xl border border-destructive/30 p-5 text-sm text-destructive">
            Unable to load gallery media. Please refresh and try again.
          </p>
        )}
        {galleryQuery.data?.map((gallery) => (
          <section key={gallery.id}>
            <h2 className="font-display text-xl font-bold">{gallery.title}</h2>
            {gallery.description && (
              <p className="mt-1 text-sm text-muted-foreground">{gallery.description}</p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.media.map((media) => (
                <figure
                  key={media.id}
                  className="card-lift overflow-hidden rounded-3xl border border-border bg-card"
                >
                  <img
                    src={media.publicUrl}
                    alt={media.caption ?? media.fileName}
                    width={800}
                    height={560}
                    loading="lazy"
                    className="h-56 w-full object-cover"
                  />
                  <figcaption className="space-y-1 p-4 text-sm">
                    <p className="font-medium">{media.caption ?? media.fileName}</p>
                    {media.credit && (
                      <p className="text-xs text-muted-foreground">Credit: {media.credit}</p>
                    )}
                  </figcaption>
                </figure>
              ))}
              {gallery.media.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No media has been added to this album yet.
                </p>
              )}
            </div>
          </section>
        ))}
        {!galleryQuery.isLoading && !galleryQuery.isError && galleryQuery.data?.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No gallery albums have been published yet.
          </p>
        )}
      </div>
    </div>
  );
}

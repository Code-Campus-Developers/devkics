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

export function GalleryManager() {
  const { galleries, createGallery, uploadGalleryMedia, deleteGalleryMedia } = useDevKics();
  const [galleryTitle, setGalleryTitle] = useState("");
  const [galleryDescription, setGalleryDescription] = useState("");
  const [selectedGalleryId, setSelectedGalleryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [isCover, setIsCover] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Gallery media"
        description="Create albums and upload JPEG, PNG, or WebP images up to 5 MB. Images are stored securely in Supabase Storage."
      />
      <form
        className="grid gap-4 rounded-3xl border border-border bg-card p-6 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await createGallery({
              title: galleryTitle,
              ...(galleryDescription ? { description: galleryDescription } : {}),
            });
            setGalleryTitle("");
            setGalleryDescription("");
            toast.success("Gallery created");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to create gallery");
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="gallery-title">Album title</Label>
          <Input
            id="gallery-title"
            required
            value={galleryTitle}
            onChange={(event) => setGalleryTitle(event.target.value)}
            placeholder="Opening matchday"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="rounded-full">
            Create album
          </Button>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="gallery-description">Description</Label>
          <Textarea
            id="gallery-description"
            rows={2}
            value={galleryDescription}
            onChange={(event) => setGalleryDescription(event.target.value)}
          />
        </div>
      </form>

      <form
        className="grid gap-4 rounded-3xl border border-border bg-card p-6 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!selectedGalleryId || !file) {
            toast.error("Choose an album and image first");
            return;
          }
          setSubmitting(true);
          try {
            await uploadGalleryMedia({
              galleryId: selectedGalleryId,
              file,
              ...(caption ? { caption } : {}),
              ...(credit ? { credit } : {}),
              isCover,
            });
            setFile(null);
            setCaption("");
            setCredit("");
            setIsCover(false);
            toast.success("Gallery image uploaded");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload image");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label>Album</Label>
          <Select value={selectedGalleryId} onValueChange={setSelectedGalleryId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an album" />
            </SelectTrigger>
            <SelectContent>
              {galleries.map((gallery) => (
                <SelectItem key={gallery.id} value={gallery.id}>
                  {gallery.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gallery-file">Image file</Label>
          <Input
            id="gallery-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gallery-caption">Caption</Label>
          <Input
            id="gallery-caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gallery-credit">Credit</Label>
          <Input
            id="gallery-credit"
            value={credit}
            onChange={(event) => setCredit(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isCover}
            onChange={(event) => setIsCover(event.target.checked)}
          />
          Use as this album&apos;s cover image
        </label>
        <Button type="submit" className="rounded-full sm:justify-self-start" disabled={submitting}>
          {submitting ? "Uploading..." : "Upload image"}
        </Button>
      </form>

      <div className="space-y-6">
        {galleries.map((gallery) => (
          <section key={gallery.id} className="rounded-3xl border border-border bg-card p-6">
            <h3 className="font-semibold">{gallery.title}</h3>
            {gallery.description && (
              <p className="mt-1 text-sm text-muted-foreground">{gallery.description}</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.media.map((media) => (
                <figure key={media.id} className="overflow-hidden rounded-2xl border border-border">
                  <img
                    src={media.publicUrl}
                    alt={media.caption ?? media.fileName}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption className="space-y-2 p-3 text-xs text-muted-foreground">
                    <p>{media.caption ?? media.fileName}</p>
                    {media.credit && <p>Credit: {media.credit}</p>}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await deleteGalleryMedia(gallery.id, media.id);
                          toast.success("Gallery image deleted");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Unable to delete image",
                          );
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </figcaption>
                </figure>
              ))}
              {gallery.media.length === 0 && (
                <p className="text-sm text-muted-foreground">No images in this album yet.</p>
              )}
            </div>
          </section>
        ))}
        {galleries.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Create an album before uploading media.
          </p>
        )}
      </div>
    </div>
  );
}

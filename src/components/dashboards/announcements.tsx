import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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

const announcementSchema = z.object({
  headline: z.string().trim().min(5, "Use at least 5 characters.").max(200),
  excerpt: z.string().trim().min(10, "Use at least 10 characters.").max(500),
  body: z.string().trim().min(20, "Use at least 20 characters.").max(10_000),
  category: z.string().trim().min(2, "Choose a category.").max(80),
  featuredImageUrl: z.string().url("Enter a valid image URL.").or(z.literal("")),
  status: z.enum(["draft", "published"]),
});

type AnnouncementInput = z.infer<typeof announcementSchema>;

export function AnnouncementManager() {
  const { announcements, createAnnouncement, updateAnnouncement } = useDevKics();
  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { category: "Community", featuredImageUrl: "", status: "draft" },
  });

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Newsroom"
        description="Create city announcements, save drafts, and publish approved updates to the public news page."
      />
      <form
        className="grid gap-4 rounded-3xl border border-border bg-card p-6 sm:grid-cols-2"
        onSubmit={form.handleSubmit(async (input) => {
          try {
            const { featuredImageUrl, ...announcement } = input;
            await createAnnouncement({
              ...announcement,
              ...(featuredImageUrl ? { featuredImageUrl } : {}),
            });
            form.reset({ category: "Community", featuredImageUrl: "", status: "draft" });
            toast.success(input.status === "published" ? "Announcement published" : "Draft saved");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save announcement");
          }
        })}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="announcement-headline">Headline</Label>
          <Input id="announcement-headline" {...form.register("headline")} />
          {form.formState.errors.headline && (
            <p className="text-xs text-destructive">{form.formState.errors.headline.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="announcement-category">Category</Label>
          <Input id="announcement-category" {...form.register("category")} />
          {form.formState.errors.category && (
            <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="announcement-image">Featured image URL</Label>
          <Input
            id="announcement-image"
            placeholder="https://"
            {...form.register("featuredImageUrl")}
          />
          {form.formState.errors.featuredImageUrl && (
            <p className="text-xs text-destructive">
              {form.formState.errors.featuredImageUrl.message}
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="announcement-excerpt">Excerpt</Label>
          <Textarea id="announcement-excerpt" rows={3} {...form.register("excerpt")} />
          {form.formState.errors.excerpt && (
            <p className="text-xs text-destructive">{form.formState.errors.excerpt.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="announcement-body">Announcement</Label>
          <Textarea id="announcement-body" rows={6} {...form.register("body")} />
          {form.formState.errors.body && (
            <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Publication state</Label>
          <Select
            value={form.watch("status")}
            onValueChange={(status) =>
              form.setValue("status", status as AnnouncementInput["status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Save as draft</SelectItem>
              <SelectItem value="published">Publish now</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="rounded-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save announcement"}
          </Button>
        </div>
      </form>

      <ul className="space-y-3">
        {announcements.map((announcement) => (
          <li key={announcement.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{announcement.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground">{announcement.excerpt}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs capitalize text-muted-foreground">
                  {announcement.status}
                </span>
                {announcement.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await updateAnnouncement(announcement.id, { status: "published" });
                        toast.success("Announcement published");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Unable to publish");
                      }
                    }}
                  >
                    Publish
                  </Button>
                )}
                {announcement.status === "published" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await updateAnnouncement(announcement.id, { status: "draft" });
                        toast.success("Announcement returned to draft");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Unable to unpublish");
                      }
                    }}
                  >
                    Unpublish
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
        {announcements.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No city announcements yet.
          </li>
        )}
      </ul>
    </div>
  );
}

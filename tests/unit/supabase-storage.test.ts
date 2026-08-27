import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publicGalleryUrl, uploadGalleryMedia } from "@/lib/server/supabase-storage";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  Object.assign(process.env, {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "test-service-key",
    SUPABASE_GALLERY_BUCKET: "devkics-gallery",
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("supabase gallery storage", () => {
  it("derives public URLs from the configured bucket and storage path", () => {
    expect(publicGalleryUrl("galleries/gallery one/photo one.jpg")).toContain(
      "/storage/v1/object/public/devkics-gallery/galleries/gallery%20one/photo%20one.jpg",
    );
  });

  it("rejects unsupported and oversized uploads before contacting Supabase", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(
      uploadGalleryMedia({
        galleryId: "gallery-1",
        fileName: "document.gif",
        mimeType: "image/gif",
        bytes: new ArrayBuffer(1),
      }),
    ).rejects.toThrow("Only JPEG, PNG, and WebP images are supported");

    await expect(
      uploadGalleryMedia({
        galleryId: "gallery-1",
        fileName: "too-large.jpg",
        mimeType: "image/jpeg",
        bytes: new ArrayBuffer(5 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow("Gallery images must be between 1 byte and 5 MB");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads an allowed image to a gallery-scoped Supabase path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock;
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");

    const media = await uploadGalleryMedia({
      galleryId: "gallery-1",
      fileName: "opening.png",
      mimeType: "image/png",
      bytes: new Uint8Array([1, 2, 3]).buffer,
    });

    expect(media.storagePath).toBe("galleries/gallery-1/00000000-0000-4000-8000-000000000001.png");
    expect(media.publicUrl).toContain(
      "galleries/gallery-1/00000000-0000-4000-8000-000000000001.png",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/storage/v1/object/devkics-gallery/galleries/gallery-1/00000000-0000-4000-8000-000000000001.png",
      ),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

const MAX_GALLERY_FILE_SIZE = 5 * 1024 * 1024;

const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type GalleryMimeType = keyof typeof extensionByMimeType;

function config() {
  const url = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
  const secretKey = process.env["SUPABASE_SECRET_KEY"];
  const bucket = process.env["SUPABASE_GALLERY_BUCKET"];

  if (!url || !secretKey || !bucket) {
    throw new Error("Supabase gallery storage is not configured");
  }

  return { url, secretKey, bucket };
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function storageHeaders(secretKey: string) {
  return {
    authorization: `Bearer ${secretKey}`,
    apikey: secretKey,
  };
}

export function publicGalleryUrl(storagePath: string) {
  const { url, bucket } = config();
  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodePath(storagePath)}`;
}

export async function uploadGalleryMedia(input: {
  galleryId: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}) {
  if (!(input.mimeType in extensionByMimeType)) {
    throw new Error("Only JPEG, PNG, and WebP images are supported");
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_GALLERY_FILE_SIZE) {
    throw new Error("Gallery images must be between 1 byte and 5 MB");
  }

  const { url, secretKey, bucket } = config();
  const extension = extensionByMimeType[input.mimeType as GalleryMimeType];
  const storagePath = `galleries/${input.galleryId}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        ...storageHeaders(secretKey),
        "content-type": input.mimeType,
        "x-upsert": "false",
      },
      body: input.bytes,
    },
  );

  if (!response.ok) {
    throw new Error("Unable to upload gallery media");
  }

  return { storagePath, publicUrl: publicGalleryUrl(storagePath) };
}

export async function deleteGalleryMedia(storagePath: string) {
  const { url, secretKey, bucket } = config();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: { ...storageHeaders(secretKey), "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });

  if (!response.ok) {
    throw new Error("Unable to delete gallery media");
  }
}

export const SITE_URL = "https://devkics.org";

export function canonicalLink(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const href = normalizedPath === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`;
  return { rel: "canonical" as const, href };
}

export function seoMeta({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: string;
}) {
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];

  if (path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = normalizedPath === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`;
    meta.push({ property: "og:url", content: url });
  }

  if (image) {
    const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;
    meta.push(
      { property: "og:image", content: imageUrl },
      { name: "twitter:image", content: imageUrl },
    );
  }

  return meta;
}

import type { PrismaClient } from "@prisma/client";

const SITE_URL = "https://devkics.com";

export async function generateSitemapXml(prisma: PrismaClient): Promise<string> {
  const [cities, teams] = await Promise.all([
    prisma.city.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.team.findMany({
      select: {
        id: true,
        updatedAt: true,
        tournament: { select: { city: { select: { slug: true } } } },
      },
    }),
  ]);

  const defaultLastMod = new Date().toISOString().slice(0, 10);

  const staticUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod?: string }> =
    [
      { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "weekly", lastmod: defaultLastMod },
      { loc: `${SITE_URL}/cities`, priority: "0.8", changefreq: "weekly", lastmod: defaultLastMod },
      {
        loc: `${SITE_URL}/organize`,
        priority: "0.8",
        changefreq: "monthly",
        lastmod: defaultLastMod,
      },
      {
        loc: `${SITE_URL}/volunteer`,
        priority: "0.8",
        changefreq: "monthly",
        lastmod: defaultLastMod,
      },
      { loc: `${SITE_URL}/legal`, priority: "0.6", changefreq: "monthly", lastmod: defaultLastMod },
    ];

  const cityUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod?: string }> =
    [];

  const citySlugs = cities.length > 0 ? cities : [{ slug: "abuja", updatedAt: new Date() }];

  for (const city of citySlugs) {
    const lastmod = (city.updatedAt ?? new Date()).toISOString().slice(0, 10);
    const base = `${SITE_URL}/${city.slug}`;
    cityUrls.push(
      { loc: base, priority: "0.9", changefreq: "daily", lastmod },
      { loc: `${base}/fixtures`, priority: "0.8", changefreq: "daily", lastmod },
      { loc: `${base}/results`, priority: "0.8", changefreq: "daily", lastmod },
      { loc: `${base}/standings`, priority: "0.9", changefreq: "daily", lastmod },
      { loc: `${base}/teams`, priority: "0.8", changefreq: "weekly", lastmod },
      { loc: `${base}/players`, priority: "0.7", changefreq: "weekly", lastmod },
      { loc: `${base}/news`, priority: "0.8", changefreq: "daily", lastmod },
      { loc: `${base}/gallery`, priority: "0.7", changefreq: "weekly", lastmod },
      { loc: `${base}/sponsors`, priority: "0.6", changefreq: "monthly", lastmod },
      { loc: `${base}/tournament`, priority: "0.7", changefreq: "weekly", lastmod },
    );
  }

  const teamUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod?: string }> =
    [];
  for (const team of teams) {
    const citySlug = team.tournament?.city?.slug ?? "abuja";
    const lastmod = (team.updatedAt ?? new Date()).toISOString().slice(0, 10);
    teamUrls.push({
      loc: `${SITE_URL}/${citySlug}/teams/${team.id}`,
      priority: "0.7",
      changefreq: "weekly",
      lastmod,
    });
  }

  const allUrls = [...staticUrls, ...cityUrls, ...teamUrls];

  const xmlEntries = allUrls
    .map(
      (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod ?? defaultLastMod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;
}

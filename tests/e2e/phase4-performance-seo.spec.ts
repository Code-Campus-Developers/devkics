import { expect, test } from "@playwright/test";

test.describe("Phase 4.4 — Performance, SEO & Caching", () => {
  test("renders canonical links and open graph tags across public pages", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const rootCanonical = page.locator('link[rel="canonical"]');
    await expect(rootCanonical).toHaveAttribute("href", "https://devkics.com/");

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /DevKics/);

    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute("content", "summary_large_image");

    // City Fixtures page
    await page.goto("/abuja/fixtures");
    await page.waitForLoadState("networkidle");

    const fixturesCanonical = page.locator('link[rel="canonical"]');
    await expect(fixturesCanonical).toHaveAttribute("href", "https://devkics.com/abuja/fixtures");

    expect(consoleErrors).toEqual([]);
  });

  test("applies optimized loading attributes on key media assets", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Hero banner is an LCP element: high fetch priority, async decoding, no lazy loading
    const heroImage = page.locator(
      'img[alt="Five-a-side football match under floodlights in Abuja"]',
    );
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute("fetchpriority", "high");
    await expect(heroImage).toHaveAttribute("decoding", "async");
    const loadingAttr = await heroImage.getAttribute("loading");
    expect(loadingAttr).not.toBe("lazy");

    expect(consoleErrors).toEqual([]);
  });

  test("displays accessible EmptyState when filtering produces zero matches", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/abuja/players");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByRole("textbox", { name: "Search players or roles" });
    await searchInput.fill("nonexistent-player-xyz");

    // EmptyState displays "No Players Found"
    await expect(page.getByText("No Players Found")).toBeVisible();

    // Clearing input restores player grid
    await searchInput.fill("");
    await expect(page.getByText("No Players Found")).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });

  test("serves dynamic sitemap.xml and robots.txt via HTTP", async ({ request }) => {
    const sitemapResponse = await request.get("/sitemap.xml");
    expect(sitemapResponse.status()).toBe(200);
    const sitemapHeaders = sitemapResponse.headers();
    expect(sitemapHeaders["content-type"]).toContain("xml");
    expect(sitemapHeaders["cache-control"]).toContain("public");

    const sitemapText = await sitemapResponse.text();
    expect(sitemapText).toContain("https://devkics.com/");
    expect(sitemapText).toContain("https://devkics.com/abuja");

    const robotsResponse = await request.get("/robots.txt");
    expect(robotsResponse.status()).toBe(200);
    const robotsText = await robotsResponse.text();
    expect(robotsText).toContain("User-agent: *");
    expect(robotsText).toContain("Disallow: /dashboard");
    expect(robotsText).toContain("Sitemap: https://devkics.com/sitemap.xml");
  });
});

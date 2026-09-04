import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canonicalLink, seoMeta, SITE_URL } from "@/lib/seo";
import { generateSitemapXml } from "@/lib/server/sitemap";

describe("SEO and Caching helpers", () => {
  describe("canonicalLink", () => {
    it("generates correct canonical URL for root", () => {
      const link = canonicalLink("/");
      expect(link).toEqual({
        rel: "canonical",
        href: `${SITE_URL}/`,
      });
    });

    it("generates correct canonical URL for nested paths with or without leading slash", () => {
      expect(canonicalLink("/abuja/fixtures")).toEqual({
        rel: "canonical",
        href: `${SITE_URL}/abuja/fixtures`,
      });

      expect(canonicalLink("abuja/standings")).toEqual({
        rel: "canonical",
        href: `${SITE_URL}/abuja/standings`,
      });
    });
  });

  describe("seoMeta", () => {
    it("generates standard metadata and open graph tags", () => {
      const meta = seoMeta({
        title: "Test Page — DevKics",
        description: "Test page description for search engines and social cards.",
        path: "/abuja/tournament",
      });

      expect(meta).toEqual(
        expect.arrayContaining([
          { title: "Test Page — DevKics" },
          {
            name: "description",
            content: "Test page description for search engines and social cards.",
          },
          { property: "og:title", content: "Test Page — DevKics" },
          {
            property: "og:description",
            content: "Test page description for search engines and social cards.",
          },
          { property: "og:type", content: "website" },
          { property: "og:url", content: `${SITE_URL}/abuja/tournament` },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "twitter:title", content: "Test Page — DevKics" },
          {
            name: "twitter:description",
            content: "Test page description for search engines and social cards.",
          },
        ]),
      );
    });

    it("includes image tags when image is provided", () => {
      const meta = seoMeta({
        title: "DevKics",
        description: "Football for tech founders and operators.",
        image: "/devkics-og.png",
      });

      expect(meta).toEqual(
        expect.arrayContaining([
          { property: "og:image", content: `${SITE_URL}/devkics-og.png` },
          { name: "twitter:image", content: `${SITE_URL}/devkics-og.png` },
        ]),
      );
    });
  });

  describe("generateSitemapXml", () => {
    it("generates valid XML sitemap including static pages and city pages", async () => {
      const mockPrisma = {
        city: {
          findMany: async () => [
            { slug: "abuja", updatedAt: new Date("2026-09-01T00:00:00.000Z") },
            { slug: "lagos", updatedAt: new Date("2026-09-02T00:00:00.000Z") },
          ],
        },
        team: {
          findMany: async () => [
            {
              id: "tm-paystack",
              updatedAt: new Date("2026-09-03T00:00:00.000Z"),
              tournament: { city: { slug: "lagos" } },
            },
          ],
        },
      } as unknown as PrismaClient;

      const xml = await generateSitemapXml(mockPrisma);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

      // Static routes
      expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
      expect(xml).toContain(`<loc>${SITE_URL}/cities</loc>`);
      expect(xml).toContain(`<loc>${SITE_URL}/organize</loc>`);
      expect(xml).toContain(`<loc>${SITE_URL}/volunteer</loc>`);
      expect(xml).toContain(`<loc>${SITE_URL}/legal</loc>`);

      // Dynamic city routes
      expect(xml).toContain(`<loc>${SITE_URL}/abuja</loc>`);
      expect(xml).toContain(`<loc>${SITE_URL}/abuja/fixtures</loc>`);
      expect(xml).toContain(`<loc>${SITE_URL}/abuja/standings</loc>`);
      expect(xml).toContain(`<loc>${SITE_URL}/lagos/fixtures</loc>`);

      // Dynamic team route
      expect(xml).toContain(`<loc>${SITE_URL}/lagos/teams/tm-paystack</loc>`);
      expect(xml).toContain("<lastmod>2026-09-03</lastmod>");
      expect(xml).toContain("</urlset>");
    });
  });
});

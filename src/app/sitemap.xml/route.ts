import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const revalidate = 0;

export async function GET() {
  const baseUrl = "https://monik.exchange";

  // Static routes
  const staticRoutes = [
    "",
    "/exchangers",
    "/wiki",
    "/blog",
    "/contacts",
    "/privacy",
    "/terms",
    "/api-docs",
  ];

  // Fetch dynamic routes
  const [exchanges, blogs, directions] = await Promise.all([
    prisma.exchange.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.directionSeoText.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const urls = [
    ...staticRoutes.map((route) => ({
      loc: `${baseUrl}${route}`,
      changefreq: route === "" ? "daily" : "weekly",
      priority: route === "" ? "1.0" : "0.8",
      lastmod: new Date().toISOString(),
    })),
    ...exchanges.map((ex) => ({
      loc: `${baseUrl}/exchangers/${ex.slug}`,
      changefreq: "daily",
      priority: "0.9",
      lastmod: ex.updatedAt.toISOString(),
    })),
    ...blogs.map((b) => ({
      loc: `${baseUrl}/blog/${b.slug}`,
      changefreq: "monthly",
      priority: "0.7",
      lastmod: b.updatedAt.toISOString(),
    })),
    ...directions.map((d) => ({
      loc: `${baseUrl}/${d.slug}`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: d.updatedAt.toISOString(),
    })),
  ];

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xmlContent, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

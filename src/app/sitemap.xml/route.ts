import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const revalidate = 0;

export async function GET() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "sitemap.xml" } });
  
  const content = setting?.value || `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://monik.exchange/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

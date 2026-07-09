import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const revalidate = 0;

export async function GET() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "robots.txt" } });
  
  const content = setting?.value || `User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard

Sitemap: https://monik.exchange/sitemap.xml`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

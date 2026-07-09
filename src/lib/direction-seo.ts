import { PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export function normalizeDirectionSeoSlug(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.html$/i, "")
    .toLowerCase();
}

export async function loadDirectionSeoText(direction: string | undefined) {
  if (!direction || process.env.RATESCOPE_USE_DB_CONTENT === "0") return null;
  const slug = normalizeDirectionSeoSlug(direction);
  if (!slug) return null;

  return prisma.directionSeoText.findUnique({
    where: { slug },
    select: { title: true, body: true, status: true }
  }).then((entry) => entry?.status === PublishStatus.PUBLISHED ? entry : null)
    .catch(() => null);
}

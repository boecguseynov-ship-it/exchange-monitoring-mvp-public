import { prisma } from "@/lib/db/prisma";

export type PublicWikiEntry = {
  title: string;
  description: string;
  href: string;
  anchor: string | null;
  group: string;
  icon: string;
  position: number;
  status: string;
};

function databaseContentEnabled() {
  return process.env.RATESCOPE_USE_DB_CONTENT !== "0";
}

function publicText(value: string) {
  return value.replace(/RateScope/g, "monik exchange");
}

export async function loadPublicWikiEntries(where: { groups?: readonly string[]; publishedOnly?: boolean } = {}) {
  if (!databaseContentEnabled()) return [];

  const groupWhere = where.groups?.length ? { group: { in: [...where.groups] } } : {};
  const statusWhere = where.publishedOnly ? { status: "PUBLISHED" as const } : {};
  const entries = await prisma.wikiEntry.findMany({
    where: { ...groupWhere, ...statusWhere },
    select: {
      title: true,
      description: true,
      href: true,
      anchor: true,
      group: true,
      icon: true,
      position: true,
      status: true
    },
    orderBy: [{ group: "asc" }, { position: "asc" }, { title: "asc" }]
  });

  return entries.map((entry) => ({
    ...entry,
    title: publicText(entry.title),
    description: publicText(entry.description),
    group: publicText(entry.group)
  }));
}

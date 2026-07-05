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
  return process.env.RATESCOPE_USE_DB_CONTENT === "1";
}

async function hasWikiAnchorColumn() {
  const result = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'WikiEntry'
        AND column_name = 'anchor'
    ) AS "exists"
  `;
  return Boolean(result[0]?.exists);
}

export async function loadPublicWikiEntries(where: { groups?: readonly string[]; publishedOnly?: boolean } = {}) {
  if (!databaseContentEnabled()) return [];

  const anchorAvailable = await hasWikiAnchorColumn();
  const groupWhere = where.groups?.length ? { group: { in: [...where.groups] } } : {};
  const statusWhere = where.publishedOnly ? { status: "PUBLISHED" as const } : {};
  const entries = await prisma.wikiEntry.findMany({
    where: { ...groupWhere, ...statusWhere },
    select: {
      title: true,
      description: true,
      href: true,
      ...(anchorAvailable ? { anchor: true } : {}),
      group: true,
      icon: true,
      position: true,
      status: true
    },
    orderBy: [{ group: "asc" }, { position: "asc" }, { title: "asc" }]
  });

  return entries.map((entry) => ({
    ...entry,
    anchor: "anchor" in entry ? entry.anchor : null
  })) as PublicWikiEntry[];
}

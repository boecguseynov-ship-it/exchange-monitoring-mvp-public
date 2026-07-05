import { defaultFooterWikiLinks, defaultWikiLinks, footerWikiGroups } from "@/lib/default-wiki-links";
import type { WikiGroup, WikiItem } from "@/features/public-content/content";
import { loadPublicWikiEntries } from "@/lib/wiki-entries";

function wikiAnchorHref(anchor?: string | null) {
  return anchor ? `/wiki#${anchor}` : "/wiki";
}

function databaseContentEnabled() {
  return process.env.RATESCOPE_USE_DB_CONTENT === "1";
}

function fallbackFooterWikiLinks() {
  return defaultFooterWikiLinks.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, href: wikiAnchorHref(item.anchor) }))
  }));
}

export async function getFooterWikiLinks(): Promise<WikiGroup[]> {
  if (!databaseContentEnabled()) {
    return fallbackFooterWikiLinks();
  }

  try {
    const storedLinks = await loadPublicWikiEntries({ groups: footerWikiGroups });
    const storedByKey = new Map(storedLinks.map((entry) => [entry.anchor ?? entry.title, entry]));
    const defaultKeys = new Set(defaultWikiLinks.map((link) => link.anchor));
    const defaultTitles = new Set(defaultWikiLinks.map((link) => link.title));

    return footerWikiGroups.map((group) => {
      const fallbackGroup = defaultFooterWikiLinks.find((item) => item.title === group)!;
      const mergedItems: WikiItem[] = [];

      for (const fallback of defaultWikiLinks.filter((link) => link.group === group)) {
        const stored = storedByKey.get(fallback.anchor) ?? storedByKey.get(fallback.title);
        if (stored && stored.status !== "PUBLISHED") continue;
        mergedItems.push({
          title: stored?.title ?? fallback.title,
          description: stored?.description ?? fallback.description,
          href: wikiAnchorHref(stored?.anchor ?? fallback.anchor),
          anchor: stored?.anchor ?? fallback.anchor
        });
      }

      for (const stored of storedLinks) {
        if (
          stored.group !== group ||
          stored.status !== "PUBLISHED" ||
          (stored.anchor && defaultKeys.has(stored.anchor)) ||
          defaultTitles.has(stored.title)
        ) continue;
        mergedItems.push({
          title: stored.title,
          description: stored.description,
          href: wikiAnchorHref(stored.anchor),
          anchor: stored.anchor
        });
      }

      return { title: group, icon: fallbackGroup.icon, items: mergedItems };
    });
  } catch {
    return fallbackFooterWikiLinks();
  }
}

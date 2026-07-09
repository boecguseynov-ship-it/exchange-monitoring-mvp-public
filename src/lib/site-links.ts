import { prisma } from "@/lib/db/prisma";

export type ContactSocialLink = {
  key: string;
  label: string;
  href: string;
  icon: "mail" | "telegram" | "blog" | "github";
  enabled: boolean;
  position: number;
};

export const defaultContactSocialLinks: ContactSocialLink[] = [
  { key: "feedback", label: "Обратная связь", href: "/contacts", icon: "mail", enabled: true, position: 10 },
  { key: "telegram", label: "Telegram", href: "https://t.me/", icon: "telegram", enabled: true, position: 20 },
  { key: "blog", label: "Блог monik exchange", href: "/blog", icon: "blog", enabled: true, position: 30 },
  { key: "github", label: "GitHub", href: "https://github.com/", icon: "github", enabled: true, position: 40 }
];

export const contactSocialLinkGroup = "contactSocial";

function publicLabel(value: string) {
  return value.replace(/RateScope/g, "monik exchange");
}

export async function getContactSocialLinks(includeDisabled = false) {
  try {
    const storedLinks = await prisma.wikiEntry.findMany({
      where: { group: contactSocialLinkGroup },
      select: {
        title: true,
        href: true,
        icon: true,
        status: true,
        position: true
      },
      orderBy: [{ position: "asc" }, { title: "asc" }]
    });
    const storedByKey = new Map(storedLinks.map((link) => [link.icon, link]));

    return defaultContactSocialLinks
      .map((fallback) => {
        const stored = storedByKey.get(fallback.key);
        return {
          key: fallback.key,
          label: publicLabel(stored?.title ?? fallback.label),
          href: stored?.href ?? fallback.href,
          icon: fallback.icon,
          enabled: stored ? stored.status === "PUBLISHED" : fallback.enabled,
          position: stored?.position ?? fallback.position
        };
      })
      .filter((link) => includeDisabled || link.enabled)
      .sort((left, right) => left.position - right.position);
  } catch {
    return defaultContactSocialLinks.filter((link) => includeDisabled || link.enabled);
  }
}

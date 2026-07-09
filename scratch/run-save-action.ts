import { prisma } from "../src/lib/db/prisma";
import { contactSocialLinkGroup } from "../src/lib/site-links";

async function main() {
  const link = await prisma.wikiEntry.findFirst({
    where: { group: "contactSocial", title: "GitHub" }
  });
  console.log("Link in DB before:", link);
  if (!link) return;

  const data = {
    title: "E-mail",
    description: link.icon,
    href: "support@monik.exchange",
    group: contactSocialLinkGroup,
    icon: link.icon,
    position: 40,
    status: "HIDDEN" // Simulating unchecked
  };

  try {
    const updated = await prisma.wikiEntry.update({
      where: { id: link.id },
      data
    });
    console.log("Updated record successfully:", updated);
  } catch (e: any) {
    console.error("Prisma update failed:", e);
  }
}

main().catch(console.error);

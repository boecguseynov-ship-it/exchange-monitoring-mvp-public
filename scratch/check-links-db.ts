import { prisma } from "../src/lib/db/prisma";

async function main() {
  const links = await prisma.wikiEntry.findMany({
    where: { group: "contactSocial" }
  });
  console.log("Contact links in database:", JSON.stringify(links, null, 2));
}

main().catch(console.error);

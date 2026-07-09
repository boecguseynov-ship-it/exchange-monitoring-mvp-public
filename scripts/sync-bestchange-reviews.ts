import fs from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^"|"$/g, "");
  }
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }));
}

loadDotEnv();

async function main() {
  const { prisma } = await import("../src/lib/db/prisma");
  const { loadLiveExchangeProfile } = await import("../src/lib/bestchange/service");
  const { getBestChangeClient } = await import("../src/lib/bestchange/client");

  const requestedLimit = Number(process.argv[2] ?? 0);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : undefined;
  const providerClient = getBestChangeClient();
  const [cachedCurrencies, cachedChangers] = await Promise.all([
    providerClient.getCurrencies(),
    providerClient.getChangers()
  ]);
  const cachedClient = {
    getCurrencies: async () => cachedCurrencies,
    getChangers: async () => cachedChangers,
    getRates: providerClient.getRates
  };
  const before = await prisma.review.count({ where: { source: "BESTCHANGE" } });
  const exchanges = await prisma.exchange.findMany({
    where: { isDemo: false },
    orderBy: { name: "asc" },
    take: limit,
    select: { slug: true, name: true }
  });

  let synced = 0;
  let failed = 0;

  await runPool(exchanges, 2, async (exchange) => {
    try {
      await loadLiveExchangeProfile(exchange.slug, cachedClient);
      synced += 1;
      if (synced % 25 === 0) {
        console.log(`Synced ${synced}/${exchanges.length}`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`Failed ${exchange.name}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  });

  const after = await prisma.review.count({ where: { source: "BESTCHANGE" } });
  await prisma.$disconnect();

  console.log(JSON.stringify({
    exchanges: exchanges.length,
    synced,
    failed,
    importedReviews: after - before,
    totalBestChangeReviews: after
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

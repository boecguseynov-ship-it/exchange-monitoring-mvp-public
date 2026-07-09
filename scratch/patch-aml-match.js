const fs = require('fs');
const servicePath = 'src/lib/bestchange/service.ts';
let service = fs.readFileSync(servicePath, 'utf8');

// Fix loadLocalReviewMatches to load ALL active exchanges and match by normalized name in memory
// instead of relying on exact name match in SQL WHERE clause
const oldQuery = `  const exchanges = await prisma.exchange.findMany({\r\n    where: {\r\n      status: "ACTIVE",\r\n      OR: [\r\n        domains.length ? { domain: { in: domains } } : undefined,\r\n        names.length ? { name: { in: names } } : undefined\r\n      ].filter(Boolean) as Array<Record<string, unknown>>\r\n    },`;

const newQuery = `  const exchanges = await prisma.exchange.findMany({\r\n    where: {\r\n      status: "ACTIVE"\r\n    },`;

if (service.includes(oldQuery)) {
  service = service.replace(oldQuery, newQuery);
  console.log('loadLocalReviewMatches query fixed: now loads all active exchanges and matches in memory');
} else {
  console.log('WARNING: old query pattern not found, trying alternate...');
  // Try without carriage returns  
  const oldQ2 = `  const exchanges = await prisma.exchange.findMany({\n    where: {\n      status: "ACTIVE",\n      OR: [\n        domains.length ? { domain: { in: domains } } : undefined,\n        names.length ? { name: { in: names } } : undefined\n      ].filter(Boolean) as Array<Record<string, unknown>>\n    },`;
  if (service.includes(oldQ2)) {
    service = service.replace(oldQ2, `  const exchanges = await prisma.exchange.findMany({\n    where: {\n      status: "ACTIVE"\n    },`);
    console.log('Fixed with LF version');
  } else {
    console.log('Pattern not found! Dumping surrounding context...');
    const idx = service.indexOf('loadLocalReviewMatches');
    console.log(JSON.stringify(service.slice(idx, idx + 800)));
  }
}

fs.writeFileSync(servicePath, service, 'utf8');

// Verify
const result = fs.readFileSync(servicePath, 'utf8');
const hasOldPattern = result.includes('names.length ? { name: { in: names } }');
console.log('Old name-only pattern removed:', !hasOldPattern);

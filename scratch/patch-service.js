const fs = require('fs');
const path = 'src/lib/bestchange/service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add partnerUrl to LocalExchangeRecord type
content = content.replace(
  /type LocalExchangeRecord = \{([\r\n]+  id: string;[\r\n]+  slug: string;[\r\n]+  name: string;[\r\n]+  domain: string;[\r\n]+)(  description: string;)/,
  'type LocalExchangeRecord = {$1  partnerUrl: string | null;\r\n$2'
);

// 2. Add partnerUrl to first select (loadLocalExchangeBySlug)
const bySlugFnIdx = content.indexOf('async function loadLocalExchangeBySlug');
if (bySlugFnIdx !== -1) {
  const chunk = content.slice(bySlugFnIdx, bySlugFnIdx + 600);
  // exact match: "      domain: true,\r\n      description: true,"
  const fixed = chunk.replace(
    '      domain: true,\r\n      description: true,',
    '      domain: true,\r\n      partnerUrl: true,\r\n      description: true,'
  );
  content = content.slice(0, bySlugFnIdx) + fixed + content.slice(bySlugFnIdx + 600);
}

// 3. Add partnerUrl to second select (loadLocalExchangeForChanger)
const byChangerFnIdx = content.indexOf('async function loadLocalExchangeForChanger');
if (byChangerFnIdx !== -1) {
  const chunk = content.slice(byChangerFnIdx, byChangerFnIdx + 700);
  const fixed = chunk.replace(
    '      domain: true,\r\n      description: true,',
    '      domain: true,\r\n      partnerUrl: true,\r\n      description: true,'
  );
  content = content.slice(0, byChangerFnIdx) + fixed + content.slice(byChangerFnIdx + 700);
}

// 4. Use partnerUrl in return for pure-local exchange (no BestChange changer)
content = content.replace(
  'url: `https://${localExchangeBySlug.domain}`,',
  'url: localExchangeBySlug.partnerUrl ?? `https://${localExchangeBySlug.domain}`,'
);

// 5. Use partnerUrl in return for BestChange changer matched with local exchange
content = content.replace(
  'url: changer.urls.ru ?? Object.values(changer.urls)[0] ?? null,',
  'url: localExchange?.partnerUrl ?? changer.urls.ru ?? Object.values(changer.urls)[0] ?? null,'
);

fs.writeFileSync(path, content, 'utf8');

// Verify
const result = fs.readFileSync(path, 'utf8');
const count = (result.match(/partnerUrl/g) || []).length;
console.log('partnerUrl occurrences:', count);
console.log(count === 5 ? 'SUCCESS' : 'WARNING: expected 5, got ' + count);

const fs = require('fs');

// ===== FIX 1: normalize.ts =====
// Add partnerUrl to LocalExchangeReviewMatch type
// Use local.partnerUrl in url when available (override BestChange ref links)
const normalizePath = 'src/lib/bestchange/normalize.ts';
let normalize = fs.readFileSync(normalizePath, 'utf8');

// Add partnerUrl field to LocalExchangeReviewMatch type
normalize = normalize.replace(
  'export type LocalExchangeReviewMatch = {\n  slug: string;\n  domain?: string;\n  noAml?: boolean;\n  rating: number | null;\n  reviews: number;\n  source?: "local" | "provider";\n};',
  'export type LocalExchangeReviewMatch = {\n  slug: string;\n  domain?: string;\n  noAml?: boolean;\n  partnerUrl?: string | null;\n  rating: number | null;\n  reviews: number;\n  source?: "local" | "provider";\n};'
);

// Use partnerUrl if available, otherwise publicUrl(changer)
normalize = normalize.replace(
  '          url: publicUrl(changer),',
  '          url: local?.partnerUrl || publicUrl(changer),'
);

fs.writeFileSync(normalizePath, normalize, 'utf8');
const nr = fs.readFileSync(normalizePath, 'utf8');
console.log('normalize.ts - partnerUrl in type:', nr.includes('partnerUrl?: string | null'));
console.log('normalize.ts - partnerUrl in url:', nr.includes('local?.partnerUrl || publicUrl(changer)'));

// ===== FIX 2: service.ts - pass partnerUrl through loadLocalReviewMatches =====
const servicePath = 'src/lib/bestchange/service.ts';
let service = fs.readFileSync(servicePath, 'utf8');

// In loadLocalReviewMatches: add partnerUrl to select
service = service.replace(
  '    select: {\r\n      id: true,\r\n      slug: true,\r\n      name: true,\r\n      domain: true,\r\n      insuranceDeposit: true,\r\n      noAml: true\r\n    }',
  '    select: {\r\n      id: true,\r\n      slug: true,\r\n      name: true,\r\n      domain: true,\r\n      partnerUrl: true,\r\n      insuranceDeposit: true,\r\n      noAml: true\r\n    }'
);

// In loadLocalReviewMatches return: add partnerUrl to review match
service = service.replace(
  '      return [[changer.id, {\r\n        slug: exchange.slug,\r\n        domain: exchange.domain,\r\n        noAml: exchange.noAml,\r\n        rating: aggregate?._avg.rating ?? null,\r\n        reviews: aggregate?._count.rating ?? 0',
  '      return [[changer.id, {\r\n        slug: exchange.slug,\r\n        domain: exchange.domain,\r\n        noAml: exchange.noAml,\r\n        partnerUrl: exchange.partnerUrl,\r\n        rating: aggregate?._avg.rating ?? null,\r\n        reviews: aggregate?._count.rating ?? 0'
);

// In loadDatabaseFallbackOffers localReviews map: add partnerUrl
service = service.replace(
  '      return [10_000 + index, {\r\n        slug: exchange.slug,\r\n        noAml: exchange.noAml,\r\n        rating: aggregate?._avg.rating ?? null,\r\n        reviews: aggregate?._count.rating ?? 0\r\n      }];',
  '      return [10_000 + index, {\r\n        slug: exchange.slug,\r\n        noAml: exchange.noAml,\r\n        partnerUrl: exchange.partnerUrl,\r\n        rating: aggregate?._avg.rating ?? null,\r\n        reviews: aggregate?._count.rating ?? 0\r\n      }];'
);

// In loadDatabaseFallbackOffers: also add partnerUrl to changer urls
// (the urls.ru is already set to domain, but we override via local in normalize)
// Also add partnerUrl to the select in loadDatabaseFallbackOffers
service = service.replace(
  '      noAml: true,\r\n      status: true,\r\n      verifiedAt: true,\r\n      createdAt: true\r\n    }\r\n  });\r\n  if (!exchanges.length) return [];',
  '      noAml: true,\r\n      partnerUrl: true,\r\n      status: true,\r\n      verifiedAt: true,\r\n      createdAt: true\r\n    }\r\n  });\r\n  if (!exchanges.length) return [];'
);

fs.writeFileSync(servicePath, service, 'utf8');
const sr = fs.readFileSync(servicePath, 'utf8');
const count = (sr.match(/partnerUrl/g) || []).length;
console.log('service.ts - partnerUrl occurrences:', count, '(expected 9+)');
console.log(count >= 8 ? 'SUCCESS' : 'WARNING: check manually');

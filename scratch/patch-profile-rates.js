const fs = require('fs');
const servicePath = 'src/lib/bestchange/service.ts';
let service = fs.readFileSync(servicePath, 'utf8');

// 1. Add rates to LiveExchangeProfile type
service = service.replace(
  '  localReviews: LiveExchangeLocalReview[];\r\n  externalReviews: LiveExchangeExternalReview[];\r\n};',
  '  localReviews: LiveExchangeLocalReview[];\r\n  externalReviews: LiveExchangeExternalReview[];\r\n  rates?: { fromCode: string; toCode: string; rate: number; minAmount: number; reserve: number }[];\r\n};'
);

service = service.replace(
  '  localReviews: LiveExchangeLocalReview[];\n  externalReviews: LiveExchangeExternalReview[];\n};',
  '  localReviews: LiveExchangeLocalReview[];\n  externalReviews: LiveExchangeExternalReview[];\n  rates?: { fromCode: string; toCode: string; rate: number; minAmount: number; reserve: number }[];\n};'
);

// 2. Load manualRates and override stats labels in loadLiveExchangeProfile
const blockSearch = `    const [localReviewStats, localReviews, importedProviderReviews] = await Promise.all([
      loadLocalReviewStatsByExchangeId(localExchangeBySlug.id),
      loadLocalPublishedReviewsByExchangeId(localExchangeBySlug.id),
      loadImportedProviderReviewsByExchangeId(localExchangeBySlug.id)
    ]);`;

const blockReplace = `    const [localReviewStats, localReviews, importedProviderReviews, manualRates] = await Promise.all([
      loadLocalReviewStatsByExchangeId(localExchangeBySlug.id),
      loadLocalPublishedReviewsByExchangeId(localExchangeBySlug.id),
      loadImportedProviderReviewsByExchangeId(localExchangeBySlug.id),
      prisma.exchangeRate.findMany({ where: { exchangeId: localExchangeBySlug.id, enabled: true } })
    ]);
    const uniqueCurrenciesCount = new Set(manualRates.flatMap((r) => [r.fromCode, r.toCode])).size;`;

if (service.includes(blockSearch)) {
  service = service.replace(blockSearch, blockReplace);
} else {
  const crlfSearch = blockSearch.replace(/\n/g, '\r\n');
  const crlfReplace = blockReplace.replace(/\n/g, '\r\n');
  if (service.includes(crlfSearch)) {
    service = service.replace(crlfSearch, crlfReplace);
  } else {
    console.error('Error: could not find Promise.all block in loadLiveExchangeProfile');
    process.exit(1);
  }
}

// 3. Override label overrides to use manual rates counts
service = service.replace(
  `    const currencyCountLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Всего валют",
      "Валюты",
      "Currencies"
    ]) ?? "направления из фида";`,
  `    const currencyCountLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Всего валют",
      "Валюты",
      "Currencies"
    ]) ?? (manualRates.length > 0 ? String(uniqueCurrenciesCount) : "направления из фида");`
);

service = service.replace(
  `    const ratesCountLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Курсов обмена",
      "Курсы",
      "Rates"
    ]) ?? "ожидает фида";`,
  `    const ratesCountLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Курсов обмена",
      "Курсы",
      "Rates"
    ]) ?? (manualRates.length > 0 ? String(manualRates.length) : "ожидает фида");`
);

// 4. Return rates property in return statement
service = service.replace(
  `      localReviews,
      externalReviews: importedProviderReviews
    };`,
  `      localReviews,
      externalReviews: importedProviderReviews,
      rates: manualRates.map(r => ({ fromCode: r.fromCode, toCode: r.toCode, rate: r.rate, minAmount: r.minAmount, reserve: r.reserve }))
    };`
);

fs.writeFileSync(servicePath, service, 'utf8');
console.log('Successfully updated service.ts profile load for manual rates.');

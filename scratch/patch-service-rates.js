const fs = require('fs');
const servicePath = 'src/lib/bestchange/service.ts';
let service = fs.readFileSync(servicePath, 'utf8');

// Define the loadManualExchangeRates function
const loadManualRatesFn = `export async function loadManualExchangeRates({
  fromCode,
  toCode,
  amount
}: {
  fromCode: string;
  toCode: string;
  amount: number;
}): Promise<NormalizedOffer[]> {
  if (!databaseContentEnabled()) return [];

  const rates = await prisma.exchangeRate.findMany({
    where: {
      fromCode,
      toCode,
      enabled: true,
      exchange: {
        status: ExchangeStatus.ACTIVE
      }
    },
    include: {
      exchange: true
    }
  });

  if (!rates.length) return [];

  const exchangeIds = rates.map((r) => r.exchangeId);
  const reviewAggregate = await prisma.review.groupBy({
    by: ["exchangeId"],
    where: {
      status: ModerationStatus.PUBLISHED,
      exchangeId: { in: exchangeIds }
    },
    _avg: { rating: true },
    _count: { rating: true }
  });
  const reviewsByExchangeId = new Map(reviewAggregate.map((item) => [item.exchangeId, item]));

  const from = findCurrency(localCurrencies, fromCode) || { id: 0, code: fromCode, name: fromCode, kind: "FIAT" as const };
  const to = findCurrency(localCurrencies, toCode) || { id: 0, code: toCode, name: toCode, kind: "FIAT" as const };
  const paymentMethods = offerPaymentMethods(from, to);

  return rates.map((rate) => {
    const exchange = rate.exchange;
    const aggregate = reviewsByExchangeId.get(exchange.id);
    const reviews = aggregate?._count.rating ?? 0;
    const rating = aggregate?._avg.rating ?? null;

    return {
      id: "manual-" + rate.id,
      exchange: {
        name: exchange.name,
        slug: exchange.slug,
        isDemo: exchange.isDemo,
        rating,
        reviews,
        verified: exchange.status === ExchangeStatus.ACTIVE,
        url: exchange.partnerUrl ?? \`https://\${exchange.domain}\`
      },
      from: fromCode,
      to: toCode,
      rate: rate.rate,
      receivedAmount: amount * rate.rate,
      reserve: rate.reserve,
      minAmount: rate.minAmount,
      maxAmount: rate.reserve,
      kyc: exchange.noAml ? "NONE" : "OPTIONAL",
      aml: exchange.noAml ? "NONE" : "STANDARD",
      processing: "AUTOMATIC" as const,
      marks: [] as string[],
      cities: [] as string[],
      paymentMethods,
      updatedAt: rate.updatedAt.toISOString()
    };
  });
}
`;

// Insert loadManualExchangeRates function right before loadPublicOffers
const searchStr = 'export async function loadPublicOffers({';
if (service.includes(searchStr)) {
  service = service.replace(searchStr, loadManualRatesFn + '\n' + searchStr);
  console.log('loadManualExchangeRates function injected successfully');
} else {
  console.error('Error: could not find loadPublicOffers function start');
  process.exit(1);
}

// Modify loadPublicOffers to load manual offers and merge them
const publicOffersBodySearch = `export async function loadPublicOffers({
  fromCode,
  toCode,
  amount,
  client = getBestChangeClient()
}: {
  fromCode: string;
  toCode: string;
  amount: number;
  client?: BestChangeClient;
}) {
  const localOffersPromise = loadLocalOffers({ fromCode, toCode, amount }).catch(() => []);
  const databaseOffersPromise = loadDatabaseFallbackOffers({ fromCode, toCode, amount }).catch(() => []);`;

const publicOffersBodyReplace = `export async function loadPublicOffers({
  fromCode,
  toCode,
  amount,
  client = getBestChangeClient()
}: {
  fromCode: string;
  toCode: string;
  amount: number;
  client?: BestChangeClient;
}) {
  const localOffersPromise = loadLocalOffers({ fromCode, toCode, amount }).catch(() => []);
  const databaseOffersPromise = loadDatabaseFallbackOffers({ fromCode, toCode, amount }).catch(() => []);
  const manualOffersPromise = loadManualExchangeRates({ fromCode, toCode, amount }).catch(() => []);`;

if (service.includes(publicOffersBodySearch)) {
  service = service.replace(publicOffersBodySearch, publicOffersBodyReplace);
  console.log('manualOffersPromise added to loadPublicOffers');
} else {
  // Try with CRLF
  const crlfSearch = publicOffersBodySearch.replace(/\n/g, '\r\n');
  const crlfReplace = publicOffersBodyReplace.replace(/\n/g, '\r\n');
  if (service.includes(crlfSearch)) {
    service = service.replace(crlfSearch, crlfReplace);
    console.log('manualOffersPromise added to loadPublicOffers (CRLF)');
  } else {
    console.error('Error: could not find publicOffers body start');
    process.exit(1);
  }
}

// Update the return blocks inside loadPublicOffers
service = service.replace(
  '  if (!hasBestChangeApiConfig()) {\r\n    const [databaseOffers, localOffers] = await Promise.all([databaseOffersPromise, localOffersPromise]);\r\n    const fallbackOffers = mergePublicOffers(databaseOffers, localOffers);',
  '  if (!hasBestChangeApiConfig()) {\r\n    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);\r\n    const fallbackOffers = mergePublicOffers([...manualOffers, ...databaseOffers], localOffers);'
);

service = service.replace(
  '  if (!hasBestChangeApiConfig()) {\n    const [databaseOffers, localOffers] = await Promise.all([databaseOffersPromise, localOffersPromise]);\n    const fallbackOffers = mergePublicOffers(databaseOffers, localOffers);',
  '  if (!hasBestChangeApiConfig()) {\n    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);\n    const fallbackOffers = mergePublicOffers([...manualOffers, ...databaseOffers], localOffers);'
);

service = service.replace(
  '    const [databaseOffers, localOffers] = await Promise.all([databaseOffersPromise, localOffersPromise]);\r\n    const fallbackOffers = liveOffers.length < 10\r\n      ? mergePublicOffers(databaseOffers, localOffers)\r\n      : databaseOffers;\r\n\r\n    return {\r\n      data: mergePublicOffers(liveOffers, fallbackOffers),',
  '    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);\r\n    const fallbackOffers = liveOffers.length < 10\r\n      ? mergePublicOffers(databaseOffers, localOffers)\r\n      : databaseOffers;\r\n\r\n    return {\r\n      data: mergePublicOffers([...liveOffers, ...manualOffers], fallbackOffers),'
);

service = service.replace(
  '    const [databaseOffers, localOffers] = await Promise.all([databaseOffersPromise, localOffersPromise]);\n    const fallbackOffers = liveOffers.length < 10\n      ? mergePublicOffers(databaseOffers, localOffers)\n      : databaseOffers;\n\n    return {\n      data: mergePublicOffers(liveOffers, fallbackOffers),',
  '    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);\n    const fallbackOffers = liveOffers.length < 10\n      ? mergePublicOffers(databaseOffers, localOffers)\n      : databaseOffers;\n\n    return {\n      data: mergePublicOffers([...liveOffers, ...manualOffers], fallbackOffers),'
);

service = service.replace(
  '  } catch (error) {\r\n    const [databaseOffers, localOffers] = await Promise.all([databaseOffersPromise, localOffersPromise]);\r\n    const fallbackOffers = mergePublicOffers(databaseOffers, localOffers);',
  '  } catch (error) {\r\n    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);\r\n    const fallbackOffers = mergePublicOffers([...manualOffers, ...databaseOffers], localOffers);'
);

service = service.replace(
  '  } catch (error) {\n    const [databaseOffers, localOffers] = await Promise.all([databaseOffersPromise, localOffersPromise]);\n    const fallbackOffers = mergePublicOffers(databaseOffers, localOffers);',
  '  } catch (error) {\n    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);\n    const fallbackOffers = mergePublicOffers([...manualOffers, ...databaseOffers], localOffers);'
);

fs.writeFileSync(servicePath, service, 'utf8');
console.log('Completed patching service.ts for manual rates.');

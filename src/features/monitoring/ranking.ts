export type RankedOfferInput = {
  id: string;
  isDemo?: boolean;
  rate: number;
  feePercent: number;
  feeFixed: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  updatedAt: Date;
};

export type RankedOffer = RankedOfferInput & {
  receivedAmount: number;
};

const MAX_OFFER_AGE_MS = 15 * 60 * 1000;

export function rankOffers(
  offers: RankedOfferInput[],
  amount: number,
  now = new Date()
): RankedOffer[] {
  return offers
    .filter((offer) => amount >= offer.minAmount && amount <= offer.maxAmount)
    .filter((offer) => now.getTime() - offer.updatedAt.getTime() <= MAX_OFFER_AGE_MS)
    .map((offer) => {
      const amountAfterPercentFee = amount * (1 - offer.feePercent / 100);
      const receivedAmount = Math.max(
        0,
        amountAfterPercentFee * offer.rate - offer.feeFixed
      );

      return { ...offer, receivedAmount };
    })
    .filter((offer) => offer.receivedAmount <= offer.reserve)
    .sort((left, right) => right.receivedAmount - left.receivedAmount);
}

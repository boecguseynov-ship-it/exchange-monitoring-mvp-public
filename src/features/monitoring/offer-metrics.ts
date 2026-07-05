export type OfferMetricInput = {
  receivedAmount: number;
  reserve: number;
};

export function formatOfferUpdatedTime(updatedAt?: string) {
  if (!updatedAt) return "—";

  return new Date(updatedAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow"
  });
}

export function summarizeOffers(offers: OfferMetricInput[]) {
  if (offers.length === 0) {
    return {
      count: 0,
      bestReceivedAmount: 0,
      averageReceivedAmount: 0,
      totalReserve: 0
    };
  }

  const totals = offers.reduce(
    (result, offer) => ({
      receivedAmount: result.receivedAmount + offer.receivedAmount,
      reserve: result.reserve + offer.reserve
    }),
    { receivedAmount: 0, reserve: 0 }
  );

  return {
    count: offers.length,
    bestReceivedAmount: Math.max(
      ...offers.map((offer) => offer.receivedAmount)
    ),
    averageReceivedAmount: totals.receivedAmount / offers.length,
    totalReserve: totals.reserve
  };
}

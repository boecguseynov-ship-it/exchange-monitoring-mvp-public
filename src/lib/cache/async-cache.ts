type CacheEntry<T> = {
  value: T;
  freshUntil: number;
  staleUntil: number;
};

type CacheOptions = {
  ttlMs: number;
  staleMs: number;
};

export function createAsyncCache({
  now = () => Date.now(),
  maxEntries = 500
}: {
  now?: () => number;
  maxEntries?: number;
} = {}) {
  const entries = new Map<string, CacheEntry<unknown>>();
  const inFlight = new Map<string, Promise<unknown>>();

  function prune() {
    const currentTime = now();
    for (const [key, entry] of entries) {
      if (entry.staleUntil < currentTime) entries.delete(key);
    }
    while (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) break;
      entries.delete(oldestKey);
    }
  }

  async function get<T>(
    key: string,
    loader: () => Promise<T>,
    { ttlMs, staleMs }: CacheOptions
  ): Promise<T> {
    const currentTime = now();
    const cached = entries.get(key) as CacheEntry<T> | undefined;
    if (cached?.freshUntil && cached.freshUntil > currentTime) return cached.value;

    const pending = inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const refresh = loader()
      .then((value) => {
        prune();
        const loadedAt = now();
        entries.set(key, {
          value,
          freshUntil: loadedAt + ttlMs,
          staleUntil: loadedAt + ttlMs + staleMs
        });
        return value;
      })
      .catch((error) => {
        if (cached && cached.staleUntil >= now()) return cached.value;
        throw error;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, refresh);
    return refresh;
  }

  return { get };
}

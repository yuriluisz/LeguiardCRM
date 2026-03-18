type GetJsonOptions = {
  cacheMs?: number;
};

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const MAX_CACHE_ENTRIES = 200;
const inflightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, CacheEntry>();

function pruneResponseCache(now: number) {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) {
      responseCache.delete(key);
    }
  }

  if (responseCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const overflow = responseCache.size - MAX_CACHE_ENTRIES;
  let removed = 0;
  for (const key of responseCache.keys()) {
    responseCache.delete(key);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

export async function getJsonWithDedupe<T>(
  url: string,
  options?: GetJsonOptions
): Promise<T> {
  const cacheMs = options?.cacheMs ?? 0;
  const now = Date.now();

  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const pending = inflightRequests.get(url);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha na requisicao (${response.status})`);
    }

    const payload = (await response.json()) as T;
    if (cacheMs > 0) {
      responseCache.set(url, {
        value: payload,
        expiresAt: Date.now() + cacheMs,
      });
      pruneResponseCache(Date.now());
    }

    return payload;
  })();

  inflightRequests.set(url, request as Promise<unknown>);

  try {
    return await request;
  } finally {
    inflightRequests.delete(url);
  }
}

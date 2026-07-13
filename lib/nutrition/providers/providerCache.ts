import { createHash } from 'node:crypto';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type ProviderCacheOutcome = 'hit' | 'miss' | 'coalesced';

const entries = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function buildProviderCacheKey(namespace: string, input: unknown) {
  const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return `${namespace}:${digest}`;
}

export async function withProviderCache<T>(args: {
  key: string;
  ttlMs: number;
  negativeTtlMs?: number;
  load: () => Promise<T | null>;
}): Promise<{ value: T | null; outcome: ProviderCacheOutcome }> {
  const now = Date.now();
  const cached = entries.get(args.key) as CacheEntry<T | null> | undefined;
  if (cached && cached.expiresAt > now) {
    return { value: cached.value, outcome: 'hit' };
  }
  if (cached) entries.delete(args.key);

  const existing = inFlight.get(args.key) as Promise<T | null> | undefined;
  if (existing) {
    return { value: await existing, outcome: 'coalesced' };
  }

  const request = args.load();
  inFlight.set(args.key, request);

  try {
    const value = await request;
    const ttl = value === null ? args.negativeTtlMs ?? 0 : args.ttlMs;
    if (ttl > 0) {
      entries.set(args.key, { value, expiresAt: Date.now() + ttl });
    }
    return { value, outcome: 'miss' };
  } finally {
    inFlight.delete(args.key);
  }
}

export function resetProviderCaches() {
  entries.clear();
  inFlight.clear();
}

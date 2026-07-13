import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildProviderCacheKey, resetProviderCaches, withProviderCache } from '@/lib/nutrition/providers/providerCache';

afterEach(() => {
  resetProviderCaches();
  vi.useRealTimers();
});

describe('nutrition provider cache', () => {
  it('hashes query text and never places secrets or raw user text in a cache key', () => {
    const key = buildProviderCacheKey('calorie-api:v1:search', { query: 'private meal query', apiKey: 'secret' });
    expect(key).toMatch(/^calorie-api:v1:search:[a-f0-9]{64}$/);
    expect(key).not.toContain('private meal query');
    expect(key).not.toContain('secret');
  });

  it('returns cache hits within the positive TTL', async () => {
    const load = vi.fn().mockResolvedValue({ name: 'banana' });
    const first = await withProviderCache({ key: 'test:positive', ttlMs: 1_000, load });
    const second = await withProviderCache({ key: 'test:positive', ttlMs: 1_000, load });
    expect(first.outcome).toBe('miss');
    expect(second.outcome).toBe('hit');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('coalesces identical in-flight provider requests', async () => {
    let resolveLoad: ((value: { name: string }) => void) | null = null;
    const load = vi.fn(() => new Promise<{ name: string }>((resolve) => { resolveLoad = resolve; }));
    const first = withProviderCache({ key: 'test:coalesce', ttlMs: 1_000, load });
    const second = withProviderCache({ key: 'test:coalesce', ttlMs: 1_000, load });
    resolveLoad?.({ name: 'rice' });
    expect((await first).value).toEqual({ name: 'rice' });
    expect((await second).outcome).toBe('coalesced');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('only caches null results when a negative TTL is explicitly supplied', async () => {
    const uncachedLoad = vi.fn().mockResolvedValue(null);
    await withProviderCache({ key: 'test:no-negative', ttlMs: 1_000, load: uncachedLoad });
    await withProviderCache({ key: 'test:no-negative', ttlMs: 1_000, load: uncachedLoad });
    expect(uncachedLoad).toHaveBeenCalledTimes(2);

    const cachedLoad = vi.fn().mockResolvedValue(null);
    await withProviderCache({ key: 'test:negative', ttlMs: 1_000, negativeTtlMs: 100, load: cachedLoad });
    await withProviderCache({ key: 'test:negative', ttlMs: 1_000, negativeTtlMs: 100, load: cachedLoad });
    expect(cachedLoad).toHaveBeenCalledTimes(1);
  });

  it('does not cache provider failures', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce({ name: 'apple' });
    await expect(withProviderCache({ key: 'test:error', ttlMs: 1_000, load })).rejects.toThrow('provider unavailable');
    expect((await withProviderCache({ key: 'test:error', ttlMs: 1_000, load })).value).toEqual({ name: 'apple' });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

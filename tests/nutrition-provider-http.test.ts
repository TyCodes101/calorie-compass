import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { NutritionProviderError, requestProviderJson } from '@/lib/nutrition/providers/providerHttp';

const schema = z.object({ ok: z.boolean() });

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function request(overrides: Partial<Parameters<typeof requestProviderJson<{ ok: boolean }>>[0]> = {}) {
  return requestProviderJson({
    url: 'https://calorieapiadmin.com/api/v1/search/foods?q=banana',
    allowedOrigins: ['https://calorieapiadmin.com'],
    schema,
    timeoutMs: 1_000,
    retries: 0,
    ...overrides,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('provider HTTP client', () => {
  it('rejects insecure and arbitrary origins before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(request({ url: 'http://calorieapiadmin.com/api/v1/search/foods' })).rejects.toMatchObject({ category: 'invalid_request' });
    await expect(request({ url: 'https://evil.example/api/v1/search/foods' })).rejects.toMatchObject({ category: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'invalid_request'],
    [401, 'unauthorized'],
    [402, 'quota_exhausted'],
    [403, 'forbidden'],
    [429, 'rate_limited'],
    [503, 'provider_unavailable'],
  ] as const)('maps HTTP %s to a sanitized %s error', async (status, category) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ secret: 'provider body' }, status)));
    await expect(request()).rejects.toMatchObject({ category, status });
  });

  it('handles a documented 404 as a normal miss when requested', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'missing' }, 404)));
    expect(await request({ notFoundIsNull: true })).toBeNull();
  });

  it('rejects malformed JSON, empty bodies, unexpected content types, and schema mismatches', async () => {
    const responses = [
      new Response('{bad', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response('', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      jsonResponse({ ok: 'yes' }),
    ];
    const fetchMock = vi.fn();
    for (const response of responses) fetchMock.mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', fetchMock);

    for (let index = 0; index < responses.length; index += 1) {
      await expect(request()).rejects.toMatchObject({ category: 'invalid_payload' });
    }
  });

  it('aborts a request after the bounded timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));
    const pending = request({ timeoutMs: 500 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toMatchObject({ category: 'timeout' });
  });

  it('bounds transient retries and never includes credentials in errors or logs', async () => {
    vi.useFakeTimers();
    const secret = 'provider-secret-sentinel';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: secret }, 503));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', fetchMock);
    const pending = request({
      retries: 1,
      init: { headers: { 'X-API-Key': secret } },
    }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    const error = await pending;
    expect(error).toBeInstanceOf(NutritionProviderError);
    expect(JSON.stringify(error)).not.toContain(secret);
    expect(error.message).not.toContain(secret);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it('does not violate a long provider Retry-After window', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      { detail: 'slow down' },
      429,
      { 'retry-after': '60' },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request({ retries: 1 })).rejects.toMatchObject({ category: 'rate_limited' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetProviderCaches } from '@/lib/nutrition/providers/providerCache';
import { lookupUpcDatabaseMetadata } from '@/lib/nutrition/providers/upcDatabase';

describe('UPC Database metadata provider', () => {
  beforeEach(() => {
    vi.stubEnv('UPC_DATABASE_ENABLED', 'true');
    vi.stubEnv('UPC_DATABASE_API_KEY', 'upc-test-secret');
    resetProviderCaches();
  });

  afterEach(() => {
    resetProviderCaches();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('preserves leading zeros and returns metadata without nutrition', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      barcode: '012345678905',
      title: 'Creamy Crisp Protein Bar',
      brand: 'Example Foods',
      category: 'Food > Snack Bars',
      metadata: { quantity: '1', size: '55 g' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await lookupUpcDatabaseMetadata(' 01234-5678905 ');
    expect(result).toEqual({
      barcode: '012345678905',
      title: 'Creamy Crisp Protein Bar',
      brand: 'Example Foods',
      manufacturer: null,
      category: 'Food > Snack Bars',
      packageDescription: '1 55 g',
    });
    expect(result).not.toHaveProperty('calories');
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get('authorization')).toBe('Bearer upc-test-secret');
    expect(JSON.stringify(result)).not.toContain('upc-test-secret');
  });

  it('rejects a mismatched response barcode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true, barcode: '999999999999', title: 'Wrong product',
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch);

    expect(await lookupUpcDatabaseMetadata('012345678905')).toBeNull();
  });

  it('does not request metadata when disabled', async () => {
    vi.stubEnv('UPC_DATABASE_ENABLED', 'false');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    expect(await lookupUpcDatabaseMetadata('012345678905')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('short-caches a confirmed not-found response but not provider failures', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    expect(await lookupUpcDatabaseMetadata('012345678905')).toBeNull();
    expect(await lookupUpcDatabaseMetadata('012345678905')).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

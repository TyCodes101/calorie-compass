import { afterEach, describe, expect, it, vi } from 'vitest';

import { fatSecretProvider, resetFatSecretProviderState } from '@/lib/nutrition/providers/fatsecret';
import { resetProviderCaches } from '@/lib/nutrition/providers/providerCache';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function lookup(text: string) {
  return fatSecretProvider.lookup({
    text,
    mealType: 'snack',
    normalizedQuery: normalizeFoodQuery(text),
  });
}

function proteinBarFood(brand = 'Barebells') {
  return {
    food_id: '1001',
    food_name: 'Creamy Crisp Protein Bar',
    brand_name: brand,
    food_type: 'Brand',
    servings: {
      serving: {
        serving_id: '2001',
        serving_description: '1 bar',
        measurement_description: 'serving',
        metric_serving_amount: '55',
        metric_serving_unit: 'g',
        number_of_units: '1',
        calories: '200',
        protein: '20',
        carbohydrate: '18',
        fat: '7',
        fiber: '2',
        sugar: '2',
        sodium: '150',
        is_default: '1',
      },
    },
  };
}

afterEach(() => {
  resetFatSecretProviderState();
  resetProviderCaches();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('FatSecret provider', () => {
  it('is optional and never calls the network without both credentials', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', '');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(fatSecretProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'fatsecret_missing_credentials' });
    expect(await lookup('one protein bar')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps one branded bar to one provider serving and applies a two-bar request exactly twice', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-test');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-test');
    vi.stubEnv('FATSECRET_SCOPE', 'premier');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-test', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({
        foods_search: { results: { food: [proteinBarFood()] } },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const one = await lookup('one Barebells creamy crisp protein bar');
    expect(one?.items[0]).toMatchObject({
      food_name: 'Barebells Creamy Crisp Protein Bar',
      quantity: 1,
      unit: 'bar',
      calories: 200,
      protein: 20,
      provider_used: 'fatsecret',
      confidence_label: 'Matched',
    });

    const two = await lookup('two Barebells creamy crisp protein bars');
    expect(two?.items[0]).toMatchObject({ quantity: 2, unit: 'bar', calories: 400, protein: 40 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the documented v1 text-search endpoint for a Basic-only client', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-basic');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-basic');
    vi.stubEnv('FATSECRET_SCOPE', 'basic');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-basic', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({ foods: { food: [proteinBarFood()] } }));
    vi.stubGlobal('fetch', fetchMock);

    expect((await lookup('one Barebells creamy crisp protein bar'))?.items[0]).toMatchObject({
      food_name: 'Barebells Creamy Crisp Protein Bar',
      calories: 200,
      provider_used: 'fatsecret',
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/rest/foods/search/v1');
  });

  it('falls back securely to Basic v1 search when an unentitled Premier scope is rejected', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-fallback');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-fallback');
    vi.stubEnv('FATSECRET_SCOPE', 'premier');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'invalid_scope' }, 400))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-basic-fallback', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({ foods: { food: [proteinBarFood()] } }));
    vi.stubGlobal('fetch', fetchMock);

    expect((await lookup('one Barebells creamy crisp protein bar'))?.items[0]).toMatchObject({
      food_name: 'Barebells Creamy Crisp Protein Bar',
      provider_used: 'fatsecret',
    });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/rest/foods/search/v1');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('scope=premier');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('scope=basic');
  });

  it('accepts a bounded product typo while retaining strict brand identity', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-typo');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-typo');
    vi.stubEnv('FATSECRET_SCOPE', 'premier');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-typo', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({
        foods_search: { results: { food: [{
          ...proteinBarFood('Cheetos'),
          food_name: 'Flamin Hot Cheetos',
        }] } },
      }));
    vi.stubGlobal('fetch', fetchMock);

    expect((await lookup('hot cheeots'))?.items[0]).toMatchObject({
      food_name: 'Cheetos Flamin Hot Cheetos',
      provider_used: 'fatsecret',
    });
  });

  it('rejects a candidate whose brand does not agree with the requested brand', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-mismatch');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-mismatch');
    vi.stubEnv('FATSECRET_SCOPE', 'premier');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-mismatch', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({
        foods_search: { results: { food: [proteinBarFood('Unrelated Brand')] } },
      }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await lookup('one Barebells creamy crisp protein bar')).toBeNull();
  });

  it('preserves a leading-zero UPC and uses the documented GTIN-13 barcode endpoint', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-barcode');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-barcode');
    vi.stubEnv('FATSECRET_SCOPE', 'basic barcode');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-barcode', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({ food: proteinBarFood() }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fatSecretProvider.lookupBarcode?.({ barcode: '012345678905', mealType: 'snack' });
    expect(result?.items[0]).toMatchObject({ calories: 200, provider_used: 'fatsecret' });
    const requestedUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(requestedUrl.pathname).toBe('/rest/food/barcode/find-by-id/v2');
    expect(requestedUrl.searchParams.get('barcode')).toBe('0012345678905');
  });

  it('treats FatSecret barcode error 211 as a normal short-lived miss', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-barcode-miss');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-barcode-miss');
    vi.stubEnv('FATSECRET_SCOPE', 'basic barcode');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-barcode-miss', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: '211', message: 'No food found' } }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await fatSecretProvider.lookupBarcode?.({ barcode: '012345678905', mealType: 'snack' })).toBeNull();
    expect(await fatSecretProvider.lookupBarcode?.({ barcode: '012345678905', mealType: 'snack' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects structurally valid but nutritionally implausible servings', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-invalid');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-invalid');
    vi.stubEnv('FATSECRET_SCOPE', 'premier');
    const invalid = proteinBarFood();
    invalid.servings.serving.calories = '200';
    invalid.servings.serving.protein = '80';
    invalid.servings.serving.carbohydrate = '80';
    invalid.servings.serving.fat = '40';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-invalid', expires_in: 3_600 }))
      .mockResolvedValueOnce(jsonResponse({ foods_search: { results: { food: [invalid] } } }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await lookup('one Barebells creamy crisp protein bar')).toBeNull();
  });
});

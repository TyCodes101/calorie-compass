import { afterEach, describe, expect, it, vi } from 'vitest';

import { calorieApiProvider } from '@/lib/nutrition/providers/calorieApi';
import { resetProviderCaches } from '@/lib/nutrition/providers/providerCache';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function lookup(text: string) {
  return calorieApiProvider.lookup({ text, mealType: 'snack', normalizedQuery: normalizeFoodQuery(text) });
}

function validProteinBar(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: 'Creamy Crisp Protein Bar',
    brand_name: 'Barebells',
    category_name: 'Protein Bars',
    is_verified: true,
    serving_size: 55,
    serving_unit: 'g',
    calories_100g: 363.636,
    protein_100g: 36.364,
    carbs_100g: 32.727,
    fat_100g: 12.727,
    fiber_100g: 3.636,
    sugar_100g: 3.636,
    ...overrides,
  };
}

afterEach(() => {
  resetProviderCaches();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Calorie API provider', () => {
  it('is disabled safely when CALORIE_API_KEY is missing', async () => {
    vi.stubEnv('CALORIE_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(calorieApiProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'calorie_api_missing_key' });
    expect(await lookup('banana')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('scales provider per-100g nutrition to one natural serving exactly once', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [validProteinBar()], total: 1, skip: 0, limit: 10 }));
    vi.stubGlobal('fetch', fetchMock);

    const one = await lookup('one Barebells creamy crisp protein bar');
    expect(one?.items[0]).toMatchObject({
      food_name: 'Barebells Creamy Crisp Protein Bar',
      quantity: 1,
      unit: 'bar',
      provider_used: 'calorie-api',
      confidence_label: 'Matched',
    });
    expect(one?.items[0]?.calories).toBeCloseTo(200, 1);
    expect(one?.items[0]?.protein).toBeCloseTo(20, 1);

    const two = await lookup('two Barebells creamy crisp protein bars');
    expect(two?.items[0]?.quantity).toBe(2);
    expect(two?.items[0]?.calories).toBeCloseTo(400, 1);
    expect(two?.items[0]?.protein).toBeCloseTo(40, 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops malformed items but can normalize another valid result in the same response', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: [
        { id: 1, name: '', calories_100g: 'broken' },
        validProteinBar(),
      ],
      total: 2,
      skip: 0,
      limit: 10,
    }));
    vi.stubGlobal('fetch', fetchMock);

    expect((await lookup('one Barebells creamy crisp protein bar'))?.items).toHaveLength(1);
  });

  it('coerces documented numeric strings without accepting corrupted values', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const stringRecord = validProteinBar({
      serving_size: '55',
      calories_100g: '363.636',
      protein_100g: '36.364',
      carbs_100g: '32.727',
      fat_100g: '12.727',
      fiber_100g: '3.636',
      sugar_100g: '3.636',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [stringRecord], total: '1', skip: '0', limit: '10' })));
    expect((await lookup('one Barebells creamy crisp protein bar'))?.items[0]?.calories).toBeCloseTo(200, 1);
  });

  it('rejects a provider-verified record whose macros are implausible', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: [{
        id: 7,
        name: 'Banana',
        brand_name: null,
        is_verified: true,
        serving_size: 100,
        serving_unit: 'g',
        calories_100g: 340,
        protein_100g: 11,
        carbs_100g: 54,
        fat_100g: 35,
        fiber_100g: 1,
        sugar_100g: 10,
      }],
      total: 1,
      skip: 0,
      limit: 10,
    }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await lookup('banana')).toBeNull();
  });

  it('rejects a candidate whose explicit brand conflicts with the query', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      data: [validProteinBar({ brand_name: 'Unrelated Brand' })],
      total: 1,
      skip: 0,
      limit: 10,
    })));

    expect(await lookup('one Barebells creamy crisp protein bar')).toBeNull();
  });

  it('uses broad provider recall but accepts only bounded typo-compatible identity', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: [validProteinBar({ name: 'Flamin Hot Cheetos', brand_name: 'Cheetos' })],
      total: 1,
      skip: 0,
      limit: 10,
    }));
    vi.stubGlobal('fetch', fetchMock);

    expect((await lookup('hot cheeots'))?.items[0]).toMatchObject({
      food_name: 'Cheetos Flamin Hot Cheetos',
      provider_used: 'calorie-api',
    });
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get('match_mode')).toBe('any');
  });

  it('uses X-API-Key only on the server request and returns no credential fields', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [validProteinBar()], total: 1, skip: 0, limit: 10 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookup('one Barebells creamy crisp protein bar');
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('X-API-Key')).toBe('calorie-test-key');
    expect(headers.has('X-API-Usage-Type')).toBe(false);
    expect(JSON.stringify(result)).not.toContain('calorie-test-key');
  });

  it('resolves a leading-zero barcode without numeric conversion', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      barcode: '012345678905',
      product: { name: 'Protein Bar', brand: 'Example Brand', category: 'Snacks' },
      serving: { label: '1 bar (50 g)', quantity: 1, unit: 'bar' },
      nutrition_per_100g: {
        energy_kcal: 400,
        protein_g: 40,
        carbohydrates_g: 30,
        fat_g: 13.33,
      },
      nutrition_per_serving: {
        energy_kcal: 200,
        protein_g: 20,
        carbohydrates_g: 15,
        fat_g: 6.67,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await calorieApiProvider.lookupBarcode?.({ barcode: '012345678905', mealType: 'snack' });
    expect(result?.items[0]).toMatchObject({ calories: 200, provider_used: 'calorie-api' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/search/barcode/012345678905');
  });

  it('treats a documented barcode 404 as a cacheable normal miss', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: 'not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    expect(await calorieApiProvider.lookupBarcode?.({ barcode: '012345678905', mealType: 'snack' })).toBeNull();
    expect(await calorieApiProvider.lookupBarcode?.({ barcode: '012345678905', mealType: 'snack' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches details only from the fixed food-details path and caches the normalized record', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validProteinBar()));
    vi.stubGlobal('fetch', fetchMock);

    const first = await calorieApiProvider.getFoodDetails?.({ providerFoodId: '42', mealType: 'snack' });
    const second = await calorieApiProvider.getFoodDetails?.({ providerFoodId: '42', mealType: 'snack' });
    expect(first?.items[0]).toMatchObject({ provider_used: 'calorie-api', source_name: 'Calorie API database' });
    expect(second?.items[0]?.calories).toBe(first?.items[0]?.calories);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://calorieapiadmin.com/api/v1/foods/42');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds provider query length before constructing the search URL', async () => {
    vi.stubEnv('CALORIE_API_KEY', 'calorie-test-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], total: 0, skip: 0, limit: 10 }));
    vi.stubGlobal('fetch', fetchMock);
    const longQuery = 'a'.repeat(500);
    await calorieApiProvider.lookup({
      text: longQuery,
      mealType: 'snack',
      normalizedQuery: {
        rawText: longQuery,
        normalizedText: longQuery,
        searchText: longQuery,
        matchedQuery: longQuery,
        quantity: 1,
        quantityUnit: null,
        unitHint: null,
        brandHint: null,
      },
    });
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get('q')).toHaveLength(180);
    expect(requestedUrl.searchParams.get('limit')).toBe('10');
  });
});

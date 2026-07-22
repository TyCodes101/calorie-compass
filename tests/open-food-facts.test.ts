import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openFoodFactsProvider } from '@/lib/nutrition/providers/openFoodFacts';
import { resetProviderCaches } from '@/lib/nutrition/providers/providerCache';

const barcode = '012345678905';

function jsonResponse(payload: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    code: barcode,
    product_name: 'Creamy Crisp Protein Bar',
    brands: 'Example Foods',
    serving_size: '1 bar (55 g)',
    serving_quantity: 55,
    ingredients_text: 'Milk protein, cocoa, sweetener',
    completeness: 0.95,
    last_modified_t: Math.floor(Date.now() / 1_000),
    nutriments: {
      'energy-kcal_serving': 200,
      proteins_serving: 20,
      carbohydrates_serving: 18,
      fat_serving: 7,
      fiber_serving: 3,
      sugars_serving: 2,
      sodium_serving: 0.18,
    },
    ...overrides,
  };
}

describe('Open Food Facts provider', () => {
  beforeEach(() => {
    vi.stubEnv('OPEN_FOOD_FACTS_ENABLED', 'true');
    vi.stubEnv('OPEN_FOOD_FACTS_CONTACT', 'https://github.com/TyCodes101/calorie-compass');
    resetProviderCaches();
  });

  afterEach(() => {
    resetProviderCaches();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('normalizes a current v3 per-serving barcode response without rescaling it', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'success', product: product() }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' });

    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      food_name: 'Example Foods Creamy Crisp Protein Bar',
      quantity: 1,
      unit: 'bar',
      calories: 200,
      protein: 20,
      sodium: 180,
      source_name: 'Open Food Facts community database',
      provider_used: 'open-food-facts',
      sourceId: barcode,
    });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get('user-agent')).toMatch(/^MacroMesh\/1\.0/);
    expect(JSON.stringify(result)).not.toContain('ingredients_text');
  });

  it('scales per-100g nutrition exactly once using provider serving weight', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'success',
      product: product({
        nutriments: {
          'energy-kcal_100g': 360,
          proteins_100g: 36,
          carbohydrates_100g: 32,
          fat_100g: 12,
          salt_100g: 1,
        },
      }),
    })) as unknown as typeof fetch);

    const result = await openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' });
    expect(result?.items[0]).toMatchObject({
      quantity: 1,
      unit: 'bar',
      calories: 198,
      protein: 19.8,
      carbs: 17.6,
      fat: 6.6,
      sodium: 220,
    });
  });

  it('converts kilojoules and tolerates nullable optional tag arrays', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'success',
      product: product({
        allergens_tags: null,
        data_quality_tags: null,
        nutriments: {
          'energy-kj_serving': 836.8,
          proteins_serving: 20,
          carbohydrates_serving: 18,
          fat_serving: 7,
        },
      }),
    })) as unknown as typeof fetch);

    const result = await openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' });
    expect(result?.items[0]?.calories).toBeCloseTo(200, 3);
  });

  it('rejects malformed or implausible nutrition instead of inventing a result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'success',
      product: product({
        nutriments: {
          'energy-kcal_serving': -10,
          proteins_serving: 20,
          carbohydrates_serving: 18,
          fat_serving: 7,
        },
      }),
    })) as unknown as typeof fetch);

    expect(await openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' })).toBeNull();
  });

  it('treats a confirmed 404 as a normal miss and short-lived negative cache entry', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'failure' }, 404));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    expect(await openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' })).toBeNull();
    expect(await openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fans generic and restaurant text queries into the bounded provider search', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ count: 0, products: [] }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const baseQuery = {
      rawText: 'banana', normalizedText: 'banana', searchText: 'banana', matchedQuery: 'banana',
      quantity: 1, quantityUnit: null, unitHint: null, brandHint: null,
    };

    expect(await openFoodFactsProvider.lookup({ mealType: 'snack', normalizedQuery: baseQuery, text: 'banana' })).toBeNull();
    expect(await openFoodFactsProvider.lookup({
      mealType: 'snack', text: "McDonald's fries", normalizedQuery: {
        ...baseQuery, rawText: "McDonald's fries", normalizedText: "McDonald's fries", searchText: "McDonald's fries",
        matchedQuery: "McDonald's fries", brandHint: "McDonald's",
      },
    })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((call) => String(call[0]).includes('/cgi/search.pl'))).toBe(true);
  });

  it('searches only eligible branded packaged foods and drops invalid or wrong-brand records', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      count: 3,
      products: [
        { code: '111111111111', product_name: 'Creamy Crisp Protein Bar', brands: 'Wrong Brand', nutriments: {} },
        { code: '222222222222', product_name: '', brands: 'Example Foods', nutriments: {} },
        product(),
      ],
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const query = {
      rawText: 'Example Foods creamy crisp protein bar',
      normalizedText: 'Example Foods creamy crisp protein bar',
      searchText: 'Example Foods creamy crisp protein bar',
      matchedQuery: 'Example Foods creamy crisp protein bar',
      quantity: 1,
      quantityUnit: 'bar',
      unitHint: 'bar',
      brandHint: 'Example Foods',
    };

    const result = await openFoodFactsProvider.lookup({ mealType: 'snack', normalizedQuery: query, text: query.rawText });
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      food_name: 'Example Foods Creamy Crisp Protein Bar',
      provider_used: 'open-food-facts',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/cgi/search.pl');
  });

  it('does not negative-cache rate limits as product misses', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'rate limited' }, 429));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' })).rejects.toMatchObject({ category: 'rate_limited' });
    await expect(openFoodFactsProvider.lookupBarcode?.({ barcode, mealType: 'snack' })).rejects.toMatchObject({ category: 'rate_limited' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

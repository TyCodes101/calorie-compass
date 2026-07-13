import { afterEach, describe, expect, it, vi } from 'vitest';

import { usdaProvider } from '@/lib/nutrition/providers/usda';

const brandedFood = {
  fdcId: 123,
  gtinUpc: '012345678905',
  description: 'CREAMY CRISP PROTEIN BAR',
  brandOwner: 'EXAMPLE FOODS',
  dataType: 'Branded',
  servingSize: 55,
  servingSizeUnit: 'g',
  householdServingFullText: '1 bar (55 g)',
  foodNutrients: [
    { nutrientName: 'Energy', nutrientNumber: '1008', unitName: 'KCAL', value: 360 },
    { nutrientName: 'Protein', nutrientNumber: '1003', unitName: 'G', value: 36 },
    { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '1005', unitName: 'G', value: 32 },
    { nutrientName: 'Total lipid (fat)', nutrientNumber: '1004', unitName: 'G', value: 12 },
    { nutrientName: 'Sodium, Na', nutrientNumber: '1093', unitName: 'MG', value: 400 },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('USDA serving normalization', () => {
  it('converts branded per-100g nutrients to a natural serving before quantity scaling', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'usda-test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ foods: [brandedFood] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch);

    const result = await usdaProvider.lookup({
      text: '2 Example Foods Creamy Crisp protein bars',
      mealType: 'snack',
      normalizedQuery: {
        rawText: '2 Example Foods Creamy Crisp protein bars',
        normalizedText: '2 Example Foods Creamy Crisp protein bars',
        searchText: 'Example Foods Creamy Crisp protein bar',
        matchedQuery: 'Example Foods Creamy Crisp protein bar',
        quantity: 2,
        quantityUnit: 'bar',
        unitHint: 'bar',
        brandHint: 'Example Foods',
      },
    });

    expect(result?.items[0]).toMatchObject({
      quantity: 2,
      unit: 'bar',
      calories: 396,
      protein: 39.6,
      carbs: 35.2,
      fat: 13.2,
      normalizedGrams: 55,
    });
  });

  it('preserves a leading-zero barcode and returns one natural serving', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'usda-test-key');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ foods: [brandedFood] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await usdaProvider.lookupBarcode?.({ barcode: '012345678905', mealType: 'snack' });
    expect(result?.items[0]).toMatchObject({ quantity: 1, unit: 'bar', calories: 198, sourceId: '012345678905' });
    const requestBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(requestBody.query).toBe('012345678905');
  });
});

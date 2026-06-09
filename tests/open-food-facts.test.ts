import { describe, expect, it, vi } from 'vitest';

import { fetchOpenFoodFactsByBarcode } from '@/lib/nutrition/open-food-facts';

describe('open food facts barcode fetch', () => {
  it('returns not found when product payload is missing essentials', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ status: 1, code: '012345678905', product: { _id: '012345678905' } }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchOpenFoodFactsByBarcode('012345678905');
    expect(result.found).toBe(false);
  });

  it('parses core nutriments when present', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        status: 1,
        code: '012345678905',
        product: {
          _id: '012345678905',
          product_name: 'MacroMesh Bar',
          brands: 'MacroMesh',
          nutriments: {
            'energy-kcal_100g': 250,
            proteins_100g: 20,
            carbohydrates_100g: 25,
            fat_100g: 7,
          },
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchOpenFoodFactsByBarcode('012345678905');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.name).toBe('MacroMesh Bar');
      expect(result.brand).toBe('MacroMesh');
      expect(result.calories).toBe(250);
    }
  });
});

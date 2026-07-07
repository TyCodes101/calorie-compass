import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookupNutrition: vi.fn(),
  hasDatabaseConnectionString: vi.fn(),
  getCurrentUserId: vi.fn(),
  prisma: {
    meal: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/nutrition/nutritionLookup', () => ({
  lookupNutrition: mocks.lookupNutrition,
}));

vi.mock('@/lib/current-user', () => ({
  hasDatabaseConnectionString: mocks.hasDatabaseConnectionString,
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { resolveNutritionEstimate } from '@/lib/nutrition/resolver';

function stubOpenFoodFacts(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })),
  );
}

describe('nutrition resolver provider failure modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookupNutrition.mockResolvedValue(null);
    mocks.hasDatabaseConnectionString.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Open Food Facts barcode data only when calories are present', async () => {
    stubOpenFoodFacts({
      status: 1,
      product: {
        product_name: 'Verified Protein Bar',
        serving_quantity: 1,
        serving_size: 'bar',
        nutriments: {
          'energy-kcal_serving': 220,
          proteins_serving: 20,
          carbohydrates_serving: 22,
          fat_serving: 7,
        },
      },
    });

    const result = await resolveNutritionEstimate({ text: '012345678905', mealType: 'snack' });

    expect(result?.items[0]).toMatchObject({
      food_name: 'Verified Protein Bar',
      calories: 220,
      is_trusted: true,
      source_name: 'Open Food Facts barcode match',
      confidence_label: 'Verified',
    });
    expect(mocks.lookupNutrition).not.toHaveBeenCalled();
  });

  it('does not trust an Open Food Facts barcode payload with no calorie field', async () => {
    stubOpenFoodFacts({
      status: 1,
      product: {
        product_name: 'Mystery Protein Bar',
        serving_quantity: 1,
        serving_size: 'bar',
        nutriments: {
          proteins_serving: 20,
          carbohydrates_serving: 22,
          fat_serving: 7,
        },
      },
    });

    const result = await resolveNutritionEstimate({ text: '012345678905', mealType: 'snack' });

    expect(result).toBeNull();
    expect(mocks.lookupNutrition).toHaveBeenCalledWith({
      text: '012345678905',
      mealType: 'snack',
      nutritionLabel: null,
      barcode: null,
    });
  });

  it('falls back safely when the provider response cannot be decoded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: vi.fn(async () => {
          throw new Error('provider returned malformed JSON');
        }),
      })),
    );

    const result = await resolveNutritionEstimate({ text: '012345678905', mealType: 'snack' });

    expect(result).toBeNull();
    expect(mocks.lookupNutrition).toHaveBeenCalledOnce();
  });
});

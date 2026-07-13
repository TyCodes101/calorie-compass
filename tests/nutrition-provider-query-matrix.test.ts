import { describe, expect, it, vi } from 'vitest';

import { buildFoodSearchResponse, resetFoodSearchCaches } from '@/lib/food-search';
import { normalizeBarcode } from '@/lib/barcode-lookup';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';

describe('provider query intent matrix', () => {
  it.each([
    ['banana', /banana/, 1, null, null],
    ['2 eggs', /egg/, 2, 'egg', null],
    ['200g chicken breast', /chicken breast/, 200, 'g', null],
    ['1 cup cooked white rice', /white rice/, 1, 'cup', null],
    ['Flamin Hot Cheetos', /flamin hot cheetos/, 1, null, 'Cheetos'],
    ['hot cheeots', /hot cheeots/, 1, null, 'Cheetos'],
    ['Quest nacho cheese chips', /quest nacho cheese protein chips/, 1, 'bag', 'Quest'],
    ['McDouble no cheese', /mcdonalds mcdouble/, 1, 'burger', "McDonald's"],
    ['Chipotle chicken bowl', /chipotle.*bowl/, 1, null, 'Chipotle'],
    ['Subway meatball footlong', /subway meatball footlong/, 1, 'footlong', 'Subway'],
    ["Arby's classic roast beef", /arbys classic roast beef/, 1, null, "Arby's"],
    ["medium McDonald's fries", /french fries/, 1, 'medium', "McDonald's"],
    ['one 12 oz Coke', /coke/, 12, 'oz', 'Coca-Cola'],
  ] as const)('preserves provider intent for %s', (text, searchPattern, quantity, unit, brand) => {
    const query = normalizeFoodQuery(text);
    expect(query.searchText).toMatch(searchPattern);
    expect(query.quantity).toBe(quantity);
    expect(query.quantityUnit ?? query.unitHint).toBe(unit);
    expect(query.brandHint).toBe(brand);
  });

  it('preserves leading-zero UPC values as strings', () => {
    expect(normalizeBarcode('012345678905')).toBe('012345678905');
  });

  it('does not invent a result for a nonsense query when no provider matches', async () => {
    resetFoodSearchCaches();
    const response = await buildFoodSearchResponse(
      { query: 'zzzxqv no such food', customFoods: [], favoriteMeals: [], recentMeals: [], catalogFoods: [] },
      {
        ai: { resolveQuery: vi.fn().mockResolvedValue(null) },
        providers: [],
        catalogFoods: [],
      },
    );
    expect(response.results).toEqual([]);
  });

  it('keeps two-food input out of the single-candidate provider fallback', async () => {
    resetFoodSearchCaches();
    const response = await buildFoodSearchResponse(
      { query: 'chicken breast and asparagus', customFoods: [], favoriteMeals: [], recentMeals: [], catalogFoods: [] },
      {
        ai: {
          resolveQuery: vi.fn().mockResolvedValue({
            normalizedQuery: 'chicken breast and asparagus', aliases: [], brandIntent: null, restaurantIntent: null,
            servingHint: null, amountHint: null, modifiers: [], category: 'unknown', confidence: 0.4,
            needsDatabaseLookup: true, shouldAskClarification: true,
            clarificationQuestion: 'Please review the separate meal items.',
          }),
        },
        providers: [],
        catalogFoods: [],
      },
    );
    expect(response.results).toEqual([]);
    expect(response.clarificationQuestion).toMatch(/separate meal items/i);
  });
});

import { describe, expect, it } from 'vitest';

import { buildCustomFoodCreatePayload, buildCustomFoodSummaryFromReusableMealRecord } from '@/lib/custom-foods';
import { buildFoodSearchResults } from '@/lib/food-search';

describe('food search helpers', () => {
  it('returns verified catalog matches without inventing nutrition data', () => {
    const results = buildFoodSearchResults({ query: 'large egg', customFoods: [], favoriteMeals: [], recentMeals: [] });

    expect(results[0]).toMatchObject({
      name: 'Large egg',
      sourceLabel: 'Generic reference',
      servingQuantity: 1,
      servingUnit: 'egg',
    });
    expect(results[0]?.items[0]).toMatchObject({
      food_name: 'Large egg',
      is_trusted: true,
      catalog_food_id: 'generic_large_egg',
    });
  });

  it.each([
    ['Hot cheetos', /cheetos/i],
    ['Quest bbq chips', /quest bbq protein chips/i],
  ])('returns fuzzy verified catalog matches for branded searches: %s', (query, expectedName) => {
    const results = buildFoodSearchResults({ query, customFoods: [], favoriteMeals: [], recentMeals: [] });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.name).toMatch(expectedName);
    expect(results[0]?.sourceLabel).toBe('Brand verified');
    expect(results[0]?.items[0]?.is_trusted).toBe(true);
    expect(results[0]?.items[0]?.confidence_label).toMatch(/Verified|Matched/);
  });

  it.each(['hot cheeots'])('does not solve typo queries with deterministic catalog aliases alone: %s', (query) => {
    const results = buildFoodSearchResults({ query, customFoods: [], favoriteMeals: [], recentMeals: [] });

    expect(results).toEqual([]);
  });

  it('returns searchable custom foods with barcode metadata when present', () => {
    const payload = buildCustomFoodCreatePayload({
      name: 'Turkey Chili',
      brand: 'Home',
      barcode: '012345678905',
      servingQuantity: 1,
      servingUnit: 'bowl',
      calories: 410,
      protein: 36,
      carbs: 32,
      fat: 14,
    });
    const customFood = buildCustomFoodSummaryFromReusableMealRecord({
      id: 'custom-1',
      title: 'Turkey Chili',
      rawText: payload.raw_text,
      items: [{
        foodName: 'Turkey Chili',
        quantity: 1,
        unit: 'bowl',
        calories: 410,
        protein: 36,
        carbs: 32,
        fat: 14,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        notes: payload.items[0].notes,
        sourceName: payload.items[0].source_name,
      }],
    });

    const results = buildFoodSearchResults({ query: 'turkey chili', customFoods: [customFood], favoriteMeals: [], recentMeals: [] });

    expect(results[0]).toMatchObject({
      id: 'custom-1',
      name: 'Turkey Chili',
      sourceLabel: 'Custom',
      barcode: '012345678905',
    });
    expect(results[0]?.items[0].source_name).toBe('Custom food: Home');
  });

  it('returns empty results for unknown foods instead of hallucinated estimates', () => {
    const results = buildFoodSearchResults({ query: 'galaxy moon cereal deluxe', customFoods: [], favoriteMeals: [], recentMeals: [] });

    expect(results).toEqual([]);
  });
});

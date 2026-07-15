import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { ParsedFoodItem } from '@/lib/ai/types';
import { searchFoodIntelligence } from '@/lib/food-intelligence/engine';
import { resetFoodSearchCaches } from '@/lib/food-search';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

const intentCases = [
  { query: '200g chicken breast', name: /chicken breast/i, quantity: 200, unit: 'g', brand: null },
  { query: '200g grilled chicken breast', name: /grilled chicken breast/i, quantity: 200, unit: 'g', brand: null },
  { query: '2 eggs', name: /egg/i, quantity: 2, unit: 'egg', brand: null },
  { query: '200g cooked white rice', name: /cooked white rice/i, quantity: 200, unit: 'g', brand: null },
  { query: '1 cup oatmeal', name: /oatmeal/i, quantity: 1, unit: 'cup', brand: null },
  { query: 'Quest Chips', name: /quest.*protein chips/i, quantity: 1, unit: 'bag', brand: 'Quest' },
  { query: 'KitKat', name: /kitkat/i, quantity: 1, unit: 'bar', brand: 'KitKat' },
  { query: 'Kit kat', name: /kitkat/i, quantity: 1, unit: 'bar', brand: 'KitKat' },
  { query: 'hot cheeots', name: /hot cheetos/i, quantity: 1, unit: null, brand: 'Cheetos' },
  { query: 'Flamin Hot Cheetos', name: /flamin hot cheetos/i, quantity: 1, unit: null, brand: 'Cheetos' },
  { query: 'McDouble', name: /mcdonalds mcdouble/i, quantity: 1, unit: 'burger', brand: "McDonald's" },
  { query: '2 McDoubles', name: /mcdonalds mcdouble/i, quantity: 2, unit: 'burger', brand: "McDonald's" },
  { query: 'McDouble no cheese', name: /mcdonalds mcdouble/i, quantity: 1, unit: 'burger', brand: "McDonald's" },
  { query: 'McDouble no ketchup', name: /mcdonalds mcdouble/i, quantity: 1, unit: 'burger', brand: "McDonald's" },
  { query: 'Chipotle Bowl', name: /chipotle bowl/i, quantity: 1, unit: 'bowl', brand: 'Chipotle' },
  { query: 'chipolte chicken bowl', name: /chipotle.*bowl/i, quantity: 1, unit: null, brand: 'Chipotle' },
  { query: 'Subway Meatball footlong', name: /subway meatball footlong/i, quantity: 1, unit: 'footlong', brand: 'Subway' },
  { query: "Arby's Roast Beef", name: /arbys roast beef/i, quantity: 1, unit: null, brand: "Arby's" },
  { query: 'Fairlife Chocolate Milk', name: /fairlife chocolate milk/i, quantity: 1, unit: null, brand: 'Fairlife' },
  { query: 'Coke Zero', name: /coke zero/i, quantity: 1, unit: null, brand: 'Coca-Cola' },
  { query: 'Protein Shake', name: /protein shake/i, quantity: 1, unit: null, brand: null },
  { query: 'Olive Oil', name: /olive oil/i, quantity: 1, unit: null, brand: null },
  { query: 'Coffee with Cream', name: /coffee cream/i, quantity: 1, unit: null, brand: null },
  { query: 'Mac and Cheese', name: /mac and cheese/i, quantity: 1, unit: null, brand: null },
  { query: "Ben and Jerry's", name: /ben jerrys/i, quantity: 1, unit: null, brand: "Ben & Jerry's" },
  { query: 'Peanut Butter and Jelly', name: /peanut butter and jelly sandwich/i, quantity: 1, unit: 'sandwich', brand: null },
  { query: 'one 12 oz Coke', name: /coke/i, quantity: 12, unit: 'oz', brand: 'Coca-Cola' },
  { query: 'mcdonlads fries', name: /french fries/i, quantity: 1, unit: null, brand: "McDonald's" },
] as const;

describe('Food Intelligence release corpus', () => {
  beforeEach(() => resetFoodSearchCaches());

  it.each(intentCases)('preserves identity, quantity, and serving intent: $query', ({ query, name, quantity, unit, brand }) => {
    const normalized = normalizeFoodQuery(query);
    expect(normalized.searchText).toMatch(name);
    expect(normalized.quantity).toBe(quantity);
    expect(normalized.quantityUnit ?? normalized.unitHint).toBe(unit);
    expect(normalized.brandHint).toBe(brand);
  });

  it('preserves modifiers as review metadata without letting ranking invent nutrition', async () => {
    const providerItem: ParsedFoodItem = {
      food_name: "McDonald's McDouble",
      quantity: 1,
      unit: 'burger',
      calories: 400,
      protein: 22,
      carbs: 33,
      fat: 20,
      fiber: 2,
      sugar: 7,
      sodium: 920,
      is_trusted: true,
      source_type: 'OFFICIAL_RESTAURANT',
      source_name: "McDonald's official nutrition",
      confidence_label: 'Verified',
      provider_used: 'restaurant-fixture',
      used_ai_fallback: false,
    };
    const provider: NutritionLookupProvider = {
      id: 'restaurant-fixture',
      lookup: vi.fn().mockResolvedValue(normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'snack',
        confidence_score: 0.9,
        items: [providerItem],
      })),
    };
    const result = await searchFoodIntelligence({ query: 'McDouble no cheese', origin: 'search' }, {
      search: {
        catalogFoods: [],
        providers: [provider],
        ai: {
          resolveQuery: vi.fn().mockResolvedValue({
            normalizedQuery: "McDonald's McDouble",
            aliases: [],
            brandIntent: "McDonald's",
            restaurantIntent: "McDonald's",
            servingHint: 'burger',
            amountHint: '1',
            modifiers: ['no cheese'],
            category: 'restaurant',
            confidence: 0.94,
            needsDatabaseLookup: true,
            shouldAskClarification: false,
            clarificationQuestion: null,
          }),
        },
      },
    });

    expect(result.results[0]?.items[0]).toMatchObject({
      calories: 400,
      requested_modifiers: ['no cheese'],
      review_status: 'recommended',
    });
  });

  it('deduplicates identical provider records without merging their nutrition', async () => {
    const candidate = (providerId: string, calories: number): NutritionLookupProvider => ({
      id: providerId,
      lookup: vi.fn().mockResolvedValue(normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'snack',
        confidence_score: providerId === 'usda-fdc' ? 0.9 : 0.8,
        items: [{
          food_name: 'Cooked white rice', quantity: 1, unit: 'cup', calories, protein: 4, carbs: 45, fat: 0.5,
          fiber: 1, sugar: 0, sodium: 2, is_trusted: true, source_type: 'GENERIC_REFERENCE',
          source_name: providerId, confidence_label: 'Matched', provider_used: providerId, used_ai_fallback: false,
        }],
      })),
    });
    const result = await searchFoodIntelligence({ query: '1 cup cooked white rice', origin: 'search' }, {
      search: {
        catalogFoods: [],
        ai: { resolveQuery: vi.fn().mockResolvedValue(null) },
        providers: [candidate('usda-fdc', 205), candidate('calorie-api', 260)],
      },
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ providerId: 'usda-fdc', calories: 205, needsReview: true });
  });

  it('rejects a candidate from a conflicting explicit restaurant', async () => {
    const restaurantCandidate = (restaurant: string): NutritionLookupProvider => ({
      id: `${restaurant.toLowerCase()}-fixture`,
      lookup: vi.fn().mockResolvedValue(normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'dinner',
        confidence_score: 0.95,
        items: [{
          food_name: `${restaurant} steak bowl`, quantity: 1, unit: 'bowl', calories: 650,
          protein: 42, carbs: 60, fat: 24, fiber: 8, sugar: 5, sodium: 1100,
          is_trusted: true, source_type: 'OFFICIAL_RESTAURANT',
          source_name: `${restaurant} official nutrition`, confidence_label: 'Verified',
          provider_used: `${restaurant.toLowerCase()}-fixture`, used_ai_fallback: false,
        }],
      })),
    });
    const result = await searchFoodIntelligence({ query: 'Qdoba steak bowl', origin: 'search' }, {
      search: {
        catalogFoods: [],
        providers: [restaurantCandidate('Chipotle'), restaurantCandidate('Qdoba')],
        ai: { resolveQuery: vi.fn().mockResolvedValue(null) },
      },
    });

    expect(result.results.some((candidate) => candidate.restaurant === 'Qdoba')).toBe(true);
    expect(result.results.some((candidate) => candidate.restaurant === 'Chipotle')).toBe(false);
  });
});

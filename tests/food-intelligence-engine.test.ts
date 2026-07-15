import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import {
  lookupBarcodeFoodIntelligence,
  revalidateFoodIntelligenceItems,
  resolveFoodIntelligenceItem,
  searchFoodIntelligence,
} from '@/lib/food-intelligence/engine';
import { resetFoodSearchCaches, type FoodSearchResult } from '@/lib/food-search';
import { resolveNutritionEstimate } from '@/lib/nutrition/resolver';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

function item(overrides: Partial<ParsedFoodItem> = {}): ParsedFoodItem {
  return {
    food_name: 'KitKat Milk Chocolate',
    quantity: 1,
    unit: 'bar',
    calories: 210,
    protein: 3,
    carbs: 27,
    fat: 11,
    fiber: 1,
    sugar: 21,
    sodium: 30,
    notes: 'Controlled provider fixture.',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Controlled nutrition database',
    confidence_label: 'Matched',
    match_type: 'exact_branded',
    matched_query: 'KitKat',
    original_user_text: 'KitKat',
    provider_used: 'fixture-provider',
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

function response(food: ParsedFoodItem, confidence = 0.86): ParsedMealResponse {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'snack',
    confidence_score: confidence,
    items: [food],
  });
}

function provider(id: string, implementation: NutritionLookupProvider['lookup']): NutritionLookupProvider {
  return {
    id,
    capabilities: { search: true, barcode: false, details: false, suggest: false },
    lookup: implementation,
  };
}

function barcodeResult(food = item()): FoodSearchResult {
  return {
    id: 'barcode:fixture:012345678905',
    name: food.food_name,
    brand: 'KitKat',
    restaurant: null,
    sourceLabel: 'Database match',
    sourceType: food.source_type ?? null,
    sourceName: food.source_name ?? null,
    providerId: food.provider_used ?? null,
    servingQuantity: food.quantity,
    servingUnit: food.unit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    barcode: '012345678905',
    mealType: 'snack',
    confidenceScore: 0.96,
    estimated: false,
    needsReview: false,
    reason: 'Matched by barcode.',
    sourceReusableMealId: null,
    items: [food],
  };
}

describe('universal Food Intelligence Engine', () => {
  beforeEach(() => resetFoodSearchCaches());

  it('queries every enabled provider even when the verified catalog has an exact match', async () => {
    const firstLookup = vi.fn().mockResolvedValue(null);
    const secondLookup = vi.fn().mockResolvedValue(null);

    const result = await searchFoodIntelligence({
      query: 'large egg',
      origin: 'search',
    }, {
      search: {
        ai: { resolveQuery: vi.fn() },
        providers: [provider('first', firstLookup), provider('second', secondLookup)],
      },
    });

    expect(result.results[0]?.name).toBe('Large egg');
    expect(firstLookup).toHaveBeenCalledOnce();
    expect(secondLookup).toHaveBeenCalledOnce();
  });

  it('returns multiple normalized product variants from one provider', async () => {
    const variants: NutritionLookupProvider = {
      id: 'variant-provider',
      capabilities: { search: true, barcode: false, details: false, suggest: true },
      lookup: vi.fn().mockResolvedValue(null),
      searchCandidates: vi.fn().mockResolvedValue([
        response(item({ food_name: 'KitKat Milk Chocolate', calories: 210 })),
        response(item({ food_name: 'KitKat King Size', quantity: 1, unit: 'package', calories: 420 })),
        response(item({ food_name: 'KitKat Mini', calories: 90 })),
        response(item({ food_name: 'KitKat White Creme', calories: 220 })),
      ]),
    };

    const result = await searchFoodIntelligence({ query: 'kit', origin: 'search' }, {
      search: { providers: [variants], catalogFoods: [], ai: { resolveQuery: vi.fn().mockResolvedValue(null) } },
    });

    expect(result.results.map((entry) => entry.name)).toEqual([
      'KitKat Milk Chocolate',
      'KitKat King Size',
      'KitKat Mini',
      'KitKat White Creme',
    ]);
  });

  it('allows AI ranking to reorder candidates without changing provider confidence or nutrition', async () => {
    const source = (id: string, name: string, calories: number, confidence: number) => provider(id, vi.fn().mockResolvedValue(
      response(item({ food_name: name, calories, provider_used: id }), confidence),
    ));
    const result = await searchFoodIntelligence({ query: 'quest chips', origin: 'search' }, {
      search: {
        catalogFoods: [],
        providers: [source('a', 'Quest BBQ Protein Chips', 140, 0.71), source('b', 'Quest Nacho Cheese Protein Chips', 150, 0.74)],
        ai: {
          resolveQuery: vi.fn().mockResolvedValue({
            normalizedQuery: 'Quest chips', aliases: [], brandIntent: 'Quest', restaurantIntent: null,
            servingHint: 'bag', amountHint: '1', modifiers: [], category: 'branded', confidence: 0.99,
            needsDatabaseLookup: true, shouldAskClarification: false, clarificationQuestion: null,
          }),
          rankCandidates: vi.fn().mockImplementation(({ candidates }) => ({
            orderedCandidateIds: [candidates[1].id, candidates[0].id],
            bestCandidateId: candidates[1].id,
            confidence: 1,
            reason: 'Flavor intent.',
            shouldAskClarification: false,
            clarificationQuestion: null,
          })),
        },
      },
    });

    expect(result.results[0]).toMatchObject({ name: 'Quest Nacho Cheese Protein Chips', calories: 150, confidenceScore: 0.74 });
  });

  it('returns the same selected identity and nutrition to search and chat hydration', async () => {
    const sharedProvider = provider('shared', vi.fn().mockResolvedValue(response(item())));
    const dependencies = {
      search: {
        providers: [sharedProvider],
        catalogFoods: [],
        ai: { resolveQuery: vi.fn().mockResolvedValue(null) },
      },
    };
    const search = await searchFoodIntelligence({ query: 'Kit kat', origin: 'search', mealType: 'snack' }, dependencies);
    const chat = await resolveNutritionEstimate({
      text: 'Kit kat',
      mealType: 'snack',
      foodIntelligenceDependencies: dependencies,
    });

    expect(chat?.items[0]).toMatchObject({
      food_name: search.results[0]?.name,
      calories: search.results[0]?.calories,
      provider_used: search.results[0]?.providerId,
    });
  });

  it('isolates provider failures and keeps healthy candidates', async () => {
    const result = await resolveFoodIntelligenceItem({ query: 'banana', origin: 'chat', mealType: 'snack' }, {
      search: {
        catalogFoods: [],
        ai: { resolveQuery: vi.fn().mockResolvedValue(null) },
        providers: [
          provider('timeout', vi.fn().mockRejectedValue(new Error('timeout'))),
          provider('healthy', vi.fn().mockResolvedValue(response(item({ food_name: 'Banana', unit: 'medium', calories: 105, provider_used: 'healthy' })))),
        ],
      },
    });
    expect(result?.items[0]).toMatchObject({ food_name: 'Banana', provider_used: 'healthy' });
  });

  it('routes barcode matches through the same normalized review model and preserves leading zeroes', async () => {
    const expected = barcodeResult();
    const result = await lookupBarcodeFoodIntelligence('012345678905', { customFoods: [] }, {
      cachedBarcodeLookup: vi.fn().mockResolvedValue(null),
      providerBarcodeLookup: vi.fn().mockResolvedValue({ found: true, result: expected }),
    });
    expect(result).toMatchObject({ barcode: '012345678905', found: true });
    expect(result.result).toEqual(expected);
  });

  it('revalidates favorites and history for review without saving or leaking quantities', async () => {
    const lookup = vi.fn(async ({ normalizedQuery }) => response(item({
      food_name: normalizedQuery.searchText.includes('banana') ? 'Banana' : 'Eggs',
      quantity: normalizedQuery.quantity,
      unit: normalizedQuery.quantityUnit ?? normalizedQuery.unitHint ?? 'serving',
      calories: normalizedQuery.searchText.includes('banana') ? 105 : 70 * normalizedQuery.quantity,
    })));
    const dependencies = {
      search: {
        catalogFoods: [],
        ai: { resolveQuery: vi.fn().mockResolvedValue(null) },
        providers: [provider('revalidator', lookup)],
      },
    };
    const first = await revalidateFoodIntelligenceItems({
      origin: 'history', mealType: 'breakfast', items: [item({ food_name: 'Eggs', quantity: 2, unit: 'egg' })],
    }, dependencies);
    const second = await revalidateFoodIntelligenceItems({
      origin: 'history', mealType: 'breakfast', items: [item({ food_name: 'Banana', quantity: 1, unit: 'medium' })],
    }, dependencies);

    expect(first.items[0]).toMatchObject({ food_name: 'Eggs', quantity: 2 });
    expect(second.items[0]).toMatchObject({ food_name: 'Banana', quantity: 1 });
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

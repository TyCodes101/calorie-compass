import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParsedMealResponse } from '@/lib/ai/types';
import {
  buildFoodSearchResponse,
  resetFoodSearchCaches,
  type FoodSearchAiClient,
  type FoodSearchRankingInput,
  type FoodSearchResolverOutput,
} from '@/lib/food-search';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

function mealResponse(item: ParsedMealResponse['items'][number], confidence = 0.94): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'snack',
    confidence_score: confidence,
    items: [item],
    totals: {
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
    },
  };
}

function providerItem(overrides: Partial<ParsedMealResponse['items'][number]>): ParsedMealResponse['items'][number] {
  return {
    food_name: 'Provider food',
    quantity: 1,
    unit: 'serving',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 2,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    notes: null,
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Provider database',
    confidence_label: 'Matched',
    matched_query: 'provider food',
    original_user_text: 'provider food',
    provider_used: 'test-provider',
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

function resolverOutput(overrides: Partial<FoodSearchResolverOutput>): FoodSearchResolverOutput {
  return {
    normalizedQuery: 'normalized food',
    aliases: [],
    brandIntent: null,
    restaurantIntent: null,
    servingHint: null,
    amountHint: null,
    modifiers: [],
    category: 'generic',
    confidence: 0.8,
    needsDatabaseLookup: true,
    shouldAskClarification: false,
    clarificationQuestion: null,
    ...overrides,
  };
}

describe('LLM-assisted food search service', () => {
  beforeEach(() => {
    resetFoodSearchCaches();
  });

  it('skips the OpenAI resolver when local catalog has a high-confidence exact match', async () => {
    const ai: FoodSearchAiClient = {
      resolveQuery: vi.fn(),
      rankCandidates: vi.fn(),
    };

    const response = await buildFoodSearchResponse(
      { query: 'large egg', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { ai },
    );

    expect(ai.resolveQuery).not.toHaveBeenCalled();
    expect(response.usedResolver).toBe(false);
    expect(response.results[0]).toMatchObject({
      name: 'Large egg',
      sourceLabel: 'USDA verified',
      estimated: false,
      needsReview: false,
    });
  });

  it('skips the OpenAI resolver for exact custom, favorite, and recent matches', async () => {
    const ai: FoodSearchAiClient = {
      resolveQuery: vi.fn(),
      rankCandidates: vi.fn(),
    };
    const item = providerItem({
      food_name: 'Turkey Chili',
      quantity: 1,
      unit: 'bowl',
      calories: 410,
      protein: 36,
      carbs: 32,
      fat: 14,
      source_name: 'Custom food: Home',
    });
    const customFoods = [{
      id: 'custom-turkey-chili',
      name: 'Turkey Chili',
      brand: 'Home',
      barcode: null,
      servingQuantity: 1,
      servingUnit: 'bowl',
      calories: 410,
      protein: 36,
      carbs: 32,
      fat: 14,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      createdAt: null,
      updatedAt: null,
      items: [item],
    }];
    const favoriteMeals = [{
      id: 'favorite-turkey-chili',
      title: 'Turkey Chili',
      rawText: 'Turkey Chili',
      mealType: 'lunch' as const,
      lastUsedAt: null,
      totalCalories: 410,
      totalProtein: 36,
      itemCount: 1,
      trustedCount: 1,
      confidenceScore: 0.96,
      items: [item],
    }];

    const response = await buildFoodSearchResponse(
      { query: 'Turkey Chili', customFoods, favoriteMeals, recentMeals: favoriteMeals },
      { ai, catalogFoods: [] },
    );

    expect(ai.resolveQuery).not.toHaveBeenCalled();
    expect(response.results.map((result) => result.sourceLabel)).toEqual(expect.arrayContaining(['Custom', 'Favorite', 'Recent']));
  });

  it('invokes resolver for typo-heavy queries and searches aliases against providers', async () => {
    const resolveQuery = vi.fn(async () => resolverOutput({
      normalizedQuery: 'Diet Coke',
      aliases: ['Coke Zero', 'diet cola can'],
      brandIntent: 'Coca-Cola',
      servingHint: 'can',
      amountHint: '1',
      category: 'branded',
      confidence: 0.92,
    }));
    const provider: NutritionLookupProvider = {
      id: 'brand-provider',
      lookup: vi.fn(async ({ normalizedQuery }) => {
        if (!/diet coke|coke zero/i.test(normalizedQuery.searchText)) return null;
        return mealResponse(providerItem({
          food_name: 'Diet Coke',
          quantity: 1,
          unit: 'can',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          source_name: 'Coca-Cola nutrition reference',
          provider_used: 'brand-provider',
        }), 0.96);
      }),
    };

    const response = await buildFoodSearchResponse(
      { query: '1 diet cooe', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { ai: { resolveQuery }, providers: [provider], catalogFoods: [] },
    );

    expect(resolveQuery).toHaveBeenCalledTimes(1);
    expect(provider.lookup).toHaveBeenCalled();
    expect(response.usedResolver).toBe(true);
    expect(response.results[0]).toMatchObject({
      name: 'Diet Coke',
      calories: 0,
      sourceLabel: 'Brand verified',
      needsReview: false,
      sourceName: 'Coca-Cola nutrition reference',
      providerId: 'brand-provider',
    });
  });

  it('uses cached resolver and ranking outputs for repeated identical searches', async () => {
    const resolveQuery = vi.fn(async () => resolverOutput({
      normalizedQuery: 'Takis',
      aliases: ['Takis chips'],
      brandIntent: 'Takis',
      category: 'branded',
      confidence: 0.86,
    }));
    const rankCandidates = vi.fn(async (input: FoodSearchRankingInput) => ({
      orderedCandidateIds: input.candidates.map((candidate) => candidate.id).reverse(),
      bestCandidateId: input.candidates.at(-1)?.id ?? null,
      confidence: 0.84,
      reason: 'Brand query matched the chip candidate.',
      shouldAskClarification: false,
      clarificationQuestion: null,
    }));
    const provider = (id: string, name: string, calories: number): NutritionLookupProvider => ({
      id,
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: name,
        calories,
        source_name: 'Brand nutrition reference',
        provider_used: id,
      }), 0.82)),
    });

    const options = {
      ai: { resolveQuery, rankCandidates },
      providers: [provider('brand-a', 'Takis Fuego', 150), provider('brand-b', 'Takis Waves', 140)],
      catalogFoods: [],
    };

    const first = await buildFoodSearchResponse({ query: 'takis', customFoods: [], favoriteMeals: [], recentMeals: [] }, options);
    const second = await buildFoodSearchResponse({ query: 'takis', customFoods: [], favoriteMeals: [], recentMeals: [] }, options);

    expect(resolveQuery).toHaveBeenCalledTimes(1);
    expect(rankCandidates).toHaveBeenCalledTimes(1);
    expect(first.cache).toEqual({ resolverHit: false, rankingHit: false, selectedResultHit: false });
    expect(second.cache.resolverHit).toBe(true);
    expect(second.cache.rankingHit).toBe(true);
  });

  it('lets ranking reorder candidates but never alter provider nutrition', async () => {
    const provider = (id: string, name: string, calories: number): NutritionLookupProvider => ({
      id,
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: name,
        calories,
        protein: id === 'restaurant' ? 25 : 12,
        source_type: id === 'restaurant' ? 'OFFICIAL_RESTAURANT' : 'GENERIC_REFERENCE',
        source_name: id === 'restaurant' ? "McDonald's official nutrition" : 'USDA FoodData Central',
        provider_used: id,
      }), 0.88)),
    });
    const rankCandidates = vi.fn(async (input) => ({
      orderedCandidateIds: [input.candidates[1]?.id, input.candidates[0]?.id].filter(Boolean) as string[],
      bestCandidateId: input.candidates[1]?.id ?? null,
      confidence: 0.91,
      reason: 'Restaurant intent matched the McDonald candidate.',
      shouldAskClarification: false,
      clarificationQuestion: null,
    }));

    const response = await buildFoodSearchResponse(
      { query: 'big mac meal', customFoods: [], favoriteMeals: [], recentMeals: [] },
      {
        ai: {
          resolveQuery: vi.fn(async () => resolverOutput({
            normalizedQuery: "McDonald's Big Mac meal",
            restaurantIntent: "McDonald's",
            category: 'restaurant',
            confidence: 0.9,
          })),
          rankCandidates,
        },
        providers: [provider('usda', 'Burger meal', 780), provider('restaurant', 'Big Mac Meal', 1120)],
        catalogFoods: [],
      },
    );

    expect(response.usedRanking).toBe(true);
    expect(response.results[0]).toMatchObject({
      name: 'Big Mac Meal',
      calories: 1120,
      protein: 25,
      sourceLabel: 'Restaurant verified',
    });
  });

  it('returns clearly marked estimated fallback when no provider or local result is available', async () => {
    const response = await buildFoodSearchResponse(
      { query: 'chicken rice broccoli', customFoods: [], favoriteMeals: [], recentMeals: [] },
      {
        ai: {
          resolveQuery: vi.fn(async () => resolverOutput({
            normalizedQuery: 'chicken rice broccoli',
            aliases: ['chicken rice and broccoli bowl'],
            category: 'homemade',
            confidence: 0.72,
          })),
        },
        providers: [{
          id: 'empty-provider',
          lookup: vi.fn(async () => null),
        }],
        catalogFoods: [],
      },
    );

    expect(response.results[0]).toMatchObject({
      sourceLabel: 'Estimated',
      estimated: true,
      needsReview: true,
      sourceType: 'AI_ESTIMATE',
    });
    expect(response.results[0]?.items[0]).toMatchObject({
      source_type: 'AI_ESTIMATE',
      is_trusted: false,
    });
  });

  it('preserves requested quantity and unit across resolver aliases', async () => {
    const observedIntents: Array<{ query: string; quantity: number; unit: string | null }> = [];
    const provider: NutritionLookupProvider = {
      id: 'serving-fixture',
      lookup: vi.fn(async ({ normalizedQuery }) => {
        observedIntents.push({
          query: normalizedQuery.searchText,
          quantity: normalizedQuery.quantity,
          unit: normalizedQuery.quantityUnit,
        });
        if (normalizedQuery.searchText !== 'whole egg') return null;
        return mealResponse(providerItem({
          food_name: 'Large egg',
          quantity: normalizedQuery.quantity,
          unit: normalizedQuery.quantityUnit ?? 'egg',
          calories: 210,
          protein: 18,
          carbs: 2,
          fat: 15,
          provider_used: 'serving-fixture',
        }));
      }),
    };

    const response = await buildFoodSearchResponse(
      { query: '3 eggs', customFoods: [], favoriteMeals: [], recentMeals: [] },
      {
        catalogFoods: [],
        providers: [provider],
        ai: {
          resolveQuery: vi.fn(async () => resolverOutput({
            normalizedQuery: 'whole egg',
            aliases: ['whole egg'],
          })),
        },
      },
    );

    expect(observedIntents.length).toBeGreaterThan(1);
    expect(observedIntents.every((intent) => intent.quantity === 3 && intent.unit === 'egg')).toBe(true);
    expect(response.results[0]?.items[0]).toMatchObject({ quantity: 3, unit: 'egg' });
  });

  it('does not let a differently sized recent meal outrank the requested serving', async () => {
    const recentItem = providerItem({
      food_name: 'Large egg',
      quantity: 2,
      unit: 'eggs',
      calories: 140,
      protein: 12,
      carbs: 1,
      fat: 10,
    });
    const recentMeals = [{
      id: 'recent-two-eggs',
      title: '2 eggs',
      rawText: '2 eggs',
      mealType: 'breakfast' as const,
      lastUsedAt: null,
      totalCalories: 140,
      totalProtein: 12,
      itemCount: 1,
      trustedCount: 1,
      confidenceScore: 0.95,
      items: [recentItem],
    }];

    const response = await buildFoodSearchResponse(
      { query: '3 eggs', customFoods: [], favoriteMeals: [], recentMeals },
      { providers: [], ai: { resolveQuery: vi.fn(async () => null) } },
    );

    expect(new Set(response.results.map((result) => result.id)).size).toBe(response.results.length);
    expect(response.results[0]?.items[0]).toMatchObject({ quantity: 3, unit: 'egg' });
    expect(response.results[0]?.calories).toBe(210);
  });

  it('converts explicit gram requests from an ounce-based catalog serving once', async () => {
    const response = await buildFoodSearchResponse(
      { query: '200g chicken breast', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { providers: [], ai: { resolveQuery: vi.fn(async () => null) } },
    );

    expect(response.results[0]).toMatchObject({
      name: 'Grilled chicken breast',
      servingQuantity: 200,
      servingUnit: 'g',
    });
    expect(response.results[0]?.calories).toBeGreaterThan(300);
    expect(response.results[0]?.calories).toBeLessThan(400);
  });

  it('keeps an explicit restaurant result ahead of generic candidates', async () => {
    const response = await buildFoodSearchResponse(
      { query: "McDonald's medium fries", customFoods: [], favoriteMeals: [], recentMeals: [] },
      { providers: [], ai: { resolveQuery: vi.fn(async () => null) } },
    );

    expect(response.results[0]).toMatchObject({
      name: "McDonald's Fries",
      restaurant: "McDonald's",
      servingQuantity: 1,
      servingUnit: 'medium',
    });
  });

  it('rejects a contradictory preparation when a raw result is requested', async () => {
    const rawProvider: NutritionLookupProvider = {
      id: 'raw-fixture',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: 'Chicken breast, raw',
        quantity: 100,
        unit: 'g',
        calories: 120,
        protein: 23,
        carbs: 0,
        fat: 3,
        provider_used: 'raw-fixture',
      }))),
    };
    const response = await buildFoodSearchResponse(
      { query: 'raw chicken breast', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { providers: [rawProvider], ai: { resolveQuery: vi.fn(async () => null) } },
    );

    expect(response.results[0]?.name).toMatch(/raw/i);
    expect(response.results.some((result) => /grilled/i.test(result.name))).toBe(false);
  });

  it('requires review for an unusually small implicit provider weight', async () => {
    const tinyServing: NutritionLookupProvider = {
      id: 'tiny-serving',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: 'Chocolate wafer bar',
        quantity: 2,
        unit: 'g',
        calories: 10,
        protein: 0.1,
        carbs: 1.4,
        fat: 0.5,
        provider_used: 'tiny-serving',
      }), 0.8)),
    };

    const response = await buildFoodSearchResponse(
      { query: 'chocolate wafer bar', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { catalogFoods: [], providers: [tinyServing], ai: { resolveQuery: vi.fn(async () => null) } },
    );

    expect(response.results[0]).toMatchObject({
      servingQuantity: 2,
      servingUnit: 'g',
      needsReview: true,
    });
    expect(response.results[0]?.items[0]).toMatchObject({
      confidence_label: 'Needs Review',
      review_status: 'required',
      is_trusted: false,
    });
  });

  it('ranks a natural serving above a tiny gram fragment for the same identity', async () => {
    const tinyServing: NutritionLookupProvider = {
      id: 'tiny-serving',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: 'Chocolate wafer bar', quantity: 2, unit: 'g', calories: 10, provider_used: 'tiny-serving',
      }), 0.8)),
    };
    const naturalServing: NutritionLookupProvider = {
      id: 'natural-serving',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: 'Chocolate wafer bar', quantity: 1, unit: 'bar', calories: 210, provider_used: 'natural-serving',
      }), 0.76)),
    };

    const response = await buildFoodSearchResponse(
      { query: 'chocolate wafer bar', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { catalogFoods: [], providers: [tinyServing, naturalServing], ai: { resolveQuery: vi.fn(async () => null) } },
    );

    expect(response.results[0]).toMatchObject({
      providerId: 'natural-serving',
      servingQuantity: 1,
      servingUnit: 'bar',
      calories: 210,
      needsReview: false,
    });
  });
});

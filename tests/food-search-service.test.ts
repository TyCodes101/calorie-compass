import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParsedMealResponse } from '@/lib/ai/types';
import {
  buildFoodSearchSelectedResultCacheKey,
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
      sourceLabel: 'Generic reference',
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

  it('namespaces selected-result cache keys by identity and catalog context', () => {
    const wendysBaconatorKey = buildFoodSearchSelectedResultCacheKey("Wendy's Baconator");
    const plainBaconatorKey = buildFoodSearchSelectedResultCacheKey('Baconator');
    const mcdoubleKey = buildFoodSearchSelectedResultCacheKey("McDonald's McDouble no cheese");

    expect(wendysBaconatorKey).toContain('restaurant=wendys');
    expect(wendysBaconatorKey).toContain('brand=wendys');
    expect(wendysBaconatorKey).toContain('family=wendys_baconator');
    expect(wendysBaconatorKey).toContain('catalog=');
    expect(mcdoubleKey).toContain('family=mcdonalds_mcdouble');
    expect(plainBaconatorKey).not.toBe(wendysBaconatorKey);
    expect(mcdoubleKey).not.toBe(wendysBaconatorKey);
  });

  it('does not cache estimated fallbacks as selected source-backed results', async () => {
    const resolveQuery = vi.fn(async () => resolverOutput({
      normalizedQuery: 'homemade chicken pasta',
      category: 'homemade',
      confidence: 0.72,
    }));
    const options = {
      ai: { resolveQuery },
      providers: [{
        id: 'empty-provider',
        lookup: vi.fn(async () => null),
      }],
      catalogFoods: [],
    };

    const first = await buildFoodSearchResponse(
      { query: 'homemade chicken pasta', customFoods: [], favoriteMeals: [], recentMeals: [] },
      options,
    );
    const second = await buildFoodSearchResponse(
      { query: 'homemade chicken pasta', customFoods: [], favoriteMeals: [], recentMeals: [] },
      options,
    );

    expect(first.results[0]).toMatchObject({
      sourceLabel: 'Estimated',
      estimated: true,
      needsReview: true,
    });
    expect(first.cache.selectedResultHit).toBe(false);
    expect(second.cache.selectedResultHit).toBe(false);
  });

  it('enforces restaurant/product anchor tokens so Baconator cannot rank to an unrelated Wendy\'s item', async () => {
    const resolveQuery = vi.fn(async () => resolverOutput({
      normalizedQuery: "Wendy's Baconator",
      aliases: ['wendys baconator'],
      brandIntent: null,
      restaurantIntent: "Wendy's",
      category: 'restaurant',
      confidence: 0.92,
    }));

    // Simulate a buggy ranker that would have picked the wrong candidate.
    const rankCandidates = vi.fn(async (input: FoodSearchRankingInput) => ({
      orderedCandidateIds: input.candidates.map((candidate) => candidate.id).reverse(),
      bestCandidateId: input.candidates.at(-1)?.id ?? null,
      confidence: 0.8,
      reason: 'picked the wrong thing',
      shouldAskClarification: false,
      clarificationQuestion: null,
    }));

    const wendysChicken: NutritionLookupProvider = {
      id: 'wendys-chicken',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: "Wendy's Spicy Chicken Sandwich",
        calories: 490,
        protein: 28,
        carbs: 45,
        fat: 19,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: "Wendy's official nutrition",
        provider_used: 'wendys-chicken',
      }), 0.9)),
    };

    const wendysBaconator: NutritionLookupProvider = {
      id: 'wendys-baconator',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: "Wendy's Baconator",
        calories: 960,
        protein: 57,
        carbs: 40,
        fat: 62,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: "Wendy's official nutrition",
        provider_used: 'wendys-baconator',
      }), 0.92)),
    };

    const response = await buildFoodSearchResponse(
      { query: 'wendys baconator', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { ai: { resolveQuery, rankCandidates }, providers: [wendysChicken, wendysBaconator], catalogFoods: [] },
    );

    expect(resolveQuery).toHaveBeenCalledTimes(1);
    expect(response.clarificationQuestion).toBeNull();
    expect(response.results[0]?.name.toLowerCase()).toContain('baconator');
    expect(response.results[0]?.calories).toBeGreaterThan(700);
  });

  it('clarifies when the only restaurant candidate conflicts with the named product', async () => {
    const resolveQuery = vi.fn(async () => resolverOutput({
      normalizedQuery: "Wendy's Baconator",
      aliases: ['wendys baconator'],
      restaurantIntent: "Wendy's",
      category: 'restaurant',
      confidence: 0.92,
    }));
    const wendysChicken: NutritionLookupProvider = {
      id: 'wendys-chicken-only',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: "Wendy's Spicy Chicken Sandwich",
        calories: 490,
        protein: 28,
        carbs: 45,
        fat: 19,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: "Wendy's official nutrition",
        provider_used: 'wendys-chicken-only',
      }), 0.9)),
    };

    const response = await buildFoodSearchResponse(
      { query: 'wendys baconator', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { ai: { resolveQuery }, providers: [wendysChicken], catalogFoods: [] },
    );

    expect(response.clarificationQuestion).toMatch(/wendy|baconator|specific menu item/i);
    expect(response.results.map((result) => result.name).join(' ')).not.toMatch(/spicy chicken/i);
  });

  it('enforces anchor tokens so McDouble cannot resolve to McChicken', async () => {
    const resolveQuery = vi.fn(async () => resolverOutput({
      normalizedQuery: 'McDouble no cheese',
      aliases: ['mcdonalds mcdouble no cheese'],
      restaurantIntent: "McDonald's",
      category: 'restaurant',
      confidence: 0.9,
    }));

    const mcdoubleProvider: NutritionLookupProvider = {
      id: 'mcdouble',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: 'McDouble (no cheese)',
        calories: 360,
        protein: 22,
        carbs: 33,
        fat: 16,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: "McDonald's official nutrition",
        provider_used: 'mcdouble',
      }), 0.92)),
    };

    const mcchickenProvider: NutritionLookupProvider = {
      id: 'mcchicken',
      lookup: vi.fn(async () => mealResponse(providerItem({
        food_name: 'McChicken',
        calories: 400,
        protein: 14,
        carbs: 40,
        fat: 21,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: "McDonald's official nutrition",
        provider_used: 'mcchicken',
      }), 0.93)),
    };

    const response = await buildFoodSearchResponse(
      { query: 'mcdouble no cheese', customFoods: [], favoriteMeals: [], recentMeals: [] },
      { ai: { resolveQuery }, providers: [mcchickenProvider, mcdoubleProvider], catalogFoods: [] },
    );

    expect(response.results[0]?.name.toLowerCase()).toContain('mcdouble');
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
    const rankCandidates = vi.fn(async (input) => {
      const restaurant = input.candidates.find((candidate) => candidate.source === 'Restaurant verified');
      return {
        orderedCandidateIds: [
          restaurant?.id,
          ...input.candidates.filter((candidate) => candidate.id !== restaurant?.id).map((candidate) => candidate.id),
        ].filter(Boolean) as string[],
        bestCandidateId: restaurant?.id ?? null,
        confidence: 0.91,
        reason: 'Restaurant intent matched the McDonald candidate.',
        shouldAskClarification: false,
        clarificationQuestion: null,
      };
    });

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
        providers: [provider('usda', 'Big Mac Meal generic reference', 780), provider('restaurant', 'Big Mac Meal', 1120)],
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
});

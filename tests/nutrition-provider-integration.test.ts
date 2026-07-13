import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { buildFoodSearchResponse, resetFoodSearchCaches } from '@/lib/food-search';
import { defaultNutritionProviders } from '@/lib/nutrition/providerRegistry';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

function providerResponse(providerId: string, options?: { calories?: number; protein?: number; carbs?: number; fat?: number; sourceName?: string; confidence?: number; foodName?: string }) {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'snack',
    confidence_score: options?.confidence ?? 0.82,
    items: [{
      food_name: options?.foodName ?? 'Barebells Creamy Crisp Protein Bar',
      quantity: 1,
      unit: 'bar',
      calories: options?.calories ?? 200,
      protein: options?.protein ?? 20,
      carbs: options?.carbs ?? 18,
      fat: options?.fat ?? 7,
      fiber: 2,
      sugar: 2,
      sodium: 150,
      is_trusted: true,
      source_type: 'GENERIC_REFERENCE',
      source_name: options?.sourceName ?? `${providerId} database`,
      confidence_label: 'Matched',
      match_type: 'exact_branded',
      provider_used: providerId,
      used_ai_fallback: false,
    }],
  });
}

function provider(id: string, implementation: NutritionLookupProvider['lookup']): NutritionLookupProvider {
  return {
    id,
    capabilities: { search: true, barcode: false, details: false, suggest: false },
    lookup: implementation,
  };
}

afterEach(() => {
  resetFoodSearchCaches();
});

describe('multi-provider resolver integration', () => {
  it('keeps curated local and USDA behavior ahead of external supporting providers', () => {
    expect(defaultNutritionProviders.map((entry) => entry.id)).toEqual([
      'local-verified-catalog',
      'usda-fdc',
      'fatsecret',
      'calorie-api',
      'commercial-database-slot',
    ]);
  });

  it('continues to a healthy provider when Calorie API fails', async () => {
    const primary = provider('local', vi.fn().mockResolvedValue(null));
    const calorie = provider('calorie-api', vi.fn().mockRejectedValue(new Error('timeout')));
    const fallback = provider('fallback', vi.fn().mockResolvedValue(providerResponse('fallback')));

    const result = await lookupNutrition(
      { text: 'one Barebells creamy crisp protein bar', mealType: 'snack' },
      { providers: [primary, calorie, fallback] },
    );
    expect(result?.items[0]).toMatchObject({ provider_used: 'fallback', calories: 200 });
  });

  it('rejects implausible provider nutrition and selects a coherent alternative', async () => {
    const primary = provider('local', vi.fn().mockResolvedValue(null));
    const invalid = provider('calorie-api', vi.fn().mockResolvedValue(providerResponse('calorie-api', {
      calories: 200,
      protein: 80,
      sourceName: 'Calorie API database',
      confidence: 0.9,
    })));
    const valid = provider('fatsecret', vi.fn().mockResolvedValue(providerResponse('fatsecret', {
      sourceName: 'FatSecret Platform',
      confidence: 0.84,
    })));

    const result = await lookupNutrition(
      { text: 'one Barebells creamy crisp protein bar', mealType: 'snack' },
      { providers: [primary, invalid, valid] },
    );
    expect(result?.items[0]).toMatchObject({ provider_used: 'fatsecret', calories: 200, protein: 20 });
  });

  it('never lets a category-rejected candidate re-enter final ranking', async () => {
    const primary = provider('local', vi.fn().mockResolvedValue(null));
    const wrongForm = provider('external', vi.fn().mockResolvedValue(providerResponse('external', {
      foodName: 'Quest Protein Powder',
      calories: 120,
      protein: 24,
      carbs: 3,
      fat: 1,
    })));

    const result = await lookupNutrition(
      { text: 'Quest nacho cheese chips', mealType: 'snack' },
      { providers: [primary, wrongForm] },
    );
    expect(result).toMatchObject({ needs_clarification: true, items: [] });
  });

  it('does not call supporting providers after an authoritative local result', async () => {
    const localLookup = vi.fn().mockResolvedValue(providerResponse('local-verified-catalog', { confidence: 0.98 }));
    const externalLookup = vi.fn().mockResolvedValue(providerResponse('calorie-api'));
    const result = await lookupNutrition(
      { text: 'one Barebells creamy crisp protein bar', mealType: 'snack' },
      { providers: [provider('local-verified-catalog', localLookup), provider('calorie-api', externalLookup)] },
    );
    expect(result?.items[0]?.provider_used).toBe('local-verified-catalog');
    expect(externalLookup).not.toHaveBeenCalled();
  });

  it('deduplicates the same branded product across FatSecret and Calorie API without mixing nutrition', async () => {
    const ai = {
      resolveQuery: vi.fn().mockResolvedValue({
        normalizedQuery: 'Barebells creamy crisp protein bar',
        aliases: [],
        brandIntent: 'Barebells',
        restaurantIntent: null,
        servingHint: 'bar',
        amountHint: '1',
        modifiers: [],
        category: 'branded',
        confidence: 0.95,
        needsDatabaseLookup: true,
        shouldAskClarification: false,
        clarificationQuestion: null,
      }),
    };
    const response = await buildFoodSearchResponse(
      { query: 'Barebells creamy crisp protein bar', customFoods: [], favoriteMeals: [], recentMeals: [], catalogFoods: [] },
      {
        ai,
        providers: [
          provider('fatsecret', vi.fn().mockResolvedValue(providerResponse('fatsecret', { sourceName: 'FatSecret Platform', confidence: 0.86 }))),
          provider('calorie-api', vi.fn().mockResolvedValue(providerResponse('calorie-api', { sourceName: 'Calorie API database', confidence: 0.8 }))),
        ],
        catalogFoods: [],
      },
    );

    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({ providerId: 'fatsecret', sourceLabel: 'Database match', calories: 200, protein: 20 });
  });
});

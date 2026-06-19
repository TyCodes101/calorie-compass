import { describe, expect, it } from 'vitest';

import type { MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedMealResponse } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { resolveNutrition } from '@/lib/nutrition/nutritionLookup';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

function buildState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'lunch',
    userName: 'Tyler',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  };
}

function providerResponse(foodName: string, sourceName: string, catalogFoodId: string | null = null): ParsedMealResponse {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'lunch',
    confidence_score: 0.98,
    items: [
      {
        food_name: foodName,
        quantity: 1,
        unit: 'sandwich',
        calories: 490,
        protein: 28,
        carbs: 49,
        fat: 21,
        fiber: 2,
        sugar: 6,
        sodium: 1080,
        notes: 'Provider result.',
        is_trusted: true,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: sourceName,
        confidence_label: 'Verified',
        match_type: 'exact_restaurant',
        matched_query: foodName,
        original_user_text: 'Wendys baconnator',
        provider_used: 'test-provider',
        used_ai_fallback: false,
        catalog_food_id: catalogFoodId,
      },
    ],
  });
}

describe('resolveNutrition food identity integration', () => {
  it('returns a resolved FoodResolutionResult for verified Baconator lookup', async () => {
    const resolution = await resolveNutrition({ text: 'I had a wendys baconator', mealType: 'lunch' });

    expect(resolution.status).toBe('resolved');
    expect(resolution.selectedCandidate?.displayName).toMatch(/baconator/i);
    expect(resolution.selectedCandidate?.displayName).not.toMatch(/chicken/i);
    expect(resolution.provenance).toMatchObject({
      sourceTrust: 'official_restaurant',
      verified: true,
    });
  });

  it('clarifies instead of accepting a wrong-only provider candidate list', async () => {
    const wrongProvider: NutritionLookupProvider = {
      id: 'wrong-wendys-provider',
      lookup: () => providerResponse("Wendy's Homestyle Chicken Fillet Sandwich", "Wendy's official nutrition", 'wendys_homestyle_chicken_sandwich'),
    };

    const resolution = await resolveNutrition(
      { text: 'Wendys baconnator', mealType: 'lunch' },
      { providers: [wrongProvider] },
    );

    expect(resolution.status).toBe('needs_clarification');
    expect(resolution.selectedCandidate).toBeNull();
    expect(resolution.rejectionReasons).toEqual(expect.arrayContaining([
      'product_family_conflict',
      'missing_protected_product_token:baconator',
    ]));
  });
});

describe('meal assistant food resolution status', () => {
  it('includes structured resolved status when a review card is safe', async () => {
    const response = await runMealAssistant({
      message: 'I had a wendys baconator',
      state: buildState(),
      context: undefined,
      conversationHistory: [],
    });

    expect(response.food_resolution?.status).toBe('resolved');
    expect(response.next_state.pendingMeal?.status).toBe('ready_for_review');
    expect(response.next_state.pendingMeal?.items.map((item) => item.food_name).join(' ')).toMatch(/baconator/i);
    expect(response.next_state.pendingMeal?.items.map((item) => item.food_name).join(' ')).not.toMatch(/chicken/i);
  });

  it('includes structured clarification status and no stale review card for unsafe resolver output', async () => {
    const wrongResolver = async () => providerResponse("Wendy's Homestyle Chicken Fillet Sandwich", "Wendy's official nutrition", 'wendys_homestyle_chicken_sandwich');
    const classify = async (): Promise<MealAssistantModelOutput> => ({
      intent: 'new_food_item',
      assistant_reply: 'Got it.',
      action: 'add_food',
      items: [{ name: 'Baconator', brand: "Wendy's", quantity: 1, unit: 'burger', modifiers: [], action: 'add' }],
      corrections: [],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    });

    const response = await runMealAssistant(
      {
        message: "that Wendy burger I meant",
        state: buildState(),
        context: undefined,
        conversationHistory: [],
      },
      {
        classify,
        resolveItemNutrition: wrongResolver,
      },
    );

    expect(response.food_resolution?.status).toBe('needs_clarification');
    expect(response.should_ask_clarification).toBe(true);
    expect(response.next_state.pendingMeal?.status).toBe('needs_clarification');
    expect(response.next_state.pendingMeal?.items).toEqual([]);
  });
});

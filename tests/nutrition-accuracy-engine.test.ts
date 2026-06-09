import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

const allowedVerificationLabels = ['Verified', 'Matched', 'Estimated', 'Needs Review'];

function buildState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'lunch',
    userName: 'Tyler Cox',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  };
}

function buildDecision(overrides?: Partial<MealAssistantModelOutput>): MealAssistantModelOutput {
  return {
    intent: 'new_food_item',
    assistant_reply: 'Got it.',
    items: [],
    corrections: [],
    should_lookup_nutrition: false,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'high',
    ...overrides,
  };
}

function buildItem(overrides: Partial<ParsedFoodItem>): ParsedFoodItem {
  return {
    food_name: 'Food item',
    quantity: 1,
    unit: 'serving',
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 3,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    notes: null,
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Test nutrition source',
    confidence_label: 'Matched',
    matched_query: null,
    original_user_text: null,
    provider_used: null,
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

function buildMeal(items: ParsedFoodItem[], confidenceScore = 0.84): ParsedMealResponse {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'snack',
    confidence_score: confidenceScore,
    items,
  });
}

function buildClarification(question: string): ParsedMealResponse {
  return normalizeParsedMealResponse({
    needs_clarification: true,
    clarifying_question: question,
    meal_type: 'snack',
    confidence_score: 0.35,
    items: [],
  });
}

function provider(id: string, response: ParsedMealResponse | null): NutritionLookupProvider {
  return {
    id,
    lookup: vi.fn(() => response),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('nutrition accuracy engine', () => {
  it('does_not_match_quest_protein_chips_to_generic_chips', async () => {
    const genericChips = buildMeal([
      buildItem({
        food_name: 'Potato chips',
        calories: 160,
        protein: 2,
        carbs: 15,
        fat: 10,
        source_name: 'Generic nutrition reference',
        confidence_label: 'Matched',
      }),
    ]);
    const questChips = buildMeal([
      buildItem({
        food_name: 'Quest BBQ Protein Chips',
        quantity: 1,
        unit: 'bag',
        calories: 140,
        protein: 19,
        carbs: 5,
        fat: 5,
        source_name: 'Quest nutrition reference',
        confidence_label: 'Verified',
        match_type: 'exact_branded',
      }),
    ], 0.95);

    const response = await lookupNutrition(
      { text: 'Quest Protein Chips', mealType: 'snack' },
      { providers: [provider('generic-first', genericChips), provider('quest-second', questChips)] },
    );

    expect(response?.needs_clarification).toBe(false);
    expect(response?.items[0]).toMatchObject({
      food_name: 'Quest BBQ Protein Chips',
      protein: 19,
      confidence_label: 'Verified',
    });
  });

  it.each([
    ['Skittles', 'Snickers Bar', 'Skittles'],
    ['Coke Zero', 'Coca-Cola Classic', 'Coke Zero'],
    ['McDouble', 'Generic hamburger', "McDonald's"],
    ['Fairlife Protein Shake', 'Whole milk', 'Fairlife'],
  ])('rejects unsafe substitution for %s', async (query, unsafeName, expectedClarificationText) => {
    const unsafeResponse = buildMeal([
      buildItem({
        food_name: unsafeName,
        calories: query === 'Coke Zero' ? 140 : 250,
        protein: query === 'Fairlife Protein Shake' ? 4 : 6,
        carbs: query === 'Coke Zero' ? 39 : 30,
        fat: query === 'Coke Zero' ? 0 : 10,
        source_name: 'Generic nutrition reference',
        confidence_label: 'Matched',
      }),
    ]);

    const response = await lookupNutrition(
      { text: query, mealType: 'snack' },
      { providers: [provider('unsafe', unsafeResponse)] },
    );

    expect(response).toMatchObject({
      needs_clarification: true,
      items: [],
    });
    expect(response?.clarifying_question).toMatch(new RegExp(expectedClarificationText, 'i'));
  });

  it.each(['chips', 'protein shake', 'salad', 'bowl', 'sandwich', 'fries'])(
    'requires clarification for ambiguous %s before nutrition is presented',
    async (query) => {
      const response = await lookupNutrition({ text: query, mealType: 'snack' });

      expect(response).toMatchObject({
        needs_clarification: true,
        items: [],
      });
      expect(response?.clarifying_question).toMatch(/which|what|brand|restaurant|serving|size|how much/i);
    },
  );

  it('rejects a protein product with implausibly low protein', async () => {
    const weakProteinShake = buildMeal([
      buildItem({
        food_name: 'Fairlife Protein Shake',
        calories: 150,
        protein: 4,
        carbs: 12,
        fat: 8,
        source_name: 'Fairlife nutrition reference',
        confidence_label: 'Verified',
      }),
    ]);

    const response = await lookupNutrition(
      { text: 'Fairlife Protein Shake', mealType: 'snack' },
      { providers: [provider('bad-protein', weakProteinShake)] },
    );

    expect(response).toMatchObject({
      needs_clarification: true,
      items: [],
    });
    expect(response?.clarifying_question).toMatch(/protein|macros|exact/i);
  });

  it('rejects macro totals that do not roughly align with calories', async () => {
    const impossibleMacros = buildMeal([
      buildItem({
        food_name: 'Granola bar',
        calories: 100,
        protein: 30,
        carbs: 30,
        fat: 30,
        source_name: 'Generic nutrition reference',
        confidence_label: 'Matched',
      }),
    ]);

    const response = await lookupNutrition(
      { text: 'granola bar', mealType: 'snack' },
      { providers: [provider('macro-conflict', impossibleMacros)] },
    );

    expect(response).toMatchObject({
      needs_clarification: true,
      items: [],
    });
    expect(response?.clarifying_question).toMatch(/macros|calories|serving/i);
  });

  it('returns only verification labels from the resolver', async () => {
    const response = await lookupNutrition(
      { text: 'banana', mealType: 'snack' },
      {
        providers: [
          provider('database-match', buildMeal([
            buildItem({
              food_name: 'Banana',
              calories: 105,
              protein: 1,
              carbs: 27,
              fat: 0,
              source_name: 'USDA FoodData Central',
              confidence_label: 'High confidence',
            }),
          ])),
        ],
      },
    );

    expect(response?.items[0]?.confidence_label).toBe('Matched');
    expect(allowedVerificationLabels).toContain(response?.items[0]?.confidence_label);
  });

  it('preserves review-before-save when lookup requires clarification', async () => {
    const classify = vi.fn().mockResolvedValue(buildDecision({
      intent: 'new_food_item',
      assistant_reply: 'I can save that.',
      should_lookup_nutrition: true,
      should_save_meal: true,
      items: [{ name: 'chips', brand: null, quantity: 1, unit: 'serving', modifiers: [], action: 'add' }],
    }));
    const resolveItemNutrition = vi.fn().mockResolvedValue(buildClarification('Which chips and serving size should I use?'));
    const saveMeal = vi.fn().mockResolvedValue(undefined);

    const response = await runMealAssistant(
      { message: 'chips, save it', state: buildState() },
      { classify, resolveItemNutrition, saveMeal },
    );

    expect(response.should_ask_clarification).toBe(true);
    expect(response.next_state.pendingClarification).toMatch(/chips/i);
    expect(response.next_state.saved).toBe(false);
    expect(saveMeal).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MealAssistantModelOutput } from '@/lib/ai/mealAssistantSchema';
import { createFoodPipelineTrace } from '@/lib/ai/foodPipelineTrace';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import { computeServingScaleFactor } from '@/lib/nutrition/scaling';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

import { buildQaState, runQaScenario } from './utils/assistantQaHarness';

function response(item: ParsedFoodItem): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'snack',
    confidence_score: 0.92,
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

function makeItem(overrides: Partial<ParsedFoodItem> = {}): ParsedFoodItem {
  return {
    food_name: 'Example protein bar',
    quantity: 1,
    unit: 'bar',
    calories: 210,
    protein: 20,
    carbs: 20,
    fat: 7,
    fiber: 5,
    sugar: 4,
    sodium: 210,
    notes: 'Controlled provider fixture.',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Controlled nutrition provider',
    confidence_label: 'Matched',
    match_type: 'exact_branded',
    matched_query: 'Example protein bar',
    original_user_text: null,
    provider_used: 'controlled-provider',
    used_ai_fallback: false,
    catalog_food_id: null,
    providerCandidateId: 'controlled:example-bar',
    ...overrides,
  };
}

function buildClassifier(overrides: Partial<MealAssistantModelOutput> = {}) {
  return async (): Promise<MealAssistantModelOutput> => ({
    intent: 'new_food_item',
    action: 'add_food',
    operations: [],
    assistant_reply: 'I found a possible match. Review it below before saving.',
    contains_food_to_log: true,
    contains_quantity_update: false,
    target_item: null,
    target_item_id: null,
    target_item_index: null,
    should_mutate_pending_meal: true,
    assistant_reply_goal: 'Prepare a reviewable meal.',
    items: [],
    corrections: [],
    should_lookup_nutrition: true,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'medium',
    ...overrides,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('fresh food pipeline regressions', () => {
  it('uses a cautious category estimate for one unfamiliar protein bar without the old 520-calorie default', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const result = await runMealAssistant({
      message: 'One Barebells creamy crisp protein bar',
      state: buildQaState(),
    });

    const loggedItem = result.meal.items[0];
    expect(result.meal.items).toHaveLength(1);
    expect(loggedItem?.quantity).toBe(1);
    expect(loggedItem?.unit).toBe('bar');
    expect(loggedItem?.source_type).toBe('AI_ESTIMATE');
    expect(loggedItem?.confidence_label).toBe('Estimated');
    expect(loggedItem?.calories).toBeLessThan(450);
    expect(result.assistant_reply).not.toMatch(/\b(?:saved|logged)\b/i);
  });

  it('scales two bars exactly twice and never treats the bar weight as a quantity', () => {
    const oneBar = computeServingScaleFactor({
      requestedQuantity: 1,
      requestedUnit: 'bar',
      providerServingQuantity: 1,
      providerServingUnit: 'bar',
    });
    const twoBars = computeServingScaleFactor({
      requestedQuantity: 2,
      requestedUnit: 'bar',
      providerServingQuantity: 1,
      providerServingUnit: 'bar',
    });
    const oneBarFromWeight = computeServingScaleFactor({
      requestedQuantity: 1,
      requestedUnit: 'bar',
      providerServingQuantity: 55,
      providerServingUnit: 'g',
    });

    expect(oneBar?.scaleFactor).toBe(1);
    expect(twoBars?.scaleFactor).toBe(2);
    expect(oneBarFromWeight).toBeNull();
  });

  it('rejects an implausible protein-bar candidate and selects the next valid provider candidate', async () => {
    const rejectedProvider: NutritionLookupProvider = {
      id: 'bad-provider',
      lookup: () => response(makeItem({
        food_name: 'Generic protein bar',
        calories: 520,
        protein: 28,
        carbs: 45,
        fat: 20,
        providerCandidateId: 'bad:520-bar',
      })),
    };
    const validProvider: NutritionLookupProvider = {
      id: 'valid-provider',
      lookup: () => response(makeItem({
        food_name: 'Verified protein bar',
        calories: 210,
        protein: 20,
        carbs: 20,
        fat: 7,
        providerCandidateId: 'valid:210-bar',
      })),
    };
    const trace = createFoodPipelineTrace({ requestId: 'fresh-bar-test' });
    const result = await lookupNutrition(
      { text: 'one protein bar', mealType: 'snack' },
      { providers: [rejectedProvider, validProvider], trace },
    );

    expect(result?.items[0]?.food_name).toBe('Verified protein bar');
    expect(trace.selectedCandidateId).toBe('valid:210-bar');
    expect(trace.plausibilityOutcome).toBe('passed');
  });

  it('retains GT kombucha identity while quantity clarification is answered', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const conversation = await runQaScenario({
      name: 'GT kombucha volume clarification',
      messages: ["One bottle of GT's Trilogy kombucha", '2 bottles', '16 oz each'],
    });

    const [initial, quantity, completed] = conversation.turns;
    expect(initial.response.next_state.pendingClarificationDetails?.missingFields).toContain('volumePerBottle');
    expect(quantity.response.next_state.pendingClarificationDetails?.knownFields).toMatchObject({ quantity: '2', unit: 'bottle' });
    expect(quantity.assistantReply).toMatch(/what size is each bottle|16 oz/i);
    expect(completed.response.meal.items).toHaveLength(1);
    expect(completed.response.meal.items[0]?.quantity).toBe(2);
    expect(completed.response.meal.items[0]?.unit).toBe('bottle');
    expect(completed.response.meal.items[0]?.food_name).toMatch(/trilogy|kombucha/i);
  });

  it('does not repeat the broad LesserEvil clarification after the user says one serving', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const conversation = await runQaScenario({
      name: 'LesserEvil serving clarification',
      messages: ['A bag of LesserEvil Himalayan pink salt popcorn', '1 serving'],
    });

    const [initial, answer] = conversation.turns;
    expect(initial.response.next_state.pendingClarificationDetails?.missingFields).toContain('servingWeight');
    expect(answer.response.next_state.pendingClarificationDetails?.knownFields).toMatchObject({ quantity: '1', unit: 'serving' });
    expect(answer.assistantReply).toMatch(/weight.*one serving|28g|scan the label/i);
    expect(answer.assistantReply).not.toBe(initial.assistantReply);
  });

  it('treats no bun as a scoped modifier and preserves review before save when the model misclassifies it', async () => {
    const saves: ParsedFoodItem[][] = [];
    const classify = buildClassifier({
      intent: 'meal_review',
      action: 'answer_question',
      assistant_reply: "I didn't add that burger.",
      contains_food_to_log: false,
      should_lookup_nutrition: false,
      should_mutate_pending_meal: false,
    });
    const resolveItemNutrition = async ({ item: requested }: { item: { name: string; quantity: number; unit: string | null; modifiers: string[] } }) => response(makeItem({
      food_name: "Culver's Single ButterBurger without bun",
      quantity: requested.quantity,
      unit: requested.unit ?? 'burger',
      calories: 390,
      protein: 24,
      carbs: 5,
      fat: 28,
      source_type: 'AI_ESTIMATE',
      source_name: "Culver's modifier estimate",
      confidence_label: 'Needs Review',
      is_trusted: false,
      used_ai_fallback: true,
    }));
    const first = await runMealAssistant(
      { message: "Culver's single butterburger with no bun", state: buildQaState() },
      { classify, resolveItemNutrition, saveMeal: async ({ items }) => { saves.push(items); } },
    );

    expect(first.meal.items).toHaveLength(1);
    expect(first.meal.items[0]?.food_name).toMatch(/without bun/i);
    expect(first.next_state.pendingMeal?.status).toBe('readyForReview');
    expect(first.assistant_reply).toMatch(/review|saving/i);
    expect(first.assistant_reply).not.toMatch(/didn't add|no meal/i);

    const saved = await runMealAssistant(
      { message: 'Log it', state: first.next_state },
      { classify, resolveItemNutrition, saveMeal: async ({ items }) => { saves.push(items); } },
    );
    expect(saved.next_state.saved).toBe(true);
    expect(saved.should_save_meal).toBe(true);
    expect(saves).toHaveLength(1);
    expect(saves[0]?.[0]?.food_name).toMatch(/without bun/i);
  });

  it('clears clarification state before an unrelated new request', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const conversation = await runQaScenario({
      name: 'clarification reset isolation',
      messages: ["One bottle of GT's Trilogy kombucha", '2 bottles', 'start over', 'one banana'],
    });
    const [, , reset, next] = conversation.turns;

    expect(reset.response.next_state.pendingClarification).toBeNull();
    expect(reset.response.next_state.pendingClarificationDetails).toBeNull();
    expect(next.response.next_state.pendingClarification).toBeNull();
    expect(next.response.meal.items).toHaveLength(1);
    expect(next.response.meal.items[0]?.food_name).toMatch(/banana/i);
    expect(next.response.meal.items[0]?.quantity).toBe(1);
  });
});

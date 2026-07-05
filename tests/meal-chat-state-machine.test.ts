import { describe, expect, it, vi } from 'vitest';

import type { MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

type PendingMealSnapshot = {
  id: string;
  version: number;
  status: string;
  mealType: MealAssistantState['mealType'];
  displayTitle: string;
  rawText: string | null;
  items: ParsedFoodItem[];
  totals: ParsedMealResponse['totals'];
  confidenceScore: number;
  idempotencyKey?: string | null;
};

function buildState(overrides?: Partial<MealAssistantState> & { pendingMeal?: PendingMealSnapshot | null }): MealAssistantState {
  return {
    currentMealItems: [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'snack',
    userName: 'Tyler Cox',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  } as MealAssistantState;
}

function item(overrides: Partial<ParsedFoodItem> & { food_name: string; calories: number }): ParsedFoodItem {
  return {
    food_name: overrides.food_name,
    quantity: overrides.quantity ?? 1,
    unit: overrides.unit ?? 'serving',
    calories: overrides.calories,
    protein: overrides.protein ?? 0,
    carbs: overrides.carbs ?? 0,
    fat: overrides.fat ?? 0,
    fiber: overrides.fiber ?? 0,
    sugar: overrides.sugar ?? 0,
    sodium: overrides.sodium ?? 0,
    notes: overrides.notes ?? 'Estimated from generic food references.',
    is_trusted: overrides.is_trusted ?? true,
    source_type: overrides.source_type ?? 'GENERIC_REFERENCE',
    source_name: overrides.source_name ?? 'Generic reference',
    confidence_label: overrides.confidence_label ?? 'Estimated',
    matched_query: overrides.matched_query ?? null,
    original_user_text: overrides.original_user_text ?? null,
    provider_used: overrides.provider_used ?? null,
    used_ai_fallback: overrides.used_ai_fallback ?? false,
    catalog_food_id: overrides.catalog_food_id ?? null,
    ...overrides,
  };
}

function meal(items: ParsedFoodItem[], mealType: MealAssistantState['mealType']): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: 0.84,
    items,
    totals: {
      calories: items.reduce((sum, candidate) => sum + candidate.calories, 0),
      protein: items.reduce((sum, candidate) => sum + candidate.protein, 0),
      carbs: items.reduce((sum, candidate) => sum + candidate.carbs, 0),
      fat: items.reduce((sum, candidate) => sum + candidate.fat, 0),
      fiber: items.reduce((sum, candidate) => sum + candidate.fiber, 0),
      sugar: items.reduce((sum, candidate) => sum + candidate.sugar, 0),
      sodium: items.reduce((sum, candidate) => sum + candidate.sodium, 0),
    },
  };
}

function classifier(overrides?: Partial<MealAssistantModelOutput>) {
  return vi.fn(async ({ message }: { message: string; state: MealAssistantState }) => {
    const normalized = message.toLowerCase();
    const macroQuestion = /\b(?:where'?s|provide|probide|macros?|calories?|protein)\b/i.test(normalized);
    const mealTypeCorrection = /\b(?:actually|for|make that|change that)\b.*\b(?:breakfast|lunch|dinner|snack)\b/i.test(normalized);

    return {
      intent: macroQuestion ? 'macro_question' : mealTypeCorrection ? 'correction' : 'new_food_item',
      action: macroQuestion ? 'answer_question' : mealTypeCorrection ? 'update_item_name' : 'add_food',
      assistant_reply: macroQuestion ? 'Here are the macros.' : mealTypeCorrection ? 'Updated.' : 'Got it.',
      contains_food_to_log: !macroQuestion && !mealTypeCorrection,
      contains_quantity_update: false,
      items: macroQuestion || mealTypeCorrection
        ? []
        : [
            { name: 'grilled chicken breast', brand: null, quantity: 1, unit: 'serving', modifiers: [], action: 'add' },
            { name: 'asparagus', brand: null, quantity: 1, unit: 'serving', modifiers: [], action: 'add' },
          ],
      corrections: mealTypeCorrection ? [{ target: 'meal type', change: message }] : [],
      should_lookup_nutrition: !macroQuestion && !mealTypeCorrection,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
      ...overrides,
    } satisfies MealAssistantModelOutput;
  });
}

async function resolveNutrition(args: { item: { name: string; quantity: number }; mealType: MealAssistantState['mealType'] }) {
  const normalized = args.item.name.toLowerCase();
  if (normalized.includes('chicken')) {
    return meal([
      item({
        food_name: 'Grilled chicken breast',
        quantity: args.item.quantity,
        unit: 'serving',
        calories: 187 * args.item.quantity,
        protein: 35 * args.item.quantity,
        carbs: 0,
        fat: 4,
      }),
    ], args.mealType);
  }
  if (normalized.includes('asparagus') || normalized.includes('asaparagud')) {
    return meal([
      item({
        food_name: 'Asparagus',
        quantity: args.item.quantity,
        unit: 'serving',
        calories: 40 * args.item.quantity,
        protein: 4 * args.item.quantity,
        carbs: 7 * args.item.quantity,
        fat: 0,
      }),
    ], args.mealType);
  }
  if (normalized.includes('rice')) {
    return meal([
      item({
        food_name: 'Rice',
        quantity: args.item.quantity,
        unit: 'cup',
        calories: 205 * args.item.quantity,
        protein: 4 * args.item.quantity,
        carbs: 45 * args.item.quantity,
        fat: 0,
      }),
    ], args.mealType);
  }
  return null;
}

function pendingMeal(state: MealAssistantState): PendingMealSnapshot {
  return (state as MealAssistantState & { pendingMeal?: PendingMealSnapshot | null }).pendingMeal!;
}

describe('log chat pending meal state machine', () => {
  it('creates a breakfast pending review with macros when Breakfast is selected', async () => {
    const response = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState({ mealType: 'breakfast' }) },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(response.meal.items.map((candidate) => candidate.food_name)).toEqual(['Grilled chicken breast', 'Asparagus']);
    expect(response.meal.totals.calories).toBe(227);
    expect(response.next_state.mealType).toBe('breakfast');
    expect(pendingMeal(response.next_state).status).toBe('readyForReview');
    expect(pendingMeal(response.next_state).mealType).toBe('breakfast');
    expect(pendingMeal(response.next_state).totals.calories).toBe(227);
    expect(response.assistant_reply).toMatch(/^Ready to review/i);
    expect(response.assistant_reply).not.toMatch(/\bnoted\b|\blogged\b/i);
  });

  it('creates a snack pending review from typo food text and uses the selected Snack chip', async () => {
    const response = await runMealAssistant(
      { message: 'Chicken with asaparagud.', state: buildState({ mealType: 'snack' }) },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(response.next_state.mealType).toBe('snack');
    expect(pendingMeal(response.next_state).status).toBe('readyForReview');
    expect(pendingMeal(response.next_state).items.map((candidate) => candidate.food_name)).toEqual(['Grilled chicken breast', 'Asparagus']);
    expect(response.assistant_reply).toMatch(/Ready to review|Save when it looks right/i);
  });

  it('updates an active pending meal when the user corrects the meal period', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState({ mealType: 'snack' }) },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    const correction = await runMealAssistant(
      { message: 'It was for dinner actually', state: initial.next_state },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(correction.next_state.mealType).toBe('dinner');
    expect(pendingMeal(correction.next_state).mealType).toBe('dinner');
    expect(pendingMeal(correction.next_state).version).toBe(pendingMeal(initial.next_state).version + 1);
    expect(correction.meal.items).toHaveLength(2);
    expect(correction.assistant_reply).toMatch(/updated.*dinner|dinner.*pending estimate/i);
  });

  it('answers macro requests from pending review state before the meal is saved', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState({ mealType: 'snack' }) },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    const macro = await runMealAssistant(
      { message: "where's my macros", state: initial.next_state },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(macro.intent).toBe('macro_question');
    expect(macro.meal.items).toHaveLength(2);
    expect(macro.assistant_reply).toMatch(/Pending review estimate/i);
    expect(macro.assistant_reply).toMatch(/227|35|39/i);
    expect(macro.assistant_reply).not.toMatch(/haven'?t logged|no foods logged/i);
  });

  it('treats typo macro requests as macro requests against pending state', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState() },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    const macro = await runMealAssistant(
      { message: 'Probide macros', state: initial.next_state },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(macro.intent).toBe('macro_question');
    expect(macro.assistant_reply).toMatch(/Pending review estimate/i);
    expect(macro.assistant_reply).not.toMatch(/haven'?t logged|no foods logged/i);
  });

  it('says no foods are logged only when there is no pending or saved meal state', async () => {
    const response = await runMealAssistant(
      { message: "where's my macros", state: buildState({ currentMealItems: [], saved: false }) },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(response.intent).toBe('macro_question');
    expect(response.meal.items).toEqual([]);
    expect(response.assistant_reply).toMatch(/no foods logged|haven'?t logged/i);
  });

  it('asks what food to update when meal-period correction has no active pending meal', async () => {
    const response = await runMealAssistant(
      { message: 'Actually lunch', state: buildState({ currentMealItems: [] }) },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(response.intent).toBe('correction');
    expect(response.meal.items).toEqual([]);
    expect(response.assistant_reply).toMatch(/what food|meal to update|log for lunch/i);
  });

  it('discards pending state on delete commands and future macros are empty', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState() },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    const deleted = await runMealAssistant(
      { message: 'delete that nvm', state: initial.next_state },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );
    const macro = await runMealAssistant(
      { message: 'provide macros', state: deleted.next_state },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(deleted.next_state.currentMealItems).toEqual([]);
    expect((deleted.next_state as MealAssistantState & { pendingMeal?: PendingMealSnapshot | null }).pendingMeal?.status).toBe('discarded');
    expect(macro.assistant_reply).toMatch(/no foods logged|haven'?t logged/i);
  });

  it('adds rice to the active pending meal and updates totals', async () => {
    const addRiceClassifier = classifier({
      intent: 'add_to_current_meal',
      action: 'add_food',
      items: [{ name: 'rice', brand: null, quantity: 1, unit: 'cup', modifiers: [], action: 'add' }],
      should_lookup_nutrition: true,
      contains_food_to_log: true,
    });
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState() },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    const updated = await runMealAssistant(
      { message: 'Add rice to that', state: initial.next_state },
      { classify: addRiceClassifier, resolveItemNutrition: resolveNutrition },
    );

    expect(updated.next_state.currentMealItems.map((candidate) => candidate.food_name)).toEqual(['Grilled chicken breast', 'Asparagus', 'Rice']);
    expect(pendingMeal(updated.next_state).items).toHaveLength(3);
    expect(pendingMeal(updated.next_state).totals.calories).toBe(432);
    expect(pendingMeal(updated.next_state).version).toBeGreaterThan(pendingMeal(initial.next_state).version);
  });

  it('does not invent a sauce removal when no pending item has sauce', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState() },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    const noSauce = await runMealAssistant(
      { message: 'no sauce', state: initial.next_state },
      { classify: classifier({ intent: 'correction', action: 'remove_item', items: [], should_lookup_nutrition: false }) },
    );

    expect(noSauce.meal.items).toHaveLength(2);
    expect(pendingMeal(noSauce.next_state).items).toHaveLength(2);
    expect(noSauce.assistant_reply).toMatch(/sauce|which item|nothing.*sauce|didn/i);
  });

  it('saves a pending meal exactly once and marks the pending meal saved', async () => {
    const saveMeal = vi.fn(async () => undefined);
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState() },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    const saved = await runMealAssistant(
      { message: 'save it', state: initial.next_state },
      { classify: classifier({ intent: 'save_meal', action: 'save_meal', should_save_meal: true }), resolveItemNutrition: resolveNutrition, saveMeal },
    );
    const duplicate = await runMealAssistant(
      { message: 'save it', state: saved.next_state },
      { classify: classifier({ intent: 'save_meal', action: 'save_meal', should_save_meal: true }), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    expect(saveMeal).toHaveBeenCalledTimes(1);
    expect(saved.should_save_meal).toBe(true);
    expect(pendingMeal(saved.next_state).status).toBe('saved');
    expect(duplicate.assistant_reply).toMatch(/already saved/i);
  });

  it('answers macro requests from saved meal state after save', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState() },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );
    const saved = await runMealAssistant(
      { message: 'save it', state: initial.next_state },
      { classify: classifier({ intent: 'save_meal', action: 'save_meal', should_save_meal: true }), resolveItemNutrition: resolveNutrition, saveMeal: vi.fn(async () => undefined) },
    );

    const macro = await runMealAssistant(
      { message: 'provide macros', state: saved.next_state },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(macro.intent).toBe('macro_question');
    expect(macro.assistant_reply).toMatch(/Saved meal macros/i);
    expect(macro.assistant_reply).toMatch(/227|39g protein/i);
    expect(macro.assistant_reply).not.toMatch(/Pending review estimate/i);
  });

  it('restores pending meal state after app relaunch and still answers macros', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState({ mealType: 'snack' }) },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );
    const restoredState = JSON.parse(JSON.stringify(initial.next_state)) as MealAssistantState;

    const macro = await runMealAssistant(
      { message: 'macros?', state: restoredState },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect(pendingMeal(macro.next_state).status).toBe('readyForReview');
    expect(macro.assistant_reply).toMatch(/Pending review estimate/i);
    expect(macro.meal.items).toHaveLength(2);
  });

  it('marks expired pending meals stale instead of pretending anything is logged', async () => {
    const initial = await runMealAssistant(
      { message: 'Chicken with asparagus', state: buildState() },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );
    const staleState = {
      ...initial.next_state,
      pendingMeal: {
        ...pendingMeal(initial.next_state),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    } as MealAssistantState;

    const response = await runMealAssistant(
      { message: "where's my macros", state: staleState },
      { classify: classifier(), resolveItemNutrition: resolveNutrition },
    );

    expect((response.next_state as MealAssistantState & { pendingMeal?: PendingMealSnapshot | null }).pendingMeal?.status).toBe('stale');
    expect(response.meal.items).toEqual([]);
    expect(response.assistant_reply).toMatch(/too old|reviewed again|rebuild/i);
    expect(response.assistant_reply).not.toMatch(/\blogged\b/i);
  });
});

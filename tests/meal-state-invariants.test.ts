import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MealAssistantItem, MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import {
  assertResponseHasValidState,
  buildGauntletState,
  isolateFoodGauntletEnv,
  pendingMeal,
} from '@/tests/utils/foodGauntlet';

function parsedItem(overrides: Partial<ParsedFoodItem> & { food_name: string; calories: number }): ParsedFoodItem {
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
    notes: overrides.notes ?? 'Deterministic test nutrition.',
    is_trusted: overrides.is_trusted ?? true,
    source_type: overrides.source_type ?? 'GENERIC_REFERENCE',
    source_name: overrides.source_name ?? 'Test generic reference',
    confidence_label: overrides.confidence_label ?? 'Matched',
    matched_query: overrides.matched_query ?? overrides.food_name,
    original_user_text: overrides.original_user_text ?? overrides.food_name,
    provider_used: overrides.provider_used ?? 'test-resolver',
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
    confidence_score: 0.88,
    items,
    totals: {
      calories: items.reduce((sum, item) => sum + item.calories, 0),
      protein: items.reduce((sum, item) => sum + item.protein, 0),
      carbs: items.reduce((sum, item) => sum + item.carbs, 0),
      fat: items.reduce((sum, item) => sum + item.fat, 0),
      fiber: items.reduce((sum, item) => sum + item.fiber, 0),
      sugar: items.reduce((sum, item) => sum + item.sugar, 0),
      sodium: items.reduce((sum, item) => sum + item.sodium, 0),
    },
  };
}

function assistantItem(name: string, overrides?: Partial<MealAssistantItem>): MealAssistantItem {
  return {
    name,
    brand: null,
    quantity: overrides?.quantity ?? 1,
    unit: overrides?.unit ?? 'serving',
    modifiers: overrides?.modifiers ?? [],
    action: overrides?.action ?? 'add',
    ...overrides,
  };
}

function foodDecision(items: MealAssistantItem[], overrides?: Partial<MealAssistantModelOutput>): MealAssistantModelOutput {
  return {
    intent: 'new_food_item',
    action: 'add_food',
    assistant_reply: 'Ready to review.',
    contains_food_to_log: true,
    contains_quantity_update: false,
    should_mutate_pending_meal: true,
    items,
    corrections: [],
    should_lookup_nutrition: true,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'high',
    ...overrides,
  };
}

function classifier(decision: MealAssistantModelOutput) {
  return vi.fn(async () => decision);
}

async function resolveNutrition(args: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }) {
  const normalized = args.item.name.toLowerCase();
  const quantity = args.item.quantity || 1;
  if (normalized.includes('mcdouble')) {
    const noCheese = /\bno cheese|without cheese\b/.test(normalized) || args.item.modifiers.some((modifier) => /no cheese|without cheese/i.test(modifier));
    return meal([
      parsedItem({
        food_name: noCheese ? "McDonald's McDouble no cheese" : "McDonald's McDouble",
        quantity,
        unit: 'sandwich',
        calories: (noCheese ? 330 : 390) * quantity,
        protein: (noCheese ? 21 : 22) * quantity,
        carbs: 33 * quantity,
        fat: (noCheese ? 15 : 19) * quantity,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: "McDonald's official nutrition",
        confidence_label: 'Verified',
      }),
    ], args.mealType);
  }
  if (normalized.includes('chicken')) {
    return meal([
      parsedItem({
        food_name: 'Grilled chicken breast',
        quantity,
        unit: 'breast',
        calories: 187 * quantity,
        protein: 35 * quantity,
        carbs: 0,
        fat: 4 * quantity,
      }),
    ], args.mealType);
  }
  if (normalized.includes('rice')) {
    return meal([
      parsedItem({
        food_name: 'Rice',
        quantity,
        unit: 'cup',
        calories: 205 * quantity,
        protein: 4 * quantity,
        carbs: 45 * quantity,
        fat: 0,
      }),
    ], args.mealType);
  }
  if (normalized.includes('fries')) {
    return meal([
      parsedItem({
        food_name: 'Fries',
        quantity,
        unit: 'serving',
        calories: 320 * quantity,
        protein: 4 * quantity,
        carbs: 43 * quantity,
        fat: 15 * quantity,
      }),
    ], args.mealType);
  }
  if (normalized.includes('salmon')) {
    return meal([
      parsedItem({
        food_name: 'Salmon',
        quantity,
        unit: 'fillet',
        calories: 280 * quantity,
        protein: 34 * quantity,
        carbs: 0,
        fat: 16 * quantity,
      }),
    ], args.mealType);
  }
  if (normalized.includes('apple')) {
    return meal([
      parsedItem({
        food_name: 'Apple',
        quantity,
        unit: 'count',
        calories: 95 * quantity,
        protein: 0,
        carbs: 25 * quantity,
        fat: 0,
      }),
    ], args.mealType);
  }
  return null;
}

describe('pending meal state-machine invariants', () => {
  beforeEach(() => {
    isolateFoodGauntletEnv();
  });

  it('add appends to the pending meal, increments version, and saves with the edited idempotency key', async () => {
    const initial = await runMealAssistant(
      { message: 'grilled chicken breast', state: buildGauntletState({ mealType: 'dinner' }) },
      { classify: classifier(foodDecision([assistantItem('grilled chicken breast')])), resolveItemNutrition: resolveNutrition },
    );
    const initialPending = pendingMeal(initial.next_state);
    expect(initialPending?.status).toBe('readyForReview');

    const added = await runMealAssistant(
      { message: 'add rice', state: initial.next_state },
      {
        classify: classifier(foodDecision([assistantItem('rice', { unit: 'cup' })], { intent: 'add_to_current_meal' })),
        resolveItemNutrition: resolveNutrition,
      },
    );
    const editedPending = pendingMeal(added.next_state);
    expect(editedPending?.id).toBe(initialPending?.id);
    expect(editedPending?.version).toBe((initialPending?.version ?? 0) + 1);
    expect(editedPending?.idempotencyKey).toBe(`${editedPending?.id}:v${editedPending?.version}`);
    expect(added.next_state.currentMealItems.map((item) => item.food_name)).toEqual(['Grilled chicken breast', 'Rice']);
    expect(added.meal.totals.calories).toBeGreaterThan(initial.meal.totals.calories);

    const saveCalls: Array<{ state: MealAssistantState; items: ParsedFoodItem[] }> = [];
    const saveMeal = vi.fn(async (args: { state: MealAssistantState; items: ParsedFoodItem[] }) => {
      saveCalls.push(args);
    });
    const saved = await runMealAssistant(
      { message: 'save it', state: added.next_state },
      { classify: classifier(foodDecision([], { intent: 'save_meal', action: 'save_meal', should_lookup_nutrition: false, should_save_meal: true })), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    expect(saveMeal).toHaveBeenCalledTimes(1);
    expect(saveCalls[0]?.state.pendingMeal?.idempotencyKey).toBe(editedPending?.idempotencyKey);
    expect(saveCalls[0]?.state.pendingMeal?.idempotencyKey).not.toBe(initialPending?.idempotencyKey);
    expect(saveCalls[0]?.items.map((item) => item.food_name)).toEqual(['Grilled chicken breast', 'Rice']);
    expect(pendingMeal(saved.next_state)?.status).toBe('saved');
  });

  it('replace swaps the pending meal contents instead of appending stale items', async () => {
    const initial = await runMealAssistant(
      { message: 'chicken and rice', state: buildGauntletState() },
      { classify: classifier(foodDecision([assistantItem('grilled chicken breast'), assistantItem('rice')])), resolveItemNutrition: resolveNutrition },
    );

    const replaced = await runMealAssistant(
      { message: 'replace with salmon', state: initial.next_state },
      {
        classify: classifier(foodDecision([assistantItem('salmon')], { intent: 'correction', action: 'update_item_name' })),
        resolveItemNutrition: resolveNutrition,
      },
    );

    expect(replaced.next_state.currentMealItems.map((item) => item.food_name)).toEqual(['Salmon']);
    expect(pendingMeal(replaced.next_state)?.items.map((item) => item.food_name)).toEqual(['Salmon']);
    expect(pendingMeal(replaced.next_state)?.version).toBeGreaterThan(pendingMeal(initial.next_state)?.version ?? 0);
    expect(replaced.assistant_reply).toMatch(/review|changed|updated|save/i);
  });

  it('macro questions and normal follow-up questions never save or clear pending review', async () => {
    const saveMeal = vi.fn(async () => undefined);
    const initial = await runMealAssistant(
      { message: 'grilled chicken breast', state: buildGauntletState() },
      { classify: classifier(foodDecision([assistantItem('grilled chicken breast')])), resolveItemNutrition: resolveNutrition, saveMeal },
    );
    const initialPending = pendingMeal(initial.next_state);

    const macro = await runMealAssistant(
      { message: "where's my macros", state: initial.next_state },
      { classify: classifier(foodDecision([], { intent: 'macro_question', action: 'answer_question', should_lookup_nutrition: false })), resolveItemNutrition: resolveNutrition, saveMeal },
    );
    const protein = await runMealAssistant(
      { message: 'how much protein is this', state: macro.next_state },
      { classify: classifier(foodDecision([], { intent: 'macro_question', action: 'answer_question', should_lookup_nutrition: false })), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    expect(saveMeal).not.toHaveBeenCalled();
    expect(pendingMeal(macro.next_state)?.id).toBe(initialPending?.id);
    expect(pendingMeal(protein.next_state)?.id).toBe(initialPending?.id);
    expect(pendingMeal(protein.next_state)?.status).toBe('readyForReview');
    expect(protein.next_state.currentMealItems.map((item) => item.food_name)).toEqual(['Grilled chicken breast']);
  });

  it('cancelled meals cannot be saved by a later confirmation until a new meal is rebuilt', async () => {
    const saveMeal = vi.fn(async () => undefined);
    const initial = await runMealAssistant(
      { message: 'grilled chicken breast', state: buildGauntletState() },
      { classify: classifier(foodDecision([assistantItem('grilled chicken breast')])), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    const discarded = await runMealAssistant(
      { message: 'start over', state: initial.next_state },
      { classify: classifier(foodDecision([], { intent: 'start_new_meal', action: 'unclear', should_lookup_nutrition: false })), resolveItemNutrition: resolveNutrition, saveMeal },
    );
    const saveAfterCancel = await runMealAssistant(
      { message: 'yes', state: discarded.next_state },
      { classify: classifier(foodDecision([], { intent: 'save_meal', action: 'save_meal', should_lookup_nutrition: false, should_save_meal: true })), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    expect(saveMeal).not.toHaveBeenCalled();
    expect(pendingMeal(discarded.next_state)?.status).toBe('discarded');
    expect(saveAfterCancel.next_state.currentMealItems).toEqual([]);
    expect(saveAfterCancel.next_state.saved).toBe(false);
  });

  it('failed saves keep the same pending idempotency key and remain retryable', async () => {
    const saveKeys: Array<string | null | undefined> = [];
    const saveMeal = vi.fn(async (args: { state: MealAssistantState; items: ParsedFoodItem[] }) => {
      saveKeys.push(args.state.pendingMeal?.idempotencyKey);
      if (saveKeys.length === 1) {
        throw new Error('temporary database outage');
      }
    });
    const initial = await runMealAssistant(
      { message: 'grilled chicken breast', state: buildGauntletState() },
      { classify: classifier(foodDecision([assistantItem('grilled chicken breast')])), resolveItemNutrition: resolveNutrition },
    );
    const keyBeforeSave = pendingMeal(initial.next_state)?.idempotencyKey;

    const failed = await runMealAssistant(
      { message: 'save it', state: initial.next_state },
      { classify: classifier(foodDecision([], { intent: 'save_meal', action: 'save_meal', should_lookup_nutrition: false, should_save_meal: true })), resolveItemNutrition: resolveNutrition, saveMeal },
    );
    const retried = await runMealAssistant(
      { message: 'save it', state: failed.next_state },
      { classify: classifier(foodDecision([], { intent: 'save_meal', action: 'save_meal', should_lookup_nutrition: false, should_save_meal: true })), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    expect(saveMeal).toHaveBeenCalledTimes(2);
    expect(saveKeys).toEqual([keyBeforeSave, keyBeforeSave]);
    expect(failed.should_save_meal).toBe(false);
    expect(failed.next_state.saved).toBe(false);
    expect(pendingMeal(failed.next_state)?.status).toBe('failed');
    expect(pendingMeal(retried.next_state)?.status).toBe('saved');
    expect(retried.should_save_meal).toBe(true);
  });

  it('a new food after a saved meal starts a clean pending meal without stale items', async () => {
    const saveMeal = vi.fn(async () => undefined);
    const initial = await runMealAssistant(
      { message: 'grilled chicken breast', state: buildGauntletState() },
      { classify: classifier(foodDecision([assistantItem('grilled chicken breast')])), resolveItemNutrition: resolveNutrition, saveMeal },
    );
    const saved = await runMealAssistant(
      { message: 'save it', state: initial.next_state },
      { classify: classifier(foodDecision([], { intent: 'save_meal', action: 'save_meal', should_lookup_nutrition: false, should_save_meal: true })), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    const nextMeal = await runMealAssistant(
      { message: 'salmon', state: saved.next_state },
      { classify: classifier(foodDecision([assistantItem('salmon')])), resolveItemNutrition: resolveNutrition, saveMeal },
    );

    assertResponseHasValidState(nextMeal, 'salmon after saved meal');
    expect(nextMeal.next_state.saved).toBe(false);
    expect(nextMeal.next_state.currentMealItems.map((item) => item.food_name)).toEqual(['Salmon']);
    expect(pendingMeal(nextMeal.next_state)?.status).toBe('readyForReview');
    expect(pendingMeal(nextMeal.next_state)?.id).not.toBe(pendingMeal(saved.next_state)?.id);
  });
});

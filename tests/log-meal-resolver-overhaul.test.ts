import { describe, expect, it } from 'vitest';

import { parseLogMealIntent } from '@/lib/ai/logMealIntent';
import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import {
  addPendingMealItems,
  cancelPendingMeal,
  createPendingMeal,
  buildPendingMealSaveIdempotencyKey,
  markPendingMealNeedsClarification,
  markPendingMealSaved,
  preservePendingMeal,
  replacePendingMealItems,
} from '@/lib/ai/pendingMeal';
import type { ParsedFoodItem } from '@/lib/ai/types';

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
    lastAssistantReply: null,
    activeTopic: null,
    activeMode: null,
    activeQuestion: null,
    previousIntent: null,
    previousUserMessage: null,
    ...overrides,
  };
}

function item(food_name: string, calories: number): ParsedFoodItem {
  return {
    food_name,
    quantity: 1,
    unit: 'serving',
    calories,
    protein: 10,
    carbs: 10,
    fat: 5,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    notes: null,
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Test reference',
    confidence_label: 'Verified',
    matched_query: null,
    original_user_text: null,
    provider_used: null,
    used_ai_fallback: false,
    catalog_food_id: null,
  };
}

describe('deterministic log meal intent', () => {
  it.each([
    ['add McDouble no cheese', 'add_item'],
    ['also add asparagus', 'add_item'],
    ['replace with McDouble no cheese', 'replace_meal'],
    ['change to a Baconator', 'replace_meal'],
    ['McDouble no cheese', 'new_meal'],
    ['2 grilled chicken breasts and asparagus', 'new_meal'],
    ['where are my macros', 'ask_macros'],
    ['how much protein is that', 'ask_macros'],
    ['how many calories is that', 'ask_calories'],
    ['remove the fries', 'remove_item'],
    ['cancel this meal', 'cancel'],
  ] as const)('classifies %s as %s', (message, expectedAction) => {
    const parsed = parseLogMealIntent(message, buildState({
      currentMealItems: [item('Chipotle Chicken Bowl', 760)],
    }));

    expect(parsed.action).toBe(expectedAction);
  });

  it('treats affirmative confirmation as save whenever an unsaved pending meal exists', () => {
    const pending = buildState({
      currentMealItems: [item('McDouble', 390)],
    });
    expect(parseLogMealIntent('yes', pending).action).toBe('save_confirm');
    expect(parseLogMealIntent('looks good', pending).action).toBe('save_confirm');
    expect(parseLogMealIntent('save it', pending).action).toBe('save_confirm');
    expect(parseLogMealIntent('confirm', pending).action).toBe('save_confirm');
    expect(parseLogMealIntent('yes', buildState()).action).toBe('unknown');
  });

  it('prioritizes active clarification answers over affirmative save shortcuts', () => {
    const pendingClarification = buildState({
      currentMealItems: [item('Chipotle Chicken Bowl', 760)],
      pendingClarification: 'Did you mean double chicken or regular chicken?',
      lastAssistantQuestion: 'Did you mean double chicken or regular chicken?',
    });

    expect(parseLogMealIntent('yes', pendingClarification).action).toBe('clarification_response');
    expect(parseLogMealIntent('correct', pendingClarification).action).toBe('clarification_response');
  });

  it.each([
    'actually 3',
    'Oh I meant 5',
    'medium not large',
    'grilled not fried',
    'make that 3',
  ])('uses pending context for correction utterance %s', (message) => {
    const parsed = parseLogMealIntent(message, buildState({
      currentMealItems: [item('Rice Cakes', 70)],
    }));

    expect(parsed.action).toBe('modify_item');
    expect(parsed.foodText).toBeNull();
  });

  it('classifies an answer to an active clarification separately', () => {
    const parsed = parseLogMealIntent('footlong', buildState({
      pendingClarification: 'Was that a 6-inch or footlong?',
    }));

    expect(parsed.action).toBe('clarification_response');
  });

  it('extracts restaurant, product identity, quantity, and modifiers', () => {
    expect(parseLogMealIntent("2 McDonald's McDoubles without cheese", buildState())).toMatchObject({
      action: 'new_meal',
      restaurant: "McDonald's",
      quantity: 2,
      modifiers: ['no cheese'],
    });
  });

  it('decomposes a generic compound meal into separate food requests', () => {
    const parsed = parseLogMealIntent('2 grilled chicken breasts and asparagus', buildState());

    expect(parsed.items).toEqual([
      expect.objectContaining({ name: 'grilled chicken breasts', quantity: 2 }),
      expect.objectContaining({ name: 'asparagus', quantity: 1 }),
    ]);
  });
});

describe('pending meal transitions', () => {
  const chicken = item('Grilled Chicken Breast', 330);
  const asparagus = item('Asparagus', 40);
  const chipotle = item('Chipotle Chicken Bowl', 760);
  const mcdouble = item('McDouble no cheese', 340);

  it('creates a reviewable pending meal with totals and timestamps', () => {
    const pending = createPendingMeal([chicken, asparagus], 'dinner', 0.93, {
      id: 'pending-1',
      now: '2026-06-15T12:00:00.000Z',
    });

    expect(pending.id).toBe('pending-1');
    expect(pending.version).toBe(1);
    expect(pending.items).toHaveLength(2);
    expect(pending.totals.calories).toBe(370);
    expect(pending.aggregateConfidence).toBe(0.93);
    expect(pending.sourceSummary.trustedItemCount).toBe(2);
    expect(pending.status).toBe('ready_for_review');
    expect(pending.clarification).toBeNull();
    expect(pending.createdAt).toBe('2026-06-15T12:00:00.000Z');
    expect(pending.updatedAt).toBe(pending.createdAt);
    expect(pending.lastResolvedAt).toBe(pending.createdAt);
  });

  it('preserves pending items for a macro follow-up', () => {
    const pending = createPendingMeal([chicken, asparagus], 'dinner', 0.93);
    const preserved = preservePendingMeal(pending);

    expect(preserved.items).toEqual(pending.items);
    expect(preserved.totals).toEqual(pending.totals);
    expect(preserved.id).toBe(pending.id);
    expect(preserved.version).toBe(pending.version);
  });

  it('derives a stable save idempotency key from the pending meal id and version', () => {
    const pending = createPendingMeal([chicken, asparagus], 'dinner', 0.93, { id: 'pending-1' });
    const preserved = preservePendingMeal(pending);

    expect(buildPendingMealSaveIdempotencyKey(pending)).toBe('pending-1:v1');
    expect(buildPendingMealSaveIdempotencyKey(preserved)).toBe('pending-1:v1');
    expect(buildPendingMealSaveIdempotencyKey(replacePendingMealItems(pending, [mcdouble], 0.95))).toBe('pending-1:v2');
  });

  it('adds only for an explicit add transition', () => {
    const pending = createPendingMeal([chipotle], 'lunch', 0.96);
    const next = addPendingMealItems(pending, [mcdouble], 0.95);

    expect(next.items.map((entry) => entry.food_name)).toEqual(['Chipotle Chicken Bowl', 'McDouble no cheese']);
    expect(next.id).toBe(pending.id);
    expect(next.version).toBe(2);
  });

  it('replaces stale items for standalone food and explicit replace', () => {
    const pending = createPendingMeal([chipotle], 'lunch', 0.96);
    const next = replacePendingMealItems(pending, [mcdouble], 0.95);

    expect(next.items.map((entry) => entry.food_name)).toEqual(['McDouble no cheese']);
    expect(next.id).toBe(pending.id);
    expect(next.version).toBe(2);
  });

  it('retains the pending identity while clarification is needed and after save', () => {
    const pending = createPendingMeal([chipotle], 'lunch', 0.96, { id: 'pending-1' });
    const clarification = markPendingMealNeedsClarification(pending, 'Which size was that?');
    const saved = markPendingMealSaved(clarification);

    expect(clarification).toMatchObject({
      id: 'pending-1',
      status: 'needs_clarification',
      clarification: 'Which size was that?',
    });
    expect(saved).toMatchObject({
      id: 'pending-1',
      status: 'saved',
      clarification: null,
    });
  });

  it('cancels the pending meal without retaining stale items', () => {
    const pending = createPendingMeal([chipotle], 'lunch', 0.96);

    expect(cancelPendingMeal(pending)).toBeNull();
  });
});

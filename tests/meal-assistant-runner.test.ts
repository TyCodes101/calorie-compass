import { describe, expect, it, vi } from 'vitest';

import type { MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

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

function buildItem(overrides?: Partial<ParsedFoodItem>): ParsedFoodItem {
  return {
    food_name: 'Chipotle chicken bowl',
    quantity: 1,
    unit: 'bowl',
    calories: 980,
    protein: 68,
    carbs: 74,
    fat: 34,
    fiber: 10,
    sugar: 4,
    sodium: 1760,
    notes: 'Verified match.',
    is_trusted: true,
    source_type: 'OFFICIAL_RESTAURANT',
    source_name: 'Chipotle official nutrition',
    confidence_label: 'Verified',
    matched_query: null,
    original_user_text: null,
    provider_used: null,
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

function buildParsedMealResponse(items: ParsedFoodItem[]): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'lunch',
    confidence_score: 0.96,
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

describe('runMealAssistant', () => {
  it('handles a common food log and returns structured meal state', async () => {
    const item = buildItem();
    const response = await runMealAssistant(
      {
        message: 'Chipotle bowl with chicken',
        state: buildState(),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'Chipotle chicken bowl',
                brand: 'Chipotle',
                quantity: 1,
                unit: 'bowl',
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(buildParsedMealResponse([item])),
      },
    );

    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toBe('Chipotle chicken bowl');
    expect(response.next_state.currentMealText).toContain('Chipotle chicken bowl');
    expect(response.assistant_reply).toMatch(/980 calories/i);
  });

  it('replaces a stale clarification with the corrected branded food', async () => {
    const correctedItem = buildItem({
      food_name: 'Quaker White Cheddar Rice Cakes',
      unit: 'cake',
      calories: 110,
      protein: 2,
      carbs: 22,
      fat: 2,
      fiber: 1,
      sugar: 1,
      sodium: 180,
      source_type: 'GENERIC_REFERENCE',
      source_name: 'Branded database',
    });

    const response = await runMealAssistant(
      {
        message: 'They were rice cakes',
        state: buildState({
          pendingClarification: 'Was that rice or rice cakes?',
          lastAssistantQuestion: 'Was that rice or rice cakes?',
          currentMealItems: [buildItem({ food_name: 'Rice', unit: 'cup', calories: 200, protein: 4, carbs: 45, fat: 0 })],
          currentMealText: 'rice',
        }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'correction',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'rice cakes',
                brand: 'Quaker',
                quantity: 2,
                unit: 'cake',
                modifiers: ['white cheddar'],
                action: 'replace',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(buildParsedMealResponse([correctedItem])),
      },
    );

    expect(response.clarification_question).toBeNull();
    expect(response.meal.items[0]?.food_name).toBe('Quaker White Cheddar Rice Cakes');
    expect(response.assistant_reply).toMatch(/updated|updating|got you|that makes sense/i);
    expect(response.assistant_reply).not.toMatch(/was that rice or rice cakes/i);
  });

  it('saves the current meal when the assistant classifies a save command', async () => {
    const saveMeal = vi.fn().mockResolvedValue(undefined);
    const currentItem = buildItem();

    const response = await runMealAssistant(
      {
        message: 'save it',
        state: buildState({
          currentMealItems: [currentItem],
          currentMealText: 'Chipotle chicken bowl',
        }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'save_meal',
            should_save_meal: true,
          }),
        ),
        saveMeal,
      },
    );

    expect(saveMeal).toHaveBeenCalledTimes(1);
    expect(response.next_state.saved).toBe(true);
    expect(response.assistant_reply).toMatch(/saved|logged|that one is in/i);
  });

  it('preserves branded packaged-food details for lookup resolution', async () => {
    const resolveItemNutrition = vi.fn().mockResolvedValue(
      buildParsedMealResponse([
        buildItem({
          food_name: 'Quaker White Cheddar Rice Cakes',
          unit: 'cake',
          calories: 110,
          protein: 2,
          carbs: 22,
          fat: 2,
          fiber: 1,
          sugar: 1,
          sodium: 180,
          source_type: 'GENERIC_REFERENCE',
          source_name: 'Branded database',
        }),
      ]),
    );

    await runMealAssistant(
      {
        message: '3 quaker oats rice cakes white cheddar',
        state: buildState(),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'rice cakes',
                brand: 'Quaker',
                quantity: 3,
                unit: 'cake',
                modifiers: ['white cheddar'],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition,
      },
    );

    expect(resolveItemNutrition).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({
          brand: 'Quaker',
          name: 'rice cakes',
          modifiers: ['white cheddar'],
          quantity: 3,
        }),
      }),
    );
  });

  it('returns a calm off-topic reply without changing the meal', async () => {
    const resolveItemNutrition = vi.fn();

    const response = await runMealAssistant(
      {
        message: 'how is the weather',
        state: buildState({ currentMealItems: [buildItem()], currentMealText: 'Chipotle chicken bowl' }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'casual_message',
            assistant_reply: 'I can keep working on this meal, or you can send the next food.',
          }),
        ),
        resolveItemNutrition,
      },
    );

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.meal.items).toHaveLength(1);
    expect(response.assistant_reply).toBe('I can keep working on this meal, or you can send the next food.');
  });

  it('suppresses repeated clarification loops when the same question comes back again', async () => {
    const repeatedQuestion = 'Was that rice or rice cakes?';

    const response = await runMealAssistant(
      {
        message: 'white cheddar',
        state: buildState({
          pendingClarification: repeatedQuestion,
          lastAssistantQuestion: repeatedQuestion,
        }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'clarification_answer',
            should_ask_clarification: true,
            clarification_question: repeatedQuestion,
            assistant_reply: repeatedQuestion,
          }),
        ),
      },
    );

    expect(response.assistant_reply).toBe('Got it, I’m checking that again.');
    expect(response.clarification_question).toBeNull();
    expect(response.next_state.pendingClarification).toBe(repeatedQuestion);
    expect(response.next_state.lastAssistantQuestion).toBe(repeatedQuestion);
  });
});

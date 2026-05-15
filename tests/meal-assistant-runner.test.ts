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
  it('passes recent chat history into the assistant classifier for ChatGPT-style context', async () => {
    const classify = vi.fn().mockResolvedValue(
      buildDecision({
        intent: 'clarification_answer',
        assistant_reply: 'I logged 2 slices from the pizza question.',
        should_lookup_nutrition: true,
        items: [
          {
            name: 'pizza',
            brand: 'Little Caesars',
            quantity: 2,
            unit: 'slices',
            modifiers: [],
            action: 'add',
          },
        ],
      }),
    );

    await runMealAssistant(
      {
        message: '2',
        state: buildState(),
        conversationHistory: [
          { role: 'user', text: 'Little Caesars pizza' },
          { role: 'assistant', text: 'For Little Caesars, was that one slice, a few slices, or a whole pizza?' },
          { role: 'user', text: '2' },
        ],
      },
      {
        classify,
        resolveItemNutrition: vi.fn().mockResolvedValue(
          buildParsedMealResponse([
            buildItem({
              food_name: 'Little Caesars pizza',
              quantity: 2,
              unit: 'slices',
              calories: 570,
              protein: 24,
              carbs: 72,
              fat: 20,
              source_type: 'AI_ESTIMATE',
              source_name: 'Little Caesars-style fallback estimate',
            }),
          ]),
        ),
      },
    );

    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationHistory: expect.arrayContaining([
          { role: 'user', text: 'Little Caesars pizza' },
          { role: 'assistant', text: 'For Little Caesars, was that one slice, a few slices, or a whole pizza?' },
          { role: 'user', text: '2' },
        ]),
      }),
    );
  });

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


  it('turns repeated bare acknowledgments into a contextual meal reply', async () => {
    const currentItem = buildItem({ food_name: 'Fairlife protein shake', calories: 150, protein: 30, carbs: 4, fat: 2 });

    const response = await runMealAssistant(
      {
        message: 'okay',
        state: buildState({
          currentMealItems: [currentItem],
          currentMealText: 'Fairlife protein shake',
          lastAssistantReply: 'Got it.',
        }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'casual_message',
            assistant_reply: 'Got it.',
          }),
        ),
      },
    );

    expect(response.assistant_reply).toMatch(/Fairlife protein shake/i);
    expect(response.assistant_reply).not.toMatch(/^(got it|okay|alright|makes sense)[.!]?$/i);
    expect(response.meal.items).toHaveLength(1);
  });

  it('removes repeated weak openings while preserving useful food-log content', async () => {
    const currentItem = buildItem({ food_name: 'Quaker White Cheddar Rice Cakes', calories: 110, protein: 2, carbs: 22, fat: 2 });

    const response = await runMealAssistant(
      {
        message: '2 white cheddar rice cakes',
        state: buildState({
          currentMealItems: [currentItem],
          currentMealText: 'Quaker White Cheddar Rice Cakes',
          lastAssistantReply: 'Got it, I added the protein shake.',
        }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            assistant_reply: 'Got it, I added the white cheddar rice cakes.',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'rice cakes',
                brand: 'Quaker',
                quantity: 2,
                unit: 'cake',
                modifiers: ['white cheddar'],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(buildParsedMealResponse([currentItem])),
      },
    );

    expect(response.assistant_reply).toMatch(/white cheddar rice cakes/i);
    expect(response.assistant_reply).not.toMatch(/^Got it,/i);
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

    expect(response.assistant_reply).toBe('Got it, Iâ€™m checking that again.');
    expect(response.clarification_question).toBeNull();
    expect(response.next_state.pendingClarification).toBe(repeatedQuestion);
    expect(response.next_state.lastAssistantQuestion).toBe(repeatedQuestion);
  });


  it('repairs suspicious generic estimates for multiple pizza slices', async () => {
    const response = await runMealAssistant(
      {
        message: '5 slices of pizza',
        state: buildState({ mealType: 'dinner' }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'pizza',
                brand: null,
                quantity: 5,
                unit: 'slices',
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(
          buildParsedMealResponse([
            buildItem({
              food_name: 'Estimated mixed meal',
              quantity: 1,
              unit: 'meal',
              calories: 520,
              protein: 30,
              carbs: 45,
              fat: 20,
              source_type: 'AI_ESTIMATE',
              source_name: 'AI estimate',
              confidence_label: 'Estimated',
            }),
          ]),
        ),
      },
    );

    expect(response.meal.items[0]?.food_name).toBe('slices of pizza');
    expect(response.meal.items[0]?.quantity).toBe(5);
    expect(response.meal.totals.calories).toBeGreaterThan(1000);
    expect(response.assistant_reply).toMatch(/5 slices of pizza/i);
    expect(response.assistant_reply).not.toMatch(/estimated mixed meal/i);
  });

  it('renames generic resolver output back to the food the user actually logged', async () => {
    const response = await runMealAssistant(
      {
        message: '2 chicken tacos',
        state: buildState(),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'chicken tacos',
                brand: null,
                quantity: 2,
                unit: 'tacos',
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(
          buildParsedMealResponse([
            buildItem({
              food_name: 'Estimated mixed meal',
              quantity: 1,
              unit: 'meal',
              calories: 420,
              source_type: 'AI_ESTIMATE',
              confidence_label: 'Estimated',
            }),
          ]),
        ),
      },
    );

    expect(response.meal.items[0]?.food_name).toBe('chicken tacos');
    expect(response.meal.items[0]?.quantity).toBe(2);
    expect(response.assistant_reply).not.toMatch(/estimated mixed meal/i);
  });

  it('bot QA: rejects unrelated restaurant matches for cottage cheese gram servings', async () => {
    const response = await runMealAssistant(
      {
        message: 'i had about 24 grams of cottage cheese',
        state: buildState({ mealType: 'snack' }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'cottage cheese',
                brand: null,
                quantity: 24,
                unit: 'g',
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(
          buildParsedMealResponse([
            buildItem({
              food_name: 'Chick-fil-A Nuggets 8 Count',
              quantity: 1,
              unit: 'count',
              calories: 31.25,
              protein: 3.13,
              carbs: 1.38,
              fat: 1.5,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chick-fil-A official nutrition',
              confidence_label: 'Verified',
            }),
          ]),
        ),
      },
    );

    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(response.meal.items[0]?.food_name).not.toMatch(/chick-fil-a|nuggets/i);
    expect(response.assistant_reply).toMatch(/cottage cheese/i);
    expect(response.assistant_reply).not.toMatch(/chick-fil-a|nuggets/i);
  });

  it('keeps rice cakes plural when the user logs multiple rice cakes', async () => {
    const response = await runMealAssistant(
      {
        message: '2 rice cakes',
        state: buildState({ mealType: 'snack' }),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'rice cake',
                brand: null,
                quantity: 2,
                unit: 'cake',
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(
          buildParsedMealResponse([
            buildItem({
              food_name: 'Rice cake',
              quantity: 2,
              unit: 'cake',
              calories: 70,
              protein: 1,
              carbs: 15,
              fat: 0,
              source_type: 'AI_ESTIMATE',
              confidence_label: 'Estimated',
            }),
          ]),
        ),
      },
    );

    expect(response.meal.items[0]?.food_name).toBe('rice cakes');
    expect(response.assistant_reply).toMatch(/2 rice cakes/i);
  });

  it('keeps blueberries alongside greek yogurt when the resolver only finds yogurt', async () => {
    const response = await runMealAssistant(
      {
        message: 'Some blueberries with greek yogurt!',
        state: buildState(),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            assistant_reply: 'Got it.',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'Greek yogurt',
                brand: null,
                quantity: 1,
                unit: 'serving',
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(
          buildParsedMealResponse([
            buildItem({
              food_name: 'Greek yogurt',
              quantity: 1,
              unit: 'serving',
              calories: 100,
              protein: 17,
              carbs: 6,
              fat: 0.5,
              source_type: 'GENERIC_REFERENCE',
              source_name: 'USDA-style reference',
            }),
          ]),
        ),
      },
    );

    const foodNames = response.meal.items.map((item) => item.food_name.toLowerCase()).join(' ');
    expect(foodNames).toContain('greek yogurt');
    expect(foodNames).toContain('blueberries');
    expect(response.assistant_reply).toMatch(/blueberries/i);
    expect(response.assistant_reply).not.toMatch(/^got it\.?$/i);
  });

  it('does not collapse a full chipotle bowl into only white rice', async () => {
    const response = await runMealAssistant(
      {
        message: 'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
        state: buildState(),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            assistant_reply: 'Alright, Iâ€™ve got 1 Chipotle white rice.',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'white rice',
                brand: 'Chipotle',
                quantity: 1,
                unit: 'serving',
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition: vi.fn().mockResolvedValue(
          buildParsedMealResponse([
            buildItem({
              food_name: 'Chipotle white rice',
              quantity: 1,
              unit: 'serving',
              calories: 210,
              protein: 4,
              carbs: 40,
              fat: 4,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
            }),
            buildItem({
              food_name: 'Chipotle double chicken',
              quantity: 1,
              unit: 'serving',
              calories: 360,
              protein: 64,
              carbs: 0,
              fat: 14,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
            }),
            buildItem({
              food_name: 'Chipotle cheese',
              quantity: 1,
              unit: 'serving',
              calories: 110,
              protein: 6,
              carbs: 1,
              fat: 8,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
            }),
            buildItem({
              food_name: 'Chipotle corn salsa',
              quantity: 1,
              unit: 'serving',
              calories: 80,
              protein: 3,
              carbs: 16,
              fat: 2,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
            }),
            buildItem({
              food_name: 'Chipotle lettuce',
              quantity: 1,
              unit: 'serving',
              calories: 5,
              protein: 0,
              carbs: 1,
              fat: 0,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
            }),
            buildItem({
              food_name: 'Chipotle green salsa',
              quantity: 1,
              unit: 'serving',
              calories: 15,
              protein: 0,
              carbs: 4,
              fat: 0,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
            }),
          ]),
        ),
      },
    );

    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toMatch(/chipotle bowl/i);
    expect(response.meal.items[0]?.food_name).toMatch(/double chicken/i);
    expect(response.meal.totals.calories).toBeGreaterThan(700);
    expect(response.assistant_reply).toMatch(/chipotle bowl/i);
    expect(response.assistant_reply).not.toMatch(/chipotle white rice/i);
  });

  it('asks for pizza portion instead of replying only got it for vague little caesars pizza', async () => {
    const resolveItemNutrition = vi.fn();

    const response = await runMealAssistant(
      {
        message: 'Little Caesars pizza',
        state: buildState(),
      },
      {
        classify: vi.fn().mockResolvedValue(
          buildDecision({
            intent: 'new_food_item',
            assistant_reply: 'Got it.',
            should_lookup_nutrition: true,
            items: [
              {
                name: 'pizza',
                brand: 'Little Caesars',
                quantity: 1,
                unit: null,
                modifiers: [],
                action: 'add',
              },
            ],
          }),
        ),
        resolveItemNutrition,
      },
    );

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.assistant_reply).toMatch(/slice|whole|pizza/i);
    expect(response.assistant_reply).not.toMatch(/^got it\.?$/i);
    expect(response.should_ask_clarification).toBe(true);
    expect(response.meal.items).toHaveLength(0);
  });

});

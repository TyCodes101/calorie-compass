import { describe, expect, it } from 'vitest';

import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem } from '@/lib/ai/types';

function buildState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingMeal: null,
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
  };
}

function names(items: ParsedFoodItem[]) {
  return items.map((item) => item.food_name).join(' | ');
}

function itemText(item: ParsedFoodItem | undefined) {
  return [
    item?.food_name,
    item?.unit,
    item?.source_type,
    item?.source_name,
    item?.confidence_label,
    item?.notes,
    item?.matched_query,
    item?.original_user_text,
  ].filter(Boolean).join(' ');
}

async function firstTurn(message: string, state = buildState()) {
  delete process.env.OPENAI_API_KEY;
  return runMealAssistant({ message, state });
}

describe('TestFlight screenshot food logging regressions', () => {
  it('keeps chicken breast and asparagus separate with sane asparagus nutrition', async () => {
    const response = await firstTurn('2 grilled chicken breasts and asparagus');
    const mealNames = names(response.meal.items);
    const asparagus = response.meal.items.find((item) => /asparagus/i.test(item.food_name));

    expect(response.assistant_reply).not.toMatch(/what was it|how much did you have/i);
    expect(mealNames).toMatch(/grilled chicken breast/i);
    expect(mealNames).toMatch(/asparagus/i);
    expect(asparagus?.calories).toBeLessThanOrEqual(100);
    expect(asparagus?.protein).toBeLessThanOrEqual(8);
    expect(asparagus?.fat).toBeLessThanOrEqual(2);
  });

  it('decomposes Panda Express bigger plate exactly once per selected food', async () => {
    const response = await firstTurn('Panda Express Bigger Plate: Orange Chicken, Beijing Beef, Chow Mein');
    const mealNames = names(response.meal.items);

    expect(response.assistant_reply).not.toMatch(/what was it|how much did you have/i);
    expect(mealNames).toMatch(/orange chicken/i);
    expect(mealNames).toMatch(/beijing beef/i);
    expect(mealNames).toMatch(/chow mein/i);
    expect(response.meal.items.filter((item) => /orange chicken/i.test(item.food_name))).toHaveLength(1);
    expect(response.meal.items).toHaveLength(3);
  });

  it('does not ask what a fully described steak dinner was', async () => {
    const response = await firstTurn('8 oz sirloin steak, baked potato with sour cream and chives');
    const mealNames = names(response.meal.items);

    expect(response.assistant_reply).not.toMatch(/what was it|how much did you have/i);
    expect(mealNames).toMatch(/sirloin steak/i);
    expect(mealNames).toMatch(/baked potato/i);
    expect(mealNames).toMatch(/sour cream/i);
    expect(mealNames).toMatch(/chives/i);
    expect(response.meal.items.length).toBeGreaterThanOrEqual(4);
  });

  it('does not ask what a fully described eggs toast butter and jam meal was', async () => {
    const response = await firstTurn('Three scrambled eggs cooked in butter with sourdough toast and strawberry jam');
    const mealNames = names(response.meal.items);

    expect(response.assistant_reply).not.toMatch(/what was it|how much did you have/i);
    expect(mealNames).toMatch(/scrambled eggs/i);
    expect(mealNames).toMatch(/butter/i);
    expect(mealNames).toMatch(/sourdough toast/i);
    expect(mealNames).toMatch(/strawberry jam/i);
    expect(mealNames).not.toMatch(/egg whites/i);
  });

  it('preserves Five Guys no-bun and extra topping modifiers through review metadata', async () => {
    const response = await firstTurn('Five Guys bacon cheeseburger, no bun, extra grilled onions and mushrooms');
    const burger = response.meal.items.find((item) => /five guys|cheeseburger|burger/i.test(item.food_name));
    const metadata = itemText(burger);

    expect(response.assistant_reply).not.toMatch(/what was it|how much did you have/i);
    expect(burger?.unit).toMatch(/burger/i);
    expect(metadata).toMatch(/no bun/i);
    expect(metadata).toMatch(/grilled onions/i);
    expect(metadata).toMatch(/mushrooms/i);
  });

  it('recognizes Diet Coke as a branded zero-calorie drink instead of a generic estimate', async () => {
    const response = await firstTurn('Diet Coke');
    const drink = response.meal.items[0];

    expect(drink.food_name).toMatch(/diet coke/i);
    expect(itemText(drink)).not.toMatch(/NOS|Monster|energy drink/i);
    expect(drink.calories).toBeLessThanOrEqual(5);
    expect(drink.source_type).not.toBe('AI_ESTIMATE');
    expect(drink.confidence_label).not.toMatch(/estimated/i);
  });

  it('keeps Trader Joe sugar-free gummy worms reviewable without absurd protein or fat', async () => {
    const initial = await firstTurn("Trader Joe's sugar free gummy worms");
    const response = await firstTurn('2 servings', initial.next_state);
    const gummy = response.meal.items.find((item) => /gummy|worms/i.test(item.food_name));

    expect(names(response.meal.items)).not.toMatch(/cookie/i);
    expect(gummy?.calories).toBeLessThanOrEqual(400);
    expect(gummy?.protein).toBeLessThanOrEqual(10);
    expect(gummy?.fat).toBeLessThanOrEqual(10);
    expect(itemText(gummy)).toMatch(/trader joe|gummy|estimated|review|fallback|clarification/i);
  });
});

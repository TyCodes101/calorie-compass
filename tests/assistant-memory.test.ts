import { describe, expect, it } from 'vitest';

import { createEmptyAssistantMemory, parseAssistantMemory, rememberAssistantCorrection, rememberAssistantMeal } from '@/lib/assistant-memory';
import type { ParsedFoodItem } from '@/lib/ai/types';

function buildItem(overrides?: Partial<ParsedFoodItem>): ParsedFoodItem {
  return {
    food_name: 'Fairlife Elite 42g Shake',
    quantity: 1,
    unit: 'bottle',
    calories: 230,
    protein: 42,
    carbs: 8,
    fat: 3,
    fiber: 0,
    sugar: 7,
    sodium: 210,
    notes: 'Verified match.',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Fairlife nutrition reference',
    confidence_label: 'Verified',
    matched_query: null,
    original_user_text: null,
    provider_used: null,
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

describe('assistant memory', () => {
  it('records recurring meals, brands, foods, servings, and timing from saved meals', () => {
    const memory = rememberAssistantMeal(createEmptyAssistantMemory(), {
      title: 'Chipotle bowl with white rice and double chicken',
      rawText: 'Chipotle bowl with white rice and double chicken',
      mealType: 'dinner',
      source: 'saved',
      occurredAt: '2026-05-14T18:30:00.000Z',
      confidenceScore: 0.96,
      items: [
        buildItem({
          food_name: 'Chipotle Chicken Bowl',
          unit: 'bowl',
          calories: 760,
          protein: 58,
          carbs: 62,
          fat: 24,
          source_type: 'OFFICIAL_RESTAURANT',
          source_name: 'Chipotle official nutrition',
        }),
        buildItem({
          food_name: 'Fairlife Elite 42g Shake',
          unit: 'bottle',
          calories: 230,
          protein: 42,
          carbs: 8,
          fat: 3,
          source_name: 'Fairlife nutrition reference',
        }),
      ],
    });

    expect(memory.recurringMeals[0]).toMatchObject({
      mealType: 'dinner',
      source: 'saved',
      count: 1,
    });
    expect(memory.commonRestaurants.some((entry) => /chipotle/i.test(entry.name))).toBe(true);
    expect(memory.commonBrands.some((entry) => /fairlife/i.test(entry.name))).toBe(true);
    expect(memory.recurringFoods.some((entry) => /chipotle chicken bowl/i.test(entry.name))).toBe(true);
    expect(memory.preferredServingSizes.some((entry) => /fairlife elite 42g shake/i.test(entry.foodName) && entry.quantity === 1)).toBe(true);
    expect(memory.mealTiming.find((entry) => entry.mealType === 'dinner')).toMatchObject({
      averageHour: 18,
      lastHour: 18,
      count: 1,
    });
  });

  it('remembers repeated corrections and safely falls back on bad storage payloads', () => {
    const first = rememberAssistantCorrection(createEmptyAssistantMemory(), 'actually remove cheese', '2026-05-14T12:00:00.000Z');
    const second = rememberAssistantCorrection(first, 'actually remove cheese', '2026-05-14T13:00:00.000Z');

    expect(second.commonCorrections[0]).toMatchObject({
      text: 'actually remove cheese',
      count: 2,
      lastUsedAt: '2026-05-14T13:00:00.000Z',
    });

    expect(parseAssistantMemory('{bad json')).toEqual(createEmptyAssistantMemory());
  });
});

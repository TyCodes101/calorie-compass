import { describe, expect, it } from 'vitest';

import { createEmptyAssistantMemory, mergeAssistantMemorySnapshots, parseAssistantMemory, rememberAssistantCorrection, rememberAssistantMeal, seedAssistantMemoryFromSavedMeals } from '@/lib/assistant-memory';
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

  it('learns unfamiliar restaurants and brands from structured source metadata without a fixed allowlist', () => {
    const memory = rememberAssistantMeal(createEmptyAssistantMemory(), {
      title: 'Local favorites',
      mealType: 'lunch',
      source: 'saved',
      occurredAt: '2026-07-15T12:00:00.000Z',
      items: [
        buildItem({
          food_name: 'Northstar Village Salad',
          source_type: 'OFFICIAL_RESTAURANT',
          source_name: 'Northstar Cafe official nutrition',
        }),
        buildItem({
          food_name: 'Wildwonder Guava Rose',
          source_type: 'GENERIC_REFERENCE',
          source_name: 'Wildwonder nutrition reference',
        }),
      ],
    });

    expect(memory.commonRestaurants[0]?.name).toBe('Northstar Cafe');
    expect(memory.commonBrands[0]?.name).toBe('Wildwonder');
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

  it('can seed persistent assistant memory from saved favorites and recent meals', () => {
    const memory = seedAssistantMemoryFromSavedMeals({
      favoriteMeals: [
        {
          id: 'favorite-1',
          title: 'Fairlife Elite 42g shake',
          rawText: 'Fairlife Elite 42g shake',
          mealType: 'snack',
          lastUsedAt: '2026-05-14T15:00:00.000Z',
          totalCalories: 230,
          totalProtein: 42,
          itemCount: 1,
          trustedCount: 1,
          confidenceScore: 0.96,
          items: [buildItem()],
        },
      ],
      recentMeals: [
        {
          id: 'recent-1',
          title: 'Chipotle chicken bowl',
          mealType: 'dinner',
          totalCalories: 760,
          createdAt: '2026-05-14T18:30:00.000Z',
          rawText: 'Chipotle bowl with white rice and double chicken',
          confidenceScore: 0.95,
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
          ],
        },
      ],
    });

    expect(memory.recurringMeals.some((entry) => /fairlife elite 42g shake/i.test(entry.title))).toBe(true);
    expect(memory.recurringMeals.some((entry) => /chipotle bowl with white rice and double chicken/i.test(entry.title))).toBe(true);
    expect(memory.commonBrands.some((entry) => /fairlife/i.test(entry.name))).toBe(true);
    expect(memory.commonRestaurants.some((entry) => /chipotle/i.test(entry.name))).toBe(true);
  });

  it('merges seeded memory into local memory without duplicating existing recurring meals', () => {
    const local = rememberAssistantCorrection(createEmptyAssistantMemory(), 'actually remove cheese', '2026-05-14T12:00:00.000Z');
    const seeded = seedAssistantMemoryFromSavedMeals({
      recentMeals: [
        {
          id: 'recent-1',
          title: 'Fairlife Elite 42g shake',
          mealType: 'snack',
          totalCalories: 230,
          createdAt: '2026-05-14T18:30:00.000Z',
          rawText: 'Fairlife Elite 42g shake',
          confidenceScore: 0.96,
          items: [buildItem()],
        },
      ],
    });

    const mergedOnce = mergeAssistantMemorySnapshots(local, seeded);
    const mergedTwice = mergeAssistantMemorySnapshots(mergedOnce, seeded);

    expect(mergedOnce.recurringMeals).toHaveLength(1);
    expect(mergedOnce.commonCorrections[0]?.text).toBe('actually remove cheese');
    expect(mergedTwice.recurringMeals).toHaveLength(1);
  });
});

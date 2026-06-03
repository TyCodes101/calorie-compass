import { describe, expect, it } from 'vitest';

import {
  buildRecentMealSummaries,
  buildRepeatMealPayloadFromReusableMealRecord,
} from '@/lib/reusable-meals';

describe('native reusable meal helpers', () => {
  it('builds a repeat meal payload from a favorite without dropping source metadata', () => {
    const payload = buildRepeatMealPayloadFromReusableMealRecord({
      id: 'favorite-1',
      title: 'Fairlife shake',
      mealType: 'SNACK',
      rawText: 'Fairlife protein shake',
      confidenceScore: 0.94,
      items: [
        {
          foodName: 'Fairlife Protein Shake',
          quantity: 1,
          unit: 'bottle',
          calories: 150,
          protein: 30,
          carbs: 4,
          fat: 3,
          fiber: 0,
          sugar: 2,
          sodium: 190,
          notes: 'Catalog match',
          isTrusted: true,
          sourceType: 'GENERIC_REFERENCE',
          sourceName: 'Fairlife nutrition reference',
          catalogFoodId: 'fairlife_protein_shake',
        },
      ],
    });

    expect(payload.meal_type).toBe('snack');
    expect(payload.raw_text).toBe('Fairlife protein shake');
    expect(payload.source_reusable_meal_id).toBe('favorite-1');
    expect(payload.items[0]).toMatchObject({
      food_name: 'Fairlife Protein Shake',
      is_trusted: true,
      source_name: 'Fairlife nutrition reference',
      catalog_food_id: 'fairlife_protein_shake',
    });
  });

  it('builds recent meal summaries from saved meals without fixture-looking rows', () => {
    const recent = buildRecentMealSummaries([
      {
        id: 'meal-1',
        mealType: 'LUNCH',
        rawText: 'Chicken rice bowl',
        confidenceScore: 0.9,
        date: new Date('2026-06-02T12:00:00.000Z'),
        totalCalories: 620,
        totalProtein: 48,
        items: [
          {
            foodName: 'Chicken rice bowl',
            quantity: 1,
            unit: 'bowl',
            calories: 620,
            protein: 48,
            carbs: 68,
            fat: 15,
            fiber: 5,
            sugar: 4,
            sodium: 700,
            nutritionSourceType: 'GENERIC_REFERENCE',
            nutritionSourceName: 'trusted reference',
            catalogFoodId: null,
          },
        ],
      },
    ]);

    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      id: 'meal-1',
      title: 'Chicken Rice Bowl',
      mealType: 'lunch',
      totalCalories: 620,
      totalProtein: 48,
    });
  });
});

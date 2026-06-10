import { describe, expect, it } from 'vitest';

import { mapMealForNative } from '@/lib/native-meals';

describe('native meals route mapping', () => {
  it('preserves trusted nutrition metadata for zero-calorie saved items', () => {
    const mapped = mapMealForNative({
      id: 'meal-1',
      mealType: 'SNACK',
      rawText: '1 can coke zero',
      date: new Date('2026-06-10T00:00:00.000Z'),
      createdAt: new Date('2026-06-10T14:00:00.000Z'),
      confidenceScore: 0.96,
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      items: [{
        foodName: 'Coke Zero',
        quantity: 1,
        unit: 'can',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 40,
        notes: 'Trace: confidence=Matched',
        nutritionSourceType: 'GENERIC_REFERENCE',
        nutritionSourceName: 'Coca-Cola nutrition reference',
        catalogFoodId: 'coke_zero_can',
      }],
    });

    expect(mapped.items[0]).toMatchObject({
      food_name: 'Coke Zero',
      calories: 0,
      is_trusted: true,
      source_type: 'GENERIC_REFERENCE',
      source_name: 'Coca-Cola nutrition reference',
      confidence_label: 'Matched',
      catalog_food_id: 'coke_zero_can',
    });
  });
});

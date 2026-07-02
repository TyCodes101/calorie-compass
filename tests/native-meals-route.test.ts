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

  it('maps older persisted meal records with string or missing dates without failing history', () => {
    const mapped = mapMealForNative({
      id: 'meal-legacy',
      mealType: 'LUNCH',
      rawText: 'Chick-fil-A Chicken Sandwich',
      date: '2026-06-10T00:00:00.000Z',
      createdAt: null,
      confidenceScore: null,
      totalCalories: 420,
      totalProtein: 29,
      totalCarbs: 41,
      totalFat: 18,
      items: [{
        foodName: 'Chick-fil-A Chicken Sandwich',
        quantity: 1,
        unit: 'sandwich',
        calories: 420,
        protein: 29,
        carbs: 41,
        fat: 18,
        fiber: 2,
        sugar: 6,
        sodium: 1460,
        notes: 'Trace: confidence=Verified',
        nutritionSourceType: 'OFFICIAL_RESTAURANT',
        nutritionSourceName: 'Chick-fil-A official nutrition',
        catalogFoodId: null,
      }],
    } as unknown as Parameters<typeof mapMealForNative>[0]);

    expect(mapped.date).toBe('2026-06-10T00:00:00.000Z');
    expect(mapped.createdAt).toBe('2026-06-10T00:00:00.000Z');
    expect(mapped.mealType).toBe('lunch');
    expect(mapped.items[0]).toMatchObject({
      food_name: 'Chick-fil-A Chicken Sandwich',
      source_type: 'OFFICIAL_RESTAURANT',
      confidence_label: 'Verified',
    });
  });
});

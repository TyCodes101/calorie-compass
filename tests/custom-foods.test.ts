import { describe, expect, it } from 'vitest';

import {
  buildCustomFoodCreatePayload,
  buildCustomFoodSummaryFromReusableMealRecord,
  isCustomFoodReusableMeal,
} from '@/lib/custom-foods';

describe('custom food helpers', () => {
  it('builds a one-item reusable meal payload for a custom food', () => {
    const payload = buildCustomFoodCreatePayload({
      name: 'Turkey Chili',
      brand: 'Home',
      servingQuantity: 1,
      servingUnit: 'bowl',
      calories: 410,
      protein: 36,
      carbs: 32,
      fat: 14,
      fiber: 8,
      sugar: 6,
      sodium: 720,
    });

    expect(payload.meal_type).toBe('snack');
    expect(payload.confidence_score).toBe(1);
    expect(payload.raw_text).toBe('Custom food: Turkey Chili');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      food_name: 'Turkey Chili',
      quantity: 1,
      unit: 'bowl',
      calories: 410,
      protein: 36,
      source_type: 'GENERIC_REFERENCE',
      source_name: 'Custom food: Home',
      is_trusted: true,
    });
  });

  it('maps a custom reusable meal record without leaking it as a favorite meal title', () => {
    const record = {
      id: 'custom-1',
      title: 'Turkey Chili',
      mealType: 'SNACK',
      rawText: 'Custom food: Turkey Chili',
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      items: [
        {
          foodName: 'Turkey Chili',
          quantity: 1,
          unit: 'bowl',
          calories: 410,
          protein: 36,
          carbs: 32,
          fat: 14,
          fiber: 8,
          sugar: 6,
          sodium: 720,
          notes: 'Custom food',
          isTrusted: true,
          sourceType: 'GENERIC_REFERENCE' as const,
          sourceName: 'Custom food: Home',
          catalogFoodId: null,
        },
      ],
    };

    expect(isCustomFoodReusableMeal(record)).toBe(true);
    expect(buildCustomFoodSummaryFromReusableMealRecord(record)).toMatchObject({
      id: 'custom-1',
      name: 'Turkey Chili',
      brand: 'Home',
      servingQuantity: 1,
      servingUnit: 'bowl',
      calories: 410,
      protein: 36,
    });
  });
});

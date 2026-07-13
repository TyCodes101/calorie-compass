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

  it('keeps official provenance but restores required review for unresolved modifiers', () => {
    const mapped = mapMealForNative({
      id: 'meal-2',
      mealType: 'LUNCH',
      rawText: 'McDouble no cheese no ketchup',
      date: new Date('2026-07-13T00:00:00.000Z'),
      createdAt: new Date('2026-07-13T12:00:00.000Z'),
      confidenceScore: 0.72,
      totalCalories: 390,
      totalProtein: 22,
      totalCarbs: 33,
      totalFat: 19,
      items: [{
        foodName: 'McDouble',
        quantity: 1,
        unit: 'burger',
        calories: 390,
        protein: 22,
        carbs: 33,
        fat: 19,
        fiber: 2,
        sugar: 7,
        sodium: 850,
        notes: 'Official base item.\n\nTrace: provider=local-catalog | candidate=catalog:mcdouble | confidence=Needs Review | modifiers=no cheese;no ketchup | modifierResolution=unresolved | reviewStatus=required | aiFallback=no',
        nutritionSourceType: 'OFFICIAL_RESTAURANT',
        nutritionSourceName: "McDonald's official nutrition",
        catalogFoodId: null,
      }],
    });

    expect(mapped.items[0]).toMatchObject({
      source_type: 'OFFICIAL_RESTAURANT',
      is_trusted: false,
      confidence_label: 'Needs Review',
      provider_used: 'local-catalog',
      providerCandidateId: 'catalog:mcdouble',
      requested_modifiers: ['no cheese', 'no ketchup'],
      modifier_resolution: 'unresolved',
      review_status: 'required',
    });
  });
});

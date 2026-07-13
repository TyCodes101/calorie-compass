import { describe, expect, it } from 'vitest';

import { validateNutritionFacts } from '@/lib/nutrition/providers/nutritionPlausibility';

describe('external nutrition plausibility validation', () => {
  it('accepts coherent ordinary nutrition', () => {
    expect(validateNutritionFacts({ calories: 200, protein: 20, carbs: 18, fat: 7 })).toEqual({ valid: true, reasons: [] });
  });

  it.each([
    [{ calories: Number.NaN, protein: 0, carbs: 0, fat: 0 }, 'non_finite_nutrients'],
    [{ calories: 100, protein: -1, carbs: 10, fat: 2 }, 'negative_nutrients'],
    [{ calories: 200, protein: 80, carbs: 80, fat: 40 }, 'calorie_macro_mismatch'],
    [{ calories: 1_200, protein: 10, carbs: 10, fat: 10 }, 'nutrient_outlier'],
  ] as const)('rejects unsafe nutrition with reason %s', (facts, reason) => {
    expect(validateNutritionFacts(facts, { basis: 'per_100g' }).reasons).toContain(reason);
  });

  it('rejects zero and impossible serving weights', () => {
    expect(validateNutritionFacts({ calories: 100, protein: 5, carbs: 15, fat: 2 }, { servingWeightGrams: 0 }).reasons).toContain('serving_weight_invalid');
    expect(validateNutritionFacts({ calories: 100, protein: 5, carbs: 15, fat: 2 }, { servingWeightGrams: 5_001 }).reasons).toContain('serving_weight_invalid');
  });

  it('rejects nutrition that exceeds the physical energy density of its serving', () => {
    const outcome = validateNutritionFacts(
      { calories: 520, protein: 28, carbs: 45, fat: 20 },
      { servingWeightGrams: 55 },
    );
    expect(outcome.reasons).toContain('energy_density_outlier');
  });
});

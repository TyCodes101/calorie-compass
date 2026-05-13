import { describe, expect, it } from 'vitest';

import { calculateRemainingCalories, sumNutrition, toProgressValue } from '@/lib/nutrition';

describe('nutrition helpers', () => {
  it('sums calories and macros correctly', () => {
    const totals = sumNutrition([
      { calories: 210, protein: 18, carbs: 2, fat: 15, fiber: 0, sugar: 1, sodium: 210 },
      { calories: 180, protein: 6, carbs: 34, fat: 2, fiber: 2, sugar: 2, sodium: 320 },
    ]);

    expect(totals).toEqual({
      calories: 390,
      protein: 24,
      carbs: 36,
      fat: 17,
      fiber: 2,
      sugar: 3,
      sodium: 530,
    });
  });

  it('calculates remaining calories and progress safely', () => {
    expect(calculateRemainingCalories(1600, 2300)).toBe(700);
    expect(calculateRemainingCalories(2600, 2300)).toBe(0);
    expect(toProgressValue(90, 180)).toBe(50);
    expect(toProgressValue(220, 180)).toBe(100);
  });
});

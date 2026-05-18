import { describe, expect, it } from 'vitest';

import { formatFoodItemForDisplay, formatMealTitleForDisplay, isFixtureMealRecord, polishMealText } from '@/lib/meal-display';

describe('meal display polish', () => {
  it('hides production QA fixture labels from display decisions', () => {
    expect(isFixtureMealRecord({ rawText: 'prod-live-smoke-test meal' })).toBe(true);
    expect(isFixtureMealRecord({ rawText: 'qa rice cakes regression' })).toBe(true);
  });

  it('formats user-entered meal titles professionally without changing saved data', () => {
    expect(polishMealText('a mcdonalds mcdouble')).toBe("A McDonald's McDouble");
    expect(formatMealTitleForDisplay('qa rice cakes fixture', [{ food_name: 'rice cakes', quantity: 2, unit: 'cake' }])).toBe('2 rice cakes');
  });

  it('keeps countable item names natural', () => {
    expect(formatFoodItemForDisplay({ food_name: 'Large egg', quantity: 4, unit: 'egg' })).toBe('4 large eggs');
    expect(formatFoodItemForDisplay({ food_name: 'Potato, french fries, NFS', quantity: 100, unit: 'g' })).toBe('100g Potato, French Fries, NFS');
  });
});

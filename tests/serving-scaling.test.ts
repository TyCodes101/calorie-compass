import { describe, expect, it } from 'vitest';

import { normalizeServingUnit, scaleFoodSearchItem } from '@/lib/food-scaling';

describe('serving scaling helpers', () => {
  it('scales all macros when quantity changes', () => {
    const scaled = scaleFoodSearchItem({
      food_name: 'Greek yogurt',
      quantity: 1,
      unit: 'cup',
      calories: 120,
      protein: 20,
      carbs: 8,
      fat: 0,
      fiber: 0,
      sugar: 5,
      sodium: 80,
      source_type: 'GENERIC_REFERENCE',
      source_name: 'Generic nutrition reference',
      confidence_label: 'Matched',
      is_trusted: true,
      catalog_food_id: 'generic-yogurt',
    }, 1.5, 'cups');

    expect(scaled).toMatchObject({
      quantity: 1.5,
      unit: 'cup',
      calories: 180,
      protein: 30,
      carbs: 12,
      sodium: 120,
      catalog_food_id: 'generic-yogurt',
      source_name: 'Generic nutrition reference',
    });
  });

  it('normalizes malformed unit text', () => {
    expect(normalizeServingUnit('28.4 1 onz')).toBe('oz');
    expect(normalizeServingUnit('ounces')).toBe('oz');
    expect(normalizeServingUnit('grams')).toBe('g');
  });
});

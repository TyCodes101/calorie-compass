import { describe, expect, it } from 'vitest';

import { normalizeServingUnit, scaleFoodSearchItem } from '@/lib/food-scaling';
import { getCatalogFoods, scaleCatalogFood } from '@/lib/nutrition/catalog';
import { computeServingScaleFactor } from '@/lib/nutrition/scaling';

describe('serving scaling helpers', () => {
  it.each([
    ['breasts', 'breast'],
    ['order', 'serving'],
    ['orders', 'serving'],
  ])('treats %s as the corresponding provider-native %s', (requestedUnit, providerServingUnit) => {
    expect(computeServingScaleFactor({
      requestedQuantity: 2, requestedUnit,
      providerServingQuantity: 1, providerServingUnit,
    })?.scaleFactor).toBe(2);
  });

  it.each([['g', 100, 250], ['oz', 2, 141.75]] as const)(
    'uses the catalog serving weight for %s instead of multiplying by the amount',
    (unit, quantity, calories) => {
      const source = getCatalogFoods()[0];
      expect(source).toBeDefined();
      const scaled = scaleCatalogFood({
        ...source!, servingQuantity: 1, servingUnit: 'burger', servingGrams: 200,
        calories: 500, protein: 20, carbs: 40, fat: 25,
      }, quantity, unit);
      expect(scaled).toMatchObject({ quantity, unit, calories, is_trusted: true });
    },
  );

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

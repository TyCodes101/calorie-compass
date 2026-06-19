import { describe, expect, it } from 'vitest';

import type { ParsedFoodItem } from '@/lib/ai/types';
import { applyNutritionModifiers, extractNutritionModifiers } from '@/lib/nutrition/modifiers';

function item(overrides: Partial<ParsedFoodItem> = {}): ParsedFoodItem {
  return {
    food_name: "McDonald's McDouble",
    quantity: 1,
    unit: 'burger',
    calories: 390,
    protein: 22,
    carbs: 33,
    fat: 19,
    fiber: 2,
    sugar: 7,
    sodium: 920,
    notes: 'Matched to trusted catalog entry from McDonald\'s official nutrition',
    is_trusted: true,
    source_type: 'OFFICIAL_RESTAURANT',
    source_name: "McDonald's official nutrition",
    confidence_label: 'Verified',
    match_type: 'exact_restaurant',
    catalog_food_id: 'mcdonalds_mcdouble',
    ...overrides,
  };
}

describe('nutrition modifiers', () => {
  it('extracts modifier intent from user text', () => {
    expect(extractNutritionModifiers('McDouble without cheese')).toContain('no cheese');
    expect(extractNutritionModifiers('Subway meatball footlong')).toContain('footlong');
  });

  it('applies no-cheese only after the McDouble identity is established', () => {
    const [mcdouble, mcchicken] = applyNutritionModifiers(
      [
        item(),
        item({ food_name: 'McChicken', calories: 400, protein: 14, carbs: 39, fat: 21, sodium: 560 }),
      ],
      { text: 'McDouble no cheese' },
    );

    expect(mcdouble).toMatchObject({
      food_name: "McDonald's McDouble",
      calories: 340,
      protein: 19,
      carbs: 31,
      fat: 15,
      sodium: 730,
    });
    expect(mcdouble?.notes).toMatch(/no cheese adjustment/i);
    expect(mcchicken?.calories).toBe(400);
    expect(mcchicken?.notes).not.toMatch(/no cheese adjustment/i);
  });

  it('scales no-cheese adjustments by McDouble quantity', () => {
    const [mcdoubles] = applyNutritionModifiers(
      [
        item({
          quantity: 2,
          unit: 'burgers',
          calories: 780,
          protein: 44,
          carbs: 66,
          fat: 38,
          sodium: 1840,
        }),
      ],
      { text: '2 McDoubles without cheese' },
    );

    expect(mcdoubles).toMatchObject({
      food_name: "McDonald's McDouble",
      quantity: 2,
      calories: 680,
      protein: 38,
      carbs: 62,
      fat: 30,
      sodium: 1460,
    });
  });

  it('scales a six-inch Subway item to a footlong serving without duplicating the note', () => {
    const [footlong] = applyNutritionModifiers(
      [
        item({
          food_name: 'SUBWAY Meatball Marinara 6-Inch on white bread',
          quantity: 1,
          unit: '6-inch',
          calories: 480,
          protein: 20,
          carbs: 56,
          fat: 20,
          sodium: 1180,
          source_name: 'Subway official nutrition',
          catalog_food_id: 'subway_meatball_marinara_6in',
          notes: 'Matched to trusted catalog entry from Subway official nutrition',
        }),
      ],
      { text: 'Subway meatball marinara footlong' },
    );

    expect(footlong).toMatchObject({
      food_name: 'SUBWAY Meatball Marinara Footlong on white bread',
      quantity: 1,
      unit: 'footlong',
      calories: 960,
      protein: 40,
      carbs: 112,
      fat: 40,
      sodium: 2360,
    });
    expect(footlong?.notes?.match(/footlong adjustment/gi)).toHaveLength(1);
  });
});

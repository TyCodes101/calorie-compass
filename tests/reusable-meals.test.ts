import { describe, expect, it } from 'vitest';

import {
  buildLoggerDraftFromMealRecord,
  buildLoggerDraftFromReusableMealRecord,
  buildReusableMealTemplateInput,
} from '@/lib/reusable-meals';

describe('reusable meal helpers', () => {
  it('builds a reusable favorite template while preserving trust metadata', () => {
    const template = buildReusableMealTemplateInput({
      meal_type: 'snack',
      confidence_score: 0.91,
      raw_text: 'Fairlife protein shake',
      items: [
        {
          food_name: 'Fairlife Protein Shake',
          quantity: 1,
          unit: 'bottle',
          calories: 150,
          protein: 30,
          carbs: 4,
          fat: 3,
          fiber: 0,
          sugar: 2,
          sodium: 190,
          notes: 'Matched to trusted catalog entry from Fairlife nutrition reference',
          is_trusted: true,
          source_type: 'GENERIC_REFERENCE',
          source_name: 'Fairlife nutrition reference',
          catalog_food_id: 'fairlife_protein_shake',
        },
      ],
    });

    expect(template.title).toBe('Fairlife protein shake');
    expect(template.mealType).toBe('SNACK');
    expect(template.items).toHaveLength(1);
    expect(template.items[0]?.isTrusted).toBe(true);
    expect(template.items[0]?.sourceName).toBe('Fairlife nutrition reference');
    expect(template.items[0]?.catalogFoodId).toBe('fairlife_protein_shake');
  });

  it('builds a log-again draft from a stored meal record', () => {
    const draft = buildLoggerDraftFromMealRecord({
      id: 'meal_1',
      mealType: 'LUNCH',
      rawText: 'Chipotle bowl with white rice and chicken',
      confidenceScore: 0.92,
      items: [
        {
          foodName: 'Chipotle white rice',
          quantity: 1,
          unit: 'serving',
          calories: 210,
          protein: 4,
          carbs: 40,
          fat: 4,
          fiber: 1,
          sugar: 0,
          sodium: 350,
          notes: 'Matched to trusted catalog entry from Chipotle official nutrition',
          nutritionSourceType: 'OFFICIAL_RESTAURANT',
          nutritionSourceName: 'Chipotle official nutrition',
          catalogFoodId: 'chipotle_white_rice',
        },
      ],
    });

    expect(draft.mealType).toBe('lunch');
    expect(draft.rawText).toBe('Chipotle bowl with white rice and chicken');
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]?.is_trusted).toBe(true);
    expect(draft.items[0]?.source_name).toBe('Chipotle official nutrition');
    expect(draft.sourceReusableMealId).toBeNull();
  });

  it('builds a favorite draft from a reusable meal record', () => {
    const draft = buildLoggerDraftFromReusableMealRecord({
      id: 'favorite_1',
      mealType: 'BREAKFAST',
      title: 'Quick eggs',
      rawText: '2 scrambled eggs',
      items: [
        {
          foodName: 'Large egg',
          quantity: 2,
          unit: 'egg',
          calories: 140,
          protein: 12,
          carbs: 1.2,
          fat: 10,
          fiber: 0,
          sugar: 0.4,
          sodium: 140,
          notes: 'Matched to trusted catalog entry from Generic nutrition reference',
          isTrusted: true,
          sourceType: 'GENERIC_REFERENCE',
          sourceName: 'Generic nutrition reference',
          catalogFoodId: 'generic_large_egg',
        },
      ],
    });

    expect(draft.title).toBe('Quick eggs');
    expect(draft.mealType).toBe('breakfast');
    expect(draft.items[0]?.food_name).toBe('Large egg');
    expect(draft.items[0]?.catalog_food_id).toBe('generic_large_egg');
    expect(draft.sourceReusableMealId).toBe('favorite_1');
  });
});

import { describe, expect, it } from 'vitest';

import { getMockParsedMeal } from '@/lib/ai/mock';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';

describe('AI normalization', () => {
  it('fills totals from items when totals are missing', () => {
    const response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: 'lunch',
      confidence_score: 0.8,
      items: [
        {
          food_name: 'Chicken breast',
          quantity: 1,
          unit: 'serving',
          calories: 220,
          protein: 42,
          carbs: 0,
          fat: 5,
          fiber: 0,
          sugar: 0,
          sodium: 140,
        },
      ],
    });

    expect(response.totals.calories).toBe(220);
    expect(response.totals.protein).toBe(42);
  });

  it('returns clarification for vague chicken and rice input in mock mode', () => {
    const response = getMockParsedMeal('I had chicken and rice');

    expect(response.needs_clarification).toBe(true);
    expect(response.clarifying_question).toMatch(/how much chicken and rice/i);
  });
});

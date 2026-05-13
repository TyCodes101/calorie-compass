import { describe, expect, it } from 'vitest';

import { getMockParsedMeal } from '@/lib/ai/mock';

const cases = [
  {
    label: 'chipotle specific meal',
    text: 'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
    mealType: 'lunch' as const,
    expectClarification: false,
    minItems: 4,
  },
  {
    label: 'protein shake simple meal',
    text: 'Protein shake with almond milk',
    mealType: 'snack' as const,
    expectClarification: false,
    minItems: 1,
  },
  {
    label: 'countable simple snack with quantity',
    text: '2 rice cakes',
    mealType: 'snack' as const,
    expectClarification: false,
    minItems: 1,
  },
  {
    label: 'bare protein shake gets a default estimate',
    text: 'protein shake',
    mealType: 'snack' as const,
    expectClarification: false,
    minItems: 1,
  },
  {
    label: 'fairlife 42g shake gets branded product matching',
    text: '42g Fairlife shake',
    mealType: 'snack' as const,
    expectClarification: false,
    minItems: 1,
  },
  {
    label: 'vague chicken and rice',
    text: 'Chicken and rice',
    mealType: 'dinner' as const,
    expectClarification: true,
    minItems: 0,
  },
  {
    label: 'vague salad gets an estimate-first review',
    text: 'I had a salad',
    mealType: 'lunch' as const,
    expectClarification: false,
    minItems: 1,
  },
  {
    label: 'mcdonalds combo meal',
    text: "McDonald's cheeseburger, fries, and a coke",
    mealType: 'dinner' as const,
    expectClarification: false,
    minItems: 3,
  },
];

describe('AI regression coverage', () => {
  for (const testCase of cases) {
    it(`handles ${testCase.label}`, () => {
      const response = getMockParsedMeal(testCase.text, testCase.mealType);

      expect(response.needs_clarification).toBe(testCase.expectClarification);
      expect(response.items.length).toBeGreaterThanOrEqual(testCase.minItems);
      expect(response.confidence_score).toBeGreaterThan(0);
      expect(response.confidence_score).toBeLessThanOrEqual(0.95);

      if (!response.needs_clarification) {
        expect(response.totals.calories).toBeGreaterThan(0);
      }
    });
  }
});

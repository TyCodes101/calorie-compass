import { describe, expect, it } from 'vitest';

import { getMockParsedMeal } from '@/lib/ai/mock';

describe('restaurant-aware fallback parsing', () => {
  it('parses a Chick-fil-A meal with fries without clarification', () => {
    const response = getMockParsedMeal('I had Chick-fil-A nuggets and fries', 'lunch');

    expect(response.needs_clarification).toBe(false);
    expect(response.items.length).toBeGreaterThanOrEqual(2);
    expect(response.items.some((item) => /chick-fil-a nuggets/i.test(item.food_name))).toBe(true);
    expect(response.items.some((item) => /waffle fries/i.test(item.food_name))).toBe(true);
    expect(response.confidence_score).toBeGreaterThanOrEqual(0.75);
  });

  it("parses a McDonald's combo with multiple items", () => {
    const response = getMockParsedMeal("I had McDonald's cheeseburger, fries, and a coke", 'dinner');

    expect(response.needs_clarification).toBe(false);
    expect(response.items.length).toBeGreaterThanOrEqual(3);
    expect(response.items.some((item) => /cheeseburger/i.test(item.food_name))).toBe(true);
    expect(response.items.some((item) => /fries/i.test(item.food_name))).toBe(true);
    expect(response.items.some((item) => /soft drink/i.test(item.food_name))).toBe(true);
  });
});

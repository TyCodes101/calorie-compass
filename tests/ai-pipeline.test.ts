import { describe, expect, it } from 'vitest';

import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';
import { scoreMealConfidence } from '@/lib/ai/confidence';
import { getMockParsedMeal } from '@/lib/ai/mock';

describe('AI pipeline', () => {
  it('detects a known restaurant meal with high specificity', () => {
    const analysis = analyzeMealText(
      'I had a Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa.'
    );

    expect(analysis.brand).toBe('chipotle');
    expect(analysis.category).toBe('restaurant');
    expect(analysis.specificity).toBe('high');
    expect(analysis.likelyNeedsClarification).toBe(false);
  });

  it('detects a vague home-cooked meal that should clarify', () => {
    const analysis = analyzeMealText('I had chicken and rice');
    const clarification = buildClarificationDecision(analysis);

    expect(analysis.category).toBe('home_cooked');
    expect(analysis.specificity).toBe('low');
    expect(clarification.needsClarification).toBe(true);
    expect(clarification.question).toMatch(/how much/i);
  });

  it('scores restaurant meals higher than vague meals', () => {
    const restaurantAnalysis = analyzeMealText(
      'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa'
    );
    const vagueAnalysis = analyzeMealText('pasta');

    const restaurantScore = scoreMealConfidence(restaurantAnalysis, { itemCount: 6, clarificationNeeded: false });
    const vagueScore = scoreMealConfidence(vagueAnalysis, { itemCount: 1, clarificationNeeded: true });

    expect(restaurantScore).toBeGreaterThan(vagueScore);
    expect(restaurantScore).toBeGreaterThanOrEqual(0.8);
    expect(vagueScore).toBeLessThanOrEqual(0.55);
  });

  it('uses improved fallback logic for Starbucks breakfast meals', () => {
    const response = getMockParsedMeal('Starbucks bacon gouda sandwich and a grande latte', 'breakfast');

    expect(response.needs_clarification).toBe(false);
    expect(response.meal_type).toBe('breakfast');
    expect(response.items.some((item) => /starbucks/i.test(item.food_name))).toBe(true);
    expect(response.confidence_score).toBeGreaterThanOrEqual(0.75);
  });
});

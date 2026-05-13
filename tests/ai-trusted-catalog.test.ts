import { describe, expect, it } from 'vitest';

import { getMockParsedMeal } from '@/lib/ai/mock';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';

describe('trusted nutrition catalog matching', () => {
  it('matches a Chipotle bowl to trusted official entries', () => {
    const response = getTrustedCatalogEstimate(
      'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
      'lunch'
    );

    expect(response).not.toBeNull();
    expect(response?.items).toHaveLength(6);
    expect(response?.items.every((item) => item.is_trusted)).toBe(true);
    expect(response?.items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT')).toBe(true);
    expect(response?.items.find((item) => /chicken/i.test(item.food_name))?.quantity).toBe(2);
    expect(response?.totals.calories).toBe(780);
  });

  it('matches generic foods with quantity scaling from the trusted catalog', () => {
    const response = getTrustedCatalogEstimate('3 scrambled eggs and 2 slices of toast', 'breakfast');

    expect(response).not.toBeNull();
    expect(response?.items).toHaveLength(2);
    expect(response?.items.every((item) => item.source_type === 'GENERIC_REFERENCE')).toBe(true);
    expect(response?.items.find((item) => /egg/i.test(item.food_name))?.quantity).toBe(3);
    expect(response?.items.find((item) => /bread/i.test(item.food_name))?.quantity).toBe(2);
    expect(response?.totals.calories).toBe(390);
  });

  it('supports mixed trusted and estimated outputs for partially matched meals', () => {
    const response = getTrustedCatalogEstimate('3 eggs and hash browns', 'breakfast');

    expect(response).not.toBeNull();
    expect(response?.items.some((item) => item.is_trusted)).toBe(true);
    expect(response?.items.some((item) => item.source_type === 'AI_ESTIMATE')).toBe(true);
    expect(response?.totals.calories).toBeGreaterThan(210);
  });
});

describe('trusted catalog integration', () => {
  it('uses the trusted catalog before generic fallback parsing', () => {
    const response = getMockParsedMeal('Protein shake with almond milk', 'snack');

    expect(response.needs_clarification).toBe(false);
    expect(response.items).toHaveLength(2);
    expect(response.items.every((item) => item.is_trusted)).toBe(true);
    expect(response.items.every((item) => item.source_name)).toBeTruthy();
    expect(response.totals.calories).toBe(150);
  });
});

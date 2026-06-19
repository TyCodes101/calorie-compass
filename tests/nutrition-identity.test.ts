import { describe, expect, it } from 'vitest';

import {
  chooseIdentityCandidate,
  scoreFoodIdentity,
  type FoodIdentityCandidate,
} from '@/lib/nutrition/identity';

const restaurantCandidate = (
  name: string,
  restaurant: string,
  sourceTrust: FoodIdentityCandidate['sourceTrust'] = 'official_restaurant',
): FoodIdentityCandidate => ({
  id: name,
  name,
  restaurant,
  brand: restaurant,
  modifiers: [],
  servingUnit: 'item',
  sourceTrust,
});

describe('food identity scoring', () => {
  it('hard-rejects a different product category at the same restaurant', () => {
    const result = scoreFoodIdentity(
      { text: "Wendy's Baconator", restaurant: "Wendy's", brand: "Wendy's" },
      restaurantCandidate("Wendy's Spicy Chicken Sandwich", "Wendy's"),
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('product_identity_conflict');
  });

  it('allows a one-edit typo without allowing product substitution', () => {
    const mcdouble = scoreFoodIdentity(
      { text: 'mcdonalds mcduble', restaurant: "McDonald's", brand: "McDonald's" },
      restaurantCandidate("McDonald's McDouble", "McDonald's"),
    );
    const mcchicken = scoreFoodIdentity(
      { text: 'mcdonalds mcduble', restaurant: "McDonald's", brand: "McDonald's" },
      restaurantCandidate("McDonald's McChicken", "McDonald's"),
    );

    expect(mcdouble.eligible).toBe(true);
    expect(mcdouble.score).toBeGreaterThanOrEqual(85);
    expect(mcchicken.eligible).toBe(false);
  });

  it('hard-rejects an explicit restaurant conflict', () => {
    const result = scoreFoodIdentity(
      { text: 'Subway meatball footlong', restaurant: 'Subway', brand: 'Subway' },
      restaurantCandidate("Arby's Classic Roast Beef Sandwich", "Arby's"),
    );

    expect(result).toMatchObject({
      eligible: false,
      score: 0,
    });
    expect(result.reasons).toContain('restaurant_conflict');
  });

  it('scores modifiers after product identity is established', () => {
    const result = scoreFoodIdentity(
      {
        text: 'McDouble no cheese',
        restaurant: "McDonald's",
        brand: "McDonald's",
        modifiers: ['no cheese'],
      },
      {
        ...restaurantCandidate("McDonald's McDouble", "McDonald's"),
        modifiers: ['no cheese'],
      },
    );

    expect(result.eligible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.reasons).not.toContain('modifier_conflict');
  });

  it('marks a close top-two margin as low confidence', () => {
    const choice = chooseIdentityCandidate(
      { text: 'Greek yogurt' },
      [
        {
          id: 'plain',
          name: 'Greek Yogurt Plain',
          brand: null,
          restaurant: null,
          modifiers: [],
          servingUnit: 'cup',
          sourceTrust: 'curated_generic',
        },
        {
          id: 'nonfat',
          name: 'Greek Yogurt Nonfat',
          brand: null,
          restaurant: null,
          modifiers: [],
          servingUnit: 'cup',
          sourceTrust: 'curated_generic',
        },
      ],
    );

    expect(choice.confidence).toBe('low');
    expect(choice.margin).toBeLessThan(8);
    expect(choice.shouldClarify).toBe(true);
  });
});

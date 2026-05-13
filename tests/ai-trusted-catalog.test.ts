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

  it('normalizes half portions for restaurant bowls', () => {
    const response = getTrustedCatalogEstimate(
      'half a Chipotle bowl with white rice, chicken, cheese, corn salsa, lettuce, and green salsa',
      'lunch'
    );

    expect(response).not.toBeNull();
    expect(response?.items).toHaveLength(6);
    expect(response?.items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT')).toBe(true);
    expect(response?.items.find((item) => /rice/i.test(item.food_name))?.quantity).toBe(0.5);
    expect(response?.items.find((item) => /chicken/i.test(item.food_name))?.quantity).toBe(0.5);
    expect(response?.totals.calories).toBe(300);
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

  it('matches countable simple foods with trusted defaults instead of requiring follow-up', () => {
    const riceCakes = getTrustedCatalogEstimate('2 rice cakes', 'snack');
    const proteinBar = getTrustedCatalogEstimate('1 protein bar', 'snack');
    const yogurt = getTrustedCatalogEstimate('1 Greek yogurt', 'breakfast');
    const apples = getTrustedCatalogEstimate('2 apples', 'snack');
    const bagel = getTrustedCatalogEstimate('1 bagel', 'breakfast');

    expect(riceCakes?.items[0]?.food_name).toMatch(/rice cake/i);
    expect(riceCakes?.items[0]?.quantity).toBe(2);
    expect(proteinBar?.items[0]?.food_name).toMatch(/protein bar/i);
    expect(yogurt?.items[0]?.food_name).toMatch(/greek yogurt/i);
    expect(apples?.items[0]?.quantity).toBe(2);
    expect(bagel?.items[0]?.food_name).toMatch(/bagel/i);
    expect([riceCakes, proteinBar, yogurt, apples, bagel].every((response) => response?.items.every((item) => item.is_trusted))).toBe(true);
  });

  it('matches packaged protein drinks to trusted branded entries', () => {
    const response = getTrustedCatalogEstimate('Fairlife protein shake', 'snack');

    expect(response).not.toBeNull();
    expect(response?.items).toHaveLength(1);
    expect(response?.items[0]?.is_trusted).toBe(true);
    expect(response?.items[0]?.source_type).toBe('GENERIC_REFERENCE');
    expect(response?.items[0]?.source_name).toMatch(/fairlife/i);
    expect(response?.items[0]?.food_name).toMatch(/fairlife/i);
  });

  it('supports mixed trusted and estimated outputs for partially matched meals', () => {
    const response = getTrustedCatalogEstimate('3 eggs and hash browns', 'breakfast');

    expect(response).not.toBeNull();
    expect(response?.items.some((item) => item.is_trusted)).toBe(true);
    expect(response?.items.some((item) => item.source_type === 'AI_ESTIMATE')).toBe(true);
    expect(response?.totals.calories).toBeGreaterThan(210);
  });

  it('supports stronger portion-aware restaurant matching', () => {
    const response = getTrustedCatalogEstimate('large Chick-fil-A fries', 'lunch');

    expect(response).not.toBeNull();
    expect(response?.items).toHaveLength(1);
    expect(response?.items[0]?.is_trusted).toBe(true);
    expect(response?.items[0]?.source_type).toBe('OFFICIAL_RESTAURANT');
    expect(response?.items[0]?.unit).toMatch(/large/i);
    expect(response?.totals.calories).toBeGreaterThan(450);
  });

  it('keeps homemade mixed meals usable with partial trusted matching', () => {
    const response = getTrustedCatalogEstimate('homemade chicken Alfredo', 'dinner');

    expect(response).not.toBeNull();
    expect(response?.items.some((item) => item.is_trusted)).toBe(true);
    expect(response?.items.some((item) => item.source_type === 'AI_ESTIMATE')).toBe(true);
    expect(response?.totals.calories).toBeGreaterThan(400);
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

  it('prefers trusted branded matching over generic fallback for packaged drinks', () => {
    const response = getMockParsedMeal('Fairlife protein shake', 'snack');

    expect(response.needs_clarification).toBe(false);
    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.is_trusted).toBe(true);
    expect(response.items[0]?.food_name).toMatch(/fairlife/i);
  });
});

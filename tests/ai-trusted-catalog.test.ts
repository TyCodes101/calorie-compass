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

  it('matches branded and compound rice-cake phrases before generic decomposition', () => {
    const branded = getTrustedCatalogEstimate('3 quaker oats rice cakes white cheddar', 'snack');
    const flavored = getTrustedCatalogEstimate('white cheddar rice cakes', 'snack');
    const quaker = getTrustedCatalogEstimate('quaker rice cakes', 'snack');
    const plain = getTrustedCatalogEstimate('rice cakes', 'snack');

    expect(branded).not.toBeNull();
    expect(branded?.items).toHaveLength(1);
    expect(branded?.items[0]?.food_name).toMatch(/quaker white cheddar rice cakes/i);
    expect(branded?.items[0]?.quantity).toBe(3);

    expect(flavored?.items[0]?.food_name).toMatch(/white cheddar rice cakes/i);
    expect(quaker?.items[0]?.food_name).toMatch(/quaker rice cakes/i);
    expect(plain?.items[0]?.food_name).toMatch(/rice cake/i);
  });

  it('does not decompose quaker oats rice cakes into oats plus rice', () => {
    const response = getTrustedCatalogEstimate('3 quaker oats rice cakes which are 50-60 cals each white cheddar', 'snack');

    expect(response).not.toBeNull();
    expect(response?.items).toHaveLength(1);
    expect(response?.items[0]?.food_name).toMatch(/white cheddar rice cakes/i);
    expect(response?.items[0]?.food_name).not.toMatch(/^dry oats$/i);
    expect(response?.totals.calories).toBeGreaterThan(100);
  });

  it('prefers the 42g Fairlife Core Power Elite product when the protein signal is explicit', () => {
    const cases = [
      '42g Fairlife shake',
      'Fairlife protein shake 42g',
      'Fairlife Core Power 42g',
      'Fairlife Core Power Elite 42g',
      'I drank a Fairlife 42 gram protein shake',
    ];

    for (const text of cases) {
      const response = getTrustedCatalogEstimate(text, 'snack');

      expect(response).not.toBeNull();
      expect(response?.items[0]?.food_name).toMatch(/core power elite 42g/i);
      expect(response?.items[0]?.calories).toBe(230);
      expect(response?.items[0]?.protein).toBe(42);
      expect(response?.items[0]?.notes).toMatch(/estimated as fairlife core power elite 42g protein shake/i);
    }
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

  it('normalizes compact restaurant names and fuzzy-matches common menu phrases', () => {
    const potatoTacos = getTrustedCatalogEstimate('I had 3 soft potato tacos from tacobell', 'lunch');
    const mcdonalds = getTrustedCatalogEstimate('mcdonalds chicken sandwich', 'lunch');
    const subway = getTrustedCatalogEstimate('subway footlong turkey', 'lunch');
    const canes = getTrustedCatalogEstimate('caniac combo from canes', 'dinner');
    const dominos = getTrustedCatalogEstimate('dominos pepperoni pizza', 'dinner');
    const panera = getTrustedCatalogEstimate('panera mac and cheese', 'lunch');

    expect(potatoTacos).not.toBeNull();
    expect(potatoTacos?.items).toHaveLength(1);
    expect(potatoTacos?.items[0]?.food_name).toBe('Taco Bell Spicy Potato Soft Taco');
    expect(potatoTacos?.items[0]?.quantity).toBe(3);
    expect(potatoTacos?.items[0]?.source_type).toBe('OFFICIAL_RESTAURANT');

    expect(mcdonalds?.items[0]?.food_name).toMatch(/McChicken/i);
    expect(subway?.items[0]?.food_name).toMatch(/Footlong/i);
    expect(canes?.items[0]?.food_name).toMatch(/Caniac Combo/i);
    expect(dominos?.items[0]?.food_name).toMatch(/Pepperoni Pizza/i);
    expect(panera?.items[0]?.food_name).toMatch(/Mac and Cheese/i);
    expect([potatoTacos, mcdonalds, subway, canes, dominos, panera].every((response) => response?.items.every((item) => item.is_trusted))).toBe(true);
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

  it('preserves the user food phrase for generic mock fallbacks', () => {
    const response = getMockParsedMeal('homemade turkey chili with crackers', 'dinner');

    expect(response.items[0]?.food_name).toBe('homemade turkey chili with crackers');
    expect(response.items[0]?.food_name).not.toMatch(/estimated mixed meal/i);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import {
  ambiguousFoods,
  assertItemNutritionPlausible,
  assertNoSilentSave,
  assertResponseHasValidState,
  buildGauntletState,
  isolateFoodGauntletEnv,
  pendingMeal,
  quantities,
  restaurantFixtures,
} from '@/tests/utils/foodGauntlet';

const sanityPrompts = [
  ...restaurantFixtures.slice(0, 12).flatMap((fixture) => [
    `${fixture.brand} ${fixture.foods[0]}`,
    `${fixture.brand} ${fixture.foods[1]}`,
  ]),
  ...[
    'one bag Flamin Hot Cheetos',
    'one bag Doritos',
    "one bag Lay's chips",
    'one can Diet Coke',
    'one can Coke Zero',
    'one bottle Gatorade',
    'one Celsius drink',
    'Fairlife protein shake',
    'Quest BBQ chips',
    'Oreo cookies',
    'Pop-Tarts',
    'Cheez-It crackers',
  ],
  ...[
    '2 grilled chicken breasts and asparagus',
    'buttered corn on the cob',
    'scrambled eggs and toast',
    'oatmeal with peanut butter',
    'rice chicken and broccoli',
    'baked potato with butter',
    'salmon and green beans',
    'ground beef and rice',
    'protein shake',
    'turkey sandwich',
    'Caesar salad',
    'pasta with marinara',
    'homemade burger and fries',
  ],
  ...quantities.slice(0, 12).map((quantity) => `${quantity} chicken breast`),
];

async function resolvePrompt(prompt: string) {
  const response = await runMealAssistant({
    message: prompt,
    state: buildGauntletState({ mealType: 'dinner' }),
  });
  assertResponseHasValidState(response, prompt);
  return response;
}

describe('nutrition plausibility guardrails', () => {
  beforeEach(() => {
    isolateFoodGauntletEnv();
  });

  it.each(sanityPrompts)('keeps normal prompt nutrition plausible: %s', async (prompt) => {
    const response = await resolvePrompt(prompt);

    assertNoSilentSave(response, prompt);
    expect(response.meal.totals.calories, prompt).toBeLessThan(12_000);
    for (const item of response.meal.items) {
      assertItemNutritionPlausible(item, prompt);
      expect(item.quantity, prompt).toBeGreaterThan(0);
    }
    if (pendingMeal(response.next_state)) {
      expect(pendingMeal(response.next_state)?.totals.calories, prompt).toBe(response.meal.totals.calories);
    }
  });

  it.each(['Diet Coke', 'Coke Zero', 'diet cooe'])('keeps zero-calorie soda variants from drifting high: %s', async (prompt) => {
    const response = await resolvePrompt(prompt);

    expect(response.meal.totals.calories, prompt).toBeLessThanOrEqual(10);
    for (const item of response.meal.items) {
      expect(item.calories, prompt).toBeLessThanOrEqual(10);
    }
  });

  it('keeps no-cheese McDouble calories at or below the regular McDouble when both are resolved', async () => {
    const regular = await resolvePrompt("McDonald's McDouble");
    const noCheese = await resolvePrompt("McDonald's McDouble no cheese");

    if (regular.meal.items.length && noCheese.meal.items.length) {
      expect(noCheese.meal.totals.calories).toBeLessThanOrEqual(regular.meal.totals.calories);
      expect(noCheese.meal.items.map((item) => item.food_name).join(' ')).not.toMatch(/\bMcChicken\b/i);
    }
  });

  it('keeps Subway footlong larger than 6-inch for the same meatball sandwich family', async () => {
    const sixInch = await resolvePrompt('Subway meatball 6 inch');
    const footlong = await resolvePrompt('Subway meatball footlong');

    if (sixInch.meal.items.length && footlong.meal.items.length) {
      expect(footlong.meal.totals.calories).toBeGreaterThanOrEqual(sixInch.meal.totals.calories);
      expect(sixInch.meal.items.map((item) => `${item.food_name} ${item.unit}`).join(' ')).not.toMatch(/\bfootlong\b/i);
    }
  });

  it('scales simple serving quantities upward without producing absurd totals', async () => {
    const oneServing = await resolvePrompt('1 serving rice');
    const twoServings = await resolvePrompt('2 servings rice');

    expect(twoServings.meal.totals.calories).toBeGreaterThanOrEqual(oneServing.meal.totals.calories);
    expect(twoServings.meal.totals.calories).toBeLessThan(2_000);
  });

  it('removing an item from a pending meal does not increase total calories', async () => {
    const initial = await runMealAssistant({
      message: 'burger fries and soda',
      state: buildGauntletState({ mealType: 'dinner' }),
    });
    const removed = await runMealAssistant({
      message: 'remove fries',
      state: initial.next_state,
    });

    assertResponseHasValidState(initial, 'burger fries and soda');
    assertResponseHasValidState(removed, 'remove fries');
    expect(removed.meal.totals.calories).toBeLessThanOrEqual(initial.meal.totals.calories);
  });

  it.each(ambiguousFoods)('keeps ambiguous prompt confidence conservative: %s', async (prompt) => {
    const response = await resolvePrompt(prompt);

    for (const item of response.meal.items) {
      expect(item.confidence_label, prompt).not.toBe('Verified');
      expect(item.source_type, prompt).not.toBe('OFFICIAL_RESTAURANT');
    }
    expect(response.should_save_meal, prompt).toBe(false);
  });
});

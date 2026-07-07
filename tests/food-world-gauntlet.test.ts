import { beforeEach, describe, expect, it } from 'vitest';

import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import {
  ambiguousFoods,
  assertBrandIdentitySafe,
  assertFoodKindNotSwapped,
  assertModifierRepresented,
  assertNoSilentSave,
  assertResponseHasValidState,
  assertRestaurantIdentitySafe,
  assertReviewOrClarification,
  brandedFixtures,
  buildGauntletState,
  genericFoods,
  isolateFoodGauntletEnv,
  makeSeededRandom,
  modifiers,
  normalizeForAssert,
  pick,
  type PromptCase,
  quantities,
  restaurantFixtures,
  typoVariant,
} from '@/tests/utils/foodGauntlet';

function buildRestaurantCases(): PromptCase[] {
  const cases: PromptCase[] = [];
  for (const fixture of restaurantFixtures) {
    for (const food of fixture.foods) {
      cases.push({
        name: `${fixture.brand}: ${food}`,
        prompt: `${fixture.brand} ${food}`,
        expectedRestaurant: fixture,
        expectedFoodKind: /\b(?:burger|whopper|baconator|big mac|mcdouble|roast beef|steak)\b/i.test(food)
          ? 'burger'
          : /\bchicken|nugget|tender\b/i.test(food)
            ? 'chicken'
            : undefined,
      });
    }
    cases.push({
      name: `${fixture.brand}: unknown item stays safe`,
      prompt: `${fixture.brand} ${fixture.unknownFood}`,
      expectedRestaurant: fixture,
    });
    const alias = fixture.aliases.at(-1) ?? fixture.brand;
    cases.push({
      name: `${fixture.brand}: alias ${alias}`,
      prompt: `${alias} ${fixture.foods[0]}`,
      expectedRestaurant: fixture,
    });
  }
  return cases;
}

function buildPackagedCases(): PromptCase[] {
  const cases: PromptCase[] = [];
  const packagedQuantities = ['one bag', 'one bottle', 'one can', '2 servings'] as const;
  for (const fixture of brandedFixtures) {
    for (const food of fixture.foods) {
      cases.push({
        name: `${fixture.brand}: ${food}`,
        prompt: food,
        expectedBrand: fixture,
      });
    }
    for (const quantity of packagedQuantities) {
      cases.push({
        name: `${fixture.brand}: ${quantity}`,
        prompt: `${quantity} ${fixture.foods[0]}`,
        expectedBrand: fixture,
      });
    }
    cases.push({
      name: `${fixture.brand}: typo`,
      prompt: typoVariant(fixture.foods[0], makeSeededRandom(fixture.brand.length * 997)),
      expectedBrand: fixture,
    });
  }
  return cases;
}

function buildGenericCases(): PromptCase[] {
  const cases: PromptCase[] = [];
  const quantitySubset = quantities.filter((_, index) => index % 2 === 0);
  const modifierSubset = modifiers.filter((_, index) => index % 3 === 0);
  for (const food of genericFoods) {
    for (const quantity of quantitySubset) {
      cases.push({
        name: `generic: ${quantity} ${food}`,
        prompt: `${quantity} ${food}`,
        expectedFoodKind: /\bchicken\b/i.test(food) ? 'chicken' : /\b(?:ground beef|steak)\b/i.test(food) ? 'beef' : 'generic',
      });
    }
    for (const modifier of modifierSubset) {
      cases.push({
        name: `generic modifier: ${food} ${modifier}`,
        prompt: `${food} ${modifier}`,
        expectedModifier: modifier,
        expectedFoodKind: /\bchicken\b/i.test(food) ? 'chicken' : /\b(?:ground beef|steak)\b/i.test(food) ? 'beef' : 'generic',
      });
    }
  }
  return cases;
}

function buildModifierCases(): PromptCase[] {
  const random = makeSeededRandom(22_038);
  const baseRestaurants = restaurantFixtures.slice(0, 14);
  const cases: PromptCase[] = [];
  for (const fixture of baseRestaurants) {
    for (const modifier of modifiers) {
      const baseFood = pick(fixture.foods, random);
      if (/\bfootlong\b/i.test(modifier) && !/\bsub|meatball|bmt|sandwich\b/i.test(baseFood)) {
        continue;
      }
      if (/\b6 inch\b/i.test(modifier) && !/\bsub|meatball|bmt|sandwich\b/i.test(baseFood)) {
        continue;
      }
      cases.push({
        name: `${fixture.brand}: ${baseFood} ${modifier}`,
        prompt: `${fixture.brand} ${baseFood} ${modifier}`,
        expectedRestaurant: fixture,
        expectedModifier: modifier,
      });
    }
  }
  return cases;
}

function buildAmbiguousCases(): PromptCase[] {
  return ambiguousFoods.flatMap((food) => [
    {
      name: `ambiguous: ${food}`,
      prompt: food,
      ambiguous: true,
    },
    {
      name: `ambiguous typo: ${food}`,
      prompt: typoVariant(food, makeSeededRandom(food.length * 313)),
      ambiguous: true,
    },
  ]);
}

const worldCases = [
  ...buildRestaurantCases(),
  ...buildPackagedCases(),
  ...buildGenericCases(),
  ...buildModifierCases(),
  ...buildAmbiguousCases(),
];

describe('world-scale food prompt gauntlet', () => {
  beforeEach(() => {
    isolateFoodGauntletEnv();
  });

  it.each(worldCases)('keeps prompt safe and reviewable: $name', async (testCase) => {
    const response = await runMealAssistant({
      message: testCase.prompt,
      state: buildGauntletState({ mealType: 'dinner' }),
    });

    assertResponseHasValidState(response, testCase.prompt);
    assertNoSilentSave(response, testCase.prompt);
    assertReviewOrClarification(response, testCase.prompt);
    assertFoodKindNotSwapped(response, testCase.prompt);

    if (testCase.expectedRestaurant) {
      assertRestaurantIdentitySafe(response, testCase.expectedRestaurant, testCase.prompt);
    }
    if (testCase.expectedBrand) {
      assertBrandIdentitySafe(response, testCase.expectedBrand, testCase.prompt);
    }
    if (testCase.expectedModifier) {
      assertModifierRepresented(response, testCase.expectedModifier, testCase.prompt);
    }
    if (testCase.ambiguous) {
      const officialItems = response.meal.items.filter((item) => item.source_type === 'OFFICIAL_RESTAURANT');
      expect(officialItems, `${testCase.prompt}: ambiguous prompt picked an official restaurant`).toHaveLength(0);
      for (const item of response.meal.items) {
        expect(item.confidence_label, `${testCase.prompt}: ambiguous item should not look verified`).not.toBe('Verified');
      }
    }

    const normalizedPrompt = normalizeForAssert(testCase.prompt);
    if (normalizedPrompt.includes('diet coke') || normalizedPrompt.includes('diet cooe') || normalizedPrompt.includes('coke zero')) {
      expect(response.meal.totals.calories, `${testCase.prompt}: zero-calorie soda drifted high`).toBeLessThanOrEqual(10);
    }
  });

  it('documents generated prompt breadth', () => {
    expect(worldCases.length).toBeGreaterThanOrEqual(900);
  });
});


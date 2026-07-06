import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import {
  assertBrandIdentitySafe,
  assertNoSilentSave,
  assertResponseHasValidState,
  assertRestaurantIdentitySafe,
  brandedFixtures,
  buildGauntletState,
  chunk,
  type ConversationCase,
  genericFoods,
  isolateFoodGauntletEnv,
  makeSeededRandom,
  modifiers,
  pendingMeal,
  pick,
  quantities,
  restaurantFixtures,
  typoVariant,
} from '@/tests/utils/foodGauntlet';

const clearRestaurantPrompts = restaurantFixtures.flatMap((fixture) => (
  fixture.foods.slice(0, 2).map((food) => ({
    prompt: `${fixture.brand} ${food}`,
    restaurant: fixture,
  }))
));

const clearBrandPrompts = brandedFixtures.flatMap((fixture) => (
  fixture.foods.slice(0, 1).map((food) => ({
    prompt: food,
    brand: fixture,
  }))
));

const clearGenericPrompts = genericFoods.map((food) => ({ prompt: `2 ${food}` }));

function buildFuzzCases(count: number): ConversationCase[] {
  const random = makeSeededRandom(38_580);
  const cases: ConversationCase[] = [];
  const basePrompts = [...clearRestaurantPrompts, ...clearBrandPrompts, ...clearGenericPrompts];
  const confirmationSets = [
    ['where is my macros', 'yes', 'yes'],
    ['where is my macros', 'save it', 'save it'],
    ['what did I log', 'yep', 'save it'],
    ['confirm', 'confirm'],
  ];
  const mutationSets = [
    ['add apple', 'save it', 'save it'],
    ['add McDouble no cheese', 'yes', 'yes'],
    ['replace with McDouble no cheese', 'save it'],
    ['change it to Subway meatball footlong', 'yes'],
    ['actually no cheese', 'save it'],
    ['no, make it 2', 'save it'],
    ['change the drink to Diet Coke', 'save it'],
    ['remove fries', 'save it'],
  ];
  const cancelSets = [
    ['cancel', 'save it'],
    ['delete that', 'yes'],
    ['start over', 'save it'],
  ];
  const softCancelSets = [
    ['nvm', 'where is my macros'],
    ['undo', 'what did I log'],
  ];

  for (let index = 0; index < count; index += 1) {
    const base = pick(basePrompts, random);
    const modifier = pick(modifiers, random);
    const quantity = pick(quantities, random);
    const promptMode = index % 6;
    const firstPrompt = promptMode === 0
      ? `log ${base.prompt}`
      : promptMode === 1
        ? `${quantity} ${base.prompt}`
        : promptMode === 2
          ? `${base.prompt} ${modifier}`
          : promptMode === 3
            ? typoVariant(base.prompt, random)
            : promptMode === 4
              ? `add ${base.prompt}`
              : `${base.prompt} and ${pick(genericFoods, random)}`;

    const flowMode = index % 17;
    const followUps = flowMode < 4
      ? confirmationSets[flowMode]!
      : flowMode < 12
        ? mutationSets[flowMode - 4]!
        : flowMode < 15
          ? cancelSets[flowMode - 12]!
          : softCancelSets[flowMode - 15]!;

    cases.push({
      name: `seeded-${index}-${firstPrompt}-${followUps.join('-')}`,
      firstPrompt,
      followUps,
      expectsSave: followUps.some((turn) => /^(?:yes|yep|save it|confirm)$/i.test(turn)) && !cancelSets.some((set) => set === followUps),
      expectsCancel: cancelSets.some((set) => set === followUps),
      expectedRestaurant: 'restaurant' in base ? base.restaurant : undefined,
      expectedBrand: 'brand' in base ? base.brand : undefined,
    });
  }

  return cases;
}

const fuzzCases = buildFuzzCases(720);
const fuzzShards = chunk(fuzzCases, 30).map((cases, index) => ({ index, cases }));

function isSaveConfirmation(message: string) {
  return /^(?:yes|yep|save it|confirm)$/i.test(message.trim());
}

function isQuestionCommand(message: string) {
  return /\b(?:macro|what did i log|where is my macros)\b/i.test(message);
}

describe('deterministic food conversation fuzz gauntlet', () => {
  beforeEach(() => {
    isolateFoodGauntletEnv();
  });

  it.each(fuzzShards)('keeps generated conversation shard $index safe', async ({ cases }) => {
    for (const testCase of cases) {
      const saveMeal = vi.fn(async () => undefined);
      let state = buildGauntletState({ mealType: 'dinner' });
      let response = await runMealAssistant({ message: testCase.firstPrompt, state }, { saveMeal });

      assertResponseHasValidState(response, testCase.firstPrompt);
      assertNoSilentSave(response, testCase.firstPrompt);
      expect(saveMeal, testCase.name).toHaveBeenCalledTimes(0);
      if (testCase.expectedRestaurant) {
        assertRestaurantIdentitySafe(response, testCase.expectedRestaurant, testCase.firstPrompt);
      }
      if (testCase.expectedBrand) {
        assertBrandIdentitySafe(response, testCase.expectedBrand, testCase.firstPrompt);
      }

      state = response.next_state;
      let cancelSeen = false;
      let saveEligible = Boolean(pendingMeal(state)?.items.length || state.currentMealItems.length);

      for (const followUp of testCase.followUps) {
        const beforeSaveCount = saveMeal.mock.calls.length;
        const beforePending = pendingMeal(state);
        response = await runMealAssistant({ message: followUp, state }, { saveMeal });

        assertResponseHasValidState(response, `${testCase.name} :: ${followUp}`);
        expect(saveMeal.mock.calls.length, `${testCase.name}: save count exceeded one`).toBeLessThanOrEqual(1);
        if (isQuestionCommand(followUp)) {
          expect(saveMeal.mock.calls.length, `${testCase.name}: question command saved meal`).toBe(beforeSaveCount);
        }
        if (/^(?:cancel|delete that|start over)$/i.test(followUp)) {
          cancelSeen = true;
          saveEligible = false;
          const nextPending = pendingMeal(response.next_state);
          const clearedPending = nextPending?.status === 'discarded' || (!nextPending && response.next_state.currentMealItems.length === 0);
          expect(clearedPending, `${testCase.name}: cancel did not clear pending`).toBe(true);
        }
        if (isSaveConfirmation(followUp) && !cancelSeen && saveEligible && beforePending?.status !== 'saved') {
          expect(saveMeal.mock.calls.length, `${testCase.name}: confirmation did not save exactly once`).toBe(1);
          expect(pendingMeal(response.next_state)?.status, `${testCase.name}: saved pending status missing`).toBe('saved');
        }
        if (isSaveConfirmation(followUp) && cancelSeen) {
          expect(saveMeal.mock.calls.length, `${testCase.name}: cancelled meal was saved`).toBe(beforeSaveCount);
        }

        state = response.next_state;
        if (pendingMeal(state)?.status === 'saved') {
          saveEligible = false;
        } else if (pendingMeal(state)?.items.length || state.currentMealItems.length) {
          saveEligible = true;
        }
      }
    }
  }, 60_000);

  it('documents deterministic fuzz breadth', () => {
    expect(fuzzCases.length).toBe(720);
    expect(fuzzCases.length + 1_300).toBeGreaterThan(2_000);
  });
});

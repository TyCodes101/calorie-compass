import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MealAssistantItem, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
import type { ParsedMealResponse } from '@/lib/ai/types';
import {
  buildQaContext,
  createQaItem,
  expectBaselineQuality,
  expectCorrectionReply,
  expectMealContains,
  expectMealDoesNotContain,
  expectMealItemCount,
  expectMealUnchanged,
  expectNoClarification,
  expectNoUnrelatedFood,
  expectReplyMatches,
  expectReplyNotMatches,
  expectTotalCaloriesInRange,
  expectTrustedSourceFor,
  resolveQaNutrition,
  runQaScenario,
  type AssistantQaTurn,
} from './utils/assistantQaHarness';

const originalOpenAiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  if (originalOpenAiKey) {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
});

async function resolveRegressionNutrition(args: {
  item: MealAssistantItem;
  mealType: MealAssistantState['mealType'];
}): Promise<ParsedMealResponse | null> {
  const lookupText = [args.item.brand, ...args.item.modifiers, args.item.name]
    .filter(Boolean)
    .join(' ');

  return getTrustedCatalogEstimate(lookupText, args.mealType) ?? resolveQaNutrition(args);
}

function mealNames(turn: AssistantQaTurn) {
  return turn.response.next_state.currentMealItems.map((item) => item.food_name.toLowerCase()).join(' ');
}

function findMealItem(turn: AssistantQaTurn, matcher: RegExp) {
  return turn.response.next_state.currentMealItems.find((item) => matcher.test(item.food_name));
}

function expectQuantity(turn: AssistantQaTurn, matcher: RegExp, quantity: number) {
  const item = findMealItem(turn, matcher);
  expect(item?.food_name).toMatch(matcher);
  expect(item?.quantity).toBe(quantity);
}

function expectSaneNutritionMetadata(turn: AssistantQaTurn) {
  for (const item of turn.response.next_state.currentMealItems) {
    expect(String(item.confidence_label ?? '')).toMatch(/estimated|confidence|verified|trusted|very high|high|medium|low/i);
    expect(item.source_name || item.notes).toBeTruthy();
    if (item.source_type === 'AI_ESTIMATE') {
      expect(`${item.confidence_label} ${item.notes}`).toMatch(/estimate|fallback|approx/i);
    }
  }
}

describe('LLM food logging regression hardening', () => {
  it.each([
    {
      message: 'I had 2 eggs and toast',
      expectedFoods: [/eggs?/i, /toast/i],
      calorieRange: [220, 320] as const,
    },
    {
      message: 'log a banana',
      expectedFoods: [/banana/i],
      calorieRange: [90, 130] as const,
    },
    {
      message: 'I ate chicken and rice',
      expectedFoods: [/chicken/i, /rice/i],
      calorieRange: [350, 520] as const,
    },
    {
      message: 'coffee with cream and sugar',
      expectedFoods: [/coffee/i],
      calorieRange: [40, 120] as const,
    },
  ])('logs simple natural food prompt: $message', async ({ message, expectedFoods, calorieRange }) => {
    const conversation = await runQaScenario({
      name: `simple food: ${message}`,
      messages: [message],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const turn = conversation.turns[0];

    expectBaselineQuality(turn);
    expectNoClarification(turn);
    expectMealContains(turn, expectedFoods);
    expectTotalCaloriesInRange(turn, calorieRange[0], calorieRange[1]);
    expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i, /unknown food/i]);
    expectSaneNutritionMetadata(turn);
  });

  it.each([
    {
      message: 'Chipotle bowl with white rice, chicken, cheese, corn salsa, lettuce',
      expectedFoods: [/chipotle/i, /rice/i, /chicken/i, /corn|lettuce/i],
      calorieRange: [550, 850] as const,
      trusted: /chipotle/i,
    },
    {
      message: 'Chick-fil-A sandwich and fries',
      expectedFoods: [/chick-fil-a/i, /sandwich/i, /fries|waffle/i],
      calorieRange: [750, 900] as const,
      trusted: /chick-fil-a/i,
    },
    {
      message: "McDonald's Big Mac",
      expectedFoods: [/big mac/i],
      calorieRange: [520, 650] as const,
      trusted: /big mac/i,
    },
    {
      message: 'Starbucks caramel macchiato',
      expectedFoods: [/starbucks/i, /caramel macchiato/i],
      calorieRange: [180, 350] as const,
      trusted: /starbucks/i,
    },
    {
      message: 'Fairlife protein shake',
      expectedFoods: [/fairlife/i, /shake/i],
      calorieRange: [130, 180] as const,
      trusted: /fairlife/i,
    },
    {
      message: 'Quaker rice cakes',
      expectedFoods: [/quaker/i, /rice cakes?/i],
      calorieRange: [25, 80] as const,
      trusted: /quaker/i,
    },
    {
      message: "Trader Joe's zero sugar sour gummy worms",
      expectedFoods: [/trader joe/i, /gummy worms/i],
      calorieRange: [80, 180] as const,
      trusted: /trader joe/i,
    },
    {
      message: '2 Taco Bell soft potato tacos',
      expectedFoods: [/taco bell/i, /potato soft taco/i],
      calorieRange: [430, 520] as const,
      trusted: /potato soft taco/i,
    },
  ])('preserves brand or restaurant specificity: $message', async ({ message, expectedFoods, calorieRange, trusted }) => {
    const conversation = await runQaScenario({
      name: `brand specificity: ${message}`,
      messages: [message],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const turn = conversation.turns[0];

    expectBaselineQuality(turn);
    expectNoClarification(turn);
    expectMealContains(turn, expectedFoods);
    expectTotalCaloriesInRange(turn, calorieRange[0], calorieRange[1]);
    expectTrustedSourceFor(turn, trusted);
    expectSaneNutritionMetadata(turn);
    expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i, /estimated mixed meal/i]);
  });

  it.each([
    {
      message: 'I had tacos',
      expectedEither: /taco|what kind|how many|type|amount/i,
    },
    {
      message: 'I had a bowl',
      expectedEither: /what kind of bowl|what was in it|bowl/i,
      shouldClarify: true,
    },
    {
      message: 'I had cereal',
      expectedEither: /cereal|what kind|how much|milk/i,
    },
    {
      message: 'I had pasta',
      expectedEither: /pasta/i,
    },
    {
      message: 'I had coffee',
      expectedEither: /coffee/i,
    },
  ])('handles ambiguity without robotic dead ends: $message', async ({ message, expectedEither, shouldClarify }) => {
    const conversation = await runQaScenario({
      name: `ambiguity: ${message}`,
      messages: [message],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const turn = conversation.turns[0];

    expectBaselineQuality(turn);
    expectReplyMatches(turn, expectedEither, 'Ambiguous food turns should either ask one concise useful follow-up or make a reasonable estimate.');
    expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i, /unknown food/i]);
    if (shouldClarify) {
      expect(turn.response.should_ask_clarification).toBe(true);
      expectMealItemCount(turn, 0);
    }
    if (!turn.response.should_ask_clarification) {
      expectSaneNutritionMetadata(turn);
    }
  });

  it.each([
    {
      name: 'updates eggs without dropping toast',
      messages: ['I had 2 eggs and toast', 'actually make it 3 eggs'],
      expectedFoods: [/eggs?/i, /toast/i],
      forbiddenFoods: [] as RegExp[],
      expectedQuantity: [/eggs?/i, 3] as const,
    },
    {
      name: 'changes taco quantity on the active meal',
      messages: ['I had 1 taco', 'change that to 2 tacos'],
      expectedFoods: [/tacos?/i],
      forbiddenFoods: [/three tacos/i],
      expectedQuantity: [/tacos?/i, 2] as const,
    },
    {
      name: 'removes fries from burger combo',
      messages: ['burger, fries, and a coke', 'remove the fries'],
      expectedFoods: [/burger/i, /coke/i],
      forbiddenFoods: [/fries/i],
    },
    {
      name: 'changes rice to a half cup',
      messages: ['I ate chicken and rice', 'make the rice half a cup'],
      expectedFoods: [/chicken/i, /rice/i],
      forbiddenFoods: [],
      expectedQuantity: [/rice/i, 0.5] as const,
    },
    {
      name: 'swaps fried chicken sandwich to grilled',
      messages: ['fried chicken sandwich', 'I meant grilled chicken not fried'],
      expectedFoods: [/grilled chicken/i, /sandwich/i],
      forbiddenFoods: [/fried chicken/i],
    },
  ])('applies quantity and correction flow: $name', async ({ name, messages, expectedFoods, forbiddenFoods, expectedQuantity }) => {
    const conversation = await runQaScenario({
      name,
      messages,
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const turn = conversation.turns.at(-1);
    expect(turn).toBeTruthy();

    expectBaselineQuality(turn!);
    expectCorrectionReply(turn!);
    expectMealContains(turn!, expectedFoods);
    if (forbiddenFoods.length) {
      expectMealDoesNotContain(turn!, forbiddenFoods);
    }
    if (expectedQuantity) {
      expectQuantity(turn!, expectedQuantity[0], expectedQuantity[1]);
    }
    expectSaneNutritionMetadata(turn!);
  });

  it.each([
    {
      message: 'Chipotle bowl with white rice, chicken, cheese, corn salsa, lettuce',
      expectedFoods: [/chipotle/i, /rice/i, /chicken/i, /cheese/i, /corn/i, /lettuce/i],
      calorieRange: [550, 850] as const,
    },
    {
      message: 'burger, fries, and a coke',
      expectedFoods: [/burger/i, /fries/i, /coke/i],
      calorieRange: [650, 1100] as const,
    },
    {
      message: 'Greek yogurt with granola and blueberries',
      expectedFoods: [/greek yogurt/i, /granola/i, /blueberries/i],
      calorieRange: [250, 450] as const,
    },
    {
      message: 'protein shake with milk, banana, peanut butter, and whey',
      expectedFoods: [/protein shake|whey|protein powder/i, /milk/i, /banana/i, /peanut butter/i],
      calorieRange: [450, 750] as const,
    },
  ])('keeps multi-item meals represented: $message', async ({ message, expectedFoods, calorieRange }) => {
    const conversation = await runQaScenario({
      name: `multi-item: ${message}`,
      messages: [message],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const turn = conversation.turns[0];

    expectBaselineQuality(turn);
    expectNoClarification(turn);
    expectMealContains(turn, expectedFoods);
    expectTotalCaloriesInRange(turn, calorieRange[0], calorieRange[1]);
    expectSaneNutritionMetadata(turn);
  });

  it('logs food after a greeting and leaves the greeting itself empty', async () => {
    const conversation = await runQaScenario({
      name: 'greeting before food',
      messages: ['hey there', 'I had 2 eggs and toast'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const [greetingTurn, foodTurn] = conversation.turns;

    expectBaselineQuality(greetingTurn);
    expectMealItemCount(greetingTurn, 0);
    expectBaselineQuality(foodTurn);
    expectNoClarification(foodTurn);
    expectMealContains(foodTurn, [/eggs?/i, /toast/i]);
  });

  it('keeps casual off-topic chatter from mutating an active meal', async () => {
    const conversation = await runQaScenario({
      name: 'casual interruption while meal is active',
      messages: ['I ate chicken and rice', 'also my workout destroyed me today', 'anyway add broccoli too'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const [initialTurn, chatterTurn, broccoliTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/chicken/i, /rice/i]);
    expectBaselineQuality(chatterTurn);
    expectMealUnchanged(chatterTurn);
    expectBaselineQuality(broccoliTurn);
    expectCorrectionReply(broccoliTurn);
    expectMealContains(broccoliTurn, [/chicken/i, /rice/i, /broccoli/i]);
  });

  it('allows correction after review without saving prematurely', async () => {
    const conversation = await runQaScenario({
      name: 'review correction before save',
      messages: ['I had 2 eggs', 'show me what I have', 'actually make it 3 eggs'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const [initialTurn, reviewTurn, correctionTurn] = conversation.turns;

    expect(initialTurn.response.next_state.saved).toBe(false);
    expectBaselineQuality(reviewTurn);
    expectMealUnchanged(reviewTurn);
    expect(reviewTurn.response.next_state.saved).toBe(false);
    expectBaselineQuality(correctionTurn);
    expectCorrectionReply(correctionTurn);
    expectQuantity(correctionTurn, /eggs?/i, 3);
    expect(correctionTurn.response.next_state.saved).toBe(false);
  });

  it('saves only on explicit confirmation and starts a clean meal afterward', async () => {
    const conversation = await runQaScenario({
      name: 'explicit save then new meal',
      messages: ['I had 2 eggs and toast', 'looks good?', 'save it', 'now log a banana'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const [initialTurn, questionTurn, saveTurn, bananaTurn] = conversation.turns;

    expect(initialTurn.response.next_state.saved).toBe(false);
    expectBaselineQuality(questionTurn);
    expectMealUnchanged(questionTurn);
    expect(questionTurn.response.next_state.saved).toBe(false);
    expectReplyNotMatches(questionTurn, /\b(saved|logged)\b/i, 'Questions about readiness should not save the meal.');
    expect(saveTurn.response.next_state.saved).toBe(true);
    expectBaselineQuality(bananaTurn);
    expectMealContains(bananaTurn, [/banana/i]);
    expectMealDoesNotContain(bananaTurn, [/eggs?/i, /toast/i]);
  });

  it('can repeat a recent meal from memory without LLM drift', async () => {
    const context = buildQaContext({
      recentMeals: [
        {
          id: 'recent-chipotle',
          title: 'Chipotle bowl',
          rawText: 'Chipotle bowl with white rice and double chicken',
          mealType: 'lunch',
          totalCalories: 760,
          confidenceScore: 0.96,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          items: [
            createQaItem({
              food_name: 'Chipotle bowl with white rice and double chicken',
              quantity: 1,
              unit: 'bowl',
              calories: 760,
              protein: 58,
              carbs: 62,
              fat: 24,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
            }),
          ],
        },
      ],
    });

    const conversation = await runQaScenario({
      name: 'repeat recent meal from memory',
      messages: ['repeat my last meal'],
      context,
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const turn = conversation.turns[0];

    expectBaselineQuality(turn);
    expectNoClarification(turn);
    expectMealContains(turn, [/chipotle/i, /double chicken/i]);
    expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i]);
  });

  it.each([
    {
      message: 'lemme log chkn and rice',
      expectedFoods: [/chicken/i, /rice/i],
    },
    {
      message: 'some rice',
      expectedFoods: [/rice/i],
    },
    {
      message: 'Chipotle bowl with double chicken, light cheese, and extra sauce',
      expectedFoods: [/chipotle/i, /double chicken/i, /cheese/i, /sauce|salsa/i],
    },
    {
      message: 'burger no bun',
      expectedFoods: [/burger/i, /no bun|without bun|bun/i],
    },
    {
      message: 'I ate half a banana',
      expectedFoods: [/banana/i],
      expectedQuantity: [/banana/i, 0.5] as const,
    },
    {
      message: 'I ate 3/4 of a burger',
      expectedFoods: [/burger/i],
      expectedQuantity: [/burger/i, 0.75] as const,
    },
    {
      message: 'air fried homemade chicken tenders',
      expectedFoods: [/air fried|homemade|chicken tenders|chicken/i],
    },
    {
      message: 'restaurant unknown chicken tacos',
      expectedFoods: [/chicken/i, /tacos?/i],
    },
  ])('handles edge-case user phrasing: $message', async ({ message, expectedFoods, expectedQuantity }) => {
    const conversation = await runQaScenario({
      name: `edge case: ${message}`,
      messages: [message],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const turn = conversation.turns[0];

    expectBaselineQuality(turn);
    expectNoClarification(turn);
    expectMealContains(turn, expectedFoods);
    if (expectedQuantity) {
      expectQuantity(turn, expectedQuantity[0], expectedQuantity[1]);
    }
    expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i, /estimated mixed meal/i]);
    expectSaneNutritionMetadata(turn);
  });

  it('keeps estimate language honest and avoids medical advice claims', async () => {
    const conversation = await runQaScenario({
      name: 'trust and medical advice guardrail',
      messages: ['homemade chicken tacos', 'is that medical advice?'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const [foodTurn, questionTurn] = conversation.turns;

    expectBaselineQuality(foodTurn);
    expectMealContains(foodTurn, [/chicken/i, /tacos?/i]);
    expectSaneNutritionMetadata(foodTurn);
    expect(foodTurn.assistantReply).not.toMatch(/\bexact(?:ly)?\b|guaranteed|medical advice/i);

    expectBaselineQuality(questionTurn);
    expectMealUnchanged(questionTurn);
    expectReplyMatches(questionTurn, /not medical advice|estimate|dietitian|doctor|health professional/i, 'Medical-advice questions should get a short safety-oriented answer without mutating the meal.');
    expectReplyNotMatches(questionTurn, /\b(saved|logged)\b/i, 'Medical-advice follow-ups should not save the meal.');
  });

  it('does not hallucinate a save when the user is still asking about the meal', async () => {
    const conversation = await runQaScenario({
      name: 'no hallucinated save on review question',
      messages: ['Greek yogurt with granola and blueberries', 'does that look right?', 'save it'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const [initialTurn, questionTurn, saveTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/greek yogurt/i, /granola/i, /blueberries/i]);
    expectBaselineQuality(questionTurn);
    expectMealUnchanged(questionTurn);
    expect(questionTurn.response.next_state.saved).toBe(false);
    expectReplyNotMatches(questionTurn, /\b(saved|logged)\b/i, 'A review question must not be treated as explicit save confirmation.');
    expect(saveTurn.response.next_state.saved).toBe(true);
  });

  it('preserves conversation memory through a correction, save, and new meal', async () => {
    const conversation = await runQaScenario({
      name: 'conversation memory after save',
      messages: ['Fairlife protein shake', 'make it two', 'save it', 'start a new meal: coffee with cream and sugar'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const [initialTurn, twoTurn, saveTurn, coffeeTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/fairlife/i]);
    expectBaselineQuality(twoTurn);
    expectCorrectionReply(twoTurn);
    expectQuantity(twoTurn, /fairlife/i, 2);
    expect(saveTurn.response.next_state.saved).toBe(true);
    expectBaselineQuality(coffeeTurn);
    expectMealContains(coffeeTurn, [/coffee/i]);
    expectMealDoesNotContain(coffeeTurn, [/fairlife/i]);
  });

  it('keeps the active meal item names user-readable after many edits', async () => {
    const conversation = await runQaScenario({
      name: 'readable names after edits',
      messages: ['burger, fries, and a coke', 'remove the fries', 'make the burger no bun', 'save it'],
      resolveItemNutrition: resolveRegressionNutrition,
    });
    const finalTurn = conversation.turns.at(-1);
    expect(finalTurn).toBeTruthy();

    expectBaselineQuality(finalTurn!);
    expect(finalTurn!.response.next_state.saved).toBe(true);
    expect(mealNames(finalTurn!)).toMatch(/burger/);
    expect(mealNames(finalTurn!)).toMatch(/coke/);
    expect(mealNames(finalTurn!)).not.toMatch(/fries|estimated mixed meal|unknown food/);
  });
});

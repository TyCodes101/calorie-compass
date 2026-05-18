import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MealAssistantContext } from '@/lib/ai/mealAssistantSchema';
import {
  createQaItem,
  expectBaselineQuality,
  expectCorrectionReply,
  expectItemCaloriesInRange,
  expectMealContains,
  expectMealDoesNotContain,
  expectMealItemCount,
  expectMealUnchanged,
  expectNoClarification,
  expectNoUnrelatedFood,
  expectRecommendationReply,
  expectReplyMatches,
  expectReplyNotMatches,
  expectTrustedSourceFor,
  expectTotalCaloriesInRange,
  runQaScenario,
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

describe('assistant chatbot QA golden scenarios', () => {
  const basicLoggingCases = [
    {
      name: 'logs eggs with sane calories',
      message: 'I had 3 eggs',
      contains: [/eggs?/i],
      calorieRange: [190, 230] as const,
      itemRange: [/eggs?/i, 190, 230] as const,
      forbidden: [/chocolate/i, /frozen dinner/i],
    },
    {
      name: 'logs McDouble without unrelated drift',
      message: "McDouble from McDonald's",
      contains: [/mcdouble/i],
      calorieRange: [330, 450] as const,
      itemRange: [/mcdouble/i, 330, 450] as const,
      forbidden: [/nuggets/i, /chick-fil-a/i, /frozen dinner/i],
    },
    {
      name: 'logs Fairlife Core Power Elite',
      message: 'Fairlife 42g shake',
      contains: [/fairlife/i, /42g|elite|core power/i],
      calorieRange: [200, 270] as const,
      itemRange: [/fairlife/i, 200, 270] as const,
      forbidden: [/chick-fil-a/i, /chipotle cheese/i],
    },
    {
      name: 'logs a can of beans as beans',
      message: 'can of beans',
      contains: [/beans/i],
      calorieRange: [220, 420] as const,
      itemRange: [/beans/i, 220, 420] as const,
      forbidden: [/frozen dinner/i, /rice cake/i],
    },
    {
      name: 'logs a bare Chipotle bowl without random USDA drift',
      message: 'Chipotle bowl',
      contains: [/chipotle/i, /bowl/i],
      calorieRange: [500, 1100] as const,
      itemRange: [/chipotle/i, 500, 1100] as const,
      forbidden: [/cottage cheese/i, /frozen dinner/i, /nutritional powder/i],
    },
    {
      name: 'logs a McDonalds large fry as restaurant nutrition',
      message: "large fry from McDonald's",
      contains: [/large fry|fries/i],
      calorieRange: [430, 560] as const,
      itemRange: [/large fry|fries/i, 430, 560] as const,
      forbidden: [/hash browns?/i, /baked potato/i, /frozen dinner/i],
    },
    {
      name: 'logs a generic protein shake without a clarification loop',
      message: 'protein shake',
      contains: [/protein shake/i],
      calorieRange: [120, 260] as const,
      itemRange: [/protein shake/i, 120, 260] as const,
      forbidden: [/frozen dinner/i, /cottage cheese/i],
    },
  ];

  for (const qaCase of basicLoggingCases) {
    it(qaCase.name, async () => {
      const conversation = await runQaScenario({
        name: qaCase.name,
        messages: [qaCase.message],
      });
      const turn = conversation.turns[0];

      expectBaselineQuality(turn);
      expectNoClarification(turn);
      expectMealContains(turn, qaCase.contains);
      expectTotalCaloriesInRange(turn, qaCase.calorieRange[0], qaCase.calorieRange[1]);
      expectItemCaloriesInRange(turn, qaCase.itemRange[0], qaCase.itemRange[1], qaCase.itemRange[2]);
      expectNoUnrelatedFood(turn, qaCase.forbidden);
    });
  }

  it('updates quantities on active meals instead of creating new foods', async () => {
    const conversation = await runQaScenario({
      name: 'egg quantity correction flow',
      messages: ['I had 4 large eggs', 'actually 5', 'make that 2'],
    });
    const [initialTurn, fiveTurn, twoTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/eggs?/i]);
    expectTotalCaloriesInRange(initialTurn, 260, 300);

    expectBaselineQuality(fiveTurn);
    expectCorrectionReply(fiveTurn);
    expectMealItemCount(fiveTurn, 1);
    expectMealContains(fiveTurn, [/eggs?/i]);
    expectTotalCaloriesInRange(fiveTurn, 330, 370);
    expectNoUnrelatedFood(fiveTurn, [/chocolate/i, /frozen dinner/i]);

    expectBaselineQuality(twoTurn);
    expectCorrectionReply(twoTurn);
    expectMealItemCount(twoTurn, 1);
    expectMealContains(twoTurn, [/eggs?/i]);
    expectTotalCaloriesInRange(twoTurn, 130, 160);
  });

  it('logs food after casual lead-ins and does not turn user pushback into food', async () => {
    const conversation = await runQaScenario({
      name: 'casual lead-in logging regression',
      messages: ['nothing yet', 'okay, i had 2 large eggs', 'i did'],
    });
    const [nothingTurn, eggsTurn, pushbackTurn] = conversation.turns;

    expectBaselineQuality(nothingTurn);
    expectMealItemCount(nothingTurn, 0);

    expectBaselineQuality(eggsTurn);
    expectNoClarification(eggsTurn);
    expectMealContains(eggsTurn, [/eggs?/i]);
    expectTotalCaloriesInRange(eggsTurn, 130, 160);
    expectReplyNotMatches(eggsTurn, /send the meal whenever/i, 'Food after a casual lead-in should be logged, not brushed off.');
    expectNoUnrelatedFood(eggsTurn, [/milk/i, /frozen dinner/i]);

    expectBaselineQuality(pushbackTurn);
    expectMealUnchanged(pushbackTurn);
    expectNoUnrelatedFood(pushbackTurn, [/milk/i, /frozen dinner/i, /nutritional powder/i]);
  });

  it('overrides a bad casual classifier when a lead-in contains obvious food', async () => {
    const conversation = await runQaScenario({
      name: 'bad classifier casual lead-in override',
      messages: ['okay, i had 2 large eggs'],
      classify: async () => ({
        intent: 'casual_message',
        assistant_reply: "Yep, send the meal whenever you're ready.",
        contains_food_to_log: false,
        contains_quantity_update: false,
        target_item: null,
        should_mutate_pending_meal: false,
        assistant_reply_goal: 'casual acknowledgement',
        items: [],
        corrections: [],
        should_lookup_nutrition: false,
        should_save_meal: false,
        should_ask_clarification: false,
        clarification_question: null,
        confidence: 'medium',
      }),
    });
    const turn = conversation.turns[0];

    expectBaselineQuality(turn);
    expectMealContains(turn, [/eggs?/i]);
    expectTotalCaloriesInRange(turn, 130, 160);
    expectNoUnrelatedFood(turn, [/milk/i, /frozen dinner/i]);
  });

  it('handles casual lead-in food logs across common variations', async () => {
    const cases = [
      {
        message: 'ok i had 2 large eggs',
        expectedFoods: [/eggs?/i],
        calorieRange: [130, 160] as const,
        forbidden: [/milk/i, /frozen dinner/i],
      },
      {
        message: 'yeah i had 2 large eggs',
        expectedFoods: [/eggs?/i],
        calorieRange: [130, 160] as const,
        forbidden: [/milk/i, /frozen dinner/i],
      },
      {
        message: 'alright, 2 eggs',
        expectedFoods: [/eggs?/i],
        calorieRange: [130, 160] as const,
        forbidden: [/milk/i, /frozen dinner/i],
      },
      {
        message: 'so i had 2 eggs and toast',
        expectedFoods: [/eggs?/i, /toast/i],
        calorieRange: [220, 280] as const,
        forbidden: [/milk/i, /frozen dinner/i],
      },
      {
        message: 'cool, i had a McDouble',
        expectedFoods: [/mcdouble/i],
        calorieRange: [330, 450] as const,
        forbidden: [/milk/i, /frozen dinner/i],
      },
      {
        message: 'nice, i had a Fairlife 42g shake',
        expectedFoods: [/fairlife/i, /42g|elite|core power/i],
        calorieRange: [200, 270] as const,
        forbidden: [/milk, low fat/i, /frozen dinner/i],
      },
      {
        message: 'okay i ate a can of beans',
        expectedFoods: [/beans/i],
        calorieRange: [220, 420] as const,
        forbidden: [/milk/i, /frozen dinner/i],
      },
    ];

    for (const qaCase of cases) {
      const conversation = await runQaScenario({
        name: `casual lead-in variation: ${qaCase.message}`,
        messages: [qaCase.message],
      });
      const turn = conversation.turns[0];

      expectBaselineQuality(turn);
      expectNoClarification(turn);
      expectMealContains(turn, qaCase.expectedFoods);
      expectTotalCaloriesInRange(turn, qaCase.calorieRange[0], qaCase.calorieRange[1]);
      expectReplyNotMatches(turn, /send the meal whenever/i, 'Casual lead-ins should not hide obvious food logs.');
      expectNoUnrelatedFood(turn, qaCase.forbidden);
    }
  });

  it('handles casual lead-ins for add and quantity corrections', async () => {
    const addConversation = await runQaScenario({
      name: 'sure add fries correction variation',
      messages: ["McDouble from McDonald's", 'sure, add fries'],
    });
    const addTurn = addConversation.turns[1];

    expectBaselineQuality(addTurn);
    expectCorrectionReply(addTurn);
    expectMealContains(addTurn, [/mcdouble/i, /fries/i]);
    expectTotalCaloriesInRange(addTurn, 650, 780);
    expectNoUnrelatedFood(addTurn, [/milk/i, /frozen dinner/i]);

    const quantityConversation = await runQaScenario({
      name: 'yep make that 3 correction variation',
      messages: ['I had 2 eggs', 'yep make that 3'],
    });
    const quantityTurn = quantityConversation.turns[1];

    expectBaselineQuality(quantityTurn);
    expectCorrectionReply(quantityTurn);
    expectMealItemCount(quantityTurn, 1);
    expectMealContains(quantityTurn, [/eggs?/i]);
    expectTotalCaloriesInRange(quantityTurn, 190, 230);
    expectNoUnrelatedFood(quantityTurn, [/milk/i, /frozen dinner/i]);
  });

  it('does not recommend the just-logged burger back to the user for dinner ideas', async () => {
    const conversation = await runQaScenario({
      name: 'avoid recent burger echo in dinner recommendations',
      messages: ["I had a McDouble", 'what should I eat tonight?'],
    });
    const dinnerTurn = conversation.turns[1];

    expectBaselineQuality(dinnerTurn);
    expectRecommendationReply(dinnerTurn);
    expectReplyNotMatches(dinnerTurn, /mcdouble|big mac|fries/i, 'Dinner recommendations should not just echo the last fast-food meal back to the user.');
    expectReplyMatches(dinnerTurn, /chicken|turkey|salmon|bowl|dinner|tonight/i, 'Dinner recommendations should sound like actual dinner ideas.');
  });

  it('keeps protein-focused snack follow-ups in recommendation mode without stale meal drift', async () => {
    const conversation = await runQaScenario({
      name: 'protein snack follow-up stays recommendation-only',
      messages: ['healthy sweet snack', 'something with more protein'],
      context: {
        remainingCalories: 360,
        remainingProtein: 44,
        nutritionPreferences: 'high protein',
      },
    });
    const followUpTurn = conversation.turns[1];

    expectBaselineQuality(followUpTurn);
    expectRecommendationReply(followUpTurn);
    expectMealItemCount(followUpTurn, 0);
    expectReplyMatches(followUpTurn, /fairlife|greek yogurt|cottage cheese|protein pudding|shake/i, 'Protein follow-ups should stay on high-protein snack ideas.');
    expectReplyNotMatches(followUpTurn, /mcdouble|fries|saved|added/i, 'Recommendation follow-ups should not drift into meal logging or stale fast-food context.');
  });

  it('keeps pushback variations from triggering nutrition lookup', async () => {
    const pushbackMessages = ['i already did', 'i told you', 'sent it'];

    for (const message of pushbackMessages) {
      const conversation = await runQaScenario({
        name: `pushback variation: ${message}`,
        messages: ['I had 2 eggs', message],
      });
      const pushbackTurn = conversation.turns[1];

      expectBaselineQuality(pushbackTurn);
      expectMealUnchanged(pushbackTurn);
      expectMealContains(pushbackTurn, [/eggs?/i]);
      expectNoUnrelatedFood(pushbackTurn, [/milk/i, /frozen dinner/i, /nutritional powder/i]);
    }
  });

  it('removes cheese from a composite restaurant meal without wiping the meal', async () => {
    const conversation = await runQaScenario({
      name: 'remove cheese from Chipotle bowl',
      messages: ['Chipotle bowl with white rice, chicken, cheese', 'remove cheese'],
    });
    const removeTurn = conversation.turns[1];

    expectBaselineQuality(removeTurn);
    expectCorrectionReply(removeTurn);
    expectMealContains(removeTurn, [/chipotle/i, /rice/i, /chicken/i]);
    expectMealDoesNotContain(removeTurn, [/\bcheese\b/i]);
    expectMealItemCount(removeTurn, 1);
  });

  it('adds fries to the active meal instead of replacing it', async () => {
    const conversation = await runQaScenario({
      name: 'add fries to active burger meal',
      messages: ["McDouble from McDonald's", 'add fries'],
    });
    const addTurn = conversation.turns[1];

    expectBaselineQuality(addTurn);
    expectCorrectionReply(addTurn);
    expectMealContains(addTurn, [/mcdouble/i, /fries/i]);
    expectTotalCaloriesInRange(addTurn, 650, 780);
  });

  it('handles food replacement corrections like rice cakes versus rice', async () => {
    const conversation = await runQaScenario({
      name: 'rice cakes correction',
      messages: ['I had rice', 'no rice cakes not rice'],
    });
    const correctionTurn = conversation.turns[1];

    expectBaselineQuality(correctionTurn);
    expectCorrectionReply(correctionTurn);
    expectMealContains(correctionTurn, [/rice cakes/i]);
    expectMealDoesNotContain(correctionTurn, [/\brice\b(?! cakes)/i]);
    expectTotalCaloriesInRange(correctionTurn, 20, 60);
  });

  it('handles compound chipotle edits without losing the active meal', async () => {
    const conversation = await runQaScenario({
      name: 'compound chipotle edit flow',
      messages: ['Chipotle bowl with double chicken and cheese', 'make it regular chicken and remove cheese'],
    });
    const finalTurn = conversation.turns[1];

    expectBaselineQuality(finalTurn);
    expectCorrectionReply(finalTurn);
    expectMealItemCount(finalTurn, 1);
    expectMealContains(finalTurn, [/chipotle/i, /bowl/i]);
    expectMealDoesNotContain(finalTurn, [/double chicken/i, /\bcheese\b/i]);
    expectReplyMatches(finalTurn, /regular chicken|cheese/i, 'Compound Chipotle edits should mention the actual changes.');
    expectReplyNotMatches(finalTurn, /need a little more detail|barcode|usda/i, 'Compound edits should stay concise and not fall into clarification or source-label noise.');
  });

  it('handles compound remove and quantity edits on restaurant meals', async () => {
    const conversation = await runQaScenario({
      name: 'compound burger edit flow',
      messages: ['McDouble and medium fry', 'remove fries and make it two burgers'],
    });
    const finalTurn = conversation.turns[1];

    expectBaselineQuality(finalTurn);
    expectCorrectionReply(finalTurn);
    expectMealItemCount(finalTurn, 1);
    expectMealContains(finalTurn, [/mcdouble/i]);
    expectMealDoesNotContain(finalTurn, [/fries/i]);
    expectTotalCaloriesInRange(finalTurn, 740, 820);
    expectReplyMatches(finalTurn, /fries|burger|mcdouble/i, 'Compound burger edits should summarize both the removal and quantity change.');
  });

  it('handles compound add and quantity edits on simple meals', async () => {
    const conversation = await runQaScenario({
      name: 'compound breakfast edit flow',
      messages: ['2 eggs and toast', 'make it 3 eggs and add bacon'],
    });
    const finalTurn = conversation.turns[1];

    expectBaselineQuality(finalTurn);
    expectCorrectionReply(finalTurn);
    expectMealContains(finalTurn, [/eggs?/i, /toast/i, /bacon/i]);
    expectTotalCaloriesInRange(finalTurn, 280, 460);
    expectReplyMatches(finalTurn, /3|bacon|eggs?/i, 'Compound breakfast edits should mention the updated eggs and added bacon.');
  });

  it('handles compound quantity and save turns naturally', async () => {
    const conversation = await runQaScenario({
      name: 'compound shake save flow',
      messages: ['Fairlife 42g shake', 'make it two and save it'],
    });
    const finalTurn = conversation.turns[1];

    expectBaselineQuality(finalTurn);
    expectCorrectionReply(finalTurn);
    expectMealItemCount(finalTurn, 1);
    expectMealContains(finalTurn, [/fairlife/i]);
    expectTotalCaloriesInRange(finalTurn, 430, 500);
    expectReplyMatches(finalTurn, /saved|logged/i, 'Compound quantity and save turns should confirm both actions.');
  });

  it('keeps updating cottage cheese through messy portion corrections', async () => {
    const conversation = await runQaScenario({
      name: 'messy cottage cheese correction flow',
      messages: ['I had some cottage cheese', 'no i had 1 whole cup', 'nvm i only had .75 of a cup', 'i had half a cup'],
    });
    const [initialTurn, oneCupTurn, threeQuarterTurn, halfCupTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/cottage cheese/i]);

    expectBaselineQuality(oneCupTurn);
    expectCorrectionReply(oneCupTurn);
    expectMealItemCount(oneCupTurn, 1);
    expectMealContains(oneCupTurn, [/cottage cheese/i]);
    expectTotalCaloriesInRange(oneCupTurn, 170, 190);

    expectBaselineQuality(threeQuarterTurn);
    expectCorrectionReply(threeQuarterTurn);
    expectMealItemCount(threeQuarterTurn, 1);
    expectMealContains(threeQuarterTurn, [/cottage cheese/i]);
    expectTotalCaloriesInRange(threeQuarterTurn, 130, 145);
    expectReplyNotMatches(threeQuarterTurn, /need a little more detail|what food/i, 'Fractional corrections should use the active cottage cheese item.');

    expectBaselineQuality(halfCupTurn);
    expectCorrectionReply(halfCupTurn);
    expectMealItemCount(halfCupTurn, 1);
    expectMealContains(halfCupTurn, [/cottage cheese/i]);
    expectTotalCaloriesInRange(halfCupTurn, 85, 95);
  });

  it('replays serving corrections and complaint repair without stale state', async () => {
    const conversation = await runQaScenario({
      name: 'long serving correction and repair transcript',
      messages: [
        '3 cups of grilled chicken',
        'no i had 4 cups i meant',
        'no lets go back to 3 cups',
        "that's not right",
      ],
    });
    const [initialTurn, fourCupTurn, backToThreeTurn, complaintTurn] = conversation.turns;

    for (const turn of conversation.turns) {
      expectBaselineQuality(turn);
      expectMealItemCount(turn, 1);
      expectMealContains(turn, [/chicken/i]);
      expectStateAndReplyDoNotDisagree(turn);
      expectNoUnrelatedFood(turn, [/^no$/i, /that'?s not right/i, /frozen dinner/i]);
    }

    expectServing(initialTurn, /chicken/i, 3, 'cup');
    expectServing(fourCupTurn, /chicken/i, 4, 'cup');
    expectReplyMatches(fourCupTurn, /4 cups?.*chicken|chicken.*4 cups?/i, 'Reply should describe the committed 4 cup chicken state.');
    expectReplyNotMatches(fourCupTurn, /\b4 oz\b|113\.4/i, 'Serving correction should never leak normalized ounces as the user-facing serving.');
    expectServing(backToThreeTurn, /chicken/i, 3, 'cup');
    expectReplyMatches(backToThreeTurn, /3 cups?.*chicken|chicken.*3 cups?/i, 'Reply should describe the committed 3 cup chicken state.');
    expectReplyNotMatches(backToThreeTurn, /\b4 oz\b|4 cups?|113\.4/i, 'Back-to-3 correction should not repeat stale 4 cup/oz state.');
    expect(complaintTurn.response.intent).toBe('complaint_repair');
    expectMealUnchanged(complaintTurn);
    expectReplyMatches(complaintTurn, /chicken|current|change|fix|right/i, 'Complaint repair should ask how to fix the active chicken item.');
  });

  it('replays cottage cheese corrections without clarification loops', async () => {
    const conversation = await runQaScenario({
      name: 'long cottage cheese correction transcript',
      messages: [
        'I had some cottage cheese',
        'no i had 1 whole cup',
        'nvm i only had .75 of a cup',
        'actually half a cup',
      ],
    });
    const [, oneCupTurn, threeQuarterTurn, halfCupTurn] = conversation.turns;

    for (const turn of conversation.turns) {
      expectBaselineQuality(turn);
      expectNoClarification(turn);
      expectMealItemCount(turn, 1);
      expectMealContains(turn, [/cottage cheese/i]);
      expectStateAndReplyDoNotDisagree(turn);
      expectReplyNotMatches(turn, /need a little more detail|what food|out now/i, 'Cottage cheese corrections should keep editing the active item.');
    }

    expectServing(oneCupTurn, /cottage cheese/i, 1, 'cup');
    expectServing(threeQuarterTurn, /cottage cheese/i, 0.75, 'cup');
    expectServing(halfCupTurn, /cottage cheese/i, 0.5, 'cup');
  });

  it('replays additive oatmeal edits without dropping or reviving items', async () => {
    const conversation = await runQaScenario({
      name: 'oatmeal blueberries additive edit transcript',
      messages: [
        'I had oatmeal with blueberries',
        'actually add peanut butter too',
        'make the blueberries double',
        'remove peanut butter',
      ],
    });
    const [initialTurn, addTurn, doubleTurn, removeTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectNoClarification(initialTurn);
    expectMealContains(initialTurn, [/oatmeal/i, /blueberries/i]);

    expectBaselineQuality(addTurn);
    expectCorrectionReply(addTurn);
    expectMealContains(addTurn, [/oatmeal/i, /blueberries/i, /peanut butter/i]);

    expectBaselineQuality(doubleTurn);
    expectCorrectionReply(doubleTurn);
    expectMealContains(doubleTurn, [/oatmeal/i, /blueberries/i, /peanut butter/i]);
    expectServing(doubleTurn, /blueberries/i, 2, 'cup');
    expectStateAndReplyDoNotDisagree(doubleTurn);

    expectBaselineQuality(removeTurn);
    expectCorrectionReply(removeTurn);
    expectMealContains(removeTurn, [/oatmeal/i, /blueberries/i]);
    expectMealDoesNotContain(removeTurn, [/peanut butter/i]);
    expectStateAndReplyDoNotDisagree(removeTurn);
    expectReplyNotMatches(removeTurn, /peanut butter.*still/i, 'Removed peanut butter should not appear as an active item in the final reply.');
  });

  it('replays restaurant bowl edits while preserving drink and components', async () => {
    const conversation = await runQaScenario({
      name: 'chipotle bowl restaurant edit transcript',
      messages: [
        'I had a Chipotle bowl with white rice, black beans, double chicken, corn salsa, cheese, lettuce, and green salsa plus a Coke Zero',
        'actually no cheese',
        'make the chicken regular not double',
        'add guac',
      ],
    });
    const [initialTurn, noCheeseTurn, regularChickenTurn, guacTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectNoClarification(initialTurn);
    expectMealContains(initialTurn, [/chipotle/i, /rice/i, /beans/i, /double chicken/i, /corn/i, /cheese/i, /lettuce/i, /green salsa/i, /coke zero/i]);

    expectBaselineQuality(noCheeseTurn);
    expectCorrectionReply(noCheeseTurn);
    expectMealContains(noCheeseTurn, [/chipotle/i, /rice/i, /beans/i, /chicken/i, /corn/i, /lettuce/i, /green salsa/i, /coke zero/i]);
    expectMealDoesNotContain(noCheeseTurn, [/\bcheese\b/i]);

    expectBaselineQuality(regularChickenTurn);
    expectCorrectionReply(regularChickenTurn);
    expectMealContains(regularChickenTurn, [/chipotle/i, /rice/i, /beans/i, /chicken/i, /coke zero/i]);
    expectMealDoesNotContain(regularChickenTurn, [/double chicken/i, /\bcheese\b/i]);
    expectStateAndReplyDoNotDisagree(regularChickenTurn);

    expectBaselineQuality(guacTurn);
    expectCorrectionReply(guacTurn);
    expectMealContains(guacTurn, [/chipotle/i, /guac/i, /coke zero/i]);
    expectMealDoesNotContain(guacTurn, [/\bcheese\b/i, /double chicken/i]);
  });

  it('repairs complaint chain into caramel rice cakes without fake complaint foods', async () => {
    const conversation = await runQaScenario({
      name: 'rice cake complaint repair transcript',
      messages: [
        'I had 2 rice cakes',
        'no',
        "that's wrong",
        'it was actually 3 caramel rice cakes',
      ],
    });
    const [initialTurn, noTurn, wrongTurn, repairTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectNoClarification(initialTurn);
    expectServing(initialTurn, /rice cakes/i, 2, 'cake');

    for (const turn of [noTurn, wrongTurn]) {
      expectBaselineQuality(turn);
      expectMealUnchanged(turn);
      expectMealDoesNotContain(turn, [/^no$/i, /that'?s wrong/i]);
      expectReplyMatches(turn, /rice cakes?|change|fix|right|current/i, 'Complaint turns should keep the rice cakes open for repair.');
    }

    expectBaselineQuality(repairTurn);
    expectCorrectionReply(repairTurn);
    expectMealItemCount(repairTurn, 1);
    expectMealContains(repairTurn, [/caramel rice cakes/i]);
    expectServing(repairTurn, /caramel rice cakes/i, 3, 'cake');
    expectReplyNotMatches(repairTurn, /\bno\b|that'?s wrong|need a little more detail/i, 'Repair should not expose complaint text as food.');
  });

  it('covers serving unit preservation across common units', async () => {
    const cases = [
      { message: '2 tbsp peanut butter', matcher: /peanut butter/i, quantity: 2, unit: 'tbsp' },
      { message: '1 tsp peanut butter', matcher: /peanut butter/i, quantity: 1, unit: 'tsp' },
      { message: '4 oz grilled chicken', matcher: /chicken/i, quantity: 4, unit: 'oz' },
      { message: '100 grams grilled chicken', matcher: /chicken/i, quantity: 100, unit: 'g' },
      { message: '2 slices of toast', matcher: /toast/i, quantity: 2, unit: 'slice' },
      { message: '3 pieces of bacon', matcher: /bacon/i, quantity: 3, unit: 'piece' },
      { message: '1 can of beans', matcher: /beans/i, quantity: 1, unit: 'can' },
      { message: '2 scoops protein powder', matcher: /protein powder/i, quantity: 2, unit: 'scoop' },
      { message: '2 servings greek yogurt', matcher: /greek yogurt/i, quantity: 2, unit: 'serving' },
    ];

    for (const qaCase of cases) {
      const conversation = await runQaScenario({
        name: `serving unit preservation: ${qaCase.message}`,
        messages: [qaCase.message],
      });
      const turn = conversation.turns[0];

      expectBaselineQuality(turn);
      expectNoClarification(turn);
      expectServing(turn, qaCase.matcher, qaCase.quantity, qaCase.unit);
      if (qaCase.unit !== 'oz') {
        expectReplyNotMatches(turn, /\b\d+(?:\.\d+)? oz\b/i, 'Reply should not convert the user-facing serving to ounces unless the user said ounces.');
      }
    }
  });

  it('applies compound edits atomically and saves final committed state', async () => {
    const conversation = await runQaScenario({
      name: 'compound remove peanut butter and save transcript',
      messages: [
        'oatmeal with blueberries and peanut butter',
        'remove peanut butter and save it',
      ],
    });
    const saveTurn = conversation.turns[1];

    expectBaselineQuality(saveTurn);
    expectCorrectionReply(saveTurn);
    expectMealContains(saveTurn, [/oatmeal/i, /blueberries/i]);
    expectMealDoesNotContain(saveTurn, [/peanut butter/i]);
    expect(saveTurn.response.next_state.saved).toBe(true);
    expectReplyMatches(saveTurn, /saved|logged/i, 'Compound remove-and-save should confirm the final meal was saved.');
    expectStateAndReplyDoNotDisagree(saveTurn);
  });

  it('adds peanut butter to oatmeal and blueberries without dropping fruit context', async () => {
    const conversation = await runQaScenario({
      name: 'oatmeal blueberries add peanut butter flow',
      messages: ['I had oatmeal with blueberries', 'actually add peanut butter too'],
    });
    const [initialTurn, addTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/oatmeal/i, /blueberries/i]);
    expectTrustedSourceFor(initialTurn, /oatmeal/i);
    expectTrustedSourceFor(initialTurn, /blueberries/i);

    expectBaselineQuality(addTurn);
    expectCorrectionReply(addTurn);
    expectMealContains(addTurn, [/oatmeal/i, /blueberries/i, /peanut butter/i]);
    expectNoUnrelatedFood(addTurn, [/frozen dinner/i, /milk, low fat/i]);
  });

  it('handles broader compound edit grammar for portions, additions, removals, and save', async () => {
    const cottageConversation = await runQaScenario({
      name: 'compound cottage cheese portion plus berries',
      messages: ['I had cottage cheese', 'change the cottage cheese to .75 cup and add blueberries'],
    });
    const cottageTurn = cottageConversation.turns[1];

    expectBaselineQuality(cottageTurn);
    expectCorrectionReply(cottageTurn);
    expectMealContains(cottageTurn, [/cottage cheese/i, /blueberries/i]);
    expectTotalCaloriesInRange(cottageTurn, 200, 235);

    const burgerConversation = await runQaScenario({
      name: 'compound burger target grammar',
      messages: ['McDouble and medium fry', 'remove the fries and make the burger two'],
    });
    const burgerTurn = burgerConversation.turns[1];

    expectBaselineQuality(burgerTurn);
    expectCorrectionReply(burgerTurn);
    expectMealItemCount(burgerTurn, 1);
    expectMealContains(burgerTurn, [/mcdouble/i]);
    expectMealDoesNotContain(burgerTurn, [/fries/i]);
    expectTotalCaloriesInRange(burgerTurn, 740, 820);

    const chipotleConversation = await runQaScenario({
      name: 'compound chipotle double chicken removal',
      messages: ['Chipotle bowl with white rice, chicken, cheese', 'actually make the chicken double and remove cheese'],
    });
    const chipotleTurn = chipotleConversation.turns[1];

    expectBaselineQuality(chipotleTurn);
    expectCorrectionReply(chipotleTurn);
    expectMealContains(chipotleTurn, [/chipotle/i, /double chicken/i]);
    expectMealDoesNotContain(chipotleTurn, [/\bcheese\b/i]);

    const cokeConversation = await runQaScenario({
      name: 'compound add coke zero save',
      messages: ['I had a McDouble', 'add a Coke Zero and save it'],
    });
    const cokeTurn = cokeConversation.turns[1];

    expectBaselineQuality(cokeTurn);
    expectCorrectionReply(cokeTurn);
    expectMealContains(cokeTurn, [/mcdouble/i, /coke zero/i]);
    expectReplyMatches(cokeTurn, /saved|logged/i, 'Compound add-and-save should confirm the save.');
    expectMealItemCount(cokeTurn, 2);
  });

  const conversationOnlyCases = [
    'hi',
    'nothing yet',
    'wdym okay',
    'that makes no sense',
    'lol',
    'tell me a joke',
  ];

  for (const message of conversationOnlyCases) {
    it(`keeps "${message}" conversational and non-mutating`, async () => {
      const conversation = await runQaScenario({
        name: `conversation only: ${message}`,
        messages: [message],
        initialState: {
          currentMealItems: [
            createQaItem({ food_name: 'Cottage cheese', quantity: 1, unit: 'cup', calories: 180, protein: 26, carbs: 8, fat: 5 }),
          ],
          currentMealText: '1 cup Cottage cheese',
        },
      });
      const turn = conversation.turns[0];

      expectBaselineQuality(turn);
      expectMealUnchanged(turn);
      expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i]);
      expectReplyMatches(turn, /\b(?:meal|change|ready|food|log|joke|fair|fix|adjust|send)\b/i, 'Conversational replies should acknowledge the user without logging a new food.');
    });
  }

  it('answers macro questions and recommendation requests without mutating meals', async () => {
    const conversation = await runQaScenario({
      name: 'nutrition questions and recommendations',
      messages: [
        'how much protein do I have left?',
        'what about carbs?',
        'am I on track?',
        'what should I eat tonight?',
        'what should I snack on as a healthy treat?',
      ],
      initialState: {
        currentMealItems: [
          createQaItem({ food_name: 'Cottage cheese', quantity: 1, unit: 'cup', calories: 180, protein: 26, carbs: 8, fat: 5 }),
        ],
        currentMealText: '1 cup Cottage cheese',
      },
      context: {
        remainingProtein: 63,
        remainingCarbs: 80,
        remainingCalories: 720,
      },
    });

    const [proteinTurn, carbsTurn, trackTurn, dinnerTurn, snackTurn] = conversation.turns;

    for (const turn of conversation.turns) {
      expectBaselineQuality(turn);
      expectMealUnchanged(turn);
      expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i]);
    }

    expectReplyMatches(proteinTurn, /\b63g\b|\b63\s*g\b|\bprotein\b/i, 'Protein question should answer remaining protein.');
    expectReplyMatches(carbsTurn, /\bcarbs?\b|\b80g\b|\b80\s*g\b/i, 'Carb question should answer carbs, not log food.');
    expectReplyMatches(trackTurn, /\btrack|protein|calories|solid|spot\b/i, 'On-track question should summarize daily progress.');
    expectRecommendationReply(dinnerTurn);
    expectRecommendationReply(snackTurn);
  });

  it('loads repeat and memory meals conversationally', async () => {
    const context = buildMemoryContext();
    const cases = [
      { message: 'same as yesterday', expected: [/chipotle/i] },
      { message: 'same Fairlife shake', expected: [/fairlife/i] },
      { message: 'my usual Chipotle bowl', expected: [/chipotle/i] },
      { message: 'repeat my last meal', expected: [/mcdouble/i] },
    ];

    for (const qaCase of cases) {
      const conversation = await runQaScenario({
        name: `memory flow: ${qaCase.message}`,
        messages: [qaCase.message],
        context,
      });
      const turn = conversation.turns[0];

      expectBaselineQuality(turn);
      expectMealContains(turn, qaCase.expected);
      expectNoClarification(turn);
      expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i]);
    }
  });

  it('logs basic meal additions and saves without losing the meal', async () => {
    const conversation = await runQaScenario({
      name: 'basic logging add juice save',
      messages: ['I had 2 eggs and toast', 'add orange juice', 'save it'],
    });
    const [initialTurn, addTurn, saveTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectNoClarification(initialTurn);
    expectMealContains(initialTurn, [/eggs?/i, /toast/i]);
    expectTotalCaloriesInRange(initialTurn, 220, 280);

    expectBaselineQuality(addTurn);
    expectCorrectionReply(addTurn);
    expectMealContains(addTurn, [/eggs?/i, /toast/i, /orange juice/i]);
    expectTotalCaloriesInRange(addTurn, 320, 420);

    expectBaselineQuality(saveTurn);
    expectMealContains(saveTurn, [/eggs?/i, /toast/i, /orange juice/i]);
    expect(saveTurn.response.next_state.saved).toBe(true);
    expectReplyMatches(saveTurn, /saved|logged|in/i, 'Save turn should confirm the final active meal was saved.');
  });

  it('handles cereal clarification as one active meal instead of restarting each answer', async () => {
    const conversation = await runQaScenario({
      name: 'cereal clarification transcript',
      messages: ['I had cereal', 'Cinnamon Toast Crunch', 'about 2 bowls', 'with whole milk'],
    });
    const [initialTurn, brandTurn, bowlTurn, milkTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expect(initialTurn.response.should_ask_clarification || initialTurn.response.next_state.currentMealItems.length > 0).toBe(true);

    expectBaselineQuality(brandTurn);
    expectMealContains(brandTurn, [/cinnamon toast crunch|cereal/i]);
    expectMealItemCount(brandTurn, 1);

    expectBaselineQuality(bowlTurn);
    expectCorrectionReply(bowlTurn);
    expectMealContains(bowlTurn, [/cinnamon toast crunch|cereal/i]);
    expectServing(bowlTurn, /cinnamon toast crunch|cereal/i, 2, 'bowl');

    expectBaselineQuality(milkTurn);
    expectCorrectionReply(milkTurn);
    expectMealContains(milkTurn, [/cinnamon toast crunch|cereal/i, /whole milk/i]);
    expectMealDoesNotContain(milkTurn, [/what/i, /examples/i, /frozen dinner/i]);
  });

  it('keeps casual workout interruptions from resetting the active meal', async () => {
    const conversation = await runQaScenario({
      name: 'casual workout interruption meal continuity',
      messages: ['I had chicken and rice', 'also my workout destroyed me today', 'anyway add broccoli too'],
    });
    const [initialTurn, workoutTurn, broccoliTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/chicken/i, /rice/i]);

    expectBaselineQuality(workoutTurn);
    expectMealUnchanged(workoutTurn);
    expectReplyNotMatches(workoutTurn, /calories total|logged|added/i, 'Workout aside should be conversational, not a food log.');

    expectBaselineQuality(broccoliTurn);
    expectCorrectionReply(broccoliTurn);
    expectMealContains(broccoliTurn, [/chicken/i, /rice/i, /broccoli/i]);
  });

  it('allows wait-also additions after save by reopening the just-saved meal', async () => {
    const conversation = await runQaScenario({
      name: 'save then wait also add banana',
      messages: ['I had cottage cheese', 'save it', 'wait also add a banana'],
    });
    const [initialTurn, saveTurn, bananaTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectMealContains(initialTurn, [/cottage cheese/i]);
    expect(saveTurn.response.next_state.saved).toBe(true);

    expectBaselineQuality(bananaTurn);
    expectCorrectionReply(bananaTurn);
    expectMealContains(bananaTurn, [/cottage cheese/i, /banana/i]);
    expect(bananaTurn.response.next_state.saved).toBe(false);
    expectReplyNotMatches(bananaTurn, /starting fresh|new meal/i, 'Wait-also should amend the saved meal preview, not feel like a reset.');
  });

  it('handles multi-meal continuity without overwriting the prior meal turn text', async () => {
    const conversation = await runQaScenario({
      name: 'breakfast lunch dinner continuity',
      messages: ['for breakfast I had oatmeal', "for lunch I had Chick-fil-A nuggets", 'for dinner steak and potatoes'],
    });
    const [breakfastTurn, lunchTurn, dinnerTurn] = conversation.turns;

    expectBaselineQuality(breakfastTurn);
    expectMealContains(breakfastTurn, [/oatmeal/i]);
    expect(breakfastTurn.response.next_state.mealType).toBe('breakfast');

    expectBaselineQuality(lunchTurn);
    expectMealContains(lunchTurn, [/chick-fil-a|nuggets/i]);
    expectMealDoesNotContain(lunchTurn, [/oatmeal/i]);
    expect(lunchTurn.response.next_state.mealType).toBe('lunch');

    expectBaselineQuality(dinnerTurn);
    expectMealContains(dinnerTurn, [/steak/i, /potatoes/i]);
    expectMealDoesNotContain(dinnerTurn, [/nuggets/i, /oatmeal/i]);
    expect(dinnerTurn.response.next_state.mealType).toBe('dinner');
  });

  it('handles removal flow including remove everything', async () => {
    const conversation = await runQaScenario({
      name: 'remove coke then remove everything',
      messages: ['I had a Chipotle bowl and a Coke Zero', 'remove the Coke', 'actually remove everything'],
    });
    const [, removeCokeTurn, removeEverythingTurn] = conversation.turns;

    expectBaselineQuality(removeCokeTurn);
    expectCorrectionReply(removeCokeTurn);
    expectMealContains(removeCokeTurn, [/chipotle/i]);
    expectMealDoesNotContain(removeCokeTurn, [/coke/i]);

    expectBaselineQuality(removeEverythingTurn);
    expect(removeEverythingTurn.response.next_state.currentMealItems).toHaveLength(0);
    expectReplyMatches(removeEverythingTurn, /removed|cleared|starting fresh|empty/i, 'Remove everything should clear the active meal.');
  });

  it('handles pizza pronoun corrections and additions without duplicating pizza', async () => {
    const conversation = await runQaScenario({
      name: 'pizza pronoun correction transcript',
      messages: ['I had pizza', 'make that 3 slices', 'actually only 2', 'add ranch with it'],
    });
    const [, threeTurn, twoTurn, ranchTurn] = conversation.turns;

    expectBaselineQuality(threeTurn);
    expectCorrectionReply(threeTurn);
    expectServing(threeTurn, /pizza/i, 3, 'slice');

    expectBaselineQuality(twoTurn);
    expectCorrectionReply(twoTurn);
    expectMealItemCount(twoTurn, 1);
    expectServing(twoTurn, /pizza/i, 2, 'slice');

    expectBaselineQuality(ranchTurn);
    expectCorrectionReply(ranchTurn);
    expectMealContains(ranchTurn, [/pizza/i, /ranch/i]);
    expectMealItemCount(ranchTurn, 2);
  });

  it('handles barely-ate edge case without logging emotional phrasing', async () => {
    const conversation = await runQaScenario({
      name: 'barely ate coffee muffin corrections',
      messages: ['i barely ate today', 'just coffee', 'wait no i had a muffin too', 'actually two muffins', 'nvm one'],
    });
    const [barelyTurn, coffeeTurn, muffinTurn, twoMuffinsTurn, oneMuffinTurn] = conversation.turns;

    expectBaselineQuality(barelyTurn);
    expectMealItemCount(barelyTurn, 0);
    expectReplyNotMatches(barelyTurn, /barely ate.*calories|i can log/i, 'Emotional context should not become a fake food.');

    expectBaselineQuality(coffeeTurn);
    expectMealContains(coffeeTurn, [/coffee/i]);

    expectBaselineQuality(muffinTurn);
    expectCorrectionReply(muffinTurn);
    expectMealContains(muffinTurn, [/coffee/i, /muffin/i]);

    expectBaselineQuality(twoMuffinsTurn);
    expectCorrectionReply(twoMuffinsTurn);
    expectServing(twoMuffinsTurn, /muffin/i, 2, 'muffin');

    expectBaselineQuality(oneMuffinTurn);
    expectCorrectionReply(oneMuffinTurn);
    expectServing(oneMuffinTurn, /muffin/i, 1, 'muffin');
    expectMealContains(oneMuffinTurn, [/coffee/i]);
  });

  it('runs a long realistic day without assistant reset or stale state', async () => {
    const conversation = await runQaScenario({
      name: 'long realistic mixed user day',
      messages: [
        'hey',
        'for breakfast i had oatmeal with blueberries',
        'add peanut butter',
        'actually make the oatmeal half a cup',
        'lol this is annoying',
        'save it',
        'for lunch I had a Chipotle bowl with double chicken and cheese plus a Coke Zero',
        'actually no cheese and add guac',
        'make the chicken regular',
        'how much protein do I have left?',
        'what should I snack on as a healthy treat?',
        'wait add a Quest protein bar',
        'save it',
        'for dinner steak and potatoes',
        'make the potatoes 2 cups',
        'remove steak',
        'actually add grilled chicken instead',
        'that looks right save it',
      ],
      context: {
        remainingProtein: 63,
        remainingCalories: 720,
        nutritionPreferences: 'high protein',
      },
    });

    for (const turn of conversation.turns) {
      expectBaselineQuality(turn);
      expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i, /what a melon/i, /estimated mixed meal/i]);
    }

    const finalTurn = conversation.turns.at(-1);
    expect(finalTurn).toBeTruthy();
    expect(finalTurn?.response.next_state.saved).toBe(true);
    expectMealContains(finalTurn!, [/potatoes/i, /grilled chicken/i]);
    expectMealDoesNotContain(finalTurn!, [/steak/i]);
    expectReplyMatches(finalTurn!, /saved|logged|in/i, 'Long session should save the final corrected dinner.');
    expectReplyNotMatches(finalTurn!, /what did you eat today|send the meal whenever/i, 'Long session should not feel like the assistant reset.');
  });
});

function findQaItem(turn: { response: { next_state: { currentMealItems: ReturnType<typeof createQaItem>[] } } }, matcher: RegExp) {
  return turn.response.next_state.currentMealItems.find((item) => matcher.test(item.food_name));
}

function expectServing(
  turn: { response: { next_state: { currentMealItems: ReturnType<typeof createQaItem>[] } }; assistantReply: string },
  matcher: RegExp,
  quantity: number,
  unit: string,
) {
  const item = findQaItem(turn, matcher);
  expect(item?.food_name).toMatch(matcher);
  expect(item?.quantity).toBe(quantity);
  expect(item?.unit).toBe(unit);
  expect(item?.userQuantity).toBe(quantity);
  expect(item?.userUnit).toBe(unit);
  expect(item?.userTextSpan).toMatch(new RegExp(`${quantity.toString().replace('.', '\\.')}.*${unit}`, 'i'));
}

function expectStateAndReplyDoNotDisagree(turn: { response: { next_state: { currentMealItems: ReturnType<typeof createQaItem>[] } }; assistantReply: string }) {
  for (const item of turn.response.next_state.currentMealItems) {
    const quantityText = item.quantity.toString().replace('.', '\\.');
    const unitText = item.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const itemName = item.food_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (new RegExp(itemName, 'i').test(turn.assistantReply)) {
      expect(turn.assistantReply).toMatch(new RegExp(`${quantityText}\\s+${unitText}|${unitText}.*${quantityText}|${quantityText}.*${itemName}`, 'i'));
    }
  }
}

function buildMemoryContext(): Partial<MealAssistantContext> {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const recent = new Date(Date.now() - 3600000).toISOString();
  const chipotleItem = createQaItem({ food_name: 'Chipotle chicken bowl', quantity: 1, unit: 'bowl', calories: 820, protein: 55, carbs: 82, fat: 28, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Chipotle official nutrition' });
  const fairlifeItem = createQaItem({ food_name: 'Fairlife Core Power Elite 42g Protein Shake', quantity: 1, unit: 'bottle', calories: 230, protein: 42, carbs: 8, fat: 3.5, source_type: 'GENERIC_REFERENCE', source_name: 'Fairlife nutrition reference' });
  const mcdoubleItem = createQaItem({ food_name: 'McDouble', quantity: 1, unit: 'burger', calories: 390, protein: 22, carbs: 33, fat: 19, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" });

  return {
    favoriteMeals: [
      {
        id: 'fav-fairlife',
        title: 'Fairlife shake',
        rawText: 'Fairlife Core Power Elite shake',
        mealType: 'snack',
        totalCalories: 230,
        confidenceScore: 0.96,
        sourceReusableMealId: 'fav-fairlife',
        createdAt: recent,
        lastUsedAt: recent,
        items: [fairlifeItem],
      },
      {
        id: 'fav-chipotle',
        title: 'Chipotle bowl',
        rawText: 'Chipotle chicken bowl',
        mealType: 'dinner',
        totalCalories: 820,
        confidenceScore: 0.96,
        sourceReusableMealId: 'fav-chipotle',
        createdAt: recent,
        lastUsedAt: recent,
        items: [chipotleItem],
      },
    ],
    recentMeals: [
      {
        id: 'recent-mcdouble',
        title: 'McDouble',
        rawText: 'McDouble from McDonalds',
        mealType: 'lunch',
        totalCalories: 390,
        confidenceScore: 0.98,
        createdAt: recent,
        lastUsedAt: recent,
        items: [mcdoubleItem],
      },
      {
        id: 'yesterday-chipotle',
        title: 'Chipotle bowl',
        rawText: 'Chipotle chicken bowl',
        mealType: 'dinner',
        totalCalories: 820,
        confidenceScore: 0.98,
        createdAt: yesterday,
        lastUsedAt: yesterday,
        items: [chipotleItem],
      },
    ],
  };
}

import { afterEach, beforeEach, describe, it } from 'vitest';

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
});

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

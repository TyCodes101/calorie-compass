import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MealAssistantContext, MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

function buildState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'lunch',
    userName: 'Tyler Cox',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  };
}

function createItem(args: {
  food_name: string;
  quantity?: number;
  unit?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  source_type?: ParsedFoodItem['source_type'];
  source_name?: string | null;
  notes?: string | null;
}): ParsedFoodItem {
  return {
    food_name: args.food_name,
    quantity: args.quantity ?? 1,
    unit: args.unit ?? 'serving',
    calories: args.calories,
    protein: args.protein ?? 0,
    carbs: args.carbs ?? 0,
    fat: args.fat ?? 0,
    fiber: args.fiber ?? 0,
    sugar: args.sugar ?? 0,
    sodium: args.sodium ?? 0,
    notes: args.notes ?? 'Verified match.',
    is_trusted: (args.source_type ?? 'GENERIC_REFERENCE') !== 'AI_ESTIMATE',
    source_type: args.source_type ?? 'GENERIC_REFERENCE',
    source_name: args.source_name ?? 'Branded database',
    confidence_label: (args.source_type ?? 'GENERIC_REFERENCE') === 'AI_ESTIMATE' ? 'Estimated' : 'Verified',
    matched_query: null,
    original_user_text: null,
    provider_used: null,
    used_ai_fallback: (args.source_type ?? 'GENERIC_REFERENCE') === 'AI_ESTIMATE',
    catalog_food_id: null,
  };
}

function buildParsedMealResponse(items: ParsedFoodItem[], mealType: MealAssistantState['mealType'] = 'lunch'): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: items.some((item) => item.source_type === 'AI_ESTIMATE') ? 0.84 : 0.96,
    items,
    totals: {
      calories: items.reduce((sum, item) => sum + item.calories, 0),
      protein: items.reduce((sum, item) => sum + item.protein, 0),
      carbs: items.reduce((sum, item) => sum + item.carbs, 0),
      fat: items.reduce((sum, item) => sum + item.fat, 0),
      fiber: items.reduce((sum, item) => sum + item.fiber, 0),
      sugar: items.reduce((sum, item) => sum + item.sugar, 0),
      sodium: items.reduce((sum, item) => sum + item.sodium, 0),
    },
  };
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phraseFromItem(item: { brand: string | null; modifiers: string[]; name: string }) {
  return normalize([item.brand ?? '', ...item.modifiers, item.name].filter(Boolean).join(' '));
}

async function resolveConversationNutrition(args: {
  item: { brand: string | null; modifiers: string[]; name: string; quantity: number };
  mealType: MealAssistantState['mealType'];
}): Promise<ParsedMealResponse | null> {
  const phrase = phraseFromItem(args.item);
  const quantity = args.item.quantity || 1;

  if (phrase.includes('banana and peanut butter')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Banana', unit: 'banana', calories: 105, carbs: 27, fiber: 3, sugar: 14 }),
      createItem({ food_name: 'Peanut Butter', unit: 'tbsp', calories: 95, protein: 4, carbs: 3, fat: 8, fiber: 1, sugar: 1 }),
    ], args.mealType);
  }

  if (phrase.includes('eggs toast bacon orange juice') || phrase.includes('eggs toast bacon and orange juice')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 }),
      createItem({ food_name: 'Toast', unit: 'slice', calories: 100, carbs: 19, protein: 4, fat: 1 }),
      createItem({ food_name: 'Bacon', quantity: 2, unit: 'slice', calories: 90, protein: 6, fat: 7 }),
      createItem({ food_name: 'Orange Juice', unit: 'glass', calories: 110, carbs: 26, sugar: 21 }),
    ], args.mealType);
  }

  if (phrase.includes('mcdouble and a medium fry') || phrase.includes('mcdouble and medium fry')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'McDouble', unit: 'burger', calories: 390, protein: 22, carbs: 33, fat: 19, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
      createItem({ food_name: 'Medium Fry', unit: 'order', calories: 340, protein: 4, carbs: 44, fat: 16, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
    ], args.mealType);
  }

  if (phrase.includes('chipotle bowl')) {
    return buildParsedMealResponse([
      createItem({
        food_name: 'Chipotle Chicken Bowl',
        unit: 'bowl',
        calories: 980,
        protein: 68,
        carbs: 74,
        fat: 34,
        fiber: 10,
        sodium: 1760,
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: 'Chipotle official nutrition',
      }),
    ], args.mealType);
  }

  if (phrase.includes('oatmeal') || phrase.includes('oats')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Oatmeal', quantity, unit: args.item.unit ?? 'serving', calories: 150 * quantity, protein: 5 * quantity, carbs: 27 * quantity, fat: 3 * quantity, fiber: 4 * quantity, source_name: 'Oatmeal reference' }),
    ], args.mealType);
  }

  if (phrase.includes('blueberries')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Blueberries', quantity, unit: args.item.unit ?? 'cup', calories: 85 * quantity, protein: 1 * quantity, carbs: 21 * quantity, fat: 0.5 * quantity, fiber: 3.5 * quantity, source_name: 'Blueberry reference' }),
    ], args.mealType);
  }

  if (phrase.includes('coke zero') || phrase.includes('diet coke')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Coke Zero', unit: 'can', calories: 0, protein: 0, carbs: 0, fat: 0, source_name: 'Coke Zero nutrition reference' }),
    ], args.mealType);
  }

  if (phrase.includes('daisy') || phrase.includes('cottage cheese')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Daisy Low Fat Cottage Cheese', unit: 'serving', calories: 90, protein: 13, carbs: 4, fat: 2, source_name: 'Daisy nutrition reference' }),
    ], args.mealType);
  }

  if (phrase.includes('quaker') && phrase.includes('rice cakes')) {
    return buildParsedMealResponse([
      createItem({
        food_name: 'Quaker White Cheddar Rice Cakes',
        quantity,
        unit: 'cake',
        calories: 45 * quantity,
        protein: 1 * quantity,
        carbs: 9 * quantity,
        fat: 1.5 * quantity,
        source_name: 'Branded database',
      }),
    ], args.mealType);
  }

  if (phrase.includes('rice cakes')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Rice Cakes', quantity, unit: 'cake', calories: 35 * quantity, protein: 1 * quantity, carbs: 7 * quantity, fat: 0, source_name: 'USDA reference' }),
    ], args.mealType);
  }

  if (phrase.includes('fairlife')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Fairlife Chocolate Protein Shake', unit: 'bottle', calories: 150, protein: 30, carbs: 4, fat: 2.5, source_name: 'Fairlife nutrition reference' }),
    ], args.mealType);
  }

  if (phrase.includes('grilled chicken') && !phrase.includes('sandwich')) {
    return buildParsedMealResponse([
      createItem({
        food_name: 'Chicken breast',
        quantity: 113.4,
        unit: 'oz',
        calories: 690,
        protein: 129,
        carbs: 0,
        fat: 15,
        source_name: 'USDA FoodData Central',
      }),
    ], args.mealType);
  }

  if (phrase.includes('mcdouble')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'McDouble', unit: 'burger', calories: 390, protein: 22, carbs: 33, fat: 19, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
    ], args.mealType);
  }

  if (phrase.includes('taco bell') && phrase.includes('crunchy tacos')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Taco Bell Crunchy Tacos', unit: 'order', calories: 340, protein: 12, carbs: 26, fat: 20, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Taco Bell official nutrition' }),
    ], args.mealType);
  }

  if (phrase.includes('large fry')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Large Fry', unit: 'order', calories: 480, protein: 6, carbs: 66, fat: 23, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
    ], args.mealType);
  }

  if (phrase.includes('medium fry') || (phrase.includes('fry') && phrase.includes('medium'))) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Medium Fry', unit: 'order', calories: 340, protein: 4, carbs: 44, fat: 16, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
    ], args.mealType);
  }

  if (phrase.includes('banana')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Banana', quantity, unit: 'banana', calories: 105 * quantity, carbs: 27 * quantity, fiber: 3 * quantity, sugar: 14 * quantity }),
    ], args.mealType);
  }

  if (phrase.includes('peanut butter')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Peanut Butter', unit: 'tbsp', calories: 95 * quantity, protein: 4 * quantity, carbs: 3 * quantity, fat: 8 * quantity, fiber: 1 * quantity, sugar: 1 * quantity }),
    ], args.mealType);
  }

  if (phrase.includes('egg')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Eggs', quantity, unit: 'egg', calories: 70 * quantity, protein: 6 * quantity, fat: 5 * quantity }),
    ], args.mealType);
  }

  if (phrase.includes('toast')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Toast', unit: 'slice', calories: 100, carbs: 19, protein: 4, fat: 1 }),
    ], args.mealType);
  }

  if (phrase.includes('bacon')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Bacon', quantity: 2, unit: 'slice', calories: 90, protein: 6, fat: 7 }),
    ], args.mealType);
  }

  if (phrase.includes('orange juice')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Orange Juice', unit: 'glass', calories: 110, carbs: 26, sugar: 21 }),
    ], args.mealType);
  }

  if (phrase.includes('grilled chicken sandwich')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Grilled Chicken Sandwich', unit: 'sandwich', calories: 390, protein: 29, carbs: 44, fat: 10, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Restaurant nutrition' }),
    ], args.mealType);
  }

  if (phrase.includes('fried chicken sandwich')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Fried Chicken Sandwich', unit: 'sandwich', calories: 490, protein: 26, carbs: 46, fat: 21, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Restaurant nutrition' }),
    ], args.mealType);
  }

  if (phrase.includes('rice')) {
    return buildParsedMealResponse([
      createItem({ food_name: 'Rice', unit: 'cup', calories: 200 * quantity, protein: 4 * quantity, carbs: 45 * quantity, fat: 0, source_name: 'USDA reference' }),
    ], args.mealType);
  }

  return buildParsedMealResponse([
    createItem({ food_name: args.item.name, quantity, unit: 'serving', calories: 200, protein: 10, carbs: 20, fat: 8, source_type: 'AI_ESTIMATE', source_name: 'Estimated reference', notes: 'Estimated fallback.' }),
  ], args.mealType);
}

function buildContext(overrides?: Partial<MealAssistantContext>): MealAssistantContext {
  return {
    favoriteMeals: [],
    recentMeals: [],
    nutritionPreferences: null,
    proteinGoal: 180,
    dailyCalorieGoal: 2400,
    todayProtein: 120,
    todayCarbs: 180,
    todayFat: 55,
    todayCalories: 1500,
    remainingProtein: 60,
    remainingCarbs: 60,
    remainingFat: 25,
    remainingCalories: 900,
    todayMealCount: 2,
    ...overrides,
  };
}

async function runConversation(
  messages: string[],
  options?: {
    initialState?: MealAssistantState;
    context?: MealAssistantContext;
    classify?: (args: { message: string; state: MealAssistantState }) => Promise<MealAssistantModelOutput>;
    saveMeal?: ReturnType<typeof vi.fn>;
    resolveItemNutrition?: typeof resolveConversationNutrition;
  },
) {
  let state = options?.initialState ?? buildState();
  const responses = [] as Awaited<ReturnType<typeof runMealAssistant>>[];

  for (const message of messages) {
    const response = await runMealAssistant(
      { message, state, context: options?.context },
      {
        classify: options?.classify,
        resolveItemNutrition: options?.resolveItemNutrition ?? resolveConversationNutrition,
        saveMeal: options?.saveMeal,
      },
    );

    responses.push(response);
    state = response.next_state;
  }

  return responses;
}

function expectNoBadAssistantPatterns(reply: string) {
  expect(reply).not.toMatch(/how (?:was|were) .*rice cakes? cooked/i);
  expect(reply).not.toMatch(/\b(?:butter|oil)\b.*\?/i);
  expect(reply).not.toMatch(/barcode/i);
  expect(reply).not.toMatch(/i'?m with you/i);
  expect(reply).not.toMatch(/you got this|let'?s go|crush it|stay strong|no excuses|cheat day|earn it/i);
  expect(reply).not.toMatch(/got it\.?$|okay\.?$|sounds good\.?$/i);
  expect(reply).not.toMatch(/\u00e2|\u2018|\u2019|\u2026/);
}

describe('meal assistant conversational coverage', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it.each([
    ['5 eggs', /5 eggs/i, 1],
    ['2 rice cakes', /2 rice cakes/i, 1],
    ['large fry', /large fry/i, 1],
    ['banana and peanut butter', /banana/i, 2],
  ])('logs basic food prompts naturally: %s', async (prompt, expectedReply, expectedItemCount) => {
    const [response] = await runConversation([prompt]);

    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items).toHaveLength(expectedItemCount);
    expect(response.assistant_reply).toMatch(expectedReply);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it.each([
    ['Daisy low fat cottage cheese', /daisy low fat cottage cheese/i],
    ['Quaker white cheddar rice cakes', /quaker white cheddar rice cakes/i],
    ['Fairlife chocolate protein shake', /fairlife chocolate protein shake/i],
    ['McDouble', /mcdouble/i],
    ['Taco Bell crunchy tacos', /taco bell crunchy tacos/i],
  ])('recognizes common brands without barcode or clarification: %s', async (prompt, expectedFood) => {
    const [response] = await runConversation([prompt]);

    expect(response.should_ask_clarification).toBe(false);
    expect(response.clarification_question).toBeNull();
    expect(response.meal.items.some((item) => expectedFood.test(item.food_name))).toBe(true);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it.each([
    'cottage cheese',
    '20 grams of cottage cheese low fat',
    '24 grams of cotaage cheese',
  ])('logs cottage cheese without a clarification loop: %s', async (prompt) => {
    const [response] = await runConversation([prompt]);

    expect(response.should_ask_clarification).toBe(false);
    expect(response.clarification_question).toBeNull();
    expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(response.assistant_reply).toMatch(/cottage cheese/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it('updates cottage cheese quantity from a correction instead of removing it', async () => {
    const responses = await runConversation(['I had some cottage cheese', 'no i had 1 cup']);
    const first = responses[0];
    const correction = responses[1];

    expect(first?.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(first?.meal.items[0]?.quantity).toBe(0.5);
    expect(correction?.intent).toBe('quantity_change');
    expect(correction?.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(correction?.meal.items[0]?.quantity).toBe(1);
    expect(correction?.meal.items[0]?.unit).toBe('cup');
    expect(correction?.meal.totals.calories).toBeGreaterThan(first?.meal.totals.calories ?? 0);
    expect(correction?.assistant_reply).toMatch(/switched|1 cup|cottage cheese/i);
    expect(correction?.assistant_reply).not.toMatch(/out now|need a little more detail|i can log/i);
  });

  it('updates fractional cottage cheese serving corrections without asking for more detail', async () => {
    const responses = await runConversation([
      'I had some cottage cheese',
      'no i had 1 whole cup',
      'nvm i only had .75 of a cup',
      'i had half a cup',
    ]);
    const oneCup = responses[1];
    const threeQuarterCup = responses[2];
    const halfCup = responses[3];

    expect(oneCup?.meal.items).toHaveLength(1);
    expect(oneCup?.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(oneCup?.meal.items[0]?.quantity).toBe(1);
    expect(threeQuarterCup?.meal.items[0]?.quantity).toBe(0.75);
    expect(halfCup?.meal.items[0]?.quantity).toBe(0.5);
    for (const response of responses.slice(1)) {
      expect(response.assistant_reply).not.toMatch(/need a little more detail|i can log|out now/i);
      expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    }
  });

  it('preserves grilled chicken cup servings through corrections and repair turns', async () => {
    const responses = await runConversation([
      '3 cups of grilled chicken',
      'no i had 4 cups i meant',
      'no lets go back to 3 cups',
      'no',
      "that's not right",
    ]);
    const first = responses[0];
    const fourCups = responses[1];
    const backToThree = responses[2];
    const bareNo = responses[3];
    const complaint = responses[4];

    expect(first?.meal.items).toHaveLength(1);
    expect(first?.meal.items[0]?.food_name).toMatch(/chicken/i);
    expect(first?.meal.items[0]?.quantity).toBe(3);
    expect(first?.meal.items[0]?.unit).toBe('cup');
    expect(first?.assistant_reply).toMatch(/3 cups?.*chicken|chicken.*3 cups?/i);
    expect(first?.assistant_reply).not.toMatch(/113\.4|oz/i);

    expect(fourCups?.intent).toBe('quantity_change');
    expect(fourCups?.meal.items).toHaveLength(1);
    expect(fourCups?.meal.items[0]?.quantity).toBe(4);
    expect(fourCups?.meal.items[0]?.unit).toBe('cup');
    expect(fourCups?.assistant_reply).toMatch(/4 cups?.*chicken|chicken.*4 cups?/i);
    expect(fourCups?.assistant_reply).not.toMatch(/\b4 oz\b|113\.4 oz/i);

    expect(backToThree?.intent).toBe('quantity_change');
    expect(backToThree?.meal.items).toHaveLength(1);
    expect(backToThree?.meal.items[0]?.quantity).toBe(3);
    expect(backToThree?.meal.items[0]?.unit).toBe('cup');
    expect(backToThree?.assistant_reply).toMatch(/3 cups?.*chicken|chicken.*3 cups?/i);
    expect(backToThree?.assistant_reply).not.toMatch(/\b4 oz\b|113\.4 oz/i);

    for (const response of [bareNo, complaint]) {
      expect(response?.meal.items).toHaveLength(1);
      expect(response?.meal.items[0]?.food_name).toMatch(/chicken/i);
      expect(response?.meal.items[0]?.quantity).toBe(3);
      expect(response?.meal.items[0]?.unit).toBe('cup');
      expect(response?.assistant_reply).toMatch(/chicken|meal|change|fix|right|current/i);
      expect(response?.assistant_reply).not.toMatch(/i can log|need a little more detail|no,? around|that's not right/i);
    }
  });

  it('preserves common serving units and inherits units on quantity-only corrections', async () => {
    const [rice] = await runConversation(['3 cups rice']);
    expect(rice.meal.items[0]?.food_name).toMatch(/rice/i);
    expect(rice.meal.items[0]?.quantity).toBe(3);
    expect(rice.meal.items[0]?.unit).toBe('cup');
    expect(rice.assistant_reply).not.toMatch(/\boz\b/i);

    const [peanutButter] = await runConversation(['2 tbsp peanut butter']);
    expect(peanutButter.meal.items[0]?.food_name).toMatch(/peanut butter/i);
    expect(peanutButter.meal.items[0]?.quantity).toBe(2);
    expect(peanutButter.meal.items[0]?.unit).toBe('tbsp');

    const cottageResponses = await runConversation([
      '1 whole cup cottage cheese',
      'actually .75',
      'half a cup',
      'make it 2',
    ]);
    expect(cottageResponses[0]?.meal.items[0]?.quantity).toBe(1);
    expect(cottageResponses[0]?.meal.items[0]?.unit).toBe('cup');
    expect(cottageResponses[1]?.meal.items[0]?.quantity).toBe(0.75);
    expect(cottageResponses[1]?.meal.items[0]?.unit).toBe('cup');
    expect(cottageResponses[2]?.meal.items[0]?.quantity).toBe(0.5);
    expect(cottageResponses[2]?.meal.items[0]?.unit).toBe('cup');
    expect(cottageResponses[3]?.meal.items[0]?.quantity).toBe(2);
    expect(cottageResponses[3]?.meal.items[0]?.unit).toBe('cup');
  });

  it('removes the current item for clear pronoun removal without guessing a new food', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);
    const [response] = await runConversation(['remove that'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Toast', quantity: 1, unit: 'slice', calories: 100, protein: 4, carbs: 19, fat: 1 })],
        currentMealText: '1 slice Toast',
      }),
      resolveItemNutrition,
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.intent).toMatch(/remove_item|correction/);
    expect(response.meal.items).toHaveLength(0);
    expect(response.assistant_reply).toMatch(/removed|took out|out/i);
    expect(response.assistant_reply).not.toMatch(/i can log|need a little more detail/i);
  });

  it('answers clarification-detail questions without turning them into food', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);
    const [response] = await runConversation(['what detail do you need'], {
      resolveItemNutrition,
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Cottage cheese', quantity: 0.5, unit: 'cup', calories: 90, protein: 13, carbs: 4, fat: 2, source_type: 'AI_ESTIMATE' })],
        currentMealText: '0.5 cups Cottage cheese',
      }),
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(response.assistant_reply).toMatch(/amount|brand|prep|detail/i);
    expect(response.assistant_reply).not.toMatch(/i can log what detail|need a little more detail/i);
  });

  it('keeps dinner idea requests as recommendations even when phrased like a rejection', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);
    const responses = await runConversation([
      'give me a yummy dinner diea',
      'no a yummy dinner ideas',
      'no i want a good idea for dinner',
    ], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Cottage cheese', quantity: 0.5, unit: 'cup', calories: 90, protein: 13, carbs: 4, fat: 2, source_type: 'AI_ESTIMATE' })],
        currentMealText: '0.5 cups Cottage cheese',
      }),
      resolveItemNutrition,
      context: buildContext({ remainingCalories: 720, remainingProtein: 63 }),
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    for (const response of responses) {
      expect(response.intent).toBe('recommendation_request');
      expect(response.meal.items).toHaveLength(1);
      expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
      expect(response.assistant_reply).toMatch(/protein|dinner|chicken|turkey|salmon|steak/i);
      expect(response.assistant_reply).not.toMatch(/frozen dinner|usda match|calories total|i can log/i);
    }
  });

  it('uses model intent flags to prevent recommendation text from hitting nutrition lookup', async () => {
    const classify = vi.fn().mockResolvedValue({
      intent: 'recommendation_request',
      assistant_reply: 'You should go protein-forward for dinner.',
      contains_food_to_log: false,
      contains_quantity_update: false,
      target_item: null,
      should_mutate_pending_meal: false,
      assistant_reply_goal: 'Give a dinner recommendation using remaining calories and protein.',
      items: [{ name: 'Frozen dinner, NFS', brand: null, quantity: 100, unit: 'g', modifiers: [], action: 'add' }],
      corrections: [],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
    } satisfies MealAssistantModelOutput);
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);

    const [response] = await runConversation(['recommend a good dinner'], {
      classify,
      resolveItemNutrition,
      context: buildContext({ remainingCalories: 720, remainingProtein: 63 }),
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Cottage cheese', quantity: 0.5, unit: 'cup', calories: 90, protein: 13, carbs: 4, fat: 2, source_type: 'AI_ESTIMATE' })],
        currentMealText: '0.5 cups Cottage cheese',
      }),
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.intent).toBe('recommendation_request');
    expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(response.assistant_reply).not.toMatch(/frozen dinner|usda match/i);
  });

  it('keeps huh and frustrated replies conversational after an active meal', async () => {
    const responses = await runConversation(['I had some cottage cheese', 'huh', 'wtf man']);
    const huh = responses[1];
    const frustrated = responses[2];

    expect(huh?.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(frustrated?.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(huh?.assistant_reply).not.toMatch(/i can log huh|need a little more detail/i);
    expect(frustrated?.assistant_reply).not.toMatch(/i can log wtf|need a little more detail/i);
    expect(frustrated?.assistant_reply).toMatch(/fix|clean|change/i);
  });

  it('prevents a bad model removal for no-i-had quantity corrections', async () => {
    const classify = vi.fn().mockResolvedValue({
      intent: 'remove_item',
      assistant_reply: 'Cottage cheese is out now.',
      items: [{ name: 'i had 1 cup of cottage cheese', brand: null, quantity: 1, unit: null, modifiers: [], action: 'remove' }],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    } satisfies MealAssistantModelOutput);
    const activeState = buildState({
      currentMealItems: [
        createItem({ food_name: 'Cottage cheese', quantity: 0.5, unit: 'cup', calories: 90, protein: 13, carbs: 4, fat: 2, source_type: 'AI_ESTIMATE' }),
      ],
      currentMealText: '0.5 cups Cottage cheese',
    });

    const [response] = await runConversation(['no i had 1 cup of cottage cheese'], {
      initialState: activeState,
      classify,
    });

    expect(classify).toHaveBeenCalledTimes(1);
    expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(response.meal.items[0]?.quantity).toBe(1);
    expect(response.assistant_reply).not.toMatch(/out now|need a little more detail|i can log/i);
  });

  it('uses a numeric reply to answer a pending Little Caesars pizza portion question', async () => {
    const responses = await runConversation(['Little Caesars pizza', '2']);
    const response = responses.at(-1);

    expect(response?.should_ask_clarification).toBe(false);
    expect(response?.clarification_question).toBeNull();
    expect(response?.meal.items[0]?.food_name).toMatch(/little caesars pizza/i);
    expect(response?.meal.items[0]?.quantity).toBe(2);
    expect(response?.meal.totals.calories).toBeGreaterThan(500);
    expect(response?.assistant_reply).toMatch(/little caesars pizza/i);
    expect(response?.assistant_reply).not.toMatch(/need a little more detail/i);
  });

  it('bot QA: logs a whole misspelled Little Caesars pizza without a portion loop', async () => {
    const [response] = await runConversation(['i had a whole little ceasers pizza']);

    expect(response.should_ask_clarification).toBe(false);
    expect(response.clarification_question).toBeNull();
    expect(response.meal.items[0]?.food_name).toMatch(/little caesars pizza/i);
    expect(response.meal.items[0]?.unit).toBe('pizza');
    expect(response.meal.totals.calories).toBeGreaterThan(2000);
    expect(response.assistant_reply).toMatch(/little caesars pizza/i);
    expect(response.assistant_reply).not.toMatch(/how much pizza|one slice|few slices/i);
  });

  it('bot QA: overrides a model clarification when the pizza amount is already clear', async () => {
    const classify = vi.fn().mockResolvedValue({
      intent: 'new_food_item',
      assistant_reply: 'How much pizza should I log?',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: true,
      clarification_question: 'How much pizza should I log?',
      confidence: 'medium',
    } satisfies MealAssistantModelOutput);

    const [response] = await runConversation(['i had a whole little ceasers pizza'], { classify });

    expect(response.should_ask_clarification).toBe(false);
    expect(response.clarification_question).toBeNull();
    expect(response.meal.items[0]?.food_name).toMatch(/little caesars pizza/i);
    expect(response.meal.items[0]?.unit).toBe('pizza');
    expect(response.assistant_reply).not.toMatch(/how much pizza|need a little more detail/i);
  });

  it('uses a whole-pizza reply to answer a pending Little Caesars pizza portion question', async () => {
    const responses = await runConversation(['Little Caesars pizza', 'a whole pizza']);
    const response = responses.at(-1);

    expect(response?.should_ask_clarification).toBe(false);
    expect(response?.clarification_question).toBeNull();
    expect(response?.meal.items).toHaveLength(1);
    expect(response?.meal.items[0]?.food_name).toMatch(/little caesars pizza/i);
    expect(response?.meal.items[0]?.unit).toBe('pizza');
    expect(response?.meal.totals.calories).toBeGreaterThan(2000);
    expect(response?.assistant_reply).toMatch(/little caesars pizza/i);
    expect(response?.assistant_reply).not.toMatch(/how much pizza|bread|toast/i);
  });

  it('starts a clean second meal after save and logs obvious countable foods', async () => {
    const [response] = await runConversation(['30 pickles'], {
      initialState: buildState({
        saved: true,
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 })],
        currentMealText: '2 Eggs',
      }),
    });

    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toBe('Pickles');
    expect(response.meal.items[0]?.quantity).toBe(30);
    expect(response.assistant_reply).toMatch(/pickles/i);
    expect(response.assistant_reply).not.toMatch(/need a little more detail/i);
  });

  it('explains shorthand confusion instead of logging it as food', async () => {
    const [response] = await runConversation(['wym'], {
      initialState: buildState({
        pendingClarification: 'For Little Caesars, was that one slice, a few slices, or a whole pizza?',
        lastAssistantQuestion: 'For Little Caesars, was that one slice, a few slices, or a whole pizza?',
      }),
    });

    expect(response.meal.items).toHaveLength(0);
    expect(response.assistant_reply).toMatch(/one detail|little caesars|slice|whole pizza/i);
    expect(response.assistant_reply).not.toMatch(/log wym|need a little more detail/i);
  });

  it('handles a chatbox-style meal plus follow-up questions in one message', async () => {
    const [response] = await runConversation(['4 slices of pizza\nProtein left?\nTonight idea'], {
      context: buildContext({ remainingProtein: 68, remainingCalories: 80 }),
    });

    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items[0]?.food_name).toBe('slices of pizza');
    expect(response.meal.items[0]?.quantity).toBe(4);
    expect(response.assistant_reply).toMatch(/pizza/i);
    expect(response.assistant_reply).toMatch(/68g of protein left/i);
    expect(response.assistant_reply).toMatch(/tonight|light|protein-forward|grilled chicken|cottage cheese/i);
  });

  it('keeps multiple food lines and multiple macro follow-ups in one chatbox send', async () => {
    const [response] = await runConversation(['2 eggs\nbanana\ncals left?\nprotein left?'], {
      context: buildContext({ remainingProtein: 68, remainingCalories: 420 }),
    });

    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items.map((item) => item.food_name)).toEqual(['Eggs', 'Banana']);
    expect(response.meal.totals.calories).toBeGreaterThan(200);
    expect(response.assistant_reply).toMatch(/eggs/i);
    expect(response.assistant_reply).toMatch(/420 calories left/i);
    expect(response.assistant_reply).toMatch(/68g of protein left/i);
  });

  it('manual QA: preserves multi-food and restaurant meal identity across priority prompts', async () => {
    const [blueberriesYogurt] = await runConversation(['Some blueberries with greek yogurt']);
    expect(blueberriesYogurt.should_ask_clarification).toBe(false);
    expect(blueberriesYogurt.meal.items.map((item) => item.food_name)).toEqual(expect.arrayContaining(['Blueberries', 'Greek yogurt']));
    expect(blueberriesYogurt.assistant_reply).not.toMatch(/estimated mixed meal|need a little more detail/i);

    const [chipotle] = await runConversation(['Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa']);
    expect(chipotle.should_ask_clarification).toBe(false);
    expect(chipotle.meal.items).toHaveLength(1);
    expect(chipotle.meal.items[0]?.food_name).toMatch(/chipotle bowl/i);
    expect(chipotle.meal.items[0]?.food_name).toMatch(/white rice/i);
    expect(chipotle.meal.items[0]?.food_name).toMatch(/double chicken/i);
    expect(chipotle.meal.items[0]?.food_name).toMatch(/cheese/i);
    expect(chipotle.meal.items[0]?.food_name).toMatch(/corn salsa/i);
    expect(chipotle.meal.items[0]?.food_name).toMatch(/lettuce/i);
    expect(chipotle.meal.items[0]?.food_name).toMatch(/green salsa/i);
    expect(chipotle.assistant_reply).not.toMatch(/chipotle white rice|estimated mixed meal/i);

    const [pizzaSlices] = await runConversation(['5 slices of pizza']);
    expect(pizzaSlices.should_ask_clarification).toBe(false);
    expect(pizzaSlices.meal.items[0]?.food_name).toMatch(/pizza/i);
    expect(pizzaSlices.meal.items[0]?.quantity).toBe(5);
    expect(pizzaSlices.meal.totals.calories).toBeGreaterThan(1200);
    expect(pizzaSlices.assistant_reply).not.toMatch(/estimated mixed meal|how much pizza/i);

    const [littleCaesars] = await runConversation(['Little Caesars pizza']);
    expect(littleCaesars.should_ask_clarification).toBe(true);
    expect(littleCaesars.clarification_question).toMatch(/little caesars|slice|whole pizza/i);
  });

  it.each(['2 apples', 'protein bar', 'banana and peanut butter'])('logs obvious everyday foods without a detail loop: %s', async (prompt) => {
    const [response] = await runConversation([prompt]);

    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items.length).toBeGreaterThanOrEqual(1);
    expect(response.assistant_reply).not.toMatch(/need a little more detail/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it('bot QA: keeps the right quantity for pieces of toast', async () => {
    const [response] = await runConversation(['i had 2 pieces of toast']);

    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items[0]?.food_name).toBe('Toast');
    expect(response.meal.items[0]?.quantity).toBe(2);
    expect(response.assistant_reply).toMatch(/2 slices of toast/i);
    expect(response.assistant_reply).not.toMatch(/1 Toast|need a little more detail/i);
  });

  it.each([
    ['2 eggs, toast, bacon, and orange juice', 4],
    ['McDouble and a medium fry', 2],
    ['Chipotle bowl with white rice, double chicken, corn salsa, cheese, and lettuce', 1],
  ])('handles realistic multi-item meal prompts: %s', async (prompt, expectedItemCount) => {
    const [response] = await runConversation([prompt]);

    expect(response.meal.items).toHaveLength(expectedItemCount);
    expect(response.assistant_reply.length).toBeLessThan(170);
    expect(response.assistant_reply).not.toMatch(/what did you eat|one quick follow-up|adjust if needed/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it('keeps adding to the same active meal across continuation turns', async () => {
    const responses = await runConversation(['2 eggs', 'and toast', 'plus bacon']);
    const finalResponse = responses.at(-1);

    expect(finalResponse?.meal.items).toHaveLength(3);
    expect(finalResponse?.meal.items.map((item) => item.food_name)).toEqual(['Eggs', 'Toast', 'Bacon']);
    expect(finalResponse?.next_state.currentMealText).toContain('Eggs');
    expect(finalResponse?.next_state.currentMealText).toContain('Toast');
    expect(finalResponse?.next_state.currentMealText).toContain('Bacon');
    expect(finalResponse?.assistant_reply).toMatch(/bacon/i);
    expect(finalResponse?.assistant_reply).toMatch(/added|adding|in there too|got you/i);
  });

  it('loads a usual meal from favorites without reparsing it', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);
    const favoriteShake = createItem({
      food_name: 'Fairlife Elite 42g Shake',
      unit: 'bottle',
      calories: 230,
      protein: 42,
      carbs: 8,
      fat: 3,
      source_name: 'Fairlife nutrition reference',
    });

    const [response] = await runConversation(['same shake'], {
      context: buildContext({
        favoriteMeals: [
          {
            id: 'favorite-shake',
            title: 'Fairlife Elite 42g shake',
            rawText: 'Fairlife Elite 42g shake',
            mealType: 'snack',
            totalCalories: 230,
            confidenceScore: 0.96,
            sourceReusableMealId: 'favorite-shake',
            items: [favoriteShake],
          },
        ],
      }),
      resolveItemNutrition,
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.intent).toBe('repeat_meal');
    expect(response.meal.items[0]?.food_name).toBe('Fairlife Elite 42g Shake');
    expect(response.assistant_reply).toMatch(/usual fairlife elite 42g shake/i);
    expect(response.next_state.sourceReusableMealId).toBe('favorite-shake');
  });

  it('can repeat yesterday from recent meals with the right meal loaded', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const yesterdayMeal = createItem({
      food_name: 'Chipotle Chicken Bowl',
      unit: 'bowl',
      calories: 980,
      protein: 68,
      carbs: 74,
      fat: 34,
      source_type: 'OFFICIAL_RESTAURANT',
      source_name: 'Chipotle official nutrition',
    });

    const [response] = await runConversation(['repeat yesterday dinner'], {
      context: buildContext({
        recentMeals: [
          {
            id: 'recent-yesterday-dinner',
            title: 'Chipotle chicken bowl',
            rawText: 'Chipotle bowl with white rice and double chicken',
            mealType: 'dinner',
            totalCalories: 980,
            confidenceScore: 0.96,
            createdAt: yesterday,
            items: [yesterdayMeal],
          },
        ],
      }),
      resolveItemNutrition,
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.meal.items[0]?.food_name).toBe('Chipotle Chicken Bowl');
    expect(response.assistant_reply).toMatch(/yesterday's chipotle bowl with white rice and double chicken/i);
    expect(response.next_state.mealType).toBe('dinner');
  });

  it('handles the exact phrase same as yesterday gracefully', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const yesterdayMeal = createItem({
      food_name: 'Chipotle Chicken Bowl',
      unit: 'bowl',
      calories: 760,
      protein: 58,
      carbs: 62,
      fat: 24,
      source_type: 'OFFICIAL_RESTAURANT',
      source_name: 'Chipotle official nutrition',
    });

    const [response] = await runConversation(['same as yesterday'], {
      context: buildContext({
        recentMeals: [
          {
            id: 'recent-yesterday-dinner',
            title: 'Chipotle chicken bowl',
            rawText: 'Chipotle bowl with white rice and double chicken',
            mealType: 'dinner',
            totalCalories: 760,
            confidenceScore: 0.96,
            createdAt: yesterday,
            items: [yesterdayMeal],
          },
        ],
      }),
    });

    expect(response.intent).toBe('repeat_meal');
    expect(response.meal.items[0]?.food_name).toBe('Chipotle Chicken Bowl');
    expect(response.assistant_reply).toMatch(/yesterday/i);
  });

  it('can pull a remembered usual meal from local assistant memory', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);

    const [response] = await runConversation(['same fairlife elite shake'], {
      context: buildContext({
        assistantMemory: {
          version: 1,
          syncStatus: 'local',
          updatedAt: '2026-05-14T12:00:00.000Z',
          recurringMeals: [
            {
              id: 'snack:fairlife elite 42g shake',
              title: 'Fairlife Elite 42g shake',
              rawText: 'Fairlife Elite 42g shake',
              mealType: 'snack',
              totalCalories: 230,
              confidenceScore: 0.96,
              source: 'saved',
              createdAt: '2026-05-13T18:00:00.000Z',
              lastUsedAt: '2026-05-14T11:30:00.000Z',
              count: 3,
              items: [
                createItem({
                  food_name: 'Fairlife Elite 42g Shake',
                  unit: 'bottle',
                  calories: 230,
                  protein: 42,
                  carbs: 8,
                  fat: 3,
                  source_name: 'Fairlife nutrition reference',
                }),
              ],
            },
          ],
          recurringFoods: [],
          commonRestaurants: [],
          commonBrands: [{ name: 'Fairlife', count: 3, lastUsedAt: '2026-05-14T11:30:00.000Z' }],
          preferredServingSizes: [],
          commonCorrections: [],
          mealTiming: [],
        },
      }),
      resolveItemNutrition,
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.intent).toBe('repeat_meal');
    expect(response.assistant_reply).toMatch(/usual fairlife elite 42g shake/i);
    expect(response.meal.items[0]?.food_name).toBe('Fairlife Elite 42g Shake');
  });

  it('answers lightweight nutrition guidance from current daily context', async () => {
    const responses = await runConversation(['how much protein do I have left?', 'am I on track?', 'what should I eat tonight?'], {
      context: buildContext({
        remainingProtein: 58,
        remainingCalories: 760,
        favoriteMeals: [
          {
            id: 'favorite-dinner',
            title: 'Chipotle chicken bowl',
            rawText: 'Chipotle bowl with white rice and double chicken',
            mealType: 'dinner',
            totalCalories: 980,
            confidenceScore: 0.96,
            sourceReusableMealId: 'favorite-dinner',
            items: [
              createItem({
                food_name: 'Chipotle Chicken Bowl',
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
      }),
    });

    expect(responses[0]?.intent).toBe('nutrition_guidance');
    expect(responses[0]?.assistant_reply).toMatch(/58g of protein left/i);
    expect(responses[1]?.assistant_reply).toMatch(/760 calories and 58g protein left|58g short on protein/i);
    expect(responses[2]?.assistant_reply).toMatch(/chipotle bowl with white rice and double chicken|protein-forward tonight/i);
    expect(responses[2]?.meal.items).toHaveLength(0);
  });

  it('adds a low-pressure proactive note when a meal still leaves protein well short', async () => {
    const [response] = await runConversation(['toast'], {
      context: buildContext({
        remainingProtein: 62,
      }),
    });

    expect(response.intent).toBe('new_food_item');
    expect(response.assistant_reply).toMatch(/toast/i);
    expect(response.assistant_reply).toMatch(/lighter side for protein today/i);
    expect(response.assistant_reply).not.toMatch(/bad|cheat|crush it|let'?s go/i);
  });

  it('can give a lightweight weekly summary without turning into an analytics dashboard', async () => {
    const [response] = await runConversation(["how's this week going?"], {
      context: buildContext({
        recentMeals: [
          {
            id: 'week-1',
            title: 'Chipotle chicken bowl',
            rawText: 'Chipotle chicken bowl',
            mealType: 'dinner',
            totalCalories: 760,
            confidenceScore: 0.96,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            items: [createItem({ food_name: 'Chipotle Chicken Bowl', unit: 'bowl', calories: 760, protein: 58, carbs: 62, fat: 24, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Chipotle official nutrition' })],
          },
          {
            id: 'week-2',
            title: 'Fairlife shake',
            rawText: 'Fairlife shake',
            mealType: 'snack',
            totalCalories: 150,
            confidenceScore: 0.96,
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
            items: [createItem({ food_name: 'Fairlife Chocolate Protein Shake', unit: 'bottle', calories: 150, protein: 30, carbs: 4, fat: 2 })],
          },
          {
            id: 'week-3',
            title: 'Chipotle chicken bowl',
            rawText: 'Chipotle chicken bowl',
            mealType: 'dinner',
            totalCalories: 760,
            confidenceScore: 0.96,
            createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
            items: [createItem({ food_name: 'Chipotle Chicken Bowl', unit: 'bowl', calories: 760, protein: 58, carbs: 62, fat: 24, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Chipotle official nutrition' })],
          },
          {
            id: 'week-4',
            title: 'Eggs and toast',
            rawText: 'Eggs and toast',
            mealType: 'breakfast',
            totalCalories: 320,
            confidenceScore: 0.9,
            createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
            items: [createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 }), createItem({ food_name: 'Toast', unit: 'slice', calories: 100, carbs: 19, protein: 4, fat: 1 })],
          },
        ],
      }),
    });

    expect(response.intent).toBe('nutrition_guidance');
    expect(response.assistant_reply).toMatch(/week/i);
    expect(response.assistant_reply).toMatch(/go-tos|steady|consistent|protein-forward/i);
    expect(response.assistant_reply).not.toMatch(/dashboard|analytics/i);
  });

  it('handles the exact phrase how am I doing this week with a calm summary', async () => {
    const [response] = await runConversation(['how am I doing this week?'], {
      context: buildContext({
        recentMeals: [
          {
            id: 'week-1',
            title: 'Eggs and toast',
            rawText: 'Eggs and toast',
            mealType: 'breakfast',
            totalCalories: 320,
            confidenceScore: 0.9,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            items: [createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 }), createItem({ food_name: 'Toast', unit: 'slice', calories: 100, carbs: 19, protein: 4, fat: 1 })],
          },
          {
            id: 'week-2',
            title: 'Fairlife shake',
            rawText: 'Fairlife shake',
            mealType: 'snack',
            totalCalories: 150,
            confidenceScore: 0.96,
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
            items: [createItem({ food_name: 'Fairlife Chocolate Protein Shake', unit: 'bottle', calories: 150, protein: 30, carbs: 4, fat: 2 })],
          },
          {
            id: 'week-3',
            title: 'Chipotle chicken bowl',
            rawText: 'Chipotle chicken bowl',
            mealType: 'dinner',
            totalCalories: 760,
            confidenceScore: 0.96,
            createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
            items: [createItem({ food_name: 'Chipotle Chicken Bowl', unit: 'bowl', calories: 760, protein: 58, carbs: 62, fat: 24, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Chipotle official nutrition' })],
          },
          {
            id: 'week-4',
            title: 'Greek yogurt',
            rawText: 'Greek yogurt',
            mealType: 'breakfast',
            totalCalories: 140,
            confidenceScore: 0.92,
            createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
            items: [createItem({ food_name: 'Greek Yogurt', unit: 'cup', calories: 140, protein: 17, carbs: 8, fat: 4 })],
          },
        ],
      }),
    });

    expect(response.assistant_reply).toMatch(/week|steady|consistent|go-to/i);
    expect(response.assistant_reply).not.toMatch(/^got it\.?$/i);
    expect(response.meal.items).toHaveLength(0);
  });

  it('handles a mixed log-plus-question turn without losing either intent', async () => {
    const [response] = await runConversation(['2 eggs and also how much protein do I have left?'], {
      context: buildContext({
        remainingProtein: 58,
      }),
    });

    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toBe('Eggs');
    expect(response.assistant_reply).toMatch(/eggs/i);
    expect(response.assistant_reply).toMatch(/58g of protein left/i);
  });

  it('understands macro follow-ups as part of the current thread', async () => {
    const [response] = await runConversation(['what about carbs?'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Chipotle Chicken Bowl', unit: 'bowl', calories: 760, protein: 58, carbs: 62, fat: 24, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Chipotle official nutrition' })],
        currentMealText: 'Chipotle Chicken Bowl',
        activeTopic: 'nutrition',
        activeMode: 'macro_discussion',
      }),
    });

    expect(response.intent).toBe('macro_question');
    expect(response.assistant_reply).toMatch(/62g carbs/i);
    expect(response.next_state.activeMode).toBe('macro_discussion');
  });

  it('recovers naturally when an ambiguous follow-up could mean the meal or the day overall', async () => {
    const [response] = await runConversation(['what about that then?'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Chipotle Chicken Bowl', unit: 'bowl', calories: 760, protein: 58, carbs: 62, fat: 24, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Chipotle official nutrition' })],
        currentMealText: 'Chipotle Chicken Bowl',
        activeTopic: 'nutrition',
        activeMode: 'macro_discussion',
        previousIntent: 'macro_question',
      }),
      context: buildContext({
        remainingProtein: 58,
        remainingCalories: 760,
      }),
    });

    expect(response.intent).toBe('casual_message');
    expect(response.assistant_reply).toMatch(/lost track/i);
    expect(response.assistant_reply).toMatch(/meal|today/i);
  });

  it('recovers naturally even when the prior thread was day-level and no meal is active', async () => {
    const [response] = await runConversation(['wait were we talking about my meal or my day?'], {
      initialState: buildState({
        currentMealItems: [],
        currentMealText: null,
        activeTopic: 'nutrition',
        activeMode: 'nutrition_coaching',
        previousIntent: 'nutrition_guidance',
      }),
      context: buildContext({
        remainingCalories: 420,
        remainingProtein: 36,
      }),
    });

    expect(response.intent).toBe('casual_message');
    expect(response.assistant_reply).toMatch(/day overall|meal instead|what you have left/i);
    expect(response.assistant_reply).not.toMatch(/^got it\.?$/i);
  });

  it('answers carbs remaining after a protein-left question thread', async () => {
    const responses = await runConversation(['how much protein do I have left?', 'what about carbs?'], {
      context: buildContext({
        remainingProtein: 58,
        remainingCarbs: 96,
      }),
    });

    expect(responses[0]?.assistant_reply).toMatch(/58g of protein left/i);
    expect(responses[1]?.assistant_reply).toMatch(/96g of carbs left/i);
    expect(responses[1]?.assistant_reply).not.toMatch(/^let me check that\.?$/i);
  });

  it('answers do I have room for a snack from remaining daily context', async () => {
    const [response] = await runConversation(['do I have room for a snack?'], {
      context: buildContext({
        remainingCalories: 420,
        remainingProtein: 36,
      }),
    });

    expect(response.intent).toBe('nutrition_guidance');
    expect(response.assistant_reply).toMatch(/room|420 calories|36g protein|snack/i);
    expect(response.assistant_reply).not.toMatch(/^got it\.?$/i);
  });

  it('treats snack-room phrasing like a snack guidance request even with an active meal', async () => {
    const [response] = await runConversation(["I'm in the snack room"], {
      context: buildContext({
        remainingCalories: 420,
        remainingProtein: 36,
      }),
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Chipotle Chicken Bowl', unit: 'bowl', calories: 760, protein: 58, carbs: 62, fat: 24 })],
        currentMealText: 'Chipotle Chicken Bowl',
      }),
    });

    expect(response.intent).toBe('nutrition_guidance');
    expect(response.assistant_reply).toMatch(/snack|420 calories|36g protein|yogurt|shake|room/i);
    expect(response.assistant_reply).not.toMatch(/^i have chipotle chicken bowl/i);
  });

  it('gives actual recommendation help for sweet-but-healthier prompts', async () => {
    const [response] = await runConversation(['something sweet but healthier'], {
      context: buildContext({
        remainingCalories: 260,
      }),
    });

    expect(response.intent).toBe('recommendation_request');
    expect(response.assistant_reply).toMatch(/greek yogurt|yasso|protein pudding|dark chocolate/i);
    expect(response.next_state.activeMode).toBe('recommendation_mode');
  });

  it('can suggest a healthier version of the active meal without breaking the meal thread', async () => {
    const [response] = await runConversation(['healthier version?'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Fried Chicken Sandwich', unit: 'sandwich', calories: 490, protein: 26, carbs: 46, fat: 21, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Restaurant nutrition' })],
        currentMealText: 'Fried Chicken Sandwich',
      }),
    });

    expect(response.assistant_reply).toMatch(/grilled|skip heavy extras|lighter/i);
    expect(response.meal.items[0]?.food_name).toBe('Fried Chicken Sandwich');
    expect(response.next_state.activeTopic).toBe('recommendation');
  });

  it('can adaptively mutate the active meal with shorthand like double that', async () => {
    const [response] = await runConversation(['double that'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 })],
        currentMealText: '2 Eggs',
      }),
    });

    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items[0]?.quantity).toBe(4);
    expect(response.assistant_reply).toMatch(/doubled/i);
  });

  it('updates the active item for absolute quantity edits like make it 4', async () => {
    const [response] = await runConversation(['actually make it 4'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 3, unit: 'egg', calories: 210, protein: 18, fat: 15 })],
        currentMealText: '3 Eggs',
      }),
    });

    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items[0]?.quantity).toBe(4);
    expect(response.assistant_reply).toMatch(/4 eggs?/i);
  });

  it('does not let healthy-treat recommendation prompts get hijacked by meal-descriptor logic', async () => {
    const [response] = await runConversation(['what should I snack on as a healthy treat?'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 3, unit: 'egg', calories: 210, protein: 18, fat: 15 })],
        currentMealText: '3 Eggs',
      }),
      context: buildContext({
        remainingProtein: 42,
      }),
    });

    expect(response.assistant_reply).toMatch(/shake|greek yogurt|cottage cheese|fruit|yasso|pudding/i);
    expect(response.assistant_reply).not.toMatch(/balanced/i);
  });

  it('uses habits, preferences, and remaining macros for high-protein breakfast recommendations', async () => {
    const [response] = await runConversation(['high protein breakfast?'], {
      context: buildContext({
        remainingCalories: 620,
        remainingProtein: 58,
        nutritionPreferences: 'high protein, simple breakfasts, likes Fairlife and Greek yogurt',
        assistantMemory: {
          version: 1,
          syncStatus: 'local',
          updatedAt: null,
          recurringMeals: [],
          recurringFoods: [
            { name: 'Greek yogurt', count: 4, lastUsedAt: null },
            { name: 'Eggs', count: 5, lastUsedAt: null },
          ],
          commonRestaurants: [],
          commonBrands: [{ name: 'Fairlife', count: 6, lastUsedAt: null }],
          preferredServingSizes: [],
          commonCorrections: [],
          mealTiming: [],
        },
      }),
    });

    expect(response.intent).toBe('recommendation_request');
    expect(response.assistant_reply).toMatch(/fairlife|greek yogurt|eggs/i);
    expect(response.assistant_reply).toMatch(/breakfast|protein/i);
    expect(response.assistant_reply).not.toMatch(/fries|pizza|snack room/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it('keeps recommendation follow-ups inside the same thread instead of turning them into meal logs', async () => {
    const responses = await runConversation(['healthy sweet snack?', 'something with more protein?'], {
      context: buildContext({
        remainingCalories: 300,
        remainingProtein: 42,
        nutritionPreferences: 'high protein',
        assistantMemory: {
          version: 1,
          syncStatus: 'local',
          updatedAt: null,
          recurringMeals: [],
          recurringFoods: [{ name: 'Greek yogurt', count: 4, lastUsedAt: null }],
          commonRestaurants: [],
          commonBrands: [{ name: 'Fairlife', count: 5, lastUsedAt: null }],
          preferredServingSizes: [],
          commonCorrections: [],
          mealTiming: [],
        },
      }),
    });

    expect(responses[0]?.intent).toBe('recommendation_request');
    expect(responses[1]?.intent).toBe('recommendation_request');
    expect(responses[1]?.meal.items).toEqual([]);
    expect(responses[1]?.assistant_reply).toMatch(/fairlife|greek yogurt|protein pudding|cottage cheese/i);
    expect(responses[1]?.assistant_reply).not.toMatch(/i can log|saved|added/i);
  });

  it('does not recommend the just-logged McDouble back as tonight\'s dinner idea', async () => {
    const responses = await runConversation(['I had a McDouble', 'what should I eat tonight?'], {
      context: buildContext({
        remainingCalories: 1910,
        remainingProtein: 158,
      }),
    });

    expect(responses[1]?.intent).toBe('recommendation_request');
    expect(responses[1]?.meal.items[0]?.food_name).toBe('McDouble');
    expect(responses[1]?.assistant_reply).toMatch(/tonight|dinner|chicken|turkey|salmon|bowl/i);
    expect(responses[1]?.assistant_reply).not.toMatch(/mcdouble|fries/i);
    expectNoBadAssistantPatterns(responses[1]?.assistant_reply ?? '');
  });

  it('keeps protein-focused snack follow-ups away from stale logged-meal context', async () => {
    const responses = await runConversation(['healthy sweet snack?', 'something with more protein?'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'McDouble', quantity: 1, unit: 'burger', calories: 390, protein: 22, carbs: 33, fat: 19, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" })],
        currentMealText: 'McDouble',
        saved: true,
        lastAssistantReply: 'I saved the McDouble.',
      }),
      context: buildContext({
        remainingCalories: 360,
        remainingProtein: 44,
        nutritionPreferences: 'high protein',
      }),
    });

    expect(responses[1]?.intent).toBe('recommendation_request');
    expect(responses[1]?.meal.items).toEqual([]);
    expect(responses[1]?.assistant_reply).toMatch(/fairlife|greek yogurt|cottage cheese|protein pudding|shake/i);
    expect(responses[1]?.assistant_reply).not.toMatch(/mcdouble|fries|saved|added/i);
  });

  it('adds calm meal-pattern guidance without sounding naggy', async () => {
    const [response] = await runConversation(['Chipotle bowl'], {
      context: buildContext({
        recentMeals: [
          {
            id: 'lunch-1',
            title: 'Chicken salad lunch',
            rawText: 'Chicken salad lunch',
            mealType: 'lunch',
            totalCalories: 420,
            confidenceScore: 0.92,
            items: [createItem({ food_name: 'Chicken Salad', calories: 420, protein: 34, carbs: 18, fat: 18 })],
          },
          {
            id: 'lunch-2',
            title: 'Turkey wrap',
            rawText: 'Turkey wrap',
            mealType: 'lunch',
            totalCalories: 460,
            confidenceScore: 0.92,
            items: [createItem({ food_name: 'Turkey Wrap', calories: 460, protein: 32, carbs: 28, fat: 16 })],
          },
          {
            id: 'lunch-3',
            title: 'Chicken rice bowl',
            rawText: 'Chicken rice bowl',
            mealType: 'lunch',
            totalCalories: 510,
            confidenceScore: 0.92,
            items: [createItem({ food_name: 'Chicken Rice Bowl', calories: 510, protein: 36, carbs: 34, fat: 14 })],
          },
        ],
      }),
    });

    expect(response.assistant_reply).toMatch(/higher carb than your normal lunch/i);
    expect(response.assistant_reply).not.toMatch(/bad|cheat|crush it|let'?s go|no excuses/i);
  });

  it('does not reuse stale recommendation context after switching back to meal logging', async () => {
    const [recommendation, logged, macroReply] = await runConversation(['healthy sweet snack?', '2 eggs and toast', 'what about carbs?'], {
      context: buildContext({
        remainingCalories: 320,
        remainingProtein: 36,
      }),
    });

    expect(recommendation.intent).toBe('recommendation_request');
    expect(logged.meal.items.map((item) => item.food_name)).toEqual(['Eggs', 'Toast']);
    expect(macroReply.intent).toBe('macro_question');
    expect(macroReply.assistant_reply).toMatch(/carbs/i);
    expect(macroReply.assistant_reply).not.toMatch(/greek yogurt|fairlife|yasso|protein pudding/i);
  });

  it('stays varied and calm across a longer repeated-use session', async () => {
    const responses = await runConversation([
      '2 eggs',
      'add toast',
      'what should I eat tonight?',
      'healthy sweet snack?',
      'I had a can of beans',
      'actually two cans',
    ], {
      context: buildContext({
        remainingCalories: 840,
        remainingProtein: 54,
        nutritionPreferences: 'high protein',
      }),
    });

    const normalizedReplies = responses.map((response) => normalize(response.assistant_reply));

    normalizedReplies.forEach((reply) => expectNoBadAssistantPatterns(reply));
    for (let index = 1; index < normalizedReplies.length; index += 1) {
      expect(normalizedReplies[index]).not.toBe(normalizedReplies[index - 1]);
    }
  });

  it('treats a McDonalds large fry as a restaurant item with sane calories', async () => {
    const [response] = await runConversation(["large fry from McDonald's"]);

    expect(response.intent).toBe('new_food_item');
    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items[0]?.food_name).toMatch(/large fry|fries/i);
    expect(response.meal.items[0]?.source_type).toBe('OFFICIAL_RESTAURANT');
    expect(response.meal.items[0]?.calories).toBeGreaterThanOrEqual(430);
    expect(response.meal.items[0]?.calories).toBeLessThanOrEqual(560);
    expect(response.assistant_reply).not.toMatch(/hash brown|usda/i);
  });

  it('logs a generic protein shake without forcing a clarification', async () => {
    const [response] = await runConversation(['protein shake']);

    expect(response.intent).toBe('new_food_item');
    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items[0]?.food_name).toMatch(/protein shake/i);
    expect(response.meal.items[0]?.calories).toBeGreaterThanOrEqual(120);
    expect(response.meal.items[0]?.calories).toBeLessThanOrEqual(260);
    expect(response.assistant_reply).toMatch(/shake/i);
  });

  it('keeps half-cup cottage cheese estimates aligned to the serving amount', async () => {
    const [response] = await runConversation(['half a cup of cottage cheese']);

    expect(response.intent).toBe('new_food_item');
    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items[0]?.food_name).toMatch(/cottage cheese/i);
    expect(response.meal.items[0]?.quantity).toBe(0.5);
    expect(response.meal.items[0]?.unit).toBe('cup');
    expect(response.meal.items[0]?.calories).toBeGreaterThanOrEqual(70);
    expect(response.meal.items[0]?.calories).toBeLessThanOrEqual(120);
  });

  it('does not undercount a Chipotle bowl with double chicken as only chicken', async () => {
    const [response] = await runConversation(['Chipotle bowl with double chicken']);

    expect(response.intent).toBe('new_food_item');
    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items[0]?.food_name).toMatch(/chipotle/i);
    expect(response.meal.items[0]?.food_name).toMatch(/bowl/i);
    expect(response.meal.items[0]?.calories).toBeGreaterThanOrEqual(500);
    expect(response.meal.items[0]?.calories).toBeLessThanOrEqual(950);
    expect(response.assistant_reply).not.toMatch(/just chicken|plain chicken/i);
  });

  it('keeps append-style food turns attached to the active meal after recommendation and casual turns', async () => {
    const classify = vi.fn(async ({ message }: { message: string; state: MealAssistantState }) => {
      const normalized = normalize(message);

      if (normalized === 'what should i eat for lunch') {
        return {
          intent: 'recommendation_request',
          assistant_reply: 'A chicken bowl would work well.',
          contains_food_to_log: false,
          contains_quantity_update: false,
          target_item: null,
          should_mutate_pending_meal: false,
          assistant_reply_goal: 'Give a lunch recommendation only.',
          items: [],
          corrections: [],
          should_lookup_nutrition: false,
          should_save_meal: false,
          should_ask_clarification: false,
          clarification_question: null,
          confidence: 'high',
        } satisfies MealAssistantModelOutput;
      }

      if (normalized === 'lol not that') {
        return {
          intent: 'casual_message',
          assistant_reply: 'Fair enough.',
          contains_food_to_log: false,
          contains_quantity_update: false,
          target_item: null,
          should_mutate_pending_meal: false,
          assistant_reply_goal: 'Reply casually without changing the meal.',
          items: [],
          corrections: [],
          should_lookup_nutrition: false,
          should_save_meal: false,
          should_ask_clarification: false,
          clarification_question: null,
          confidence: 'high',
        } satisfies MealAssistantModelOutput;
      }

      return {
        intent: 'new_food_item',
        assistant_reply: 'Got it.',
        contains_food_to_log: true,
        contains_quantity_update: false,
        target_item: null,
        should_mutate_pending_meal: true,
        assistant_reply_goal: 'Log the added food.',
        items: [{ name: 'Greek yogurt', brand: null, quantity: 1, unit: 'cup', modifiers: [], action: 'add' }],
        corrections: [],
        should_lookup_nutrition: true,
        should_save_meal: false,
        should_ask_clarification: false,
        clarification_question: null,
        confidence: 'medium',
      } satisfies MealAssistantModelOutput;
    });

    const [recommendation, casual, added] = await runConversation(['what should I eat for lunch?', 'lol not that', 'add a greek yogurt too'], {
      classify,
      initialState: buildState({
        currentMealItems: [
          createItem({ food_name: 'Eggs', quantity: 3, unit: 'egg', calories: 210, protein: 18, fat: 15 }),
          createItem({ food_name: 'Toast', quantity: 2, unit: 'slice', calories: 200, protein: 8, carbs: 38, fat: 2 }),
        ],
        currentMealText: '3 Eggs, Toast',
      }),
    });

    expect(recommendation.meal.items.map((item) => item.food_name)).toEqual(['Eggs', 'Toast']);
    expect(casual.meal.items.map((item) => item.food_name)).toEqual(['Eggs', 'Toast']);
    expect(added.intent).toBe('add_to_current_meal');
    expect(added.meal.items.map((item) => item.food_name)).toEqual(['Eggs', 'Toast', 'Greek yogurt']);
    expect(added.assistant_reply).toMatch(/greek yogurt/i);
  });

  it('covers the core chatbot smoke flow without mutating meals on question and recommendation turns', async () => {
    const yesterdayMeal = {
      id: 'yesterday-chipotle',
      title: 'Chipotle bowl with white rice and double chicken',
      rawText: 'Chipotle bowl with white rice and double chicken',
      mealType: 'dinner' as const,
      totalCalories: 760,
      confidenceScore: 0.98,
      date: '2026-05-15T19:00:00.000Z',
      createdAt: '2026-05-15T19:00:00.000Z',
      lastUsedAt: '2026-05-15T19:00:00.000Z',
      items: [
        createItem({
          food_name: 'Chipotle Chicken Bowl',
          unit: 'bowl',
          calories: 760,
          protein: 58,
          carbs: 62,
          fat: 24,
          source_type: 'OFFICIAL_RESTAURANT',
          source_name: 'Chipotle official nutrition',
        }),
      ],
    };

    const saveMeal = vi.fn().mockResolvedValue(undefined);

    const [logged, question, corrected, recommendation, casual, added, saved, repeated] = await runConversation(
      [
        '2 eggs and 2 slices of toast',
        'how much protein is that?',
        'actually make that 3 eggs',
        'what should I eat for lunch?',
        'lol not that',
        'add a greek yogurt too',
        'save it',
        'same as yesterday',
      ],
      {
        context: buildContext({
          recentMeals: [yesterdayMeal],
        }),
        saveMeal,
      },
    );

    expect(logged.meal.items.map((item) => item.food_name.toLowerCase()).join(' ')).toMatch(/egg/);
    expect(logged.meal.items.map((item) => item.food_name.toLowerCase()).join(' ')).toMatch(/toast/);

    expect(question.meal.items).toEqual(logged.meal.items);
    expect(question.assistant_reply).toMatch(/protein/i);

    expect(corrected.meal.items.map((item) => `${item.food_name}:${item.quantity}`).join(' | ')).toMatch(/egg.*3/i);
    expect(corrected.meal.items.map((item) => item.food_name.toLowerCase()).join(' ')).toMatch(/toast/);

    expect(recommendation.meal.items).toEqual(corrected.meal.items);
    expect(recommendation.assistant_reply).not.toMatch(/frozen dinner|i can log/i);

    expect(casual.meal.items).toEqual(corrected.meal.items);
    expect(casual.assistant_reply).not.toMatch(/i can log lol not that/i);

    expect(added.meal.items.map((item) => item.food_name.toLowerCase()).join(' ')).toMatch(/greek yogurt/);
    expect(added.meal.items.map((item) => item.food_name.toLowerCase()).join(' ')).toMatch(/toast/);

    expect(saved.next_state.saved).toBe(true);
    expect(saved.assistant_reply).toMatch(/saved|ready for the next one/i);

    expect(repeated.meal.items.map((item) => item.food_name.toLowerCase()).join(' ')).toMatch(/chipotle chicken bowl/);
    expect(repeated.assistant_reply).toMatch(/yesterday|loaded|using|pulled/i);
  });

  it('handles casual and descriptive follow-ups without dropping the active meal', async () => {
    const currentMeal = createItem({ food_name: 'Burger', unit: 'burger', calories: 500, protein: 28, carbs: 38, fat: 24 });

    const [sizeReply, healthyReply, laughReply] = await runConversation(['that burger was huge', 'that meal was actually pretty healthy', 'lol'], {
      initialState: buildState({
        currentMealItems: [currentMeal],
        currentMealText: 'Burger',
      }),
      context: buildContext({
        remainingProtein: 40,
        remainingCalories: 700,
      }),
    });

    expect(sizeReply.meal.items[0]?.calories).toBeGreaterThan(500);
    expect(sizeReply.assistant_reply).toMatch(/lean bigger|bumped|larger serving/i);
    expect(healthyReply.meal.items[0]?.food_name).toBe('Burger');
    expect(healthyReply.assistant_reply).toMatch(/balanced|protein/i);
    expect(laughReply.meal.items[0]?.food_name).toBe('Burger');
    expect(laughReply.assistant_reply).toMatch(/😂|what else did you eat/i);
  });

  it('updates quantity in place for a correction instead of starting a new item', async () => {
    const classify = vi.fn(async ({ message }: { message: string; state: MealAssistantState }) => {
      const normalized = normalize(message);

      if (normalized === '2 rice cakes') {
        return {
          intent: 'new_food_item',
          assistant_reply: 'Got it.',
          items: [{ name: 'rice cakes', brand: null, quantity: 2, unit: 'cake', modifiers: [], action: 'add' }],
          corrections: [],
          should_lookup_nutrition: true,
          should_save_meal: false,
          should_ask_clarification: false,
          clarification_question: null,
          confidence: 'high',
        } satisfies MealAssistantModelOutput;
      }

      if (normalized === 'actually 3') {
        return {
          intent: 'quantity_change',
          assistant_reply: 'Updated.',
          items: [{ name: 'Rice Cakes', brand: null, quantity: 3, unit: 'cake', modifiers: [], action: 'update' }],
          corrections: [{ target: 'Rice Cakes', change: message }],
          should_lookup_nutrition: false,
          should_save_meal: false,
          should_ask_clarification: false,
          clarification_question: null,
          confidence: 'high',
        } satisfies MealAssistantModelOutput;
      }

      throw new Error(`Unexpected prompt in quantity correction test: ${message}`);
    });

    const responses = await runConversation(['2 rice cakes', 'actually 3'], { classify });
    const finalResponse = responses.at(-1);

    expect(finalResponse?.meal.items).toHaveLength(1);
    expect(finalResponse?.meal.items[0]?.food_name).toMatch(/rice cakes/i);
    expect(finalResponse?.meal.items[0]?.quantity).toBe(3);
    expect(finalResponse?.assistant_reply).toMatch(/updated that to 3/i);
  });

  it('handles semantic correction prompts without ignoring the current meal', async () => {
    const classify = vi.fn(async ({ message, state }: { message: string; state: MealAssistantState }) => {
      const normalized = normalize(message);

      if (normalized === 'not rice rice cakes') {
        return {
          intent: 'correction',
          assistant_reply: 'Got it.',
          items: [{ name: 'rice cakes', brand: 'Quaker', quantity: 2, unit: 'cake', modifiers: ['white cheddar'], action: 'replace' }],
          corrections: [{ target: state.currentMealItems[0]?.food_name ?? 'Rice', change: message }],
          should_lookup_nutrition: true,
          should_save_meal: false,
          should_ask_clarification: false,
          clarification_question: null,
          confidence: 'high',
        } satisfies MealAssistantModelOutput;
      }

      if (normalized === 'medium not large') {
        return {
          intent: 'correction',
          assistant_reply: 'Got it.',
          items: [{ name: 'medium fry', brand: "McDonald's", quantity: 1, unit: 'order', modifiers: [], action: 'replace' }],
          corrections: [{ target: state.currentMealItems[0]?.food_name ?? 'Large Fry', change: message }],
          should_lookup_nutrition: true,
          should_save_meal: false,
          should_ask_clarification: false,
          clarification_question: null,
          confidence: 'high',
        } satisfies MealAssistantModelOutput;
      }

      if (normalized === 'grilled not fried') {
        return {
          intent: 'correction',
          assistant_reply: 'Got it.',
          items: [{ name: 'grilled chicken sandwich', brand: null, quantity: 1, unit: 'sandwich', modifiers: [], action: 'replace' }],
          corrections: [{ target: state.currentMealItems[0]?.food_name ?? 'Fried Chicken Sandwich', change: message }],
          should_lookup_nutrition: true,
          should_save_meal: false,
          should_ask_clarification: false,
          clarification_question: null,
          confidence: 'high',
        } satisfies MealAssistantModelOutput;
      }

      throw new Error(`Unexpected prompt in custom correction test: ${message}`);
    });

    const riceResponses = await runConversation(['not rice, rice cakes'], {
      classify,
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Rice', unit: 'cup', calories: 200, protein: 4, carbs: 45, fat: 0, source_name: 'USDA reference' })],
        currentMealText: 'Rice',
      }),
    });
    expect(riceResponses.at(-1)?.meal.items[0]?.food_name).toMatch(/rice cakes/i);

    const sizeResponses = await runConversation(['medium not large'], {
      classify,
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Large Fry', unit: 'order', calories: 480, protein: 6, carbs: 66, fat: 23, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" })],
        currentMealText: 'Large Fry',
      }),
    });
    expect(sizeResponses.at(-1)?.meal.items[0]?.food_name).toBe('Medium Fry');

    const styleResponses = await runConversation(['grilled not fried'], {
      classify,
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Fried Chicken Sandwich', unit: 'sandwich', calories: 490, protein: 26, carbs: 46, fat: 21, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Restaurant nutrition' })],
        currentMealText: 'Fried Chicken Sandwich',
      }),
    });
    expect(styleResponses.at(-1)?.meal.items[0]?.food_name).toBe('Grilled Chicken Sandwich');
  });

  it.each(['Quaker rice cakes', 'McDouble', 'Fairlife shake', 'Daisy cottage cheese'])(
    'does not ask clarification for clear branded/common foods: %s',
    async (prompt) => {
      const [response] = await runConversation([prompt]);

      expect(response.should_ask_clarification).toBe(false);
      expect(response.clarification_question).toBeNull();
      expect(response.assistant_reply).not.toMatch(/\?/);
      expectNoBadAssistantPatterns(response.assistant_reply);
    },
  );

  it.each([
    ['burger', 'Which kind of burger?'],
    ['pasta', 'What kind of pasta?'],
    ['bowl', 'What kind of bowl?'],
  ])('allows a single short clarification for ambiguous foods: %s', async (prompt, question) => {
    const classify = vi.fn().mockResolvedValue({
      intent: 'unknown',
      assistant_reply: question,
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: true,
      clarification_question: question,
      confidence: 'medium',
    } satisfies MealAssistantModelOutput);

    const [response] = await runConversation([prompt], { classify });

    expect(response.clarification_question).toBe(question);
    expect(response.assistant_reply).toBe(question);
    expect(question.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  it.each(['save it', 'log it', 'done'])('confirms save commands briefly without resetting into a greeting: %s', async (prompt) => {
    const saveMeal = vi.fn().mockResolvedValue(undefined);
    const [response] = await runConversation([prompt], {
      saveMeal,
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 })],
        currentMealText: '2 Eggs',
      }),
    });

    expect(saveMeal).toHaveBeenCalledTimes(1);
    expect(response.assistant_reply).toMatch(/saved|logged|that one is in/i);
    expect(response.assistant_reply).not.toMatch(/hey|what did you eat|what'd you eat/i);
    expect(response.next_state.saved).toBe(true);
  });

  it('keeps joke requests light and still anchored to the meal flow', async () => {
    const [response] = await runConversation(['tell me a joke'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 })],
        currentMealText: '2 Eggs',
      }),
    });

    expect(response.assistant_reply).toMatch(/joke|meal|calories|stand-up|keep going/i);
    expect(response.meal.items[0]?.food_name).toBe('Eggs');
  });

  it('softens correction replies when the user sounds frustrated', async () => {
    const [response] = await runConversation(['ugh i meant 2 eggs'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 3, unit: 'egg', calories: 210, protein: 18, fat: 15 })],
        currentMealText: '3 Eggs',
      }),
    });

    expect(response.assistant_reply).toMatch(/no worries|all good|corrected|fixed|cleaned that up/i);
    expect(response.meal.items[0]?.quantity).toBe(2);
  });

  it('treats oh-i-meant quantity follow-ups as corrections instead of new food lookups', async () => {
    const [response] = await runConversation(['Oh i meant 5'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 4, unit: 'egg', calories: 280, protein: 24, fat: 20 })],
        currentMealText: '4 Eggs',
        previousIntent: 'repeat_meal',
        previousUserMessage: 'same 4 large egg',
        lastAssistantReply: "I've got your usual 4 Large egg.",
      }),
    });

    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toBe('Eggs');
    expect(response.meal.items[0]?.quantity).toBe(5);
    expect(response.assistant_reply).toMatch(/5/i);
    expect(response.assistant_reply).not.toMatch(/candies|chocolate|usda|match|reference/i);
  });

  it('uses a plain numeric follow-up to update the active egg item after a recall', async () => {
    const [response] = await runConversation(['5'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 4, unit: 'egg', calories: 280, protein: 24, fat: 20 })],
        currentMealText: '4 Eggs',
        previousIntent: 'repeat_meal',
        previousUserMessage: 'same 4 large egg',
        lastAssistantReply: '4 large eggs, about 280 calories and 24g protein.',
      }),
    });

    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items[0]?.food_name).toBe('Eggs');
    expect(response.meal.items[0]?.quantity).toBe(5);
    expect(response.assistant_reply).toMatch(/5/i);
  });

  it('updates mcdouble quantity for actually-2 corrections without creating a new food', async () => {
    const [response] = await runConversation(['actually 2'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'McDouble', quantity: 1, unit: 'burger', calories: 390, protein: 22, carbs: 33, fat: 19, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" })],
        currentMealText: 'McDouble',
        lastAssistantReply: 'I added the McDouble.',
      }),
    });

    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items[0]?.food_name).toBe('McDouble');
    expect(response.meal.items[0]?.quantity).toBe(2);
    expect(response.assistant_reply).not.toMatch(/chocolate|candy|usda|match|reference/i);
  });

  it('updates fairlife shake quantity for make-it-3 corrections without lookup drift', async () => {
    const [response] = await runConversation(['make it 3'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Fairlife Chocolate Protein Shake', quantity: 1, unit: 'bottle', calories: 150, protein: 30, carbs: 4, fat: 2, source_name: 'Fairlife nutrition reference' })],
        currentMealText: 'Fairlife Chocolate Protein Shake',
        lastAssistantReply: 'I added the Fairlife shake.',
      }),
    });

    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items[0]?.food_name).toBe('Fairlife Chocolate Protein Shake');
    expect(response.meal.items[0]?.quantity).toBe(3);
    expect(response.assistant_reply).toMatch(/3/i);
    expect(response.assistant_reply).not.toMatch(/usda|match|reference/i);
  });

  it('treats a bare number as the quantity answer after an assistant quantity question', async () => {
    const [response] = await runConversation(['2'], {
      initialState: buildState({
        pendingClarification: 'For Little Caesars, was that one slice, a few slices, or a whole pizza?',
        lastAssistantQuestion: 'For Little Caesars, was that one slice, a few slices, or a whole pizza?',
        previousUserMessage: 'Little Caesars pizza',
        lastAssistantReply: 'For Little Caesars, was that one slice, a few slices, or a whole pizza?',
      }),
    });

    expect(response.should_ask_clarification).toBe(false);
    expect(response.meal.items[0]?.food_name).toMatch(/pizza/i);
    expect(response.meal.items[0]?.quantity).toBe(2);
  });

  it('blocks unrelated lookup items on correction turns and updates the active food instead', async () => {
    const resolveItemNutrition = vi.fn(async () => {
      throw new Error('lookup should not run for quantity corrections');
    });
    const classify = vi.fn().mockResolvedValue({
      intent: 'new_food_item',
      action: 'add_food',
      assistant_reply: 'I found a USDA match for dark chocolate candy.',
      contains_food_to_log: true,
      contains_quantity_update: false,
      target_item: null,
      target_item_id: null,
      target_item_index: null,
      should_mutate_pending_meal: true,
      assistant_reply_goal: 'Explain the new food lookup',
      items: [{ name: 'Dark chocolate candy', brand: null, quantity: 1, unit: 'serving', modifiers: [], action: 'add' }],
      corrections: [],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'low',
    } satisfies MealAssistantModelOutput);

    const [response] = await runConversation(['Oh i meant 5'], {
      classify,
      resolveItemNutrition: resolveItemNutrition as typeof resolveConversationNutrition,
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 4, unit: 'egg', calories: 280, protein: 24, fat: 20 })],
        currentMealText: '4 Eggs',
        previousIntent: 'repeat_meal',
        previousUserMessage: 'same 4 large egg',
        lastAssistantReply: '4 large eggs, about 280 calories and 24g protein.',
      }),
    });

    expect(classify).toHaveBeenCalledTimes(1);
    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toBe('Eggs');
    expect(response.meal.items[0]?.quantity).toBe(5);
    expect(response.assistant_reply).not.toMatch(/dark chocolate|candy|usda/i);
  });

  it('updates canned beans quantity without adding source-label chatter', async () => {
    const [response] = await runConversation(['actually two cans'], {
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Beans', quantity: 1, unit: 'can', calories: 120, protein: 7, carbs: 20, fat: 0.5 })],
        currentMealText: 'Beans',
        lastAssistantReply: 'I added a can of beans.',
      }),
    });

    expect(response.intent).toBe('quantity_change');
    expect(response.meal.items[0]?.food_name).toBe('Beans');
    expect(response.meal.items[0]?.quantity).toBe(2);
    expect(response.assistant_reply).not.toMatch(/usda|match|reference/i);
  });

  it('handles the exact can-of-beans correction flow from scratch', async () => {
    const responses = await runConversation(['I had a can of beans', 'actually two cans']);
    const first = responses[0];
    const second = responses[1];

    expect(first?.meal.items[0]?.food_name).toBe('Beans');
    expect(first?.meal.items[0]?.quantity).toBe(1);
    expect(second?.intent).toBe('quantity_change');
    expect(second?.meal.items[0]?.food_name).toBe('Beans');
    expect(second?.meal.items[0]?.quantity).toBe(2);
    expect(second?.assistant_reply).not.toMatch(/usda|match|reference/i);
  });

  it('handles a generic chipotle bowl and remove-cheese follow-up without restarting the meal', async () => {
    const responses = await runConversation(['Chipotle bowl', 'remove cheese']);
    const first = responses[0];
    const second = responses[1];
    const names = second?.meal.items.map((item) => item.food_name.toLowerCase()).join(' | ') ?? '';

    expect(first?.meal.items[0]?.food_name).toMatch(/chipotle bowl/i);
    expect(second?.intent).toBe('correction');
    expect(names).toContain('chipotle bowl');
    expect(names).not.toContain('cheese');
    expect(second?.assistant_reply).not.toMatch(/starting fresh|new meal|usda|match|reference/i);
  });

  it.each(['how’s your day', "how's your day", 'tell me a joke'])('politely redirects off-topic prompts without breaking meal state: %s', async (prompt) => {
    const currentMeal = createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 });
    const [response] = await runConversation([prompt], {
      initialState: buildState({
        currentMealItems: [currentMeal],
        currentMealText: '2 Eggs',
      }),
    });

    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toBe('Eggs');
    expect(response.assistant_reply).toMatch(/keep working on this meal|send the next food|help log meals|still holding this meal|keep going|keep building it/i);
    expect(response.next_state.currentMealText).toContain('Eggs');
  });

  it('prevents repeated clarifications and other trust-breaking assistant behavior', async () => {
    const repeatedQuestion = 'What kind of bowl?';
    const classify = vi
      .fn()
      .mockResolvedValueOnce({
        intent: 'unknown',
        assistant_reply: repeatedQuestion,
        items: [],
        corrections: [],
        should_lookup_nutrition: false,
        should_save_meal: false,
        should_ask_clarification: true,
        clarification_question: repeatedQuestion,
        confidence: 'medium',
      } satisfies MealAssistantModelOutput)
      .mockResolvedValueOnce({
        intent: 'clarification_answer',
        assistant_reply: repeatedQuestion,
        items: [],
        corrections: [],
        should_lookup_nutrition: false,
        should_save_meal: false,
        should_ask_clarification: true,
        clarification_question: repeatedQuestion,
        confidence: 'medium',
      } satisfies MealAssistantModelOutput);

    const responses = await runConversation(['bowl', 'bowl'], { classify });
    const first = responses[0];
    const second = responses[1];

    expect(first?.assistant_reply).toBe(repeatedQuestion);
    expect(second?.assistant_reply).toBe("Got it, I'm checking that again.");
    expect(second?.assistant_reply).not.toBe(repeatedQuestion);
    expect(second?.assistant_reply).not.toMatch(/i'?m with you/i);
    expect(second?.assistant_reply).not.toMatch(/barcode/i);
  });

  it('treats dinner advice as a recommendation, not a food lookup', async () => {
    const classify = vi.fn().mockResolvedValue({
      intent: 'new_food_item',
      assistant_reply: 'Got it.',
      items: [{ name: 'high protein nutritional powder mix', brand: null, quantity: 1, unit: 'serving', modifiers: [], action: 'add' }],
      corrections: [],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
    } satisfies MealAssistantModelOutput);
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);

    const [response] = await runConversation(['what should I eat tonight?'], {
      classify,
      resolveItemNutrition,
      context: buildContext({ remainingCalories: 420, remainingProtein: 68, todayCarbs: 220 }),
    });

    expect(classify).toHaveBeenCalledTimes(1);
    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.intent).toBe('recommendation_request');
    expect(response.meal.items).toHaveLength(0);
    expect(response.assistant_reply).toMatch(/protein|chicken|burrito bowl|dinner|tonight/i);
    expect(response.assistant_reply).not.toMatch(/powder|pizza|logged|calories total/i);
  });

  it('edits the active Chipotle bowl instead of logging the correction sentence', async () => {
    const currentBowl = createItem({
      food_name: 'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
      unit: 'bowl',
      calories: 780,
      protein: 73,
      carbs: 62,
      fat: 28,
      fiber: 5,
      sodium: 1715,
      source_type: 'AI_ESTIMATE',
      source_name: 'Chipotle component fallback estimate',
    });

    const [response] = await runConversation(['Actually make that regular chicken instead of double, and add chips with guac too.'], {
      initialState: buildState({
        currentMealItems: [currentBowl],
        currentMealText: currentBowl.food_name,
      }),
    });

    const names = response.meal.items.map((item) => item.food_name.toLowerCase()).join(' | ');
    expect(response.intent).toBe('correction');
    expect(response.meal.items).toHaveLength(2);
    expect(names).toContain('chipotle bowl');
    expect(names).not.toContain('actually make');
    expect(names).not.toContain('double chicken');
    expect(names).toContain('chips with guacamole');
    expect(response.assistant_reply).toMatch(/regular chicken|chips with guac/i);
    expect(response.assistant_reply).not.toMatch(/usda|match|reference/i);
  });

  it('keeps Wendy sandwich and fries as separate represented foods', async () => {
    const [response] = await runConversation(["Wendy's spicy chicken sandwich and medium fries"]);
    const names = response.meal.items.map((item) => item.food_name.toLowerCase());

    expect(response.should_ask_clarification).toBe(false);
    expect(names.some((name) => name.includes('spicy chicken sandwich'))).toBe(true);
    expect(names.some((name) => name.includes('fries'))).toBe(true);
    expect(response.assistant_reply).toMatch(/spicy chicken sandwich|fries/i);
  });

  it('preserves broad breakfast messages instead of only extracting eggs and toast', async () => {
    const [response] = await runConversation(['breakfast was 2 eggs, toast, bacon, hash browns, and orange juice']);
    const names = response.meal.items.map((item) => item.food_name.toLowerCase()).join(' ');

    expect(names).toContain('eggs');
    expect(names).toContain('toast');
    expect(names).toContain('bacon');
    expect(names).toContain('hash browns');
    expect(names).toContain('orange juice');
    expect(response.meal.items.length).toBeGreaterThanOrEqual(5);
    expect(response.assistant_reply).not.toMatch(/estimated mixed meal|need a little more detail/i);
  });

  it('keeps rice cakes as countable cakes while preserving toppings and fruit', async () => {
    const [response] = await runConversation(['2 rice cakes with peanut butter and blueberries']);
    const names = response.meal.items.map((item) => item.food_name.toLowerCase()).join(' ');
    const riceCake = response.meal.items.find((item) => /rice cakes?/i.test(item.food_name));

    expect(names).toContain('rice cakes');
    expect(names).toContain('peanut butter');
    expect(names).toContain('blueberries');
    expect(riceCake?.quantity).toBe(2);
    expect(riceCake?.unit).toMatch(/cakes?/i);
    expect(riceCake?.unit).not.toBe('g');
  });

  it('drops raw conversational correction items before nutrition lookup', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);
    const classify = vi.fn().mockResolvedValue({
      intent: 'correction',
      assistant_reply: 'Got it.',
      items: [{ name: 'actually change that instead', brand: null, quantity: 1, unit: null, modifiers: [], action: 'replace' }],
      corrections: [{ target: 'Eggs', change: 'Actually change that instead' }],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'low',
    } satisfies MealAssistantModelOutput);

    const [response] = await runConversation(['Actually change that instead'], {
      classify,
      resolveItemNutrition,
      initialState: buildState({
        currentMealItems: [createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 })],
        currentMealText: '2 Eggs',
      }),
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.meal.items[0]?.food_name).toBe('Eggs');
    expect(response.assistant_reply).not.toMatch(/actually change that instead|estimated mixed meal/i);
  });

  it('requested regression: preserves a full Chipotle bowl plus Coke Zero', async () => {
    const [response] = await runConversation(['I just had a Chipotle bowl with white rice, black beans, double chicken, corn salsa, cheese, lettuce, and green salsa plus a Coke Zero.']);
    const names = response.meal.items.map((item) => item.food_name.toLowerCase()).join(' ');

    expect(response.should_ask_clarification).toBe(false);
    expect(names).toContain('chipotle bowl');
    expect(names).toContain('white rice');
    expect(names).toContain('black beans');
    expect(names).toContain('double chicken');
    expect(names).toContain('corn salsa');
    expect(names).toContain('cheese');
    expect(names).toContain('lettuce');
    expect(names).toContain('green salsa');
    expect(names).toContain('coke zero');
    expect(response.assistant_reply).not.toMatch(/estimated mixed meal|chipotle white rice/i);
  });

  it('requested regression: handles breakfast details and Fairlife Core Power Elite', async () => {
    const [response] = await runConversation(['Breakfast was 3 scrambled eggs, turkey sausage, buttered toast, and a protein shake. The shake was Fairlife Core Power Elite.']);
    const names = response.meal.items.map((item) => item.food_name.toLowerCase()).join(' ');

    expect(names).toContain('scrambled eggs');
    expect(names).toContain('turkey sausage');
    expect(names).toContain('buttered toast');
    expect(names).toContain('fairlife core power elite');
    expect(response.meal.items.length).toBeGreaterThanOrEqual(4);
    expect(response.assistant_reply).toMatch(/scrambled eggs|turkey sausage|fairlife|shake/i);
    expect(response.assistant_reply).not.toMatch(/estimated mixed meal|need a little more detail/i);
  });

  it('requested regression: keeps rice cakes, toppings, fruit, Wendy sandwich, and fries', async () => {
    const [response] = await runConversation(["I had two rice cakes with peanut butter and blueberries before the gym, then later a spicy chicken sandwich and medium fries from Wendy's."]);
    const names = response.meal.items.map((item) => item.food_name.toLowerCase()).join(' ');

    expect(names).toContain('rice cakes');
    expect(names).toContain('peanut butter');
    expect(names).toContain('blueberries');
    expect(names).toContain('spicy chicken sandwich');
    expect(names).toContain('fries');
    expect(response.meal.items.length).toBeGreaterThanOrEqual(5);
    expect(response.assistant_reply).not.toMatch(/estimated mixed meal|need a little more detail/i);
  });

  it('requested regression: advice based on today never becomes a food entity', async () => {
    const resolveItemNutrition = vi.fn(resolveConversationNutrition);
    const [response] = await runConversation(["I'm trying to cut weight but still hit high protein. Based on what I logged today, what should I eat tonight?"], {
      resolveItemNutrition,
      context: buildContext({
        remainingCalories: 520,
        remainingProtein: 72,
        todayCalories: 1880,
        todayProtein: 108,
        todayCarbs: 210,
      }),
    });

    expect(resolveItemNutrition).not.toHaveBeenCalled();
    expect(response.intent).toBe('recommendation_request');
    expect(response.meal.items).toHaveLength(0);
    expect(response.assistant_reply).toMatch(/protein|grilled chicken|burrito bowl|tonight|dinner/i);
    expect(response.assistant_reply).not.toMatch(/trying to cut weight|food item|estimated mixed meal/i);
  });

  it('handles compound chipotle edit turns naturally', async () => {
    const [response] = await runConversation(['make it regular chicken and remove cheese'], {
      initialState: buildState({
        currentMealItems: [createItem({
          food_name: 'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
          quantity: 1,
          unit: 'bowl',
          calories: 980,
          protein: 68,
          carbs: 74,
          fat: 34,
          fiber: 10,
          sodium: 1760,
          source_type: 'OFFICIAL_RESTAURANT',
          source_name: 'Chipotle official nutrition',
        })],
        currentMealText: '1 Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
      }),
    });

    expect(response.intent).toBe('correction');
    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toMatch(/chipotle bowl/i);
    expect(response.meal.items[0]?.food_name).not.toMatch(/double chicken/i);
    expect(response.meal.items[0]?.food_name).not.toMatch(/\bcheese\b/i);
    expect(response.meal.totals.calories).toBeLessThan(980);
    expect(response.assistant_reply).toMatch(/regular chicken|cheese/i);
    expect(response.assistant_reply).not.toMatch(/usda|need a little more detail/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it('handles compound remove and quantity edits for active restaurant meals', async () => {
    const [response] = await runConversation(['remove fries and make it two burgers'], {
      initialState: buildState({
        currentMealItems: [
          createItem({ food_name: 'McDouble', quantity: 1, unit: 'burger', calories: 390, protein: 22, carbs: 33, fat: 19, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
          createItem({ food_name: 'Medium Fry', quantity: 1, unit: 'order', calories: 340, protein: 4, carbs: 44, fat: 16, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
        ],
        currentMealText: '1 McDouble, 1 Medium Fry',
      }),
    });

    expect(response.intent).toBe('correction');
    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toMatch(/mcdouble/i);
    expect(response.meal.items[0]?.quantity).toBe(2);
    expect(response.meal.totals.calories).toBe(780);
    expect(response.assistant_reply).toMatch(/fries|burger|mcdouble/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it('handles compound quantity and add edits for simple meals', async () => {
    const [response] = await runConversation(['make it 3 eggs and add bacon'], {
      initialState: buildState({
        currentMealItems: [
          createItem({ food_name: 'Eggs', quantity: 2, unit: 'egg', calories: 140, protein: 12, fat: 10 }),
          createItem({ food_name: 'Toast', quantity: 1, unit: 'slice', calories: 100, protein: 4, carbs: 19, fat: 1 }),
        ],
        currentMealText: '2 Eggs, 1 slice Toast',
      }),
    });

    expect(response.intent).toBe('correction');
    expect(response.meal.items.some((item) => /eggs?/i.test(item.food_name) && item.quantity === 3)).toBe(true);
    expect(response.meal.items.some((item) => /toast/i.test(item.food_name))).toBe(true);
    expect(response.meal.items.some((item) => /bacon/i.test(item.food_name))).toBe(true);
    expect(response.meal.totals.calories).toBeGreaterThan(240);
    expect(response.assistant_reply).toMatch(/3|bacon|eggs?/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });

  it('handles compound quantity and save turns in one reply', async () => {
    const saveMeal = vi.fn().mockResolvedValue(undefined);
    const [response] = await runConversation(['make it two and save it'], {
      saveMeal,
      initialState: buildState({
        currentMealItems: [createItem({
          food_name: 'Fairlife Core Power Elite 42g Protein Shake',
          quantity: 1,
          unit: 'bottle',
          calories: 230,
          protein: 42,
          carbs: 8,
          fat: 3.5,
          source_type: 'GENERIC_REFERENCE',
          source_name: 'Fairlife nutrition reference',
        })],
        currentMealText: '1 bottle Fairlife Core Power Elite 42g Protein Shake',
        mealType: 'snack',
      }),
    });

    expect(saveMeal).toHaveBeenCalledTimes(1);
    expect(response.meal.items).toHaveLength(1);
    expect(response.meal.items[0]?.food_name).toMatch(/fairlife/i);
    expect(response.meal.items[0]?.quantity).toBe(2);
    expect(response.meal.totals.calories).toBe(460);
    expect(response.next_state.saved).toBe(true);
    expect(response.assistant_reply).toMatch(/saved|logged|all set/i);
    expectNoBadAssistantPatterns(response.assistant_reply);
  });
});

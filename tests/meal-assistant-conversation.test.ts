import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
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
      createItem({ food_name: 'Peanut Butter', unit: 'tbsp', calories: 95, protein: 4, carbs: 3, fat: 8, fiber: 1, sugar: 1 }),
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
      createItem({ food_name: 'Rice', unit: 'cup', calories: 200, protein: 4, carbs: 45, fat: 0, source_name: 'USDA reference' }),
    ], args.mealType);
  }

  return buildParsedMealResponse([
    createItem({ food_name: args.item.name, quantity, unit: 'serving', calories: 200, protein: 10, carbs: 20, fat: 8, source_type: 'AI_ESTIMATE', source_name: 'Estimated reference', notes: 'Estimated fallback.' }),
  ], args.mealType);
}

async function runConversation(
  messages: string[],
  options?: {
    initialState?: MealAssistantState;
    classify?: (args: { message: string; state: MealAssistantState }) => Promise<MealAssistantModelOutput>;
    saveMeal?: ReturnType<typeof vi.fn>;
  },
) {
  let state = options?.initialState ?? buildState();
  const responses = [] as Awaited<ReturnType<typeof runMealAssistant>>[];

  for (const message of messages) {
    const response = await runMealAssistant(
      { message, state },
      {
        classify: options?.classify,
        resolveItemNutrition: resolveConversationNutrition,
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
  expect(reply).not.toMatch(/butter|oil/i);
  expect(reply).not.toMatch(/barcode/i);
  expect(reply).not.toMatch(/i'?m with you/i);
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
    ['2 eggs, toast, bacon, and orange juice', 4],
    ['McDouble and a medium fry', 2],
    ['Chipotle bowl with white rice, double chicken, corn salsa, cheese, and lettuce', 1],
  ])('handles realistic multi-item meal prompts: %s', async (prompt, expectedItemCount) => {
    const [response] = await runConversation([prompt]);

    expect(response.meal.items).toHaveLength(expectedItemCount);
    expect(response.assistant_reply).toMatch(/got it/i);
    expect(response.assistant_reply.length).toBeLessThan(140);
  });

  it('keeps adding to the same active meal across continuation turns', async () => {
    const responses = await runConversation(['2 eggs', 'and toast', 'plus bacon']);
    const finalResponse = responses.at(-1);

    expect(finalResponse?.meal.items).toHaveLength(3);
    expect(finalResponse?.meal.items.map((item) => item.food_name)).toEqual(['Eggs', 'Toast', 'Bacon']);
    expect(finalResponse?.next_state.currentMealText).toContain('Eggs');
    expect(finalResponse?.next_state.currentMealText).toContain('Toast');
    expect(finalResponse?.next_state.currentMealText).toContain('Bacon');
    expect(finalResponse?.assistant_reply).toMatch(/added bacon/i);
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
    expect(response.assistant_reply).toBe('Saved. Anything else?');
    expect(response.assistant_reply).not.toMatch(/hey|what did you eat|what'd you eat/i);
    expect(response.next_state.saved).toBe(true);
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
    expect(response.assistant_reply).toMatch(/keep working on this meal|send the next food|help log meals/i);
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
    expect(second?.assistant_reply).toBe('Got it, I’m checking that again.');
    expect(second?.assistant_reply).not.toBe(repeatedQuestion);
    expect(second?.assistant_reply).not.toMatch(/i'?m with you/i);
    expect(second?.assistant_reply).not.toMatch(/barcode/i);
  });
});

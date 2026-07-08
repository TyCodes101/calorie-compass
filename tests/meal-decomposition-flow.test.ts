import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MealAssistantItem, MealAssistantModelOutput, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

function buildState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingMeal: null,
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'dinner',
    userName: 'Tyler Cox',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function qaItem(name: string, overrides?: Partial<ParsedFoodItem>): ParsedFoodItem {
  const sourceType = overrides?.source_type ?? 'GENERIC_REFERENCE';
  return {
    food_name: name,
    quantity: overrides?.quantity ?? 1,
    unit: overrides?.unit ?? 'serving',
    calories: overrides?.calories ?? 100,
    protein: overrides?.protein ?? 5,
    carbs: overrides?.carbs ?? 10,
    fat: overrides?.fat ?? 3,
    fiber: overrides?.fiber ?? 0,
    sugar: overrides?.sugar ?? 0,
    sodium: overrides?.sodium ?? 0,
    notes: overrides?.notes ?? 'QA nutrition reference.',
    is_trusted: sourceType !== 'AI_ESTIMATE',
    source_type: sourceType,
    source_name: overrides?.source_name ?? 'QA nutrition reference',
    confidence_label: sourceType === 'AI_ESTIMATE' ? 'Estimated' : sourceType === 'OFFICIAL_RESTAURANT' ? 'Verified' : 'Matched',
    matched_query: overrides?.matched_query ?? null,
    original_user_text: overrides?.original_user_text ?? null,
    provider_used: sourceType === 'AI_ESTIMATE' ? null : 'qa-resolver',
    used_ai_fallback: sourceType === 'AI_ESTIMATE',
    catalog_food_id: null,
    ...overrides,
  };
}

function meal(items: ParsedFoodItem[], mealType: MealAssistantState['mealType']): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: items.some((item) => item.source_type === 'AI_ESTIMATE') ? 0.72 : 0.94,
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

function strictComponentResolver() {
  return vi.fn(async ({ item, mealType }: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }) => {
    const phrase = normalize([item.brand ?? '', ...item.modifiers, item.name, item.unit ?? ''].filter(Boolean).join(' '));
    const one = (parsedItem: ParsedFoodItem) => meal([parsedItem], mealType);

    if (/orange chicken/.test(phrase) && !/beijing|chow/.test(phrase)) return one(qaItem('Panda Express Orange Chicken', { unit: 'serving', calories: 490, source_type: 'OFFICIAL_RESTAURANT' }));
    if (/beijing beef/.test(phrase) && !/orange|chow/.test(phrase)) return one(qaItem('Panda Express Beijing Beef', { unit: 'serving', calories: 470, source_type: 'OFFICIAL_RESTAURANT' }));
    if (/chow mein/.test(phrase) && !/orange|beijing/.test(phrase)) return one(qaItem('Panda Express Chow Mein', { unit: 'side', calories: 510, source_type: 'OFFICIAL_RESTAURANT' }));
    if (/grilled chicken breast/.test(phrase) && !/asparagus/.test(phrase)) return one(qaItem('Grilled chicken breast', { quantity: item.quantity, unit: item.unit ?? 'breast', calories: 280 }));
    if (/asparagus/.test(phrase) && !/chicken/.test(phrase)) return one(qaItem('Asparagus', { unit: item.unit ?? 'serving', calories: 40 }));
    if (/sirloin steak/.test(phrase) && !/potato|sour cream|chives/.test(phrase)) return one(qaItem('Sirloin steak', { quantity: item.quantity, unit: item.unit ?? 'oz', calories: 430 }));
    if (/baked potato/.test(phrase) && !/sirloin|sour cream|chives/.test(phrase)) return one(qaItem('Baked potato', { unit: 'potato', calories: 270 }));
    if (/sour cream/.test(phrase) && !/sirloin|potato|chives/.test(phrase)) return one(qaItem('Sour cream', { unit: 'tbsp', calories: 60 }));
    if (/chives/.test(phrase) && !/sirloin|potato|sour cream/.test(phrase)) return one(qaItem('Chives', { unit: 'serving', calories: 1 }));
    if (/scrambled eggs/.test(phrase) && !/egg whites|butter|toast|jam/.test(phrase)) return one(qaItem('Scrambled eggs', { quantity: item.quantity, unit: item.unit ?? 'egg', calories: 210 }));
    if (/butter/.test(phrase) && !/eggs|toast|jam/.test(phrase)) return one(qaItem('Butter', { unit: 'tbsp', calories: 100 }));
    if (/sourdough toast/.test(phrase) && !/eggs|butter|jam/.test(phrase)) return one(qaItem('Sourdough toast', { unit: 'slice', calories: 120 }));
    if (/strawberry jam/.test(phrase) && !/eggs|butter|toast/.test(phrase)) return one(qaItem('Strawberry jam', { unit: 'tbsp', calories: 50 }));
    if (/greek yogurt/.test(phrase) && !/blueberries|granola|honey/.test(phrase)) return one(qaItem('Greek yogurt', { unit: 'cup', calories: 140 }));
    if (/blueberries/.test(phrase) && !/yogurt|granola|honey/.test(phrase)) return one(qaItem('Blueberries', { unit: 'serving', calories: 85 }));
    if (/granola/.test(phrase) && !/yogurt|blueberries|honey/.test(phrase)) return one(qaItem('Granola', { unit: 'serving', calories: 140 }));
    if (/honey/.test(phrase) && !/yogurt|blueberries|granola/.test(phrase)) return one(qaItem('Honey', { unit: 'tbsp', calories: 64 }));
    if (/taco bell.*crunchwrap/.test(phrase) && !/chips/.test(phrase)) return one(qaItem('Taco Bell Crunchwrap Supreme', { unit: 'wrap', calories: 540, source_type: 'OFFICIAL_RESTAURANT' }));
    if (/chips/.test(phrase) && !/crunchwrap/.test(phrase)) return one(qaItem('Chips', { quantity: item.quantity, unit: item.unit ?? 'serving', calories: 80 }));

    return one(qaItem(`Combined estimate: ${phrase}`, { unit: 'meal', calories: 520, source_type: 'AI_ESTIMATE' }));
  });
}

function decisionWithItems(items: MealAssistantItem[]): MealAssistantModelOutput {
  return {
    intent: 'new_food_item',
    action: 'add_food',
    assistant_reply: 'I found this meal. Review it below before saving.',
    contains_food_to_log: true,
    should_mutate_pending_meal: true,
    items,
    corrections: [],
    should_lookup_nutrition: true,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'high',
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('meal assistant decomposition-first flow', () => {
  it.each([
    ['Panda Express bigger plate: orange chicken, Beijing beef, chow mein', ['Panda Express Orange Chicken', 'Panda Express Beijing Beef', 'Panda Express Chow Mein']],
    ['2 grilled chicken breasts and asparagus', ['Grilled chicken breast', 'Asparagus']],
    ['8 oz sirloin steak, medium rare, baked potato with sour cream and chives', ['Sirloin steak', 'Baked potato', 'Sour cream', 'Chives']],
    ['Three scrambled eggs cooked in butter with sourdough toast and strawberry jam', ['Scrambled eggs', 'Butter', 'Sourdough toast', 'Strawberry jam']],
    ['Greek yogurt with blueberries, granola, and honey', ['Greek yogurt', 'Blueberries', 'Granola', 'Honey']],
    ['Taco Bell Crunchwrap and half chips', ['Taco Bell Crunchwrap Supreme', 'Chips']],
  ])('decomposes "%s" into component review items', async (prompt, expectedNames) => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const resolver = strictComponentResolver();

    const response = await runMealAssistant(
      { message: prompt, state: buildState() },
      { resolveItemNutrition: resolver },
    );

    const names = response.meal.items.map((item) => item.food_name);
    expect(names).toEqual(expect.arrayContaining(expectedNames));
    expect(names.join(' ')).not.toMatch(/combined estimate|egg whites/i);
    expect(response.next_state.pendingMeal?.status).toBe('readyForReview');
  });

  it('rejects provider substitutions that violate brand and must-not-match guardrails', async () => {
    const badProvider = vi.fn(async ({ item, mealType }: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }) => meal([
      /diet coke/i.test(item.name)
        ? qaItem('NOS Energy Drink Zero Sugar', { unit: 'can', calories: 10, source_name: 'Energy drink database' })
        : qaItem('Sugar-free cookie', { unit: 'cookie', calories: 90, source_name: 'Cookie database' }),
    ], mealType));

    const dietCoke = await runMealAssistant(
      { message: 'Diet Coke', state: buildState() },
      {
        classify: async () => decisionWithItems([{
          name: 'Diet Coke',
          brand: 'Coca-Cola',
          quantity: 1,
          unit: 'can',
          modifiers: ['must include: Diet Coke', 'must not match: NOS', 'must not match: Monster', 'must not match: energy drink', 'expected category: zero calorie soda'],
          action: 'add',
        }]),
        resolveItemNutrition: badProvider,
      },
    );

    const gummies = await runMealAssistant(
      { message: "Trader Joe's sugar free gummy worms", state: buildState() },
      {
        classify: async () => decisionWithItems([{
          name: 'Sugar free gummy worms',
          brand: "Trader Joe's",
          quantity: 1,
          unit: 'serving',
          modifiers: ['must include: Trader Joe', 'must include: gummy worms', 'must not match: cookie'],
          action: 'add',
        }]),
        resolveItemNutrition: badProvider,
      },
    );

    expect(dietCoke.meal.items.map((item) => item.food_name).join(' ')).not.toMatch(/NOS|energy drink/i);
    expect(dietCoke.meal.items[0]).toMatchObject({ food_name: expect.stringMatching(/Diet Coke/i), source_type: 'AI_ESTIMATE' });
    expect(gummies.meal.items.map((item) => item.food_name).join(' ')).not.toMatch(/cookie/i);
    expect(gummies.meal.items[0]).toMatchObject({ food_name: expect.stringMatching(/gummy worms/i), source_type: 'AI_ESTIMATE' });
  });

  it('keeps McGriddle as one sandwich when a provider returns a 100g restaurant serving', async () => {
    const response = await runMealAssistant(
      { message: 'McGriddle', state: buildState({ mealType: 'breakfast' }) },
      {
        classify: async () => decisionWithItems([{
          name: 'McGriddle',
          brand: "McDonald's",
          quantity: 1,
          unit: 'sandwich',
          modifiers: ['must include: McGriddle', 'serving default: 1 sandwich'],
          action: 'add',
        }]),
        resolveItemNutrition: async ({ mealType }) => meal([
          qaItem("McDonald's McGriddle", { quantity: 100, unit: 'g', calories: 430, source_type: 'OFFICIAL_RESTAURANT' }),
        ], mealType),
      },
    );

    expect(response.meal.items[0]).toMatchObject({
      food_name: "McDonald's McGriddle",
      quantity: 1,
      unit: 'sandwich',
    });
  });

  it('does not let generated assistant copy claim a meal is logged before save', async () => {
    const response = await runMealAssistant(
      { message: 'Diet Coke', state: buildState() },
      {
        classify: async () => decisionWithItems([{
          name: 'Diet Coke',
          brand: 'Coca-Cola',
          quantity: 1,
          unit: 'can',
          modifiers: [],
          action: 'add',
        }]),
        resolveItemNutrition: async ({ mealType }) => meal([
          qaItem('Diet Coke', { unit: 'can', calories: 0 }),
        ], mealType),
        generateAssistantReply: async () => "I've logged Diet Coke.",
      },
    );

    expect(response.next_state.pendingMeal?.status).toBe('readyForReview');
    expect(response.next_state.saved).toBe(false);
    expect(response.assistant_reply).not.toMatch(/\blogged\b/i);
    expect(response.assistant_reply).toMatch(/review|saving/i);
  });
});

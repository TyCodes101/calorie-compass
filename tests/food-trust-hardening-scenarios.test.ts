import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MealAssistantState, PendingMeal } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
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
    lastAssistantReply: null,
    activeTopic: null,
    activeMode: null,
    activeQuestion: null,
    previousIntent: null,
    previousUserMessage: null,
    ...overrides,
  } as MealAssistantState;
}

function resolveCatalog(prompt: string) {
  const response = getTrustedCatalogEstimate(prompt, 'lunch');
  expect(response, `Expected source-backed catalog match for "${prompt}"`).not.toBeNull();
  return response!;
}

function allNames(items: ParsedFoodItem[]) {
  return items.map((item) => item.food_name).join(' | ');
}

function pendingMeal(state: MealAssistantState) {
  return (state as MealAssistantState & { pendingMeal?: PendingMeal | null }).pendingMeal;
}

function expectIdentity(response: ParsedMealResponse, expected: RegExp[], forbidden: RegExp[] = []) {
  const names = allNames(response.items);
  for (const pattern of expected) {
    expect(names, names).toMatch(pattern);
  }
  for (const pattern of forbidden) {
    expect(names, names).not.toMatch(pattern);
  }
  expect(response.items.length).toBeGreaterThan(0);
  expect(response.totals.calories).toBeGreaterThanOrEqual(0);
  expect(response.totals.calories).toBeLessThan(5_000);
}

function expectSourceHonest(item: ParsedFoodItem) {
  if (item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback || item.is_trusted === false) {
    expect(item.confidence_label).toBe('Estimated');
    return;
  }
  expect(item.source_type).toMatch(/OFFICIAL_RESTAURANT|GENERIC_REFERENCE/);
  expect(item.confidence_label).toMatch(/Verified|Matched|High/);
}

const restaurantIdentityCases = [
  { prompt: "Wendy's Baconator", expected: [/wendy/i, /baconator/i], forbidden: [/spicy chicken/i, /homestyle/i] },
  { prompt: "Wendy's Baconnator", expected: [/wendy/i, /baconator/i], forbidden: [/spicy chicken/i, /homestyle/i] },
  { prompt: "Wendy's bacon cheeseburger", expected: [/wendy/i, /bacon cheeseburger/i], forbidden: [/spicy chicken/i] },
  { prompt: "Wendy's spicy chicken sandwich", expected: [/wendy/i, /spicy chicken/i], forbidden: [/baconator/i] },
  { prompt: 'McDouble no cheese', expected: [/mcdouble/i, /without cheese/i], forbidden: [/mcchicken/i] },
  { prompt: "McDonald's McDouble without cheese", expected: [/mcdouble/i, /without cheese/i], forbidden: [/mcchicken/i] },
  { prompt: 'Big Mac no pickles', expected: [/big mac/i], forbidden: [/mcchicken/i] },
  { prompt: 'McChicken', expected: [/mcchicken/i], forbidden: [/mcdouble/i] },
  { prompt: 'Chick-fil-A sandwich', expected: [/chick-fil-a/i, /sandwich/i], forbidden: [/nugget/i] },
  { prompt: 'Chick-fil-A grilled nuggets', expected: [/chick-fil-a/i, /grilled nuggets/i], forbidden: [/sandwich/i] },
  { prompt: 'chic fil a nuggest', expected: [/chick-fil-a/i, /nuggets/i], forbidden: [/sandwich/i] },
  { prompt: 'Subway meatball footlong', expected: [/subway/i, /meatball/i, /footlong/i], forbidden: [/turkey/i] },
  { prompt: 'Subway meatball 6 inch', expected: [/subway/i, /meatball/i, /6-inch/i], forbidden: [/turkey/i] },
  { prompt: 'Subway Italian BMT footlong', expected: [/subway/i, /b\.?m\.?t/i, /footlong/i], forbidden: [/club/i] },
  { prompt: 'Chipotle chicken bowl', expected: [/chipotle/i, /chicken/i], forbidden: [/wendy/i] },
  { prompt: 'Chipotle steak bowl', expected: [/chipotle/i, /steak/i], forbidden: [/chicken sandwich/i] },
  { prompt: "Arby's classic roast beef", expected: [/arby/i, /classic roast beef/i], forbidden: [/subway/i] },
  { prompt: 'White Castle slider', expected: [/white castle/i, /slider/i], forbidden: [/burger king/i] },
  { prompt: 'Taco Bell crunchwrap', expected: [/taco bell/i, /crunchwrap/i], forbidden: [/soft taco/i] },
  { prompt: 'Taco Bell soft taco', expected: [/taco bell/i, /soft taco/i], forbidden: [/potato/i] },
  { prompt: 'Burger King Whopper', expected: [/burger king/i, /whopper/i], forbidden: [/big mac/i] },
  { prompt: 'Popeyes chicken sandwich', expected: [/popeyes/i, /chicken sandwich/i], forbidden: [/chick-fil-a/i] },
] as const;

const brandedPackagedCases = [
  { prompt: 'hot cheetos', expected: [/cheetos/i, /flamin/i], forbidden: [/generic chips/i] },
  { prompt: 'Flamin Hot Cheetos', expected: [/cheetos/i, /flamin/i], forbidden: [/doritos/i] },
  { prompt: 'hot cheeots', expected: [/cheetos/i, /flamin/i], forbidden: [/generic chips/i] },
  { prompt: 'Quest BBQ chips', expected: [/quest/i, /bbq/i, /protein chips/i], forbidden: [/potato chips/i] },
  { prompt: 'Diet Coke', expected: [/diet coke/i], forbidden: [/coke zero/i, /classic/i] },
  { prompt: 'Coke Zero', expected: [/coke zero/i], forbidden: [/diet coke/i, /classic/i] },
  { prompt: 'diet cooe', expected: [/diet coke/i], forbidden: [/coke zero/i, /classic/i] },
  { prompt: 'Fairlife protein shake', expected: [/fairlife/i], forbidden: [/whole milk/i] },
  { prompt: 'Pop-Tarts', expected: [/pop-tarts/i], forbidden: [/oreo/i] },
  { prompt: 'Oreo cookies', expected: [/oreo/i], forbidden: [/pop-tarts/i] },
  { prompt: 'Doritos', expected: [/doritos/i], forbidden: [/quest/i] },
  { prompt: "Lay's chips", expected: [/lay/i, /chips/i], forbidden: [/quest/i] },
  { prompt: 'Gatorade', expected: [/gatorade/i], forbidden: [/coke/i] },
  { prompt: 'Celsius drink', expected: [/celsius/i], forbidden: [/gatorade/i] },
] as const;

const genericPrompts = [
  '2 grilled chicken breasts and asparagus',
  'buttered corn on the cob',
  'scrambled eggs and toast',
  'banana',
  'apple',
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
] as const;

const servingModifierPrompts = [
  { prompt: 'McDouble no cheese', name: /mcdouble/i, maxCalories: 390, unit: /burger/i },
  { prompt: "McDonald's McDouble without cheese", name: /mcdouble/i, maxCalories: 390, unit: /burger/i },
  { prompt: 'Chick-fil-A grilled nuggets', name: /grilled nuggets/i, maxCalories: 160, unit: /count/i },
  { prompt: 'Subway meatball footlong', name: /footlong/i, minCalories: 800, unit: /footlong/i },
  { prompt: 'Subway meatball 6 inch', name: /6-inch/i, maxCalories: 600, unit: /6-inch/i },
  { prompt: '100g Subway meatball marinara', name: /meatball/i, maxCalories: 300, unit: /^g$/i },
  { prompt: 'half a Chipotle chicken bowl', name: /chipotle/i, maxCalories: 250, unit: /serving|bowl/i },
  { prompt: 'one can Diet Coke', name: /diet coke/i, maxCalories: 5, unit: /can/i },
  { prompt: 'one bag Quest BBQ chips', name: /quest/i, maxCalories: 180, unit: /bag/i },
  { prompt: 'two servings hot cheetos', name: /cheetos/i, minCalories: 300, unit: /serving/i },
] as const;

describe('food trust hardening scenarios', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
    vi.stubEnv('NUTRITIONIX_APP_ID', '');
    vi.stubEnv('NUTRITIONIX_API_KEY', '');
  });

  it.each(restaurantIdentityCases)('preserves restaurant identity: $prompt', ({ prompt, expected, forbidden }) => {
    const response = resolveCatalog(prompt);

    expectIdentity(response, expected, forbidden);
    expect(response.items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT')).toBe(true);
    response.items.forEach(expectSourceHonest);
  });

  it.each(brandedPackagedCases)('preserves branded packaged identity: $prompt', ({ prompt, expected, forbidden }) => {
    const response = resolveCatalog(prompt);

    expectIdentity(response, expected, forbidden);
    expect(response.items.every((item) => item.source_type === 'GENERIC_REFERENCE')).toBe(true);
    response.items.forEach(expectSourceHonest);
  });

  it.each(servingModifierPrompts)('reflects supported serving/modifier intent: $prompt', ({ prompt, name, minCalories, maxCalories, unit }) => {
    const response = resolveCatalog(prompt);
    const item = response.items[0];

    expect(item?.food_name).toMatch(name);
    expect(item?.unit).toMatch(unit);
    if (typeof minCalories === 'number') {
      expect(item?.calories).toBeGreaterThanOrEqual(minCalories);
    }
    if (typeof maxCalories === 'number') {
      expect(item?.calories).toBeLessThanOrEqual(maxCalories);
    }
    expectSourceHonest(item!);
  });

  it.each(genericPrompts)('creates reviewable pending meal for generic input: %s', async (prompt) => {
    const response = await runMealAssistant({ message: prompt, state: buildState({ mealType: 'dinner' }) });
    const pending = pendingMeal(response.next_state);

    expect(response.should_save_meal).toBe(false);
    expect(response.next_state.saved).toBe(false);
    if (response.should_ask_clarification) {
      expect(response.assistant_reply).toMatch(/\?|which|what|brand|serving|dressing|protein/i);
      expect(pending).toBeFalsy();
      return;
    }
    expect(pending?.status).toBe('readyForReview');
    expect(pending?.items.length).toBeGreaterThan(0);
    expect(pending?.totals.calories ?? 0).toBeGreaterThan(0);
    expect(pending?.totals.calories ?? 0).toBeLessThan(3_000);
    pending?.items.forEach(expectSourceHonest);
  });

  it.each([
    'McDouble no cheese and small fry',
    'Chipotle chicken bowl and Diet Coke',
    'Subway meatball footlong with chips',
    'eggs toast bacon and orange juice',
    'burger fries and soda',
    'salmon rice and broccoli',
  ])('keeps multi-item meals reviewable without auto-save: %s', async (prompt) => {
    const response = await runMealAssistant({ message: prompt, state: buildState({ mealType: 'dinner' }) });
    const pending = pendingMeal(response.next_state);

    expect(response.should_save_meal).toBe(false);
    expect(pending?.status).toBe('readyForReview');
    expect(pending?.items.length).toBeGreaterThan(1);
    expect(response.assistant_reply).toMatch(/review|save when/i);
  });

  it('handles follow-up macros, yes, save once, add, replace, delete, undo, and start over deterministically', async () => {
    const saveMeal = vi.fn(async () => undefined);
    const initial = await runMealAssistant({ message: 'Chipotle chicken bowl and Diet Coke', state: buildState({ mealType: 'dinner' }) });
    const macro = await runMealAssistant({ message: "where's my macros", state: initial.next_state });
    const added = await runMealAssistant({ message: 'add McDouble no cheese', state: macro.next_state });
    const replaced = await runMealAssistant({ message: 'replace with McDouble no cheese', state: added.next_state });
    const saved = await runMealAssistant({ message: 'yes', state: replaced.next_state }, { saveMeal });
    const duplicateYes = await runMealAssistant({ message: 'yes', state: saved.next_state }, { saveMeal });
    const duplicateSave = await runMealAssistant({ message: 'save it', state: duplicateYes.next_state }, { saveMeal });
    const deleted = await runMealAssistant({ message: 'delete that', state: added.next_state });
    const undone = await runMealAssistant({ message: 'undo', state: added.next_state });
    const startedOver = await runMealAssistant({ message: 'start over', state: added.next_state });

    expect(macro.intent).toBe('macro_question');
    expect(macro.assistant_reply).toMatch(/pending review estimate/i);
    expect(allNames(added.meal.items)).toMatch(/chipotle/i);
    expect(allNames(added.meal.items)).toMatch(/mcdouble/i);
    expect(allNames(replaced.meal.items)).toMatch(/mcdouble/i);
    expect(allNames(replaced.meal.items)).not.toMatch(/chipotle/i);
    expect(saveMeal).toHaveBeenCalledTimes(1);
    expect(saved.should_save_meal).toBe(true);
    expect(duplicateYes.assistant_reply).toMatch(/already saved/i);
    expect(duplicateSave.assistant_reply).toMatch(/already saved/i);
    expect(pendingMeal(deleted.next_state)?.status).toBe('discarded');
    expect(pendingMeal(undone.next_state)?.status).toBe('readyForReview');
    expect(allNames(undone.meal.items)).toMatch(/chipotle/i);
    expect(allNames(undone.meal.items)).toMatch(/mcdouble/i);
    expect(pendingMeal(startedOver.next_state)?.status).toBe('discarded');
  });

  it.each([
    'chicken sandwich',
    'bowl',
    "Bob's Volcano Stack burger",
    'qyzzlork hot plate',
  ])('keeps uncertain input reviewable and avoids random official matches: %s', async (prompt) => {
    const response = await runMealAssistant({ message: prompt, state: buildState() });
    const pending = pendingMeal(response.next_state);

    expect(response.should_save_meal).toBe(false);
    expect(response.next_state.saved).toBe(false);
    for (const item of response.meal.items) {
      expect(item.source_type).not.toBe('OFFICIAL_RESTAURANT');
      expect(item.confidence_label).not.toBe('Verified');
    }
    if (pending) {
      expect(pending.status).toBe('readyForReview');
      expect(pending.confidenceScore).toBeLessThanOrEqual(0.82);
    }
  });
});

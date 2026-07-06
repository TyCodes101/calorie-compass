import { expect, vi } from 'vitest';

import type { MealAssistantResponse, MealAssistantState, PendingMeal } from '@/lib/ai/mealAssistantSchema';
import type { ParsedFoodItem } from '@/lib/ai/types';

export type GauntletMealType = MealAssistantState['mealType'];

export type RestaurantFixture = {
  brand: string;
  aliases: string[];
  foods: string[];
  unknownFood: string;
  expected?: RegExp;
};

export type BrandFixture = {
  brand: string;
  aliases: string[];
  foods: string[];
};

export type PromptCase = {
  name: string;
  prompt: string;
  expectedRestaurant?: RestaurantFixture;
  expectedBrand?: BrandFixture;
  expectedModifier?: string;
  expectedFoodKind?: 'burger' | 'chicken' | 'beef' | 'drink' | 'sub' | 'pizza' | 'generic';
  ambiguous?: boolean;
};

export type ConversationCase = {
  name: string;
  firstPrompt: string;
  followUps: string[];
  expectsSave?: boolean;
  expectsCancel?: boolean;
  expectedRestaurant?: RestaurantFixture;
  expectedBrand?: BrandFixture;
};

export const restaurantFixtures: RestaurantFixture[] = [
  { brand: "McDonald's", aliases: ["mcdonald", "mc double", 'mcdouble', 'mcchicken', 'big mac'], foods: ['McDouble no cheese', 'Big Mac no pickles', 'McChicken', 'small fry'], unknownFood: 'volcano burger', expected: /mcdonald|mcdouble|mcchicken|big mac/i },
  { brand: "Wendy's", aliases: ['wendy', 'baconator', 'baconnator'], foods: ['Baconator', 'Baconnator', 'spicy chicken sandwich', 'bacon cheeseburger'], unknownFood: 'ghost pepper stack', expected: /wendy|baconator|spicy chicken|bacon cheeseburger/i },
  { brand: 'Burger King', aliases: ['burger king', 'burgerking', 'whopper'], foods: ['Whopper', 'Whopper no mayo', 'chicken sandwich', 'small fries'], unknownFood: 'royal stack burger', expected: /burger king|whopper/i },
  { brand: 'Chick-fil-A', aliases: ['chick-fil-a', 'chick fil a', 'chickfila', 'chic fil a'], foods: ['chicken sandwich', 'grilled nuggets', 'chic fil a nuggest', 'spicy sandwich'], unknownFood: 'breakfast bowl', expected: /chick-fil-a|chicken sandwich|nugget/i },
  { brand: 'Subway', aliases: ['subway'], foods: ['meatball footlong', 'meatball 6 inch', 'Italian BMT footlong', 'turkey sub no mayo'], unknownFood: 'loaded ranch sub', expected: /subway|meatball|b\.?m\.?t|sub/i },
  { brand: 'Chipotle', aliases: ['chipotle', 'chipolte'], foods: ['chicken bowl', 'steak bowl', 'bowl with double meat', 'chicken bowl no cheese'], unknownFood: 'queso volcano bowl', expected: /chipotle|bowl|chicken|steak/i },
  { brand: 'Taco Bell', aliases: ['taco bell', 'tacobell'], foods: ['crunchwrap', 'soft taco', 'crunchy taco', 'soft taco no cheese'], unknownFood: 'lava burrito', expected: /taco bell|crunchwrap|taco/i },
  { brand: "Arby's", aliases: ['arby', 'arbys', "arby's"], foods: ['classic roast beef', 'roast beef no bun', 'beef and cheddar', 'small curly fries'], unknownFood: 'smokehouse stack', expected: /arby|roast beef/i },
  { brand: 'White Castle', aliases: ['white castle'], foods: ['slider', 'cheese slider', 'two sliders', 'slider no cheese'], unknownFood: 'breakfast slider', expected: /white castle|slider/i },
  { brand: 'Popeyes', aliases: ['popeyes'], foods: ['chicken sandwich', 'spicy chicken sandwich', 'nuggets', 'red beans and rice'], unknownFood: 'blackened bowl', expected: /popeyes|chicken/i },
  { brand: 'KFC', aliases: ['kfc'], foods: ['fried chicken breast', 'chicken sandwich', 'famous bowl', 'mashed potatoes'], unknownFood: 'crispy rice plate' },
  { brand: "Raising Cane's", aliases: ['raising canes', "raising cane's", 'raising cane', "cane's", 'canes'], foods: ['chicken tenders', 'caniac combo', 'box combo', 'tenders no sauce'], unknownFood: 'grilled tender bowl' },
  { brand: 'Five Guys', aliases: ['five guys'], foods: ['cheeseburger', 'little burger', 'fries', 'burger no bun'], unknownFood: 'protein bowl' },
  { brand: 'Panera', aliases: ['panera'], foods: ['turkey sandwich', 'caesar salad', 'mac and cheese', 'bagel'], unknownFood: 'power bowl' },
  { brand: 'Starbucks', aliases: ['starbucks'], foods: ['latte', 'caramel macchiato', 'egg bites', 'breakfast sandwich'], unknownFood: 'protein box' },
  { brand: 'Dunkin', aliases: ['dunkin'], foods: ['coffee', 'bagel', 'breakfast sandwich', 'donut'], unknownFood: 'loaded hash wrap' },
  { brand: "Domino's", aliases: ['domino', 'dominos'], foods: ['pepperoni pizza', 'thin crust pizza', 'wings', 'pasta'], unknownFood: 'loaded pizza bowl' },
  { brand: 'Pizza Hut', aliases: ['pizza hut'], foods: ['pepperoni pizza', 'personal pan pizza', 'wings', 'breadsticks'], unknownFood: 'triple melt pizza' },
  { brand: "Papa John's", aliases: ['papa john', 'papa johns'], foods: ['pepperoni pizza', 'cheese pizza', 'garlic sauce', 'breadsticks'], unknownFood: 'spicy stack pizza' },
  { brand: "Jersey Mike's", aliases: ['jersey mike', 'jersey mikes'], foods: ['italian sub', 'turkey sub', 'philly cheesesteak', 'sub no mayo'], unknownFood: 'shore club sub' },
  { brand: "Jimmy John's", aliases: ['jimmy john', 'jimmy johns'], foods: ['turkey sub', 'italian sub', 'lettuce wrapped sub', 'sub no mayo'], unknownFood: 'beach club sub' },
  { brand: 'Qdoba', aliases: ['qdoba'], foods: ['chicken bowl', 'steak bowl', 'burrito', 'bowl no cheese'], unknownFood: 'loaded queso bowl' },
  { brand: 'Panda Express', aliases: ['panda express'], foods: ['orange chicken', 'fried rice', 'chow mein', 'broccoli beef'], unknownFood: 'honey sesame bowl' },
  { brand: 'Wingstop', aliases: ['wingstop'], foods: ['boneless wings', 'classic wings', 'ranch', 'fries'], unknownFood: 'loaded wing bowl' },
  { brand: 'Buffalo Wild Wings', aliases: ['buffalo wild wings', 'bdubs'], foods: ['boneless wings', 'classic wings', 'buffalo wings', 'ranch'], unknownFood: 'street taco plate' },
  { brand: 'Olive Garden', aliases: ['olive garden'], foods: ['spaghetti marinara', 'chicken alfredo', 'breadsticks', 'salad'], unknownFood: 'tuscan bowl' },
  { brand: 'Texas Roadhouse', aliases: ['texas roadhouse'], foods: ['steak', 'roll with butter', 'baked potato', 'grilled chicken'], unknownFood: 'roadkill plate' },
  { brand: "Applebee's", aliases: ['applebee', 'applebees'], foods: ['boneless wings', 'classic burger', 'chicken tenders', 'caesar salad'], unknownFood: 'bourbon bowl' },
  { brand: 'IHOP', aliases: ['ihop'], foods: ['pancakes', 'scrambled eggs', 'omelette', 'breakfast sandwich'], unknownFood: 'protein pancake plate' },
  { brand: 'Waffle House', aliases: ['waffle house'], foods: ['waffle', 'hash browns', 'eggs and toast', 'bacon'], unknownFood: 'loaded breakfast bowl' },
];

export const brandedFixtures: BrandFixture[] = [
  { brand: 'Cheetos', aliases: ['cheetos', 'cheeots'], foods: ['Flamin Hot Cheetos', 'hot cheetos'] },
  { brand: 'Doritos', aliases: ['doritos'], foods: ['Doritos', 'nacho cheese Doritos'] },
  { brand: "Lay's", aliases: ['lays', "lay's"], foods: ["Lay's chips", 'classic potato chips'] },
  { brand: 'Quest', aliases: ['quest'], foods: ['Quest BBQ chips', 'Quest protein chips'] },
  { brand: 'Oreo', aliases: ['oreo'], foods: ['Oreo cookies', 'Oreos'] },
  { brand: 'Pop-Tarts', aliases: ['pop tart', 'pop-tart', 'pop tarts'], foods: ['Pop-Tarts', 'strawberry Pop-Tarts'] },
  { brand: 'Fairlife', aliases: ['fairlife', 'core power'], foods: ['Fairlife protein shake', 'Core Power shake'] },
  { brand: 'Premier Protein', aliases: ['premier protein'], foods: ['Premier Protein shake', 'Premier Protein bottle'] },
  { brand: 'Coca-Cola', aliases: ['coke', 'diet coke', 'coke zero', 'diet cooe'], foods: ['Coke', 'Diet Coke', 'Coke Zero', 'diet cooe'] },
  { brand: 'Pepsi', aliases: ['pepsi'], foods: ['Pepsi', 'Diet Pepsi'] },
  { brand: 'Gatorade', aliases: ['gatorade'], foods: ['Gatorade', 'Gatorade bottle'] },
  { brand: 'Celsius', aliases: ['celsius'], foods: ['Celsius drink', 'Celsius can'] },
  { brand: 'Red Bull', aliases: ['red bull'], foods: ['Red Bull', 'Red Bull can'] },
  { brand: 'Monster', aliases: ['monster'], foods: ['Monster energy drink', 'Monster can'] },
  { brand: 'Nature Valley', aliases: ['nature valley'], foods: ['Nature Valley granola bar', 'Nature Valley bar'] },
  { brand: 'Clif Bar', aliases: ['clif'], foods: ['Clif Bar', 'Clif protein bar'] },
  { brand: 'Kind Bar', aliases: ['kind bar', 'kind'], foods: ['Kind Bar', 'Kind granola bar'] },
  { brand: 'Goldfish', aliases: ['goldfish'], foods: ['Goldfish crackers', 'Goldfish'] },
  { brand: 'Ritz', aliases: ['ritz'], foods: ['Ritz crackers', 'Ritz'] },
  { brand: 'Cheez-It', aliases: ['cheez-it', 'cheezit'], foods: ['Cheez-It crackers', 'Cheez-Its'] },
];

export const genericFoods = [
  'chicken breast',
  'grilled chicken',
  'fried chicken',
  'ground beef',
  'steak',
  'turkey',
  'salmon',
  'tuna',
  'eggs',
  'rice',
  'pasta',
  'potatoes',
  'oatmeal',
  'toast',
  'bagel',
  'banana',
  'apple',
  'berries',
  'broccoli',
  'asparagus',
  'green beans',
  'corn',
  'salad',
  'beans',
  'yogurt',
  'protein shake',
  'smoothie',
  'cereal',
  'peanut butter',
  'cheese',
  'milk',
  'orange juice',
] as const;

export const quantities = [
  '1',
  '2',
  '3',
  'half',
  'double',
  'small',
  'medium',
  'large',
  '100g',
  '200g',
  '8 oz',
  '12 oz',
  '1 cup',
  '2 cups',
  '1 tbsp',
  '2 tbsp',
  '1 serving',
  '2 servings',
  'one bag',
  'one can',
  'one bottle',
  'one plate',
  'one bowl',
] as const;

export const modifiers = [
  'no cheese',
  'without cheese',
  'extra cheese',
  'no mayo',
  'light mayo',
  'no sauce',
  'extra sauce',
  'no bun',
  'lettuce wrapped',
  'grilled',
  'fried',
  'crispy',
  'spicy',
  'plain',
  'with butter',
  'without butter',
  'with ranch',
  'no dressing',
  'light dressing',
  'double meat',
  'extra protein',
  'half portion',
  'footlong',
  '6 inch',
  'kids size',
  'small',
  'medium',
  'large',
] as const;

export const ambiguousFoods = [
  'chicken sandwich',
  'burger',
  'bowl',
  'wrap',
  'salad',
  'fries',
  'pizza',
  'coffee',
  'protein shake',
  'chips',
  'taco',
  'sub',
  'pasta',
  'breakfast sandwich',
] as const;

export function isolateFoodGauntletEnv() {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('USDA_FDC_API_KEY', '');
  vi.stubEnv('FDC_API_KEY', '');
  vi.stubEnv('NUTRITIONIX_APP_ID', '');
  vi.stubEnv('NUTRITIONIX_API_KEY', '');
}

export function buildGauntletState(overrides?: Partial<MealAssistantState>): MealAssistantState {
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

export function pendingMeal(state: MealAssistantState) {
  return (state as MealAssistantState & { pendingMeal?: PendingMeal | null }).pendingMeal ?? null;
}

export function mealText(response: MealAssistantResponse) {
  const pending = pendingMeal(response.next_state);
  return [
    response.assistant_reply,
    response.next_state.currentMealText ?? '',
    pending?.displayTitle ?? '',
    pending?.rawText ?? '',
    ...response.meal.items.flatMap((item) => [
      item.food_name,
      item.unit,
      item.notes ?? '',
      item.source_name ?? '',
      item.original_user_text ?? '',
      item.matched_query ?? '',
      item.userTextSpan ?? '',
    ]),
  ].join(' | ');
}

export function normalizeForAssert(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function makeSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

export function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length) % items.length]!;
}

export function typoVariant(value: string, random: () => number) {
  const normalized = value.replace(/'/g, '');
  const index = Math.max(1, Math.min(normalized.length - 2, Math.floor(random() * normalized.length)));
  const mode = Math.floor(random() * 4);
  if (mode === 0) {
    return `${normalized.slice(0, index)}${normalized.slice(index + 1)}`;
  }
  if (mode === 1) {
    return `${normalized.slice(0, index)}${normalized[index]}${normalized.slice(index)}`;
  }
  if (mode === 2 && index < normalized.length - 1) {
    return `${normalized.slice(0, index)}${normalized[index + 1]}${normalized[index]}${normalized.slice(index + 2)}`;
  }
  return normalized.toLowerCase().replace(/\s+/g, ' ');
}

export function assertItemNutritionPlausible(item: ParsedFoodItem, prompt: string) {
  expect(item.quantity, prompt).toBeGreaterThan(0);
  expect(item.calories, prompt).toBeGreaterThanOrEqual(0);
  expect(item.protein, prompt).toBeGreaterThanOrEqual(0);
  expect(item.carbs, prompt).toBeGreaterThanOrEqual(0);
  expect(item.fat, prompt).toBeGreaterThanOrEqual(0);
  expect(item.fiber, prompt).toBeGreaterThanOrEqual(0);
  expect(item.sugar, prompt).toBeGreaterThanOrEqual(0);
  expect(item.sodium, prompt).toBeGreaterThanOrEqual(0);
  expect(item.calories, prompt).toBeLessThan(10_000);
  if (item.protein || item.carbs || item.fat) {
    const macroCalories = item.protein * 4 + item.carbs * 4 + item.fat * 9;
    expect(item.calories, `${prompt}: calories too low for macros`).toBeGreaterThanOrEqual(Math.max(0, macroCalories * 0.35 - 80));
    expect(item.calories, `${prompt}: calories too high for macros`).toBeLessThanOrEqual(Math.max(400, macroCalories * 2.2 + 600));
  }
  if (typeof item.confidence === 'number') {
    expect(item.confidence, prompt).toBeGreaterThanOrEqual(0);
    expect(item.confidence, prompt).toBeLessThanOrEqual(1);
  }
  if (item.confidence_label) {
    expect(['Verified', 'Matched', 'Estimated', 'Needs Review']).toContain(item.confidence_label);
  }
  if (item.source_type) {
    expect(['OFFICIAL_RESTAURANT', 'GENERIC_REFERENCE', 'AI_ESTIMATE']).toContain(item.source_type);
  }
  if (item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback || item.is_trusted === false) {
    expect(item.confidence_label, prompt).not.toBe('Verified');
  }
}

export function assertResponseHasValidState(response: MealAssistantResponse, prompt: string) {
  expect(response.meal.confidence_score, prompt).toBeGreaterThanOrEqual(0);
  expect(response.meal.confidence_score, prompt).toBeLessThanOrEqual(1);
  expect(response.meal.totals.calories, prompt).toBeGreaterThanOrEqual(0);
  expect(response.meal.totals.protein, prompt).toBeGreaterThanOrEqual(0);
  expect(response.meal.totals.carbs, prompt).toBeGreaterThanOrEqual(0);
  expect(response.meal.totals.fat, prompt).toBeGreaterThanOrEqual(0);
  expect(response.meal.totals.calories, prompt).toBeLessThan(25_000);

  for (const item of response.meal.items) {
    assertItemNutritionPlausible(item, prompt);
  }

  const pending = pendingMeal(response.next_state);
  if (pending) {
    expect(['none', 'resolving', 'readyForReview', 'saving', 'saved', 'failed', 'discarded', 'stale']).toContain(pending.status);
    expect(pending.version, prompt).toBeGreaterThanOrEqual(1);
    expect(pending.confidenceScore, prompt).toBeGreaterThanOrEqual(0);
    expect(pending.confidenceScore, prompt).toBeLessThanOrEqual(1);
    expect(pending.totals.calories, prompt).toBeGreaterThanOrEqual(0);
    expect(pending.items.length || ['discarded', 'stale'].includes(pending.status), prompt).toBeTruthy();
    for (const item of pending.items) {
      assertItemNutritionPlausible(item, prompt);
    }
  }
}

export function assertNoSilentSave(response: MealAssistantResponse, prompt: string) {
  expect(response.should_save_meal, `${prompt}: should not save without explicit confirmation`).toBe(false);
  expect(response.next_state.saved, `${prompt}: should not mark saved without explicit confirmation`).toBe(false);
}

export function assertReviewOrClarification(response: MealAssistantResponse, prompt: string) {
  if (response.should_ask_clarification) {
    expect(response.assistant_reply, prompt).toMatch(/\?|which|what|brand|size|serving|details|kind|review/i);
    expect(response.should_save_meal, prompt).toBe(false);
    return;
  }
  const pending = pendingMeal(response.next_state);
  expect(
    Boolean(pending && ['readyForReview', 'failed'].includes(pending.status)) || response.meal.items.length > 0,
    `${prompt}: expected reviewable items or clarification`,
  ).toBe(true);
}

export function assertRestaurantIdentitySafe(response: MealAssistantResponse, fixture: RestaurantFixture, prompt: string) {
  const text = normalizeForAssert(mealText(response));
  const otherRestaurants = restaurantFixtures.filter((candidate) => candidate.brand !== fixture.brand);
  for (const other of otherRestaurants) {
    if (other.aliases.some((alias) => text.includes(normalizeForAssert(alias)))) {
      throw new Error(`${prompt}: resolved ${fixture.brand} prompt into another restaurant: ${other.brand}. Text: ${text}`);
    }
  }

  const officialItems = response.meal.items.filter((item) => item.source_type === 'OFFICIAL_RESTAURANT');
  for (const item of officialItems) {
    const itemText = normalizeForAssert(`${item.food_name} ${item.source_name ?? ''} ${item.notes ?? ''}`);
    const matchesExpected = fixture.aliases.some((alias) => itemText.includes(normalizeForAssert(alias)))
      || Boolean(fixture.expected?.test(item.food_name))
      || Boolean(fixture.expected?.test(item.source_name ?? ''));
    expect(matchesExpected, `${prompt}: official item did not preserve ${fixture.brand}: ${itemText}`).toBe(true);
  }

  if (/\b(?:6 inch|six inch|6-inch)\b/i.test(prompt)) {
    const resolvedServingText = normalizeForAssert(response.meal.items.map((item) => `${item.food_name} ${item.unit}`).join(' '));
    expect(resolvedServingText, `${prompt}: six-inch request should not become footlong`).not.toMatch(/\bfootlong\b/);
  }
}

export function assertBrandIdentitySafe(response: MealAssistantResponse, fixture: BrandFixture, prompt: string) {
  const text = normalizeForAssert(mealText(response));
  const otherBrands = brandedFixtures.filter((candidate) => candidate.brand !== fixture.brand);
  for (const other of otherBrands) {
    if (other.aliases.some((alias) => text.includes(normalizeForAssert(alias)))) {
      throw new Error(`${prompt}: resolved ${fixture.brand} prompt into another packaged brand: ${other.brand}. Text: ${text}`);
    }
  }
  for (const item of response.meal.items) {
    if (item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback) {
      expect(item.confidence_label, prompt).not.toBe('Verified');
    }
  }
}

export function assertFoodKindNotSwapped(response: MealAssistantResponse, prompt: string) {
  const text = normalizeForAssert(response.meal.items.map((item) => item.food_name).join(' '));
  if (/\b(?:burger|whopper|baconator|big mac|mcdouble|roast beef|steak)\b/i.test(prompt) && !/\bchicken\b/i.test(prompt)) {
    expect(text, `${prompt}: beef/burger prompt became chicken`).not.toMatch(/\b(?:chicken|mcchicken|nugget)\b/);
  }
  if (/\bchicken\b/i.test(prompt) && !/\b(?:burger|beef|steak)\b/i.test(prompt)) {
    expect(text, `${prompt}: chicken prompt became beef/burger`).not.toMatch(/\b(?:whopper|baconator|mcdouble|big mac|roast beef|steak)\b/);
  }
}

export function assertModifierRepresented(response: MealAssistantResponse, modifier: string, prompt: string) {
  if (response.should_ask_clarification) {
    return;
  }
  const text = normalizeForAssert(mealText(response));
  const normalizedModifier = normalizeForAssert(modifier)
    .replace(/^without /, 'no ')
    .replace(/^with /, '');
  const tokens = normalizedModifier.split(' ').filter((token) => token.length > 2);
  expect(tokens.some((token) => text.includes(token)), `${prompt}: modifier was lost from review context`).toBe(true);
}

export function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

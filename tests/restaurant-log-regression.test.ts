import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';

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
  };
}

async function runPrompt(message: string) {
  return runMealAssistant({ message, state: buildState() });
}

function foodNames(response: Awaited<ReturnType<typeof runPrompt>>) {
  return response.meal.items.map((item) => item.food_name).join(', ');
}

function expectPlausibleNutrition(response: Awaited<ReturnType<typeof runPrompt>>) {
  const item = response.meal.items[0];
  expect(item?.calories).toBeGreaterThan(30);
  expect(item?.calories).toBeLessThan(1_200);
  expect(item?.protein).toBeGreaterThanOrEqual(0);
  expect(item?.carbs).toBeGreaterThanOrEqual(0);
  expect(item?.fat).toBeGreaterThanOrEqual(0);
}

function expectAssistantSourceMatchesCard(response: Awaited<ReturnType<typeof runPrompt>>) {
  const item = response.meal.items[0];
  expect(item).toBeDefined();

  if (item?.source_type === 'OFFICIAL_RESTAURANT') {
    expect(response.assistant_reply).toMatch(/restaurant verified/i);
    expect(response.assistant_reply).not.toMatch(/brand verified|generic reference|USDA match|common serving/i);
  } else if (item?.source_type === 'GENERIC_REFERENCE') {
    expect(response.assistant_reply).toMatch(/generic reference|brand verified|USDA match/i);
    expect(response.assistant_reply).not.toMatch(/restaurant verified/i);
  } else if (item?.source_type === 'AI_ESTIMATE') {
    expect(response.assistant_reply).toMatch(/estimated/i);
    expect(response.assistant_reply).not.toMatch(/verified/i);
  }
}

function expectRestaurantMatch(response: Awaited<ReturnType<typeof runPrompt>>, expectedName: RegExp) {
  expect(response.should_ask_clarification).toBe(false);
  expect(response.meal.items.length).toBeGreaterThan(0);
  expect(foodNames(response)).toMatch(expectedName);
  expect(response.meal.items[0]).toMatchObject({
    source_type: 'OFFICIAL_RESTAURANT',
    confidence_label: 'Verified',
  });
  expect(response.meal.items[0]?.match_type).toMatch(/restaurant/);
  expect(response.assistant_reply).toMatch(/verified|restaurant/i);
  expect(response.assistant_reply).not.toMatch(/generic|USDA|common serving/i);
  expectAssistantSourceMatchesCard(response);
  expectPlausibleNutrition(response);
}

describe('restaurant log screenshot regressions', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
  });

  it('keeps Subway BMT brand and item intent instead of matching Subway Club', async () => {
    const response = await runPrompt('A subway bmt sandwich');

    expectRestaurantMatch(response, /subway.*b\.?m\.?t|italian b\.?m\.?t/i);
    expect(foodNames(response)).not.toMatch(/club/i);
    expect(response.meal.items[0]?.unit).not.toBe('g');
  });

  it('scales an explicit 100g Subway meatball request from the branded restaurant item', async () => {
    const response = await runPrompt("I've got 100g SUBWAY, meatball marinara sub on white bread no toppings");

    expectRestaurantMatch(response, /subway.*meatball marinara/i);
    expect(response.meal.items[0]).toMatchObject({
      quantity: 100,
      unit: 'g',
    });
    expect(response.meal.items[0]?.notes).toMatch(/scaled|restaurant/i);
  });

  it("matches Arby's roast beef to the classic restaurant sandwich", async () => {
    const response = await runPrompt('An arbys roast beef');

    expectRestaurantMatch(response, /arby'?s.*classic roast beef/i);
    expect(response.meal.items[0]?.unit).toBe('sandwich');
  });

  it('preserves Chipotle bowl intent when the bowl only has chicken', async () => {
    const response = await runPrompt('A chipotle bowl with only chicken');

    expectRestaurantMatch(response, /chipotle.*chicken/i);
    expect(foodNames(response)).not.toMatch(/^Chicken$/i);
  });

  it('matches a Chick-fil-A chicken sandwich instead of generic chicken', async () => {
    const response = await runPrompt('A chic fil a chicken sandwhich');

    expectRestaurantMatch(response, /chick-fil-a.*chicken sandwich/i);
    expect(foodNames(response)).not.toMatch(/^Chicken$/i);
    expect(response.meal.items[0]?.unit).toBe('sandwich');
  });

  it('matches the exact Chick-fil-A sandwich prompt without typo drift', async () => {
    const response = await runPrompt('A chic fil a chicken sandwich');

    expectRestaurantMatch(response, /chick-fil-a.*chicken sandwich/i);
    expect(foodNames(response)).not.toMatch(/^Chicken$/i);
    expect(response.meal.items[0]?.unit).toBe('sandwich');
  });

  it('matches a White Castle slider without asking what the food was', async () => {
    const response = await runPrompt('A white castle slider');

    expectRestaurantMatch(response, /white castle.*original slider/i);
    expect(response.meal.items[0]?.unit).toBe('slider');
  });

  it('keeps McDouble as a McDonald restaurant item', async () => {
    const response = await runPrompt('McDouble');

    expectRestaurantMatch(response, /mcdouble/i);
    expect(response.meal.items[0]?.unit).toBe('burger');
  });

  it.each([
    "Wendy's Baconator",
    'wendys baconator',
    'a baconnator from wendys',
    "I had Wendy's Baconator",
  ])('keeps Baconator identity for %s', async (message) => {
    const response = await runPrompt(message);

    expectRestaurantMatch(response, /wendy'?s.*baconator/i);
    expect(foodNames(response)).not.toMatch(/chicken/i);
    expect(response.meal.items[0]?.unit).toBe('burger');
  });

  it.each([
    'McDouble no cheese',
    'a mcdouble without cheese',
    "McDonald's McDouble, no cheese",
    'mcdouble hold the cheese',
  ])('keeps McDouble identity while applying no-cheese modifier for %s', async (message) => {
    const response = await runPrompt(message);

    expectRestaurantMatch(response, /mcdouble/i);
    expect(foodNames(response)).not.toMatch(/mcchicken|chicken/i);
    expect(response.meal.items[0]?.notes).toMatch(/no cheese|without cheese|cheese removed/i);
  });

  it.each([
    'Subway meatball marinara footlong',
    'a footlong meatball sub from subway',
  ])('keeps Subway meatball product and footlong serving for %s', async (message) => {
    const response = await runPrompt(message);

    expectRestaurantMatch(response, /subway.*meatball marinara/i);
    expect(response.meal.items[0]?.calories).toBeGreaterThan(700);
  });

  it.each([
    "Arby's classic roast beef",
    'arbys roast beef sandwich',
  ])("keeps Arby's roast beef product identity for %s", async (message) => {
    const response = await runPrompt(message);

    expectRestaurantMatch(response, /arby'?s.*classic roast beef/i);
    expect(foodNames(response)).not.toMatch(/chicken/i);
  });

  it.each([
    ['A SUBWAY BMT SANDWICH', /subway.*b\.?m\.?t|italian b\.?m\.?t/i],
    ['A subway bmt sandwhich', /subway.*b\.?m\.?t|italian b\.?m\.?t/i],
    ['AN ARBY ROAST BEEF', /arby'?s.*classic roast beef/i],
    ['WHITE CASTLE SLIDER', /white castle.*original slider/i],
    ['chickfila chicken sandwhich', /chick-fil-a.*chicken sandwich/i],
  ])('preserves restaurant intent for case and typo variant %s', async (message, expectedName) => {
    const response = await runPrompt(message);

    expectRestaurantMatch(response, expectedName);
    if (/chick/i.test(message)) {
      expect(foodNames(response)).not.toMatch(/^Chicken$/i);
    }
  });
});

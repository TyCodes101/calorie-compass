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
  });

  it('matches a White Castle slider without asking what the food was', async () => {
    const response = await runPrompt('A white castle slider');

    expectRestaurantMatch(response, /white castle.*original slider/i);
    expect(response.meal.items[0]?.unit).toBe('slider');
  });
});

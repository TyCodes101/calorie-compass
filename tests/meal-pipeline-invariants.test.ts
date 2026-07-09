import { describe, expect, it } from 'vitest';

import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';

function buildState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingMeal: null,
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'snack',
    userName: 'Tyler Cox',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  };
}

function normalizedNames(response: Awaited<ReturnType<typeof runMealAssistant>>) {
  return response.meal.items.map((item) => item.food_name.toLowerCase());
}

async function runOffline(message: string) {
  delete process.env.OPENAI_API_KEY;
  return runMealAssistant({ message, state: buildState() });
}

describe('meal understanding pipeline invariants', () => {
  it.each([
    'Panda Express Bigger Plate: Orange Chicken, Beijing Beef, Chow Mein',
    'panda express bigger plate orange chicken, beijing beef and chow mein',
    'Panda Express bigger plate with orange chicken plus Beijing beef plus chow mein',
  ])('does not drop or duplicate restaurant plate components: %s', async (message) => {
    const response = await runOffline(message);
    const names = normalizedNames(response);

    expect(names.filter((name) => /orange chicken/.test(name))).toHaveLength(1);
    expect(names.filter((name) => /beijing beef/.test(name))).toHaveLength(1);
    expect(names.filter((name) => /chow mein/.test(name))).toHaveLength(1);
    expect(response.meal.items).toHaveLength(3);
  });

  it.each([
    ['Five Guys bacon cheeseburger, no bun, extra grilled onions and mushrooms', [/no bun/i, /grilled onions/i, /mushrooms/i]],
    ['Chipotle salad with double chicken, fajita veggies, pico, corn salsa, no rice', [/double chicken/i, /no rice/i]],
  ] as const)('preserves modifier chains in resolved review metadata: %s', async (message, expectedModifiers) => {
    const response = await runOffline(message);
    const metadata = response.meal.items
      .map((item) => [item.food_name, item.notes, item.matched_query, item.original_user_text].filter(Boolean).join(' '))
      .join(' ');

    for (const modifier of expectedModifiers) {
      expect(metadata).toMatch(modifier);
    }
  });

  it.each([
    ['Diet Coke', /diet coke/i, /NOS|Monster|energy drink/i],
    ["Trader Joe's sugar free gummy worms", /gummy worms/i, /cookie/i],
  ] as const)('prevents silent branded substitution for %s', async (message, expected, forbidden) => {
    const response = await runOffline(message);
    const text = response.meal.items
      .map((item) => [item.food_name, item.source_name, item.notes, item.matched_query].filter(Boolean).join(' '))
      .join(' ');

    expect(text).toMatch(expected);
    expect(text).not.toMatch(forbidden);
  });
});

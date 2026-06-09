import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';

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

async function parseItems(message: string) {
  const response = await runMealAssistant({ message, state: buildState() });
  return response.meal.items;
}

function itemNames(items: Array<{ food_name: string }>) {
  return items.map((item) => item.food_name.toLowerCase()).join(', ');
}

describe('nutrition candidate ranking', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
  });

  it('prefers Quest BBQ Protein Chips over generic chips or Quest bars', async () => {
    const items = await parseItems('I had Quest BBQ Protein Chips');

    expect(items[0]).toMatchObject({
      food_name: 'Quest BBQ Protein Chips',
      match_type: 'exact_branded',
      confidence_label: 'Verified',
      used_ai_fallback: false,
    });
    expect(itemNames(items)).not.toContain('quest protein bar');
  });

  it('does not confuse Quest Nacho Cheese Protein Chips with Chipotle cheese', async () => {
    const items = await parseItems('I had Quest Nacho Cheese Protein Chips');

    expect(items[0]).toMatchObject({
      food_name: 'Quest Nacho Cheese Protein Chips',
      match_type: 'exact_branded',
    });
    expect(itemNames(items)).not.toContain('chipotle cheese');
  });

  it('prefers Fairlife Core Power Chocolate over generic protein shake', async () => {
    const items = await parseItems('I had Fairlife Core Power Chocolate');

    expect(items[0].food_name.toLowerCase()).toContain('fairlife');
    expect(items[0].source_name?.toLowerCase()).toMatch(/fairlife|core power/);
    expect(items[0].match_type).toMatch(/branded/);
    expect(itemNames(items)).not.toBe('protein shake');
  });

  it('prefers Chobani Strawberry Greek Yogurt over generic Greek yogurt', async () => {
    const items = await parseItems('I had Chobani Greek Yogurt Strawberry');

    expect(items[0]).toMatchObject({
      food_name: 'Chobani Greek Yogurt Strawberry',
      match_type: 'exact_branded',
    });
    expect(itemNames(items)).not.toBe('greek yogurt');
  });

  it('prefers Big Mac over generic burger', async () => {
    const items = await parseItems('I had a Big Mac');

    expect(items[0].food_name.toLowerCase()).toContain('big mac');
    expect(items[0].match_type).toBe('exact_restaurant');
    expect(itemNames(items)).not.toBe('burger');
  });

  it('prefers Starbucks venti latte over generic coffee', async () => {
    const items = await parseItems('I had Starbucks venti iced vanilla latte');

    expect(items[0].food_name.toLowerCase()).toContain('starbucks');
    expect(items[0].food_name.toLowerCase()).toContain('latte');
    expect(items[0].match_type).toBe('exact_restaurant');
    expect(itemNames(items)).not.toBe('coffee');
  });

  it('keeps Coke Zero separate from regular Coke', async () => {
    const items = await parseItems('I had Coke Zero');

    expect(items[0].food_name.toLowerCase()).toContain('coke zero');
    expect(items[0].calories).toBe(0);
    expect(items[0].match_type).toMatch(/branded|generic_estimate/);
  });

  it('recovers reasonable Fairlife typo queries', async () => {
    const items = await parseItems('I had fairlife choclate shake');

    expect(items[0].food_name.toLowerCase()).toContain('fairlife');
    expect(items[0].source_name?.toLowerCase()).toContain('fairlife');
    expect(items[0].match_type).toMatch(/branded/);
  });
});

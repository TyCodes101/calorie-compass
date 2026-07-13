import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  MealAssistantItem,
  MealAssistantModelOutput,
  MealAssistantState,
} from '@/lib/ai/mealAssistantSchema';
import { createReadyPendingMeal, syncPendingMealWithCurrentItems } from '@/lib/ai/mealPendingState';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import { buildNutritionIntent, resolveBestNutritionCandidate } from '@/lib/nutrition/accuracyEngine';
import { buildProviderDisplayName } from '@/lib/nutrition/providers/providerNormalization';
import { usdaProvider } from '@/lib/nutrition/providers/usda';

function buildState(overrides: Partial<MealAssistantState> = {}): MealAssistantState {
  return {
    currentMealItems: [],
    pendingMeal: null,
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'snack',
    userName: 'Tyler',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  };
}

function item(name: string, overrides: Partial<ParsedFoodItem> = {}): ParsedFoodItem {
  return {
    food_name: name,
    quantity: 1,
    unit: 'serving',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 2,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    notes: 'Structured test fixture.',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Structured test provider',
    confidence_label: 'Matched',
    match_type: 'verified_database',
    matched_query: name,
    original_user_text: name,
    provider_used: 'test-provider',
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

function meal(items: ParsedFoodItem[], mealType: MealAssistantState['mealType']): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: 0.94,
    items,
    totals: {
      calories: items.reduce((sum, value) => sum + value.calories, 0),
      protein: items.reduce((sum, value) => sum + value.protein, 0),
      carbs: items.reduce((sum, value) => sum + value.carbs, 0),
      fat: items.reduce((sum, value) => sum + value.fat, 0),
      fiber: items.reduce((sum, value) => sum + value.fiber, 0),
      sugar: items.reduce((sum, value) => sum + value.sugar, 0),
      sodium: items.reduce((sum, value) => sum + value.sodium, 0),
    },
  };
}

function decision(items: MealAssistantItem[]): MealAssistantModelOutput {
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

async function offlineFirstTurn(message: string, state = buildState()) {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('USDA_FDC_API_KEY', '');
  vi.stubEnv('FDC_API_KEY', '');
  return runMealAssistant({ message, state });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('production food-resolution regressions', () => {
  it('does not materialize canonical and preparation aliases as two requested foods', async () => {
    const response = await runMealAssistant(
      { message: '200g chicken breast', state: buildState() },
      {
        classify: async () => decision([
          { name: 'chicken breast', brand: null, quantity: 200, unit: 'g', modifiers: [], action: 'add' },
          { name: 'grilled chicken breast', brand: null, quantity: 200, unit: 'g', modifiers: ['preparation: grilled'], action: 'add' },
        ]),
        resolveItemNutrition: async ({ item: parsed, mealType }) => meal([
          item(parsed.name, {
            food_name: parsed.name,
            quantity: 200,
            unit: 'g',
            calories: /grilled/.test(parsed.name) ? 330 : 320,
            protein: 62,
            carbs: 0,
            fat: 7,
          }),
        ], mealType),
      },
    );

    expect(response.meal.items).toHaveLength(1);
    expect(response.next_state.pendingMeal?.items).toHaveLength(1);
    expect(response.assistant_reply.match(/chicken breast/gi)).toHaveLength(1);
  });

  it('preserves prepared-state words in generic provider searches', () => {
    expect(normalizeFoodQuery('200g cooked white rice')).toMatchObject({
      quantity: 200,
      quantityUnit: 'g',
      searchText: expect.stringMatching(/cooked.*white.*rice|white.*rice.*cooked/i),
    });
    expect(normalizeFoodQuery('200g grilled chicken breast').searchText).toMatch(/grilled chicken breast/i);
    expect(normalizeFoodQuery('2 large eggs').searchText).toMatch(/large egg/i);
  });

  it('selects cooked rice over a dry USDA result and scales 200g once', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-usda-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      foods: [
        {
          fdcId: 1,
          description: 'Rice, white, long-grain, regular, raw, unenriched',
          dataType: 'SR Legacy',
          foodNutrients: [
            { nutrientName: 'Energy', nutrientNumber: '1008', unitName: 'kcal', value: 365 },
            { nutrientName: 'Protein', nutrientNumber: '1003', unitName: 'g', value: 7.1 },
            { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '1005', unitName: 'g', value: 80 },
            { nutrientName: 'Total lipid (fat)', nutrientNumber: '1004', unitName: 'g', value: 0.7 },
          ],
        },
        {
          fdcId: 2,
          description: 'Rice, white, long-grain, regular, cooked, enriched',
          dataType: 'SR Legacy',
          foodNutrients: [
            { nutrientName: 'Energy', nutrientNumber: '1008', unitName: 'kcal', value: 130 },
            { nutrientName: 'Protein', nutrientNumber: '1003', unitName: 'g', value: 2.7 },
            { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '1005', unitName: 'g', value: 28.2 },
            { nutrientName: 'Total lipid (fat)', nutrientNumber: '1004', unitName: 'g', value: 0.3 },
          ],
        },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const response = await usdaProvider.lookup({
      text: '200g cooked white rice',
      mealType: 'dinner',
      normalizedQuery: normalizeFoodQuery('200g cooked white rice'),
    });
    const rice = response?.items[0];

    expect(rice?.food_name).toMatch(/cooked/i);
    expect(rice).toMatchObject({ quantity: 200, unit: 'g' });
    expect(rice?.calories).toBeGreaterThanOrEqual(240);
    expect(rice?.calories).toBeLessThanOrEqual(300);
    expect(rice?.protein).toBeLessThanOrEqual(7);
    expect(rice?.fat).toBeLessThanOrEqual(2);
  });

  it('maps a USDA large-egg household measure to two eggs instead of 200 grams', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-usda-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      foods: [{
        fdcId: 3,
        description: 'Egg, whole, cooked',
        householdServingFullText: '1 large egg',
        foodMeasures: [{ disseminationText: '1 large egg', gramWeight: 50 }],
        dataType: 'Survey (FNDDS)',
        foodNutrients: [
          { nutrientName: 'Energy', nutrientNumber: '1008', unitName: 'kcal', value: 143 },
          { nutrientName: 'Protein', nutrientNumber: '1003', unitName: 'g', value: 12.6 },
          { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '1005', unitName: 'g', value: 0.7 },
          { nutrientName: 'Total lipid (fat)', nutrientNumber: '1004', unitName: 'g', value: 9.5 },
        ],
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const response = await usdaProvider.lookup({
      text: '2 large eggs',
      mealType: 'breakfast',
      normalizedQuery: normalizeFoodQuery('2 large eggs'),
    });
    const eggs = response?.items[0];

    expect(eggs).toMatchObject({
      quantity: 2,
      unit: 'egg',
      source_type: 'GENERIC_REFERENCE',
      provider_used: 'usda-fdc',
    });
    expect(eggs?.calories).toBeGreaterThanOrEqual(130);
    expect(eggs?.calories).toBeLessThanOrEqual(170);
    expect(eggs?.nutrition_basis?.scale_factor).toBe(2);
  });

  it('rejects an impossible cooked-starch candidate before final ranking', () => {
    const query = normalizeFoodQuery('200g cooked white rice');
    const intent = buildNutritionIntent({ text: '200g cooked white rice', mealType: 'dinner' }, query);
    const impossible = meal([item('Cooked white rice', {
      quantity: 200,
      unit: 'g',
      calories: 600,
      protein: 30,
      carbs: 70,
      fat: 24,
      provider_used: 'bad-provider',
    })], 'dinner');
    const plausible = meal([item('Rice, white, cooked', {
      quantity: 200,
      unit: 'g',
      calories: 260,
      protein: 5.4,
      carbs: 56.4,
      fat: 0.6,
      provider_used: 'usda-fdc',
    })], 'dinner');

    const resolution = resolveBestNutritionCandidate(intent, [
      { providerId: 'bad-provider', response: impossible },
      { providerId: 'usda-fdc', response: plausible },
    ]);

    expect(resolution.providerId).toBe('usda-fdc');
    expect(resolution.response?.items[0]?.calories).toBe(260);
  });

  it('does not prepend a brand already present in the provider product name', () => {
    expect(buildProviderDisplayName('Cheetos', "Cheetos Crunchy Flamin' Hot"))
      .toBe("Cheetos Crunchy Flamin' Hot");
    expect(buildProviderDisplayName("McDonald's", "McDonald's McDouble"))
      .toBe("McDonald's McDouble");
    expect(buildProviderDisplayName('Frito-Lay', "Cheetos Crunchy Flamin' Hot"))
      .toBe("Frito-Lay Cheetos Crunchy Flamin' Hot");
  });

  it('decomposes two eggs and a banana into two review and save items', async () => {
    const response = await offlineFirstTurn('2 eggs and a banana');
    const names = response.meal.items.map((value) => value.food_name).join(' | ');

    expect(response.meal.items).toHaveLength(2);
    expect(names).toMatch(/egg/i);
    expect(names).toMatch(/banana/i);
    expect(response.next_state.pendingMeal?.items).toHaveLength(2);
    expect(response.assistant_reply).toMatch(/egg/i);
    expect(response.assistant_reply).toMatch(/banana/i);
  });

  it('repairs a model response that collapses two eggs and a banana into one item', async () => {
    const response = await runMealAssistant(
      { message: '2 eggs and a banana', state: buildState() },
      {
        classify: async () => decision([{
          name: '2 eggs and a banana',
          brand: null,
          quantity: 2,
          unit: 'egg',
          modifiers: [],
          action: 'add',
        }]),
        resolveItemNutrition: async ({ item: parsed, mealType }) => {
          if (/egg/i.test(parsed.name)) {
            return meal([item('Eggs', {
              quantity: parsed.quantity,
              unit: 'egg',
              calories: 70 * parsed.quantity,
              protein: 6 * parsed.quantity,
            })], mealType);
          }
          return meal([item('Banana', {
            quantity: 1,
            unit: 'banana',
            calories: 105,
            protein: 1.3,
            carbs: 27,
            fat: 0.4,
          })], mealType);
        },
      },
    );

    expect(response.meal.items).toHaveLength(2);
    expect(response.meal.items.map((value) => value.food_name).join(' ')).toMatch(/egg/i);
    expect(response.meal.items.map((value) => value.food_name).join(' ')).toMatch(/banana/i);
    expect(response.next_state.pendingMeal?.items).toEqual(response.meal.items);
  });

  it('keeps restaurant modifiers visible and downgrades unresolved customized nutrition', async () => {
    const response = await offlineFirstTurn('McDouble no cheese no ketchup');
    const burger = response.meal.items.find((value) => /mcdouble/i.test(value.food_name));
    const metadata = `${burger?.notes ?? ''} ${burger?.matched_query ?? ''}`;

    expect(metadata).toMatch(/no cheese/i);
    expect(metadata).toMatch(/no ketchup/i);
    expect(burger?.confidence_label).toBe('Needs Review');
    expect(burger?.is_trusted).toBe(false);
  });

  it('resolves a plural restaurant quantity with modifiers and applies quantity once', async () => {
    const one = await offlineFirstTurn('McDouble no cheese');
    const two = await offlineFirstTurn('2 McDoubles no cheese');
    const oneBurger = one.meal.items.find((value) => /mcdouble/i.test(value.food_name));
    const twoBurger = two.meal.items.find((value) => /mcdouble/i.test(value.food_name));

    expect(twoBurger).toBeDefined();
    expect(twoBurger?.quantity).toBe(2);
    expect(twoBurger?.calories).toBeCloseTo((oneBurger?.calories ?? 0) * 2, 1);
    expect(`${twoBurger?.notes ?? ''} ${twoBurger?.matched_query ?? ''}`).toMatch(/no cheese/i);
  });

  it('keeps the selected structured product when an edit only changes serving', async () => {
    const selected = item("Cheetos Crunchy Flamin' Hot", {
      quantity: 28,
      unit: 'g',
      calories: 170,
      protein: 2,
      carbs: 15,
      fat: 11,
      source_name: 'Frito-Lay nutrition reference',
      provider_used: 'structured-provider',
      providerCandidateId: 'fixture:cheetos-flamin-hot',
      normalizedGrams: 28,
    });
    const state = createReadyPendingMeal({
      state: buildState(),
      items: [selected],
      rawText: 'flamin hot cheetos',
      replace: true,
    });

    const response = await offlineFirstTurn('flamin hot cheeots 1 oz', state);
    const edited = response.meal.items[0];

    expect(response.meal.items).toHaveLength(1);
    expect(edited.food_name).toBe("Cheetos Crunchy Flamin' Hot");
    expect(edited.food_name).not.toMatch(/^Cheetos Cheetos/i);
    expect(edited.source_type).toBe('GENERIC_REFERENCE');
    expect(edited.providerCandidateId).toBe('fixture:cheetos-flamin-hot');
    expect(edited.unit).toBe('oz');
    expect(edited.quantity).toBe(1);
    expect(edited.used_ai_fallback).toBe(false);
  });

  it('versions pending review when modifier truthfulness changes without changing macros', () => {
    const base = item('McDouble', {
      source_type: 'OFFICIAL_RESTAURANT',
      source_name: "McDonald's official nutrition",
      confidence_label: 'Verified',
      providerCandidateId: 'catalog:mcdouble',
    });
    const initial = createReadyPendingMeal({
      state: buildState(),
      items: [base],
      rawText: 'McDouble',
      replace: true,
    });
    const changed = syncPendingMealWithCurrentItems({
      ...initial,
      currentMealItems: [{
        ...base,
        is_trusted: false,
        confidence_label: 'Needs Review',
        requested_modifiers: ['no ketchup'],
        modifier_resolution: 'unresolved',
        review_status: 'required',
      }],
    });

    expect(changed.pendingMeal?.version).toBe((initial.pendingMeal?.version ?? 0) + 1);
    expect(changed.pendingMeal?.items[0]).toMatchObject({
      requested_modifiers: ['no ketchup'],
      modifier_resolution: 'unresolved',
      review_status: 'required',
    });
  });

  it('replaces stale Cheetos state with the finalized McDouble meal everywhere', async () => {
    const cheetos = item("Cheetos Crunchy Flamin' Hot", {
      source_name: 'Frito-Lay nutrition reference',
      providerCandidateId: 'fixture:cheetos',
    });
    const state = createReadyPendingMeal({
      state: buildState(),
      items: [cheetos],
      rawText: 'flamin hot cheetos',
      replace: true,
    });
    const response = await runMealAssistant(
      { message: 'McDouble no cheese no ketchup', state },
      {
        classify: async () => decision([{
          name: 'McDouble',
          brand: "McDonald's",
          quantity: 1,
          unit: 'burger',
          modifiers: ['no cheese', 'no ketchup'],
          action: 'add',
        }]),
        resolveItemNutrition: async ({ mealType }) => meal([item('McDouble', {
          quantity: 1,
          unit: 'burger',
          calories: 390,
          protein: 22,
          carbs: 33,
          fat: 19,
          source_type: 'OFFICIAL_RESTAURANT',
          source_name: "McDonald's official nutrition",
          providerCandidateId: 'catalog:mcdouble',
        })], mealType),
      },
    );

    const finalizedNames = response.meal.items.map((value) => value.food_name);
    expect(finalizedNames).toHaveLength(1);
    expect(finalizedNames[0]).toMatch(/McDouble/i);
    expect(response.next_state.currentMealItems.map((value) => value.food_name)).toEqual(finalizedNames);
    expect(response.next_state.pendingMeal?.items.map((value) => value.food_name)).toEqual(finalizedNames);
    expect(response.assistant_reply).toMatch(/McDouble/i);
    expect(response.assistant_reply).not.toMatch(/Cheetos/i);
    expect(response.meal.totals.calories).toBe(response.next_state.pendingMeal?.totals.calories);
  });

  it.each([
    ['chicken, rice, and broccoli', ['chicken', 'rice', 'broccoli']],
    ['burger with fries', ['burger', 'fries']],
  ])('decomposes independent foods in %s', async (message, expectedNames) => {
    const response = await offlineFirstTurn(message);
    const names = response.meal.items.map((value) => value.food_name.toLowerCase());

    expect(response.meal.items).toHaveLength(expectedNames.length);
    for (const expectedName of expectedNames) {
      expect(names.some((name) => name.includes(expectedName))).toBe(true);
    }
  });

  it.each([
    'mac and cheese',
    'peanut butter and jelly sandwich',
    'coffee with cream',
  ])('does not naively split the single-food phrase %s', async (message) => {
    const response = await offlineFirstTurn(message);

    expect(response.meal.items).toHaveLength(1);
  });

  it("asks for a Ben and Jerry's product instead of splitting or inventing one", async () => {
    const response = await offlineFirstTurn("Ben and Jerry's");

    expect(response.meal.items.length).toBeLessThanOrEqual(1);
    expect(response.next_state.pendingMeal).toBeNull();
    expect(`${response.assistant_reply} ${response.clarification_question ?? ''}`).toMatch(/which|what|product|flavor|food/i);
  });

  it.each([
    ['two bananas', 2, 'banana'],
    ['1.5 cups cooked rice', 1.5, 'rice'],
    ['half a banana', 0.5, 'banana'],
    ['2x McDouble', 2, 'mcdouble'],
  ])('normalizes quantity independently for %s', async (message, expectedQuantity, identity) => {
    const response = await offlineFirstTurn(message);
    const resolved = response.meal.items.find((value) => value.food_name.toLowerCase().includes(identity));

    expect(resolved).toBeDefined();
    expect(resolved?.quantity).toBeCloseTo(expectedQuantity, 2);
  });
});

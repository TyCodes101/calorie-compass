import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import { hydrateParsedMealWithProviders, lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import { createAiEstimateProvider } from '@/lib/nutrition/providers/aiEstimate';
import { localVerifiedCatalogProvider } from '@/lib/nutrition/providers/localVerifiedCatalog';

const usdaFoodsByQuery: Record<string, unknown[]> = {
  banana: [
    {
      description: 'Banana, raw',
      dataType: 'Foundation',
      servingSize: 1,
      servingSizeUnit: 'banana',
      householdServingFullText: '1 banana',
      foodNutrients: [
        { nutrientName: 'Energy', value: 105 },
        { nutrientName: 'Protein', value: 1.3 },
        { nutrientName: 'Carbohydrate, by difference', value: 27 },
        { nutrientName: 'Total lipid (fat)', value: 0.4 },
      ],
    },
  ],
  'rice cake': [
    {
      description: 'Rice cake, brown rice, plain',
      dataType: 'Foundation',
      servingSize: 1,
      servingSizeUnit: 'cake',
      householdServingFullText: '1 cake',
      foodNutrients: [
        { nutrientName: 'Energy', value: 35 },
        { nutrientName: 'Protein', value: 0.7 },
        { nutrientName: 'Carbohydrate, by difference', value: 7.3 },
        { nutrientName: 'Total lipid (fat)', value: 0.3 },
      ],
    },
  ],
  'quaker oats white cheddar rice cake': [
    {
      description: 'Quaker Rice Crisps White Cheddar',
      brandOwner: 'Quaker Oats',
      dataType: 'Branded',
      servingSize: 1,
      servingSizeUnit: 'cake',
      householdServingFullText: '1 cake',
      foodNutrients: [
        { nutrientName: 'Energy', value: 55 },
        { nutrientName: 'Protein', value: 1 },
        { nutrientName: 'Carbohydrate, by difference', value: 11 },
        { nutrientName: 'Total lipid (fat)', value: 1.5 },
      ],
    },
  ],
  'quaker oats rice cake': [
    {
      description: 'Quaker Rice Cakes',
      brandOwner: 'Quaker Oats',
      dataType: 'Branded',
      servingSize: 1,
      servingSizeUnit: 'cake',
      householdServingFullText: '1 cake',
      foodNutrients: [
        { nutrientName: 'Energy', value: 50 },
        { nutrientName: 'Protein', value: 1 },
        { nutrientName: 'Carbohydrate, by difference', value: 11 },
        { nutrientName: 'Total lipid (fat)', value: 0.5 },
      ],
    },
  ],
  'grilled chicken breast': [
    {
      description: 'Chicken breast, grilled',
      dataType: 'Foundation',
      servingSize: 1,
      servingSizeUnit: 'breast',
      householdServingFullText: '1 breast',
      foodNutrients: [
        { nutrientName: 'Energy', value: 187 },
        { nutrientName: 'Protein', value: 35 },
        { nutrientName: 'Carbohydrate, by difference', value: 0 },
        { nutrientName: 'Total lipid (fat)', value: 4 },
      ],
    },
  ],
  'protein bar': [
    {
      description: 'Protein bar',
      brandOwner: 'Quest',
      dataType: 'Branded',
      servingSize: 1,
      servingSizeUnit: 'bar',
      householdServingFullText: '1 bar',
      foodNutrients: [
        { nutrientName: 'Energy', value: 200 },
        { nutrientName: 'Protein', value: 20 },
        { nutrientName: 'Carbohydrate, by difference', value: 21 },
        { nutrientName: 'Total lipid (fat)', value: 8 },
      ],
    },
  ],
  taco: [
    {
      description: 'Taco with beef, cheese and lettuce, hard shell',
      dataType: 'Foundation',
      servingSize: 1,
      servingSizeUnit: 'taco',
      householdServingFullText: '1 taco',
      foodNutrients: [
        { nutrientName: 'Energy', value: 170 },
        { nutrientName: 'Protein', value: 8 },
        { nutrientName: 'Carbohydrate, by difference', value: 13 },
        { nutrientName: 'Total lipid (fat)', value: 9 },
      ],
    },
  ],
  'cottage cheese': [
    {
      description: 'COTTAGE CHEESE',
      brandOwner: 'Belfonte Ice Cream',
      dataType: 'Branded',
      servingSize: 100,
      servingSizeUnit: 'g',
      householdServingFullText: '100 g',
      foodNutrients: [
        { nutrientName: 'Energy', nutrientNumber: '1008', unitName: 'KCAL', value: 92.14 },
        { nutrientName: 'Protein', nutrientNumber: '1003', value: 11.5 },
        { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '1005', value: 3.54 },
        { nutrientName: 'Total lipid (fat)', nutrientNumber: '1004', value: 2.65 },
      ],
    },
    {
      description: 'Cottage cheese, 2% milkfat',
      fdcId: 170851,
      dataType: 'Foundation',
      servingSize: 100,
      servingSizeUnit: 'g',
      householdServingFullText: '100 g',
      foodNutrients: [
        { nutrientName: 'Energy', nutrientNumber: '1008', unitName: 'KCAL', value: 84 },
        { nutrientName: 'Protein', nutrientNumber: '1003', value: 11 },
        { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '1005', value: 4.3 },
        { nutrientName: 'Total lipid (fat)', nutrientNumber: '1004', value: 2.3 },
      ],
    },
  ],
  'cheese cottage nfs': [
    {
      fdcId: 2705747,
      description: 'Cheese, cottage, NFS',
      dataType: 'Survey (FNDDS)',
      foodNutrients: [
        { nutrientName: 'Energy', nutrientNumber: '1008', unitName: 'KCAL', value: 98 },
        { nutrientName: 'Protein', nutrientNumber: '1003', value: 11.1 },
        { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '1005', value: 3.4 },
        { nutrientName: 'Total lipid (fat)', nutrientNumber: '1004', value: 4.3 },
      ],
    },
  ],
};

function installUsdaFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string };
    const query = String(body.query ?? '').toLowerCase();

    return {
      ok: true,
      json: async () => ({
        foods: usdaFoodsByQuery[query] ?? [],
      }),
    };
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeFoodQuery', () => {
  it('normalizes trusted brand aliases and quantity', () => {
    expect(normalizeFoodQuery('mcdouble')).toMatchObject({
      searchText: 'mcdonalds mcdouble',
      matchedQuery: "McDonald's McDouble",
      quantity: 1,
    });

    expect(normalizeFoodQuery('mc double')).toMatchObject({
      searchText: 'mcdonalds mcdouble',
      matchedQuery: "McDonald's McDouble",
    });

    expect(normalizeFoodQuery('2 mcdoubles')).toMatchObject({
      searchText: 'mcdonalds mcdouble',
      matchedQuery: "McDonald's McDouble",
      quantity: 2,
    });

    expect(normalizeFoodQuery('tacobell taco')).toMatchObject({
      searchText: 'taco bell crunchy taco',
      matchedQuery: 'Taco Bell Crunchy Taco',
    });

    expect(normalizeFoodQuery('chipolte bowl')).toMatchObject({
      searchText: 'chipotle bowl',
    });

    expect(normalizeFoodQuery('rice cakes')).toMatchObject({
      searchText: 'rice cake',
      matchedQuery: 'Rice cakes',
    });

    expect(normalizeFoodQuery('3 quaker oats rice cakes white cheddar')).toMatchObject({
      searchText: 'quaker oats white cheddar rice cake',
      matchedQuery: 'Quaker Oats White Cheddar Rice cakes',
      quantity: 3,
    });

    expect(normalizeFoodQuery('they were rice cakes')).toMatchObject({
      searchText: 'rice cake',
    });

    expect(normalizeFoodQuery('24 grams cottage cheese')).toMatchObject({
      searchText: 'cottage cheese',
      matchedQuery: 'Cottage Cheese',
      quantity: 24,
      quantityUnit: 'g',
    });

    expect(normalizeFoodQuery('24 grams cotaage cheese')).toMatchObject({
      searchText: 'cottage cheese',
      matchedQuery: 'Cottage Cheese',
      quantity: 24,
      quantityUnit: 'g',
    });

    expect(normalizeFoodQuery('little ceasers pizza')).toMatchObject({
      normalizedText: 'little caesars pizza',
      brandHint: 'Little Caesars',
    });

    expect(normalizeFoodQuery('2 pieces toast')).toMatchObject({
      searchText: 'toast',
      matchedQuery: 'Toast',
      quantity: 2,
      quantityUnit: 'piece',
    });
  });
});

describe('lookupNutrition', () => {
  it('returns the verified McDouble override for mcdouble queries', async () => {
    const response = await lookupNutrition({ text: 'mcdouble', mealType: 'lunch' });

    expect(response).not.toBeNull();
    expect(response?.items[0]).toMatchObject({
      food_name: "McDonald's McDouble",
      calories: 390,
      protein: 22,
      carbs: 33,
      fat: 20,
      source_type: 'OFFICIAL_RESTAURANT',
      confidence_label: 'Very High',
      matched_query: "McDonald's McDouble",
      provider_used: 'local-verified-catalog',
      used_ai_fallback: false,
    });
    expect(response?.totals.calories).toBe(390);
  });

  it('returns the verified McDouble override for article-prefixed queries', async () => {
    const response = await lookupNutrition({ text: 'a mcdouble', mealType: 'lunch' });

    expect(response?.items[0]?.calories).toBe(390);
    expect(response?.items[0]?.confidence_label).toBe('Very High');
  });

  it('scales quantities for verified restaurant items', async () => {
    const doubles = await lookupNutrition({ text: '2 mcdoubles', mealType: 'lunch' });
    const tacos = await lookupNutrition({ text: '2 taco bell crunchy tacos', mealType: 'lunch' });

    expect(doubles?.items[0]?.quantity).toBe(2);
    expect(doubles?.totals.calories).toBe(780);
    expect(tacos?.items[0]?.quantity).toBe(2);
    expect(tacos?.totals.calories).toBe(340);
  });

  it('attempts USDA lookup for everyday generic foods', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();

    const banana = await lookupNutrition({ text: 'banana', mealType: 'snack' });
    const riceCakes = await lookupNutrition({ text: 'rice cakes', mealType: 'snack' });
    const chicken = await lookupNutrition({ text: 'grilled chicken breast', mealType: 'lunch' });
    const proteinBar = await lookupNutrition({ text: 'protein bar', mealType: 'snack' });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).query)).toEqual([
      'banana',
      'rice cake',
      'grilled chicken breast',
      'protein bar',
    ]);
    expect(banana?.items[0]).toMatchObject({
      source_name: 'USDA FoodData Central',
      provider_used: 'usda-fdc',
      confidence_label: 'High confidence',
    });
    expect(riceCakes?.items[0]?.food_name).toMatch(/rice cake/i);
    expect(chicken?.items[0]?.food_name).toMatch(/chicken breast/i);
    expect(proteinBar?.items[0]?.food_name).toMatch(/quest protein bar/i);
  });

  it('matches branded rice cakes without collapsing them into generic rice', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();

    const whiteCheddar = await lookupNutrition({ text: '3 quaker oats rice cakes white cheddar', mealType: 'snack' });
    const quaker = await lookupNutrition({ text: 'quaker rice cakes', mealType: 'snack' });
    const plain = await lookupNutrition({ text: 'rice cakes', mealType: 'snack' });

    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).query)).toEqual(['rice cake']);
    expect(whiteCheddar?.items[0]).toMatchObject({
      food_name: 'Quaker White Cheddar Rice Cakes',
      quantity: 3,
      provider_used: 'local-verified-catalog',
    });
    expect(quaker?.items[0]).toMatchObject({
      food_name: 'Quaker Rice Cakes',
      provider_used: 'local-verified-catalog',
    });
    expect(plain?.items[0]?.food_name).toMatch(/rice cake/i);
  });

  it('uses USDA FoodData Central for generic foods that are not in the local catalog', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();

    const response = await lookupNutrition({ text: 'cottage cheese', mealType: 'snack' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response?.items[0]).toMatchObject({
      food_name: 'Cottage cheese, 2% milkfat',
      source_name: 'USDA FoodData Central',
      confidence_label: 'High confidence',
      matched_query: 'Cottage Cheese',
    });
    expect(response?.totals.calories).toBe(84);
  });

  it('uses the USDA DEMO_KEY fallback outside test mode when no private key is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
    const fetchMock = installUsdaFetchMock();

    const response = await lookupNutrition({ text: 'cottage cheese', mealType: 'snack' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api_key=DEMO_KEY');
    expect(response?.items[0]?.provider_used).toBe('usda-fdc');
  });

  it('scales USDA FoodData Central matches by explicit gram amounts', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();

    const response = await lookupNutrition({ text: '24 grams cotaage cheese', mealType: 'snack' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      query: 'cottage cheese',
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
    });
    expect(response?.items[0]).toMatchObject({
      food_name: 'Cottage cheese, 2% milkfat',
      quantity: 24,
      unit: 'g',
      source_name: 'USDA FoodData Central',
      provider_used: 'usda-fdc',
    });
    expect(response?.totals.calories).toBeCloseTo(20.16, 2);
    expect(response?.items[0]?.notes).toMatch(/FDC 170851/i);
  });

  it('treats generic USDA rows without serving units as per-100g for gram scaling', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();

    const response = await lookupNutrition({ text: '24 grams cheese cottage nfs', mealType: 'snack' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response?.items[0]).toMatchObject({
      food_name: 'Cheese, cottage, NFS',
      quantity: 24,
      unit: 'g',
      source_name: 'USDA FoodData Central',
      provider_used: 'usda-fdc',
    });
    expect(response?.totals.calories).toBeCloseTo(23.52, 2);
  });

  it('does not mistake gram amounts for branded protein claims', async () => {
    const response = await lookupNutrition(
      { text: '24 grams cottage cheese', mealType: 'snack' },
      { providers: [localVerifiedCatalogProvider] },
    );

    expect(response).toBeNull();
  });

  it('uses the local verified override before USDA for mcdouble', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();

    const response = await lookupNutrition({ text: 'mcdouble', mealType: 'lunch' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response?.items[0]?.provider_used).toBe('local-verified-catalog');
  });

  it('hydrates multi-item meals by looking up each item separately', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();

    const response = await hydrateParsedMealWithProviders(
      normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'lunch',
        confidence_score: 0.66,
        items: [
          {
            food_name: 'tacos',
            quantity: 2,
            unit: 'taco',
            calories: 320,
            protein: 12,
            carbs: 26,
            fat: 16,
            fiber: 4,
            sugar: 2,
            sodium: 600,
            notes: 'Initial AI parse.',
          },
          {
            food_name: 'McDouble',
            quantity: 1,
            unit: 'burger',
            calories: 300,
            protein: 15,
            carbs: 30,
            fat: 12,
            fiber: 2,
            sugar: 6,
            sodium: 700,
            notes: 'Initial AI parse.',
          },
        ],
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).query).toBe('taco');
    expect(response.items).toHaveLength(2);
    expect(response.items[0]).toMatchObject({
      provider_used: 'usda-fdc',
      source_name: 'USDA FoodData Central',
    });
    expect(response.items[1]).toMatchObject({
      food_name: "McDonald's McDouble",
      provider_used: 'local-verified-catalog',
      confidence_label: 'Very High',
    });
    expect(response.totals.calories).toBe(730);
  });


  it('asks for clarification instead of using an unsupported restaurant or brand mismatch', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        foods: [
          {
            description: 'Chick-fil-A Chicken Sandwich',
            brandOwner: 'Chick-fil-A',
            dataType: 'Branded',
            servingSize: 1,
            servingSizeUnit: 'sandwich',
            foodNutrients: [
              { nutrientName: 'Energy', value: 420 },
              { nutrientName: 'Protein', value: 29 },
              { nutrientName: 'Carbohydrate, by difference', value: 41 },
              { nutrientName: 'Total lipid (fat)', value: 18 },
            ],
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await lookupNutrition({ text: "Wendy's Dave's Single", mealType: 'lunch' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      needs_clarification: true,
      items: [],
    });
    expect(response?.clarifying_question).toMatch(/Wendy's/i);
  });

  it('uses supporting USDA data only when it matches the requested brand intent', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        foods: [
          {
            description: 'Dunkin Cold Brew Coffee',
            brandOwner: 'Dunkin',
            dataType: 'Branded',
            servingSize: 1,
            servingSizeUnit: 'medium',
            foodNutrients: [
              { nutrientName: 'Energy', value: 5 },
              { nutrientName: 'Protein', value: 0 },
              { nutrientName: 'Carbohydrate, by difference', value: 1 },
              { nutrientName: 'Total lipid (fat)', value: 0 },
            ],
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await lookupNutrition({ text: 'Dunkin cold brew', mealType: 'snack' });

    expect(response?.needs_clarification).toBe(false);
    expect(response?.items[0]).toMatchObject({
      food_name: 'Dunkin Dunkin Cold Brew Coffee',
      provider_used: 'usda-fdc',
    });
  });

  it('uses AI only after database providers fail, and not before', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', 'test-key');
    const fetchMock = installUsdaFetchMock();
    const aiLookup = vi.fn(async ({ text, mealType }: { text: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' }) =>
      normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: mealType,
        confidence_score: 0.62,
        items: [
          {
            food_name: text,
            quantity: 1,
            unit: 'serving',
            calories: 250,
            protein: 10,
            carbs: 20,
            fat: 10,
            fiber: 2,
            sugar: 3,
            sodium: 180,
            notes: 'No verified match found, estimated with AI.',
            is_trusted: false,
            source_type: 'AI_ESTIMATE',
            source_name: 'AI estimate',
            confidence_label: 'Estimated',
            matched_query: text,
            provider_used: 'ai-estimate-fallback',
            used_ai_fallback: true,
            catalog_food_id: null,
          },
        ],
      }),
    );

    const aiProvider = createAiEstimateProvider(aiLookup);

    const localMatch = await lookupNutrition({ text: 'mcdouble', mealType: 'lunch' }, { aiEstimateProvider: aiProvider });
    const fallback = await lookupNutrition({ text: 'mystery casserole surprise', mealType: 'dinner' }, { aiEstimateProvider: aiProvider });

    expect(localMatch?.items[0]?.confidence_label).toBe('Very High');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(aiLookup).toHaveBeenCalledTimes(1);
    expect(fallback?.items[0]).toMatchObject({
      source_type: 'AI_ESTIMATE',
      confidence_label: 'Estimated',
      provider_used: 'ai-estimate-fallback',
      used_ai_fallback: true,
    });
  });

  it('always includes source and confidence metadata on returned items', async () => {
    const verified = await lookupNutrition({ text: 'mcdouble', mealType: 'lunch' });

    expect(verified?.items[0]?.source_name).toBeTruthy();
    expect(verified?.items[0]?.confidence_label).toBeTruthy();
    expect(verified?.items[0]?.matched_query).toBeTruthy();
    expect(verified?.items[0]?.original_user_text).toBeTruthy();
    expect(verified?.items[0]?.provider_used).toBeTruthy();
    expect(typeof verified?.items[0]?.used_ai_fallback).toBe('boolean');
  });
});

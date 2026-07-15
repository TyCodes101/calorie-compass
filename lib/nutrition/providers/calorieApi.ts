import { z } from 'zod';

import type { ParsedMealResponse } from '@/lib/ai/types';
import type { NutritionLookupProvider, NormalizedFoodQuery } from '@/lib/nutrition/types';
import { normalizeServingUnit, isCountableServingUnit } from '@/lib/nutrition/scaling';
import {
  buildBarcodeMealResponse,
  buildProviderMealResponse,
  normalizeProviderText,
  providerTokenMatches,
  providerTextTokens,
  scalePer100g,
  toFiniteNonnegative,
  type NormalizedProviderFood,
} from '@/lib/nutrition/providers/providerNormalization';
import { validateNutritionFacts, type NutritionFacts } from '@/lib/nutrition/providers/nutritionPlausibility';
import { buildProviderCacheKey, withProviderCache } from '@/lib/nutrition/providers/providerCache';
import { getCalorieApiConfiguration } from '@/lib/nutrition/providers/providerConfig';
import { requestProviderJson } from '@/lib/nutrition/providers/providerHttp';

const CALORIE_API_ORIGIN = 'https://calorieapiadmin.com';
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1_000;
const DETAILS_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const BARCODE_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const BARCODE_MISS_TTL_MS = 5 * 60 * 1_000;

const numericValue = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim()) return Number(value);
  return value;
}, z.number().finite().nonnegative());

const identifier = z.union([z.string().min(1), z.number().finite()]).transform(String);

const searchEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
  total: numericValue.optional(),
  skip: numericValue.optional(),
  limit: numericValue.optional(),
}).passthrough();

const calorieApiFoodSchema = z.object({
  id: identifier,
  name: z.string().trim().min(1),
  brand_name: z.string().trim().min(1).nullable().optional(),
  category_name: z.string().trim().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  is_verified: z.boolean().optional(),
  match_type: z.string().nullable().optional(),
  search_score: numericValue.optional(),
  serving_size: numericValue.nullable().optional(),
  serving_unit: z.string().trim().min(1).nullable().optional(),
  serving: z.unknown().optional(),
  upc: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  calories_100g: numericValue,
  protein_100g: numericValue,
  carbs_100g: numericValue,
  fat_100g: numericValue,
  fiber_100g: numericValue.optional().default(0),
  sugar_100g: numericValue.optional().default(0),
}).passthrough();

const nullableNumericValue = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return Number(value);
  return value;
}, z.number().finite().nonnegative().nullable());

const barcodeMacrosSchema = z.object({
  energy_kcal: nullableNumericValue.optional().default(null),
  protein_g: nullableNumericValue.optional().default(null),
  carbohydrates_g: nullableNumericValue.optional().default(null),
  fat_g: nullableNumericValue.optional().default(null),
  fiber_g: nullableNumericValue.optional().default(null),
  sugars_g: nullableNumericValue.optional().default(null),
  sodium_g: nullableNumericValue.optional().default(null),
}).passthrough();

const barcodeResponseSchema = z.object({
  barcode: z.union([z.string(), z.number()]).transform(String),
  product: z.object({
    name: z.string().trim().min(1),
    brand: z.string().trim().min(1).nullable().optional(),
    category: z.string().trim().min(1).nullable().optional(),
    generic_name: z.string().nullable().optional(),
    quantity: z.string().nullable().optional(),
  }).passthrough(),
  serving: z.object({
    label: z.string().nullable().optional(),
    quantity: nullableNumericValue.optional().default(null),
    unit: z.string().nullable().optional(),
  }).nullable().optional(),
  nutrition_per_100g: barcodeMacrosSchema,
  nutrition_per_serving: barcodeMacrosSchema.nullable().optional(),
}).passthrough();

type CalorieApiFood = z.infer<typeof calorieApiFoodSchema>;
type CalorieApiBarcodeResponse = z.infer<typeof barcodeResponseSchema>;

function providerHeaders(apiKey: string) {
  return {
    'X-API-Key': apiKey,
  };
}

function factsFromPer100g(food: CalorieApiFood): NutritionFacts {
  return {
    calories: food.calories_100g,
    protein: food.protein_100g,
    carbs: food.carbs_100g,
    fat: food.fat_100g,
    fiber: food.fiber_100g,
    sugar: food.sugar_100g,
    sodium: 0,
  };
}

function factsFromBarcodeMacros(macros: z.infer<typeof barcodeMacrosSchema>): NutritionFacts | null {
  const calories = macros.energy_kcal;
  const protein = macros.protein_g;
  const carbs = macros.carbohydrates_g;
  const fat = macros.fat_g;
  if (calories === null || protein === null || carbs === null || fat === null) return null;

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: macros.fiber_g ?? 0,
    sugar: macros.sugars_g ?? 0,
    sodium: (macros.sodium_g ?? 0) * 1_000,
  };
}

function servingObject(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const quantity = toFiniteNonnegative(record.quantity ?? record.amount ?? record.serving_size);
  const unit = typeof (record.unit ?? record.serving_unit) === 'string'
    ? normalizeServingUnit(String(record.unit ?? record.serving_unit))
    : null;
  const label = typeof (record.label ?? record.description) === 'string'
    ? String(record.label ?? record.description)
    : null;
  const grams = toFiniteNonnegative(record.weight_grams ?? record.grams ?? record.metric_serving_amount);
  return { quantity, unit, label, grams };
}

function servingWeightGrams(food: CalorieApiFood) {
  const nested = servingObject(food.serving);
  if (nested?.grams) return nested.grams;

  const amount = food.serving_size ?? nested?.quantity ?? null;
  const unit = normalizeServingUnit(food.serving_unit ?? nested?.unit);
  if (!amount || !unit) return null;
  if (unit === 'g') return amount;
  if (unit === 'oz') return amount * 28.3495;
  return null;
}

function identityScore(food: CalorieApiFood, query: NormalizedFoodQuery) {
  const candidateText = normalizeProviderText(`${food.brand_name ?? ''} ${food.name}`);
  const candidateTokens = providerTextTokens(candidateText);
  const queryText = normalizeProviderText(query.searchText);
  const queryTokens = providerTextTokens(queryText).filter((token) => !['food', 'serving', 'one', 'two'].includes(token));
  const matchedTokens = queryTokens.filter((token) => providerTokenMatches(token, candidateTokens));

  if (query.brandHint) {
    const brandTokens = providerTextTokens(query.brandHint);
    if (!brandTokens.every((token) => candidateText.includes(token))) return null;
  }

  if (queryTokens.length && matchedTokens.length / queryTokens.length < 0.6) return null;

  let score = matchedTokens.length * 16;
  if (candidateText === queryText) score += 45;
  else if (candidateText.includes(queryText) || queryText.includes(candidateText)) score += 25;
  if (query.brandHint) score += 35;
  if (food.is_verified) score += 4;
  score += Math.min(food.search_score ?? 0, 10);
  return score;
}

function searchFoodToCandidate(food: CalorieApiFood, query: NormalizedFoodQuery): NormalizedProviderFood | null {
  const per100g = factsFromPer100g(food);
  if (!validateNutritionFacts(per100g, { basis: 'per_100g' }).valid) return null;

  const requestedUnit = normalizeServingUnit(query.quantityUnit ?? query.unitHint);
  const weight = servingWeightGrams(food);
  const nestedServing = servingObject(food.serving);
  const providerUnit = normalizeServingUnit(food.serving_unit ?? nestedServing?.unit);
  const identityText = normalizeProviderText(`${food.name} ${food.description ?? ''}`);
  let servingQuantity = 100;
  let servingUnit = 'g';
  let servingNutrition = per100g;
  let servingDescription = '100 g';
  let servingWeight = 100;

  if (weight) {
    const canUseRequestedNaturalUnit = requestedUnit
      && isCountableServingUnit(requestedUnit)
      && (identityText.includes(requestedUnit) || providerUnit === 'serving');
    servingQuantity = canUseRequestedNaturalUnit
      ? 1
      : providerUnit && !['g', 'oz'].includes(providerUnit)
        ? nestedServing?.quantity ?? food.serving_size ?? 1
        : food.serving_size ?? weight;
    servingUnit = canUseRequestedNaturalUnit
      ? requestedUnit
      : providerUnit ?? 'g';
    servingNutrition = scalePer100g(per100g, weight);
    servingDescription = nestedServing?.label ?? `${servingQuantity} ${servingUnit}`;
    servingWeight = weight;
  }

  if (!validateNutritionFacts(servingNutrition, { servingWeightGrams: servingWeight }).valid) return null;

  const exactBrandMatch = Boolean(query.brandHint && identityScore(food, query) !== null);
  return {
    providerId: 'calorie-api',
    providerFoodId: food.id,
    name: food.name,
    brand: food.brand_name ?? null,
    barcode: food.upc ?? null,
    servingQuantity,
    servingUnit,
    servingWeightGrams: servingWeight,
    servingDescription,
    nutrition: servingNutrition,
    sourceName: 'Calorie API database',
    confidence: Math.min(food.is_verified ? 0.84 : 0.78, exactBrandMatch ? 0.84 : 0.8),
    exactBrandMatch,
  };
}

function barcodeToCandidate(payload: CalorieApiBarcodeResponse): NormalizedProviderFood | null {
  const perServing = payload.nutrition_per_serving ? factsFromBarcodeMacros(payload.nutrition_per_serving) : null;
  const per100g = factsFromBarcodeMacros(payload.nutrition_per_100g);
  const unit = normalizeServingUnit(payload.serving?.unit) ?? 'serving';
  const quantity = payload.serving?.quantity && payload.serving.quantity > 0 ? payload.serving.quantity : 1;
  const weight = unit === 'g'
    ? quantity
    : unit === 'oz'
      ? quantity * 28.3495
      : null;
  const nutrition = perServing ?? (per100g && weight ? scalePer100g(per100g, weight) : null);
  if (!nutrition || !validateNutritionFacts(nutrition, { servingWeightGrams: weight }).valid) return null;

  return {
    providerId: 'calorie-api',
    providerFoodId: payload.barcode,
    name: payload.product.name,
    brand: payload.product.brand ?? null,
    barcode: payload.barcode,
    servingQuantity: quantity,
    servingUnit: unit,
    servingWeightGrams: weight,
    servingDescription: payload.serving?.label ?? `${quantity} ${unit}`,
    nutrition,
    sourceName: 'Calorie API barcode database',
    confidence: 0.9,
    exactBrandMatch: Boolean(payload.product.brand),
  };
}

async function searchFoods(query: NormalizedFoodQuery) {
  const config = getCalorieApiConfiguration();
  if (!config.configured || !config.apiKey) return [];

  const key = buildProviderCacheKey('calorie-api:v1:search', {
    query: normalizeProviderText(query.searchText),
    brand: normalizeProviderText(query.brandHint),
    limit: 10,
  });
  const cached = await withProviderCache({
    key,
    ttlMs: SEARCH_CACHE_TTL_MS,
    load: async () => {
      const url = new URL(`${config.baseUrl}/search/foods`);
      url.searchParams.set('q', query.searchText.slice(0, 180));
      url.searchParams.set('limit', '10');
      url.searchParams.set('skip', '0');
      url.searchParams.set('match_mode', 'any');
      if (query.brandHint) url.searchParams.set('brand', query.brandHint);

      const result = await requestProviderJson({
        url: url.toString(),
        allowedOrigins: [CALORIE_API_ORIGIN],
        init: { headers: providerHeaders(config.apiKey as string) },
        schema: searchEnvelopeSchema,
        timeoutMs: config.timeoutMs,
      });
      if (!result) return [];

      return result.data.data
        .map((item) => calorieApiFoodSchema.safeParse(item))
        .filter((item): item is { success: true; data: CalorieApiFood } => item.success)
        .map((item) => item.data);
    },
  });

  return cached.value ?? [];
}

async function lookupBarcodeCandidate(barcode: string) {
  const config = getCalorieApiConfiguration();
  if (!config.configured || !config.apiKey) return null;
  const key = buildProviderCacheKey('calorie-api:v1:barcode', barcode);
  const cached = await withProviderCache({
    key,
    ttlMs: BARCODE_CACHE_TTL_MS,
    negativeTtlMs: BARCODE_MISS_TTL_MS,
    load: async () => {
      const result = await requestProviderJson({
        url: `${config.baseUrl}/search/barcode/${encodeURIComponent(barcode)}`,
        allowedOrigins: [CALORIE_API_ORIGIN],
        init: { headers: providerHeaders(config.apiKey as string) },
        schema: barcodeResponseSchema,
        timeoutMs: config.timeoutMs,
        notFoundIsNull: true,
      });
      return result?.data ?? null;
    },
  });
  return cached.value ? barcodeToCandidate(cached.value) : null;
}

async function getFoodDetailsCandidate(providerFoodId: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(providerFoodId)) return null;
  const config = getCalorieApiConfiguration();
  if (!config.configured || !config.apiKey) return null;
  const key = buildProviderCacheKey('calorie-api:v1:food', providerFoodId);
  const cached = await withProviderCache({
    key,
    ttlMs: DETAILS_CACHE_TTL_MS,
    load: async () => {
      const result = await requestProviderJson({
        url: `${config.baseUrl}/foods/${encodeURIComponent(providerFoodId)}`,
        allowedOrigins: [CALORIE_API_ORIGIN],
        init: { headers: providerHeaders(config.apiKey as string) },
        schema: z.unknown(),
        timeoutMs: config.timeoutMs,
        notFoundIsNull: true,
      });
      if (!result) return null;
      const payload = result.data as Record<string, unknown>;
      const parsed = calorieApiFoodSchema.safeParse(payload.data ?? payload.food ?? payload);
      return parsed.success ? parsed.data : null;
    },
  });
  return cached.value;
}

export const calorieApiProvider: NutritionLookupProvider = {
  id: 'calorie-api',
  capabilities: { search: true, barcode: true, details: true, suggest: false },
  getStatus() {
    const config = getCalorieApiConfiguration();
    return {
      configured: config.configured,
      reason: config.configured ? undefined : `calorie_api_${config.reason ?? 'not_configured'}`,
    };
  },
  async searchCandidates({ mealType, normalizedQuery, trace }) {
    const foods = await searchFoods(normalizedQuery);
    return foods
      .map((food) => ({ food, score: identityScore(food, normalizedQuery) }))
      .filter((entry): entry is { food: CalorieApiFood; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map((entry) => searchFoodToCandidate(entry.food, normalizedQuery))
      .filter((entry): entry is NormalizedProviderFood => Boolean(entry))
      .map((candidate) => buildProviderMealResponse({ candidate, normalizedQuery, mealType, trace }))
      .filter((response): response is ParsedMealResponse => Boolean(response));
  },
  async lookup({ mealType, normalizedQuery, trace }) {
    const foods = await searchFoods(normalizedQuery);
    const candidate = foods
      .map((food) => ({ food, score: identityScore(food, normalizedQuery) }))
      .filter((entry): entry is { food: CalorieApiFood; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score)
      .map((entry) => searchFoodToCandidate(entry.food, normalizedQuery))
      .find((entry): entry is NormalizedProviderFood => Boolean(entry));

    return candidate ? buildProviderMealResponse({ candidate, normalizedQuery, mealType, trace }) : null;
  },
  async lookupBarcode({ barcode, mealType }) {
    const candidate = await lookupBarcodeCandidate(barcode);
    return candidate ? buildBarcodeMealResponse({ candidate, mealType }) : null;
  },
  async getFoodDetails({ providerFoodId, mealType }) {
    const food = await getFoodDetailsCandidate(providerFoodId);
    if (!food) return null;
    const query: NormalizedFoodQuery = {
      rawText: food.name,
      normalizedText: food.name,
      searchText: food.name,
      matchedQuery: food.name,
      quantity: 1,
      quantityUnit: null,
      unitHint: null,
      brandHint: food.brand_name ?? null,
    };
    const candidate = searchFoodToCandidate(food, query);
    return candidate ? buildProviderMealResponse({ candidate, normalizedQuery: query, mealType }) : null;
  },
};

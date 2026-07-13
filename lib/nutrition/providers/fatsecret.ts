import { z } from 'zod';

import type { NormalizedFoodQuery, NutritionLookupProvider } from '@/lib/nutrition/types';
import { normalizeServingUnit } from '@/lib/nutrition/scaling';
import {
  buildBarcodeMealResponse,
  buildProviderMealResponse,
  normalizeProviderText,
  parseServingText,
  providerTokenMatches,
  providerTextTokens,
  type NormalizedProviderFood,
} from '@/lib/nutrition/providers/providerNormalization';
import { validateNutritionFacts, type NutritionFacts } from '@/lib/nutrition/providers/nutritionPlausibility';
import { buildProviderCacheKey, withProviderCache } from '@/lib/nutrition/providers/providerCache';
import {
  FATSECRET_API_BASE_URL,
  FATSECRET_TOKEN_URL,
  fatSecretScopeSupports,
  getFatSecretConfiguration,
} from '@/lib/nutrition/providers/providerConfig';
import { NutritionProviderError, requestProviderJson } from '@/lib/nutrition/providers/providerHttp';

const FATSECRET_API_ORIGIN = 'https://platform.fatsecret.com';
const FATSECRET_OAUTH_ORIGIN = 'https://oauth.fatsecret.com';
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1_000;
const DETAILS_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const BARCODE_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const BARCODE_MISS_TTL_MS = 5 * 60 * 1_000;

const numericValue = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim()) return Number(value);
  return value;
}, z.number().finite().nonnegative());

const optionalNumericValue = numericValue.nullable().optional();

const tokenSchema = z.object({
  access_token: z.string().trim().min(1),
  expires_in: numericValue.optional().default(3_600),
  token_type: z.string().optional(),
}).passthrough();

const fatSecretServingSchema = z.object({
  serving_id: z.union([z.string(), z.number()]).transform(String).optional(),
  serving_description: z.string().trim().min(1).optional(),
  measurement_description: z.string().trim().min(1).optional(),
  metric_serving_amount: optionalNumericValue,
  metric_serving_unit: z.string().trim().min(1).optional(),
  number_of_units: optionalNumericValue,
  is_default: z.union([z.string(), z.number()]).optional(),
  calories: numericValue,
  protein: numericValue,
  carbohydrate: numericValue,
  fat: numericValue,
  fiber: numericValue.optional().default(0),
  sugar: numericValue.optional().default(0),
  sodium: numericValue.optional().default(0),
}).passthrough();

const oneOrManyServingsSchema = z.union([
  fatSecretServingSchema,
  z.array(fatSecretServingSchema),
]);

const fatSecretFoodSchema = z.object({
  food_id: z.union([z.string(), z.number()]).transform(String),
  food_name: z.string().trim().min(1),
  brand_name: z.string().trim().min(1).optional(),
  food_type: z.string().optional(),
  food_url: z.string().url().optional(),
  servings: z.object({ serving: oneOrManyServingsSchema }).optional(),
}).passthrough();

const oneOrManyFoodsSchema = z.union([fatSecretFoodSchema, z.array(fatSecretFoodSchema)]);

const fatSecretErrorSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String).optional(),
  message: z.string().optional(),
}).passthrough();

const searchResponseSchema = z.object({
  foods_search: z.object({
    results: z.object({ food: oneOrManyFoodsSchema }).optional(),
  }).optional(),
  error: fatSecretErrorSchema.optional(),
}).passthrough();

const foodResponseSchema = z.object({
  food: fatSecretFoodSchema.optional(),
  error: fatSecretErrorSchema.optional(),
}).passthrough();

type FatSecretFood = z.infer<typeof fatSecretFoodSchema>;
type FatSecretServing = z.infer<typeof fatSecretServingSchema>;

type TokenCache = {
  clientId: string;
  scope: string;
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function throwForFatSecretError(error: z.infer<typeof fatSecretErrorSchema> | undefined, notFoundIsNull = false) {
  if (!error) return false;
  if (notFoundIsNull && error.code === '211') return true;
  if (error.code === '13') throw new NutritionProviderError('unauthorized');
  if (error.code === '14') throw new NutritionProviderError('forbidden');
  if (error.code === '107') throw new NutritionProviderError('invalid_request');
  throw new NutritionProviderError('provider_unavailable');
}

function identityScore(food: FatSecretFood, query: NormalizedFoodQuery) {
  const candidateText = normalizeProviderText(`${food.brand_name ?? ''} ${food.food_name}`);
  const candidateTokens = providerTextTokens(candidateText);
  const queryText = normalizeProviderText(query.searchText);
  const queryTokens = providerTextTokens(queryText).filter((token) => !['food', 'serving', 'one', 'two'].includes(token));
  const brandTokens = providerTextTokens(query.brandHint);
  if (brandTokens.length && !brandTokens.every((token) => candidateText.includes(token))) return null;

  const productTokens = queryTokens.filter((token) => !brandTokens.includes(token));
  const overlap = productTokens.filter((token) => providerTokenMatches(token, candidateTokens));
  if (productTokens.length && overlap.length / productTokens.length < 0.6) return null;

  let score = overlap.length * 18;
  if (brandTokens.length) score += 45;
  if (candidateText === queryText) score += 40;
  else if (candidateText.includes(queryText) || queryText.includes(candidateText)) score += 25;
  if (food.food_type?.toLowerCase() === 'brand') score += 6;
  return score;
}

function servingMatchesUnit(serving: FatSecretServing, unit: string) {
  const description = normalizeProviderText(`${serving.serving_description ?? ''} ${serving.measurement_description ?? ''}`);
  return description.includes(normalizeProviderText(unit));
}

function servingNutrition(serving: FatSecretServing): NutritionFacts {
  return {
    calories: serving.calories,
    protein: serving.protein,
    carbs: serving.carbohydrate,
    fat: serving.fat,
    fiber: serving.fiber,
    sugar: serving.sugar,
    sodium: serving.sodium,
  };
}

function foodToCandidate(food: FatSecretFood, query: NormalizedFoodQuery, barcode?: string | null): NormalizedProviderFood | null {
  const servings = asArray(food.servings?.serving);
  if (!servings.length) return null;

  const requestedUnit = normalizeServingUnit(query.quantityUnit ?? query.unitHint);
  const metricServing = requestedUnit && ['g', 'oz', 'ml'].includes(requestedUnit)
    ? servings.find((serving) => normalizeServingUnit(serving.metric_serving_unit) === requestedUnit)
    : null;
  const naturalServing = requestedUnit && !['g', 'oz', 'ml'].includes(requestedUnit)
    ? servings.find((serving) => servingMatchesUnit(serving, requestedUnit))
    : null;
  const selected = metricServing
    ?? naturalServing
    ?? servings.find((serving) => String(serving.is_default ?? '') === '1')
    ?? servings[0];
  if (!selected) return null;

  const nutrition = servingNutrition(selected);
  const metricAmount = selected.metric_serving_amount ?? null;
  const metricUnit = normalizeServingUnit(selected.metric_serving_unit);
  const parsedServing = parseServingText(selected.serving_description);
  const numberOfUnits = selected.number_of_units && selected.number_of_units > 0 ? selected.number_of_units : parsedServing.quantity;
  let servingQuantity = numberOfUnits;
  let servingUnit = normalizeServingUnit(selected.measurement_description) ?? parsedServing.unit;

  if (metricServing && metricAmount && metricUnit) {
    servingQuantity = metricAmount;
    servingUnit = metricUnit;
  } else if (naturalServing && requestedUnit) {
    servingQuantity = numberOfUnits;
    servingUnit = requestedUnit;
  } else if (parsedServing.unit !== 'serving') {
    servingQuantity = parsedServing.quantity;
    servingUnit = parsedServing.unit;
  } else if (requestedUnit && numberOfUnits === 1 && normalizeProviderText(food.food_name).includes(requestedUnit)) {
    servingUnit = requestedUnit;
  }

  const servingWeightGrams = metricAmount && metricUnit === 'g'
    ? metricAmount
    : metricAmount && metricUnit === 'oz'
      ? metricAmount * 28.3495
      : null;
  if (!validateNutritionFacts(nutrition, { servingWeightGrams }).valid) return null;

  return {
    providerId: 'fatsecret',
    providerFoodId: food.food_id,
    providerServingId: selected.serving_id ?? null,
    name: food.food_name,
    brand: food.brand_name ?? null,
    barcode: barcode ?? null,
    servingQuantity,
    servingUnit,
    servingWeightGrams,
    servingDescription: selected.serving_description ?? `${servingQuantity} ${servingUnit}`,
    nutrition,
    sourceName: barcode ? 'FatSecret barcode database' : 'FatSecret Platform',
    confidence: barcode ? 0.92 : query.brandHint ? 0.86 : 0.82,
    exactBrandMatch: Boolean(query.brandHint && identityScore(food, query) !== null),
  };
}

async function getAccessToken() {
  const config = getFatSecretConfiguration();
  if (!config.configured || !config.clientId || !config.clientSecret) return null;
  const now = Date.now();
  if (
    tokenCache
    && tokenCache.clientId === config.clientId
    && tokenCache.scope === config.scope
    && tokenCache.expiresAt > now + 60_000
  ) {
    return tokenCache.accessToken;
  }

  const authorization = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: config.scope,
  });
  const result = await requestProviderJson({
    url: FATSECRET_TOKEN_URL,
    allowedOrigins: [FATSECRET_OAUTH_ORIGIN],
    init: {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
    schema: tokenSchema,
    timeoutMs: config.timeoutMs,
    retries: 0,
  });
  if (!result) return null;

  tokenCache = {
    clientId: config.clientId,
    scope: config.scope,
    accessToken: result.data.access_token,
    expiresAt: now + Math.max(60, result.data.expires_in) * 1_000,
  };
  return tokenCache.accessToken;
}

async function searchFoods(query: NormalizedFoodQuery) {
  const config = getFatSecretConfiguration();
  if (!config.configured || !fatSecretScopeSupports(config.scope, 'search')) return [];
  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  const key = buildProviderCacheKey('fatsecret:v1:search', {
    query: normalizeProviderText(query.searchText),
    brand: normalizeProviderText(query.brandHint),
    region: config.region,
  });
  const cached = await withProviderCache({
    key,
    ttlMs: SEARCH_CACHE_TTL_MS,
    load: async () => {
      const url = new URL(`${FATSECRET_API_BASE_URL}/foods/search/v5`);
      url.searchParams.set('search_expression', query.searchText.slice(0, 180));
      url.searchParams.set('max_results', '20');
      url.searchParams.set('flag_default_serving', 'true');
      url.searchParams.set('format', 'json');
      url.searchParams.set('region', config.region);
      if (query.brandHint) url.searchParams.set('food_type', 'brand');

      const result = await requestProviderJson({
        url: url.toString(),
        allowedOrigins: [FATSECRET_API_ORIGIN],
        init: { headers: { Authorization: `Bearer ${accessToken}` } },
        schema: searchResponseSchema,
        timeoutMs: config.timeoutMs,
      });
      if (!result) return [];
      throwForFatSecretError(result.data.error);
      return asArray(result.data.foods_search?.results?.food);
    },
  });
  return cached.value ?? [];
}

async function getFood(providerFoodId: string) {
  if (!/^\d{1,20}$/.test(providerFoodId)) return null;
  const config = getFatSecretConfiguration();
  if (!config.configured) return null;
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const key = buildProviderCacheKey('fatsecret:v1:food', providerFoodId);
  const cached = await withProviderCache({
    key,
    ttlMs: DETAILS_CACHE_TTL_MS,
    load: async () => {
      const url = new URL(`${FATSECRET_API_BASE_URL}/food/v5`);
      url.searchParams.set('food_id', providerFoodId);
      url.searchParams.set('format', 'json');
      if (config.scope.split(/\s+/).includes('premier')) {
        url.searchParams.set('flag_default_serving', 'true');
        url.searchParams.set('region', config.region);
      }
      const result = await requestProviderJson({
        url: url.toString(),
        allowedOrigins: [FATSECRET_API_ORIGIN],
        init: { headers: { Authorization: `Bearer ${accessToken}` } },
        schema: foodResponseSchema,
        timeoutMs: config.timeoutMs,
        notFoundIsNull: true,
      });
      if (!result) return null;
      if (throwForFatSecretError(result.data.error, true)) return null;
      return result.data.food ?? null;
    },
  });
  return cached.value;
}

async function getBarcodeFood(barcode: string) {
  if (!/^\d{8,13}$/.test(barcode)) return null;
  const config = getFatSecretConfiguration();
  if (!config.configured || !fatSecretScopeSupports(config.scope, 'barcode')) return null;
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const gtin13 = barcode.padStart(13, '0');
  const key = buildProviderCacheKey('fatsecret:v1:barcode', gtin13);
  const cached = await withProviderCache({
    key,
    ttlMs: BARCODE_CACHE_TTL_MS,
    negativeTtlMs: BARCODE_MISS_TTL_MS,
    load: async () => {
      const url = new URL(`${FATSECRET_API_BASE_URL}/food/barcode/find-by-id/v2`);
      url.searchParams.set('barcode', gtin13);
      url.searchParams.set('format', 'json');
      url.searchParams.set('flag_default_serving', 'true');
      url.searchParams.set('region', config.region);
      const result = await requestProviderJson({
        url: url.toString(),
        allowedOrigins: [FATSECRET_API_ORIGIN],
        init: { headers: { Authorization: `Bearer ${accessToken}` } },
        schema: foodResponseSchema,
        timeoutMs: config.timeoutMs,
        notFoundIsNull: true,
      });
      if (!result) return null;
      if (throwForFatSecretError(result.data.error, true)) return null;
      return result.data.food ?? null;
    },
  });
  return cached.value ? { food: cached.value, gtin13 } : null;
}

export function resetFatSecretProviderState() {
  tokenCache = null;
}

export const fatSecretProvider: NutritionLookupProvider = {
  id: 'fatsecret',
  capabilities: { search: true, barcode: true, details: true, suggest: false },
  getStatus() {
    const config = getFatSecretConfiguration();
    return {
      configured: config.configured,
      reason: config.configured ? undefined : `fatsecret_${config.reason ?? 'not_configured'}`,
    };
  },
  async lookup({ mealType, normalizedQuery, trace }) {
    const foods = await searchFoods(normalizedQuery);
    const rankedFoods = foods
      .map((food) => ({ food, score: identityScore(food, normalizedQuery) }))
      .filter((entry): entry is { food: FatSecretFood; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
    let candidate: NormalizedProviderFood | null = null;
    for (const entry of rankedFoods) {
      const food = entry.food.servings ? entry.food : await getFood(entry.food.food_id);
      candidate = food ? foodToCandidate(food, normalizedQuery) : null;
      if (candidate) break;
    }
    return candidate ? buildProviderMealResponse({ candidate, normalizedQuery, mealType, trace }) : null;
  },
  async lookupBarcode({ barcode, mealType }) {
    const result = await getBarcodeFood(barcode);
    if (!result) return null;
    const query: NormalizedFoodQuery = {
      rawText: barcode,
      normalizedText: result.food.food_name,
      searchText: result.food.food_name,
      matchedQuery: result.food.food_name,
      quantity: 1,
      quantityUnit: null,
      unitHint: null,
      brandHint: result.food.brand_name ?? null,
    };
    const candidate = foodToCandidate(result.food, query, result.gtin13);
    return candidate ? buildBarcodeMealResponse({ candidate, mealType }) : null;
  },
  async getFoodDetails({ providerFoodId, mealType }) {
    const food = await getFood(providerFoodId);
    if (!food) return null;
    const query: NormalizedFoodQuery = {
      rawText: food.food_name,
      normalizedText: food.food_name,
      searchText: food.food_name,
      matchedQuery: food.food_name,
      quantity: 1,
      quantityUnit: null,
      unitHint: null,
      brandHint: food.brand_name ?? null,
    };
    const candidate = foodToCandidate(food, query);
    return candidate ? buildProviderMealResponse({ candidate, normalizedQuery: query, mealType }) : null;
  },
};

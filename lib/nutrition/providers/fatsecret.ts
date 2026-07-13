import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { scaleParsedFoodItem } from '@/lib/nutrition/catalog';
import { computeServingScaleFactor } from '@/lib/nutrition/scaling';
import { recordServingScaling } from '@/lib/ai/foodPipelineTrace';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

type FatSecretServing = {
  serving_id?: string;
  serving_description?: string;
  measurement_description?: string;
  metric_serving_amount?: string | number;
  metric_serving_unit?: string;
  number_of_units?: string | number;
  is_default?: string | number;
  calories?: string | number;
  protein?: string | number;
  carbohydrate?: string | number;
  fat?: string | number;
  fiber?: string | number;
  sugar?: string | number;
  sodium?: string | number;
};

type FatSecretFood = {
  food_id?: string;
  food_name?: string;
  brand_name?: string;
  food_type?: string;
  servings?: { serving?: FatSecretServing | FatSecretServing[] };
};

type FatSecretSearchResponse = {
  foods_search?: {
    results?: { food?: FatSecretFood | FatSecretFood[] };
  };
};

type FatSecretTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type TokenCache = {
  clientId: string;
  scope: string;
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function asArray<T>(value: T | T[] | null | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value: string | null | undefined) {
  return normalizeText(value).replace(/\s+/g, '');
}

function tokens(value: string | null | undefined) {
  return normalizeText(value).split(' ').filter((token) => token.length > 1);
}

const identityStopWords = new Set([
  'a', 'an', 'one', 'two', 'three', 'four', 'five', 'six', 'of', 'the', 'with',
  'and', 'had', 'have', 'eat', 'ate', 'drink', 'drank', 'log', 'add', 'track',
  'please', 'food', 'item', 'product', 'serving', 'servings', 'count', 'counts',
  'g', 'gram', 'grams', 'oz', 'ounce', 'ounces', 'ml', 'milliliter', 'milliliters',
]);

function candidateIdentityScore(food: FatSecretFood, searchText: string, brandHint: string | null) {
  const foodName = food.food_name?.trim() ?? '';
  const brandName = food.brand_name?.trim() ?? '';
  if (!foodName) return null;

  if (brandHint && !compactText(`${brandName} ${foodName}`).includes(compactText(brandHint))) {
    return null;
  }

  const queryTokens = tokens(searchText).filter((token) => !identityStopWords.has(token));
  const brandTokens = new Set(tokens(brandHint));
  const productTokens = queryTokens.filter((token) => !brandTokens.has(token));
  const candidateText = normalizeText(`${foodName} ${brandName}`);
  const overlap = productTokens.filter((token) => candidateText.includes(token));

  if (productTokens.length && overlap.length < Math.max(1, Math.ceil(productTokens.length * 0.5))) {
    return null;
  }

  let score = overlap.length * 18;
  if (brandHint) score += 45;
  if (normalizeText(searchText) && candidateText.includes(normalizeText(searchText))) score += 30;
  if (food.food_type?.toLowerCase() === 'brand') score += 8;
  return score;
}

function servingContainsUnit(serving: FatSecretServing, unit: string) {
  const text = normalizeText(`${serving.serving_description ?? ''} ${serving.measurement_description ?? ''}`);
  return text.includes(unit);
}

function normalizeServingUnit(unit: string | null | undefined) {
  const normalized = normalizeText(unit);
  if (normalized === 'bars') return 'bar';
  if (normalized === 'bottles') return 'bottle';
  if (normalized === 'cans') return 'can';
  if (normalized === 'bags') return 'bag';
  if (normalized === 'servings') return 'serving';
  if (normalized === 'grams' || normalized === 'gram') return 'g';
  if (normalized === 'ounces' || normalized === 'ounce') return 'oz';
  return normalized || null;
}

function chooseServing(food: FatSecretFood, searchText: string, requestedUnit: string | null) {
  const servings = asArray(food.servings?.serving);
  if (!servings.length) return null;

  const normalizedRequestedUnit = normalizeServingUnit(requestedUnit);
  const metricServing = normalizedRequestedUnit && ['g', 'oz', 'ml'].includes(normalizedRequestedUnit)
    ? servings.find((serving) => normalizeServingUnit(serving.metric_serving_unit) === normalizedRequestedUnit)
    : null;
  const matchingNaturalServing = normalizedRequestedUnit && !['g', 'oz', 'ml'].includes(normalizedRequestedUnit)
    ? servings.find((serving) => servingContainsUnit(serving, normalizedRequestedUnit))
    : null;
  const defaultServing = servings.find((serving) => String(serving.is_default ?? '') === '1') ?? servings[0];
  const serving = metricServing ?? matchingNaturalServing ?? defaultServing;
  const calories = toNumber(serving.calories);
  const protein = toNumber(serving.protein);
  const carbs = toNumber(serving.carbohydrate);
  const fat = toNumber(serving.fat);
  if ([calories, protein, carbs].some((value) => value === null) || fat === null) return null;

  const metricUnit = normalizeServingUnit(serving.metric_serving_unit);
  const metricAmount = toNumber(serving.metric_serving_amount);
  const numberOfUnits = toNumber(serving.number_of_units) ?? 1;
  let providerServingQuantity = numberOfUnits;
  let providerServingUnit = normalizeServingUnit(serving.measurement_description) ?? 'serving';

  if (normalizedRequestedUnit && metricServing && metricAmount !== null) {
    providerServingQuantity = metricAmount;
    providerServingUnit = metricUnit ?? normalizedRequestedUnit;
  } else if (normalizedRequestedUnit && matchingNaturalServing) {
    providerServingQuantity = numberOfUnits;
    providerServingUnit = normalizedRequestedUnit;
  } else if (normalizedRequestedUnit && providerServingUnit === 'serving') {
    // A branded result may label a single natural product as "1 serving".
    // Only reinterpret it when the product/query itself names that unit.
    const identityText = normalizeText(`${food.food_name ?? ''} ${searchText}`);
    if (numberOfUnits === 1 && identityText.includes(normalizedRequestedUnit)) {
      providerServingUnit = normalizedRequestedUnit;
    }
  }

  return {
    source: serving,
    providerServingQuantity,
    providerServingUnit,
    calories: calories ?? 0,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
    fiber: toNumber(serving.fiber) ?? 0,
    sugar: toNumber(serving.sugar) ?? 0,
    sodium: toNumber(serving.sodium) ?? 0,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(clientId: string, clientSecret: string, scope: string) {
  const now = Date.now();
  if (tokenCache && tokenCache.clientId === clientId && tokenCache.scope === scope && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetchJson<FatSecretTokenResponse>('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }).toString(),
  });
  const accessToken = response?.access_token?.trim();
  if (!accessToken) return null;
  const expiresIn = Number(response?.expires_in ?? 3600);

  tokenCache = {
    clientId,
    scope,
    accessToken,
    expiresAt: now + Math.max(60, expiresIn) * 1000,
  };
  return accessToken;
}

export const fatSecretProvider: NutritionLookupProvider = {
  id: 'fatsecret',
  getStatus() {
    const clientId = Boolean(process.env.FATSECRET_CLIENT_ID?.trim());
    const clientSecret = Boolean(process.env.FATSECRET_CLIENT_SECRET?.trim());
    return {
      configured: clientId && clientSecret,
      reason: clientId && clientSecret ? undefined : 'fatsecret_not_configured',
    };
  },
  async lookup({ mealType, normalizedQuery, trace }) {
    const clientId = process.env.FATSECRET_CLIENT_ID?.trim();
    const clientSecret = process.env.FATSECRET_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;

    const scope = process.env.FATSECRET_SCOPE?.trim() || 'premier';
    const accessToken = await getAccessToken(clientId, clientSecret, scope);
    if (!accessToken) return null;

    const params = new URLSearchParams({
      search_expression: normalizedQuery.searchText,
      max_results: '20',
      flag_default_serving: 'true',
      format: 'json',
    });
    if (normalizedQuery.brandHint) params.set('food_type', 'brand');
    else params.set('food_type', 'generic');
    if (process.env.FATSECRET_REGION?.trim()) params.set('region', process.env.FATSECRET_REGION.trim());

    const payload = await fetchJson<FatSecretSearchResponse>(`https://platform.fatsecret.com/rest/foods/search/v5?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const foods = asArray(payload?.foods_search?.results?.food);
    const bestFood = foods
      .map((food) => ({ food, score: candidateIdentityScore(food, normalizedQuery.searchText, normalizedQuery.brandHint) }))
      .filter((candidate): candidate is { food: FatSecretFood; score: number } => candidate.score !== null)
      .sort((left, right) => right.score - left.score)[0]?.food;
    if (!bestFood) return null;

    const selectedServing = chooseServing(bestFood, normalizedQuery.searchText, normalizedQuery.quantityUnit ?? normalizedQuery.unitHint);
    if (!selectedServing) return null;

    const scale = computeServingScaleFactor({
      requestedQuantity: normalizedQuery.quantity,
      requestedUnit: normalizedQuery.quantityUnit,
      providerServingQuantity: selectedServing.providerServingQuantity,
      providerServingUnit: selectedServing.providerServingUnit,
    });
    if (!scale) return null;
    if (trace) recordServingScaling(trace, scale);

    const baseItem = {
      food_name: [bestFood.brand_name, bestFood.food_name].filter(Boolean).join(' ').trim(),
      quantity: selectedServing.providerServingQuantity,
      unit: selectedServing.providerServingUnit,
      calories: selectedServing.calories,
      protein: selectedServing.protein,
      carbs: selectedServing.carbs,
      fat: selectedServing.fat,
      fiber: selectedServing.fiber,
      sugar: selectedServing.sugar,
      sodium: selectedServing.sodium,
      notes: `Matched using FatSecret Platform. Query: ${normalizedQuery.matchedQuery}. Serving: ${selectedServing.source.serving_description ?? selectedServing.providerServingUnit}.`,
      is_trusted: true,
      source_type: 'GENERIC_REFERENCE' as const,
      source_name: 'FatSecret Platform',
      confidence_label: 'Matched' as const,
      match_type: 'verified_database' as const,
      matched_query: normalizedQuery.matchedQuery,
      original_user_text: normalizedQuery.rawText,
      provider_used: 'fatsecret',
      used_ai_fallback: false,
      catalog_food_id: null,
      providerCandidateId: `fatsecret:${bestFood.food_id ?? 'unknown'}:${selectedServing.source.serving_id ?? 'default'}`,
    };
    const item = scale.scaleFactor !== 1 || Boolean(normalizedQuery.quantityUnit)
      ? scaleParsedFoodItem(baseItem, scale.scaleFactor, normalizedQuery.quantityUnit ?? selectedServing.providerServingUnit)
      : baseItem;

    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: mealType,
      confidence_score: 0.82,
      items: [item],
    });
  },
};

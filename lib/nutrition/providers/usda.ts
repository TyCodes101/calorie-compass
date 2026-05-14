import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { scaleParsedFoodItem } from '@/lib/nutrition/catalog';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

type UsdaFood = {
  description?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  dataType?: string;
  foodNutrients?: Array<{ nutrientName?: string; value?: number }>;
};

type UsdaSearchResponse = {
  foods?: UsdaFood[];
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string) {
  return normalizeText(text).split(' ').filter(Boolean);
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);
}

function findUsdaNutrient(food: UsdaFood, names: string[]) {
  const nutrient = food.foodNutrients?.find((entry) => names.includes(entry.nutrientName ?? ''));
  return nutrient?.value ?? 0;
}

function pickServingText(food: UsdaFood) {
  return food.householdServingFullText?.trim() || food.servingSizeUnit?.trim() || 'serving';
}

function pickServingQuantity(food: UsdaFood) {
  return food.servingSize && Number.isFinite(food.servingSize) ? food.servingSize : 1;
}

function scoreUsdaFood(food: UsdaFood, searchText: string, brandHint: string | null, unitHint: string | null) {
  const normalizedQuery = normalizeText(searchText);
  const normalizedDescription = normalizeText(food.description ?? '');
  const normalizedBrand = normalizeText(food.brandOwner ?? '');
  const queryTokens = tokenize(normalizedQuery);
  const descriptionTokens = tokenize(normalizedDescription);
  const servingText = normalizeText(`${food.servingSizeUnit ?? ''} ${food.householdServingFullText ?? ''}`);
  const isBranded = Boolean(food.brandOwner) || /branded/i.test(food.dataType ?? '');
  const calories = findUsdaNutrient(food, ['Energy']);

  let score = 0;

  if (normalizedDescription === normalizedQuery) score += 140;
  else if (normalizedDescription.includes(normalizedQuery) || normalizedQuery.includes(normalizedDescription)) score += 92;
  score += countOverlap(queryTokens, descriptionTokens) * 10;

  if (brandHint) {
    const normalizedHint = normalizeText(brandHint);
    if (normalizedBrand.includes(normalizedHint) || normalizedDescription.includes(normalizedHint)) score += 40;
    else if (normalizedBrand) score -= 10;
  } else {
    score += isBranded ? -8 : 10;
  }

  if (unitHint && servingText.includes(normalizeText(unitHint))) {
    score += 16;
  }

  if (calories > 0 && calories <= 1200) score += 10;
  else score -= 18;

  if (/foundation|survey|sr legacy/i.test(food.dataType ?? '')) {
    score += 6;
  }

  return score;
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

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const usdaProvider: NutritionLookupProvider = {
  id: 'usda-fdc',
  async lookup({ mealType, normalizedQuery }) {
    const apiKey = process.env.USDA_FDC_API_KEY || process.env.FDC_API_KEY;
    if (!apiKey) {
      return null;
    }

    const payload = await fetchJson<UsdaSearchResponse>(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: normalizedQuery.searchText, pageSize: 10 }),
    });

    const bestMatch = (payload?.foods ?? [])
      .map((food) => ({
        food,
        score: scoreUsdaFood(food, normalizedQuery.searchText, normalizedQuery.brandHint, normalizedQuery.unitHint),
      }))
      .filter((candidate) => candidate.score >= 44)
      .sort((left, right) => right.score - left.score)[0]?.food;

    if (!bestMatch) {
      return null;
    }

    const baseItem = {
      food_name: bestMatch.brandOwner
        ? `${bestMatch.brandOwner} ${bestMatch.description ?? ''}`.trim()
        : bestMatch.description?.trim() || normalizedQuery.matchedQuery,
      quantity: pickServingQuantity(bestMatch),
      unit: pickServingText(bestMatch),
      calories: findUsdaNutrient(bestMatch, ['Energy']),
      protein: findUsdaNutrient(bestMatch, ['Protein']),
      carbs: findUsdaNutrient(bestMatch, ['Carbohydrate, by difference']),
      fat: findUsdaNutrient(bestMatch, ['Total lipid (fat)']),
      fiber: findUsdaNutrient(bestMatch, ['Fiber, total dietary']),
      sugar: findUsdaNutrient(bestMatch, ['Sugars, total including NLEA']),
      sodium: findUsdaNutrient(bestMatch, ['Sodium, Na']),
      notes: `Matched using USDA FoodData Central. Query: ${normalizedQuery.matchedQuery}.`,
      is_trusted: true,
      source_type: 'GENERIC_REFERENCE' as const,
      source_name: 'USDA FoodData Central',
      confidence_label: 'High confidence' as const,
      matched_query: normalizedQuery.matchedQuery,
      original_user_text: normalizedQuery.rawText,
      provider_used: 'usda-fdc',
      used_ai_fallback: false,
      catalog_food_id: null,
    };

    const item = normalizedQuery.quantity > 1 ? scaleParsedFoodItem(baseItem, normalizedQuery.quantity) : baseItem;

    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: mealType,
      confidence_score: 0.84,
      items: [item],
    });
  },
};

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import {
  buildBarcodeLookupResult,
  markSearchResultAsBarcodeMatch,
  normalizeBarcode,
} from '@/lib/barcode-lookup';
import type { CustomFoodSummary } from '@/lib/custom-foods';
import {
  buildFoodSearchResponse,
  type BuildFoodSearchResponseOptions,
  type FoodSearchResponse,
  type FoodSearchResult,
  verifiedCatalogFoodsForLookup,
} from '@/lib/food-search';
import { cachedFoodToSearchResult, getCachedFoodByBarcode } from '@/lib/nutrition/source-cache';
import { resolveBarcodeNutrition } from '@/lib/nutrition/barcodeResolver';
import type { FavoriteMealSummary } from '@/lib/reusable-meals';

export type FoodIntelligenceOrigin =
  | 'chat'
  | 'search'
  | 'barcode'
  | 'favorite'
  | 'history'
  | 'suggestion'
  | 'voice';

export type FoodIntelligenceUserData = {
  customFoods?: CustomFoodSummary[];
  favoriteMeals?: FavoriteMealSummary[];
  recentMeals?: FavoriteMealSummary[];
};

export type FoodIntelligenceSearchInput = FoodIntelligenceUserData & {
  query: string;
  mealType?: MealTypeValue;
  origin: FoodIntelligenceOrigin;
};

export type FoodIntelligenceBarcodeResponse = {
  barcode: string | null;
  found: boolean;
  result: FoodSearchResult | null;
  error?: string;
};

export type FoodIntelligenceReviewResponse = {
  origin: FoodIntelligenceOrigin;
  mealType: MealTypeValue;
  items: ParsedFoodItem[];
  confidenceScore: number;
  needsReview: boolean;
  unresolvedItems: string[];
};

export type FoodIntelligenceDependencies = {
  search?: BuildFoodSearchResponseOptions;
  cachedBarcodeLookup?: typeof getCachedFoodByBarcode;
  providerBarcodeLookup?: typeof resolveBarcodeNutrition;
};

export async function searchFoodIntelligence(
  input: FoodIntelligenceSearchInput,
  dependencies: FoodIntelligenceDependencies = {},
): Promise<FoodSearchResponse> {
  return buildFoodSearchResponse({
    query: input.query,
    mealType: input.mealType,
    customFoods: input.customFoods ?? [],
    favoriteMeals: input.favoriteMeals ?? [],
    recentMeals: input.recentMeals ?? [],
  }, dependencies.search);
}

export function foodIntelligenceResultToMealResponse(
  result: FoodSearchResult,
  mealType: MealTypeValue = result.mealType,
): ParsedMealResponse {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: result.confidenceScore,
    items: result.items,
  });
}

export async function resolveFoodIntelligenceItem(
  input: FoodIntelligenceSearchInput,
  dependencies: FoodIntelligenceDependencies = {},
) {
  const response = await searchFoodIntelligence(input, dependencies);
  const result = response.results[0] ?? null;
  return result
    ? foodIntelligenceResultToMealResponse(result, input.mealType ?? result.mealType)
    : null;
}

export async function lookupBarcodeFoodIntelligence(
  rawBarcode: string,
  input: FoodIntelligenceUserData & { mealType?: MealTypeValue },
  dependencies: FoodIntelligenceDependencies = {},
): Promise<FoodIntelligenceBarcodeResponse> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) {
    return { barcode: null, found: false, result: null, error: 'Enter 8 to 14 barcode digits.' };
  }

  const localResult = buildBarcodeLookupResult({
    barcode,
    customFoods: input.customFoods ?? [],
    catalogFoods: verifiedCatalogFoodsForLookup(),
  });
  const [cached, provider] = await Promise.all([
    (dependencies.cachedBarcodeLookup ?? getCachedFoodByBarcode)(barcode),
    (dependencies.providerBarcodeLookup ?? resolveBarcodeNutrition)(barcode, input.mealType ?? 'snack'),
  ]);

  if (localResult.found) return { barcode, ...localResult };
  if (cached) {
    return {
      barcode,
      found: true,
      result: markSearchResultAsBarcodeMatch(cachedFoodToSearchResult(cached), barcode),
    };
  }
  if (provider.found) return { barcode, ...provider };
  return { barcode, found: false, result: null };
}

function revalidationQuery(item: ParsedFoodItem) {
  const modifiers = item.requested_modifiers?.length ? ` ${item.requested_modifiers.join(' ')}` : '';
  return `${item.quantity} ${item.unit} ${item.food_name}${modifiers}`.replace(/\s+/g, ' ').trim();
}

function unresolvedReviewItem(item: ParsedFoodItem) {
  return {
    ...item,
    confidence_label: 'Needs Review' as const,
    review_status: 'required' as const,
    notes: [item.notes, 'A fresh database match was unavailable. Review the previously confirmed values before saving.']
      .filter(Boolean)
      .join(' '),
  };
}

export async function revalidateFoodIntelligenceItems(
  input: FoodIntelligenceUserData & {
    items: ParsedFoodItem[];
    mealType: MealTypeValue;
    origin: Extract<FoodIntelligenceOrigin, 'favorite' | 'history' | 'suggestion'>;
  },
  dependencies: FoodIntelligenceDependencies = {},
): Promise<FoodIntelligenceReviewResponse> {
  const resolved = await Promise.all(input.items.map(async (storedItem) => {
    const response = await searchFoodIntelligence({
      query: revalidationQuery(storedItem),
      mealType: input.mealType,
      origin: input.origin,
      customFoods: input.customFoods,
      favoriteMeals: input.favoriteMeals,
      recentMeals: input.recentMeals,
    }, dependencies);
    const best = response.results[0];
    if (!best?.items.length) return { item: unresolvedReviewItem(storedItem), unresolved: true };
    const item = best.items[0];
    return {
      item: {
        ...item,
        requested_modifiers: storedItem.requested_modifiers ?? item.requested_modifiers,
        original_user_text: storedItem.original_user_text ?? item.original_user_text,
      },
      unresolved: false,
    };
  }));

  const items = resolved.map((entry) => entry.item);
  const unresolvedItems = resolved
    .filter((entry) => entry.unresolved)
    .map((entry) => entry.item.food_name);
  const confidenceScore = items.length
    ? Math.min(...items.map((item) => item.confidence ?? (item.confidence_label === 'Verified' ? 0.95 : item.confidence_label === 'Matched' ? 0.82 : 0.55)))
    : 0;

  return {
    origin: input.origin,
    mealType: input.mealType,
    items,
    confidenceScore,
    needsReview: unresolvedItems.length > 0 || items.some((item) => item.review_status === 'required' || item.source_type === 'AI_ESTIMATE'),
    unresolvedItems,
  };
}

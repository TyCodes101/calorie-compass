import type { ParsedFoodItem } from '@/lib/ai/types';
import type { CustomFoodSummary } from '@/lib/custom-foods';
import type { FavoriteMealSummary } from '@/lib/reusable-meals';
import {
  findCatalogFoodMatch,
  getCatalogFoods,
  scaleCatalogFood,
  type CatalogFoodRecord,
} from '@/lib/nutrition/catalog';

export type FoodSearchSourceLabel = 'Verified' | 'Custom' | 'Recent' | 'Favorite' | 'Estimated';

export type FoodSearchResult = {
  id: string;
  name: string;
  brand: string | null;
  sourceLabel: FoodSearchSourceLabel;
  servingQuantity: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode: string | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  confidenceScore: number;
  sourceReusableMealId: string | null;
  items: ParsedFoodItem[];
};

type SearchCatalogFood = CatalogFoodRecord & {
  barcode?: string | null;
  barcodes?: string[];
};

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string) {
  return normalizeSearchText(text).split(' ').filter(Boolean);
}

function textMatches(query: string, value: string | null | undefined) {
  const queryTokens = tokens(query);
  const valueTokens = new Set(tokens(value ?? ''));
  return queryTokens.length > 0 && queryTokens.every((token) => valueTokens.has(token));
}

function labelForItems(defaultLabel: FoodSearchSourceLabel, items: ParsedFoodItem[]): FoodSearchSourceLabel {
  if (items.some((item) => item.is_trusted === false || item.source_type === 'AI_ESTIMATE')) return 'Estimated';
  return defaultLabel;
}

export function catalogFoodToSearchResult(food: SearchCatalogFood): FoodSearchResult {
  const item = scaleCatalogFood(food, food.servingQuantity, food.servingUnit);
  return {
    id: `catalog:${food.id}`,
    name: food.canonicalName,
    brand: food.brand ?? null,
    sourceLabel: 'Verified',
    servingQuantity: item.quantity,
    servingUnit: item.unit,
    calories: Math.round(item.calories),
    protein: Math.round(item.protein),
    carbs: Math.round(item.carbs),
    fat: Math.round(item.fat),
    barcode: food.barcode ?? food.barcodes?.[0] ?? null,
    mealType: 'snack',
    confidenceScore: 1,
    sourceReusableMealId: null,
    items: [item],
  };
}

export function customFoodToSearchResult(food: CustomFoodSummary): FoodSearchResult {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    sourceLabel: 'Custom',
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    barcode: food.barcode,
    mealType: 'snack',
    confidenceScore: 1,
    sourceReusableMealId: null,
    items: food.items,
  };
}

function reusableMealToSearchResult(meal: FavoriteMealSummary, label: FoodSearchSourceLabel): FoodSearchResult | null {
  if (!meal.items?.length) return null;
  return {
    id: `${label.toLowerCase()}:${meal.id}`,
    name: meal.title,
    brand: null,
    sourceLabel: labelForItems(label, meal.items),
    servingQuantity: 1,
    servingUnit: 'meal',
    calories: meal.totalCalories,
    protein: Math.round(meal.totalProtein),
    carbs: Math.round(meal.items.reduce((sum, item) => sum + item.carbs, 0)),
    fat: Math.round(meal.items.reduce((sum, item) => sum + item.fat, 0)),
    barcode: null,
    mealType: meal.mealType,
    confidenceScore: meal.confidenceScore ?? 0.82,
    sourceReusableMealId: label === 'Favorite' ? meal.id : null,
    items: meal.items,
  };
}

export function buildFoodSearchResults({
  query,
  customFoods,
  favoriteMeals,
  recentMeals,
  catalogFoods,
}: {
  query: string;
  customFoods: CustomFoodSummary[];
  favoriteMeals: FavoriteMealSummary[];
  recentMeals: FavoriteMealSummary[];
  catalogFoods?: SearchCatalogFood[];
}) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const results: FoodSearchResult[] = [];
  const catalogMatch = catalogFoods
    ? catalogFoods.find((food) => food.active !== false && (textMatches(trimmed, food.canonicalName) || food.aliases.some((alias) => textMatches(trimmed, alias))))
    : findCatalogFoodMatch(trimmed)?.food;

  if (catalogMatch) {
    results.push(catalogFoodToSearchResult(catalogMatch));
  }

  results.push(
    ...customFoods
      .filter((food) => textMatches(trimmed, `${food.name} ${food.brand ?? ''}`))
      .map(customFoodToSearchResult),
  );

  results.push(
    ...favoriteMeals
      .filter((meal) => textMatches(trimmed, `${meal.title} ${meal.rawText ?? ''}`))
      .map((meal) => reusableMealToSearchResult(meal, 'Favorite'))
      .filter((result): result is FoodSearchResult => Boolean(result)),
  );

  results.push(
    ...recentMeals
      .filter((meal) => textMatches(trimmed, `${meal.title} ${meal.rawText ?? ''}`))
      .map((meal) => reusableMealToSearchResult(meal, 'Recent'))
      .filter((result): result is FoodSearchResult => Boolean(result)),
  );

  const seen = new Set<string>();
  return results
    .filter((result) => {
      const key = `${result.sourceLabel}:${normalizeSearchText(result.name)}:${result.calories}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export function verifiedCatalogFoodsForLookup() {
  return getCatalogFoods() as SearchCatalogFood[];
}

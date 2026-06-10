import type { ParsedFoodItem } from '@/lib/ai/types';
import type { CustomFoodSummary } from '@/lib/custom-foods';
import type { FavoriteMealSummary } from '@/lib/reusable-meals';
import {
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
    .replace(/\bcheeots\b/g, 'cheetos')
    .replace(/\bflaming\b/g, 'flamin')
    .replace(/\bcooe\b/g, 'coke')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const queryStopTokens = new Set([
  'a',
  'an',
  'the',
  'of',
  'with',
  'and',
  'one',
  '1',
  'can',
  'cans',
  'bag',
  'bags',
  'serving',
  'servings',
  'food',
]);

function tokens(text: string) {
  return normalizeSearchText(text)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !queryStopTokens.has(token));
}

function textMatches(query: string, value: string | null | undefined) {
  return searchScore(query, value) !== null;
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 2) return 3;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let lastDiagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const oldDiagonal = previous[j] ?? 0;
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      previous[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + 1,
        lastDiagonal + cost,
      );
      lastDiagonal = oldDiagonal;
    }
  }

  return previous[right.length] ?? 3;
}

function fuzzyTokenMatches(queryToken: string, valueToken: string) {
  if (queryToken === valueToken) return true;
  if (queryToken.length < 4 || valueToken.length < 4) return false;
  return editDistance(queryToken, valueToken) <= 1;
}

function searchScore(query: string, value: string | null | undefined) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedValue = normalizeSearchText(value ?? '');
  const queryTokens = tokens(query);
  const valueTokens = tokens(value ?? '');
  if (!queryTokens.length || !valueTokens.length) return null;

  if (normalizedQuery === normalizedValue) return 120;
  if (normalizedValue.includes(normalizedQuery) || normalizedQuery.includes(normalizedValue)) return 92;

  let score = 0;
  let matched = 0;
  for (const queryToken of queryTokens) {
    if (valueTokens.includes(queryToken)) {
      matched += 1;
      score += 18;
    } else if (valueTokens.some((valueToken) => fuzzyTokenMatches(queryToken, valueToken))) {
      matched += 1;
      score += 11;
    }
  }

  if (!matched) return null;
  const coverage = matched / queryTokens.length;
  const minimumCoverage = queryTokens.length <= 2 ? 1 : 0.66;
  return coverage >= minimumCoverage ? score + Math.round(coverage * 30) : null;
}

function catalogSearchScore(query: string, food: SearchCatalogFood) {
  const candidates = [food.canonicalName, food.brand ?? '', ...food.aliases];
  const score = Math.max(...candidates.map((candidate) => searchScore(query, candidate) ?? 0));
  return score > 0 ? score : null;
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
  const activeCatalogFoods = (catalogFoods ?? verifiedCatalogFoodsForLookup()).filter((food) => food.active !== false);
  results.push(
    ...activeCatalogFoods
      .map((food) => ({ food, score: catalogSearchScore(trimmed, food) }))
      .filter((candidate): candidate is { food: SearchCatalogFood; score: number } => candidate.score !== null)
      .sort((left, right) => right.score - left.score || left.food.canonicalName.localeCompare(right.food.canonicalName))
      .slice(0, 6)
      .map((candidate) => catalogFoodToSearchResult(candidate.food)),
  );

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

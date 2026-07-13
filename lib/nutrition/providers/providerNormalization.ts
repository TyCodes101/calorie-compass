import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { recordServingScaling } from '@/lib/ai/foodPipelineTrace';
import { computeServingScaleFactor, scaleNutritionItemOnce, normalizeServingUnit } from '@/lib/nutrition/scaling';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import type { FoodPipelineTrace } from '@/lib/ai/foodPipelineTrace';
import type { NormalizedFoodQuery } from '@/lib/nutrition/types';
import type { NutritionFacts } from '@/lib/nutrition/providers/nutritionPlausibility';

export type NormalizedProviderFood = {
  providerId: string;
  providerFoodId: string;
  providerServingId?: string | null;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  servingQuantity: number;
  servingUnit: string;
  servingWeightGrams?: number | null;
  servingDescription?: string | null;
  nutrition: NutritionFacts;
  sourceName: string;
  confidence: number;
  exactBrandMatch?: boolean;
  exactRestaurantMatch?: boolean;
};

export function normalizeProviderText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function providerTextTokens(value: string | null | undefined) {
  return normalizeProviderText(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function singularProviderToken(token: string) {
  return token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token;
}

function boundedDamerauLevenshtein(left: string, right: string, limit: number) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > limit) return limit + 1;

  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0));
  for (let row = 0; row <= left.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= right.length; column += 1) matrix[0][column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    let rowMinimum = limit + 1;
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      let distance = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
      if (
        row > 1
        && column > 1
        && left[row - 1] === right[column - 2]
        && left[row - 2] === right[column - 1]
      ) {
        distance = Math.min(distance, matrix[row - 2][column - 2] + 1);
      }
      matrix[row][column] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }
    if (rowMinimum > limit) return limit + 1;
  }

  return matrix[left.length][right.length];
}

export function providerTokenMatches(queryToken: string, candidateTokens: readonly string[]) {
  const normalizedQuery = singularProviderToken(normalizeProviderText(queryToken));
  if (!normalizedQuery) return false;

  return candidateTokens.some((candidateToken) => {
    const normalizedCandidate = singularProviderToken(normalizeProviderText(candidateToken));
    if (!normalizedCandidate) return false;
    if (normalizedCandidate === normalizedQuery) return true;

    const shortestLength = Math.min(normalizedQuery.length, normalizedCandidate.length);
    if (shortestLength < 5) return false;
    const limit = shortestLength >= 9 ? 2 : 1;
    return boundedDamerauLevenshtein(normalizedQuery, normalizedCandidate, limit) <= limit;
  });
}

export function parseServingText(value: string | null | undefined) {
  const normalized = normalizeProviderText(value);
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return { quantity: 1, unit: normalizeServingUnit(normalized) ?? 'serving' };
  return {
    quantity: Number(match[1]),
    unit: normalizeServingUnit(match[2]) ?? 'serving',
  };
}

export function toFiniteNonnegative(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function scalePer100g(nutrition: NutritionFacts, grams: number): NutritionFacts {
  const factor = grams / 100;
  return {
    calories: nutrition.calories * factor,
    protein: nutrition.protein * factor,
    carbs: nutrition.carbs * factor,
    fat: nutrition.fat * factor,
    fiber: (nutrition.fiber ?? 0) * factor,
    sugar: (nutrition.sugar ?? 0) * factor,
    sodium: (nutrition.sodium ?? 0) * factor,
  };
}

export function buildProviderMealResponse(args: {
  candidate: NormalizedProviderFood;
  normalizedQuery: NormalizedFoodQuery;
  mealType: MealTypeValue;
  trace?: FoodPipelineTrace;
}) {
  const { candidate, normalizedQuery } = args;
  const requestedUnit = normalizedQuery.quantityUnit ?? normalizedQuery.unitHint;
  const baseItem = {
    food_name: [candidate.brand, candidate.name].filter(Boolean).join(' ').trim(),
    quantity: candidate.servingQuantity,
    unit: candidate.servingUnit,
    calories: candidate.nutrition.calories,
    protein: candidate.nutrition.protein,
    carbs: candidate.nutrition.carbs,
    fat: candidate.nutrition.fat,
    fiber: candidate.nutrition.fiber ?? 0,
    sugar: candidate.nutrition.sugar ?? 0,
    sodium: candidate.nutrition.sodium ?? 0,
    notes: `Database match from ${candidate.sourceName}. Serving: ${candidate.servingDescription ?? `${candidate.servingQuantity} ${candidate.servingUnit}`}. Review before saving.`,
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE' as const,
    source_name: candidate.sourceName,
    confidence_label: 'Matched' as const,
    match_type: candidate.exactRestaurantMatch
      ? 'exact_restaurant' as const
      : candidate.exactBrandMatch
        ? 'exact_branded' as const
        : 'verified_database' as const,
    matched_query: normalizedQuery.matchedQuery,
    original_user_text: normalizedQuery.rawText,
    provider_used: candidate.providerId,
    used_ai_fallback: false,
    catalog_food_id: null,
    providerCandidateId: `${candidate.providerId}:${candidate.providerFoodId}:${candidate.providerServingId ?? 'default'}`,
    sourceId: candidate.barcode || candidate.providerFoodId,
    normalizedGrams: candidate.servingWeightGrams ?? null,
    confidence: candidate.confidence,
  };

  const scaleRequest = {
    requestedQuantity: normalizedQuery.quantity,
    requestedUnit,
    providerServingQuantity: candidate.servingQuantity,
    providerServingUnit: candidate.servingUnit,
  };
  const scale = computeServingScaleFactor(scaleRequest);
  const scaled = scaleNutritionItemOnce(baseItem, scaleRequest);
  if (!scaled || !scale) return null;

  if (args.trace) {
    recordServingScaling(args.trace, {
      requestedQuantity: normalizedQuery.quantity,
      requestedUnit,
      providerServingQuantity: candidate.servingQuantity,
      providerServingUnit: candidate.servingUnit,
      scaleFactor: scale.scaleFactor,
    });
  }

  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: args.mealType,
    confidence_score: candidate.confidence,
    items: [scaled],
  });
}

export function buildBarcodeMealResponse(args: {
  candidate: NormalizedProviderFood;
  mealType: MealTypeValue;
}) {
  return buildProviderMealResponse({
    ...args,
    normalizedQuery: {
      rawText: args.candidate.barcode ?? args.candidate.name,
      normalizedText: args.candidate.name,
      searchText: args.candidate.name,
      matchedQuery: args.candidate.name,
      quantity: 1,
      quantityUnit: null,
      unitHint: args.candidate.servingUnit,
      brandHint: args.candidate.brand ?? null,
    },
  });
}

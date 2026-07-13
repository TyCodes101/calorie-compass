import type { ParsedFoodItem } from '@/lib/ai/types';
import { normalizeNutritionVerificationLabel } from '@/lib/nutrition/verification';

type NativeMealItemRecord = {
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  notes: string | null;
  nutritionSourceType: string | null;
  nutritionSourceName: string | null;
  catalogFoodId?: string | null;
};

export type NativeMealRecord = {
  id: string;
  mealType: string;
  rawText: string | null;
  date: Date;
  createdAt: Date;
  confidenceScore: number | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: NativeMealItemRecord[];
};

function extractStoredTraceValue(notes: string | null, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return notes?.match(new RegExp(`\\b${escapedKey}=([^|\\n]+)`, 'i'))?.[1]?.trim() ?? null;
}

function extractStoredConfidenceLabel(notes: string | null) {
  return extractStoredTraceValue(notes, 'confidence');
}

function normalizeStoredSourceType(sourceType: string | null): ParsedFoodItem['source_type'] | null {
  return sourceType === 'OFFICIAL_RESTAURANT' || sourceType === 'GENERIC_REFERENCE' || sourceType === 'AI_ESTIMATE'
    ? sourceType
    : null;
}

export function mapMealForNative(meal: NativeMealRecord) {
  const items = meal.items.map((item) => {
    const sourceType = normalizeStoredSourceType(item.nutritionSourceType);
    const reviewStatus = extractStoredTraceValue(item.notes, 'reviewStatus');
    const modifierResolution = extractStoredTraceValue(item.notes, 'modifierResolution');
    const requestedModifiers = extractStoredTraceValue(item.notes, 'modifiers')
      ?.split(';')
      .map((modifier) => modifier.trim())
      .filter(Boolean) ?? [];
    const isTrusted = Boolean(
      sourceType
      && sourceType !== 'AI_ESTIMATE'
      && reviewStatus !== 'required'
      && modifierResolution !== 'estimated'
      && modifierResolution !== 'unresolved',
    );
    const confidenceLabel = normalizeNutritionVerificationLabel(extractStoredConfidenceLabel(item.notes), {
      source_type: sourceType,
      is_trusted: isTrusted,
    });

    return {
      food_name: item.foodName,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
      notes: item.notes,
      is_trusted: isTrusted,
      source_type: sourceType,
      source_name: item.nutritionSourceName,
      confidence_label: confidenceLabel,
      catalog_food_id: item.catalogFoodId ?? null,
      provider_used: extractStoredTraceValue(item.notes, 'provider'),
      providerCandidateId: extractStoredTraceValue(item.notes, 'candidate'),
      requested_modifiers: requestedModifiers,
      modifier_resolution: modifierResolution,
      review_status: reviewStatus,
    };
  });
  const trustedCount = items.filter((item) => item.is_trusted).length;
  const estimatedCount = items.filter((item) => item.source_type === 'AI_ESTIMATE' || item.confidence_label === 'Estimated').length;

  return {
    id: meal.id,
    mealType: meal.mealType.toLowerCase(),
    rawText: meal.rawText,
    date: meal.date.toISOString(),
    createdAt: meal.createdAt.toISOString(),
    confidenceScore: meal.confidenceScore ?? 0,
    totalCalories: Math.round(meal.totalCalories),
    totalProtein: Math.round(meal.totalProtein),
    totalCarbs: Math.round(meal.totalCarbs),
    totalFat: Math.round(meal.totalFat),
    itemCount: items.length,
    trustedCount,
    estimatedCount,
    coverageSummary: items.length === trustedCount ? 'All items matched' : `${trustedCount} of ${items.length} items matched`,
    items,
  };
}

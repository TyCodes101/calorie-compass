import { parsedMealResponseSchema, type ParsedMealResponse } from '@/lib/ai/types';
import { sanitizeNumber, sumNutrition } from '@/lib/nutrition';
import { normalizeNutritionVerificationLabel } from '@/lib/nutrition/verification';

function normalizeItem(item: Record<string, unknown>) {
  const sourceType = item.source_type ? String(item.source_type) : item.sourceType ? String(item.sourceType) : null;
  const isTrusted = Boolean(item.is_trusted ?? item.isTrusted ?? false);
  const matchType = item.match_type ? String(item.match_type) : item.matchType ? String(item.matchType) : null;
  const rawConfidenceLabel = item.confidence_label
    ? String(item.confidence_label)
    : item.confidenceLabel
      ? String(item.confidenceLabel)
      : null;
  const requestedModifiers = Array.isArray(item.requested_modifiers)
    ? item.requested_modifiers.map((modifier) => String(modifier).trim()).filter(Boolean)
    : Array.isArray(item.requestedModifiers)
      ? item.requestedModifiers.map((modifier) => String(modifier).trim()).filter(Boolean)
      : undefined;
  const modifierResolution = item.modifier_resolution
    ? String(item.modifier_resolution)
    : item.modifierResolution
      ? String(item.modifierResolution)
      : null;
  const reviewStatus = item.review_status
    ? String(item.review_status)
    : item.reviewStatus
      ? String(item.reviewStatus)
      : null;
  const rawNutritionBasis = (item.nutrition_basis ?? item.nutritionBasis) as Record<string, unknown> | null | undefined;
  const rawBaseNutrition = rawNutritionBasis?.base_nutrition as Record<string, unknown> | null | undefined;
  const nutritionBasis = rawNutritionBasis && rawBaseNutrition
    ? {
        type: String(rawNutritionBasis.type),
        provider_quantity: sanitizeNumber(rawNutritionBasis.provider_quantity ?? rawNutritionBasis.providerQuantity),
        provider_unit: String(rawNutritionBasis.provider_unit ?? rawNutritionBasis.providerUnit ?? '').trim(),
        provider_weight_grams:
          rawNutritionBasis.provider_weight_grams == null && rawNutritionBasis.providerWeightGrams == null
            ? null
            : sanitizeNumber(rawNutritionBasis.provider_weight_grams ?? rawNutritionBasis.providerWeightGrams),
        scale_factor: sanitizeNumber(rawNutritionBasis.scale_factor ?? rawNutritionBasis.scaleFactor),
        base_nutrition: {
          calories: sanitizeNumber(rawBaseNutrition.calories),
          protein: sanitizeNumber(rawBaseNutrition.protein),
          carbs: sanitizeNumber(rawBaseNutrition.carbs),
          fat: sanitizeNumber(rawBaseNutrition.fat),
          fiber: sanitizeNumber(rawBaseNutrition.fiber),
          sugar: sanitizeNumber(rawBaseNutrition.sugar),
          sodium: sanitizeNumber(rawBaseNutrition.sodium),
        },
      }
    : null;

  return {
    food_name: String(item.food_name ?? item.foodName ?? 'Unknown item').trim() || 'Unknown item',
    quantity: sanitizeNumber(item.quantity ?? 1),
    unit: String(item.unit ?? 'serving').trim() || 'serving',
    calories: sanitizeNumber(item.calories),
    protein: sanitizeNumber(item.protein),
    carbs: sanitizeNumber(item.carbs),
    fat: sanitizeNumber(item.fat),
    fiber: sanitizeNumber(item.fiber),
    sugar: sanitizeNumber(item.sugar),
    sodium: sanitizeNumber(item.sodium),
    notes: item.notes ? String(item.notes) : null,
    is_trusted: isTrusted,
    source_type: sourceType,
    source_name: item.source_name ? String(item.source_name) : item.sourceName ? String(item.sourceName) : null,
    confidence_label: normalizeNutritionVerificationLabel(rawConfidenceLabel, {
      source_type: sourceType as never,
      is_trusted: isTrusted,
      match_type: matchType as never,
    }),
    match_type: matchType,
    matched_query: item.matched_query ? String(item.matched_query) : item.matchedQuery ? String(item.matchedQuery) : null,
    original_user_text: item.original_user_text
      ? String(item.original_user_text)
      : item.originalUserText
        ? String(item.originalUserText)
        : null,
    provider_used: item.provider_used ? String(item.provider_used) : item.providerUsed ? String(item.providerUsed) : null,
    used_ai_fallback:
      typeof item.used_ai_fallback === 'boolean'
        ? item.used_ai_fallback
        : typeof item.usedAiFallback === 'boolean'
          ? item.usedAiFallback
          : null,
    catalog_food_id:
      item.catalog_food_id ? String(item.catalog_food_id) : item.catalogFoodId ? String(item.catalogFoodId) : null,
    userQuantity:
      typeof item.userQuantity === 'number'
        ? sanitizeNumber(item.userQuantity)
        : typeof item.user_quantity === 'number'
          ? sanitizeNumber(item.user_quantity)
          : null,
    userUnit: item.userUnit ? String(item.userUnit) : item.user_unit ? String(item.user_unit) : null,
    userTextSpan: item.userTextSpan ? String(item.userTextSpan) : item.user_text_span ? String(item.user_text_span) : null,
    normalizedGrams:
      typeof item.normalizedGrams === 'number'
        ? sanitizeNumber(item.normalizedGrams)
        : typeof item.normalized_grams === 'number'
          ? sanitizeNumber(item.normalized_grams)
          : null,
    normalizedOunces:
      typeof item.normalizedOunces === 'number'
        ? sanitizeNumber(item.normalizedOunces)
        : typeof item.normalized_ounces === 'number'
          ? sanitizeNumber(item.normalized_ounces)
          : null,
    sourceId: item.sourceId ? String(item.sourceId) : item.source_id ? String(item.source_id) : null,
    providerCandidateId: item.providerCandidateId
      ? String(item.providerCandidateId)
      : item.provider_candidate_id
        ? String(item.provider_candidate_id)
        : null,
    confidence:
      typeof item.confidence === 'number'
        ? Math.max(0, Math.min(1, sanitizeNumber(item.confidence)))
        : null,
    requested_modifiers: requestedModifiers,
    modifier_resolution: modifierResolution,
    review_status: reviewStatus,
    nutrition_basis: nutritionBasis,
  };
}

export function normalizeParsedMealResponse(input: unknown): ParsedMealResponse {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const items = Array.isArray(raw.items) ? raw.items.map((item) => normalizeItem(item as Record<string, unknown>)) : [];
  const fallbackTotals = sumNutrition(items);

  const normalized = {
    needs_clarification: Boolean(raw.needs_clarification),
    clarifying_question: raw.clarifying_question ? String(raw.clarifying_question) : null,
    meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(raw.meal_type))
      ? (raw.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'snack')
      : 'lunch',
    confidence_score: Math.max(0, Math.min(1, sanitizeNumber(raw.confidence_score ?? 0.65))),
    items,
    totals: {
      calories: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.calories ?? fallbackTotals.calories),
      protein: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.protein ?? fallbackTotals.protein),
      carbs: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.carbs ?? fallbackTotals.carbs),
      fat: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.fat ?? fallbackTotals.fat),
      fiber: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.fiber ?? fallbackTotals.fiber),
      sugar: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.sugar ?? fallbackTotals.sugar),
      sodium: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.sodium ?? fallbackTotals.sodium),
    },
  };

  if (normalized.needs_clarification && !normalized.clarifying_question) {
    normalized.clarifying_question = 'Can you share the portion size and any details like grilled, fried, or sauced?';
  }

  return parsedMealResponseSchema.parse(normalized);
}

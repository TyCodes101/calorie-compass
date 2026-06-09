import type { ParsedFoodItem } from '@/lib/ai/types';
import { normalizeNutritionVerificationLabel, type NutritionVerificationLabel } from '@/lib/nutrition/verification';

export type NutritionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type NutritionSourceQuality = 'OFFICIAL' | 'VERIFIED' | 'STRUCTURED' | 'ESTIMATED' | 'UNKNOWN';
export type NutritionValidationIssue =
  | 'missing_serving'
  | 'impossible_serving'
  | 'macro_calorie_mismatch'
  | 'brand_mismatch'
  | 'restaurant_mismatch'
  | 'protein_product_low_protein'
  | 'candy_high_protein'
  | 'diet_soda_has_calories'
  | 'category_macro_mismatch'
  | 'multiple_candidates'
  | 'missing_source';

export type NutritionRiskContext = {
  expectedBrand?: string | null;
  expectedRestaurant?: string | null;
  expectedCategory?: 'protein_snack' | 'protein_drink' | 'candy' | 'diet_soda' | 'restaurant' | 'generic' | null;
  candidateCount?: number;
};

export type NutritionRiskAssessment = {
  riskScore: number;
  riskLevel: NutritionRiskLevel;
  shouldClarify: boolean;
  issues: NutritionValidationIssue[];
  verificationLabel: NutritionVerificationLabel;
  sourceQuality: NutritionSourceQuality;
};

export type NutritionSourceSnapshot = {
  sourceName: string | null;
  sourceType: ParsedFoodItem['source_type'] | null;
  sourceId: string | null;
  providerUsed: string | null;
  verificationLabel: NutritionVerificationLabel;
  sourceQuality: NutritionSourceQuality;
  retrievedAt: string;
  fingerprint: string;
  serving: {
    quantity: number;
    unit: string;
  };
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar: number;
    sodium: number;
  };
};

export type NutritionSourceDrift = {
  hasDrift: boolean;
  requiresReview: boolean;
  changedFields: string[];
};

export type NutritionFailureSignalKind =
  | 'food_edited'
  | 'food_replaced'
  | 'nutrition_corrected'
  | 'repeat_search'
  | 'review_abandoned'
  | 'clarification_required'
  | 'validation_rejected';

export type NutritionFailureSignalInput = {
  kind: NutritionFailureSignalKind;
  text: string;
  reason: string;
  previousItem?: ParsedFoodItem | null;
  nextItem?: ParsedFoodItem | null;
  candidateCount?: number;
};

export type NutritionFailureSignal = {
  kind: NutritionFailureSignalKind;
  queryHash: string;
  queryLength: number;
  tokenCount: number;
  reason: string;
  candidateCount: number | null;
  previousItemFingerprint: string | null;
  nextItemFingerprint: string | null;
  capturedAt: string;
};

export type NutritionFailureSignalSink = (signal: NutritionFailureSignal) => void;

let nutritionFailureSignalSink: NutritionFailureSignalSink | null = null;

function normalizeText(text: string | null | undefined) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsText(haystack: string, needle: string | null | undefined) {
  const normalizedNeedle = normalizeText(needle);
  if (!normalizedNeedle) return true;
  const normalizedHaystack = normalizeText(haystack);
  return normalizedNeedle.split(' ').every((token) => normalizedHaystack.includes(token));
}

function stableHash(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function macroCalories(item: ParsedFoodItem) {
  return Number(item.protein || 0) * 4 + Number(item.carbs || 0) * 4 + Number(item.fat || 0) * 9;
}

function caloriesAlignWithMacros(item: ParsedFoodItem) {
  const calories = Number(item.calories || 0);
  if (!Number.isFinite(calories) || calories < 0) return false;
  if (calories === 0) return macroCalories(item) <= 15;
  return Math.abs(calories - macroCalories(item)) <= Math.max(50, calories * 0.2);
}

function servingIssue(item: ParsedFoodItem): NutritionValidationIssue | null {
  const quantity = Number(item.quantity);
  const unit = String(item.unit ?? '').trim();
  if (!Number.isFinite(quantity) || quantity <= 0 || !unit) return 'missing_serving';

  const normalizedUnit = normalizeText(unit);
  if ((normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') && quantity > 5000) return 'impossible_serving';
  if ((normalizedUnit === 'oz' || normalizedUnit === 'ounce' || normalizedUnit === 'ounces') && quantity > 200) return 'impossible_serving';
  if (['bag', 'bottle', 'can', 'burger', 'sandwich', 'bowl'].includes(normalizedUnit) && quantity > 20) return 'impossible_serving';
  return null;
}

function sourceQuality(item: ParsedFoodItem): NutritionSourceQuality {
  if (item.source_type === 'OFFICIAL_RESTAURANT') return 'OFFICIAL';
  if (item.match_type === 'exact_branded' || item.match_type === 'exact_restaurant' || normalizeNutritionVerificationLabel(item.confidence_label, item) === 'Verified') return 'VERIFIED';
  if (item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback) return 'ESTIMATED';
  if (item.source_name || item.provider_used) return 'STRUCTURED';
  return 'UNKNOWN';
}

function itemFingerprint(item: ParsedFoodItem | null | undefined) {
  if (!item) return null;
  return stableHash([
    normalizeText(item.food_name),
    normalizeText(item.source_name),
    normalizeText(item.sourceId ?? item.catalog_food_id ?? item.provider_used),
    Number(item.quantity || 0),
    normalizeText(item.unit),
    Number(item.calories || 0),
    Number(item.protein || 0),
    Number(item.carbs || 0),
    Number(item.fat || 0),
    Number(item.sugar || 0),
    Number(item.sodium || 0),
  ].join('|'));
}

function validationIssues(item: ParsedFoodItem, context: NutritionRiskContext) {
  const issues: NutritionValidationIssue[] = [];
  const serving = servingIssue(item);
  if (serving) issues.push(serving);
  if (!caloriesAlignWithMacros(item)) issues.push('macro_calorie_mismatch');

  const haystack = [item.food_name, item.source_name, item.notes, item.matched_query].filter(Boolean).join(' ');
  if (context.expectedBrand && !containsText(haystack, context.expectedBrand)) issues.push('brand_mismatch');
  if (context.expectedRestaurant && !containsText(haystack, context.expectedRestaurant)) issues.push('restaurant_mismatch');

  if ((context.expectedCategory === 'protein_drink' || context.expectedCategory === 'protein_snack') && Number(item.protein || 0) < 10) {
    issues.push('protein_product_low_protein');
  }

  if (context.expectedCategory === 'protein_snack' && Number(item.carbs || 0) > Number(item.protein || 0) + 20) {
    issues.push('category_macro_mismatch');
  }

  if (context.expectedCategory === 'candy' && Number(item.protein || 0) > 10) {
    issues.push('candy_high_protein');
  }

  if (context.expectedCategory === 'diet_soda' && (Number(item.calories || 0) > 20 || Number(item.sugar || 0) > 5)) {
    issues.push('diet_soda_has_calories');
  }

  if ((context.candidateCount ?? 1) > 1) issues.push('multiple_candidates');
  if (!item.source_name && !item.provider_used) issues.push('missing_source');
  return [...new Set(issues)];
}

export function assessNutritionRisk(item: ParsedFoodItem, context: NutritionRiskContext = {}): NutritionRiskAssessment {
  const issues = validationIssues(item, context);
  const quality = sourceQuality(item);
  let riskScore = 0;

  for (const issue of issues) {
    if (issue === 'multiple_candidates') riskScore += 18;
    else if (issue === 'missing_source') riskScore += 12;
    else riskScore += 34;
  }

  if (quality === 'UNKNOWN') riskScore += 20;
  if (quality === 'ESTIMATED') riskScore += 24;
  if (quality === 'OFFICIAL' || quality === 'VERIFIED') riskScore -= 12;
  if (item.match_type === 'exact_branded' || item.match_type === 'exact_restaurant') riskScore -= 10;
  riskScore = Math.max(0, Math.min(100, riskScore));

  const hasCriticalIssue = issues.some((issue) => !['multiple_candidates', 'missing_source'].includes(issue));
  const riskLevel: NutritionRiskLevel = hasCriticalIssue || riskScore >= 60 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW';

  return {
    riskScore,
    riskLevel,
    shouldClarify: riskLevel === 'HIGH',
    issues,
    verificationLabel: normalizeNutritionVerificationLabel(item.confidence_label, item),
    sourceQuality: quality,
  };
}

export function buildNutritionSourceSnapshot(item: ParsedFoodItem, retrievedAt = new Date().toISOString()): NutritionSourceSnapshot {
  return {
    sourceName: item.source_name ?? null,
    sourceType: item.source_type ?? null,
    sourceId: item.sourceId ?? item.catalog_food_id ?? null,
    providerUsed: item.provider_used ?? null,
    verificationLabel: normalizeNutritionVerificationLabel(item.confidence_label, item),
    sourceQuality: sourceQuality(item),
    retrievedAt,
    fingerprint: itemFingerprint(item) ?? stableHash('missing-item'),
    serving: {
      quantity: Number(item.quantity || 0),
      unit: String(item.unit ?? ''),
    },
    nutrition: {
      calories: Number(item.calories || 0),
      protein: Number(item.protein || 0),
      carbs: Number(item.carbs || 0),
      fat: Number(item.fat || 0),
      sugar: Number(item.sugar || 0),
      sodium: Number(item.sodium || 0),
    },
  };
}

export function detectNutritionSourceDrift(previous: NutritionSourceSnapshot, current: NutritionSourceSnapshot): NutritionSourceDrift {
  const changedFields = [
    previous.sourceName !== current.sourceName ? 'sourceName' : null,
    previous.sourceType !== current.sourceType ? 'sourceType' : null,
    previous.sourceId !== current.sourceId ? 'sourceId' : null,
    previous.providerUsed !== current.providerUsed ? 'providerUsed' : null,
    previous.verificationLabel !== current.verificationLabel ? 'verificationLabel' : null,
    previous.serving.quantity !== current.serving.quantity ? 'serving.quantity' : null,
    previous.serving.unit !== current.serving.unit ? 'serving.unit' : null,
    previous.nutrition.calories !== current.nutrition.calories ? 'calories' : null,
    previous.nutrition.protein !== current.nutrition.protein ? 'protein' : null,
    previous.nutrition.carbs !== current.nutrition.carbs ? 'carbs' : null,
    previous.nutrition.fat !== current.nutrition.fat ? 'fat' : null,
    previous.nutrition.sugar !== current.nutrition.sugar ? 'sugar' : null,
    previous.nutrition.sodium !== current.nutrition.sodium ? 'sodium' : null,
  ].filter((field): field is string => Boolean(field));

  const nutritionChanged = changedFields.some((field) => ['calories', 'protein', 'carbs', 'fat', 'sugar', 'sodium'].includes(field));
  const trustedSourceChanged = ['OFFICIAL', 'VERIFIED'].includes(previous.sourceQuality) || ['OFFICIAL', 'VERIFIED'].includes(current.sourceQuality);

  return {
    hasDrift: previous.fingerprint !== current.fingerprint || changedFields.length > 0,
    requiresReview: nutritionChanged || trustedSourceChanged,
    changedFields,
  };
}

export function buildNutritionFailureSignal(input: NutritionFailureSignalInput): NutritionFailureSignal {
  const normalized = normalizeText(input.text);
  return {
    kind: input.kind,
    queryHash: stableHash(normalized),
    queryLength: input.text.length,
    tokenCount: normalized ? normalized.split(' ').length : 0,
    reason: input.reason,
    candidateCount: typeof input.candidateCount === 'number' ? input.candidateCount : null,
    previousItemFingerprint: itemFingerprint(input.previousItem),
    nextItemFingerprint: itemFingerprint(input.nextItem),
    capturedAt: new Date().toISOString(),
  };
}

export function configureNutritionFailureSignalSink(sink: NutritionFailureSignalSink | null) {
  nutritionFailureSignalSink = sink;
}

export function recordNutritionFailureSignal(input: NutritionFailureSignalInput) {
  const signal = buildNutritionFailureSignal(input);
  nutritionFailureSignalSink?.(signal);
  return signal;
}

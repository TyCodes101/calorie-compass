import type { ParsedFoodItem } from '@/lib/ai/types';

export type NutritionVerificationLabel = 'Verified' | 'Matched' | 'Estimated' | 'Needs Review';

export const nutritionVerificationLabels = ['Verified', 'Matched', 'Estimated', 'Needs Review'] as const;

function cleanLabel(label: unknown) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeNutritionVerificationLabel(
  label: unknown,
  context?: Pick<ParsedFoodItem, 'source_type' | 'is_trusted' | 'match_type'>,
): NutritionVerificationLabel {
  const normalized = cleanLabel(label);

  if (context?.source_type === 'AI_ESTIMATE') {
    if (normalized === 'needs review' || normalized === 'low confidence' || normalized === 'low') {
      return 'Needs Review';
    }

    return 'Estimated';
  }

  if (normalized === 'verified' || normalized === 'very high') {
    return 'Verified';
  }

  if (normalized === 'matched' || normalized === 'high confidence' || normalized === 'high' || normalized === 'medium') {
    return 'Matched';
  }

  if (normalized === 'estimated') {
    return 'Estimated';
  }

  if (normalized === 'needs review' || normalized === 'low confidence' || normalized === 'low') {
    return 'Needs Review';
  }

  if (context?.source_type === 'OFFICIAL_RESTAURANT' || context?.match_type === 'exact_branded' || context?.match_type === 'exact_restaurant') {
    return 'Verified';
  }

  if (context?.is_trusted || context?.source_type === 'GENERIC_REFERENCE') {
    return 'Matched';
  }

  return 'Needs Review';
}

import type { MealAnalysis } from '@/lib/ai/analyze';

export function scoreMealConfidence(
  analysis: MealAnalysis,
  options: {
    itemCount: number;
    clarificationNeeded: boolean;
    trustedItemCount?: number;
    estimatedItemCount?: number;
  }
) {
  let score = 0.58;

  if (analysis.brand) score += 0.16;
  if (analysis.hasPortion) score += 0.08;
  if (analysis.hasCookingStyle) score += 0.06;
  if (analysis.hasSauceSignal) score += 0.03;
  if (analysis.hasMultipleItems) score += 0.05;
  if (analysis.specificity === 'high') score += 0.1;
  if (analysis.specificity === 'medium') score += 0.03;
  if (analysis.specificity === 'low') score -= 0.08;
  if (analysis.category === 'simple') score += 0.07;
  if (options.itemCount >= 2) score += 0.03;
  if (options.itemCount === 0) score -= 0.15;
  if (options.clarificationNeeded) score -= 0.22;

  const trustedItemCount = options.trustedItemCount ?? 0;
  const estimatedItemCount = options.estimatedItemCount ?? Math.max(0, options.itemCount - trustedItemCount);

  if (trustedItemCount > 0 && trustedItemCount === options.itemCount) score += 0.08;
  else if (trustedItemCount > 0) score += 0.03;

  if (estimatedItemCount > 0 && trustedItemCount > 0) score -= 0.03;
  if (estimatedItemCount > 0 && trustedItemCount === 0) score -= 0.06;

  return Math.max(0.2, Math.min(0.95, Math.round(score * 100) / 100));
}

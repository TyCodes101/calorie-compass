import type { MealAnalysis } from '@/lib/ai/analyze';
import { scoreMealConfidence } from '@/lib/ai/confidence';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { ParsedMealResponse } from '@/lib/ai/types';

export type MealTypeValue = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export function inferMealType(mealType?: string, text?: string): MealTypeValue {
  if (mealType && ['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
    return mealType as MealTypeValue;
  }

  const lower = (text ?? '').toLowerCase();
  if (lower.includes('breakfast') || lower.includes('egg')) return 'breakfast';
  if (lower.includes('dinner')) return 'dinner';
  if (lower.includes('snack') || lower.includes('shake')) return 'snack';
  return 'lunch';
}

export function makeClarificationResponse(question: string, mealType: MealTypeValue, confidenceScore: number) {
  return normalizeParsedMealResponse({
    needs_clarification: true,
    clarifying_question: question,
    meal_type: mealType,
    confidence_score: confidenceScore,
    items: [],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  });
}

export function finalizeParsedResponse(analysis: MealAnalysis, response: ParsedMealResponse) {
  return {
    ...response,
    confidence_score: scoreMealConfidence(analysis, {
      itemCount: response.items.length,
      clarificationNeeded: response.needs_clarification,
    }),
  };
}

export function shouldUseDeterministicRestaurantEstimate(analysis: MealAnalysis) {
  return analysis.brand !== null && analysis.specificity !== 'low' && !analysis.likelyNeedsClarification;
}

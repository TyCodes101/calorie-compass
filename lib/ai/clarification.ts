import type { MealAnalysis } from '@/lib/ai/analyze';

export type ClarificationDecision = {
  needsClarification: boolean;
  question: string | null;
  reason: 'portion' | 'cooking_style' | 'meal_type' | 'none';
};

export function buildClarificationDecision(analysis: MealAnalysis): ClarificationDecision {
  if (!analysis.likelyNeedsClarification) {
    return { needsClarification: false, question: null, reason: 'none' };
  }

  if (/\b(chicken and rice)\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'About how much chicken and rice did you have, and was the chicken grilled, fried, or cooked with sauce?',
      reason: 'portion',
    };
  }

  if (/\b(protein shake|pasta|salad|sandwich|tacos?|bowl)\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: false,
      question: null,
      reason: 'none',
    };
  }

  if (/\bsnacks?\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'What snacks did you have, and about how much of each?',
      reason: 'meal_type',
    };
  }

  if (/\brice\b/i.test(analysis.normalizedText) && !analysis.hasMultipleItems) {
    return {
      needsClarification: true,
      question: 'About how much rice did you have, and was it plain or cooked with butter or oil?',
      reason: 'portion',
    };
  }

  if (/\bchicken\b/i.test(analysis.normalizedText) && !analysis.hasMultipleItems) {
    return {
      needsClarification: true,
      question: 'About how much chicken did you have, and was it grilled, fried, or cooked with sauce?',
      reason: 'cooking_style',
    };
  }

  if (!analysis.hasPortion) {
    return {
      needsClarification: true,
      question: 'What was it, and about how much did you have?',
      reason: 'portion',
    };
  }

  if (!analysis.hasCookingStyle && /\b(chicken|salmon|beef|steak|shrimp)\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'Was it grilled, fried, baked, or cooked with sauce or oil?',
      reason: 'cooking_style',
    };
  }

  return { needsClarification: false, question: null, reason: 'none' };
}

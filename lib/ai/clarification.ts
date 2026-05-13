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
      question: 'About how much chicken and rice did you have, and was the chicken grilled, fried, or sauced?',
      reason: 'portion',
    };
  }

  if (/\bpasta\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'What kind of pasta was it, about how much did you have, and was there any sauce or protein with it?',
      reason: 'portion',
    };
  }

  if (!analysis.hasPortion) {
    return {
      needsClarification: true,
      question: 'About how much did you have, and were there any sauces, oils, or extra toppings?',
      reason: 'portion',
    };
  }

  if (!analysis.hasCookingStyle && analysis.category === 'home_cooked') {
    return {
      needsClarification: true,
      question: 'Was it grilled, fried, baked, or cooked with sauce or oil?',
      reason: 'cooking_style',
    };
  }

  return { needsClarification: false, question: null, reason: 'none' };
}

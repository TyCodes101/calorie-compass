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

  if (/\bprotein shake\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'What went in the protein shake, and about how much did you have?',
      reason: 'meal_type',
    };
  }

  if (/\bpasta\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'What kind of pasta was it, about how much did you have, and was there any sauce or protein with it?',
      reason: 'portion',
    };
  }

  if (/\bsalad\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'What kind of salad was it, about how much dressing did you use, and did it include any protein like chicken or steak?',
      reason: 'meal_type',
    };
  }

  if (/\bsandwich\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'What kind of sandwich was it, about how large was it, and were there any sauces or cheese on it?',
      reason: 'meal_type',
    };
  }

  if (/\btacos?\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'How many tacos did you have, and what were the main fillings or toppings?',
      reason: 'meal_type',
    };
  }

  if (/\bbowl\b/i.test(analysis.normalizedText)) {
    return {
      needsClarification: true,
      question: 'What kind of bowl was it, and what were the main ingredients?',
      reason: 'meal_type',
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

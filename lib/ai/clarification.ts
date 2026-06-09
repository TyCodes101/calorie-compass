import type { MealAnalysis } from '@/lib/ai/analyze';

export type ClarificationDecision = {
  needsClarification: boolean;
  question: string | null;
  reason: 'portion' | 'cooking_style' | 'meal_type' | 'none';
};

const packagedSnackRegex = /\b(quaker(?: oats)?|white cheddar|rice cakes?|chips?|protein bars?|popcorn|crackers?|packaged snacks?)\b/i;
const compoundFoodRegex = /\b(white cheddar rice cakes?|rice cakes?|protein bars?|chicken sandwich|peanut butter|ice cream|grilled chicken(?: breast)?|hash browns?|french fries|mac and cheese)\b/i;

export function buildClarificationDecision(analysis: MealAnalysis): ClarificationDecision {
  const normalized = analysis.normalizedText
    .replace(/^\s*(?:i had|i ate|had|ate|drank)\s+/i, '')
    .replace(/^\s*(?:a|an|some|the|one)\s+/i, '')
    .trim();

  if (/^chips?$/.test(normalized)) {
    return {
      needsClarification: true,
      question: 'Which chips did you mean, and about how much did you have?',
      reason: 'portion',
    };
  }

  if (/^protein shake$/.test(normalized)) {
    return {
      needsClarification: true,
      question: 'Which protein shake was it? Brand or bottle size is enough.',
      reason: 'portion',
    };
  }

  if (/^fries$/.test(normalized)) {
    return {
      needsClarification: true,
      question: 'Which restaurant or serving size were the fries?',
      reason: 'portion',
    };
  }

  if (/^salad$/.test(normalized)) {
    return {
      needsClarification: true,
      question: 'For the salad, what protein or toppings were in it, how much dressing, and about how big was it?',
      reason: 'portion',
    };
  }

  if (/^bowl$/.test(normalized)) {
    return {
      needsClarification: true,
      question: 'Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate.',
      reason: 'portion',
    };
  }

  if (/^sandwich$/.test(normalized)) {
    return {
      needsClarification: true,
      question: 'For the sandwich, what bread, meat or main filling, cheese/condiments, and rough size should I use?',
      reason: 'portion',
    };
  }

  if (!analysis.likelyNeedsClarification || packagedSnackRegex.test(analysis.normalizedText) || compoundFoodRegex.test(analysis.normalizedText)) {
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

  if (/\brice\b/i.test(analysis.normalizedText) && !/\brice cakes?\b/i.test(analysis.normalizedText) && !analysis.hasMultipleItems) {
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

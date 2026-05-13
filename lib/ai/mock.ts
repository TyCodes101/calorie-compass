import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';
import { scoreMealConfidence } from '@/lib/ai/confidence';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { getRestaurantEstimate } from '@/lib/ai/restaurant';
import type { ParsedMealResponse } from '@/lib/ai/types';

function inferMealType(mealType?: string, text?: string) {
  if (mealType && ['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) return mealType;
  const lower = (text ?? '').toLowerCase();
  if (lower.includes('breakfast') || lower.includes('egg')) return 'breakfast';
  if (lower.includes('dinner')) return 'dinner';
  if (lower.includes('snack') || lower.includes('shake')) return 'snack';
  return 'lunch';
}

function makeClarificationResponse(question: string, mealType: string, confidenceScore: number) {
  return normalizeParsedMealResponse({
    needs_clarification: true,
    clarifying_question: question,
    meal_type: mealType,
    confidence_score: confidenceScore,
    items: [],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  });
}

export function getMockParsedMeal(text: string, mealType?: string): ParsedMealResponse {
  const lower = text.toLowerCase();
  const inferredMealType = inferMealType(mealType, text) as 'breakfast' | 'lunch' | 'dinner' | 'snack';
  const analysis = analyzeMealText(text);
  const clarification = buildClarificationDecision(analysis);

  if (clarification.needsClarification && clarification.question) {
    return makeClarificationResponse(
      clarification.question,
      inferredMealType,
      scoreMealConfidence(analysis, { itemCount: 0, clarificationNeeded: true })
    );
  }

  let response: ParsedMealResponse;

  const restaurantEstimate = getRestaurantEstimate(text, inferredMealType);

  if (restaurantEstimate) {
    response = restaurantEstimate;
  } else if (lower.includes('protein shake')) {
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.9,
      items: [
        { food_name: 'Protein shake', quantity: 1, unit: 'shake', calories: 170, protein: 30, carbs: 5, fat: 3, fiber: 1, sugar: 2, sodium: 180, notes: 'One scoop protein with almond milk' },
      ],
    });
  } else if (lower.includes('egg')) {
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.85,
      items: [
        { food_name: 'Eggs', quantity: 3, unit: 'large eggs', calories: 210, protein: 18, carbs: 2, fat: 15, fiber: 0, sugar: 1, sodium: 210, notes: 'Approximate default estimate' },
      ],
    });
  } else {
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.67,
      items: [
        { food_name: 'Estimated mixed meal', quantity: 1, unit: 'meal', calories: 520, protein: 30, carbs: 45, fat: 20, fiber: 5, sugar: 6, sodium: 780, notes: 'General estimate based on the provided description' },
      ],
    });
  }

  return {
    ...response,
    confidence_score: scoreMealConfidence(analysis, {
      itemCount: response.items.length,
      clarificationNeeded: false,
    }),
  };
}

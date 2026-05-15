import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';
import { scoreMealConfidence } from '@/lib/ai/confidence';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { finalizeParsedResponse, inferMealType, makeClarificationResponse } from '@/lib/ai/orchestrate';
import { getRestaurantEstimate } from '@/lib/ai/restaurant';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
import type { ParsedMealResponse } from '@/lib/ai/types';

function buildPreservedFallbackName(text: string) {
  const cleaned = text
    .trim()
    .replace(/^(?:i\s+(?:had|ate|drank)|had|ate|drank)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');

  return cleaned || 'meal';
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

  const trustedEstimate = getTrustedCatalogEstimate(text, inferredMealType);

  if (trustedEstimate) {
    return finalizeParsedResponse(analysis, trustedEstimate);
  }

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
    const fallbackName = buildPreservedFallbackName(text);
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.67,
      items: [
        { food_name: fallbackName, quantity: 1, unit: 'meal', calories: 520, protein: 30, carbs: 45, fat: 20, fiber: 5, sugar: 6, sodium: 780, notes: 'General estimate based on the provided description' },
      ],
    });
  }

  return finalizeParsedResponse(analysis, response);
}

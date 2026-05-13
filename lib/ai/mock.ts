import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';
import { scoreMealConfidence } from '@/lib/ai/confidence';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
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

  if (lower.includes('chipotle') && lower.includes('double chicken')) {
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.88,
      items: [
        { food_name: 'Chipotle white rice', quantity: 1, unit: 'serving', calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sugar: 0, sodium: 350, notes: 'Estimated from typical Chipotle serving' },
        { food_name: 'Chipotle chicken', quantity: 2, unit: 'servings', calories: 360, protein: 64, carbs: 2, fat: 14, fiber: 0, sugar: 0, sodium: 620, notes: 'Estimated from double chicken order' },
        { food_name: 'Chipotle cheese', quantity: 1, unit: 'serving', calories: 110, protein: 6, carbs: 1, fat: 8, fiber: 0, sugar: 0, sodium: 185, notes: 'Estimated from typical topping portion' },
        { food_name: 'Chipotle corn salsa', quantity: 1, unit: 'serving', calories: 80, protein: 3, carbs: 16, fat: 1, fiber: 3, sugar: 4, sodium: 330, notes: 'Estimated from typical topping portion' },
        { food_name: 'Chipotle lettuce', quantity: 1, unit: 'serving', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1, sugar: 0, sodium: 5, notes: 'Estimated from typical topping portion' },
        { food_name: 'Chipotle tomatillo green salsa', quantity: 1, unit: 'serving', calories: 15, protein: 0, carbs: 3, fat: 0, fiber: 1, sugar: 1, sodium: 260, notes: 'Estimated from typical topping portion' },
      ],
    });
  } else if (lower.includes('starbucks') && lower.includes('bacon gouda')) {
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.83,
      items: [
        { food_name: 'Starbucks Bacon Gouda Sandwich', quantity: 1, unit: 'sandwich', calories: 360, protein: 18, carbs: 35, fat: 17, fiber: 1, sugar: 2, sodium: 760, notes: 'Estimated from standard Starbucks menu item' },
        { food_name: 'Starbucks Caffe Latte', quantity: lower.includes('grande') ? 1 : 1, unit: lower.includes('grande') ? 'grande' : 'latte', calories: 190, protein: 13, carbs: 18, fat: 7, fiber: 0, sugar: 18, sodium: 150, notes: 'Estimated from standard milk-based latte' },
      ],
    });
  } else if (lower.includes('chick-fil-a')) {
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.79,
      items: [
        { food_name: 'Chick-fil-A Chicken Sandwich', quantity: 1, unit: 'sandwich', calories: 420, protein: 29, carbs: 41, fat: 18, fiber: 2, sugar: 6, sodium: 1460, notes: 'Estimated from standard Chick-fil-A menu item' },
      ],
    });
  } else if (lower.includes('mcdonald')) {
    response = normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.78,
      items: [
        { food_name: "McDonald's Cheeseburger", quantity: 1, unit: 'burger', calories: 300, protein: 15, carbs: 33, fat: 13, fiber: 2, sugar: 7, sodium: 720, notes: "Estimated from standard McDonald's menu item" },
      ],
    });
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

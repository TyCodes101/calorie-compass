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

export function getMockParsedMeal(text: string, mealType?: string): ParsedMealResponse {
  const lower = text.toLowerCase();
  const inferredMealType = inferMealType(mealType, text) as 'breakfast' | 'lunch' | 'dinner' | 'snack';

  if (lower.includes('chicken and rice') && !/(cup|cups|oz|ounces|serving|bowl|plate|grilled|fried|sauce)/.test(lower)) {
    return normalizeParsedMealResponse({
      needs_clarification: true,
      clarifying_question: 'About how much chicken and rice did you have, and was the chicken grilled, fried, or sauced?',
      meal_type: inferredMealType,
      confidence_score: 0.42,
      items: [],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    });
  }

  if (lower.includes('chipotle') && lower.includes('double chicken')) {
    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.88,
      items: [
        { food_name: 'Chipotle white rice', quantity: 1, unit: 'serving', calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sugar: 0, sodium: 350, notes: 'Estimated from typical restaurant serving' },
        { food_name: 'Chipotle chicken', quantity: 2, unit: 'servings', calories: 360, protein: 64, carbs: 2, fat: 14, fiber: 0, sugar: 0, sodium: 620, notes: 'Estimated from double chicken' },
        { food_name: 'Cheese', quantity: 1, unit: 'serving', calories: 110, protein: 6, carbs: 1, fat: 8, fiber: 0, sugar: 0, sodium: 185, notes: 'Estimated from typical serving' },
        { food_name: 'Corn salsa', quantity: 1, unit: 'serving', calories: 80, protein: 3, carbs: 16, fat: 1, fiber: 3, sugar: 4, sodium: 330, notes: 'Estimated from typical serving' },
        { food_name: 'Lettuce', quantity: 1, unit: 'serving', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1, sugar: 0, sodium: 5, notes: 'Estimated from typical serving' },
        { food_name: 'Tomatillo green salsa', quantity: 1, unit: 'serving', calories: 15, protein: 0, carbs: 3, fat: 0, fiber: 1, sugar: 1, sodium: 260, notes: 'Estimated from typical serving' },
      ],
    });
  }

  if (lower.includes('protein shake')) {
    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.9,
      items: [
        { food_name: 'Protein shake', quantity: 1, unit: 'shake', calories: 170, protein: 30, carbs: 5, fat: 3, fiber: 1, sugar: 2, sodium: 180, notes: 'One scoop protein with almond milk' },
      ],
    });
  }

  if (lower.includes('egg')) {
    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: inferredMealType,
      confidence_score: 0.85,
      items: [
        { food_name: 'Eggs', quantity: 3, unit: 'large eggs', calories: 210, protein: 18, carbs: 2, fat: 15, fiber: 0, sugar: 1, sodium: 210, notes: 'Approximate default estimate' },
      ],
    });
  }

  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: inferredMealType,
    confidence_score: 0.67,
    items: [
      { food_name: 'Estimated mixed meal', quantity: 1, unit: 'meal', calories: 520, protein: 30, carbs: 45, fat: 20, fiber: 5, sugar: 6, sodium: 780, notes: 'General estimate based on the provided description' },
    ],
  });
}

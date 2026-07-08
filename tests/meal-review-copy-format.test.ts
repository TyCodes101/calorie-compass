import { describe, expect, it } from 'vitest';

import { buildPendingReviewReply } from '@/lib/ai/mealPendingState';
import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import type { ParsedFoodItem } from '@/lib/ai/types';

function item(food_name: string, quantity: number, unit: string, calories: number): ParsedFoodItem {
  return {
    food_name,
    quantity,
    unit,
    calories,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    notes: 'Reviewable estimate.',
    is_trusted: false,
    source_type: 'AI_ESTIMATE',
    source_name: 'AI estimate',
    confidence_label: 'Estimated',
    matched_query: null,
    original_user_text: null,
    provider_used: null,
    used_ai_fallback: true,
    catalog_food_id: null,
  };
}

function stateWithItems(items: ParsedFoodItem[]): MealAssistantState {
  return {
    currentMealItems: items,
    pendingMeal: {
      id: 'pending-format',
      version: 1,
      status: 'readyForReview',
      mealType: 'dinner',
      displayTitle: '210 Banana and 207.5g Chicken breast',
      rawText: 'format test',
      items,
      totals: {
        calories: items.reduce((sum, food) => sum + food.calories, 0),
        protein: 60,
        carbs: 5400,
        fat: 30,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      },
      confidenceScore: 0.72,
      createdAt: null,
      updatedAt: null,
    },
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'dinner',
    userName: 'Tyler Cox',
    currentMealText: null,
    confidenceScore: 0.72,
    sourceReusableMealId: null,
    editingMealId: null,
  };
}

describe('meal review copy and quantity formatting', () => {
  it('formats pending review quantities without scientific notation', () => {
    const reply = buildPendingReviewReply(stateWithItems([
      item('Banana', 2.1e2, 'count', 22050),
      item('Chicken breast', 2.075e2, 'g', 342),
    ]));

    expect(reply).not.toMatch(/e\+/i);
    expect(reply).toMatch(/210|207\.5/);
  });
});

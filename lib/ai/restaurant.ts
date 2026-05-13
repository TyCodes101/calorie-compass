import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { ParsedMealResponse } from '@/lib/ai/types';

export function getRestaurantEstimate(text: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): ParsedMealResponse | null {
  const lower = text.toLowerCase();

  if (lower.includes('chipotle')) {
    const doubleChicken = lower.includes('double chicken');
    const hasRice = lower.includes('rice');
    const hasCheese = lower.includes('cheese');
    const hasCorn = lower.includes('corn');
    const hasLettuce = lower.includes('lettuce');
    const hasGreenSalsa = lower.includes('green salsa') || lower.includes('tomatillo');

    const items = [
      hasRice
        ? { food_name: 'Chipotle white rice', quantity: 1, unit: 'serving', calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sugar: 0, sodium: 350, notes: 'Estimated from typical Chipotle serving' }
        : null,
      { food_name: 'Chipotle chicken', quantity: doubleChicken ? 2 : 1, unit: doubleChicken ? 'servings' : 'serving', calories: doubleChicken ? 360 : 180, protein: doubleChicken ? 64 : 32, carbs: doubleChicken ? 2 : 1, fat: doubleChicken ? 14 : 7, fiber: 0, sugar: 0, sodium: doubleChicken ? 620 : 310, notes: doubleChicken ? 'Estimated from double chicken order' : 'Estimated from standard chicken portion' },
      hasCheese
        ? { food_name: 'Chipotle cheese', quantity: 1, unit: 'serving', calories: 110, protein: 6, carbs: 1, fat: 8, fiber: 0, sugar: 0, sodium: 185, notes: 'Estimated from typical topping portion' }
        : null,
      hasCorn
        ? { food_name: 'Chipotle corn salsa', quantity: 1, unit: 'serving', calories: 80, protein: 3, carbs: 16, fat: 1, fiber: 3, sugar: 4, sodium: 330, notes: 'Estimated from typical topping portion' }
        : null,
      hasLettuce
        ? { food_name: 'Chipotle lettuce', quantity: 1, unit: 'serving', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1, sugar: 0, sodium: 5, notes: 'Estimated from typical topping portion' }
        : null,
      hasGreenSalsa
        ? { food_name: 'Chipotle tomatillo green salsa', quantity: 1, unit: 'serving', calories: 15, protein: 0, carbs: 3, fat: 0, fiber: 1, sugar: 1, sodium: 260, notes: 'Estimated from typical topping portion' }
        : null,
    ].filter(Boolean);

    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: mealType,
      confidence_score: 0.88,
      items,
    });
  }

  if (lower.includes('starbucks')) {
    const items = [];
    if (lower.includes('bacon gouda')) {
      items.push({
        food_name: 'Starbucks Bacon Gouda Sandwich',
        quantity: 1,
        unit: 'sandwich',
        calories: 360,
        protein: 18,
        carbs: 35,
        fat: 17,
        fiber: 1,
        sugar: 2,
        sodium: 760,
        notes: 'Estimated from standard Starbucks menu item',
      });
    }

    if (lower.includes('latte')) {
      const grande = lower.includes('grande');
      const venti = lower.includes('venti');
      items.push({
        food_name: 'Starbucks Caffe Latte',
        quantity: 1,
        unit: venti ? 'venti' : grande ? 'grande' : 'tall',
        calories: venti ? 250 : grande ? 190 : 150,
        protein: venti ? 17 : grande ? 13 : 10,
        carbs: venti ? 24 : grande ? 18 : 14,
        fat: venti ? 9 : grande ? 7 : 6,
        fiber: 0,
        sugar: venti ? 24 : grande ? 18 : 14,
        sodium: venti ? 200 : grande ? 150 : 115,
        notes: 'Estimated from standard milk-based latte',
      });
    }

    if (items.length) {
      return normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: mealType,
        confidence_score: 0.83,
        items,
      });
    }
  }

  if (lower.includes('chick-fil-a') || lower.includes('chick fil a')) {
    const items = [];
    if (lower.includes('nugget')) {
      items.push({
        food_name: 'Chick-fil-A Nuggets',
        quantity: lower.includes('12 count') ? 12 : 8,
        unit: 'count',
        calories: lower.includes('12 count') ? 380 : 250,
        protein: lower.includes('12 count') ? 40 : 25,
        carbs: 11,
        fat: lower.includes('12 count') ? 18 : 12,
        fiber: 0,
        sugar: 1,
        sodium: lower.includes('12 count') ? 1140 : 760,
        notes: 'Estimated from standard Chick-fil-A nuggets',
      });
    } else if (lower.includes('sandwich')) {
      items.push({
        food_name: 'Chick-fil-A Chicken Sandwich',
        quantity: 1,
        unit: 'sandwich',
        calories: 420,
        protein: 29,
        carbs: 41,
        fat: 18,
        fiber: 2,
        sugar: 6,
        sodium: 1460,
        notes: 'Estimated from standard Chick-fil-A menu item',
      });
    }

    if (lower.includes('fries')) {
      items.push({
        food_name: 'Chick-fil-A Waffle Fries',
        quantity: 1,
        unit: 'medium order',
        calories: 420,
        protein: 5,
        carbs: 45,
        fat: 24,
        fiber: 5,
        sugar: 1,
        sodium: 240,
        notes: 'Estimated from standard medium waffle fries',
      });
    }

    if (items.length) {
      return normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: mealType,
        confidence_score: 0.81,
        items,
      });
    }
  }

  if (lower.includes("mcdonald") || lower.includes('mcdonalds')) {
    const items = [];
    if (lower.includes('cheeseburger')) {
      items.push({
        food_name: "McDonald's Cheeseburger",
        quantity: 1,
        unit: 'burger',
        calories: 300,
        protein: 15,
        carbs: 33,
        fat: 13,
        fiber: 2,
        sugar: 7,
        sodium: 720,
        notes: "Estimated from standard McDonald's menu item",
      });
    }
    if (lower.includes('fries')) {
      items.push({
        food_name: "McDonald's Fries",
        quantity: 1,
        unit: 'medium order',
        calories: 320,
        protein: 4,
        carbs: 43,
        fat: 15,
        fiber: 4,
        sugar: 0,
        sodium: 260,
        notes: "Estimated from standard medium fries",
      });
    }
    if (lower.includes('coke') || lower.includes('sprite') || lower.includes('drink')) {
      items.push({
        food_name: "McDonald's Soft Drink",
        quantity: 1,
        unit: 'medium',
        calories: 210,
        protein: 0,
        carbs: 58,
        fat: 0,
        fiber: 0,
        sugar: 57,
        sodium: 20,
        notes: "Estimated from standard medium fountain drink",
      });
    }

    if (items.length) {
      return normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: mealType,
        confidence_score: 0.79,
        items,
      });
    }
  }

  return null;
}

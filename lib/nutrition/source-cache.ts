import type { CachedNutritionFood } from '@prisma/client';

import { hasDatabaseConnectionString } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import type { FoodSearchResult } from '@/lib/food-search';
import { normalizeBarcode } from '@/lib/nutrition/barcode';

export function cachedFoodToSearchResult(food: CachedNutritionFood): FoodSearchResult {
  return {
    id: `cache:${food.provider}:${food.providerId}`,
    name: food.name,
    brand: food.brand ?? null,
    restaurant: null,
    sourceLabel: 'Brand verified',
    sourceType: 'GENERIC_REFERENCE',
    sourceName: `${food.provider}`,
    providerId: food.providerId,
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    calories: Math.round(food.calories),
    protein: Math.round(food.protein),
    carbs: Math.round(food.carbs),
    fat: Math.round(food.fat),
    barcode: food.barcode ?? null,
    mealType: 'snack',
    confidenceScore: 1,
    estimated: false,
    needsReview: false,
    reason: null,
    sourceReusableMealId: null,
    items: [
      {
        food_name: food.name,
        quantity: food.servingQuantity,
        unit: food.servingUnit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        sugar: food.sugar,
        sodium: food.sodium,
        notes: null,
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: `${food.provider}`,
        catalog_food_id: null,
      },
    ],
  };
}

export async function getCachedFoodByBarcode(barcode: string) {
  if (!hasDatabaseConnectionString()) return null;
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  return prisma.cachedNutritionFood.findFirst({
    // Legacy Open Food Facts rows may contain per-100g values represented as a
    // serving. The guarded provider now uses a bounded in-memory cache instead.
    where: { barcode: normalized, provider: { not: 'OPEN_FOOD_FACTS' } },
    orderBy: { updatedAt: 'desc' },
  });
}

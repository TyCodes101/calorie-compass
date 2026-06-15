import { Prisma } from '@prisma/client';

import { hasDatabaseConnectionString } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import type { FoodSearchResult } from '@/lib/food-search';
import { normalizeBarcode } from '@/lib/barcode-lookup';

// NOTE: This repo can be checked out without running `prisma generate`, so we avoid relying on
// Prisma's exported model types here (they can be missing until generation runs).
type CachedNutritionFood = {
  provider: string;
  providerId: string;
  barcode: string | null;
  normalizedQuery: string | null;
  name: string;
  brand: string | null;
  servingQuantity: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

type CachedNutritionFoodCreateData = CachedNutritionFood & {
  rawPayload: Prisma.InputJsonValue;
};

type CachedNutritionFoodUpdateData = Omit<
  CachedNutritionFoodCreateData,
  'provider' | 'providerId' | 'normalizedQuery'
>;

type CachedNutritionFoodDelegate = {
  findFirst(args: {
    where: { barcode: string };
    orderBy: { updatedAt: 'desc' };
  }): Promise<CachedNutritionFood | null>;
  upsert(args: {
    where: {
      provider_providerId: {
        provider: string;
        providerId: string;
      };
    };
    create: CachedNutritionFoodCreateData;
    update: CachedNutritionFoodUpdateData;
  }): Promise<CachedNutritionFood>;
};

const cachedNutritionFood = (
  prisma as typeof prisma & { cachedNutritionFood: CachedNutritionFoodDelegate }
).cachedNutritionFood;

type CachedNutritionFoodLike = {
  provider: string;
  providerId: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  servingQuantity: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

export function cachedFoodToSearchResult<T extends CachedNutritionFoodLike>(food: T): FoodSearchResult {
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

  return (cachedNutritionFood.findFirst({
    where: { barcode: normalized },
    orderBy: { updatedAt: 'desc' },
  }) as Promise<CachedNutritionFood | null>);
}

export async function upsertCachedFoodFromOpenFoodFacts(options: {
  providerId: string;
  barcode: string;
  name: string;
  brand?: string | null;
  servingQuantity?: number;
  servingUnit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  rawPayload?: unknown;
}) {
  if (!hasDatabaseConnectionString()) return null;

  const barcode = normalizeBarcode(options.barcode);
  if (!barcode) return null;

  return (cachedNutritionFood.upsert({
    where: {
      provider_providerId: {
        provider: 'OPEN_FOOD_FACTS',
        providerId: options.providerId,
      },
    },
    create: {
      provider: 'OPEN_FOOD_FACTS',
      providerId: options.providerId,
      barcode,
      normalizedQuery: null,
      name: options.name,
      brand: options.brand ?? null,
      servingQuantity: options.servingQuantity ?? 1,
      servingUnit: options.servingUnit ?? 'serving',
      calories: options.calories,
      protein: options.protein,
      carbs: options.carbs,
      fat: options.fat,
      fiber: options.fiber ?? 0,
      sugar: options.sugar ?? 0,
      sodium: options.sodium ?? 0,
      rawPayload: (options.rawPayload ?? null) as Prisma.InputJsonValue,
    },
    update: {
      barcode,
      name: options.name,
      brand: options.brand ?? null,
      servingQuantity: options.servingQuantity ?? 1,
      servingUnit: options.servingUnit ?? 'serving',
      calories: options.calories,
      protein: options.protein,
      carbs: options.carbs,
      fat: options.fat,
      fiber: options.fiber ?? 0,
      sugar: options.sugar ?? 0,
      sodium: options.sodium ?? 0,
      rawPayload: (options.rawPayload ?? null) as Prisma.InputJsonValue,
    },
  }) as Promise<CachedNutritionFood>);
}

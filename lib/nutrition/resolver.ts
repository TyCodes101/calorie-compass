import type { ParsedFoodItem } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import { getCurrentUserId, hasDatabaseConnectionString } from '@/lib/current-user';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import type { NutritionLabelInput } from '@/lib/nutrition/types';
import { prisma } from '@/lib/prisma';

export type { NutritionLabelInput } from '@/lib/nutrition/types';

export type NutritionResolverInput = {
  text: string;
  mealType: MealTypeValue;
  nutritionLabel?: NutritionLabelInput | null;
  barcode?: string | null;
};

function normalizeLookupText(text: string) {
  return text
    .toLowerCase()
    .replace(/additional detail:.*/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMealResponse(mealType: MealTypeValue, items: ParsedFoodItem[], confidenceScore: number) {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: confidenceScore,
    items,
  });
}

function extractBarcode(text: string) {
  const match = text.match(/\b\d{8,14}\b/);
  return match?.[0] ?? null;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFromSavedCorrection(text: string, mealType: MealTypeValue) {
  try {
    if (!hasDatabaseConnectionString()) {
      return null;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const normalizedText = normalizeLookupText(text);
    if (!normalizedText) {
      return null;
    }

    const meals = await prisma.meal.findMany({
      where: {
        userId,
        mealType: mealType.toUpperCase() as 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK',
        rawText: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        rawText: true,
        confidenceScore: true,
        items: {
          select: {
            foodName: true,
            quantity: true,
            unit: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            fiber: true,
            sugar: true,
            sodium: true,
            notes: true,
            nutritionSourceType: true,
            nutritionSourceName: true,
            catalogFoodId: true,
          },
        },
      },
    });

    const matchedMeal = meals.find((meal) => normalizeLookupText(meal.rawText ?? '') === normalizedText && meal.items.length > 0);
    if (!matchedMeal) {
      return null;
    }

    const items: ParsedFoodItem[] = matchedMeal.items.map((item) => ({
      food_name: item.foodName,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
      notes: item.notes
        ? `${item.notes} Using your last saved values for this meal.`
        : 'Using your last saved values for this meal.',
      is_trusted: item.nutritionSourceType ? item.nutritionSourceType !== 'AI_ESTIMATE' : false,
      source_type: item.nutritionSourceType,
      source_name: item.nutritionSourceName,
      confidence_label: item.nutritionSourceType && item.nutritionSourceType !== 'AI_ESTIMATE' ? 'Verified' : 'Estimated',
      matched_query: text,
      original_user_text: text,
      provider_used: item.nutritionSourceType && item.nutritionSourceType !== 'AI_ESTIMATE' ? 'saved-correction' : 'ai-estimate-fallback',
      used_ai_fallback: item.nutritionSourceType === 'AI_ESTIMATE',
      catalog_food_id: item.catalogFoodId,
    }));

    return buildMealResponse(mealType, items, Math.max(matchedMeal.confidenceScore ?? 0.82, 0.9));
  } catch {
    return null;
  }
}

type OpenFoodFactsProductResponse = {
  status?: number;
  product?: {
    product_name?: string;
    nutriments?: {
      'energy-kcal_serving'?: number;
      'energy-kcal_100g'?: number;
      proteins_serving?: number;
      proteins_100g?: number;
      carbohydrates_serving?: number;
      carbohydrates_100g?: number;
      fat_serving?: number;
      fat_100g?: number;
      fiber_serving?: number;
      fiber_100g?: number;
      sugars_serving?: number;
      sugars_100g?: number;
      sodium_serving?: number;
      sodium_100g?: number;
      salt_serving?: number;
      salt_100g?: number;
    };
    serving_quantity?: number;
    serving_size?: string;
  };
};

function pickServingValue(servingValue?: number, fallbackValue?: number) {
  if (typeof servingValue === 'number' && Number.isFinite(servingValue)) {
    return servingValue;
  }

  if (typeof fallbackValue === 'number' && Number.isFinite(fallbackValue)) {
    return fallbackValue;
  }

  return 0;
}

async function resolveFromOpenFoodFacts(barcode: string, mealType: MealTypeValue) {
  const payload = await fetchJson<OpenFoodFactsProductResponse>(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments,serving_quantity,serving_size`
  );

  const product = payload?.product;
  const nutriments = product?.nutriments;

  if (payload?.status !== 1 || !product || !nutriments) {
    return null;
  }

  const sodium =
    pickServingValue(nutriments.sodium_serving, nutriments.sodium_100g) ||
    pickServingValue(nutriments.salt_serving, nutriments.salt_100g) / 2.5;

  return buildMealResponse(
    mealType,
    [
      {
        food_name: product.product_name?.trim() || 'Barcode product',
        quantity: product.serving_quantity ?? 1,
        unit: product.serving_size?.trim() || 'serving',
        calories: pickServingValue(nutriments['energy-kcal_serving'], nutriments['energy-kcal_100g']),
        protein: pickServingValue(nutriments.proteins_serving, nutriments.proteins_100g),
        carbs: pickServingValue(nutriments.carbohydrates_serving, nutriments.carbohydrates_100g),
        fat: pickServingValue(nutriments.fat_serving, nutriments.fat_100g),
        fiber: pickServingValue(nutriments.fiber_serving, nutriments.fiber_100g),
        sugar: pickServingValue(nutriments.sugars_serving, nutriments.sugars_100g),
        sodium,
        notes: `Barcode match for ${product.product_name?.trim() || 'this product'}. Adjust if your serving differs.`,
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'Open Food Facts barcode match',
        confidence_label: 'Verified',
        matched_query: barcode,
        original_user_text: barcode,
        provider_used: 'open-food-facts',
        used_ai_fallback: false,
        catalog_food_id: null,
      },
    ],
    0.92,
  );
}

export async function resolveNutritionEstimate({ text, mealType, nutritionLabel = null, barcode = null }: NutritionResolverInput) {
  if (nutritionLabel) {
    return lookupNutrition({ text, mealType, nutritionLabel, barcode });
  }

  const detectedBarcode = barcode || extractBarcode(text);
  if (detectedBarcode) {
    const barcodeResult = await resolveFromOpenFoodFacts(detectedBarcode, mealType);
    if (barcodeResult) {
      return barcodeResult;
    }
  }

  const savedCorrection = await resolveFromSavedCorrection(text, mealType);
  if (savedCorrection) {
    return savedCorrection;
  }

  return lookupNutrition({ text, mealType, nutritionLabel, barcode });
}

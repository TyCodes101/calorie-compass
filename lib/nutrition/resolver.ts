import type { ParsedFoodItem } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import { getCurrentUserId, hasDatabaseConnectionString } from '@/lib/current-user';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import type { NutritionLabelInput } from '@/lib/nutrition/types';
import type { FoodPipelineTrace } from '@/lib/ai/foodPipelineTrace';
import { prisma } from '@/lib/prisma';
import { resolveBarcodeNutrition } from '@/lib/nutrition/barcodeResolver';

export type { NutritionLabelInput } from '@/lib/nutrition/types';

export type NutritionResolverInput = {
  text: string;
  mealType: MealTypeValue;
  nutritionLabel?: NutritionLabelInput | null;
  barcode?: string | null;
  trace?: FoodPipelineTrace;
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

export async function resolveNutritionEstimate({ text, mealType, nutritionLabel = null, barcode = null, trace }: NutritionResolverInput) {
  // If the user includes add-ons/modifiers ("with butter", "with ranch", etc.), avoid returning a
  // single-item deterministic estimate that can silently drop the modifier. Let the LLM parse
  // the components and then hydrate each one.
  const normalizedText = normalizeLookupText(text);
  if (/\bwith\b/.test(normalizedText) && /\b(butter|oil|cream|ranch|jelly|peanut butter|dressing|sauce|salsa|mayo)\b/.test(normalizedText)) {
    return null;
  }

  if (nutritionLabel) {
    return trace
      ? lookupNutrition({ text, mealType, nutritionLabel, barcode }, { trace })
      : lookupNutrition({ text, mealType, nutritionLabel, barcode });
  }

  const detectedBarcode = barcode || extractBarcode(text);
  if (detectedBarcode) {
    const providerResult = await resolveBarcodeNutrition(detectedBarcode, mealType);
    if (providerResult.found && providerResult.result) {
      return buildMealResponse(
        mealType,
        providerResult.result.items,
        providerResult.result.confidenceScore,
      );
    }

  }

  const savedCorrection = await resolveFromSavedCorrection(text, mealType);
  if (savedCorrection) {
    return savedCorrection;
  }

  return trace
    ? lookupNutrition({ text, mealType, nutritionLabel, barcode }, { trace })
    : lookupNutrition({ text, mealType, nutritionLabel, barcode });
}

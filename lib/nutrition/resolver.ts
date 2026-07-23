import type { ParsedFoodItem } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import {
  resolveFoodIntelligenceItem,
  type FoodIntelligenceDependencies,
  type FoodIntelligenceUserData,
} from '@/lib/food-intelligence/engine';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import type { NutritionLabelInput } from '@/lib/nutrition/types';
import type { FoodPipelineTrace } from '@/lib/ai/foodPipelineTrace';
import { resolveBarcodeNutrition } from '@/lib/nutrition/barcodeResolver';

export type { NutritionLabelInput } from '@/lib/nutrition/types';

export type NutritionResolverInput = {
  text: string;
  mealType: MealTypeValue;
  nutritionLabel?: NutritionLabelInput | null;
  barcode?: string | null;
  trace?: FoodPipelineTrace;
  foodIntelligenceUserData?: FoodIntelligenceUserData;
  foodIntelligenceDependencies?: FoodIntelligenceDependencies;
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

export async function resolveNutritionEstimate({
  text,
  mealType,
  nutritionLabel = null,
  barcode = null,
  trace,
  foodIntelligenceUserData,
  foodIntelligenceDependencies,
}: NutritionResolverInput) {
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

  return resolveFoodIntelligenceItem({
    query: text,
    mealType,
    origin: 'chat',
    ...foodIntelligenceUserData,
  }, {
    ...foodIntelligenceDependencies,
    search: {
      ...foodIntelligenceDependencies?.search,
      trace,
    },
  });
}

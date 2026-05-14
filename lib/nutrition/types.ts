import type { ParsedMealResponse } from '@/lib/ai/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';

export type NutritionLabelInput = {
  name?: string | null;
  servingQuantity?: number | null;
  servingUnit?: string | null;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
};

export type NutritionConfidenceLabel = 'Verified' | 'High confidence' | 'Estimated';

export type NormalizedFoodQuery = {
  rawText: string;
  normalizedText: string;
  searchText: string;
  matchedQuery: string;
  quantity: number;
  unitHint: string | null;
  brandHint: string | null;
};

export type NutritionLookupInput = {
  text: string;
  mealType: MealTypeValue;
  nutritionLabel?: NutritionLabelInput | null;
  barcode?: string | null;
};

export type NutritionLookupContext = {
  text: string;
  mealType: MealTypeValue;
  normalizedQuery: NormalizedFoodQuery;
};

export type NutritionLookupProvider = {
  id: string;
  lookup: (context: NutritionLookupContext) => Promise<ParsedMealResponse | null> | ParsedMealResponse | null;
};

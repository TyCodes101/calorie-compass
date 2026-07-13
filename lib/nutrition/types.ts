import type { ParsedMealResponse } from '@/lib/ai/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import type { FoodPipelineTrace } from '@/lib/ai/foodPipelineTrace';

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

export type NutritionConfidenceLabel = 'Verified' | 'Matched' | 'Estimated' | 'Needs Review';
export type NutritionMatchType = 'exact_branded' | 'exact_restaurant' | 'fuzzy_branded' | 'fuzzy_restaurant' | 'verified_database' | 'generic_estimate' | 'ai_estimate' | 'unknown';

export type NormalizedFoodQuery = {
  rawText: string;
  normalizedText: string;
  searchText: string;
  matchedQuery: string;
  quantity: number;
  quantityUnit: string | null;
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
  trace?: FoodPipelineTrace;
};

export type NutritionBarcodeLookupContext = {
  barcode: string;
  mealType: MealTypeValue;
  trace?: FoodPipelineTrace;
};

export type NutritionDetailsLookupContext = {
  providerFoodId: string;
  mealType: MealTypeValue;
  trace?: FoodPipelineTrace;
};

export type NutritionProviderCapabilities = {
  search: boolean;
  barcode: boolean;
  details: boolean;
  suggest: boolean;
};

export type NutritionLookupProvider = {
  id: string;
  capabilities?: NutritionProviderCapabilities;
  getStatus?: () => { configured: boolean; reason?: string };
  lookup: (context: NutritionLookupContext) => Promise<ParsedMealResponse | null> | ParsedMealResponse | null;
  lookupBarcode?: (context: NutritionBarcodeLookupContext) => Promise<ParsedMealResponse | null> | ParsedMealResponse | null;
  getFoodDetails?: (context: NutritionDetailsLookupContext) => Promise<ParsedMealResponse | null> | ParsedMealResponse | null;
};

export type NutritionLookupTraceOptions = {
  trace?: FoodPipelineTrace;
};

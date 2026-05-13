import catalogData from '@/data/nutrition-catalog.json';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { MealTypeValue } from '@/lib/ai/orchestrate';

export type NutritionSourceRecord = (typeof catalogData.sources)[number];
export type CatalogFoodRecord = (typeof catalogData.foods)[number];

const unitAliases: Record<string, string> = {
  cups: 'cup',
  ounces: 'oz',
  ounce: 'oz',
  slices: 'slice',
  eggs: 'egg',
  servings: 'serving',
};

function normalizeUnit(unit: string) {
  return unitAliases[unit.toLowerCase()] ?? unit.toLowerCase();
}

export function getNutritionSourceById(id: string) {
  return catalogData.sources.find((source) => source.id === id) ?? null;
}

export function getCatalogFoods() {
  return catalogData.foods.filter((food) => food.active);
}

export function findCatalogFoodById(id: string) {
  return getCatalogFoods().find((food) => food.id === id) ?? null;
}

export function findCatalogFoodByAlias(alias: string, brand?: string | null) {
  const normalized = alias.trim().toLowerCase();
  return (
    getCatalogFoods().find(
      (food) =>
        (!brand || (food.brand ?? '').toLowerCase() === brand.toLowerCase()) &&
        food.aliases.some((candidate) => candidate.toLowerCase() === normalized)
    ) ?? null
  );
}

function formatSourceNote(food: CatalogFoodRecord) {
  const source = getNutritionSourceById(food.sourceId);
  if (!source) return 'Matched to trusted catalog entry';
  return `Matched to trusted catalog entry from ${source.name}`;
}

export function scaleCatalogFood(food: CatalogFoodRecord, quantity: number, unit?: string): ParsedFoodItem {
  const source = getNutritionSourceById(food.sourceId);
  const normalizedUnit = normalizeUnit(unit ?? food.servingUnit);
  const normalizedServingUnit = normalizeUnit(food.servingUnit);
  const factor = normalizedUnit === normalizedServingUnit ? quantity / food.servingQuantity : quantity;

  return {
    food_name: food.canonicalName,
    quantity,
    unit: unit ?? food.servingUnit,
    calories: Math.round(food.calories * factor * 100) / 100,
    protein: Math.round(food.protein * factor * 100) / 100,
    carbs: Math.round(food.carbs * factor * 100) / 100,
    fat: Math.round(food.fat * factor * 100) / 100,
    fiber: Math.round(food.fiber * factor * 100) / 100,
    sugar: Math.round(food.sugar * factor * 100) / 100,
    sodium: Math.round(food.sodium * factor * 100) / 100,
    notes: formatSourceNote(food),
    is_trusted: true,
    source_type: (source?.sourceType as ParsedFoodItem['source_type']) ?? null,
    source_name: source?.name ?? null,
    catalog_food_id: food.id,
  };
}

export function makeCatalogMealResponse(mealType: MealTypeValue, items: ParsedFoodItem[], confidenceScore = 0.84): ParsedMealResponse {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: confidenceScore,
    items,
  });
}

export function quantityMatch(text: string, regex: RegExp, defaultValue: number) {
  const match = text.match(regex);
  return match ? Number(match[1]) : defaultValue;
}

export function makeEstimatedItem(
  foodName: string,
  quantity: number,
  unit: string,
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  },
  notes: string
): ParsedFoodItem {
  return {
    food_name: foodName,
    quantity,
    unit,
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    fiber: nutrition.fiber ?? 0,
    sugar: nutrition.sugar ?? 0,
    sodium: nutrition.sodium ?? 0,
    notes,
    is_trusted: false,
    source_type: 'AI_ESTIMATE',
    source_name: 'Fallback estimate',
    catalog_food_id: null,
  };
}

import type { ParsedFoodItem } from '@/lib/ai/types';

const unitAliases: Record<string, string> = {
  grams: 'g',
  gram: 'g',
  gms: 'g',
  ounces: 'oz',
  ounce: 'oz',
  onz: 'oz',
  '1 onz': 'oz',
  cups: 'cup',
  servings: 'serving',
  bars: 'bar',
  bottles: 'bottle',
  bowls: 'bowl',
  packs: 'pack',
  packets: 'pack',
};

function roundNutrition(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function normalizeServingUnit(unit: string | null | undefined) {
  const cleaned = String(unit ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!cleaned) return 'serving';
  if (/^\d+(?:\.\d+)?\s+1\s+onz$/.test(cleaned)) return 'oz';
  if (/^\d+(?:\.\d+)?\s+g(?:ram|rams)?$/.test(cleaned)) return 'g';
  return unitAliases[cleaned] ?? cleaned;
}

export function scaleFoodSearchItem(item: ParsedFoodItem, nextQuantity: number, unitOverride?: string | null): ParsedFoodItem {
  const boundedQuantity = Math.max(0.01, Number.isFinite(nextQuantity) ? nextQuantity : item.quantity || 1);
  const currentQuantity = Math.max(0.01, Number.isFinite(item.quantity) ? item.quantity : 1);
  const factor = boundedQuantity / currentQuantity;

  return {
    ...item,
    quantity: Math.round(boundedQuantity * 100) / 100,
    unit: normalizeServingUnit(unitOverride ?? item.unit),
    calories: roundNutrition(item.calories * factor),
    protein: roundNutrition(item.protein * factor),
    carbs: roundNutrition(item.carbs * factor),
    fat: roundNutrition(item.fat * factor),
    fiber: roundNutrition(item.fiber * factor),
    sugar: roundNutrition(item.sugar * factor),
    sodium: roundNutrition(item.sodium * factor),
  };
}

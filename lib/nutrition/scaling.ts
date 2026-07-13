import type { ParsedFoodItem } from '@/lib/ai/types';

export type ServingScaleRequest = {
  requestedQuantity: number;
  requestedUnit: string | null;
  providerServingQuantity: number;
  providerServingUnit: string | null;
};

export type ServingScaleResult = {
  scaleFactor: number;
  requestedQuantity: number;
  requestedUnit: string | null;
  providerServingQuantity: number;
  providerServingUnit: string | null;
};

const unitAliases: Record<string, string> = {
  grams: 'g',
  gram: 'g',
  ounces: 'oz',
  ounce: 'oz',
  bars: 'bar',
  bottles: 'bottle',
  cans: 'can',
  servings: 'serving',
  sandwiches: 'sandwich',
  burgers: 'burger',
  bowls: 'bowl',
  slices: 'slice',
  pieces: 'piece',
  cups: 'cup',
  scoops: 'scoop',
};

export function normalizeServingUnit(unit: string | null | undefined) {
  const normalized = unit?.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return unitAliases[normalized] ?? normalized;
}

const countableUnits = new Set([
  'bar',
  'bottle',
  'can',
  'serving',
  'sandwich',
  'burger',
  'bowl',
  'slice',
  'piece',
  'cup',
  'scoop',
  'egg',
  'taco',
  'burrito',
  'footlong',
]);

export function isCountableServingUnit(unit: string | null | undefined) {
  return countableUnits.has(normalizeServingUnit(unit) ?? '');
}

export function computeServingScaleFactor(request: ServingScaleRequest): ServingScaleResult | null {
  const requestedQuantity = Number(request.requestedQuantity);
  const providerServingQuantity = Number(request.providerServingQuantity);
  const requestedUnit = normalizeServingUnit(request.requestedUnit);
  const providerServingUnit = normalizeServingUnit(request.providerServingUnit);

  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) return null;
  if (!Number.isFinite(providerServingQuantity) || providerServingQuantity <= 0) return null;

  // Without an explicit user unit, quantity means provider-native servings.
  // A provider's serving quantity (for example 100 g) is metadata, not 100
  // user servings. This is the guard against multiplying a single item by
  // its gram weight.
  if (!requestedUnit) {
    return {
      scaleFactor: requestedQuantity,
      requestedQuantity,
      requestedUnit: null,
      providerServingQuantity,
      providerServingUnit,
    };
  }

  if (requestedUnit && providerServingUnit && requestedUnit !== providerServingUnit) {
    const weightConversion = requestedUnit === 'oz' && providerServingUnit === 'g'
      ? (requestedQuantity * 28.3495) / providerServingQuantity
      : requestedUnit === 'g' && providerServingUnit === 'oz'
        ? requestedQuantity / (providerServingQuantity * 28.3495)
        : null;

    if (weightConversion === null) return null;
    return {
      scaleFactor: weightConversion,
      requestedQuantity,
      requestedUnit,
      providerServingQuantity,
      providerServingUnit,
    };
  }

  const scaleFactor = requestedQuantity / providerServingQuantity;
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return null;

  return {
    scaleFactor,
    requestedQuantity,
    requestedUnit,
    providerServingQuantity,
    providerServingUnit,
  };
}

export function scaleNutritionItemOnce(item: ParsedFoodItem, request: ServingScaleRequest) {
  const result = computeServingScaleFactor(request);
  if (!result) return null;

  const factor = result.scaleFactor;
  return {
    ...item,
    quantity: result.requestedQuantity,
    unit: result.requestedUnit ?? item.unit,
    calories: Math.round(item.calories * factor * 100) / 100,
    protein: Math.round(item.protein * factor * 100) / 100,
    carbs: Math.round(item.carbs * factor * 100) / 100,
    fat: Math.round(item.fat * factor * 100) / 100,
    fiber: Math.round(item.fiber * factor * 100) / 100,
    sugar: Math.round(item.sugar * factor * 100) / 100,
    sodium: Math.round(item.sodium * factor * 100) / 100,
    userQuantity: result.requestedQuantity,
    userUnit: result.requestedUnit ?? item.unit,
  } satisfies ParsedFoodItem;
}

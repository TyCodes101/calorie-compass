import catalogData from '@/data/nutrition-catalog.json';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { MealTypeValue } from '@/lib/ai/orchestrate';

export type NutritionSourceRecord = (typeof catalogData.sources)[number];
export type CatalogFoodRecord = (typeof catalogData.foods)[number];
export type CatalogFoodMatch = {
  food: CatalogFoodRecord;
  score: number;
  exactAlias: boolean;
  exactProduct: boolean;
  proteinSignal: number | null;
};

const unitAliases: Record<string, string> = {
  bottles: 'bottle',
  bowls: 'bowl',
  cans: 'can',
  cups: 'cup',
  eggs: 'egg',
  handfuls: 'handful',
  ounces: 'oz',
  ounce: 'oz',
  pieces: 'piece',
  scoops: 'scoop',
  servings: 'serving',
  slices: 'slice',
};

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnit(unit: string) {
  return unitAliases[unit.toLowerCase()] ?? unit.toLowerCase();
}

function tokenize(text: string) {
  return normalizeSearchText(text)
    .split(' ')
    .filter(Boolean);
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);
}

function extractProteinSignal(text: string) {
  const match = normalizeSearchText(text).match(/\b(\d{2})\s*(?:g|gram|grams)\b/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return value >= 20 && value <= 50 ? value : null;
}

function scoreCatalogFoodMatch(food: CatalogFoodRecord, text: string, brand?: string | null): CatalogFoodMatch | null {
  const normalized = normalizeSearchText(text);
  const aliasScores = food.aliases.map((alias) => {
    const normalizedAlias = normalizeSearchText(alias);
    const exactAlias = normalizedAlias === normalized;
    const includes = normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    const aliasTokens = tokenize(alias);
    const normalizedTokens = tokenize(normalized);
    const overlap = countOverlap(normalizedTokens, aliasTokens);

    let score = 0;
    if (exactAlias) score += 130;
    else if (includes) score += 82;
    else if (overlap) score += overlap * 9;

    if (brand && normalizeSearchText(food.brand ?? '') === normalizeSearchText(brand)) {
      score += 18;
    }

    const canonicalTokens = tokenize(food.canonicalName);
    score += countOverlap(normalizedTokens, canonicalTokens) * 6;

    const proteinSignal = extractProteinSignal(normalized);
    if (proteinSignal !== null) {
      const proteinGap = Math.abs(proteinSignal - food.protein);
      if (proteinGap <= 1.5) score += 74;
      else if (proteinGap <= 4) score += 36;
      else if (proteinGap >= 8) score -= 26;
    }

    if (normalized.includes('elite')) {
      score += normalizeSearchText(food.canonicalName).includes('elite') ? 40 : -18;
    }

    if (normalized.includes('nutrition plan')) {
      score += normalizeSearchText(food.canonicalName).includes('nutrition plan') ? 34 : -16;
    }

    if (normalized.includes('core power')) {
      score += normalizeSearchText(food.canonicalName).includes('core power') ? 28 : -12;
    }

    if (/(?:shake|protein|bottle|drink)/.test(normalized)) {
      score += 6;
    }

    return {
      food,
      score,
      exactAlias,
      exactProduct: exactAlias || (proteinSignal !== null && Math.abs(proteinSignal - food.protein) <= 1.5),
      proteinSignal,
    };
  });

  return aliasScores
    .filter((candidate) => candidate.score >= 24)
    .sort((left, right) => right.score - left.score || Number(right.exactAlias) - Number(left.exactAlias))[0] ?? null;
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
  const normalized = normalizeSearchText(alias);
  return (
    getCatalogFoods().find(
      (food) =>
        (!brand || normalizeSearchText(food.brand ?? '') === normalizeSearchText(brand)) &&
        food.aliases.some((candidate) => normalizeSearchText(candidate) === normalized)
    ) ?? null
  );
}

export function findCatalogFoodMatch(text: string, brand?: string | null) {
  const normalized = normalizeSearchText(text);
  if (!normalized) {
    return null;
  }

  return (
    getCatalogFoods()
      .filter((food) => !brand || normalizeSearchText(food.brand ?? '') === normalizeSearchText(brand))
      .map((food) => scoreCatalogFoodMatch(food, normalized, brand))
      .filter((candidate): candidate is CatalogFoodMatch => Boolean(candidate))
      .sort((left, right) => right.score - left.score || Number(right.exactAlias) - Number(left.exactAlias))[0] ?? null
  );
}

export function findCatalogFoodByBestMatch(text: string, brand?: string | null) {
  return findCatalogFoodMatch(text, brand)?.food ?? null;
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

export function scaleParsedFoodItem(item: ParsedFoodItem, factor: number, unitOverride?: string): ParsedFoodItem {
  return {
    ...item,
    quantity: Math.round(item.quantity * factor * 100) / 100,
    unit: unitOverride ?? item.unit,
    calories: Math.round(item.calories * factor * 100) / 100,
    protein: Math.round(item.protein * factor * 100) / 100,
    carbs: Math.round(item.carbs * factor * 100) / 100,
    fat: Math.round(item.fat * factor * 100) / 100,
    fiber: Math.round(item.fiber * factor * 100) / 100,
    sugar: Math.round(item.sugar * factor * 100) / 100,
    sodium: Math.round(item.sodium * factor * 100) / 100,
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

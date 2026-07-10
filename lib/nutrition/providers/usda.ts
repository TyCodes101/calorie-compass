import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { scaleParsedFoodItem } from '@/lib/nutrition/catalog';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

type UsdaFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  dataType?: string;
  foodNutrients?: Array<{ nutrientName?: string; nutrientNumber?: string; unitName?: string; value?: number }>;
};

type UsdaSearchResponse = {
  foods?: UsdaFood[];
};

const genericUsdaDataTypes = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'];
const allUsdaDataTypes = [...genericUsdaDataTypes, 'Branded'];

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string) {
  return normalizeText(text).split(' ').filter(Boolean);
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);
}

function normalizeUnit(unit: string | null | undefined) {
  const normalized = normalizeText(unit ?? '');
  if (!normalized) return null;
  if (/^(?:\d+(?:\.\d+)?\s+)?(?:g|gram|grams)$/.test(normalized)) return 'g';
  if (/^(?:\d+(?:\.\d+)?\s+)?(?:oz|ounce|ounces|onz|onzs)$/.test(normalized)) return 'oz';
  if (['g', 'gram', 'grams'].includes(normalized)) return 'g';
  if (['oz', 'ounce', 'ounces'].includes(normalized)) return 'oz';
  if (['slice', 'slices'].includes(normalized)) return 'slice';
  if (['piece', 'pieces'].includes(normalized)) return 'piece';
  if (['cake', 'cakes'].includes(normalized)) return 'cake';
  if (['bar', 'bars'].includes(normalized)) return 'bar';
  if (['bottle', 'bottles'].includes(normalized)) return 'bottle';
  if (['egg', 'eggs'].includes(normalized)) return 'egg';
  if (['sandwich', 'sandwiches'].includes(normalized)) return 'sandwich';
  if (['order', 'orders'].includes(normalized)) return 'order';
  if (['pizza', 'pizzas'].includes(normalized)) return 'pizza';
  if (['cup', 'cups'].includes(normalized)) return 'cup';
  if (['tbsp', 'tablespoon', 'tablespoons'].includes(normalized)) return 'tbsp';
  if (['tsp', 'teaspoon', 'teaspoons'].includes(normalized)) return 'tsp';
  return normalized;
}

function findUsdaNutrient(food: UsdaFood, names: string[], nutrientNumbers: string[] = []) {
  const nutrient = food.foodNutrients?.find((entry) => {
    const nameMatches = names.includes(entry.nutrientName ?? '');
    const numberMatches = nutrientNumbers.length > 0 && nutrientNumbers.includes(entry.nutrientNumber ?? '');
    const isKcalEnergy = entry.nutrientName === 'Energy'
      ? !entry.unitName || normalizeText(entry.unitName) === 'kcal' || entry.nutrientNumber === '1008'
      : true;
    return (nameMatches || numberMatches) && isKcalEnergy;
  });
  return nutrient?.value ?? 0;
}

function pickServingText(food: UsdaFood) {
  if (!food.servingSize && !food.servingSizeUnit && /foundation|survey|sr legacy/i.test(food.dataType ?? '')) {
    return 'g';
  }

  const servingSizeUnit = normalizeUnit(food.servingSizeUnit);
  if (servingSizeUnit === 'g' || servingSizeUnit === 'oz') {
    return servingSizeUnit;
  }

  const householdServingUnit = normalizeUnit(food.householdServingFullText);
  if (householdServingUnit === 'g' || householdServingUnit === 'oz') {
    return householdServingUnit;
  }

  return food.householdServingFullText?.trim() || food.servingSizeUnit?.trim() || 'serving';
}

function pickServingQuantity(food: UsdaFood) {
  if (!food.servingSize && !food.servingSizeUnit && /foundation|survey|sr legacy/i.test(food.dataType ?? '')) {
    return 100;
  }

  return food.servingSize && Number.isFinite(food.servingSize) ? food.servingSize : 1;
}

function getScaleFactor(food: UsdaFood, quantity: number, quantityUnit: string | null) {
  if (quantity <= 1 && !quantityUnit) {
    return 1;
  }

  const requestedUnit = normalizeUnit(quantityUnit);
  const servingUnit =
    normalizeUnit(food.servingSizeUnit) ??
    normalizeUnit(food.householdServingFullText) ??
    (!food.servingSize && !food.servingSizeUnit && /foundation|survey|sr legacy/i.test(food.dataType ?? '') ? 'g' : null);
  const servingQuantity = pickServingQuantity(food);

  if (requestedUnit && servingUnit && requestedUnit === servingUnit && servingQuantity > 0) {
    return quantity / servingQuantity;
  }

  if (requestedUnit === 'oz' && servingUnit === 'g' && servingQuantity > 0) {
    return (quantity * 28.3495) / servingQuantity;
  }

  if (requestedUnit === 'g' && servingUnit === 'oz' && servingQuantity > 0) {
    return quantity / (servingQuantity * 28.3495);
  }

  if (requestedUnit && requestedUnit !== servingUnit) {
    return null;
  }

  return quantity > 1 ? quantity : 1;
}

function getQuantityUnitOverride(food: UsdaFood, quantityUnit: string | null) {
  const requestedUnit = normalizeUnit(quantityUnit);
  if (requestedUnit) {
    return requestedUnit;
  }

  return pickServingText(food);
}

function scoreUsdaFood(food: UsdaFood, searchText: string, brandHint: string | null, unitHint: string | null) {
  const normalizedQuery = normalizeText(searchText);
  const normalizedDescription = normalizeText(food.description ?? '');
  const normalizedBrand = normalizeText(food.brandOwner ?? '');
  const queryTokens = tokenize(normalizedQuery);
  const descriptionTokens = tokenize(normalizedDescription);
  const servingText = normalizeText(`${food.servingSizeUnit ?? ''} ${food.householdServingFullText ?? ''}`);
  const isBranded = Boolean(food.brandOwner) || /branded/i.test(food.dataType ?? '');
  const calories = findUsdaNutrient(food, ['Energy']);

  let score = 0;

  if (normalizedDescription === normalizedQuery) score += 140;
  else if (normalizedDescription.includes(normalizedQuery) || normalizedQuery.includes(normalizedDescription)) score += 92;
  score += countOverlap(queryTokens, descriptionTokens) * 10;

  if (brandHint) {
    const normalizedHint = normalizeText(brandHint);
    if (normalizedBrand.includes(normalizedHint) || normalizedDescription.includes(normalizedHint)) score += 40;
    else if (normalizedBrand) score -= 10;
  } else {
    score += isBranded ? -36 : 14;
  }

  if (unitHint && servingText.includes(normalizeText(unitHint))) {
    score += 16;
  }

  if (/\b(?:fruit|vegetables?|veggies)\b/.test(normalizedDescription) && !/\b(?:fruit|vegetables?|veggies)\b/.test(normalizedQuery)) {
    score -= 32;
  }

  if (/\bnfs\b/.test(normalizedDescription)) {
    score += 12;
  }

  if (calories > 0 && calories <= 1200) score += 10;
  else score -= 18;

  if (/foundation|survey|sr legacy/i.test(food.dataType ?? '')) {
    score += 6;
  }

  return score;
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

export const usdaProvider: NutritionLookupProvider = {
  id: 'usda-fdc',
  getStatus() {
    const configured = Boolean(process.env.USDA_FDC_API_KEY?.trim() || process.env.FDC_API_KEY?.trim());
    return { configured, reason: configured ? undefined : 'usda_not_configured' };
  },
  async lookup({ mealType, normalizedQuery }) {
    const apiKey = process.env.USDA_FDC_API_KEY?.trim() || process.env.FDC_API_KEY?.trim() || null;
    if (!apiKey) {
      return null;
    }

    const fetchSearch = (dataType: string[]) => fetchJson<UsdaSearchResponse>(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: normalizedQuery.searchText,
        pageSize: 12,
        dataType,
      }),
    });

    const chooseBestMatch = (foods: UsdaFood[] = []) => foods
      .map((food) => ({
        food,
        score: scoreUsdaFood(food, normalizedQuery.searchText, normalizedQuery.brandHint, normalizedQuery.unitHint),
      }))
      .filter((candidate) => candidate.score >= 44)
      .sort((left, right) => right.score - left.score)[0]?.food;

    const primaryDataTypes = normalizedQuery.brandHint ? allUsdaDataTypes : genericUsdaDataTypes;
    const primaryPayload = await fetchSearch(primaryDataTypes);
    const primaryMatch = chooseBestMatch(primaryPayload?.foods ?? []);
    const fallbackPayload = !primaryMatch && !normalizedQuery.brandHint ? await fetchSearch(allUsdaDataTypes) : null;
    const bestMatch = primaryMatch ?? chooseBestMatch(fallbackPayload?.foods ?? []);

    if (!bestMatch) {
      return null;
    }

    const baseItem = {
      food_name: bestMatch.brandOwner
        ? `${bestMatch.brandOwner} ${bestMatch.description ?? ''}`.trim()
        : bestMatch.description?.trim() || normalizedQuery.matchedQuery,
      quantity: pickServingQuantity(bestMatch),
      unit: pickServingText(bestMatch),
      calories: findUsdaNutrient(bestMatch, ['Energy'], ['1008']),
      protein: findUsdaNutrient(bestMatch, ['Protein'], ['1003']),
      carbs: findUsdaNutrient(bestMatch, ['Carbohydrate, by difference'], ['1005']),
      fat: findUsdaNutrient(bestMatch, ['Total lipid (fat)'], ['1004']),
      fiber: findUsdaNutrient(bestMatch, ['Fiber, total dietary'], ['1079']),
      sugar: findUsdaNutrient(bestMatch, ['Sugars, total including NLEA', 'Sugars, total'], ['2000', '1063']),
      sodium: findUsdaNutrient(bestMatch, ['Sodium, Na'], ['1093']),
      notes: `Matched using USDA FoodData Central${bestMatch.fdcId ? ` FDC ${bestMatch.fdcId}` : ''}. Query: ${normalizedQuery.matchedQuery}.`,
      is_trusted: true,
      source_type: 'GENERIC_REFERENCE' as const,
      source_name: 'USDA FoodData Central',
      confidence_label: 'Matched' as const,
      matched_query: normalizedQuery.matchedQuery,
      original_user_text: normalizedQuery.rawText,
      provider_used: 'usda-fdc',
      used_ai_fallback: false,
      catalog_food_id: null,
    };

    const scaleFactor = getScaleFactor(bestMatch, normalizedQuery.quantity, normalizedQuery.quantityUnit);
    if (scaleFactor === null) {
      return null;
    }

    const item = scaleFactor !== 1
      ? scaleParsedFoodItem(baseItem, scaleFactor, getQuantityUnitOverride(bestMatch, normalizedQuery.quantityUnit))
      : {
          ...baseItem,
          quantity: normalizedQuery.quantityUnit ? normalizedQuery.quantity : baseItem.quantity,
          unit: getQuantityUnitOverride(bestMatch, normalizedQuery.quantityUnit),
        };

    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: mealType,
      confidence_score: 0.84,
      items: [item],
    });
  },
};

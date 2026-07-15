import type { CustomFoodSummary } from '@/lib/custom-foods';
import { customFoodToSearchResult, catalogFoodToSearchResult, type FoodSearchResult } from '@/lib/food-search';
import type { CatalogFoodRecord } from '@/lib/nutrition/catalog';
import type { ParsedMealResponse } from '@/lib/ai/types';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import { normalizeBarcode } from '@/lib/nutrition/barcode';

export { normalizeBarcode } from '@/lib/nutrition/barcode';

type BarcodeCatalogFood = CatalogFoodRecord & {
  barcode?: string | null;
  barcodes?: string[];
};

function catalogBarcode(food: BarcodeCatalogFood) {
  return normalizeBarcode(food.barcode ?? food.barcodes?.[0] ?? null);
}

export function markSearchResultAsBarcodeMatch(result: FoodSearchResult, barcode: string): FoodSearchResult {
  return {
    ...result,
    barcode,
    reason: 'Matched by barcode.',
    items: result.items.map((item) => ({
      ...item,
      match_type: 'exact_barcode',
      matched_query: barcode,
    })),
  };
}

export function buildBarcodeLookupResult({
  barcode,
  customFoods,
  catalogFoods,
}: {
  barcode: string;
  customFoods: CustomFoodSummary[];
  catalogFoods: BarcodeCatalogFood[];
}): { found: boolean; result: FoodSearchResult | null } {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return { found: false, result: null };

  const catalogMatch = catalogFoods.find((food) => food.active !== false && catalogBarcode(food) === normalized);
  if (catalogMatch) {
    return { found: true, result: markSearchResultAsBarcodeMatch(catalogFoodToSearchResult(catalogMatch), normalized) };
  }

  const customMatch = customFoods.find((food) => normalizeBarcode(food.barcode) === normalized);
  if (customMatch) {
    return { found: true, result: markSearchResultAsBarcodeMatch(customFoodToSearchResult(customMatch), normalized) };
  }

  return { found: false, result: null };
}

function roundedTotal(response: ParsedMealResponse, key: 'calories' | 'protein' | 'carbs' | 'fat') {
  return Math.round(response.items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0));
}

export function providerBarcodeResultToSearchResult(response: ParsedMealResponse, barcode: string): FoodSearchResult | null {
  const first = response.items[0];
  if (response.needs_clarification || !first) return null;
  const estimated = response.items.some((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback || item.is_trusted === false);
  const needsReview = estimated
    || response.confidence_score < 0.72
    || response.items.some((item) => item.confidence_label === 'Needs Review');

  return markSearchResultAsBarcodeMatch({
    id: `barcode:${first.provider_used ?? 'database'}:${barcode}`,
    name: first.food_name,
    brand: null,
    restaurant: null,
    sourceLabel: estimated ? 'Estimated' : 'Database match',
    sourceType: first.source_type ?? null,
    sourceName: first.source_name ?? null,
    providerId: first.provider_used ?? null,
    servingQuantity: first.quantity,
    servingUnit: first.unit,
    calories: roundedTotal(response, 'calories'),
    protein: roundedTotal(response, 'protein'),
    carbs: roundedTotal(response, 'carbs'),
    fat: roundedTotal(response, 'fat'),
    barcode,
    mealType: response.meal_type,
    confidenceScore: response.confidence_score,
    estimated,
    needsReview,
    reason: null,
    sourceReusableMealId: null,
    items: response.items,
  }, barcode);
}

export type BarcodeProviderLookupResult = {
  found: boolean;
  result: FoodSearchResult | null;
};

export async function lookupBarcodeWithProviders(
  barcode: string,
  providers: NutritionLookupProvider[],
  mealType: MealTypeValue = 'snack',
): Promise<BarcodeProviderLookupResult> {
  for (const provider of providers) {
    if (!provider.lookupBarcode || provider.capabilities?.barcode === false) continue;
    const status = provider.getStatus?.() ?? { configured: true };
    if (!status.configured) continue;

    try {
      const response = await provider.lookupBarcode({ barcode, mealType });
      const result = response ? providerBarcodeResultToSearchResult(response, barcode) : null;
      if (result) return { found: true, result };
    } catch {
      // Barcode lookup is fail-soft so the next provider can still resolve it.
    }
  }

  return { found: false, result: null };
}

import type { CustomFoodSummary } from '@/lib/custom-foods';
import { customFoodToSearchResult, catalogFoodToSearchResult, type FoodSearchResult } from '@/lib/food-search';
import type { CatalogFoodRecord } from '@/lib/nutrition/catalog';

type BarcodeCatalogFood = CatalogFoodRecord & {
  barcode?: string | null;
  barcodes?: string[];
};

export function normalizeBarcode(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function catalogBarcode(food: BarcodeCatalogFood) {
  return normalizeBarcode(food.barcode ?? food.barcodes?.[0] ?? null);
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
    return { found: true, result: { ...catalogFoodToSearchResult(catalogMatch), barcode: normalized } };
  }

  const customMatch = customFoods.find((food) => normalizeBarcode(food.barcode) === normalized);
  if (customMatch) {
    return { found: true, result: customFoodToSearchResult(customMatch) };
  }

  return { found: false, result: null };
}

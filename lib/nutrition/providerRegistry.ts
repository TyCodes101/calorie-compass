import { calorieApiProvider } from '@/lib/nutrition/providers/calorieApi';
import { commercialDatabaseProvider } from '@/lib/nutrition/providers/commercialDatabase';
import { fatSecretProvider } from '@/lib/nutrition/providers/fatsecret';
import { localVerifiedCatalogProvider } from '@/lib/nutrition/providers/localVerifiedCatalog';
import { openFoodFactsProvider } from '@/lib/nutrition/providers/openFoodFacts';
import { usdaProvider } from '@/lib/nutrition/providers/usda';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

// Provider order is intentional. Curated local identity stays authoritative;
// broad external databases are supporting candidates and must pass resolver
// identity and nutrition plausibility checks before selection.
export const defaultNutritionProviders: NutritionLookupProvider[] = [
  localVerifiedCatalogProvider,
  usdaProvider,
  openFoodFactsProvider,
  fatSecretProvider,
  calorieApiProvider,
  commercialDatabaseProvider,
];

export const defaultBarcodeProviders: NutritionLookupProvider[] = [
  openFoodFactsProvider,
  usdaProvider,
  fatSecretProvider,
  calorieApiProvider,
];

import type { ParsedMealResponse } from '@/lib/ai/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import {
  lookupBarcodeWithProviders,
  providerBarcodeResultToSearchResult,
  type BarcodeProviderLookupResult,
} from '@/lib/barcode-lookup';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import { defaultBarcodeProviders, defaultNutritionProviders } from '@/lib/nutrition/providerRegistry';
import { lookupUpcDatabaseMetadata, type UpcProductMetadata } from '@/lib/nutrition/providers/upcDatabase';

function normalizeIdentityText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function identityTokens(value: string | null | undefined) {
  return normalizeIdentityText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !['the', 'and', 'with', 'food', 'product', 'pack'].includes(token));
}

function metadataLooksLikeFood(metadata: UpcProductMetadata) {
  const category = normalizeIdentityText(metadata.category);
  if (!category) return true;
  return !/\b(?:plumbing|electronics?|hardware|clothing|apparel|books?|automotive|cosmetics?|beauty|toys?|office)\b/.test(category);
}

export function responseMatchesUpcMetadata(response: ParsedMealResponse, metadata: UpcProductMetadata) {
  if (response.needs_clarification || response.items.length !== 1 || !metadataLooksLikeFood(metadata)) return false;
  const item = response.items[0];
  if (!item || item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback || item.is_trusted === false) return false;
  const haystack = normalizeIdentityText(`${item.food_name} ${item.source_name ?? ''} ${item.notes ?? ''}`);
  const brandTokens = identityTokens(metadata.brand);
  if (brandTokens.length && !brandTokens.every((token) => haystack.includes(token))) return false;

  const titleTokens = identityTokens(metadata.title);
  if (!titleTokens.length) return false;
  const matched = titleTokens.filter((token) => haystack.includes(token));
  const requiredCoverage = titleTokens.length <= 2 ? 1 : 0.67;
  return matched.length / titleTokens.length >= requiredCoverage;
}

export function buildUpcMetadataSearchText(metadata: UpcProductMetadata) {
  return [metadata.brand, metadata.title, metadata.packageDescription]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export async function resolveBarcodeNutrition(
  barcode: string,
  mealType: MealTypeValue = 'snack',
  options?: {
    directLookup?: (barcode: string, mealType: MealTypeValue) => Promise<BarcodeProviderLookupResult>;
    metadataLookup?: (barcode: string) => Promise<UpcProductMetadata | null>;
    secondaryLookup?: (text: string, mealType: MealTypeValue) => Promise<ParsedMealResponse | null>;
  },
): Promise<BarcodeProviderLookupResult> {
  const directLookup = options?.directLookup ?? (async (value: string, requestedMealType: MealTypeValue) => (
    lookupBarcodeWithProviders(value, defaultBarcodeProviders, requestedMealType)
  ));
  const direct = await directLookup(barcode, mealType);
  if (direct.found) return direct;

  const metadata = await (options?.metadataLookup ?? lookupUpcDatabaseMetadata)(barcode);
  if (!metadata || !metadataLooksLikeFood(metadata)) return { found: false, result: null };

  const searchText = buildUpcMetadataSearchText(metadata);
  if (!searchText) return { found: false, result: null };
  const secondaryLookup = options?.secondaryLookup ?? (async (text: string, requestedMealType: MealTypeValue) => (
    lookupNutrition({ text, mealType: requestedMealType }, { providers: defaultNutritionProviders })
  ));
  const response = await secondaryLookup(searchText, mealType);
  if (!response || !responseMatchesUpcMetadata(response, metadata)) return { found: false, result: null };

  const decorated: ParsedMealResponse = {
    ...response,
    items: response.items.map((item) => ({
      ...item,
      notes: [item.notes, 'Product identity was recovered from UPC Database metadata; nutrition came from the named nutrition provider.']
        .filter(Boolean)
        .join(' '),
    })),
  };
  const result = providerBarcodeResultToSearchResult(decorated, metadata.barcode);
  return result
    ? { found: true, result: { ...result, reason: 'Barcode identity recovered through one metadata-only secondary search.' } }
    : { found: false, result: null };
}

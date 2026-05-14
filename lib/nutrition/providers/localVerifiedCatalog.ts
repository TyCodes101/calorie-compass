import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import {
  findCatalogFoodMatch,
  getNutritionSourceById,
  makeCatalogMealResponse,
  scaleCatalogFood,
} from '@/lib/nutrition/catalog';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

const officialRestaurantBrands = new Set([
  'CAVA',
  'Chick-fil-A',
  'Chipotle',
  "McDonald's",
  'Panera',
  'Panda Express',
  'Starbucks',
  'Subway',
  'Taco Bell',
  "Wendy's",
]);

function getConfidenceLabel(sourceType: string | null | undefined) {
  return sourceType === 'OFFICIAL_RESTAURANT' ? 'Verified' : 'High confidence';
}

function buildLocalMatchNotes(foodName: string, sourceName: string | null, matchedQuery: string) {
  if (sourceName) {
    return `Matched to ${foodName} using ${sourceName}. Query: ${matchedQuery}.`;
  }

  return `Matched to ${foodName} from the local verified catalog. Query: ${matchedQuery}.`;
}

function looksLikeCompoundMeal(text: string) {
  const normalized = text.toLowerCase();
  return normalized.includes(' with ') || normalized.includes(' and ') || normalized.includes(',');
}

function isOfficialRestaurantBrand(brandHint: string | null) {
  return brandHint ? officialRestaurantBrands.has(brandHint) : false;
}

function decorateTrustedCatalogResponse(text: string, response: ReturnType<typeof getTrustedCatalogEstimate>) {
  if (!response) {
    return null;
  }

  const normalized = normalizeFoodQuery(text);

  return normalizeParsedMealResponse({
    ...response,
    items: response.items.map((item) => ({
      ...item,
      confidence_label: item.source_type === 'AI_ESTIMATE' ? 'Estimated' : getConfidenceLabel(item.source_type),
      matched_query: normalized.matchedQuery,
      original_user_text: text,
      provider_used: item.source_type === 'AI_ESTIMATE' ? 'ai-estimate-fallback' : 'local-verified-catalog',
      used_ai_fallback: item.source_type === 'AI_ESTIMATE',
    })),
  });
}

export const localVerifiedCatalogProvider: NutritionLookupProvider = {
  id: 'local-verified-catalog',
  lookup({ text, mealType, normalizedQuery }) {
    const match = findCatalogFoodMatch(normalizedQuery.searchText, normalizedQuery.brandHint);

    if (match) {
      const source = getNutritionSourceById(match.food.sourceId);
      if (source?.sourceType === 'OFFICIAL_RESTAURANT' && (match.exactAlias || match.exactProduct)) {
        const item = scaleCatalogFood(match.food, normalizedQuery.quantity, match.food.servingUnit);

        return makeCatalogMealResponse(
          mealType,
          [
            {
              ...item,
              notes: buildLocalMatchNotes(match.food.canonicalName, source.name ?? null, normalizedQuery.matchedQuery),
              confidence_label: 'Verified',
              matched_query: normalizedQuery.matchedQuery,
              original_user_text: text,
              provider_used: 'local-verified-catalog',
              used_ai_fallback: false,
            },
          ],
          0.98,
        );
      }
    }

    if (!isOfficialRestaurantBrand(normalizedQuery.brandHint) || !looksLikeCompoundMeal(text)) {
      return null;
    }

    return decorateTrustedCatalogResponse(text, getTrustedCatalogEstimate(text, mealType));
  },
};

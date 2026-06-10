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
  "Arby's",
  'Burger King',
  'CAVA',
  'Chick-fil-A',
  'Chipotle',
  "McDonald's",
  'Panera',
  'Panda Express',
  'Starbucks',
  'Subway',
  'Taco Bell',
  'White Castle',
  "Wendy's",
]);

function getConfidenceLabel(sourceType: string | null | undefined, branded = false) {
  if (sourceType === 'OFFICIAL_RESTAURANT' || branded) return 'Verified';
  if (sourceType === 'AI_ESTIMATE') return 'Estimated';
  return 'Matched';
}

function getMatchType(sourceType: string | null | undefined, branded = false, exact = true) {
  if (sourceType === 'OFFICIAL_RESTAURANT') return exact ? 'exact_restaurant' : 'fuzzy_restaurant';
  if (branded) return exact ? 'exact_branded' : 'fuzzy_branded';
  if (sourceType === 'AI_ESTIMATE') return 'ai_estimate';
  return 'verified_database';
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
      confidence_label: item.source_type === 'AI_ESTIMATE' ? 'Estimated' : getConfidenceLabel(item.source_type, Boolean(item.source_name && !/USDA|generic/i.test(item.source_name))),
      match_type: item.match_type ?? getMatchType(item.source_type, Boolean(item.source_name && !/USDA|generic/i.test(item.source_name)), false),
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
      if (source && (match.exactAlias || match.exactProduct) && (source.sourceType === 'OFFICIAL_RESTAURANT' || Boolean(source.brand))) {
        const item = scaleCatalogFood(
          match.food,
          normalizedQuery.quantity,
          normalizedQuery.quantityUnit === 'g' ? 'g' : match.food.servingUnit,
        );

        return makeCatalogMealResponse(
          mealType,
          [
            {
              ...item,
              notes: buildLocalMatchNotes(match.food.canonicalName, source.name ?? null, normalizedQuery.matchedQuery),
              confidence_label: getConfidenceLabel(source.sourceType, Boolean(source.brand)),
              match_type: getMatchType(source.sourceType, Boolean(source.brand), match.exactAlias || match.exactProduct),
              matched_query: normalizedQuery.matchedQuery,
              original_user_text: text,
              provider_used: 'local-verified-catalog',
              used_ai_fallback: false,
            },
          ],
          source.sourceType === 'OFFICIAL_RESTAURANT' ? 0.98 : 0.95,
        );
      }
    }

    if (!isOfficialRestaurantBrand(normalizedQuery.brandHint) || !looksLikeCompoundMeal(text)) {
      return null;
    }

    return decorateTrustedCatalogResponse(text, getTrustedCatalogEstimate(text, mealType));
  },
};

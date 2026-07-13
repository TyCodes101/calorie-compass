import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import {
  findCatalogFoodMatch,
  getNutritionSourceById,
  makeCatalogMealResponse,
  scaleCatalogFood,
} from '@/lib/nutrition/catalog';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import { computeServingScaleFactor } from '@/lib/nutrition/scaling';
import { recordServingScaling } from '@/lib/ai/foodPipelineTrace';
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

const productIdentityStopWords = new Set([
  'a', 'an', 'one', 'two', 'three', 'four', 'five', 'six', 'of', 'the', 'with', 'and',
  'had', 'have', 'i', 'my', 'eat', 'ate', 'drink', 'drank', 'food', 'item', 'product',
  'protein', 'bar', 'bars', 'bottle', 'bottles', 'serving', 'servings',
  'pack', 'package', 'bag', 'bags', 'can', 'cans', 'oz', 'ounce', 'ounces', 'g', 'gram', 'grams',
]);

function hasProductIdentityOverlap(normalizedQuery: ReturnType<typeof normalizeFoodQuery>, match: NonNullable<ReturnType<typeof findCatalogFoodMatch>>) {
  const brandTokens = new Set((normalizedQuery.brandHint ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const requestedTokens = normalizedQuery.searchText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !productIdentityStopWords.has(token) && !brandTokens.has(token));

  if (!requestedTokens.length) return true;

  const candidateText = [match.food.canonicalName, ...match.food.aliases]
    .join(' ')
    .toLowerCase();
  return requestedTokens.some((token) => candidateText.includes(token));
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
  lookup({ text, mealType, normalizedQuery, trace }) {
    const match = findCatalogFoodMatch(normalizedQuery.searchText, normalizedQuery.brandHint);

    if (match) {
      const source = getNutritionSourceById(match.food.sourceId);
      const exactMatch = match.exactAlias || match.exactProduct;
      const isBrandedSource = source?.sourceType === 'OFFICIAL_RESTAURANT' || Boolean(source?.brand);
      const safeFuzzyBrandMatch = !exactMatch
        && match.score >= 90
        && Boolean(source?.brand)
        && (source?.sourceType !== 'OFFICIAL_RESTAURANT' || isOfficialRestaurantBrand(normalizedQuery.brandHint))
        && hasProductIdentityOverlap(normalizedQuery, match);
      if (source && (exactMatch || safeFuzzyBrandMatch) && isBrandedSource) {
        const item = scaleCatalogFood(
          match.food,
          normalizedQuery.quantity,
          normalizedQuery.quantityUnit === 'g' ? 'g' : match.food.servingUnit,
        );
        const servingGrams = 'servingGrams' in match.food ? Number(match.food.servingGrams) : null;
        const hasServingGrams = servingGrams !== null && Number.isFinite(servingGrams) && servingGrams > 0;
        const requestedUnit = normalizedQuery.quantityUnit ?? normalizedQuery.unitHint ?? match.food.servingUnit;
        const providerServingQuantity = normalizedQuery.quantityUnit === 'g' && match.food.servingUnit !== 'g' && hasServingGrams
          ? servingGrams ?? match.food.servingQuantity
          : match.food.servingQuantity;
        const providerServingUnit = normalizedQuery.quantityUnit === 'g' && match.food.servingUnit !== 'g' && hasServingGrams
          ? 'g'
          : match.food.servingUnit;
        const scaling = computeServingScaleFactor({
          requestedQuantity: normalizedQuery.quantity,
          requestedUnit,
          providerServingQuantity,
          providerServingUnit,
        });
        if (trace && scaling) {
          recordServingScaling(trace, {
            requestedQuantity: normalizedQuery.quantity,
            requestedUnit,
            providerServingQuantity,
            providerServingUnit,
            scaleFactor: scaling.scaleFactor,
          });
        }
        const missingDescriptorReview = safeFuzzyBrandMatch && !exactMatch;

        return makeCatalogMealResponse(
          mealType,
          [
            {
              ...item,
              is_trusted: item.is_trusted && !missingDescriptorReview,
              notes: [
                buildLocalMatchNotes(match.food.canonicalName, source.name ?? null, normalizedQuery.matchedQuery),
                missingDescriptorReview ? 'The brand/product family matched, but an exact flavor or descriptor was not confirmed. Review before saving.' : null,
              ].filter(Boolean).join(' '),
              confidence_label: missingDescriptorReview
                ? 'Needs Review'
                : getConfidenceLabel(source.sourceType, Boolean(source.brand)),
              match_type: getMatchType(source.sourceType, Boolean(source.brand), exactMatch),
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

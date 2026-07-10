import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { commercialDatabaseProvider } from '@/lib/nutrition/providers/commercialDatabase';
import { localVerifiedCatalogProvider } from '@/lib/nutrition/providers/localVerifiedCatalog';
import { usdaProvider } from '@/lib/nutrition/providers/usda';
import {
  buildAccuracyClarificationQuestion,
  buildNutritionIntent,
  isAuthoritativeNutritionResult,
  resolveBestNutritionCandidate,
  shouldClarifyBeforeLookup,
  withVerificationLabels,
} from '@/lib/nutrition/accuracyEngine';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import type { NutritionLookupInput, NutritionLookupProvider } from '@/lib/nutrition/types';
import { recordProviderAttempt } from '@/lib/ai/foodPipelineTrace';
import type { FoodPipelineTrace } from '@/lib/ai/foodPipelineTrace';

function makeLabelResponse(input: NutritionLookupInput) {
  if (!input.nutritionLabel) {
    return null;
  }

  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: input.mealType,
    confidence_score: 0.98,
    items: [
      {
        food_name: input.nutritionLabel.name?.trim() || 'Nutrition label entry',
        quantity: input.nutritionLabel.servingQuantity ?? 1,
        unit: input.nutritionLabel.servingUnit?.trim() || 'serving',
        calories: Number(input.nutritionLabel.calories || 0),
        protein: Number(input.nutritionLabel.protein || 0),
        carbs: Number(input.nutritionLabel.carbs || 0),
        fat: Number(input.nutritionLabel.fat || 0),
        fiber: Number(input.nutritionLabel.fiber || 0),
        sugar: Number(input.nutritionLabel.sugar || 0),
        sodium: Number(input.nutritionLabel.sodium || 0),
        notes: 'Matched to a nutrition label you provided. Adjust if your serving size differs.',
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'User-provided nutrition label',
        confidence_label: 'Verified',
        match_type: 'verified_database',
        matched_query: input.nutritionLabel.name?.trim() || 'Nutrition label entry',
        original_user_text: input.text,
        provider_used: 'nutrition-label',
        used_ai_fallback: false,
        catalog_food_id: null,
      },
    ],
  });
}

function inferProviderUsed(item: ParsedFoodItem) {
  const sourceName = item.source_name?.toLowerCase() ?? '';

  if (sourceName.includes('usda')) return 'usda-fdc';
  if (sourceName.includes('nutritionix')) return 'commercial-database';
  if (sourceName.includes('open food facts')) return 'open-food-facts';
  if (sourceName.includes('user-provided nutrition label')) return 'nutrition-label';
  if (item.source_type === 'OFFICIAL_RESTAURANT') return 'local-verified-catalog';
  if (item.source_type === 'AI_ESTIMATE') return 'ai-estimate-fallback';
  return 'database-match';
}

function buildItemLookupText(item: ParsedFoodItem) {
  const quantity = Number(item.quantity ?? 1);
  const unit = item.unit?.trim() ?? '';
  const foodName = item.food_name.trim();
  const normalizedFoodName = foodName.toLowerCase();
  const normalizedUnit = unit.toLowerCase();
  const measurementUnits = new Set(['g', 'gram', 'grams', 'oz', 'ounce', 'ounces', 'slice', 'slices', 'piece', 'pieces', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons']);
  if (!foodName) {
    return 'food';
  }

  if (unit && !/^(?:serving|servings|meal|meals|count|counts)$/i.test(unit) && (quantity !== 1 || measurementUnits.has(normalizedUnit))) {
    if (normalizedFoodName.includes(normalizedUnit.replace(/s$/, ''))) {
      return `${quantity} ${foodName}`.replace(/\s+/g, ' ').trim();
    }

    return `${quantity} ${unit} ${foodName}`.replace(/\s+/g, ' ').trim();
  }

  if (quantity > 1) {
    return `${quantity} ${foodName}`;
  }

  return foodName;
}

function decorateLookupItems(items: ParsedFoodItem[], originalUserText: string) {
  return items.map((item) => ({
    ...item,
    original_user_text: originalUserText,
    matched_query: item.matched_query ?? originalUserText,
    provider_used: item.provider_used ?? inferProviderUsed(item),
    match_type: item.match_type ?? (item.source_type === 'OFFICIAL_RESTAURANT' ? 'exact_restaurant' : item.source_type === 'AI_ESTIMATE' ? 'ai_estimate' : item.is_trusted ? 'verified_database' : 'unknown'),
    confidence_label: item.confidence_label ?? (item.source_type === 'AI_ESTIMATE' ? 'Estimated' : item.source_type === 'OFFICIAL_RESTAURANT' ? 'Verified' : 'Matched'),
    used_ai_fallback: item.used_ai_fallback ?? item.source_type === 'AI_ESTIMATE',
  }));
}

function decorateEstimatedItem(item: ParsedFoodItem, originalUserText: string): ParsedFoodItem {
  return {
    ...item,
    notes: item.notes ?? 'No verified match found, estimated with AI.',
    source_type: 'AI_ESTIMATE',
    source_name: item.source_name ?? 'AI estimate',
    confidence_label: 'Estimated',
    match_type: 'ai_estimate',
    matched_query: item.matched_query ?? originalUserText,
    original_user_text: originalUserText,
    provider_used: 'ai-estimate-fallback',
    used_ai_fallback: true,
  };
}

const restaurantBrands = new Set([
  "Arby's",
  'Burger King',
  'CAVA',
  'Chick-fil-A',
  'Chipotle',
  'Dunkin',
  "McDonald's",
  'Panda Express',
  'Panera',
  'Starbucks',
  'Subway',
  'Taco Bell',
  'Texas Roadhouse',
  "Wendy's",
  'White Castle',
]);

function normalizeComparableText(text: string | null | undefined) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function brandTokens(brandHint: string) {
  const normalized = normalizeComparableText(brandHint);
  if (normalized === 'mcdonald s') return ['mcdonald', 'mcdonalds'];
  if (normalized === 'wendy s') return ['wendy', 'wendys'];
  if (normalized === 'chick fil a') return ['chick', 'fil'];
  if (normalized === 'arby s') return ['arby', 'arbys'];
  if (normalized === 'white castle') return ['white', 'castle'];
  return normalized.split(' ').filter((token) => token.length > 1);
}

function responseMatchesBrand(response: ParsedMealResponse | null, brandHint: string | null) {
  if (!response || !brandHint) return true;
  const tokens = brandTokens(brandHint);
  return response.items.some((item) => {
    const haystack = normalizeComparableText(`${item.food_name} ${item.source_name ?? ''} ${item.notes ?? ''}`);
    return tokens.every((token) => haystack.includes(token));
  });
}

function responseMatchesCategory(response: ParsedMealResponse | null, searchText: string) {
  if (!response) return true;
  const normalized = normalizeComparableText(searchText);
  const wantsProteinChips = /\bprotein\b/.test(normalized) && /\bchips?\b/.test(normalized);
  if (!wantsProteinChips) return true;

  return response.items.some((item) => {
    const haystack = normalizeComparableText(`${item.food_name} ${item.notes ?? ''} ${item.matched_query ?? ''}`);
    return /\bprotein\b/.test(haystack) && /\bchips?\b/.test(haystack);
  });
}

type LookupIntent = {
  brandHint: string | null;
  hasProteinSignal: boolean;
  hasSnackSignal: boolean;
  hasExplicitLargeServing: boolean;
};

function extractLookupIntent(input: NutritionLookupInput, searchText: string, brandHint: string | null): LookupIntent {
  const normalized = normalizeComparableText(`${input.text} ${searchText}`);
  return {
    brandHint,
    hasProteinSignal: /\bprotein\b|\bcore power\b|\bfairlife\b|\bquest\b|\bpremier protein\b|\bmuscle milk\b|\bbarebells?\b/i.test(normalized),
    hasSnackSignal: /\bchips?\b|\bcrisps?\b|\bcrackers?\b|\bbars?\b|\bshake\b|\byogurt\b|\bsnack\b/i.test(normalized),
    hasExplicitLargeServing: /\b\d+(?:\.\d+)?\s*(?:oz|ounce|ounces|bag|bags|serving|servings)\b/i.test(normalized),
  };
}

function itemServingLooksUnrealistic(item: ParsedFoodItem, intent: LookupIntent) {
  const quantity = Number(item.quantity ?? 1);
  const unit = normalizeComparableText(item.unit);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return true;
  }

  if (intent.hasSnackSignal && !intent.hasExplicitLargeServing) {
    if ((unit === 'oz' || unit === 'ounce' || unit === 'ounces') && quantity > 4) return true;
    if ((unit === 'g' || unit === 'gram' || unit === 'grams') && quantity > 120) return true;
  }

  return false;
}

function itemMacrosLookPlausible(item: ParsedFoodItem, intent: LookupIntent) {
  const calories = Number(item.calories ?? 0);
  const protein = Number(item.protein ?? 0);
  const carbs = Number(item.carbs ?? 0);

  if (!Number.isFinite(calories) || calories < 0 || calories > 1500) return false;

  if (intent.hasProteinSignal) {
    if (protein < 10) return false;
    if (carbs > 60 && protein < 15) return false;
  }

  return true;
}

function responseMatchesPlausibility(response: ParsedMealResponse, intent: LookupIntent) {
  return response.items.every((item) => !itemServingLooksUnrealistic(item, intent) && itemMacrosLookPlausible(item, intent));
}

function makeClarificationResponse(input: NutritionLookupInput, question: string) {
  return normalizeParsedMealResponse({
    needs_clarification: true,
    clarifying_question: question,
    meal_type: input.mealType,
    confidence_score: 0.35,
    items: [],
  });
}

function shouldClarifyUnresolvedBrand(brandHint: string | null, searchText: string) {
  if (!brandHint) return false;
  if (restaurantBrands.has(brandHint)) return true;
  const normalizedSearch = normalizeComparableText(searchText);
  return normalizedSearch.split(' ').length >= 2;
}

export async function lookupNutrition(
  input: NutritionLookupInput,
  options?: {
    providers?: NutritionLookupProvider[];
    aiEstimateProvider?: NutritionLookupProvider | null;
    trace?: FoodPipelineTrace;
  },
) {
  const labelResponse = makeLabelResponse(input);
  if (labelResponse) {
    return labelResponse;
  }

  const normalizedQuery = normalizeFoodQuery(input.text);
  const intent = buildNutritionIntent(input, normalizedQuery);

  if (shouldClarifyBeforeLookup(intent)) {
    return makeClarificationResponse(input, buildAccuracyClarificationQuestion(intent));
  }

  const context = {
    text: input.text,
    mealType: input.mealType,
    normalizedQuery,
  };

  const usingDefaultProviders = !options?.providers;
  const providers = options?.providers ?? [localVerifiedCatalogProvider, usdaProvider, commercialDatabaseProvider];
  const [primaryProvider, ...supportingProviders] = providers;
  const runProvider = async (provider: NutritionLookupProvider | undefined) => {
    if (!provider) return null;

    const status = provider.getStatus?.() ?? { configured: true };
    if (!status.configured) {
      if (options?.trace) {
        recordProviderAttempt(options.trace, {
          provider: provider.id,
          configured: false,
          succeeded: false,
          outcome: 'not_configured',
          durationMs: 0,
        });
      }
      return null;
    }

    const startedAt = Date.now();
    try {
      const result = await provider.lookup(context);
      if (options?.trace) {
        recordProviderAttempt(options.trace, {
          provider: provider.id,
          configured: true,
          succeeded: Boolean(result?.items.length),
          outcome: result?.items.length ? 'matched' : 'no_match',
          durationMs: Date.now() - startedAt,
        });
      }
      return result;
    } catch {
      if (options?.trace) {
        recordProviderAttempt(options.trace, {
          provider: provider.id,
          configured: true,
          succeeded: false,
          outcome: 'failed',
          durationMs: Date.now() - startedAt,
        });
      }
      return null;
    }
  };

  const markSelected = (provider: NutritionLookupProvider | undefined, response: ParsedMealResponse | null) => {
    if (!options?.trace || !provider || !response?.items.length) return;
    options.trace.selectedProvider = provider.id;
    options.trace.selectedMatchType = response.items[0]?.match_type ?? null;
    if (response.items.some((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback)) {
      options.trace.usedAiEstimate = true;
    }
  };

  const primaryResult = await runProvider(primaryProvider);

  if (primaryResult) {
    if (primaryResult.needs_clarification) {
      if (options?.trace) options.trace.clarificationRequired = true;
      return primaryResult;
    }

    if (isAuthoritativeNutritionResult(primaryResult, intent, primaryProvider.id)) {
      markSelected(primaryProvider, primaryResult);
      return withVerificationLabels(primaryResult);
    }
  }

  const shouldProtectBrandIntent = usingDefaultProviders
    && shouldClarifyUnresolvedBrand(normalizedQuery.brandHint, normalizedQuery.searchText);
  const lookupIntent = extractLookupIntent(input, normalizedQuery.searchText, normalizedQuery.brandHint);
  const candidates = primaryResult ? [{ providerId: primaryProvider?.id ?? 'primary', response: primaryResult }] : [];

  for (const provider of supportingProviders) {
    const result = await runProvider(provider);
    if (!result) {
      continue;
    }

    candidates.push({ providerId: provider.id, response: result });

    if (shouldProtectBrandIntent && !responseMatchesBrand(result, normalizedQuery.brandHint)) {
      if (options?.trace) options.trace.clarificationRequired = true;
      return makeClarificationResponse(
        input,
        `I found possible nutrition data, but not a clear ${normalizedQuery.brandHint} match. Which exact item or serving should I use?`,
      );
    }

    if (!responseMatchesCategory(result, normalizedQuery.searchText)) {
      if (options?.trace) options.trace.clarificationRequired = true;
      return makeClarificationResponse(
        input,
        'I found possible nutrition data, but not a clear match for the food type you described. Which exact item or serving should I use?',
      );
    }

    if (!responseMatchesPlausibility(result, lookupIntent)) {
      if (options?.trace) options.trace.clarificationRequired = true;
      return makeClarificationResponse(
        input,
        'I found possible nutrition data, but the serving or macros do not look right for what you described. Which exact item or serving should I use?',
      );
    }
  }

  const rankedResult = resolveBestNutritionCandidate(intent, candidates);
  if (rankedResult.response) {
    markSelected(
      providers.find((provider) => provider.id === rankedResult.providerId),
      rankedResult.response,
    );
    return rankedResult.response;
  }

  if (rankedResult.clarificationQuestion) {
    if (options?.trace) options.trace.clarificationRequired = true;
    return makeClarificationResponse(input, rankedResult.clarificationQuestion);
  }

  if (shouldProtectBrandIntent) {
    if (options?.trace) options.trace.clarificationRequired = true;
    return makeClarificationResponse(
      input,
      `I could not find a clear ${normalizedQuery.brandHint} match. Which exact item or serving should I use?`,
    );
  }

  if (options?.aiEstimateProvider) {
    const aiResponse = await runProvider(options.aiEstimateProvider);
    if (options?.trace && aiResponse?.items.some((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback)) {
      options.trace.usedAiEstimate = true;
    }
    return aiResponse ? withVerificationLabels(aiResponse) : aiResponse;
  }

  return null;
}

export async function hydrateParsedMealWithProviders(
  response: ParsedMealResponse,
  options?: {
    providers?: NutritionLookupProvider[];
    trace?: FoodPipelineTrace;
  },
) {
  if (response.needs_clarification || !response.items.length) {
    return response;
  }

  const hydratedItems: ParsedFoodItem[] = [];

  for (const item of response.items) {
    const lookupText = buildItemLookupText(item);
    const lookupResult = await lookupNutrition(
      {
        text: lookupText,
        mealType: response.meal_type,
      },
      {
        providers: options?.providers,
        trace: options?.trace,
      },
    );

    if (lookupResult?.items.length) {
      hydratedItems.push(...decorateLookupItems(lookupResult.items, lookupText));
      continue;
    }

    hydratedItems.push(decorateEstimatedItem(item, lookupText));
  }

  return normalizeParsedMealResponse({
    needs_clarification: response.needs_clarification,
    clarifying_question: response.clarifying_question,
    meal_type: response.meal_type,
    confidence_score: response.confidence_score,
    items: hydratedItems,
  });
}

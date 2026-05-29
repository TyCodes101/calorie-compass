import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { commercialDatabaseProvider } from '@/lib/nutrition/providers/commercialDatabase';
import { localVerifiedCatalogProvider } from '@/lib/nutrition/providers/localVerifiedCatalog';
import { usdaProvider } from '@/lib/nutrition/providers/usda';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import type { NutritionLookupInput, NutritionLookupProvider } from '@/lib/nutrition/types';

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
        confidence_label: 'Very High',
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
    used_ai_fallback: item.used_ai_fallback ?? item.source_type === 'AI_ESTIMATE',
  }));
}

function decorateEstimatedItem(item: ParsedFoodItem, originalUserText: string): ParsedFoodItem {
  return {
    ...item,
    notes: item.notes ?? 'No verified match found, estimated with AI.',
    source_type: 'AI_ESTIMATE',
    source_name: item.source_name ?? 'AI estimate',
    confidence_label: 'Low',
    match_type: 'ai_estimate',
    matched_query: item.matched_query ?? originalUserText,
    original_user_text: originalUserText,
    provider_used: 'ai-estimate-fallback',
    used_ai_fallback: true,
  };
}

export async function lookupNutrition(
  input: NutritionLookupInput,
  options?: {
    providers?: NutritionLookupProvider[];
    aiEstimateProvider?: NutritionLookupProvider | null;
  },
) {
  const labelResponse = makeLabelResponse(input);
  if (labelResponse) {
    return labelResponse;
  }

  const normalizedQuery = normalizeFoodQuery(input.text);
  const context = {
    text: input.text,
    mealType: input.mealType,
    normalizedQuery,
  };

  const providers = options?.providers ?? [localVerifiedCatalogProvider, usdaProvider, commercialDatabaseProvider];

  for (const provider of providers) {
    const result = await provider.lookup(context);
    if (result) {
      return result;
    }
  }

  if (options?.aiEstimateProvider) {
    return options.aiEstimateProvider.lookup(context);
  }

  return null;
}

export async function hydrateParsedMealWithProviders(
  response: ParsedMealResponse,
  options?: {
    providers?: NutritionLookupProvider[];
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

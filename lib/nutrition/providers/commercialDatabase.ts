import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { scaleParsedFoodItem } from '@/lib/nutrition/catalog';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

type NutritionixResponse = {
  foods?: Array<{
    food_name?: string;
    serving_qty?: number;
    serving_unit?: string;
    nf_calories?: number;
    nf_protein?: number;
    nf_total_carbohydrate?: number;
    nf_total_fat?: number;
    nf_dietary_fiber?: number;
    nf_sugars?: number;
    nf_sodium?: number;
    brand_name?: string;
  }>;
};

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

export const commercialDatabaseProvider: NutritionLookupProvider = {
  id: 'commercial-database-slot',
  getStatus() {
    const hasAppId = Boolean(process.env.NUTRITIONIX_APP_ID?.trim());
    const hasApiKey = Boolean(process.env.NUTRITIONIX_API_KEY?.trim());
    return {
      configured: hasAppId && hasApiKey,
      reason: hasAppId && hasApiKey ? undefined : 'nutritionix_not_configured',
    };
  },
  async lookup({ mealType, normalizedQuery }) {
    const appId = process.env.NUTRITIONIX_APP_ID?.trim();
    const apiKey = process.env.NUTRITIONIX_API_KEY?.trim();
    if (!appId || !apiKey) {
      return null;
    }

    const payload = await fetchJson<NutritionixResponse>('https://trackapi.nutritionix.com/v2/natural/nutrients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': appId,
        'x-app-key': apiKey,
      },
      body: JSON.stringify({ query: normalizedQuery.searchText }),
    });

    const food = payload?.foods?.[0];
    if (!food) {
      return null;
    }

    const baseItem = {
      food_name: [food.brand_name, food.food_name].filter(Boolean).join(' ').trim() || normalizedQuery.matchedQuery,
      quantity: food.serving_qty ?? 1,
      unit: food.serving_unit?.trim() || 'serving',
      calories: food.nf_calories ?? 0,
      protein: food.nf_protein ?? 0,
      carbs: food.nf_total_carbohydrate ?? 0,
      fat: food.nf_total_fat ?? 0,
      fiber: food.nf_dietary_fiber ?? 0,
      sugar: food.nf_sugars ?? 0,
      sodium: food.nf_sodium ?? 0,
      notes: `Matched using a commercial nutrition database. Query: ${normalizedQuery.matchedQuery}.`,
      is_trusted: true,
      source_type: 'GENERIC_REFERENCE' as const,
      source_name: 'Nutritionix',
      confidence_label: 'Matched' as const,
      matched_query: normalizedQuery.matchedQuery,
      original_user_text: normalizedQuery.rawText,
      provider_used: 'commercial-database',
      used_ai_fallback: false,
      catalog_food_id: null,
    };

    const item = normalizedQuery.quantity > 1 ? scaleParsedFoodItem(baseItem, normalizedQuery.quantity) : baseItem;

    return normalizeParsedMealResponse({
      needs_clarification: false,
      clarifying_question: null,
      meal_type: mealType,
      confidence_score: 0.8,
      items: [item],
    });
  },
};

import { prisma } from '@/lib/prisma';
import type { ParsedFoodItem } from '@/lib/ai/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { getCurrentUserId } from '@/lib/current-user';

export type NutritionLabelInput = {
  name?: string | null;
  servingQuantity?: number | null;
  servingUnit?: string | null;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
};

export type NutritionResolverInput = {
  text: string;
  mealType: MealTypeValue;
  nutritionLabel?: NutritionLabelInput | null;
  barcode?: string | null;
};

function normalizeLookupText(text: string) {
  return text
    .toLowerCase()
    .replace(/additional detail:.*/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMealResponse(mealType: MealTypeValue, items: ParsedFoodItem[], confidenceScore: number) {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: confidenceScore,
    items,
  });
}

function makeLabelItem(label: NutritionLabelInput): ParsedFoodItem {
  return {
    food_name: label.name?.trim() || 'Nutrition label entry',
    quantity: label.servingQuantity ?? 1,
    unit: label.servingUnit?.trim() || 'serving',
    calories: Number(label.calories || 0),
    protein: Number(label.protein || 0),
    carbs: Number(label.carbs || 0),
    fat: Number(label.fat || 0),
    fiber: Number(label.fiber || 0),
    sugar: Number(label.sugar || 0),
    sodium: Number(label.sodium || 0),
    notes: 'Matched to a nutrition label you provided. Adjust if your serving size differs.',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'User-provided nutrition label',
    catalog_food_id: null,
  };
}

function extractBarcode(text: string) {
  const match = text.match(/\b\d{8,14}\b/);
  return match?.[0] ?? null;
}

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

async function resolveFromSavedCorrection(text: string, mealType: MealTypeValue) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const normalizedText = normalizeLookupText(text);
    if (!normalizedText) {
      return null;
    }

    const meals = await prisma.meal.findMany({
      where: {
        userId,
        mealType: mealType.toUpperCase() as 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK',
        rawText: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        rawText: true,
        confidenceScore: true,
        items: {
          select: {
            foodName: true,
            quantity: true,
            unit: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            fiber: true,
            sugar: true,
            sodium: true,
            notes: true,
            nutritionSourceType: true,
            nutritionSourceName: true,
            catalogFoodId: true,
          },
        },
      },
    });

    const matchedMeal = meals.find((meal) => normalizeLookupText(meal.rawText ?? '') === normalizedText && meal.items.length > 0);
    if (!matchedMeal) {
      return null;
    }

    const items: ParsedFoodItem[] = matchedMeal.items.map((item) => ({
      food_name: item.foodName,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
      notes: item.notes
        ? `${item.notes} Using your last saved values for this meal.`
        : 'Using your last saved values for this meal.',
      is_trusted: item.nutritionSourceType ? item.nutritionSourceType !== 'AI_ESTIMATE' : false,
      source_type: item.nutritionSourceType,
      source_name: item.nutritionSourceName,
      catalog_food_id: item.catalogFoodId,
    }));

    return buildMealResponse(mealType, items, Math.max(matchedMeal.confidenceScore ?? 0.82, 0.9));
  } catch {
    return null;
  }
}

type OpenFoodFactsProductResponse = {
  status?: number;
  product?: {
    product_name?: string;
    nutriments?: {
      'energy-kcal_serving'?: number;
      'energy-kcal_100g'?: number;
      proteins_serving?: number;
      proteins_100g?: number;
      carbohydrates_serving?: number;
      carbohydrates_100g?: number;
      fat_serving?: number;
      fat_100g?: number;
      fiber_serving?: number;
      fiber_100g?: number;
      sugars_serving?: number;
      sugars_100g?: number;
      sodium_serving?: number;
      sodium_100g?: number;
      salt_serving?: number;
      salt_100g?: number;
    };
    serving_quantity?: number;
    serving_size?: string;
  };
};

function pickServingValue(servingValue?: number, fallbackValue?: number) {
  if (typeof servingValue === 'number' && Number.isFinite(servingValue)) {
    return servingValue;
  }

  if (typeof fallbackValue === 'number' && Number.isFinite(fallbackValue)) {
    return fallbackValue;
  }

  return 0;
}

async function resolveFromOpenFoodFacts(barcode: string, mealType: MealTypeValue) {
  const payload = await fetchJson<OpenFoodFactsProductResponse>(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments,serving_quantity,serving_size`
  );

  const product = payload?.product;
  const nutriments = product?.nutriments;

  if (payload?.status !== 1 || !product || !nutriments) {
    return null;
  }

  const sodium =
    pickServingValue(nutriments.sodium_serving, nutriments.sodium_100g) ||
    pickServingValue(nutriments.salt_serving, nutriments.salt_100g) / 2.5;

  return buildMealResponse(
    mealType,
    [
      {
        food_name: product.product_name?.trim() || 'Barcode product',
        quantity: product.serving_quantity ?? 1,
        unit: product.serving_size?.trim() || 'serving',
        calories: pickServingValue(nutriments['energy-kcal_serving'], nutriments['energy-kcal_100g']),
        protein: pickServingValue(nutriments.proteins_serving, nutriments.proteins_100g),
        carbs: pickServingValue(nutriments.carbohydrates_serving, nutriments.carbohydrates_100g),
        fat: pickServingValue(nutriments.fat_serving, nutriments.fat_100g),
        fiber: pickServingValue(nutriments.fiber_serving, nutriments.fiber_100g),
        sugar: pickServingValue(nutriments.sugars_serving, nutriments.sugars_100g),
        sodium,
        notes: `Barcode match for ${product.product_name?.trim() || 'this product'}. Adjust if your serving differs.`,
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'Open Food Facts barcode match',
        catalog_food_id: null,
      },
    ],
    0.92,
  );
}

type UsdaSearchResponse = {
  foods?: Array<{
    description?: string;
    brandOwner?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    foodNutrients?: Array<{ nutrientName?: string; value?: number }>;
  }>;
};

function findUsdaNutrient(
  food: NonNullable<UsdaSearchResponse['foods']>[number],
  names: string[],
) {
  const nutrient = food.foodNutrients?.find((entry) => names.includes(entry.nutrientName ?? ''));
  return nutrient?.value ?? 0;
}

async function resolveFromUsda(text: string, mealType: MealTypeValue) {
  const apiKey = process.env.FDC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const payload = await fetchJson<UsdaSearchResponse>('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: text, pageSize: 1 }),
  });

  const food = payload?.foods?.[0];
  if (!food) {
    return null;
  }

  return buildMealResponse(
    mealType,
    [
      {
        food_name: food.brandOwner ? `${food.brandOwner} ${food.description ?? ''}`.trim() : food.description?.trim() || 'USDA match',
        quantity: food.servingSize ?? 1,
        unit: food.servingSizeUnit?.trim() || 'serving',
        calories: findUsdaNutrient(food, ['Energy']),
        protein: findUsdaNutrient(food, ['Protein']),
        carbs: findUsdaNutrient(food, ['Carbohydrate, by difference']),
        fat: findUsdaNutrient(food, ['Total lipid (fat)']),
        fiber: findUsdaNutrient(food, ['Fiber, total dietary']),
        sugar: findUsdaNutrient(food, ['Sugars, total including NLEA']),
        sodium: findUsdaNutrient(food, ['Sodium, Na']),
        notes: `Matched to USDA FoodData Central for ${food.description?.trim() || 'this food'}.`,
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'USDA FoodData Central',
        catalog_food_id: null,
      },
    ],
    0.82,
  );
}

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

async function resolveFromNutritionix(text: string, mealType: MealTypeValue) {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const apiKey = process.env.NUTRITIONIX_API_KEY;
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
    body: JSON.stringify({ query: text }),
  });

  const food = payload?.foods?.[0];
  if (!food) {
    return null;
  }

  return buildMealResponse(
    mealType,
    [
      {
        food_name: [food.brand_name, food.food_name].filter(Boolean).join(' ').trim() || 'Nutritionix match',
        quantity: food.serving_qty ?? 1,
        unit: food.serving_unit?.trim() || 'serving',
        calories: food.nf_calories ?? 0,
        protein: food.nf_protein ?? 0,
        carbs: food.nf_total_carbohydrate ?? 0,
        fat: food.nf_total_fat ?? 0,
        fiber: food.nf_dietary_fiber ?? 0,
        sugar: food.nf_sugars ?? 0,
        sodium: food.nf_sodium ?? 0,
        notes: `Matched to Nutritionix for ${[food.brand_name, food.food_name].filter(Boolean).join(' ').trim() || 'this item'}.`,
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'Nutritionix branded database',
        catalog_food_id: null,
      },
    ],
    0.8,
  );
}

export async function resolveNutritionEstimate({ text, mealType, nutritionLabel = null, barcode = null }: NutritionResolverInput) {
  if (nutritionLabel) {
    return buildMealResponse(mealType, [makeLabelItem(nutritionLabel)], 0.98);
  }

  const savedCorrection = await resolveFromSavedCorrection(text, mealType);
  if (savedCorrection) {
    return savedCorrection;
  }

  const detectedBarcode = barcode || extractBarcode(text);
  if (detectedBarcode) {
    const barcodeResult = await resolveFromOpenFoodFacts(detectedBarcode, mealType);
    if (barcodeResult) {
      return barcodeResult;
    }
  }

  const trustedCatalogResult = getTrustedCatalogEstimate(text, mealType);
  if (trustedCatalogResult) {
    return trustedCatalogResult;
  }

  const usdaResult = await resolveFromUsda(text, mealType);
  if (usdaResult) {
    return usdaResult;
  }

  const nutritionixResult = await resolveFromNutritionix(text, mealType);
  if (nutritionixResult) {
    return nutritionixResult;
  }

  return null;
}

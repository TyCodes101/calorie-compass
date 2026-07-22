import { z } from 'zod';

import type { ParsedMealResponse } from '@/lib/ai/types';
import { normalizeBarcode } from '@/lib/nutrition/barcode';
import { normalizeServingUnit, isCountableServingUnit } from '@/lib/nutrition/scaling';
import type { NormalizedFoodQuery, NutritionLookupProvider } from '@/lib/nutrition/types';
import {
  buildBarcodeMealResponse,
  buildProviderMealResponse,
  normalizeProviderText,
  providerTextTokens,
  providerTokenMatches,
  scalePer100g,
  toFiniteNonnegative,
  type NormalizedProviderFood,
} from '@/lib/nutrition/providers/providerNormalization';
import { validateNutritionFacts, type NutritionFacts } from '@/lib/nutrition/providers/nutritionPlausibility';
import { buildProviderCacheKey, withProviderCache } from '@/lib/nutrition/providers/providerCache';
import {
  getOpenFoodFactsConfiguration,
  OPEN_FOOD_FACTS_DEFAULT_BASE_URL,
} from '@/lib/nutrition/providers/providerConfig';
import { requestProviderJson } from '@/lib/nutrition/providers/providerHttp';

const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'product_quantity',
  'nutriments',
  'nutrition_data_per',
  'ingredients_text',
  'allergens_tags',
  'traces_tags',
  'categories_tags',
  'countries_tags',
  'labels_tags',
  'data_quality_tags',
  'completeness',
  'last_modified_t',
].join(',');

const SEARCH_CACHE_TTL_MS = 30 * 60 * 1_000;
const PRODUCT_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const PRODUCT_MISS_TTL_MS = 5 * 60 * 1_000;

const optionalText = z.string().trim().min(1).nullable().optional();
const optionalStringArray = z.array(z.string()).nullable().optional().transform((value) => value ?? []);
const flexibleNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return Number(value);
  return value;
}, z.number().finite().nonnegative().nullable());

const productSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String).optional(),
  product_name: optionalText,
  product_name_en: optionalText,
  generic_name: optionalText,
  brands: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  quantity: optionalText,
  serving_size: optionalText,
  serving_quantity: flexibleNumber.optional().default(null),
  product_quantity: flexibleNumber.optional().default(null),
  nutriments: z.record(z.string(), z.unknown()).optional().default({}),
  nutrition_data_per: optionalText,
  ingredients_text: optionalText,
  allergens_tags: optionalStringArray,
  traces_tags: optionalStringArray,
  categories_tags: optionalStringArray,
  countries_tags: optionalStringArray,
  labels_tags: optionalStringArray,
  data_quality_tags: optionalStringArray,
  completeness: flexibleNumber.optional().default(null),
  last_modified_t: flexibleNumber.optional().default(null),
}).passthrough();

const productResponseSchema = z.object({
  status: z.union([z.literal('success'), z.literal(1)]).optional(),
  product: z.unknown().optional(),
}).passthrough();

const searchResponseSchema = z.object({
  count: flexibleNumber.optional().default(null),
  page: flexibleNumber.optional().default(null),
  page_count: flexibleNumber.optional().default(null),
  page_size: flexibleNumber.optional().default(null),
  products: z.array(z.unknown()).optional().default([]),
}).passthrough();

type OpenFoodFactsProduct = z.infer<typeof productSchema>;
export type OpenFoodFactsQuality = 'high' | 'medium' | 'low' | 'unusable';

function pickProductName(product: OpenFoodFactsProduct) {
  return product.product_name?.trim() || product.product_name_en?.trim() || product.generic_name?.trim() || null;
}

function pickBrand(product: OpenFoodFactsProduct) {
  const brands = Array.isArray(product.brands) ? product.brands : (product.brands ?? '').split(',');
  return brands.map((brand) => brand.trim()).find(Boolean) ?? null;
}

function nutrientValue(product: OpenFoodFactsProduct, key: string) {
  return toFiniteNonnegative(product.nutriments[key]);
}

function nutritionForBasis(product: OpenFoodFactsProduct, basis: 'serving' | '100g'): NutritionFacts | null {
  const suffix = basis === 'serving' ? '_serving' : '_100g';
  const kcal = nutrientValue(product, `energy-kcal${suffix}`);
  const kilojoules = nutrientValue(product, `energy-kj${suffix}`);
  const calories = kcal ?? (kilojoules === null ? null : kilojoules / 4.184);
  const protein = nutrientValue(product, `proteins${suffix}`);
  const carbs = nutrientValue(product, `carbohydrates${suffix}`);
  const fat = nutrientValue(product, `fat${suffix}`);
  if (calories === null || protein === null || carbs === null || fat === null) return null;

  const sodiumGrams = nutrientValue(product, `sodium${suffix}`);
  const saltGrams = nutrientValue(product, `salt${suffix}`);
  const sodium = (sodiumGrams ?? (saltGrams === null ? 0 : saltGrams / 2.5)) * 1_000;

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: nutrientValue(product, `fiber${suffix}`) ?? 0,
    sugar: nutrientValue(product, `sugars${suffix}`) ?? 0,
    sodium,
  };
}

function servingWeightGrams(product: OpenFoodFactsProduct) {
  const explicit = product.serving_quantity;
  if (explicit !== null && explicit !== undefined && explicit > 0 && explicit <= 5_000) return explicit;

  const serving = product.serving_size ?? '';
  const metric = serving.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/i);
  if (metric) return Number(metric[1]);
  const imperial = serving.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)\b/i);
  if (imperial) return Number(imperial[1]) * 28.3495;
  return null;
}

function naturalServing(product: OpenFoodFactsProduct, query: NormalizedFoodQuery | null) {
  const requested = normalizeServingUnit(query?.quantityUnit ?? query?.unitHint);
  if (isCountableServingUnit(requested)) return { quantity: 1, unit: requested as string };

  const text = normalizeProviderText(product.serving_size);
  const count = text.match(/^(\d+(?:\.\d+)?)\s+(bars?|bottles?|cans?|slices?|pieces?|cups?|scoops?|servings?)\b/);
  if (count) {
    return {
      quantity: Number(count[1]),
      unit: normalizeServingUnit(count[2]) ?? 'serving',
    };
  }
  return { quantity: 1, unit: 'serving' };
}

function hasQualityWarning(product: OpenFoodFactsProduct) {
  return product.data_quality_tags.some((tag) => /(?:nutrition.*(?:missing|incomplete|problem)|value.*(?:too|high|low)|product-name.*missing|brand.*missing)/i.test(tag));
}

export function assessOpenFoodFactsQuality(args: {
  product: OpenFoodFactsProduct;
  exactBarcode: boolean;
  hasServing: boolean;
  hasCompleteNutrition: boolean;
}) {
  const { product } = args;
  let score = args.exactBarcode ? 0.52 : 0.36;
  if (pickProductName(product)) score += 0.08;
  if (pickBrand(product)) score += 0.05;
  if (args.hasCompleteNutrition) score += 0.12;
  if (args.hasServing) score += 0.06;
  if (product.ingredients_text) score += 0.02;
  score += Math.min(product.completeness ?? 0, 1) * 0.05;
  if (hasQualityWarning(product)) score -= 0.22;
  if (product.last_modified_t && product.last_modified_t < Date.now() / 1_000 - 5 * 365 * 24 * 60 * 60) score -= 0.04;
  score = Math.max(0, Math.min(score, args.exactBarcode ? 0.94 : 0.82));

  const quality: OpenFoodFactsQuality = score >= 0.86
    ? 'high'
    : score >= 0.72
      ? 'medium'
      : score >= 0.58
        ? 'low'
        : 'unusable';
  return { score, quality };
}

function identityScore(product: OpenFoodFactsProduct, query: NormalizedFoodQuery) {
  const name = pickProductName(product);
  if (!name) return null;
  const brand = pickBrand(product);
  const candidateText = normalizeProviderText(`${brand ?? ''} ${name} ${product.generic_name ?? ''}`);
  const candidateTokens = providerTextTokens(candidateText);
  const queryTokens = providerTextTokens(query.searchText)
    .filter((token) => !['food', 'serving', 'one', 'two', 'the'].includes(token));

  if (query.brandHint) {
    const brandTokens = providerTextTokens(query.brandHint);
    if (!brandTokens.every((token) => providerTokenMatches(token, candidateTokens))) return null;
  }

  const matched = queryTokens.filter((token) => providerTokenMatches(token, candidateTokens));
  if (!queryTokens.length || matched.length / queryTokens.length < 0.66) return null;

  let score = matched.length * 14;
  const normalizedQuery = normalizeProviderText(query.searchText);
  if (candidateText === normalizedQuery) score += 40;
  else if (candidateText.includes(normalizedQuery) || normalizedQuery.includes(candidateText)) score += 24;
  if (query.brandHint) score += 28;
  return score;
}

function isSearchableTextQuery(query: NormalizedFoodQuery) {
  const normalized = normalizeProviderText(query.searchText);
  if (normalized.length < 2 || normalized.length > 120) return false;
  return /[a-z]/.test(normalized);
}

function productToCandidate(
  product: OpenFoodFactsProduct,
  options: { exactBarcode: boolean; query: NormalizedFoodQuery | null; barcode?: string | null },
): NormalizedProviderFood | null {
  const name = pickProductName(product);
  const code = normalizeBarcode(options.barcode ?? product.code ?? null);
  if (!name || !code) return null;

  const perServing = nutritionForBasis(product, 'serving');
  const per100g = nutritionForBasis(product, '100g');
  const weight = servingWeightGrams(product);
  const serving = naturalServing(product, options.query);
  let nutrition: NutritionFacts | null = null;
  let servingQuantity = serving.quantity;
  let servingUnit = serving.unit;
  let basis: 'serving' | 'per_100g' = 'serving';

  if (perServing && (product.serving_size || weight)) {
    nutrition = perServing;
  } else if (per100g && weight) {
    nutrition = scalePer100g(per100g, weight);
    basis = 'per_100g';
  } else if (per100g && !options.query) {
    nutrition = per100g;
    servingQuantity = 100;
    servingUnit = 'g';
    basis = 'per_100g';
  } else {
    return null;
  }

  const plausibility = validateNutritionFacts(nutrition, {
    basis: servingQuantity === 100 && servingUnit === 'g' ? 'per_100g' : 'serving',
    servingWeightGrams: weight,
  });
  if (!plausibility.valid) return null;

  const quality = assessOpenFoodFactsQuality({
    product,
    exactBarcode: options.exactBarcode,
    hasServing: Boolean(product.serving_size || weight),
    hasCompleteNutrition: Boolean(perServing || per100g),
  });
  if (quality.quality === 'unusable') return null;

  const brand = pickBrand(product);
  const servingDescription = product.serving_size
    ?? (servingQuantity === 100 && servingUnit === 'g' ? '100 g reference' : `${servingQuantity} ${servingUnit}`);
  const reviewNote = quality.quality === 'low'
    ? 'Community database match needs review because product completeness or serving metadata is limited.'
    : 'Community database match from Open Food Facts. Review the label and serving before saving.';

  return {
    providerId: 'open-food-facts',
    providerFoodId: code,
    name,
    brand,
    barcode: code,
    servingQuantity,
    servingUnit,
    servingWeightGrams: weight ?? (servingQuantity === 100 && servingUnit === 'g' ? 100 : null),
    servingDescription,
    nutrition,
    sourceName: 'Open Food Facts community database',
    confidence: quality.score,
    qualityLevel: quality.quality,
    isTrusted: true,
    confidenceLabel: quality.quality === 'low' ? 'Needs Review' : 'Matched',
    notes: `${reviewNote} Nutrition basis: ${basis}. Data: Open Food Facts (ODbL).`,
    exactBrandMatch: Boolean(options.query?.brandHint && brand),
  };
}

async function fetchProduct(barcode: string) {
  const normalized = normalizeBarcode(barcode);
  const config = getOpenFoodFactsConfiguration();
  if (!normalized || !config.configured) return null;

  const key = buildProviderCacheKey('open-food-facts:v3:product', normalized);
  const cached = await withProviderCache({
    key,
    ttlMs: PRODUCT_CACHE_TTL_MS,
    negativeTtlMs: PRODUCT_MISS_TTL_MS,
    load: async () => {
      const url = new URL(`${config.baseUrl}/api/v3/product/${encodeURIComponent(normalized)}`);
      url.searchParams.set('product_type', 'food');
      url.searchParams.set('cc', 'us');
      url.searchParams.set('lc', 'en');
      url.searchParams.set('fields', PRODUCT_FIELDS);
      const result = await requestProviderJson({
        url: url.toString(),
        allowedOrigins: [OPEN_FOOD_FACTS_DEFAULT_BASE_URL],
        init: { headers: { 'User-Agent': config.userAgent } },
        schema: productResponseSchema,
        timeoutMs: config.timeoutMs,
        notFoundIsNull: true,
      });
      if (!result?.data.product) return null;
      const parsed = productSchema.safeParse(result.data.product);
      return parsed.success ? parsed.data : null;
    },
  });
  return cached.value;
}

async function searchProducts(query: NormalizedFoodQuery) {
  const config = getOpenFoodFactsConfiguration();
  if (!config.configured || !isSearchableTextQuery(query)) return [];
  const searchText = query.searchText.slice(0, 120);
  const key = buildProviderCacheKey('open-food-facts:v1:packaged-search', {
    query: normalizeProviderText(searchText),
    brand: normalizeProviderText(query.brandHint),
    limit: 10,
  });
  const cached = await withProviderCache({
    key,
    ttlMs: SEARCH_CACHE_TTL_MS,
    load: async () => {
      // Open Food Facts has not released a current full-text search endpoint yet.
      // Keep the official legacy endpoint isolated and limited to submitted branded queries.
      const url = new URL(`${config.baseUrl}/cgi/search.pl`);
      url.searchParams.set('action', 'process');
      url.searchParams.set('search_simple', '1');
      url.searchParams.set('search_terms', searchText);
      url.searchParams.set('json', '1');
      url.searchParams.set('page_size', '10');
      url.searchParams.set('fields', PRODUCT_FIELDS);
      const result = await requestProviderJson({
        url: url.toString(),
        allowedOrigins: [OPEN_FOOD_FACTS_DEFAULT_BASE_URL],
        init: { headers: { 'User-Agent': config.userAgent } },
        schema: searchResponseSchema,
        timeoutMs: config.timeoutMs,
        retries: 0,
      });
      return (result?.data.products ?? [])
        .map((product) => productSchema.safeParse(product))
        .filter((product): product is { success: true; data: OpenFoodFactsProduct } => product.success)
        .map((product) => product.data);
    },
  });
  return cached.value ?? [];
}

export const openFoodFactsProvider: NutritionLookupProvider = {
  id: 'open-food-facts',
  capabilities: { search: true, barcode: true, details: true, suggest: false },
  getStatus() {
    const config = getOpenFoodFactsConfiguration();
    return {
      configured: config.configured,
      reason: config.configured ? undefined : `open_food_facts_${config.reason ?? 'not_configured'}`,
    };
  },
  async searchCandidates({ mealType, normalizedQuery, trace }) {
    const products = await searchProducts(normalizedQuery);
    return products
      .map((product) => ({ product, score: identityScore(product, normalizedQuery) }))
      .filter((entry): entry is { product: OpenFoodFactsProduct; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map((entry) => productToCandidate(entry.product, { exactBarcode: false, query: normalizedQuery }))
      .filter((entry): entry is NormalizedProviderFood => Boolean(entry))
      .map((candidate) => buildProviderMealResponse({ candidate, normalizedQuery, mealType, trace }))
      .filter((response): response is ParsedMealResponse => Boolean(response));
  },
  async lookup({ mealType, normalizedQuery, trace }) {
    const products = await searchProducts(normalizedQuery);
    const candidate = products
      .map((product) => ({ product, score: identityScore(product, normalizedQuery) }))
      .filter((entry): entry is { product: OpenFoodFactsProduct; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score)
      .map((entry) => productToCandidate(entry.product, { exactBarcode: false, query: normalizedQuery }))
      .find((entry): entry is NormalizedProviderFood => Boolean(entry));
    return candidate ? buildProviderMealResponse({ candidate, normalizedQuery, mealType, trace }) : null;
  },
  async lookupBarcode({ barcode, mealType }) {
    const product = await fetchProduct(barcode);
    const candidate = product ? productToCandidate(product, { exactBarcode: true, query: null, barcode }) : null;
    return candidate ? buildBarcodeMealResponse({ candidate, mealType }) : null;
  },
  async getFoodDetails({ providerFoodId, mealType }) {
    const product = await fetchProduct(providerFoodId);
    if (!product) return null;
    const name = pickProductName(product);
    if (!name) return null;
    const query: NormalizedFoodQuery = {
      rawText: name,
      normalizedText: name,
      searchText: name,
      matchedQuery: name,
      quantity: 1,
      quantityUnit: null,
      unitHint: null,
      brandHint: pickBrand(product),
      requestedModifiers: [],
    };
    const candidate = productToCandidate(product, { exactBarcode: true, query, barcode: providerFoodId });
    return candidate ? buildProviderMealResponse({ candidate, normalizedQuery: query, mealType }) : null;
  },
};

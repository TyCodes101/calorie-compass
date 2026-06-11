import OpenAI from 'openai';
import { z } from 'zod';

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import type { CustomFoodSummary } from '@/lib/custom-foods';
import type { FavoriteMealSummary } from '@/lib/reusable-meals';
import {
  getCatalogFoods,
  getNutritionSourceById,
  makeEstimatedItem,
  scaleCatalogFood,
  type CatalogFoodRecord,
} from '@/lib/nutrition/catalog';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import { commercialDatabaseProvider } from '@/lib/nutrition/providers/commercialDatabase';
import { localVerifiedCatalogProvider } from '@/lib/nutrition/providers/localVerifiedCatalog';
import { usdaProvider } from '@/lib/nutrition/providers/usda';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

export type FoodSearchSourceLabel =
  | 'Brand verified'
  | 'Restaurant verified'
  | 'USDA verified'
  | 'Custom'
  | 'Recent'
  | 'Favorite'
  | 'Estimated';

export type FoodSearchResult = {
  id: string;
  name: string;
  brand: string | null;
  restaurant: string | null;
  sourceLabel: FoodSearchSourceLabel;
  sourceType: ParsedFoodItem['source_type'] | null;
  sourceName: string | null;
  providerId: string | null;
  servingQuantity: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode: string | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  confidenceScore: number;
  estimated: boolean;
  needsReview: boolean;
  reason: string | null;
  sourceReusableMealId: string | null;
  items: ParsedFoodItem[];
};

export type FoodSearchCacheState = {
  resolverHit: boolean;
  rankingHit: boolean;
  selectedResultHit: boolean;
};

export type FoodSearchResponse = {
  query: string;
  normalizedQuery: string;
  results: FoodSearchResult[];
  clarificationQuestion: string | null;
  usedResolver: boolean;
  usedRanking: boolean;
  cache: FoodSearchCacheState;
};

const resolverOutputSchema = z.object({
  normalizedQuery: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  brandIntent: z.string().nullable().default(null),
  restaurantIntent: z.string().nullable().default(null),
  servingHint: z.string().nullable().default(null),
  amountHint: z.string().nullable().default(null),
  modifiers: z.array(z.string()).default([]),
  category: z.enum(['branded', 'restaurant', 'generic', 'homemade', 'unknown']).default('unknown'),
  confidence: z.number().min(0).max(1).default(0),
  needsDatabaseLookup: z.boolean().default(true),
  shouldAskClarification: z.boolean().default(false),
  clarificationQuestion: z.string().nullable().default(null),
});

export type FoodSearchResolverOutput = z.infer<typeof resolverOutputSchema>;

export type FoodSearchRankingInput = {
  originalQuery: string;
  resolver: FoodSearchResolverOutput | null;
  candidates: Array<{
    id: string;
    name: string;
    brand: string | null;
    restaurant: string | null;
    serving: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    source: string;
    providerConfidence: number;
  }>;
};

const rankingOutputSchema = z.object({
  orderedCandidateIds: z.array(z.string()).default([]),
  bestCandidateId: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
  reason: z.string().nullable().default(null),
  shouldAskClarification: z.boolean().default(false),
  clarificationQuestion: z.string().nullable().default(null),
});

export type FoodSearchRankingOutput = z.infer<typeof rankingOutputSchema>;

export type FoodSearchAiClient = {
  resolveQuery?: (input: { rawQuery: string }) => Promise<FoodSearchResolverOutput | null> | FoodSearchResolverOutput | null;
  rankCandidates?: (input: FoodSearchRankingInput) => Promise<FoodSearchRankingOutput | null> | FoodSearchRankingOutput | null;
};

type SearchCatalogFood = CatalogFoodRecord & {
  barcode?: string | null;
  barcodes?: string[];
};

type BuildFoodSearchResponseInput = {
  query: string;
  customFoods: CustomFoodSummary[];
  favoriteMeals: FavoriteMealSummary[];
  recentMeals: FavoriteMealSummary[];
  catalogFoods?: SearchCatalogFood[];
};

type BuildFoodSearchResponseOptions = {
  ai?: FoodSearchAiClient;
  providers?: NutritionLookupProvider[];
  catalogFoods?: SearchCatalogFood[];
};

const resolverCache = new Map<string, FoodSearchResolverOutput | null>();
const rankingCache = new Map<string, FoodSearchRankingOutput | null>();
const selectedResultCache = new Map<string, FoodSearchResult>();

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .replace(/\bflaming\b/g, 'flamin')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const queryStopTokens = new Set([
  'a',
  'an',
  'the',
  'of',
  'with',
  'and',
  'one',
  '1',
  'can',
  'cans',
  'bag',
  'bags',
  'serving',
  'servings',
  'food',
]);

function cacheKey(text: string) {
  return normalizeSearchText(text);
}

function tokens(text: string) {
  return normalizeSearchText(text)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !queryStopTokens.has(token));
}

function textMatches(query: string, value: string | null | undefined) {
  return searchScore(query, value) !== null;
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 2) return 3;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let lastDiagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const oldDiagonal = previous[j] ?? 0;
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      previous[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + 1,
        lastDiagonal + cost,
      );
      lastDiagonal = oldDiagonal;
    }
  }

  return previous[right.length] ?? 3;
}

function fuzzyTokenMatches(queryToken: string, valueToken: string) {
  if (queryToken === valueToken) return true;
  if (queryToken.length < 4 || valueToken.length < 4) return false;
  return editDistance(queryToken, valueToken) <= 1;
}

function searchScore(query: string, value: string | null | undefined) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedValue = normalizeSearchText(value ?? '');
  const queryTokens = tokens(query);
  const valueTokens = tokens(value ?? '');
  if (!queryTokens.length || !valueTokens.length) return null;

  if (normalizedQuery === normalizedValue) return 120;
  if (normalizedValue.includes(normalizedQuery) || normalizedQuery.includes(normalizedValue)) return 92;

  let score = 0;
  let matched = 0;
  for (const queryToken of queryTokens) {
    if (valueTokens.includes(queryToken)) {
      matched += 1;
      score += 18;
    } else if (valueTokens.some((valueToken) => fuzzyTokenMatches(queryToken, valueToken))) {
      matched += 1;
      score += 11;
    }
  }

  if (!matched) return null;
  const coverage = matched / queryTokens.length;
  const minimumCoverage = queryTokens.length <= 2 ? 1 : 0.66;
  return coverage >= minimumCoverage ? score + Math.round(coverage * 30) : null;
}

function catalogSearchScore(query: string, food: SearchCatalogFood) {
  const candidates = [food.canonicalName, food.brand ?? '', ...food.aliases];
  const score = Math.max(...candidates.map((candidate) => searchScore(query, candidate) ?? 0));
  return score > 0 ? score : null;
}

function isEstimatedItem(item: ParsedFoodItem) {
  return item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback === true || item.is_trusted === false;
}

function labelForTrustedItem(item: ParsedFoodItem, brand?: string | null): FoodSearchSourceLabel {
  const sourceName = item.source_name?.toLowerCase() ?? '';
  const provider = item.provider_used?.toLowerCase() ?? '';

  if (isEstimatedItem(item)) return 'Estimated';
  if (item.source_type === 'OFFICIAL_RESTAURANT') return 'Restaurant verified';
  if (provider.includes('usda') || sourceName.includes('usda') || (!brand && sourceName.includes('generic'))) return 'USDA verified';
  if (brand || item.source_type === 'GENERIC_REFERENCE' || sourceName) return 'Brand verified';
  return 'USDA verified';
}

function labelForItems(defaultLabel: FoodSearchSourceLabel, items: ParsedFoodItem[]): FoodSearchSourceLabel {
  if (items.some(isEstimatedItem)) return 'Estimated';
  return defaultLabel;
}

function firstItemSource(items: ParsedFoodItem[]) {
  const first = items[0];
  return {
    sourceType: first?.source_type ?? null,
    sourceName: first?.source_name ?? null,
    providerId: first?.provider_used ?? null,
  };
}

function inferRestaurant(resultName: string, item: ParsedFoodItem, explicit?: string | null) {
  if (explicit) return explicit;
  if (item.source_type !== 'OFFICIAL_RESTAURANT') return null;
  const sourceName = item.source_name ?? '';
  const officialIndex = sourceName.toLowerCase().indexOf(' official');
  if (officialIndex > 0) return sourceName.slice(0, officialIndex);
  return resultName.split(' ')[0] ?? null;
}

function roundedTotal(items: ParsedFoodItem[], key: 'calories' | 'protein' | 'carbs' | 'fat') {
  return Math.round(items.reduce((sum, item) => sum + Number(item[key] || 0), 0));
}

function hasStrongExactMatch(query: string, results: FoodSearchResult[]) {
  return results.some((result) => {
    if (result.estimated || result.needsReview) return false;
    const score = searchScore(query, `${result.name} ${result.brand ?? ''}`) ?? 0;
    return score >= 110 || normalizeSearchText(query) === normalizeSearchText(result.name);
  });
}

function dedupeResults(results: FoodSearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.sourceLabel}:${normalizeSearchText(result.name)}:${result.calories}:${result.servingQuantity}:${result.servingUnit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function catalogFoodToSearchResult(food: SearchCatalogFood): FoodSearchResult {
  const item = scaleCatalogFood(food, food.servingQuantity, food.servingUnit);
  const source = getNutritionSourceById(food.sourceId);
  const sourceLabel = labelForTrustedItem(item, food.brand ?? source?.brand ?? null);
  return {
    id: `catalog:${food.id}`,
    name: food.canonicalName,
    brand: food.brand ?? source?.brand ?? null,
    restaurant: item.source_type === 'OFFICIAL_RESTAURANT' ? food.brand ?? source?.brand ?? null : null,
    sourceLabel,
    sourceType: item.source_type ?? null,
    sourceName: item.source_name ?? source?.name ?? null,
    providerId: item.provider_used ?? (item.source_type === 'OFFICIAL_RESTAURANT' ? 'local-verified-catalog' : food.sourceId),
    servingQuantity: item.quantity,
    servingUnit: item.unit,
    calories: Math.round(item.calories),
    protein: Math.round(item.protein),
    carbs: Math.round(item.carbs),
    fat: Math.round(item.fat),
    barcode: food.barcode ?? food.barcodes?.[0] ?? null,
    mealType: 'snack',
    confidenceScore: 1,
    estimated: false,
    needsReview: false,
    reason: null,
    sourceReusableMealId: null,
    items: [item],
  };
}

export function customFoodToSearchResult(food: CustomFoodSummary): FoodSearchResult {
  const source = firstItemSource(food.items);
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    restaurant: null,
    sourceLabel: labelForItems('Custom', food.items),
    sourceType: source.sourceType,
    sourceName: source.sourceName,
    providerId: source.providerId,
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    barcode: food.barcode,
    mealType: 'snack',
    confidenceScore: 1,
    estimated: food.items.some(isEstimatedItem),
    needsReview: food.items.some(isEstimatedItem),
    reason: null,
    sourceReusableMealId: null,
    items: food.items,
  };
}

function reusableMealToSearchResult(meal: FavoriteMealSummary, label: FoodSearchSourceLabel): FoodSearchResult | null {
  if (!meal.items?.length) return null;
  const source = firstItemSource(meal.items);
  const estimated = meal.items.some(isEstimatedItem);
  return {
    id: `${label.toLowerCase()}:${meal.id}`,
    name: meal.title,
    brand: null,
    restaurant: null,
    sourceLabel: labelForItems(label, meal.items),
    sourceType: source.sourceType,
    sourceName: source.sourceName,
    providerId: source.providerId,
    servingQuantity: 1,
    servingUnit: 'meal',
    calories: meal.totalCalories,
    protein: Math.round(meal.totalProtein),
    carbs: Math.round(meal.items.reduce((sum, item) => sum + item.carbs, 0)),
    fat: Math.round(meal.items.reduce((sum, item) => sum + item.fat, 0)),
    barcode: null,
    mealType: meal.mealType,
    confidenceScore: meal.confidenceScore ?? 0.82,
    estimated,
    needsReview: estimated,
    reason: null,
    sourceReusableMealId: label === 'Favorite' ? meal.id : null,
    items: meal.items,
  };
}

export function buildFoodSearchResults({
  query,
  customFoods,
  favoriteMeals,
  recentMeals,
  catalogFoods,
}: {
  query: string;
  customFoods: CustomFoodSummary[];
  favoriteMeals: FavoriteMealSummary[];
  recentMeals: FavoriteMealSummary[];
  catalogFoods?: SearchCatalogFood[];
}) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const results: FoodSearchResult[] = [];
  const activeCatalogFoods = (catalogFoods ?? verifiedCatalogFoodsForLookup()).filter((food) => food.active !== false);
  results.push(
    ...activeCatalogFoods
      .map((food) => ({ food, score: catalogSearchScore(trimmed, food) }))
      .filter((candidate): candidate is { food: SearchCatalogFood; score: number } => candidate.score !== null)
      .sort((left, right) => right.score - left.score || left.food.canonicalName.localeCompare(right.food.canonicalName))
      .slice(0, 6)
      .map((candidate) => catalogFoodToSearchResult(candidate.food)),
  );

  results.push(
    ...customFoods
      .filter((food) => textMatches(trimmed, `${food.name} ${food.brand ?? ''}`))
      .map(customFoodToSearchResult),
  );

  results.push(
    ...favoriteMeals
      .filter((meal) => textMatches(trimmed, `${meal.title} ${meal.rawText ?? ''}`))
      .map((meal) => reusableMealToSearchResult(meal, 'Favorite'))
      .filter((result): result is FoodSearchResult => Boolean(result)),
  );

  results.push(
    ...recentMeals
      .filter((meal) => textMatches(trimmed, `${meal.title} ${meal.rawText ?? ''}`))
      .map((meal) => reusableMealToSearchResult(meal, 'Recent'))
      .filter((result): result is FoodSearchResult => Boolean(result)),
  );

  return dedupeResults(results).slice(0, 12);
}

export function verifiedCatalogFoodsForLookup() {
  return getCatalogFoods() as SearchCatalogFood[];
}

export function resetFoodSearchCaches() {
  resolverCache.clear();
  rankingCache.clear();
  selectedResultCache.clear();
}

function logFoodSearchDebug(message: string, metadata?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production' || process.env.FOOD_SEARCH_DEBUG !== '1') {
    return;
  }
  console.info('[food-search]', message, metadata ?? {});
}

async function defaultResolveQuery(input: { rawQuery: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_FOOD_SEARCH_MODEL ?? process.env.OPENAI_MEAL_MODEL ?? 'gpt-4.1-mini';
  logFoodSearchDebug('resolver invoked', { model });
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 700,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Resolve food search text into structured search intent only. Never provide nutrition facts. Return JSON with normalizedQuery, aliases, brandIntent, restaurantIntent, servingHint, amountHint, modifiers, category, confidence, needsDatabaseLookup, shouldAskClarification, clarificationQuestion.',
      },
      {
        role: 'user',
        content: JSON.stringify({ rawQuery: input.rawQuery }),
      },
    ],
  });

  const parsed = resolverOutputSchema.safeParse(JSON.parse(completion.choices[0]?.message?.content ?? '{}'));
  return parsed.success ? parsed.data : null;
}

async function defaultRankCandidates(input: FoodSearchRankingInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_FOOD_SEARCH_MODEL ?? process.env.OPENAI_MEAL_MODEL ?? 'gpt-4.1-mini';
  logFoodSearchDebug('ranking invoked', { model, candidateCount: input.candidates.length });
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 700,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Rank food search candidates for the user query. You may reorder candidates, add a reason, or ask one clarification. Never change nutrition, source labels, or candidate IDs. Return JSON with orderedCandidateIds, bestCandidateId, confidence, reason, shouldAskClarification, clarificationQuestion.',
      },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ],
  });

  const parsed = rankingOutputSchema.safeParse(JSON.parse(completion.choices[0]?.message?.content ?? '{}'));
  return parsed.success ? parsed.data : null;
}

async function resolveWithCache(rawQuery: string, ai: FoodSearchAiClient | undefined, cache: FoodSearchCacheState) {
  const key = cacheKey(rawQuery);
  if (resolverCache.has(key)) {
    cache.resolverHit = true;
    logFoodSearchDebug('resolver cache hit');
    return resolverCache.get(key) ?? null;
  }

  logFoodSearchDebug('resolver cache miss');
  const resolver = ai?.resolveQuery ?? defaultResolveQuery;
  try {
    const output = await resolver({ rawQuery });
    const parsed = resolverOutputSchema.safeParse(output);
    const resolved = parsed.success ? parsed.data : null;
    resolverCache.set(key, resolved);
    return resolved;
  } catch {
    resolverCache.set(key, null);
    return null;
  }
}

function searchQueries(originalQuery: string, resolver: FoodSearchResolverOutput | null) {
  const values = [
    originalQuery,
    resolver?.normalizedQuery,
    ...(resolver?.aliases ?? []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length >= 2));

  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeSearchText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function providerResultToSearchResult(
  response: ParsedMealResponse,
  providerId: string,
  matchedQuery: string,
  resolver: FoodSearchResolverOutput | null,
): FoodSearchResult | null {
  if (response.needs_clarification || !response.items.length) return null;

  const items = response.items;
  const first = items[0];
  if (!first) return null;

  const name = items.length === 1 ? first.food_name : matchedQuery;
  const estimated = items.some(isEstimatedItem);
  const sourceLabel = estimated ? 'Estimated' : labelForTrustedItem(first, resolver?.brandIntent ?? null);
  const sourceName = first.source_name ?? null;
  const servingQuantity = items.length === 1 ? first.quantity : 1;
  const servingUnit = items.length === 1 ? first.unit : 'meal';
  const calories = roundedTotal(items, 'calories');
  const restaurant = inferRestaurant(name, first, resolver?.restaurantIntent ?? null);
  const brand = restaurant ? null : resolver?.brandIntent ?? null;

  return {
    id: `provider:${first.provider_used ?? providerId}:${normalizeSearchText(name)}:${calories}:${normalizeSearchText(servingUnit)}`,
    name,
    brand,
    restaurant,
    sourceLabel,
    sourceType: first.source_type ?? null,
    sourceName,
    providerId: first.provider_used ?? providerId,
    servingQuantity,
    servingUnit,
    calories,
    protein: roundedTotal(items, 'protein'),
    carbs: roundedTotal(items, 'carbs'),
    fat: roundedTotal(items, 'fat'),
    barcode: null,
    mealType: response.meal_type,
    confidenceScore: response.confidence_score,
    estimated,
    needsReview: estimated || response.confidence_score < 0.72 || items.some((item) => item.confidence_label === 'Needs Review'),
    reason: null,
    sourceReusableMealId: null,
    items,
  };
}

async function searchProviders(
  queries: string[],
  providers: NutritionLookupProvider[],
  resolver: FoodSearchResolverOutput | null,
) {
  const results: FoodSearchResult[] = [];

  for (const query of queries) {
    const normalizedQuery = normalizeFoodQuery(query);
    for (const provider of providers) {
      try {
        const response = await provider.lookup({
          text: query,
          mealType: 'snack',
          normalizedQuery,
        });
        const result = response ? providerResultToSearchResult(response, provider.id, query, resolver) : null;
        if (result) {
          results.push(result);
        }
      } catch {
        // Search should fail soft when any provider is unavailable.
      }
    }
  }

  return dedupeResults(results);
}

function needsRanking(query: string, resolver: FoodSearchResolverOutput | null, candidates: FoodSearchResult[]) {
  if (candidates.length < 2) return false;
  if (resolver?.category === 'restaurant' || resolver?.category === 'branded') return true;
  if (resolver?.modifiers.length || resolver?.servingHint || resolver?.amountHint) return true;
  if (tokens(query).some((token) => candidates.every((candidate) => !normalizeSearchText(candidate.name).includes(token)))) return true;
  return candidates.some((candidate) => candidate.confidenceScore < 0.86);
}

function rankingSignature(normalizedQuery: string, candidates: FoodSearchResult[]) {
  return `${normalizeSearchText(normalizedQuery)}::${candidates
    .map((candidate) => `${candidate.id}:${candidate.calories}:${candidate.protein}:${candidate.carbs}:${candidate.fat}`)
    .sort()
    .join('|')}`;
}

async function rankWithCache(
  originalQuery: string,
  resolver: FoodSearchResolverOutput | null,
  candidates: FoodSearchResult[],
  ai: FoodSearchAiClient | undefined,
  cache: FoodSearchCacheState,
) {
  const normalizedQuery = resolver?.normalizedQuery ?? originalQuery;
  const key = rankingSignature(normalizedQuery, candidates);
  if (rankingCache.has(key)) {
    cache.rankingHit = true;
    logFoodSearchDebug('ranking cache hit');
    return rankingCache.get(key) ?? null;
  }

  logFoodSearchDebug('ranking cache miss');
  const ranker = ai?.rankCandidates ?? defaultRankCandidates;
  const input: FoodSearchRankingInput = {
    originalQuery,
    resolver,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      brand: candidate.brand,
      restaurant: candidate.restaurant,
      serving: `${candidate.servingQuantity} ${candidate.servingUnit}`.trim(),
      calories: candidate.calories,
      protein: candidate.protein,
      carbs: candidate.carbs,
      fat: candidate.fat,
      source: candidate.sourceLabel,
      providerConfidence: candidate.confidenceScore,
    })),
  };

  try {
    const output = await ranker(input);
    const parsed = rankingOutputSchema.safeParse(output);
    const ranking = parsed.success ? parsed.data : null;
    rankingCache.set(key, ranking);
    return ranking;
  } catch {
    rankingCache.set(key, null);
    return null;
  }
}

function applyRanking(candidates: FoodSearchResult[], ranking: FoodSearchRankingOutput | null) {
  if (!ranking?.orderedCandidateIds.length) {
    return candidates;
  }

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ranked = ranking.orderedCandidateIds
    .map((id) => byId.get(id))
    .filter((candidate): candidate is FoodSearchResult => Boolean(candidate))
    .map((candidate, index) => ({
      ...candidate,
      reason: index === 0 ? ranking.reason ?? candidate.reason : candidate.reason,
      confidenceScore: index === 0 && ranking.confidence > 0 ? Math.max(candidate.confidenceScore, ranking.confidence) : candidate.confidenceScore,
    }));
  const rankedIds = new Set(ranked.map((candidate) => candidate.id));
  return [...ranked, ...candidates.filter((candidate) => !rankedIds.has(candidate.id))];
}

function canUseSelectedResultCache(result: FoodSearchResult) {
  return !result.estimated
    && !result.needsReview
    && result.confidenceScore >= 0.95
    && !result.id.startsWith('custom')
    && !result.id.startsWith('favorite:')
    && !result.id.startsWith('recent:');
}

function cacheSafeSelectedResult(query: string, results: FoodSearchResult[]) {
  if (results.length !== 1 || !canUseSelectedResultCache(results[0])) return;
  selectedResultCache.set(cacheKey(query), results[0]);
}

function buildEstimatedFallback(query: string, resolver: FoodSearchResolverOutput | null): FoodSearchResult | null {
  if (!resolver || resolver.shouldAskClarification) return null;
  if (resolver.category === 'unknown' && resolver.confidence < 0.65) return null;

  const normalized = resolver.normalizedQuery || query;
  const item = makeEstimatedItem(
    normalized,
    1,
    resolver.category === 'homemade' ? 'meal' : resolver.servingHint ?? 'serving',
    resolver.category === 'homemade'
      ? { calories: 520, protein: 36, carbs: 55, fat: 14, fiber: 6, sugar: 5, sodium: 650 }
      : { calories: 240, protein: 8, carbs: 28, fat: 10, fiber: 2, sugar: 3, sodium: 360 },
    'No verified provider match was found. Review this estimate before saving.',
  );

  return {
    id: `estimate:${normalizeSearchText(normalized)}`,
    name: normalized,
    brand: resolver.brandIntent,
    restaurant: resolver.restaurantIntent,
    sourceLabel: 'Estimated',
    sourceType: 'AI_ESTIMATE',
    sourceName: item.source_name ?? 'Fallback estimate',
    providerId: 'ai-estimate-fallback',
    servingQuantity: item.quantity,
    servingUnit: item.unit,
    calories: Math.round(item.calories),
    protein: Math.round(item.protein),
    carbs: Math.round(item.carbs),
    fat: Math.round(item.fat),
    barcode: null,
    mealType: 'snack',
    confidenceScore: Math.min(Math.max(resolver.confidence, 0.42), 0.68),
    estimated: true,
    needsReview: true,
    reason: 'No verified provider match found.',
    sourceReusableMealId: null,
    items: [item],
  };
}

function localResultsForQueries(input: BuildFoodSearchResponseInput, queries: string[], catalogFoods?: SearchCatalogFood[]) {
  return dedupeResults(queries.flatMap((query) => buildFoodSearchResults({
    query,
    customFoods: input.customFoods,
    favoriteMeals: input.favoriteMeals,
    recentMeals: input.recentMeals,
    catalogFoods: catalogFoods ?? input.catalogFoods,
  })));
}

export async function buildFoodSearchResponse(
  input: BuildFoodSearchResponseInput,
  options?: BuildFoodSearchResponseOptions,
): Promise<FoodSearchResponse> {
  const query = input.query.trim();
  const cache: FoodSearchCacheState = {
    resolverHit: false,
    rankingHit: false,
    selectedResultHit: false,
  };

  if (query.length < 2) {
    return {
      query,
      normalizedQuery: query,
      results: [],
      clarificationQuestion: null,
      usedResolver: false,
      usedRanking: false,
      cache,
    };
  }

  const originalLocalResults = buildFoodSearchResults({
    query,
    customFoods: input.customFoods,
    favoriteMeals: input.favoriteMeals,
    recentMeals: input.recentMeals,
    catalogFoods: options?.catalogFoods ?? input.catalogFoods,
  });

  if (hasStrongExactMatch(query, originalLocalResults)) {
    const results = originalLocalResults.slice(0, 10);
    cacheSafeSelectedResult(query, results);
    return {
      query,
      normalizedQuery: query,
      results,
      clarificationQuestion: null,
      usedResolver: false,
      usedRanking: false,
      cache,
    };
  }

  const selectedResult = selectedResultCache.get(cacheKey(query));
  if (selectedResult) {
    cache.selectedResultHit = true;
    return {
      query,
      normalizedQuery: query,
      results: [selectedResult],
      clarificationQuestion: null,
      usedResolver: false,
      usedRanking: false,
      cache,
    };
  }

  const resolver = await resolveWithCache(query, options?.ai, cache);
  const usedResolver = Boolean(resolver);
  const queries = searchQueries(query, resolver);
  const localResults = localResultsForQueries(input, queries, options?.catalogFoods);
  const providers = options?.providers ?? [localVerifiedCatalogProvider, usdaProvider, commercialDatabaseProvider];
  const providerResults = await searchProviders(queries, providers, resolver);
  let results = dedupeResults([...localResults, ...providerResults]).slice(0, 12);

  let ranking: FoodSearchRankingOutput | null = null;
  let usedRanking = false;
  if (needsRanking(query, resolver, results)) {
    ranking = await rankWithCache(query, resolver, results, options?.ai, cache);
    usedRanking = Boolean(ranking);
    if (ranking?.shouldAskClarification && ranking.clarificationQuestion) {
      return {
        query,
        normalizedQuery: resolver?.normalizedQuery ?? query,
        results,
        clarificationQuestion: ranking.clarificationQuestion,
        usedResolver,
        usedRanking,
        cache,
      };
    }
    results = applyRanking(results, ranking).slice(0, 10);
  } else {
    results = results.slice(0, 10);
  }

  if (!results.length && resolver?.shouldAskClarification && resolver.clarificationQuestion) {
    return {
      query,
      normalizedQuery: resolver.normalizedQuery,
      results: [],
      clarificationQuestion: resolver.clarificationQuestion,
      usedResolver,
      usedRanking,
      cache,
    };
  }

  if (!results.length) {
    const estimated = buildEstimatedFallback(query, resolver);
    results = estimated ? [estimated] : [];
  }

  cacheSafeSelectedResult(query, results);

  return {
    query,
    normalizedQuery: resolver?.normalizedQuery ?? query,
    results,
    clarificationQuestion: null,
    usedResolver,
    usedRanking,
    cache,
  };
}

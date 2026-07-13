import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { NormalizedFoodQuery, NutritionLookupInput } from '@/lib/nutrition/types';
import { normalizeNutritionVerificationLabel } from '@/lib/nutrition/verification';

export type NutritionIntent = {
  brandIntent: string | null;
  restaurantIntent: string | null;
  searchText: string;
  quantity: number;
  servingUnit: string | null;
  ambiguousTerm: string | null;
  wantsDietSoda: boolean;
  wantsProteinProduct: boolean;
  wantsCandy: boolean;
  expectedCategory: 'protein_bar' | 'protein_drink' | 'kombucha' | 'popcorn' | 'restaurant_burger' | 'generic' | null;
};

type CandidateResult = {
  providerId: string;
  response: ParsedMealResponse;
};

type ValidationResult = {
  valid: boolean;
  score: number;
  reasons: string[];
};

type ResolutionResult = {
  response: ParsedMealResponse | null;
  clarificationQuestion: string | null;
  providerId?: string | null;
};

const restaurantBrands = new Set([
  "Arby's",
  'Burger King',
  "Cane's",
  'CAVA',
  'Chick-fil-A',
  'Chipotle',
  "Domino's",
  "Dunkin'",
  'Five Guys',
  "Jersey Mike's",
  'KFC',
  "McDonald's",
  'Panera',
  'Panda Express',
  'Pizza Hut',
  'Popeyes',
  'Starbucks',
  'Subway',
  'Taco Bell',
  "Wendy's",
  'White Castle',
]);

const inferredRestaurantItems: Array<{ pattern: RegExp; restaurant: string }> = [
  { pattern: /\barby'?s?\b|\barbys\b|\barby\b/, restaurant: "Arby's" },
  { pattern: /\bmcdouble\b|\bbig mac\b|\bmcchicken\b/, restaurant: "McDonald's" },
  { pattern: /\bchipotle\b.*\bbowl\b|\bchipotle bowl\b/, restaurant: 'Chipotle' },
  { pattern: /\bsubway\b|\bfootlong\b/, restaurant: 'Subway' },
  { pattern: /\bwhite castle\b|\bslider\b/, restaurant: 'White Castle' },
];

const ambiguousFoodTerms = [
  'chips',
  'shake',
  'protein shake',
  'salad',
  'bowl',
  'sandwich',
  'fries',
] as const;

function normalizeComparableText(text: string | null | undefined) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string | null | undefined) {
  return normalizeComparableText(text)
    .split(' ')
    .filter((token) => token.length > 1);
}

function itemHaystack(item: ParsedFoodItem) {
  return normalizeComparableText([
    item.food_name,
    item.source_name,
    item.notes,
    item.matched_query,
    item.original_user_text,
  ].filter(Boolean).join(' '));
}

function brandTokens(brand: string) {
  const normalized = normalizeComparableText(brand);
  if (normalized === 'mcdonald s') return ['mcdonald'];
  if (normalized === 'wendy s') return ['wendy'];
  if (normalized === 'chick fil a') return ['chick', 'fil'];
  if (normalized === 'arby s') return ['arby'];
  if (normalized === 'coca cola') return ['coca', 'cola'];
  return tokens(normalized);
}

function textContainsBrand(text: string, brand: string) {
  const haystack = normalizeComparableText(text);
  return brandTokens(brand).every((token) => haystack.includes(token));
}

function responseContainsBrand(response: ParsedMealResponse, brand: string) {
  return response.items.some((item) => textContainsBrand(itemHaystack(item), brand));
}

function detectRestaurantIntent(text: string, brandHint: string | null) {
  if (brandHint && restaurantBrands.has(brandHint)) {
    return brandHint;
  }

  const normalized = normalizeComparableText(text);
  return inferredRestaurantItems.find((entry) => entry.pattern.test(normalized))?.restaurant ?? null;
}

function detectAmbiguousTerm(text: string, intent: Pick<NutritionIntent, 'brandIntent' | 'restaurantIntent'>) {
  if (intent.brandIntent || intent.restaurantIntent) {
    return null;
  }

  const normalized = normalizeComparableText(text);
  const compact = normalized.replace(/\b(i|had|ate|drank|log|add|track|please|a|an|one|the|some|for|was|lunch|dinner|snack|breakfast)\b/g, ' ').replace(/\s+/g, ' ').trim();

  return ambiguousFoodTerms.find((term) => compact === term || compact === `${term}s`) ?? null;
}

function titleCase(text: string) {
  return normalizeComparableText(text)
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildNutritionIntent(input: NutritionLookupInput, normalizedQuery: NormalizedFoodQuery): NutritionIntent {
  const combined = `${input.text} ${normalizedQuery.searchText} ${normalizedQuery.matchedQuery}`;
  const restaurantIntent = detectRestaurantIntent(combined, normalizedQuery.brandHint);
  const brandIntent = normalizedQuery.brandHint && !restaurantBrands.has(normalizedQuery.brandHint)
    ? normalizedQuery.brandHint
    : restaurantIntent;
  const normalized = normalizeComparableText(combined);
  const partialIntent = { brandIntent, restaurantIntent };
  const expectedCategory = /\bprotein\s+bars?\b/.test(normalized)
    ? 'protein_bar'
    : /\bkombucha\b/.test(normalized)
      ? 'kombucha'
      : /\b(?:protein\s+shake|protein\s+drink)\b/.test(normalized)
        ? 'protein_drink'
        : /\bpopcorn\b/.test(normalized)
          ? 'popcorn'
          : /\b(?:burger|cheeseburger|butterburger|baconator|mcdouble|whopper)\b/.test(normalized)
            ? 'restaurant_burger'
            : null;

  return {
    brandIntent,
    restaurantIntent,
    searchText: normalizedQuery.searchText,
    quantity: normalizedQuery.quantity,
    servingUnit: normalizedQuery.quantityUnit ?? normalizedQuery.unitHint,
    ambiguousTerm: detectAmbiguousTerm(input.text, partialIntent),
    wantsDietSoda: /\b(?:zero|diet|sugar free|no sugar)\b/.test(normalized) && /\b(?:coke|cola|soda|dr pepper|gatorade)\b/.test(normalized),
    wantsProteinProduct: /\b(?:protein|shake|core power|fairlife|quest|premier|muscle milk|barebells)\b/.test(normalized),
    wantsCandy: /\b(?:skittles?|snickers?|m\s*m|mms?|candy|candies)\b/.test(normalized),
    expectedCategory,
  };
}

export function shouldClarifyBeforeLookup(intent: NutritionIntent) {
  return Boolean(intent.ambiguousTerm);
}

function macroCalories(item: ParsedFoodItem) {
  return Number(item.protein || 0) * 4 + Number(item.carbs || 0) * 4 + Number(item.fat || 0) * 9;
}

function caloriesAlignWithMacros(item: ParsedFoodItem) {
  const calories = Number(item.calories || 0);
  if (!Number.isFinite(calories) || calories < 0) {
    return false;
  }

  if (calories === 0) {
    return macroCalories(item) <= 15;
  }

  const difference = Math.abs(calories - macroCalories(item));
  return difference <= Math.max(50, calories * 0.2);
}

function servingLooksPossible(item: ParsedFoodItem) {
  const quantity = Number(item.quantity);
  const unit = String(item.unit ?? '').trim();
  return Number.isFinite(quantity) && quantity > 0 && Boolean(unit);
}

function itemMatchesBrandOrRestaurant(item: ParsedFoodItem, intent: NutritionIntent) {
  const protectedName = intent.restaurantIntent ?? intent.brandIntent;
  if (!protectedName) {
    return true;
  }

  return textContainsBrand(itemHaystack(item), protectedName);
}

function itemMatchesDietSodaIntent(item: ParsedFoodItem, intent: NutritionIntent) {
  if (!intent.wantsDietSoda) {
    return true;
  }

  return Number(item.calories || 0) <= 20 && Number(item.sugar || 0) <= 5 && !/\bclassic|regular\b/i.test(item.food_name);
}

function itemMatchesProteinIntent(item: ParsedFoodItem, intent: NutritionIntent) {
  if (!intent.wantsProteinProduct) {
    return true;
  }

  const haystack = itemHaystack(item);
  if (/\b(?:milk|whole milk|skim milk)\b/.test(haystack) && /\bprotein\s+shake\b/.test(normalizeComparableText(intent.searchText))) {
    return false;
  }

  return Number(item.protein || 0) >= 10;
}

function itemMatchesCandyIntent(item: ParsedFoodItem, intent: NutritionIntent) {
  if (!intent.wantsCandy) {
    return true;
  }

  return Number(item.protein || 0) <= 10;
}

function categoryPlausibilityIssues(item: ParsedFoodItem, intent: NutritionIntent) {
  const calories = Number(item.calories || 0);
  const quantity = Number(item.quantity || 0);
  const unit = normalizeComparableText(item.unit);
  const requestedUnit = normalizeComparableText(intent.servingUnit);
  const weightUnits = new Set(['g', 'gram', 'grams', 'oz', 'ounce', 'ounces']);
  const countableUnits = new Set(['bar', 'bottle', 'can', 'serving', 'bag', 'burger', 'sandwich', 'bowl', 'slice', 'piece']);
  const issues: string[] = [];

  if (![calories, quantity, item.protein, item.carbs, item.fat].every(Number.isFinite)) {
    issues.push('non_finite_nutrients');
  }
  if ([item.calories, item.protein, item.carbs, item.fat].some((value) => Number(value ?? 0) < 0)) {
    issues.push('negative_nutrients');
  }
  if (requestedUnit && countableUnits.has(requestedUnit) && weightUnits.has(unit)) {
    issues.push('serving_unit_mismatch');
  }
  if (intent.expectedCategory === 'protein_bar' && ['bar', 'serving', 'piece'].includes(unit) && quantity <= 2 && calories > 450) {
    issues.push('category_calorie_outlier');
  }
  if (intent.expectedCategory === 'kombucha' && ['bottle', 'serving'].includes(unit) && quantity <= 4 && calories > 300) {
    issues.push('category_calorie_outlier');
  }
  if (intent.expectedCategory === 'popcorn' && ['bag', 'serving'].includes(unit) && quantity <= 4 && calories > 900) {
    issues.push('category_calorie_outlier');
  }
  if (intent.expectedCategory === 'restaurant_burger' && unit === 'burger' && quantity <= 2 && calories > 1800) {
    issues.push('category_calorie_outlier');
  }
  if (countableUnits.has(unit) && quantity > 20) {
    issues.push('quantity_scale_suspicious');
  }

  return issues;
}

function validateItem(item: ParsedFoodItem, intent: NutritionIntent) {
  const reasons: string[] = [];

  if (!servingLooksPossible(item)) reasons.push('missing_serving');
  if (!caloriesAlignWithMacros(item)) reasons.push('macro_calorie_mismatch');
  if (!itemMatchesBrandOrRestaurant(item, intent)) reasons.push('brand_or_restaurant_mismatch');
  if (!itemMatchesDietSodaIntent(item, intent)) reasons.push('diet_soda_mismatch');
  if (!itemMatchesProteinIntent(item, intent)) reasons.push('protein_product_mismatch');
  if (!itemMatchesCandyIntent(item, intent)) reasons.push('candy_mismatch');
  reasons.push(...categoryPlausibilityIssues(item, intent));

  return [...new Set(reasons)];
}

function validationScore(response: ParsedMealResponse, intent: NutritionIntent, providerId: string) {
  let score = response.confidence_score * 100;
  const joinedItems = response.items.map(itemHaystack).join(' ');

  if (providerId.includes('local')) score += 12;
  if (providerId === 'usda-fdc') score += 8;
  if (providerId === 'fatsecret') score += 6;
  if (providerId === 'calorie-api') score += 3;
  if (providerId === 'open-food-facts') score -= 4;
  if (response.items.some((item) => item.source_type === 'OFFICIAL_RESTAURANT')) score += 24;
  if (response.items.some((item) => item.match_type === 'exact_branded' || item.match_type === 'exact_restaurant')) score += 22;
  if (response.items.some((item) => item.is_trusted)) score += 10;
  if (intent.brandIntent && responseContainsBrand(response, intent.brandIntent)) score += 28;
  if (intent.restaurantIntent && responseContainsBrand(response, intent.restaurantIntent)) score += 32;
  if (/generic nutrition reference/.test(joinedItems) && (intent.brandIntent || intent.restaurantIntent)) score -= 80;
  if (response.items.some((item) => normalizeNutritionVerificationLabel(item.confidence_label, item) === 'Verified')) score += 8;

  return score;
}

function validateCandidate(candidate: CandidateResult, intent: NutritionIntent): ValidationResult {
  if (candidate.response.needs_clarification) {
    return { valid: false, score: 0, reasons: ['provider_needs_clarification'] };
  }

  if (!candidate.response.items.length) {
    return { valid: false, score: 0, reasons: ['no_items'] };
  }

  const reasons = candidate.response.items.flatMap((item) => validateItem(item, intent));
  return {
    valid: reasons.length === 0,
    score: validationScore(candidate.response, intent, candidate.providerId),
    reasons,
  };
}

export function withVerificationLabels(response: ParsedMealResponse): ParsedMealResponse {
  return normalizeParsedMealResponse({
    ...response,
    items: response.items.map((item) => ({
      ...item,
      confidence_label: normalizeNutritionVerificationLabel(item.confidence_label, item),
    })),
  });
}

export function buildAccuracyClarificationQuestion(intent: NutritionIntent, fallback = 'Which exact item and serving size should I use?') {
  if (intent.ambiguousTerm) {
    if (intent.ambiguousTerm === 'protein shake') return 'Which protein shake was it? Brand or bottle size is enough.';
    if (intent.ambiguousTerm === 'shake') return 'Which shake was it? Brand, restaurant, or bottle size is enough.';
    if (intent.ambiguousTerm === 'fries') return 'Which restaurant or serving size were the fries?';
    if (intent.ambiguousTerm === 'bowl') return 'Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate.';
    if (intent.ambiguousTerm === 'salad') return 'What was in the salad, and about how much dressing or toppings did it have?';
    if (intent.ambiguousTerm === 'sandwich') return 'What kind of sandwich was it, and what size or main ingredients should I use?';
    return 'Which chips did you mean, and about how much did you have?';
  }

  if (intent.wantsDietSoda) {
    return `I could not validate a ${titleCase(intent.searchText)} match. Which exact product and serving should I use?`;
  }

  if (intent.restaurantIntent) {
    return `I could not validate a ${intent.restaurantIntent} nutrition match. Which exact item and serving should I use?`;
  }

  if (intent.brandIntent) {
    return `I could not validate a ${intent.brandIntent} match. Which exact item and serving should I use?`;
  }

  return fallback;
}

function responsesShareIdentity(left: ParsedMealResponse, right: ParsedMealResponse) {
  if (left.items.length !== 1 || right.items.length !== 1) return false;
  const leftTokens = new Set(tokens(left.items[0]?.food_name));
  const rightTokens = new Set(tokens(right.items[0]?.food_name));
  if (!leftTokens.size || !rightTokens.size) return false;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size) >= 0.75;
}

function valuesMateriallyConflict(left: number, right: number) {
  const maximum = Math.max(Math.abs(left), Math.abs(right));
  if (maximum < 1) return false;
  return Math.abs(left - right) / maximum > 0.35;
}

export function nutritionCandidatesConflict(left: ParsedMealResponse, right: ParsedMealResponse) {
  if (!responsesShareIdentity(left, right)) return false;
  const leftItem = left.items[0];
  const rightItem = right.items[0];
  if (!leftItem || !rightItem) return false;
  return valuesMateriallyConflict(leftItem.calories, rightItem.calories)
    || valuesMateriallyConflict(leftItem.protein, rightItem.protein)
    || valuesMateriallyConflict(leftItem.carbs, rightItem.carbs)
    || valuesMateriallyConflict(leftItem.fat, rightItem.fat);
}

export function resolveBestNutritionCandidate(intent: NutritionIntent, candidates: CandidateResult[]): ResolutionResult {
  const validations = candidates.map((candidate) => ({
    candidate,
    validation: validateCandidate(candidate, intent),
  }));
  const validCandidates = validations
    .filter((entry) => entry.validation.valid)
    .sort((left, right) => right.validation.score - left.validation.score);

  if (
    validCandidates[0]
    && validCandidates[1]
    && !validCandidates[0].candidate.providerId.includes('local')
    && nutritionCandidatesConflict(
      validCandidates[0].candidate.response,
      validCandidates[1].candidate.response,
    )
  ) {
    return {
      response: null,
      clarificationQuestion: 'I found conflicting nutrition records for this product. Which serving or package label should I use?',
      providerId: null,
    };
  }

  if (validCandidates[0]) {
    return {
      response: withVerificationLabels(validCandidates[0].candidate.response),
      clarificationQuestion: null,
      providerId: validCandidates[0].candidate.providerId,
    };
  }

  const sawInvalidCandidate = validations.some((entry) => entry.validation.reasons.length > 0);
  if (sawInvalidCandidate || intent.brandIntent || intent.restaurantIntent || intent.ambiguousTerm) {
    const reasons = validations.flatMap((entry) => entry.validation.reasons);
    const fallback = reasons.some((reason) => reason.includes('macro') || reason.includes('protein'))
      ? 'I found possible nutrition data, but the serving or macros do not look right. Which exact item and serving should I use?'
      : undefined;

    return {
      response: null,
      clarificationQuestion: buildAccuracyClarificationQuestion(intent, fallback),
      providerId: null,
    };
  }

  return { response: null, clarificationQuestion: null, providerId: null };
}

export function isAuthoritativeNutritionResult(response: ParsedMealResponse, intent: NutritionIntent, providerId: string) {
  const validation = validateCandidate({ providerId, response }, intent);
  if (!validation.valid) {
    return false;
  }

  return response.items.some((item) => (
    item.source_type === 'OFFICIAL_RESTAURANT' ||
    item.match_type === 'exact_branded' ||
    item.match_type === 'exact_restaurant'
  ));
}

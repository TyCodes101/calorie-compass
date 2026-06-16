import type { ParsedFoodItem } from '@/lib/ai/types';

export type FoodNameFields = {
  display_name: string;
  canonical_name: string;
  source_food_name: string;
};

const lowerCaseDisplayWords = new Set(['a', 'an', 'and', 'as', 'at', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
const preparationTokens = new Set(['baked', 'boiled', 'breaded', 'broiled', 'buttered', 'fried', 'grilled', 'roasted', 'sauteed', 'steamed']);

function normalizeFoodText(text: string) {
  return text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseFood(text: string, options: { keepSmallWordsLower?: boolean } = {}) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((word, index) => {
    const lower = word.toLowerCase();
    if (options.keepSmallWordsLower && index > 0 && lowerCaseDisplayWords.has(lower)) {
      return lower;
    }
    if (lower === 'bmt') return 'BMT';
    if (lower === 'mcdouble') return 'McDouble';
    if (lower === 'mcchicken') return 'McChicken';
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function stripQuantity(text: string) {
  return text
    .replace(/^\s*(?:\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i, '')
    .replace(/\b(?:servings?|pieces?|orders?|cups?|ounces?|oz|grams?|g)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeFoodPhrase(text: string) {
  return text
    .replace(/\bbreasts\b/gi, 'breast')
    .replace(/\bsandwiches\b/gi, 'sandwich')
    .replace(/\bburgers\b/gi, 'burger')
    .replace(/\btacos\b/gi, 'taco')
    .replace(/\beggs\b/gi, 'egg')
    .replace(/\bslices\b/gi, 'slice')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizeCommaName(sourceFoodName: string) {
  const parts = sourceFoodName
    .split(',')
    .map((part) => normalizeFoodText(part))
    .filter(Boolean);
  const joined = parts.join(' ');

  if (/\bcorn\b/.test(joined) && /\bcob\b/.test(joined)) {
    return 'corn on the cob';
  }

  if (/\bchicken\b/.test(joined) && /\bbreast\b/.test(joined)) {
    return parts.includes('grilled') || joined.includes('grilled') ? 'grilled chicken breast' : 'chicken breast';
  }

  return parts[0] ?? normalizeFoodText(sourceFoodName);
}

function requestedNameCandidate(requestedText: string | null | undefined) {
  if (!requestedText) return null;
  const stripped = singularizeFoodPhrase(stripQuantity(requestedText));
  const normalized = normalizeFoodText(stripped);
  return normalized || null;
}

function mergePreparation(requested: string | null, canonical: string) {
  if (!requested) return canonical;
  const requestedTokens = requested.split(' ');
  const canonicalTokens = new Set(canonical.split(' '));
  const preparations = requestedTokens.filter((token) => preparationTokens.has(token) && !canonicalTokens.has(token));
  return [...preparations, canonical].join(' ').trim();
}

function canonicalNameFromInputs(sourceFoodName: string, requestedText?: string | null) {
  const requested = requestedNameCandidate(requestedText);
  const sourceCanonical = canonicalizeCommaName(sourceFoodName);

  if (requested) {
    if (requested.includes('corn') && requested.includes('cob')) {
      return mergePreparation(requested, 'corn on the cob').replace(/^buttered\s+/i, '');
    }
    if (requested.includes('chicken') && requested.includes('breast')) {
      return requested.includes('grilled') ? 'grilled chicken breast' : 'chicken breast';
    }
    if (!/^(?:food|meal|item|serving)$/.test(requested) && requested.length <= 80) {
      return requested;
    }
  }

  return sourceCanonical;
}

export function buildFoodNameFields(args: {
  sourceFoodName: string;
  requestedText?: string | null;
}): FoodNameFields {
  const sourceFoodName = args.sourceFoodName.trim() || 'Food item';
  const canonical = canonicalNameFromInputs(sourceFoodName, args.requestedText);
  const requested = requestedNameCandidate(args.requestedText);
  const displayBase = requested && requested.includes('corn') && requested.includes('cob')
    ? mergePreparation(requested, 'corn on the cob')
    : canonical;

  return {
    source_food_name: sourceFoodName,
    canonical_name: titleCaseFood(canonical),
    display_name: titleCaseFood(displayBase, { keepSmallWordsLower: true }),
  };
}

export function decorateFoodItemNames<T extends ParsedFoodItem>(
  item: T,
  requestedText?: string | null,
): T {
  const fields = buildFoodNameFields({
    sourceFoodName: item.source_food_name ?? item.food_name,
    requestedText: item.original_user_text ?? item.matched_query ?? requestedText,
  });

  return {
    ...item,
    ...fields,
  };
}

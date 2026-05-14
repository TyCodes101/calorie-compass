import type { NormalizedFoodQuery } from '@/lib/nutrition/types';

const quantityWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

const brandHints = [
  { pattern: /\bmcdonalds\b/, brand: "McDonald's" },
  { pattern: /\btaco bell\b/, brand: 'Taco Bell' },
  { pattern: /\bchipotle\b/, brand: 'Chipotle' },
  { pattern: /\bchick fil a\b|\bchick fil a\b|\bchickfila\b/, brand: 'Chick-fil-A' },
  { pattern: /\bstarbucks\b/, brand: 'Starbucks' },
  { pattern: /\bfairlife\b/, brand: 'Fairlife' },
  { pattern: /\bcore power\b/, brand: 'Core Power' },
  { pattern: /\bquest\b/, brand: 'Quest' },
  { pattern: /\bpremier protein\b/, brand: 'Premier Protein' },
];

function cleanup(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/additional detail:.*/g, '')
    .replace(/\bchipolte\b/g, 'chipotle')
    .replace(/\btacobell\b/g, 'taco bell')
    .replace(/\bmc\s*double\b/g, 'mcdouble')
    .replace(/\bmcdonalds?\b/g, 'mcdonalds')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuantity(text: string) {
  const numericMatch = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (numericMatch) {
    return {
      quantity: Number(numericMatch[1]),
      remainder: numericMatch[2].trim(),
    };
  }

  const wordMatch = text.match(/^(a|an|one|two|three|four|five|six)\s+(.+)$/);
  if (wordMatch) {
    return {
      quantity: quantityWords[wordMatch[1]] ?? 1,
      remainder: wordMatch[2].trim(),
    };
  }

  return { quantity: 1, remainder: text };
}

function singularize(text: string) {
  return text
    .replace(/\bmcdoubles\b/g, 'mcdouble')
    .replace(/\bcrunchy tacos\b/g, 'crunchy taco')
    .replace(/\btacos\b/g, 'taco')
    .replace(/\brace cakes\b/g, 'rice cake')
    .replace(/\bridge cakes\b/g, 'rice cake')
    .replace(/\brice cakes\b/g, 'rice cake')
    .replace(/\bburgers\b/g, 'burger')
    .replace(/\bshakes\b/g, 'shake');
}

function canonicalize(text: string) {
  if (text === 'mcdouble' || text === 'mcdonalds mcdouble') {
    return {
      searchText: 'mcdonalds mcdouble',
      matchedQuery: "McDonald's McDouble",
      unitHint: 'burger',
    };
  }

  if (text === 'taco bell taco' || text === 'taco bell crunchy taco') {
    return {
      searchText: 'taco bell crunchy taco',
      matchedQuery: 'Taco Bell Crunchy Taco',
      unitHint: 'taco',
    };
  }

  if (text === 'chipotle bowl' || text === 'chipotle burrito bowl') {
    return {
      searchText: 'chipotle bowl',
      matchedQuery: 'Chipotle bowl',
      unitHint: 'bowl',
    };
  }

  if (text === 'rice cake') {
    return {
      searchText: 'rice cake',
      matchedQuery: 'Rice cake',
      unitHint: 'cake',
    };
  }

  return {
    searchText: text,
    matchedQuery: text
      .split(' ')
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
      .join(' '),
    unitHint: null,
  };
}

function detectBrandHint(text: string) {
  return brandHints.find((entry) => entry.pattern.test(text))?.brand ?? null;
}

export function normalizeFoodQuery(text: string): NormalizedFoodQuery {
  const normalizedText = cleanup(text);
  const { quantity, remainder } = extractQuantity(normalizedText);
  const singular = singularize(remainder);
  const canonical = canonicalize(singular);

  return {
    rawText: text,
    normalizedText,
    searchText: canonical.searchText,
    matchedQuery: canonical.matchedQuery,
    quantity,
    unitHint: canonical.unitHint,
    brandHint: detectBrandHint(canonical.searchText),
  };
}

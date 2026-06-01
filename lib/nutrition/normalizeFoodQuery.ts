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
  { pattern: /\bchick fil a\b|\bchickfila\b/, brand: 'Chick-fil-A' },
  { pattern: /\blittle caesars\b/, brand: 'Little Caesars' },
  { pattern: /\bstarbucks\b/, brand: 'Starbucks' },
  { pattern: /\bwendys\b|\bwendy s\b/, brand: "Wendy's" },
  { pattern: /\bdunkin\b/, brand: 'Dunkin' },
  { pattern: /\bpanda express\b/, brand: 'Panda Express' },
  { pattern: /\btexas roadhouse\b/, brand: 'Texas Roadhouse' },
  { pattern: /\bfairlife\b/, brand: 'Fairlife' },
  { pattern: /\bcore power\b/, brand: 'Core Power' },
  { pattern: /\bquest\b/, brand: 'Quest' },
  { pattern: /\bpremier protein\b/, brand: 'Premier Protein' },
  { pattern: /\bquaker(?: oats)?\b/, brand: 'Quaker' },
  { pattern: /\bchobani\b/, brand: 'Chobani' },
  { pattern: /\bkodiak\b/, brand: 'Kodiak' },
  { pattern: /\bgatorade\b/, brand: 'Gatorade' },
  { pattern: /\bnature valley\b/, brand: 'Nature Valley' },
  { pattern: /\bmuscle milk\b|\bmusclemilk\b/, brand: 'Muscle Milk' },
  { pattern: /\bbarebells?\b/, brand: 'Barebells' },
  { pattern: /\bdoritos\b/, brand: 'Doritos' },
  { pattern: /\bgoldfish\b|\bgold fish\b/, brand: 'Goldfish' },
  { pattern: /\bcheez it\b|\bcheezit\b/, brand: 'Cheez-It' },
  { pattern: /\bsnickers\b/, brand: 'Snickers' },
  { pattern: /\bskittles?\b/, brand: 'Skittles' },
  { pattern: /\bm\s*(?:&|\/|\s)\s*m'?s?\b/, brand: "M&M's" },
];

const fillerRegex = /\b(?:which|that|are|is|were|was|they|them|the|a|an|my|had|ate|drank|with|and|for|of|about|around|roughly|like|plain|cooked|butter|oil|or|did|have|i|it|no|not|actually|sorry|correction|meant|just|each|cal|cals|calorie|calories)\b/g;

const compoundFoodDefinitions = [
  { pattern: /\bcottage cheese\b/, baseSearch: 'cottage cheese', matched: 'Cottage Cheese', unitHint: null },
  { pattern: /\bwhite cheddar rice cakes?\b/, baseSearch: 'white cheddar rice cake', matched: 'White cheddar rice cakes', unitHint: 'cake' },
  { pattern: /\brice cakes?\b/, baseSearch: 'rice cake', matched: 'Rice cakes', unitHint: 'cake' },
  { pattern: /\bprotein bars?\b/, baseSearch: 'protein bar', matched: 'Protein bar', unitHint: 'bar' },
  { pattern: /\bchicken sandwich\b/, baseSearch: 'chicken sandwich', matched: 'Chicken sandwich', unitHint: 'sandwich' },
  { pattern: /\bpeanut butter\b/, baseSearch: 'peanut butter', matched: 'Peanut butter', unitHint: null },
  { pattern: /\bice cream\b/, baseSearch: 'ice cream', matched: 'Ice cream', unitHint: null },
  { pattern: /\bgrilled chicken(?: breast)?\b/, baseSearch: 'grilled chicken breast', matched: 'Grilled chicken breast', unitHint: 'breast' },
  { pattern: /\bhash browns?\b/, baseSearch: 'hash brown', matched: 'Hash browns', unitHint: null },
  { pattern: /\bfrench fries\b|\bfries\b/, baseSearch: 'french fries', matched: 'French fries', unitHint: null },
  { pattern: /\bmac and cheese\b|\bmac n cheese\b/, baseSearch: 'mac and cheese', matched: 'Mac and cheese', unitHint: null },
  { pattern: /\bpopcorn\b/, baseSearch: 'popcorn', matched: 'Popcorn', unitHint: null },
  { pattern: /\bcrackers?\b/, baseSearch: 'cracker', matched: 'Crackers', unitHint: null },
  { pattern: /\bchips?\b/, baseSearch: 'chips', matched: 'Chips', unitHint: null },
];

function cleanupFreeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\bchipolte\b/g, 'chipotle')
    .replace(/\bcotaage\b/g, 'cottage')
    .replace(/\bcotage\b/g, 'cottage')
    .replace(/\bcottagee\b/g, 'cottage')
    .replace(/\bceasers\b/g, 'caesars')
    .replace(/\bcaesers\b/g, 'caesars')
    .replace(/\btacobell\b/g, 'taco bell')
    .replace(/\bmc\s*double\b/g, 'mcdouble')
    .replace(/\bmcdonalds?\b/g, 'mcdonalds')
    .replace(/[^a-z0-9\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(text: string) {
  return text
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function extractConversationParts(text: string) {
  const lower = text.toLowerCase().replace(/[’']/g, '');
  const extracted: string[] = [];
  let base = lower;

  for (const label of ['additional detail', 'correction']) {
    const regex = new RegExp(`${label}:\\s*([^\\n]+)`, 'g');
    base = base.replace(regex, (_match, detail: string) => {
      extracted.push(detail.trim());
      return ' ';
    });
  }

  return {
    base: cleanupFreeText(base),
    details: extracted.map((detail) => cleanupFreeText(detail)).filter(Boolean),
  };
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

function normalizeQuantityUnit(unit: string | undefined) {
  const normalized = unit?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams') return 'g';
  if (normalized === 'oz' || normalized === 'ounce' || normalized === 'ounces') return 'oz';
  if (normalized === 'slice' || normalized === 'slices') return 'slice';
  if (normalized === 'piece' || normalized === 'pieces') return 'piece';
  if (normalized === 'cake' || normalized === 'cakes') return 'cake';
  if (normalized === 'bar' || normalized === 'bars') return 'bar';
  if (normalized === 'bottle' || normalized === 'bottles') return 'bottle';
  if (normalized === 'egg' || normalized === 'eggs') return 'egg';
  if (normalized === 'cup' || normalized === 'cups') return 'cup';
  if (normalized === 'tbsp' || normalized === 'tablespoon' || normalized === 'tablespoons') return 'tbsp';
  if (normalized === 'tsp' || normalized === 'teaspoon' || normalized === 'teaspoons') return 'tsp';

  return normalized;
}

function extractQuantityUnit(text: string) {
  const match = text.match(/\b(?:\d+(?:\.\d+)?|a|an|one|two|three|four|five|six)\s*(g|grams?|oz|ounces?|slices?|pieces?|cakes?|bars?|bottles?|eggs?|cups?|tbsp|tablespoons?|tsp|teaspoons?)\b/);
  return normalizeQuantityUnit(match?.[1]);
}

function singularize(text: string) {
  return text
    .replace(/\bmcdoubles\b/g, 'mcdouble')
    .replace(/\bcrunchy tacos\b/g, 'crunchy taco')
    .replace(/\btacos\b/g, 'taco')
    .replace(/\brace cakes\b/g, 'rice cake')
    .replace(/\bridge cakes\b/g, 'rice cake')
    .replace(/\brice cakes\b/g, 'rice cake')
    .replace(/\bprotein bars\b/g, 'protein bar')
    .replace(/\bhash browns\b/g, 'hash brown')
    .replace(/\bcrackers\b/g, 'cracker')
    .replace(/\bburgers\b/g, 'burger')
    .replace(/\bshakes\b/g, 'shake');
}

function detectBrandHint(text: string) {
  return brandHints.find((entry) => entry.pattern.test(text))?.brand ?? null;
}

function buildBrandedPackagedSearch(text: string) {
  const hasQuest = /\bquest\b/.test(text);
  const hasProteinChips = /\bprotein\b/.test(text) && /\bchips?\b/.test(text);

  if (hasQuest && hasProteinChips) {
    const flavor = /\b(?:bbq|barbecue)\b/.test(text)
      ? 'bbq'
      : /\bnacho\b/.test(text)
        ? 'nacho cheese'
        : null;
    const parts = ['quest', flavor, 'protein chips'].filter(Boolean);
    return {
      searchText: parts.join(' '),
      matchedQuery: titleCase(parts.join(' ')).replace(/Bbq/, 'BBQ'),
      unitHint: 'bag' as const,
    };
  }

  const hasRiceCakes = /\brice cake\b/.test(text);
  const hasWhiteCheddar = /\bwhite cheddar\b/.test(text);
  const hasQuaker = /\bquaker(?: oats)?\b/.test(text);

  if (hasRiceCakes) {
    const parts = [hasQuaker ? 'quaker oats' : null, hasWhiteCheddar ? 'white cheddar' : null, 'rice cake'].filter(Boolean);
    return {
      searchText: parts.join(' '),
      matchedQuery: titleCase(parts.join(' ')).replace(/Quaker Oats/, 'Quaker Oats').replace(/Rice Cake$/, 'Rice cakes'),
      unitHint: 'cake' as const,
    };
  }

  const hasProteinBar = /\bprotein bar\b/.test(text);
  if (hasProteinBar) {
    const brandedProteinBar = [text.includes('quest') ? 'quest' : null, 'protein bar'].filter(Boolean).join(' ');
    return {
      searchText: brandedProteinBar,
      matchedQuery: titleCase(brandedProteinBar),
      unitHint: 'bar' as const,
    };
  }

  return null;
}

function detectCompoundFood(text: string) {
  const brandedPackaged = buildBrandedPackagedSearch(text);
  if (brandedPackaged) {
    return brandedPackaged;
  }

  for (const definition of compoundFoodDefinitions) {
    if (definition.pattern.test(text)) {
      return {
        searchText: definition.baseSearch,
        matchedQuery: definition.matched,
        unitHint: definition.unitHint,
      };
    }
  }

  return null;
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

  const compoundFood = detectCompoundFood(text);
  if (compoundFood) {
    return compoundFood;
  }

  return {
    searchText: text,
    matchedQuery: titleCase(text),
    unitHint: null,
  };
}

function buildNormalizedSearchText(base: string, details: string[]) {
  const detailText = details.join(' ');
  const combined = [base, detailText]
    .filter(Boolean)
    .join(' ')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\s+(?=[a-z])/g, '$1 ')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:piece|pieces)\s+(?=[a-z])/g, '$1 ')
    .replace(/\b\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\b/g, ' ')
    .replace(fillerRegex, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return singularize(combined);
}

export function normalizeFoodQuery(text: string): NormalizedFoodQuery {
  const { base, details } = extractConversationParts(text);
  const normalizedText = [base, ...details].filter(Boolean).join(' ').trim();
  const { quantity, remainder } = extractQuantity(buildNormalizedSearchText(base, details));
  const canonical = canonicalize(remainder);

  return {
    rawText: text,
    normalizedText,
    searchText: canonical.searchText,
    matchedQuery: canonical.matchedQuery,
    quantity,
    quantityUnit: extractQuantityUnit(normalizedText),
    unitHint: canonical.unitHint,
    brandHint: detectBrandHint(canonical.searchText) ?? detectBrandHint(normalizedText),
  };
}

export type KnownBrand =
  | 'burgerking'
  | 'canes'
  | 'chick-fil-a'
  | 'chipotle'
  | 'dominos'
  | 'dunkin'
  | 'fiveguys'
  | 'jerseymikes'
  | 'kfc'
  | 'mcdonalds'
  | 'pandaexpress'
  | 'panera'
  | 'pizzahut'
  | 'popeyes'
  | 'quaker'
  | 'starbucks'
  | 'subway'
  | 'tacobell'
  | 'wendys'
  | null;
export type MealCategory = 'restaurant' | 'home_cooked' | 'simple' | 'unknown';
export type SpecificityLevel = 'high' | 'medium' | 'low';

export type MealAnalysis = {
  originalText: string;
  normalizedText: string;
  brand: KnownBrand;
  category: MealCategory;
  specificity: SpecificityLevel;
  hasPortion: boolean;
  hasExplicitCountableQuantity: boolean;
  looksLikeSimpleCountableMeal: boolean;
  hasCookingStyle: boolean;
  hasSauceSignal: boolean;
  hasMultipleItems: boolean;
  likelyNeedsClarification: boolean;
};

const protectedCompoundPatterns = [
  /white cheddar rice cakes?/gi,
  /rice cakes?/gi,
  /protein bars?/gi,
  /chicken sandwich/gi,
  /peanut butter/gi,
  /ice cream/gi,
  /grilled chicken(?: breast)?/gi,
  /hash browns?/gi,
  /french fries/gi,
  /mac and cheese/gi,
  /popcorn/gi,
  /crackers?/gi,
];

const portionRegex = /(\b\d+(?:\.\d+)?\b\s?(?:cup|cups|oz|ounce|ounces|serving|servings|piece|pieces|slice|slices|bowl|bowls|plate|plates|scoop|scoops|tbsp|tsp|grams|g|egg|eggs|banana|bananas|apple|apples|bagel|bagels|bar|bars|cake|cakes|container|containers|count|breast|sandwich)\b)/i;
const simpleCountableFoodRegex = /\b(rice cakes?|protein bars?|bananas?|apples?|eggs?|protein bar|greek yogurt|yogurts?|bagels?|toast|crackers?|chips?|popcorn)\b/i;
const compoundFoodRegex = /\b(white cheddar rice cakes?|rice cakes?|protein bars?|chicken sandwich|peanut butter|ice cream|grilled chicken(?: breast)?|hash browns?|french fries|mac and cheese|popcorn|crackers?)\b/i;
const packagedSnackRegex = /\b(quaker(?: oats)?|white cheddar|rice cakes?|chips?|protein bars?|popcorn|crackers?|packaged snacks?)\b/i;
const proteinShakeRegex = /\b(protein shake|shake|smoothie)\b/i;
const packagedProteinRegex = /\b(fairlife|core power|premier protein|quest)\b/i;
const cookingStyleRegex = /\b(grilled|fried|baked|roasted|blackened|crispy|sauced|sauteed|broiled)\b/i;
const sauceRegex = /\b(sauce|salsa|dressing|oil|gravy|marinade|mayo|aioli|butter|toppings?)\b/i;
const separatorRegex = /(,| and | with )/i;
const simpleAddonRegex = /\b(almond milk|milk|water|berries?|banana|ice|cinnamon|honey|peanut butter)\b/i;
const ambiguousMealRegex = /\b(chicken and rice|chicken|rice|pasta|sandwich|salad|bowl|tacos?|protein shake|snacks?)\b/i;

function protectCompoundFoods(text: string) {
  return protectedCompoundPatterns.reduce(
    (current, pattern) => current.replace(pattern, (match) => match.replace(/\s+/g, '_')),
    text,
  );
}

function restoreProtectedText(text: string) {
  return text.replace(/_/g, ' ');
}

function cleanSegment(segment: string) {
  return restoreProtectedText(
    segment
      .replace(/^\s*(i had|i ate|had|ate|with|and|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function splitSegments(text: string) {
  const protectedText = protectCompoundFoods(text);

  return protectedText
    .split(/,|\band\b|\bwith\b/i)
    .map(cleanSegment)
    .filter(Boolean);
}

function hasCountableQuantity(text: string) {
  return /\b\d+(?:\.\d+)?\b(?:\s+[a-z0-9]+){0,4}\s+(?:rice cakes?|protein bars?|bananas?|apples?|eggs?|bagels?|(?:greek\s+)?yogurts?|crackers?|chips?|popcorn)\b/i.test(
    text,
  );
}

function isCountableSimpleSegment(segment: string) {
  return hasCountableQuantity(segment) || simpleCountableFoodRegex.test(segment);
}

function detectBrand(text: string): KnownBrand {
  const compact = text.replace(/[^a-z0-9]+/g, '');
  if (text.includes('chipotle')) return 'chipotle';
  if (text.includes('starbucks')) return 'starbucks';
  if (text.includes('chick-fil-a') || text.includes('chick fil a')) return 'chick-fil-a';
  if (text.includes('mcdonald') || text.includes('mc donald') || compact.includes('mcdonalds')) return 'mcdonalds';
  if (text.includes('taco bell') || compact.includes('tacobell')) return 'tacobell';
  if (text.includes('subway')) return 'subway';
  if (text.includes('wendys') || text.includes("wendy's")) return 'wendys';
  if (text.includes('burger king') || compact.includes('burgerking')) return 'burgerking';
  if (text.includes('panda express') || compact.includes('pandaexpress')) return 'pandaexpress';
  if (text.includes('dominos') || text.includes("domino's")) return 'dominos';
  if (text.includes('pizza hut') || compact.includes('pizzahut')) return 'pizzahut';
  if (text.includes('raising canes') || text.includes("raising cane's") || text.includes('canes') || compact.includes('raisingcanes')) return 'canes';
  if (text.includes('popeyes')) return 'popeyes';
  if (text.includes('panera')) return 'panera';
  if (text.includes('dunkin')) return 'dunkin';
  if (/\bkfc\b/.test(text)) return 'kfc';
  if (text.includes('five guys') || compact.includes('fiveguys')) return 'fiveguys';
  if (text.includes('jersey mikes') || text.includes("jersey mike's") || compact.includes('jerseymikes')) return 'jerseymikes';
  if (text.includes('quaker')) return 'quaker';
  return null;
}

function detectCategory(text: string, brand: KnownBrand, hasExplicitCountableQuantity: boolean, looksLikeSimpleCountableMeal: boolean): MealCategory {
  if (brand && brand !== 'quaker') return 'restaurant';

  if (packagedSnackRegex.test(text) || compoundFoodRegex.test(text)) {
    return 'simple';
  }

  if (looksLikeSimpleCountableMeal || (hasExplicitCountableQuantity && simpleCountableFoodRegex.test(text))) {
    return 'simple';
  }

  if (proteinShakeRegex.test(text)) {
    return simpleAddonRegex.test(text) || hasExplicitCountableQuantity || packagedProteinRegex.test(text) ? 'simple' : 'unknown';
  }

  if (simpleCountableFoodRegex.test(text) && (!separatorRegex.test(text) || simpleAddonRegex.test(text))) {
    return 'simple';
  }

  if (/\b(chicken|rice|pasta|salmon|beef|steak|potato|veggies|vegetables|omelet|sandwich|salad|bowl|tacos?|snacks?)\b/i.test(text)) {
    return 'home_cooked';
  }

  return 'unknown';
}

function detectSpecificity(text: string, hasPortion: boolean, hasCookingStyle: boolean, hasMultipleItems: boolean, brand: KnownBrand) {
  let score = 0;
  if (brand) score += 2;
  if (hasPortion) score += 1;
  if (hasCookingStyle) score += 1;
  if (hasMultipleItems) score += 1;
  if (compoundFoodRegex.test(text) || packagedSnackRegex.test(text)) score += 1;
  if (/\b(double|extra|grande|venti|tall|small|medium|large|white cheddar)\b/i.test(text)) score += 1;

  if (score >= 4) return 'high' as const;
  if (score >= 2) return 'medium' as const;
  return 'low' as const;
}

export function analyzeMealText(input: string): MealAnalysis {
  const normalizedText = input.trim().toLowerCase();
  const brand = detectBrand(normalizedText);
  const segments = splitSegments(normalizedText);
  const hasExplicitCountableQuantity = hasCountableQuantity(normalizedText);
  const looksLikeSimpleCountableMeal = segments.length > 0 && segments.every(isCountableSimpleSegment);
  const hasPortion = portionRegex.test(normalizedText) || hasExplicitCountableQuantity;
  const hasCookingStyle = cookingStyleRegex.test(normalizedText);
  const hasSauceSignal = sauceRegex.test(normalizedText);
  const hasMultipleItems = separatorRegex.test(protectCompoundFoods(normalizedText));
  const category = detectCategory(normalizedText, brand, hasExplicitCountableQuantity, looksLikeSimpleCountableMeal);
  const specificity = detectSpecificity(normalizedText, hasPortion, hasCookingStyle, hasMultipleItems, brand);

  const likelyNeedsClarification = Boolean(
    !brand &&
      !packagedSnackRegex.test(normalizedText) &&
      !compoundFoodRegex.test(normalizedText) &&
      !hasExplicitCountableQuantity &&
      !looksLikeSimpleCountableMeal &&
      category !== 'simple' &&
      (specificity === 'low' || (!hasPortion && ambiguousMealRegex.test(normalizedText)))
  );

  return {
    originalText: input,
    normalizedText,
    brand,
    category,
    specificity,
    hasPortion,
    hasExplicitCountableQuantity,
    looksLikeSimpleCountableMeal,
    hasCookingStyle,
    hasSauceSignal,
    hasMultipleItems,
    likelyNeedsClarification,
  };
}

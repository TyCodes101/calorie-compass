export type KnownBrand = 'chipotle' | 'starbucks' | 'chick-fil-a' | 'mcdonalds' | null;
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

const portionRegex = /(\b\d+(?:\.\d+)?\b\s?(?:cup|cups|oz|ounce|ounces|serving|servings|piece|pieces|slice|slices|bowl|bowls|plate|plates|scoop|scoops|tbsp|tsp|grams|g|egg|eggs|banana|bananas|apple|apples|bagel|bagels|bar|bars|cake|cakes|container|containers|count)\b)/i;
const countableSimpleQuantityRegex = /(?:\b\d+(?:\.\d+)?\b\s*(?:rice cakes?|bananas?|apples?|eggs?|protein bars?|bagels?|(?:greek\s+)?yogurts?)\b|\b\d+(?:\.\d+)?\b\s*(?:slice|slices)\s+(?:of\s+)?toast\b)/i;
const simpleCountableFoodRegex = /\b(rice cakes?|bananas?|apples?|eggs?|protein bars?|greek yogurt|yogurts?|bagels?|toast)\b/i;
const proteinShakeRegex = /\b(protein shake|shake|smoothie)\b/i;
const packagedProteinRegex = /\b(fairlife|core power|premier protein|quest)\b/i;
const cookingStyleRegex = /\b(grilled|fried|baked|roasted|blackened|crispy|sauced|sauteed|broiled)\b/i;
const sauceRegex = /\b(sauce|salsa|dressing|oil|gravy|marinade|mayo|aioli|butter|toppings?)\b/i;
const separatorRegex = /(,| and | with )/i;
const simpleAddonRegex = /\b(almond milk|milk|water|berries?|banana|ice|cinnamon|honey|peanut butter)\b/i;
const ambiguousMealRegex = /\b(chicken and rice|chicken|rice|pasta|sandwich|salad|bowl|tacos?|protein shake|snacks?)\b/i;

function cleanSegment(segment: string) {
  return segment
    .replace(/^\s*(i had|i ate|had|ate|with|and|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSegments(text: string) {
  return text
    .split(/,|\band\b|\bwith\b/i)
    .map(cleanSegment)
    .filter(Boolean);
}

function isCountableSimpleSegment(segment: string) {
  return countableSimpleQuantityRegex.test(segment);
}

function detectBrand(text: string): KnownBrand {
  if (text.includes('chipotle')) return 'chipotle';
  if (text.includes('starbucks')) return 'starbucks';
  if (text.includes('chick-fil-a') || text.includes('chick fil a')) return 'chick-fil-a';
  if (text.includes("mcdonald") || text.includes('mcdonalds')) return 'mcdonalds';
  return null;
}

function detectCategory(text: string, brand: KnownBrand, hasExplicitCountableQuantity: boolean, looksLikeSimpleCountableMeal: boolean): MealCategory {
  if (brand) return 'restaurant';

  if (looksLikeSimpleCountableMeal || (hasExplicitCountableQuantity && simpleCountableFoodRegex.test(text))) {
    return 'simple';
  }

  if (proteinShakeRegex.test(text)) {
    return simpleAddonRegex.test(text) || hasExplicitCountableQuantity || packagedProteinRegex.test(text) ? 'simple' : 'unknown';
  }

  if (/\b(protein bar|banana|apple|yogurt|greek yogurt|rice cake|bagel|eggs?|toast)\b/i.test(text) && (!separatorRegex.test(text) || simpleAddonRegex.test(text))) {
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
  if (/\b(double|extra|grande|venti|tall|small|medium|large)\b/i.test(text)) score += 1;

  if (score >= 4) return 'high' as const;
  if (score >= 2) return 'medium' as const;
  return 'low' as const;
}

export function analyzeMealText(input: string): MealAnalysis {
  const normalizedText = input.trim().toLowerCase();
  const brand = detectBrand(normalizedText);
  const segments = splitSegments(normalizedText);
  const hasExplicitCountableQuantity = countableSimpleQuantityRegex.test(normalizedText);
  const looksLikeSimpleCountableMeal = segments.length > 0 && segments.every(isCountableSimpleSegment);
  const hasPortion = portionRegex.test(normalizedText) || hasExplicitCountableQuantity;
  const hasCookingStyle = cookingStyleRegex.test(normalizedText);
  const hasSauceSignal = sauceRegex.test(normalizedText);
  const hasMultipleItems = separatorRegex.test(normalizedText);
  const category = detectCategory(normalizedText, brand, hasExplicitCountableQuantity, looksLikeSimpleCountableMeal);
  const specificity = detectSpecificity(normalizedText, hasPortion, hasCookingStyle, hasMultipleItems, brand);

  const likelyNeedsClarification = Boolean(
    !brand &&
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

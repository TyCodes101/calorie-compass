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
  hasCookingStyle: boolean;
  hasSauceSignal: boolean;
  hasMultipleItems: boolean;
  likelyNeedsClarification: boolean;
};

const portionRegex = /(\b\d+(?:\.\d+)?\b\s?(?:cup|cups|oz|ounce|ounces|serving|servings|piece|pieces|slice|slices|bowl|bowls|plate|plates|scoop|scoops|tbsp|tsp|grams|g|egg|eggs|banana|bananas|count)\b)/i;
const cookingStyleRegex = /\b(grilled|fried|baked|roasted|blackened|crispy|sauced|sauteed|broiled)\b/i;
const sauceRegex = /\b(sauce|salsa|dressing|oil|gravy|marinade|mayo|aioli)\b/i;
const separatorRegex = /(,| and | with )/i;

function detectBrand(text: string): KnownBrand {
  if (text.includes('chipotle')) return 'chipotle';
  if (text.includes('starbucks')) return 'starbucks';
  if (text.includes('chick-fil-a') || text.includes('chick fil a')) return 'chick-fil-a';
  if (text.includes("mcdonald") || text.includes('mcdonalds')) return 'mcdonalds';
  return null;
}

function detectCategory(text: string, brand: KnownBrand): MealCategory {
  if (brand) return 'restaurant';

  const simpleMealPattern = /\b(protein shake|shake|smoothie|protein bar|banana|apple|yogurt|eggs?)\b/i;
  const simpleAddonPattern = /\b(almond milk|milk|water|berries|banana|ice)\b/i;

  if (simpleMealPattern.test(text) && (!separatorRegex.test(text) || simpleAddonPattern.test(text))) {
    return 'simple';
  }

  if (/\b(chicken|rice|pasta|salmon|beef|steak|potato|veggies|vegetables|omelet|sandwich|salad|bowl|tacos?)\b/i.test(text)) return 'home_cooked';
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
  const hasPortion = portionRegex.test(normalizedText);
  const hasCookingStyle = cookingStyleRegex.test(normalizedText);
  const hasSauceSignal = sauceRegex.test(normalizedText);
  const hasMultipleItems = separatorRegex.test(normalizedText);
  const category = detectCategory(normalizedText, brand);
  const specificity = detectSpecificity(normalizedText, hasPortion, hasCookingStyle, hasMultipleItems, brand);

  const likelyNeedsClarification = Boolean(
    !brand &&
      category !== 'simple' &&
      (specificity === 'low' || (!hasPortion && /\b(chicken and rice|pasta|bowl|salad|sandwich|tacos?)\b/i.test(normalizedText)))
  );

  return {
    originalText: input,
    normalizedText,
    brand,
    category,
    specificity,
    hasPortion,
    hasCookingStyle,
    hasSauceSignal,
    hasMultipleItems,
    likelyNeedsClarification,
  };
}

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import {
  findCatalogFoodById,
  makeCatalogMealResponse,
  makeEstimatedItem,
  quantityMatch,
  scaleCatalogFood,
} from '@/lib/nutrition/catalog';

type KnownBrand = 'chipotle' | 'starbucks' | 'chick-fil-a' | 'mcdonalds' | null;

function detectBrand(text: string): KnownBrand {
  if (text.includes('chipotle')) return 'chipotle';
  if (text.includes('starbucks')) return 'starbucks';
  if (text.includes('chick-fil-a') || text.includes('chick fil a')) return 'chick-fil-a';
  if (text.includes("mcdonald") || text.includes('mcdonalds')) return 'mcdonalds';
  return null;
}

function cleanSegment(segment: string) {
  return segment
    .replace(/^\s*(i had|i ate|had|ate|with|and|a|an)\s+/i, '')
    .replace(/\bmeal\b/gi, '')
    .replace(/\bbowl\b/gi, '')
    .replace(/\bcombo\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitRestaurantSegments(text: string) {
  const normalized = text.toLowerCase();
  const afterWith = normalized.includes(' with ') ? normalized.split(' with ').slice(1).join(' with ') : normalized;

  return afterWith
    .replace(/\band\b/g, ',')
    .split(',')
    .map(cleanSegment)
    .filter(Boolean);
}

function splitGenericSegments(text: string) {
  return text
    .toLowerCase()
    .replace(/^\s*(i had|i ate|had|ate)\s+/i, '')
    .replace(/\band\b/g, ',')
    .split(',')
    .map(cleanSegment)
    .filter(Boolean);
}

function matchChipotleSegment(segment: string): ParsedFoodItem[] {
  if (segment.includes('double chicken')) {
    const food = findCatalogFoodById('chipotle_chicken');
    return food ? [scaleCatalogFood(food, 2, 'serving')] : [];
  }
  if (segment.includes('white rice') || segment === 'rice') {
    const food = findCatalogFoodById('chipotle_white_rice');
    return food ? [scaleCatalogFood(food, 1, 'serving')] : [];
  }
  if (segment.includes('chicken')) {
    const food = findCatalogFoodById('chipotle_chicken');
    return food ? [scaleCatalogFood(food, 1, 'serving')] : [];
  }
  if (segment.includes('cheese')) {
    const food = findCatalogFoodById('chipotle_cheese');
    return food ? [scaleCatalogFood(food, 1, 'serving')] : [];
  }
  if (segment.includes('corn')) {
    const food = findCatalogFoodById('chipotle_corn_salsa');
    return food ? [scaleCatalogFood(food, 1, 'serving')] : [];
  }
  if (segment.includes('lettuce')) {
    const food = findCatalogFoodById('chipotle_lettuce');
    return food ? [scaleCatalogFood(food, 1, 'serving')] : [];
  }
  if (segment.includes('green salsa') || segment.includes('tomatillo')) {
    const food = findCatalogFoodById('chipotle_green_salsa');
    return food ? [scaleCatalogFood(food, 1, 'serving')] : [];
  }
  return [];
}

function matchStarbucksSegment(segment: string): ParsedFoodItem[] {
  if (segment.includes('bacon gouda')) {
    const food = findCatalogFoodById('starbucks_bacon_gouda');
    return food ? [scaleCatalogFood(food, 1, 'sandwich')] : [];
  }

  if (segment.includes('latte')) {
    const food = segment.includes('venti')
      ? findCatalogFoodById('starbucks_latte_venti')
      : segment.includes('grande')
        ? findCatalogFoodById('starbucks_latte_grande')
        : findCatalogFoodById('starbucks_latte_tall');

    return food ? [scaleCatalogFood(food, 1, food.servingUnit)] : [];
  }

  return [];
}

function matchChickFilASegment(segment: string): ParsedFoodItem[] {
  if (segment.includes('12 count') && segment.includes('nugget')) {
    const food = findCatalogFoodById('chickfila_nuggets_12');
    return food ? [scaleCatalogFood(food, 12, 'count')] : [];
  }
  if (segment.includes('nugget')) {
    const food = findCatalogFoodById('chickfila_nuggets_8');
    return food ? [scaleCatalogFood(food, 8, 'count')] : [];
  }
  if (segment.includes('fries')) {
    const food = findCatalogFoodById('chickfila_waffle_fries');
    return food ? [scaleCatalogFood(food, 1, 'medium order')] : [];
  }
  if (segment.includes('sandwich')) {
    const food = findCatalogFoodById('chickfila_sandwich');
    return food ? [scaleCatalogFood(food, 1, 'sandwich')] : [];
  }
  return [];
}

function matchMcDonaldsSegment(segment: string): ParsedFoodItem[] {
  if (segment.includes('cheeseburger')) {
    const food = findCatalogFoodById('mcdonalds_cheeseburger');
    return food ? [scaleCatalogFood(food, 1, 'burger')] : [];
  }
  if (segment.includes('fries')) {
    const food = findCatalogFoodById('mcdonalds_fries');
    return food ? [scaleCatalogFood(food, 1, 'medium order')] : [];
  }
  if (segment.includes('coke') || segment.includes('sprite') || segment.includes('drink')) {
    const food = findCatalogFoodById('mcdonalds_soft_drink');
    return food ? [scaleCatalogFood(food, 1, 'medium')] : [];
  }
  return [];
}

function matchRestaurantSegment(segment: string, brand: Exclude<KnownBrand, null>) {
  if (brand === 'chipotle') return matchChipotleSegment(segment);
  if (brand === 'starbucks') return matchStarbucksSegment(segment);
  if (brand === 'chick-fil-a') return matchChickFilASegment(segment);
  return matchMcDonaldsSegment(segment);
}

function matchGenericSegment(segment: string): ParsedFoodItem[] {
  const items: ParsedFoodItem[] = [];

  if (segment.includes('protein shake')) {
    const whey = findCatalogFoodById('generic_whey_protein');
    const almondMilk = segment.includes('almond milk') ? findCatalogFoodById('generic_almond_milk') : null;
    if (whey) items.push(scaleCatalogFood(whey, 1, 'scoop'));
    if (almondMilk) items.push(scaleCatalogFood(almondMilk, 1, 'cup'));
    return items;
  }

  if (segment.includes('egg')) {
    const egg = findCatalogFoodById('generic_large_egg');
    if (egg) items.push(scaleCatalogFood(egg, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:scrambled\s+)?(?:egg|eggs)/, 1), 'egg'));
  }

  if (segment.includes('toast') || segment.includes('bread')) {
    const bread = findCatalogFoodById('generic_bread');
    if (bread) {
      const quantity = quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:slice|slices)\s+(?:of\s+)?(?:toast|bread)/, segment.includes('toast') ? 2 : 1);
      items.push(scaleCatalogFood(bread, quantity, 'slice'));
    }
  }

  if (segment.includes('rice') && /cup|cups/.test(segment)) {
    const rice = findCatalogFoodById('generic_cooked_white_rice');
    if (rice) items.push(scaleCatalogFood(rice, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)\s+(?:of\s+)?(?:white\s+)?rice/, 1), 'cup'));
  }

  if (segment.includes('chicken') && !segment.includes('sandwich') && (/grilled/.test(segment) || /oz|ounce|ounces/.test(segment))) {
    const chicken = findCatalogFoodById('generic_grilled_chicken_breast');
    if (chicken) items.push(scaleCatalogFood(chicken, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)\s+(?:of\s+)?(?:grilled\s+)?chicken/, 4), 'oz'));
  }

  if (segment.includes('pasta') && /cup|cups/.test(segment)) {
    const pasta = findCatalogFoodById('generic_cooked_pasta');
    if (pasta) items.push(scaleCatalogFood(pasta, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)\s+(?:of\s+)?pasta/, 1), 'cup'));
  }

  if (segment.includes('oats') || segment.includes('oatmeal')) {
    const oats = findCatalogFoodById('generic_oats');
    if (oats) items.push(scaleCatalogFood(oats, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)\s+(?:of\s+)?(?:oats|oatmeal)/, 0.5), 'cup'));
  }

  if (segment.includes('banana')) {
    const banana = findCatalogFoodById('generic_banana');
    if (banana) items.push(scaleCatalogFood(banana, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:banana|bananas)/, 1), 'banana'));
  }

  if (segment.includes('cheese')) {
    const cheese = findCatalogFoodById('generic_cheese');
    if (cheese) items.push(scaleCatalogFood(cheese, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:slice|slices)\s+(?:of\s+)?cheese/, 1), 'slice'));
  }

  return items;
}

function estimateFallbackSegment(segment: string): ParsedFoodItem | null {
  if (segment.includes('hash brown')) {
    return makeEstimatedItem('Hash browns', 1, 'serving', { calories: 180, protein: 2, carbs: 24, fat: 8, fiber: 2, sugar: 0, sodium: 320 }, 'Estimated fallback for unmatched side item');
  }

  if (segment.includes('chips')) {
    return makeEstimatedItem('Chips', 1, 'serving', { calories: 160, protein: 2, carbs: 15, fat: 10, fiber: 1, sugar: 1, sodium: 170 }, 'Estimated fallback for unmatched snack item');
  }

  if (segment.includes('cookie')) {
    return makeEstimatedItem('Cookie', 1, 'cookie', { calories: 190, protein: 2, carbs: 27, fat: 8, fiber: 1, sugar: 16, sodium: 140 }, 'Estimated fallback for unmatched dessert item');
  }

  return null;
}

export function getTrustedCatalogEstimate(text: string, mealType: MealTypeValue): ParsedMealResponse | null {
  const normalized = text.toLowerCase();
  const brand = detectBrand(normalized);
  const segments = brand ? splitRestaurantSegments(normalized) : splitGenericSegments(normalized);
  const items: ParsedFoodItem[] = [];

  for (const segment of segments) {
    const matchedItems = brand ? matchRestaurantSegment(segment, brand) : matchGenericSegment(segment);

    if (matchedItems.length) {
      items.push(...matchedItems);
      continue;
    }

    const fallbackItem = estimateFallbackSegment(segment);
    if (fallbackItem) {
      items.push(fallbackItem);
    }
  }

  const trustedItemCount = items.filter((item) => item.is_trusted).length;
  if (!trustedItemCount) {
    return null;
  }

  const confidenceScore = trustedItemCount === items.length ? 0.9 : 0.78;
  return makeCatalogMealResponse(mealType, items, confidenceScore);
}

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import {
  findCatalogFoodByBestMatch,
  findCatalogFoodById,
  makeCatalogMealResponse,
  makeEstimatedItem,
  quantityMatch,
  scaleCatalogFood,
  scaleParsedFoodItem,
} from '@/lib/nutrition/catalog';

type KnownRestaurantBrand =
  | 'CAVA'
  | 'Chick-fil-A'
  | 'Chipotle'
  | "McDonald's"
  | 'Panera'
  | 'Panda Express'
  | 'Starbucks'
  | 'Subway'
  | 'Taco Bell'
  | "Wendy's"
  | null;

type KnownPackagedBrand =
  | 'Celsius'
  | 'Coca-Cola'
  | 'Core Power'
  | 'Fairlife'
  | 'Gatorade'
  | 'Oikos'
  | 'Premier Protein'
  | 'Quest'
  | null;

function detectRestaurantBrand(text: string): KnownRestaurantBrand {
  if (text.includes('chipotle')) return 'Chipotle';
  if (text.includes('starbucks')) return 'Starbucks';
  if (text.includes('chick-fil-a') || text.includes('chick fil a')) return 'Chick-fil-A';
  if (text.includes("mcdonald") || text.includes('mcdonalds')) return "McDonald's";
  if (text.includes('panda express')) return 'Panda Express';
  if (text.includes('subway')) return 'Subway';
  if (text.includes('taco bell')) return 'Taco Bell';
  if (text.includes("wendy's") || text.includes('wendys')) return "Wendy's";
  if (text.includes('cava')) return 'CAVA';
  if (text.includes('panera')) return 'Panera';
  return null;
}

function detectPackagedBrand(text: string): KnownPackagedBrand {
  if (text.includes('fairlife')) return 'Fairlife';
  if (text.includes('core power')) return 'Core Power';
  if (text.includes('premier protein')) return 'Premier Protein';
  if (text.includes('quest')) return 'Quest';
  if (text.includes('gatorade')) return 'Gatorade';
  if (text.includes('celsius')) return 'Celsius';
  if (text.includes('coke zero') || text.includes('coca cola') || text.includes('coke')) return 'Coca-Cola';
  if (text.includes('oikos')) return 'Oikos';
  return null;
}

function cleanSegment(segment: string) {
  return segment
    .replace(/^\s*(i had|i ate|had|ate|with|and|a|an)\s+/i, '')
    .replace(/\bmeal\b/gi, '')
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

function scaleItems(items: ParsedFoodItem[], factor: number) {
  if (factor === 1) {
    return items;
  }

  return items.map((item) => scaleParsedFoodItem(item, factor));
}

function extractMealPortionFactor(text: string) {
  if (/\bhalf\b/.test(text)) return 0.5;
  return 1;
}

function matchChipotleSegment(segment: string, factor: number): ParsedFoodItem[] {
  if (segment.includes('white rice') || segment === 'rice') {
    const food = findCatalogFoodById('chipotle_white_rice');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'serving')], factor) : [];
  }
  if (segment.includes('double chicken')) {
    const food = findCatalogFoodById('chipotle_chicken');
    return food ? scaleItems([scaleCatalogFood(food, 2, 'serving')], factor) : [];
  }
  if (segment.includes('chicken')) {
    const food = findCatalogFoodById('chipotle_chicken');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'serving')], factor) : [];
  }
  if (segment.includes('cheese')) {
    const food = findCatalogFoodById('chipotle_cheese');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'serving')], factor) : [];
  }
  if (segment.includes('corn')) {
    const food = findCatalogFoodById('chipotle_corn_salsa');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'serving')], factor) : [];
  }
  if (segment.includes('lettuce')) {
    const food = findCatalogFoodById('chipotle_lettuce');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'serving')], factor) : [];
  }
  if (segment.includes('green salsa') || segment.includes('tomatillo')) {
    const food = findCatalogFoodById('chipotle_green_salsa');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'serving')], factor) : [];
  }

  return [];
}

function matchStarbucksSegment(segment: string, factor: number): ParsedFoodItem[] {
  if (segment.includes('bacon gouda')) {
    const food = findCatalogFoodById('starbucks_bacon_gouda');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'sandwich')], factor) : [];
  }

  if (segment.includes('latte')) {
    const food = segment.includes('venti')
      ? findCatalogFoodById('starbucks_latte_venti')
      : segment.includes('grande')
        ? findCatalogFoodById('starbucks_latte_grande')
        : findCatalogFoodById('starbucks_latte_tall');

    return food ? scaleItems([scaleCatalogFood(food, 1, food.servingUnit)], factor) : [];
  }

  return [];
}

function matchChickFilASegment(segment: string, factor: number): ParsedFoodItem[] {
  if (segment.includes('12 count') && segment.includes('nugget')) {
    const food = findCatalogFoodById('chickfila_nuggets_12');
    return food ? scaleItems([scaleCatalogFood(food, 12, 'count')], factor) : [];
  }

  if (segment.includes('nugget')) {
    const food = findCatalogFoodById('chickfila_nuggets_8');
    return food ? scaleItems([scaleCatalogFood(food, 8, 'count')], factor) : [];
  }

  if (segment.includes('fries')) {
    const food = segment.includes('large')
      ? findCatalogFoodById('chickfila_waffle_fries_large')
      : findCatalogFoodById('chickfila_waffle_fries');

    return food ? scaleItems([scaleCatalogFood(food, 1, food.servingUnit)], factor) : [];
  }

  if (segment.includes('sandwich')) {
    const food = findCatalogFoodById('chickfila_sandwich');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'sandwich')], factor) : [];
  }

  return [];
}

function matchMcDonaldsSegment(segment: string, factor: number): ParsedFoodItem[] {
  if (segment.includes('cheeseburger')) {
    const food = findCatalogFoodById('mcdonalds_cheeseburger');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'burger')], factor) : [];
  }

  if (segment.includes('fries')) {
    const food = findCatalogFoodById('mcdonalds_fries');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'medium order')], factor) : [];
  }

  if (segment.includes('coke') || segment.includes('sprite') || segment.includes('drink')) {
    const food = findCatalogFoodById('mcdonalds_soft_drink');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'medium')], factor) : [];
  }

  return [];
}

function matchRestaurantAlias(segment: string, brand: Exclude<KnownRestaurantBrand, null>, factor: number) {
  const food = findCatalogFoodByBestMatch(segment, brand);
  return food ? scaleItems([scaleCatalogFood(food, 1, food.servingUnit)], factor) : [];
}

function matchRestaurantSegment(segment: string, brand: Exclude<KnownRestaurantBrand, null>, factor: number) {
  let matchedItems: ParsedFoodItem[] = [];

  if (brand === 'Chipotle') matchedItems = matchChipotleSegment(segment, factor);
  else if (brand === 'Starbucks') matchedItems = matchStarbucksSegment(segment, factor);
  else if (brand === 'Chick-fil-A') matchedItems = matchChickFilASegment(segment, factor);
  else if (brand === "McDonald's") matchedItems = matchMcDonaldsSegment(segment, factor);

  if (matchedItems.length) {
    return matchedItems;
  }

  return matchRestaurantAlias(segment, brand, factor);
}

function extractPackagedQuantity(segment: string, unit: string) {
  if (unit === 'bar') {
    return quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:quest\s+)?(?:bar|bars)/, 1);
  }

  if (unit === 'bottle') {
    return quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:bottle|bottles|shake|shakes)/, 1);
  }

  if (unit === 'can') {
    return quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:can|cans)/, 1);
  }

  if (unit === 'cup') {
    return quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)/, 1);
  }

  return 1;
}

function matchPackagedSegment(segment: string): ParsedFoodItem[] {
  const brand = detectPackagedBrand(segment);
  if (!brand) {
    return [];
  }

  const food = findCatalogFoodByBestMatch(segment, brand);
  if (!food) {
    return [];
  }

  const quantity = extractPackagedQuantity(segment, food.servingUnit);
  return [scaleCatalogFood(food, quantity, food.servingUnit)];
}

function matchGenericSegment(segment: string): ParsedFoodItem[] {
  const items: ParsedFoodItem[] = [];
  const packagedItems = matchPackagedSegment(segment);
  if (packagedItems.length) {
    return packagedItems;
  }

  if (segment.includes('alfredo')) {
    const chicken = findCatalogFoodById('generic_grilled_chicken_breast');
    const pasta = findCatalogFoodById('generic_cooked_pasta');

    if (chicken) items.push(scaleCatalogFood(chicken, 4, 'oz'));
    if (pasta) items.push(scaleCatalogFood(pasta, 1.5, 'cup'));

    items.push(
      makeEstimatedItem(
        'Alfredo sauce',
        1,
        'serving',
        { calories: 220, protein: 4, carbs: 6, fat: 20, fiber: 0, sugar: 2, sodium: 420 },
        'Estimated fallback for homemade Alfredo sauce'
      )
    );

    return items;
  }

  if (segment.includes('protein shake')) {
    const whey = findCatalogFoodById('generic_whey_protein');
    const almondMilk = segment.includes('almond milk') ? findCatalogFoodById('generic_almond_milk') : null;
    if (whey) items.push(scaleCatalogFood(whey, 1, 'scoop'));
    if (almondMilk) items.push(scaleCatalogFood(almondMilk, 1, 'cup'));
    return items;
  }

  if (segment.includes('egg')) {
    const egg = findCatalogFoodById('generic_large_egg');
    if (egg) {
      items.push(scaleCatalogFood(egg, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:scrambled\s+)?(?:egg|eggs)/, 1), 'egg'));
    }
  }

  if (segment.includes('toast') || segment.includes('bread')) {
    const bread = findCatalogFoodById('generic_bread');
    if (bread) {
      const quantity = quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:slice|slices)\s+(?:of\s+)?(?:toast|bread)/, segment.includes('toast') ? 2 : 1);
      items.push(scaleCatalogFood(bread, quantity, 'slice'));
    }
  }

  if (segment.includes('rice')) {
    const rice = findCatalogFoodById('generic_cooked_white_rice');
    if (rice) {
      if (/scoop|scoops/.test(segment)) {
        const scoops = quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:scoop|scoops)\s+(?:of\s+)?(?:white\s+)?rice/, 1);
        items.push(scaleCatalogFood(rice, scoops * 0.5, 'cup'));
      } else if (/cup|cups/.test(segment)) {
        items.push(scaleCatalogFood(rice, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)\s+(?:of\s+)?(?:white\s+)?rice/, 1), 'cup'));
      }
    }
  }

  if (segment.includes('chicken') && !segment.includes('sandwich')) {
    const chicken = findCatalogFoodById('generic_grilled_chicken_breast');
    if (chicken && (items.length === 0 || /grilled|homemade|oz|ounce|ounces/.test(segment))) {
      items.push(scaleCatalogFood(chicken, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)\s+(?:of\s+)?(?:grilled\s+)?chicken/, 4), 'oz'));
    }
  }

  if (segment.includes('pasta')) {
    const pasta = findCatalogFoodById('generic_cooked_pasta');
    if (pasta) {
      const quantity = /cup|cups/.test(segment)
        ? quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)\s+(?:of\s+)?pasta/, 1)
        : 1.5;
      items.push(scaleCatalogFood(pasta, quantity, 'cup'));
    }
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
  if (segment.includes('alfredo')) {
    return makeEstimatedItem(
      'Alfredo sauce',
      1,
      'serving',
      { calories: 220, protein: 4, carbs: 6, fat: 20, fiber: 0, sugar: 2, sodium: 420 },
      'Estimated fallback for homemade Alfredo sauce'
    );
  }

  if (segment.includes('hash brown')) {
    return makeEstimatedItem(
      'Hash browns',
      1,
      'serving',
      { calories: 180, protein: 2, carbs: 24, fat: 8, fiber: 2, sugar: 0, sodium: 320 },
      'Estimated fallback for unmatched side item'
    );
  }

  if (segment.includes('chips')) {
    return makeEstimatedItem(
      'Chips',
      1,
      'serving',
      { calories: 160, protein: 2, carbs: 15, fat: 10, fiber: 1, sugar: 1, sodium: 170 },
      'Estimated fallback for unmatched snack item'
    );
  }

  if (segment.includes('cookie')) {
    return makeEstimatedItem(
      'Cookie',
      1,
      'cookie',
      { calories: 190, protein: 2, carbs: 27, fat: 8, fiber: 1, sugar: 16, sodium: 140 },
      'Estimated fallback for unmatched dessert item'
    );
  }

  return null;
}

export function getTrustedCatalogEstimate(text: string, mealType: MealTypeValue): ParsedMealResponse | null {
  const normalized = text.toLowerCase();
  const restaurantBrand = detectRestaurantBrand(normalized);
  const segments = restaurantBrand ? splitRestaurantSegments(normalized) : splitGenericSegments(normalized);
  const items: ParsedFoodItem[] = [];
  const portionFactor = restaurantBrand ? extractMealPortionFactor(normalized) : 1;

  for (const segment of segments) {
    const matchedItems = restaurantBrand
      ? matchRestaurantSegment(segment, restaurantBrand, portionFactor)
      : matchGenericSegment(segment);

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

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import type { MealTypeValue } from '@/lib/ai/orchestrate';
import {
  findCatalogFoodMatch,
  findCatalogFoodByBestMatch,
  findCatalogFoodById,
  makeCatalogMealResponse,
  makeEstimatedItem,
  quantityMatch,
  scaleCatalogFood,
  scaleParsedFoodItem,
} from '@/lib/nutrition/catalog';

type KnownRestaurantBrand =
  | 'Burger King'
  | "Cane's"
  | 'CAVA'
  | 'Chick-fil-A'
  | 'Chipotle'
  | "Domino's"
  | "Dunkin'"
  | 'Five Guys'
  | 'Jersey Mike\'s'
  | 'KFC'
  | "McDonald's"
  | 'Panera'
  | 'Panda Express'
  | 'Pizza Hut'
  | 'Popeyes'
  | 'Starbucks'
  | 'Subway'
  | 'Taco Bell'
  | "Wendy's"
  | null;

type KnownPackagedBrand =
  | 'Barebells'
  | 'Celsius'
  | 'Cheez-It'
  | 'Chobani'
  | 'Clif Bar'
  | 'Coca-Cola'
  | 'Core Power'
  | 'David'
  | 'Doritos'
  | 'Dr Pepper'
  | 'Fairlife'
  | 'Gatorade'
  | 'Goldfish'
  | 'Kodiak'
  | 'Legendary Foods'
  | 'Muscle Milk'
  | 'Nature Valley'
  | 'Oikos'
  | 'Pop-Tarts'
  | 'Premier Protein'
  | 'Pure Protein'
  | 'Quest'
  | 'Quaker'
  | 'RXBAR'
  | "Trader Joe's"
  | null;

function defaultConfidenceLabel(item: ParsedFoodItem): ParsedFoodItem['confidence_label'] {
  if (item.source_type === 'OFFICIAL_RESTAURANT') return 'Very High';
  if (item.source_type === 'AI_ESTIMATE') return 'Low';
  return 'High';
}

function defaultMatchType(item: ParsedFoodItem): ParsedFoodItem['match_type'] {
  if (item.source_type === 'OFFICIAL_RESTAURANT') return 'exact_restaurant';
  if (item.source_type === 'AI_ESTIMATE') return 'ai_estimate';
  return 'verified_database';
}

function detectRestaurantBrand(text: string): KnownRestaurantBrand {
  const compact = text.replace(/[^a-z0-9]+/g, '');
  if (text.includes('chipotle')) return 'Chipotle';
  if (text.includes('starbucks')) return 'Starbucks';
  if (text.includes('chick-fil-a') || text.includes('chick fil a')) return 'Chick-fil-A';
  if (text.includes("mcdonald") || text.includes('mc donald') || compact.includes('mcdonalds')) return "McDonald's";
  if (text.includes('panda express')) return 'Panda Express';
  if (text.includes('subway')) return 'Subway';
  if (text.includes('taco bell') || compact.includes('tacobell')) return 'Taco Bell';
  if (text.includes("wendy's") || text.includes('wendys')) return "Wendy's";
  if (text.includes('cava')) return 'CAVA';
  if (text.includes('panera')) return 'Panera';
  if (text.includes('burger king') || compact.includes('burgerking')) return 'Burger King';
  if (text.includes('dominos') || text.includes("domino's")) return "Domino's";
  if (text.includes('pizza hut') || compact.includes('pizzahut')) return 'Pizza Hut';
  if (text.includes('raising canes') || text.includes("raising cane's") || text.includes('canes') || compact.includes('raisingcanes')) return "Cane's";
  if (text.includes('popeyes')) return 'Popeyes';
  if (text.includes('dunkin')) return "Dunkin'";
  if (/\bkfc\b/.test(text)) return 'KFC';
  if (text.includes('five guys') || compact.includes('fiveguys')) return 'Five Guys';
  if (text.includes('jersey mikes') || text.includes("jersey mike's") || compact.includes('jerseymikes')) return 'Jersey Mike\'s';
  return null;
}

function detectPackagedBrand(text: string): KnownPackagedBrand {
  if (text.includes('core power')) return 'Core Power';
  if (text.includes('fairlife')) return 'Fairlife';
  if (text.includes('premier protein')) return 'Premier Protein';
  if (text.includes('quest')) return 'Quest';
  if (text.includes('quaker')) return 'Quaker';
  if (text.includes("trader joe's") || text.includes('trader joes')) return "Trader Joe's";
  if (text.includes('gatorade')) return 'Gatorade';
  if (text.includes('celsius')) return 'Celsius';
  if (text.includes('coke zero') || text.includes('coca cola') || text.includes('coke')) return 'Coca-Cola';
  if (text.includes('oikos')) return 'Oikos';
  if (text.includes('chobani') || text.includes('chobanni')) return 'Chobani';
  if (text.includes('kodiak') || text.includes('kodiac')) return 'Kodiak';
  if (text.includes('david') && (text.includes('sunflower') || text.includes('seeds') || text.includes('ranch'))) return 'David';
  if (text.includes('dr pepper') || text.includes('dr peper')) return 'Dr Pepper';
  if (text.includes('doritos') || text.includes('dorittos')) return 'Doritos';
  if (text.includes('goldfish') || text.includes('gold fish')) return 'Goldfish';
  if (text.includes('barebells') || text.includes('barebell')) return 'Barebells';
  if (text.includes('legendary') || text.includes('legendairy')) return 'Legendary Foods';
  if (text.includes('pure protein')) return 'Pure Protein';
  if (text.includes('nature valley')) return 'Nature Valley';
  if (text.includes('pop tart') || text.includes('poptart')) return 'Pop-Tarts';
  if (text.includes('cheez')) return 'Cheez-It';
  if (text.includes('clif')) return 'Clif Bar';
  if (text.includes('rxbar') || text.includes('rx bar')) return 'RXBAR';
  if (text.includes('muscle milk') || text.includes('musclemilk')) return 'Muscle Milk';
  return null;
}

const packagedSnackRegex = /\b(rice cakes?|white cheddar rice cakes?|chips?|protein bars?|popcorn|crackers?|gummy worms?|packaged snacks?)\b/i;

function cleanSegment(segment: string) {
  return segment
    .replace(/^\s*(i\s+(?:also\s+)?(?:had|ate|drank)|also\s+add|throw\s+in|plus|add|had|ate|drank|with|and|also|a|an)\s+/i, '')
    .replace(/\s+(?:from|at)\s+(?:taco\s*bell|tacobell|mc\s*donald'?s?|mcdonalds|chick\s*fil\s*a|chipotle|starbucks|subway|wendy'?s?|wendys|burger\s*king|panda\s+express|domino'?s?|pizza\s+hut|raising\s+cane'?s?|canes|popeyes|panera|dunkin|kfc|five\s+guys|jersey\s+mike'?s?)\b/gi, '')
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

const countWordMap: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function extractRestaurantItemQuantity(segment: string) {
  const match = segment.match(/\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b\s+(?:soft\s+|spicy\s+|crunchy\s+|chicken\s+|potato\s+|pepperoni\s+|turkey\s+|orange\s+|mac\s+and\s+cheese\s+|big\s+mac\s+|mcchicken\s+|caniac\s+){0,6}(?:tacos?|sandwich(?:es)?|burgers?|nuggets?|lattes?|subs?|footlongs?|bowls?|combos?|slices?|pizzas?|servings?|orders?)\b/i);
  if (!match) return 1;
  const raw = (match[1] ?? '1').toLowerCase();
  return countWordMap[raw] ?? (Number(raw) || 1);
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

  if (segment.includes('pink drink')) {
    return [makeEstimatedItem(
      'Starbucks Grande Pink Drink',
      1,
      'grande',
      { calories: 140, protein: 1, carbs: 28, fat: 2.5, fiber: 0, sugar: 25, sodium: 65 },
      'Structured restaurant estimate for Starbucks Grande Pink Drink.'
    )].map((item) => ({ ...item, is_trusted: true, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Starbucks nutrition reference', confidence_label: 'High', provider_used: 'local-verified-catalog', used_ai_fallback: false, match_type: 'fuzzy_restaurant' }));
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
  if (segment.includes('big mac') || segment.includes('bigmac')) {
    const food = findCatalogFoodById('mcdonalds_big_mac');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'burger')], factor) : [];
  }

  if (segment.includes('mcchicken') || segment.includes('mc chicken')) {
    const food = findCatalogFoodById('mcdonalds_mcchicken');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'sandwich')], factor) : [];
  }

  if (segment.includes('mcdouble') || segment.includes('mc double')) {
    const food = findCatalogFoodById('mcdonalds_mcdouble');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'burger')], factor) : [];
  }

  if (segment.includes('cheeseburger')) {
    const food = findCatalogFoodById('mcdonalds_cheeseburger');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'burger')], factor) : [];
  }

  if (segment.includes('fries') || /\bfry\b/.test(segment)) {
    const food = findCatalogFoodById('mcdonalds_fries');
    const unit = segment.includes('large') ? 'large order' : segment.includes('small') ? 'small order' : 'medium order';
    return food ? scaleItems([scaleCatalogFood(food, 1, unit)], factor) : [];
  }

  if (segment.includes('coke') || segment.includes('sprite') || segment.includes('drink')) {
    const food = findCatalogFoodById('mcdonalds_soft_drink');
    return food ? scaleItems([scaleCatalogFood(food, 1, 'medium')], factor) : [];
  }

  return [];
}

function matchRestaurantAlias(segment: string, brand: Exclude<KnownRestaurantBrand, null>, factor: number) {
  if (brand === 'Taco Bell' && segment.includes('crunch') && segment.includes('wrap')) {
    return [makeEstimatedItem('Taco Bell Crunchwrap Supreme', 1, 'item', { calories: 540, protein: 16, carbs: 71, fat: 21, fiber: 6, sugar: 6, sodium: 1210 }, 'Structured restaurant estimate for Taco Bell Crunchwrap Supreme.')].map((item) => ({ ...item, is_trusted: true, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Taco Bell nutrition reference', confidence_label: 'High', provider_used: 'local-verified-catalog', used_ai_fallback: false, match_type: 'fuzzy_restaurant' }));
  }

  const food = findCatalogFoodByBestMatch(segment, brand);
  const quantity = extractRestaurantItemQuantity(segment);
  return food ? scaleItems([scaleCatalogFood(food, quantity, food.servingUnit)], factor) : [];
}

function matchRestaurantSegment(segment: string, brand: Exclude<KnownRestaurantBrand, null>, factor: number) {
  let matchedItems: ParsedFoodItem[] = [];

  if (brand === 'Chipotle') matchedItems = matchChipotleSegment(segment, factor);
  else if (brand === 'Starbucks') matchedItems = matchStarbucksSegment(segment, factor);
  else if (brand === 'Chick-fil-A') matchedItems = matchChickFilASegment(segment, factor);
  else if (brand === "McDonald's") matchedItems = matchMcDonaldsSegment(segment, factor);
  else if (brand === 'Taco Bell' && segment.includes('crunchy tacos')) {
    const food = findCatalogFoodById('tacobell_crunchy_taco');
    matchedItems = food ? scaleItems([scaleCatalogFood(food, 1, 'taco')], factor).map((item) => ({ ...item, food_name: 'Taco Bell Crunchy Tacos' })) : [];
  }

  if (matchedItems.length) {
    return matchedItems;
  }

  return matchRestaurantAlias(segment, brand, factor);
}

function extractPackagedQuantity(segment: string, unit: string) {
  const quantityReadySegment = segment.replace(/\b\d+(?:\.\d+)?\s*(?:g|gram|grams)\b/g, '').trim();

  if (unit === 'bar') {
    return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)\s*(?:quest\s+)?(?:bar|bars)/, 1);
  }

  if (unit === 'bottle') {
    return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)\s*(?:bottle|bottles|shake|shakes)/, 1);
  }

  if (unit === 'can') {
    return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)\s*(?:can|cans)/, 1);
  }

  if (unit === 'cup') {
    return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)/, 1);
  }

  if (unit === 'cake') {
    return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)\s+(?:[a-z]+\s+){0,4}(?:rice cake|rice cakes|cake|cakes)/, 1);
  }

  if (unit === 'serving') {
    return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)\s*(?:serving|servings|bag|bags|pack|packs)/, /\b(?:whole|entire)\s+bag\b/.test(quantityReadySegment) ? 1 : 1);
  }

  if (unit === 'cookie') {
    return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)\s*(?:cookie|cookies)/, 1);
  }

  return quantityMatch(quantityReadySegment, /(\d+(?:\.\d+)?)/, 1);
}

function buildPackagedMatchNotes(segment: string, foodName: string) {
  if (/\b\d+(?:\.\d+)?\s*(?:g|gram|grams)\b/.test(segment)) {
    return `Estimated as ${foodName}. Adjust if needed.`;
  }

  if (segment.includes('white cheddar') || segment.includes('quaker') || segment.includes('fairlife') || segment.includes('core power') || segment.includes('premier protein')) {
    return `Matched to ${foodName}. Adjust if your exact product or flavor differs.`;
  }

  return `Matched to ${foodName}.`;
}

function getPackagedBrandCandidates(brand: Exclude<KnownPackagedBrand, null>, segment: string) {
  const hasProteinSignal = /\b(?:26|42)\s*(?:g|gram|grams)\b/.test(segment);
  const mentionsCorePower = segment.includes('core power') || segment.includes('elite');

  if (brand === 'Fairlife' && (hasProteinSignal || mentionsCorePower)) {
    return ['Fairlife', 'Core Power'] as const;
  }

  if (brand === 'Core Power') {
    return ['Core Power'] as const;
  }

  return [brand] as const;
}

function looksLikePackagedSnack(segment: string) {
  return packagedSnackRegex.test(segment) || Boolean(detectPackagedBrand(segment));
}

function normalizePackagedSearch(segment: string) {
  return segment
    .replace(/\bwhich\s+are\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*(?:cals?|calories?)\s*(?:each)?\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:cals?|calories?)\s*(?:each)?\b/g, ' ')
    .replace(/^\s*(?:\d+(?:\.\d+)?|a|an|one|two|three|four|five|six)\s+/i, '')
    .replace(/\beach\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchPackagedSegment(segment: string): ParsedFoodItem[] {
  if (!looksLikePackagedSnack(segment)) {
    return [];
  }

  const brand = detectPackagedBrand(segment);
  const packagedSearch = normalizePackagedSearch(segment);
  const candidateMatches = [
    ...(brand ? getPackagedBrandCandidates(brand, packagedSearch).map((candidateBrand) => findCatalogFoodMatch(packagedSearch, candidateBrand)) : []),
  ].filter((candidate): candidate is NonNullable<ReturnType<typeof findCatalogFoodMatch>> => Boolean(candidate));

  const match = candidateMatches.sort((left, right) => right.score - left.score)[0] ?? findCatalogFoodMatch(packagedSearch) ?? null;

  if (!match) {
    return [];
  }

  const food = match.food;
  const quantity = extractPackagedQuantity(segment, food.servingUnit);
  const scaled = scaleCatalogFood(food, quantity, food.servingUnit);

  return [
    {
      ...scaled,
      notes: buildPackagedMatchNotes(segment, food.canonicalName),
      source_name: match.exactProduct || match.exactAlias
        ? `${scaled.source_name ?? 'Branded nutrition reference'} · high-confidence product match`
        : scaled.source_name,
      confidence_label: match.exactProduct || match.exactAlias ? 'Very High' : 'High',
      match_type: match.exactProduct || match.exactAlias ? 'exact_branded' : 'fuzzy_branded',
      matched_query: food.canonicalName,
      used_ai_fallback: false,
    },
  ];
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

  if (segment.includes('rice') && !segment.includes('rice cake')) {
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

  if ((segment.includes('oats') || segment.includes('oatmeal')) && !segment.includes('quaker oats') && !segment.includes('rice cake')) {
    const oats = findCatalogFoodById('generic_oats');
    if (oats) items.push(scaleCatalogFood(oats, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:cup|cups)\s+(?:of\s+)?(?:oats|oatmeal)/, 0.5), 'cup'));
  }

  if (segment.includes('banana')) {
    const banana = findCatalogFoodById('generic_banana');
    if (banana) items.push(scaleCatalogFood(banana, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:banana|bananas)/, 1), 'banana'));
  }

  if (segment.includes('apple')) {
    const apple = findCatalogFoodById('generic_apple');
    if (apple) items.push(scaleCatalogFood(apple, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:apple|apples)/, 1), 'apple'));
  }

  if (segment.includes('rice cake')) {
    const riceCake = findCatalogFoodById('generic_rice_cake');
    if (riceCake) items.push(scaleCatalogFood(riceCake, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:rice cake|rice cakes)/, 1), 'cake'));
  }

  if (segment.includes('bagel')) {
    const bagel = findCatalogFoodById('generic_bagel');
    if (bagel) items.push(scaleCatalogFood(bagel, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:bagel|bagels)/, 1), 'bagel'));
  }

  if (segment.includes('quest') && segment.includes('cookie')) {
    const cookie = findCatalogFoodById('quest_chocolate_chip_cookie');
    if (cookie) items.push(scaleCatalogFood(cookie, extractPackagedQuantity(segment, 'cookie'), 'cookie'));
  }

  if (segment.includes('protein bar')) {
    const proteinBar = findCatalogFoodById('generic_protein_bar');
    if (proteinBar) items.push(scaleCatalogFood(proteinBar, quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:protein bar|protein bars)/, 1), 'bar'));
  }

  if (segment.includes('greek yogurt') || (/\byogurt\b/.test(segment) && !detectPackagedBrand(segment))) {
    const greekYogurt = findCatalogFoodById('generic_greek_yogurt');
    if (greekYogurt) {
      items.push(
        scaleCatalogFood(
          greekYogurt,
          quantityMatch(segment, /(\d+(?:\.\d+)?)\s*(?:greek\s+)?(?:yogurt|yogurts|cup|cups|container|containers)/, 1),
          'cup',
        ),
      );
    }
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

  if (segment.includes('fries') || segment.includes('fry')) {
    const isMedium = segment.includes('medium');
    return makeEstimatedItem(
      isMedium ? 'Medium fries' : 'Fries',
      1,
      isMedium ? 'medium order' : 'order',
      { calories: isMedium ? 350 : 320, protein: isMedium ? 5 : 4, carbs: isMedium ? 48 : 43, fat: isMedium ? 16 : 15, fiber: 5, sugar: 0, sodium: isMedium ? 520 : 470 },
      'Estimated fallback for unmatched restaurant fries'
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
  if (/\bdavid\b/.test(normalized) && /\branch\b/.test(normalized) && /\b(?:flavou?r|sunflower|seeds?)\b/.test(normalized)) {
    const davidSeeds = findCatalogFoodById('david_sunflower_seeds');
    if (davidSeeds) {
      const unit = /\b(?:whole|entire)\s+bag\b|\bbag\b/.test(normalized) ? 'bag' : 'serving';
      return makeCatalogMealResponse(mealType, [{ ...scaleCatalogFood(davidSeeds, 1, unit), used_ai_fallback: false }], 0.9);
    }
  }

  const restaurantBrand = detectRestaurantBrand(normalized);
  const segments = restaurantBrand ? splitRestaurantSegments(normalized) : splitGenericSegments(normalized);
  const items: ParsedFoodItem[] = [];
  const portionFactor = restaurantBrand ? extractMealPortionFactor(normalized) : 1;

  for (const segment of segments) {
    const matchedItems = restaurantBrand
      ? matchRestaurantSegment(segment, restaurantBrand, portionFactor)
      : matchGenericSegment(segment);

    if (matchedItems.length) {
      items.push(...matchedItems.map((item) => ({
        ...item,
        confidence_label: (item.confidence_label ?? defaultConfidenceLabel(item)) as ParsedFoodItem['confidence_label'],
        match_type: (item.match_type ?? defaultMatchType(item)) as ParsedFoodItem['match_type'],
      }) as ParsedFoodItem));

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
